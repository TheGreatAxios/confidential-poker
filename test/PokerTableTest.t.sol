// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {PokerTable} from "../contracts/src/PokerTable.sol";

contract PokerTableTest is Test {
    PokerTable table;

    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address carol = address(0xCA70);

    uint256 constant BUY_IN = 1 ether;

    function setUp() public {
        table = new PokerTable(100 gwei, 200 gwei, 0.01 ether, 6);

        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
        vm.deal(carol, 10 ether);
    }

    // ══════════════ TABLE SETUP ══════════════

    function testCreateTable() public {
        assertEq(table.smallBlind(), 100 gwei);
        assertEq(table.bigBlind(), 200 gwei);
        assertEq(table.minBuyIn(), 0.01 ether);
        assertEq(table.maxPlayers(), 6);
    }

    // ══════════════ SIT DOWN ══════════════

    function testSitDown() public {
        vm.prank(alice);
        table.sitDown{value: BUY_IN}(bytes32(0));

        assertTrue(table.isPlayerSeated(alice));
        assertEq(table.getPlayers()[0].stack, BUY_IN);
        assertEq(table.getSeatedPlayerCount(), 1);
    }

    function testCannotSitWithZeroEth() public {
        vm.prank(alice);
        vm.expectRevert(PokerTable.BuyInTooLow.selector);
        table.sitDown{value: 0}(bytes32(0));
    }

    function testCannotSitTwice() public {
        vm.startPrank(alice);
        table.sitDown{value: BUY_IN}(bytes32(0));
        vm.expectRevert(PokerTable.AlreadySeated.selector);
        table.sitDown{value: BUY_IN}(bytes32(0));
        vm.stopPrank();
    }

    function testBuyInTooLow() public {
        vm.prank(alice);
        vm.expectRevert(PokerTable.BuyInTooLow.selector);
        table.sitDown{value: 100}(bytes32(0));
    }

    // ══════════════ LEAVE TABLE ══════════════

    function testLeaveTable() public {
        vm.startPrank(alice);
        table.sitDown{value: BUY_IN}(bytes32(0));
        table.leaveTable();
        vm.stopPrank();

        assertFalse(table.isPlayerSeated(alice));
        assertEq(table.getSeatedPlayerCount(), 0);
    }

    function testLeaveTableFee() public {
        vm.startPrank(alice);
        table.sitDown{value: BUY_IN}(bytes32(0));
        uint256 balBefore = alice.balance;
        table.leaveTable();
        uint256 balAfter = alice.balance;
        vm.stopPrank();

        // 1% fee
        uint256 expected = BUY_IN - (BUY_IN / 100);
        assertEq(balAfter - balBefore, expected);
    }

    function testLeaveDuringHandWithPenalty() public {
        _seatPlayers();
        table.dealNewHand();

        // Alice's blinds were already posted, so stack < BUY_IN
        uint256 aliceIdx = _findPlayerIdx(alice);
        uint256 stack = table.getPlayers()[aliceIdx].stack;

        uint256 balBefore = alice.balance;
        vm.prank(alice);
        table.leaveTable();
        uint256 cashout = alice.balance - balBefore;

        // 10% penalty + 1% fee on remaining
        uint256 expectedPenalty = (stack * 1000) / 10000;
        uint256 afterPenalty = stack - expectedPenalty;
        uint256 expectedFee = (afterPenalty * 100) / 10000;
        uint256 expected = afterPenalty - expectedFee;

        assertEq(cashout, expected);
    }

    // ══════════════ DEAL HAND ══════════════

    function testDealNewHand() public {
        _seatPlayers();
        table.dealNewHand();

        assertEq(uint8(table.phase()), 1); // Preflop
        assertEq(table.handCount(), 1);
        assertTrue(table.pot() > 0); // blinds posted
    }

    function testCannotDealWithOnePlayer() public {
        vm.prank(alice);
        table.sitDown{value: BUY_IN}(bytes32(0));

        vm.expectRevert(PokerTable.NotEnoughPlayers.selector);
        table.dealNewHand();
    }

    function testDealPostsBlinds() public {
        _seatPlayers();
        table.dealNewHand();

        assertEq(table.pot(), 100 gwei + 200 gwei);
    }

    // ══════════════ ACTIONS ══════════════

    function testFold() public {
        _seatPlayers();
        table.dealNewHand();

        address active = table.getActivePlayer();
        vm.prank(active);
        table.fold();
        assertTrue(table.isPlayerFolded(active));
    }

    function testCheck() public {
        _seatPlayers();
        table.dealNewHand();

        // UTG calls big blind first
        address active = table.getActivePlayer();
        uint256 toCall = table.currentMaxBet() - _getPlayerCurrentBet(active);
        if (toCall > 0) {
            vm.prank(active);
            table.call();
            active = table.getActivePlayer();
        }

        // Next player may be able to check
        toCall = table.currentMaxBet() - _getPlayerCurrentBet(active);
        if (toCall == 0) {
            vm.prank(active);
            table.check();
        } else {
            vm.prank(active);
            table.call();
        }
    }

    function testCannotCheckWhenBetExists() public {
        _seatPlayers();
        table.dealNewHand();

        address active = table.getActivePlayer();
        uint256 toCall = table.currentMaxBet() - _getPlayerCurrentBet(active);
        if (toCall == 0) {
            vm.prank(active);
            table.check();
            active = table.getActivePlayer();
        }

        // Now raise to create a bet
        vm.prank(active);
        table.raise(1 ether);

        active = table.getActivePlayer();
        vm.prank(active);
        vm.expectRevert(PokerTable.CannotCheck.selector);
        table.check();
    }

    function testRaise() public {
        _seatPlayers();
        table.dealNewHand();

        address active = table.getActivePlayer();
        uint256 stackBefore =
            _findPlayerIdx(active) < table.getPlayers().length ? table.getPlayers()[_findPlayerIdx(active)].stack : 0;

        vm.prank(active);
        table.raise(1 ether);

        uint256 stackAfter = table.getPlayers()[_findPlayerIdx(active)].stack;
        assertTrue(stackAfter < stackBefore);
    }

    // ══════════════ GAME FLOW ══════════════

    function testFoldWinsPot() public {
        _seatPlayers();
        table.dealNewHand();

        // Fold all but one
        _foldAllButOne();

        // One player left → phase should be Finished
        assertEq(uint8(table.phase()), 6); // Finished
    }

    function testMultipleHands() public {
        _seatPlayers();

        // Hand 1
        table.dealNewHand();
        _foldAllButOne();

        // Hand 2
        table.dealNewHand();
        assertEq(table.handCount(), 2);
    }

    // ══════════════ HELPERS ══════════════

    function _getPlayerCurrentBet(address who) internal view returns (uint256) {
        for (uint256 i = 0; i < table.getPlayers().length; i++) {
            if (table.getPlayers()[i].addr == who) return table.getPlayers()[i].currentBet;
        }
        return 0;
    }

    function _seatPlayers() internal {
        vm.prank(alice);
        table.sitDown{value: BUY_IN}(bytes32(0));
        vm.prank(bob);
        table.sitDown{value: BUY_IN}(bytes32(0));
    }

    function _findPlayerIdx(address who) internal view returns (uint256) {
        for (uint256 i = 0; i < table.getPlayers().length; i++) {
            if (table.getPlayers()[i].addr == who) return i;
        }
        revert("Player not found");
    }

    function _foldAllButOne() internal {
        uint256 limit = table.getPlayers().length;
        for (uint256 i = 0; i < limit - 1; i++) {
            address active = table.getActivePlayer();
            if (active == address(0)) break;
            vm.prank(active);
            table.fold();
        }
    }
}
