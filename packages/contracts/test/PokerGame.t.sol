// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import {Test} from "forge-std/Test.sol";
import {HandEvaluator} from "../src/HandEvaluator.sol";
import {MockSKL} from "../src/MockSKL.sol";
import {ChipToken} from "../src/ChipToken.sol";
import {PokerFactory} from "../src/PokerFactory.sol";
import {PokerGame} from "../src/PokerGame.sol";
import {PublicKey} from "@skalenetwork/bite-solidity/BITE.sol";
import {BiteMock} from "@skalenetwork/bite-solidity/test/BiteMock.sol";
import {SubmitCTXMock} from "@skalenetwork/bite-solidity/test/SubmitCTXMock.sol";
import {EncryptTEMock} from "@skalenetwork/bite-solidity/test/EncryptTEMock.sol";
import {EncryptECIESMock} from "@skalenetwork/bite-solidity/test/EncryptECIESMock.sol";

contract PokerGameHarness is PokerGame {
    constructor(
        address _gameToken,
        address _owner,
        uint256 _buyIn,
        uint256 _smallBlind,
        uint256 _bigBlind,
        uint256 _maxPlayers,
        uint256 _ctxCallbackValueWei,
        string memory _tableName
    )
        payable
        PokerGame(
            _gameToken, _owner, _buyIn, _smallBlind, _bigBlind, _maxPlayers, _ctxCallbackValueWei, _tableName
        )
    {}

    function buildDeckForTest(uint256 cursor) external returns (uint8[52] memory) {
        rngCursor = cursor;
        return _buildShuffledDeck();
    }

    function evaluateHandForTest(uint8[7] memory cards) external pure returns (HandEvaluator.EvalResult memory) {
        return HandEvaluator.evaluateHand(cards);
    }

    function uniqueSortedLevelsForTest(uint256[] memory vals) external pure returns (uint256[] memory) {
        return _uniqueSortedLevels(vals);
    }
}

abstract contract BiteMockSetup is Test {
    BiteMock internal biteMock;

    function _setupBiteMocks() internal returns (BiteMock) {
        biteMock = new BiteMock();
        vm.etch(address(0x1B), address(new SubmitCTXMock(biteMock)).code);
        vm.etch(address(0x1C), address(new EncryptECIESMock(biteMock)).code);
        vm.etch(address(0x1D), address(new EncryptTEMock(biteMock)).code);
        return biteMock;
    }

    function _viewerKey(uint256 seed) internal pure returns (PublicKey memory) {
        return PublicKey({x: bytes32(seed), y: bytes32(seed + 1)});
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// CHIP TOKEN TESTS
// ═══════════════════════════════════════════════════════════════════════════

contract ChipTokenTest is Test {
    MockSKL internal underlying;
    ChipToken internal chips;
    address internal alice = address(0xA11CE);

    function setUp() external {
        underlying = new MockSKL();
        chips = new ChipToken(address(underlying), "Poker Chips", "CHIPS");
        underlying.mint(alice, 10_000e18);
        vm.prank(alice);
        underlying.approve(address(chips), type(uint256).max);
    }

    function testDeposit() external {
        uint256 amt = 1000e18;
        vm.prank(alice);
        chips.deposit(amt);
        assertEq(chips.balanceOf(alice), amt);
        assertEq(underlying.balanceOf(address(chips)), amt);
    }

    function testWithdraw() external {
        uint256 amt = 1000e18;
        vm.prank(alice);
        chips.deposit(amt);
        vm.prank(alice);
        chips.withdraw(amt);
        assertEq(chips.balanceOf(alice), 0);
        assertEq(underlying.balanceOf(alice), 10_000e18);
    }

    function testWithdrawRevertsOnInsufficientBalance() external {
        vm.prank(alice);
        vm.expectRevert();
        chips.withdraw(1);
    }

    function testZeroAmountReverts() external {
        vm.prank(alice);
        vm.expectRevert(ChipToken.ZeroAmount.selector);
        chips.deposit(0);
        vm.prank(alice);
        vm.expectRevert(ChipToken.ZeroAmount.selector);
        chips.withdraw(0);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// POKER FACTORY TESTS
// ═══════════════════════════════════════════════════════════════════════════

contract PokerFactoryTest is Test {
    uint256 constant CALLBACK_VALUE = 1 ether;
    uint256 constant MIN_RESERVE = CALLBACK_VALUE * 10;
    uint256 constant BUY_IN = 1000e18;
    uint256 constant SB = 5e17;
    uint256 constant BB = 1e18;

    MockSKL internal underlying;
    ChipToken internal chips;
    PokerFactory internal factory;
    address internal alice = address(0xA11CE);

    function setUp() external {
        underlying = new MockSKL();
        chips = new ChipToken(address(underlying), "Poker Chips", "CHIPS");
        factory = new PokerFactory(address(chips), CALLBACK_VALUE);
        underlying.mint(alice, 100_000e18);
        vm.prank(alice);
        underlying.approve(address(chips), type(uint256).max);
    }

    function testCreateTable() external {
        address table = factory.createTable{value: MIN_RESERVE}(BUY_IN, SB, BB, 6, "Table 1");
        assertTrue(factory.isKnownTable(table));
        assertEq(factory.getTableCount(), 1);
        assertEq(factory.getTable(0), table);
    }

    function testCreateTableRevertsOnInsufficientPayment() external {
        vm.expectRevert();
        factory.createTable{value: MIN_RESERVE - 1}(BUY_IN, SB, BB, 6, "Table 1");
    }

    function testGetAllTables() external {
        factory.createTable{value: MIN_RESERVE}(BUY_IN, SB, BB, 6, "T1");
        factory.createTable{value: MIN_RESERVE}(BUY_IN * 2, SB * 2, BB * 2, 10, "T2");
        address[] memory all = factory.getAllTables();
        assertEq(all.length, 2);
    }

    function testGetTablesByBuyIn() external {
        factory.createTable{value: MIN_RESERVE}(BUY_IN, SB, BB, 6, "T1");
        factory.createTable{value: MIN_RESERVE}(BUY_IN * 2, SB * 2, BB * 2, 10, "T2");
        factory.createTable{value: MIN_RESERVE}(BUY_IN, SB, BB, 6, "T3");
        address[] memory filtered = factory.getTablesByBuyIn(BUY_IN);
        assertEq(filtered.length, 2);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// HAND EVALUATOR TESTS
// ═══════════════════════════════════════════════════════════════════════════

contract HandEvaluatorTest is Test, BiteMockSetup {
    PokerGameHarness internal harness;
    MockSKL internal token;

    function setUp() external {
        _setupBiteMocks();
        token = new MockSKL();
        harness = new PokerGameHarness{value: 20 ether}(
            address(token), address(this), 1000e18, 5e17, 1e18, 6, 1 ether, "Test"
        );
    }

    function testShuffledDeckContains52UniqueCards() external {
        uint8[52] memory deck = harness.buildDeckForTest(1);
        bool[64] memory seen;
        for (uint256 i = 0; i < 52; i++) {
            uint8 card = deck[i];
            assertFalse(seen[card]);
            seen[card] = true;
        }
    }

    function testHighCardKickerUsesRankNotSuit() external view {
        uint8[7] memory left = [
            HandEvaluator.heart(2),
            HandEvaluator.diamond(6),
            HandEvaluator.club(12),
            HandEvaluator.diamond(13),
            HandEvaluator.diamond(9),
            HandEvaluator.diamond(3),
            HandEvaluator.heart(14)
        ];
        uint8[7] memory right = [
            HandEvaluator.club(4),
            HandEvaluator.club(7),
            HandEvaluator.club(12),
            HandEvaluator.diamond(13),
            HandEvaluator.diamond(9),
            HandEvaluator.diamond(3),
            HandEvaluator.heart(14)
        ];

        HandEvaluator.EvalResult memory leftResult = harness.evaluateHandForTest(left);
        HandEvaluator.EvalResult memory rightResult = harness.evaluateHandForTest(right);

        assertTrue(HandEvaluator.gte(rightResult, leftResult));
        assertFalse(HandEvaluator.gte(leftResult, rightResult));
        assertEq(uint256(rightResult.primary), 14);
        assertEq(uint256(rightResult.secondary), 13);
        assertEq(uint256(rightResult.tertiary), 12);
        assertEq(uint256(rightResult.quaternary), 9);
        assertEq(uint256(rightResult.quinary), 7);
    }

    function testRoyalFlushBeatsStraightFlush() external pure {
        uint8[7] memory royal = [
            HandEvaluator.spade(14),
            HandEvaluator.spade(13),
            HandEvaluator.spade(12),
            HandEvaluator.spade(11),
            HandEvaluator.spade(10),
            HandEvaluator.heart(2),
            HandEvaluator.diamond(3)
        ];
        uint8[7] memory straightFlush = [
            HandEvaluator.heart(9),
            HandEvaluator.heart(8),
            HandEvaluator.heart(7),
            HandEvaluator.heart(6),
            HandEvaluator.heart(5),
            HandEvaluator.club(2),
            HandEvaluator.diamond(3)
        ];

        HandEvaluator.EvalResult memory r1 = HandEvaluator.evaluateHand(royal);
        HandEvaluator.EvalResult memory r2 = HandEvaluator.evaluateHand(straightFlush);

        assertEq(uint256(r1.handRank), 8);
        assertEq(uint256(r1.primary), 14);
        assertEq(uint256(r2.handRank), 8);
        assertEq(uint256(r2.primary), 9);
        assertTrue(HandEvaluator.gte(r1, r2));
        assertFalse(HandEvaluator.gte(r2, r1));
    }

    function testTieDetection() external pure {
        uint8[7] memory hand1 = [
            HandEvaluator.spade(14),
            HandEvaluator.heart(14),
            HandEvaluator.club(10),
            HandEvaluator.diamond(9),
            HandEvaluator.spade(7),
            HandEvaluator.heart(3),
            HandEvaluator.diamond(2)
        ];
        uint8[7] memory hand2 = [
            HandEvaluator.spade(14),
            HandEvaluator.heart(14),
            HandEvaluator.club(10),
            HandEvaluator.diamond(9),
            HandEvaluator.spade(7),
            HandEvaluator.heart(3),
            HandEvaluator.diamond(2)
        ];

        HandEvaluator.EvalResult memory r1 = HandEvaluator.evaluateHand(hand1);
        HandEvaluator.EvalResult memory r2 = HandEvaluator.evaluateHand(hand2);

        assertTrue(HandEvaluator.gte(r1, r2));
        assertTrue(HandEvaluator.gte(r2, r1));
    }

    function testWheelStraight() external pure {
        uint8[7] memory hand = [
            HandEvaluator.spade(14),
            HandEvaluator.heart(2),
            HandEvaluator.club(3),
            HandEvaluator.diamond(4),
            HandEvaluator.spade(5),
            HandEvaluator.heart(10),
            HandEvaluator.diamond(9)
        ];
        HandEvaluator.EvalResult memory r = HandEvaluator.evaluateHand(hand);
        assertEq(uint256(r.handRank), 4);
        assertEq(uint256(r.primary), 5);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// SIDE POT & SPLIT POT MATH TESTS
// ═══════════════════════════════════════════════════════════════════════════

contract SidePotMathTest is Test, BiteMockSetup {
    PokerGameHarness internal harness;
    MockSKL internal token;

    function setUp() external {
        _setupBiteMocks();
        token = new MockSKL();
        harness = new PokerGameHarness{value: 20 ether}(
            address(token), address(this), 1000e18, 5e17, 1e18, 6, 1 ether, "SidePot"
        );
    }

    function testUniqueSortedLevelsAllSame() external view {
        uint256[] memory vals = new uint256[](3);
        vals[0] = 100;
        vals[1] = 100;
        vals[2] = 100;
        uint256[] memory levels = harness.uniqueSortedLevelsForTest(vals);
        assertEq(levels.length, 1);
        assertEq(levels[0], 100);
    }

    function testUniqueSortedLevelsAlreadySorted() external view {
        uint256[] memory vals = new uint256[](4);
        vals[0] = 10;
        vals[1] = 20;
        vals[2] = 30;
        vals[3] = 40;
        uint256[] memory levels = harness.uniqueSortedLevelsForTest(vals);
        assertEq(levels.length, 4);
        assertEq(levels[0], 10);
        assertEq(levels[1], 20);
        assertEq(levels[2], 30);
        assertEq(levels[3], 40);
    }

    function testUniqueSortedLevelsSingleValue() external view {
        uint256[] memory vals = new uint256[](1);
        vals[0] = 42;
        uint256[] memory levels = harness.uniqueSortedLevelsForTest(vals);
        assertEq(levels.length, 1);
        assertEq(levels[0], 42);
    }

    function testUniqueSortedLevelsEmpty() external view {
        uint256[] memory vals = new uint256[](3);
        vals[0] = 0;
        vals[1] = 0;
        vals[2] = 0;
        uint256[] memory levels = harness.uniqueSortedLevelsForTest(vals);
        assertEq(levels.length, 0);
    }

    function testUniqueSortedLevelsDuplicatesAndZero() external view {
        uint256[] memory vals = new uint256[](5);
        vals[0] = 200;
        vals[1] = 100;
        vals[2] = 200;
        vals[3] = 50;
        vals[4] = 150;
        uint256[] memory levels = harness.uniqueSortedLevelsForTest(vals);
        assertEq(levels.length, 4);
        assertEq(levels[0], 50);
        assertEq(levels[1], 100);
        assertEq(levels[2], 150);
        assertEq(levels[3], 200);
    }

    function testHandEvaluatorGtEq() external pure {
        HandEvaluator.EvalResult memory a =
            HandEvaluator.EvalResult({handRank: 2, primary: 10, secondary: 5, tertiary: 3, quaternary: 0, quinary: 0});
        HandEvaluator.EvalResult memory b =
            HandEvaluator.EvalResult({handRank: 2, primary: 10, secondary: 5, tertiary: 3, quaternary: 0, quinary: 0});
        assertTrue(HandEvaluator.gte(a, b));
        assertTrue(HandEvaluator.gte(b, a));
        assertFalse(HandEvaluator._gt(a, b));
    }

    function testHandEvaluatorGtDifferentPrimary() external pure {
        HandEvaluator.EvalResult memory a =
            HandEvaluator.EvalResult({handRank: 2, primary: 14, secondary: 5, tertiary: 0, quaternary: 0, quinary: 0});
        HandEvaluator.EvalResult memory b =
            HandEvaluator.EvalResult({handRank: 2, primary: 10, secondary: 13, tertiary: 0, quaternary: 0, quinary: 0});
        assertTrue(HandEvaluator._gt(a, b));
        assertFalse(HandEvaluator._gt(b, a));
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// POKER GAME UNIT TESTS (no game flow, just state transitions)
// ═══════════════════════════════════════════════════════════════════════════

contract PokerGameUnitTest is Test, BiteMockSetup {
    uint256 constant CALLBACK_VALUE = 1 ether;
    uint256 constant MIN_RESERVE = CALLBACK_VALUE * 10;
    uint256 constant BUY_IN = 1000e18;
    uint256 constant SB = 5e17;
    uint256 constant BB = 1e18;

    MockSKL internal token;
    PokerGame internal game;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xC4401);

    function setUp() external {
        _setupBiteMocks();
        token = new MockSKL();
        game = new PokerGame{value: MIN_RESERVE * 5}(
            address(token), address(this), BUY_IN, SB, BB, 6, CALLBACK_VALUE, "Unit Test"
        );

        token.mint(alice, BUY_IN);
        token.mint(bob, BUY_IN);
        token.mint(carol, BUY_IN);

        vm.prank(alice);
        token.approve(address(game), BUY_IN);
        vm.prank(bob);
        token.approve(address(game), BUY_IN);
        vm.prank(carol);
        token.approve(address(game), BUY_IN);
    }

    function testConstructorRequiresMinReserve() external {
        vm.expectRevert(PokerGame.InsufficientCtxReserve.selector);
        new PokerGame{value: MIN_RESERVE - 1}(address(token), address(this), BUY_IN, SB, BB, 6, CALLBACK_VALUE, "X");
    }

    function testConstructorValidatesBuyIn() external {
        vm.expectRevert(PokerGame.BuyInOutOfRange.selector);
        new PokerGame{value: MIN_RESERVE}(address(token), address(this), 1e18, SB, BB, 6, CALLBACK_VALUE, "X");
    }

    function testSitDown() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        assertEq(game.playerCount(), 1);
    }

    function testCannotJoinTwice() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(alice);
        vm.expectRevert(PokerGame.AlreadyJoined.selector);
        game.sitDown(_viewerKey(2));
    }

    function testGameIsFull() external {
        address[6] memory addrs = [address(1), address(2), address(3), address(4), address(5), address(6)];
        for (uint256 i = 0; i < 6; i++) {
            token.mint(addrs[i], BUY_IN);
            vm.prank(addrs[i]);
            token.approve(address(game), BUY_IN);
            vm.prank(addrs[i]);
            game.sitDown(_viewerKey(i + 10));
        }
        vm.prank(carol);
        vm.expectRevert(PokerGame.GameIsFull.selector);
        game.sitDown(_viewerKey(99));
    }

    function _readyUpAll() internal {
        vm.prank(alice);
        game.readyUp();
        vm.prank(bob);
        game.readyUp();
    }

    function testSitDownRevertsDuringGame() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));

        _readyUpAll();

        vm.prank(carol);
        vm.expectRevert(PokerGame.GameInProgress.selector);
        game.sitDown(_viewerKey(3));
    }

    function testLeaveRequestAndCancel() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));

        vm.prank(alice);
        game.requestLeave();
        assertTrue(game.isLeaveRequested(alice));

        vm.prank(alice);
        game.cancelLeave();
        assertFalse(game.isLeaveRequested(alice));
    }

    function testLeaveTableReturnsChips() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));

        uint256 balBefore = token.balanceOf(alice);
        vm.prank(alice);
        game.leaveTable();
        assertEq(token.balanceOf(alice), balBefore + BUY_IN);
        assertEq(game.playerCount(), 0);
    }

    function testLeaveTableRevertsDuringGame() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));
        _readyUpAll();

        vm.prank(alice);
        vm.expectRevert(PokerGame.GameInProgress.selector);
        game.leaveTable();
    }

    function testRequestLeaveNonPlayerReverts() external {
        vm.expectRevert(PokerGame.NotAPlayer.selector);
        game.requestLeave();
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// POKER GAME INTEGRATION TESTS (with BITE mocks, full game flow)
// ═══════════════════════════════════════════════════════════════════════════

contract PokerGameIntegrationTest is Test, BiteMockSetup {
    using HandEvaluator for uint8[7];

    uint256 constant CALLBACK_VALUE = 1 ether;
    uint256 constant MIN_RESERVE = CALLBACK_VALUE * 10;
    uint256 constant BUY_IN = 1000e18;
    uint256 constant SB = 5e17;
    uint256 constant BB = 1e18;

    MockSKL internal token;
    PokerGame internal game;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xC4401);

    event PhaseChanged(PokerGame.GamePhase newPhase, uint256 handNumber);
    event HandResult(address[] winners, uint256[] amounts, string[] handNames);

    function setUp() external {
        _setupBiteMocks();
        token = new MockSKL();
        game = new PokerGame{value: MIN_RESERVE * 5}(
            address(token), address(this), BUY_IN, SB, BB, 6, CALLBACK_VALUE, "Integration"
        );

        token.mint(alice, BUY_IN);
        token.mint(bob, BUY_IN);
        token.mint(carol, BUY_IN);

        vm.prank(alice);
        token.approve(address(game), BUY_IN);
        vm.prank(bob);
        token.approve(address(game), BUY_IN);
        vm.prank(carol);
        token.approve(address(game), BUY_IN);
    }

    function _currentTurnPlayer() internal view returns (address) {
        uint256 idx = game.getCurrentTurnIndex();
        if (idx == type(uint256).max) return address(0);
        (address addr,,,,,) = game.getPlayerInfo(idx);
        return addr;
    }

    function _readyUpAll() internal {
        vm.prank(alice);
        game.readyUp();
        vm.prank(bob);
        game.readyUp();
    }

    function _readyUpAll3() internal {
        vm.prank(alice);
        game.readyUp();
        vm.prank(carol);
        game.readyUp();
        vm.prank(bob);
        game.readyUp();
    }

    function _actAsCurrentTurn(string memory action) internal {
        address player = _currentTurnPlayer();
        if (keccak256(bytes(action)) == keccak256(bytes("fold"))) {
            vm.prank(player);
            game.fold();
        } else if (keccak256(bytes(action)) == keccak256(bytes("call"))) {
            vm.prank(player);
            // forge-lint: disable-next-line(unchecked-call) test helper — reverts propagate naturally
            game.call();
        } else if (keccak256(bytes(action)) == keccak256(bytes("check"))) {
            vm.prank(player);
            game.check();
        }
    }

    function testFullTwoPlayerHand() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));

        _readyUpAll();
        assertEq(uint8(game.phase()), 1);

        vm.prank(alice);
        // forge-lint: disable-next-line(unchecked-call) test — reverts propagate
        game.call();
        vm.prank(bob);
        game.check();

        biteMock.sendCallback();
        assertEq(uint8(game.phase()), 2);

        _actAsCurrentTurn("check");
        _actAsCurrentTurn("check");

        biteMock.sendCallback();
        assertEq(uint8(game.phase()), 3);

        _actAsCurrentTurn("check");
        _actAsCurrentTurn("check");

        biteMock.sendCallback();
        assertEq(uint8(game.phase()), 4);

        _actAsCurrentTurn("check");
        _actAsCurrentTurn("check");

        biteMock.sendCallback();

        assertEq(uint8(game.phase()), 0);
        assertEq(game.pot(), 0);
    }

    function testFoldGivesPot() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));

        _readyUpAll();

        vm.prank(alice);
        game.fold();

        biteMock.sendCallback();

        assertEq(uint8(game.phase()), 0);
        assertEq(game.pot(), 0);
        assertEq(game.playerCount(), 2);

        bool foundBob;
        for (uint256 i = 0; i < game.playerCount(); i++) {
            (address addr,,,,, uint256 s) = game.getPlayerInfo(i);
            if (addr == bob) {
                assertEq(s, BUY_IN - BB + SB + BB);
                foundBob = true;
                break;
            }
        }
        assertTrue(foundBob);
    }

    function testThreePlayerHand() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));
        vm.prank(carol);
        game.sitDown(_viewerKey(3));

        _readyUpAll3();
        assertEq(uint8(game.phase()), 1);
        assertEq(game.playerCount(), 3);

        for (uint256 i = 0; i < 3; i++) {
            address tp = _currentTurnPlayer();
            if (i < 2) {
                vm.prank(tp);
                // forge-lint: disable-next-line(unchecked-call) test — reverts propagate
                game.call();
            } else {
                vm.prank(tp);
                game.check();
            }
        }

        biteMock.sendCallback();
        assertEq(uint8(game.phase()), 2);

        for (uint256 i = 0; i < 3; i++) {
            address tp = _currentTurnPlayer();
            vm.prank(tp);
            game.check();
        }

        biteMock.sendCallback();
        assertEq(uint8(game.phase()), 3);

        for (uint256 i = 0; i < 3; i++) {
            address tp = _currentTurnPlayer();
            vm.prank(tp);
            game.check();
        }

        biteMock.sendCallback();
        assertEq(uint8(game.phase()), 4);

        for (uint256 i = 0; i < 3; i++) {
            address tp = _currentTurnPlayer();
            vm.prank(tp);
            game.check();
        }

        biteMock.sendCallback();

        assertEq(uint8(game.phase()), 0);
        assertEq(game.pot(), 0);
    }

    function testLeaveRequestProcessedAtHandEnd() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));
        vm.prank(carol);
        game.sitDown(_viewerKey(3));

        _readyUpAll();

        vm.prank(carol);
        game.requestLeave();
        assertTrue(game.isLeaveRequested(carol));

        address tp1 = _currentTurnPlayer();
        vm.prank(tp1);
        game.fold();

        address tp2 = _currentTurnPlayer();
        vm.prank(tp2);
        game.fold();

        biteMock.sendCallback();

        assertEq(game.playerCount(), 2);
        assertFalse(game.isLeaveRequested(carol));
    }

    function testRaiseTriggersReAct() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));

        _readyUpAll();

        vm.prank(alice);
        game.raise(2e18);

        vm.prank(bob);
        // forge-lint: disable-next-line(unchecked-call) test — reverts propagate
        game.call();

        biteMock.sendCallback();
        assertEq(uint8(game.phase()), 2);

        _actAsCurrentTurn("check");
        _actAsCurrentTurn("check");

        biteMock.sendCallback();
        _actAsCurrentTurn("check");
        _actAsCurrentTurn("check");

        biteMock.sendCallback();
        _actAsCurrentTurn("check");
        _actAsCurrentTurn("check");

        biteMock.sendCallback();

        assertEq(uint8(game.phase()), 0);
        assertEq(game.pot(), 0);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // READY-UP TESTS
    // ═══════════════════════════════════════════════════════════════════════

    function testReadyUpFailsIfNotPlayer() external {
        vm.expectRevert(PokerGame.NotAPlayer.selector);
        game.readyUp();
    }

    function testSitDownDoesNotAutoReady() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        assertFalse(game.isReady(alice));
        assertEq(game.readyCount(), 0);
    }

    function testPlayerReadyMarksReady() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));

        vm.prank(alice);
        game.readyUp();
        assertTrue(game.isReady(alice));
        assertEq(game.readyCount(), 1);
    }

    function testHandDoesNotStartWithoutEnoughReady() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(alice);
        game.readyUp();
        assertEq(uint8(game.phase()), 0);
    }

    function testTwoPlayersReadyAutoStartsHand() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));

        vm.prank(alice);
        game.readyUp();
        assertEq(uint8(game.phase()), 0);
        assertEq(game.readyCount(), 1);

        vm.prank(bob);
        game.readyUp();
        assertEq(uint8(game.phase()), 1);
        assertEq(game.readyCount(), 0);
    }

    function testUnreadyPlayerNotInGame() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));

        vm.prank(alice);
        game.readyUp();
        assertTrue(game.isReady(alice));

        vm.prank(alice);
        game.unready();
        assertFalse(game.isReady(alice));
        assertEq(game.readyCount(), 0);
    }

    function testUnreadyPlayerCannotStartHand() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));

        vm.prank(alice);
        game.readyUp();
        assertEq(game.readyCount(), 1);

        vm.prank(alice);
        game.unready();
        assertEq(game.readyCount(), 0);

        vm.prank(bob);
        game.readyUp();
        assertEq(uint8(game.phase()), 0);
        assertEq(game.readyCount(), 1);
    }

    function testUnreadyPlayerSitsOutHand() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));
        vm.prank(carol);
        game.sitDown(_viewerKey(3));

        _readyUpAll3();

        assertEq(game.playerCount(), 3);
        assertEq(uint8(game.phase()), 1);

        uint256 active = game.activePlayerCount();
        assertEq(active, 3);
    }

    function testUnreadyPlayerCanReadyForNextHand() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));

        _readyUpAll();

        vm.prank(alice);
        game.fold();
        biteMock.sendCallback();

        assertEq(uint8(game.phase()), 0);

        vm.prank(alice);
        game.readyUp();
        assertTrue(game.isReady(alice));

        vm.prank(bob);
        game.readyUp();
        assertEq(uint8(game.phase()), 1);
    }

    function testLeaveRequestBlocksReadyUp() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));

        vm.prank(alice);
        game.requestLeave();

        vm.prank(alice);
        vm.expectRevert("Leave requested");
        game.readyUp();
    }

    function testReadyPlayerRequestsLeaveAutoUnreadies() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));

        vm.prank(alice);
        game.readyUp();
        assertTrue(game.isReady(alice));
        assertEq(game.readyCount(), 1);

        vm.prank(alice);
        game.requestLeave();
        assertFalse(game.isReady(alice));
        assertEq(game.readyCount(), 0);
    }

    function testReadyPlayerLeaveTableCleansUp() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));

        vm.prank(alice);
        game.readyUp();
        assertEq(game.readyCount(), 1);

        vm.prank(alice);
        game.leaveTable();
        assertEq(game.readyCount(), 0);
        assertEq(game.playerCount(), 0);
    }

    function testReadyPlayerForfeitLeavesCleansUp() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));

        vm.prank(alice);
        game.readyUp();
        assertEq(game.readyCount(), 1);

        vm.prank(bob);
        game.readyUp();
        assertEq(game.readyCount(), 0);

        vm.prank(alice);
        game.forfeitAndLeave();
        assertEq(game.playerCount(), 1);
    }

    function testDealNewHandResetsReadyState() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));

        _readyUpAll();

        assertEq(uint8(game.phase()), 1);
        assertEq(game.readyCount(), 0);
        assertFalse(game.isReady(alice));
        assertFalse(game.isReady(bob));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RICH EVENT TESTS
    // ═══════════════════════════════════════════════════════════════════════

    function testTurnChangedEventOnAdvance() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));
        _readyUpAll();

        assertEq(game.getCurrentTurnIndex(), 0);

        vm.prank(alice);
        // forge-lint: disable-next-line(unchecked-call) — game may revert naturally in test
        game.call();

        assertEq(game.getCurrentTurnIndex(), 1);
    }

    function testPhaseChangedIncludesHandNumber() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));

        vm.prank(alice);
        game.readyUp();

        vm.expectEmit(false, false, false, true);
        emit PhaseChanged(PokerGame.GamePhase.Preflop, 1);
        vm.prank(bob);
        game.readyUp();
    }

    function testHandResultEventOnFold() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));
        _readyUpAll();

        vm.prank(alice);
        game.fold();

        vm.expectEmit(false, false, false, true);
        address[] memory winners = new address[](1);
        winners[0] = bob;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = SB + BB;
        string[] memory handNames = new string[](1);
        handNames[0] = "Last player standing";
        emit HandResult(winners, amounts, handNames);
        biteMock.sendCallback();
    }

    function testHandResultEventOnShowdown() external {
        vm.prank(alice);
        game.sitDown(_viewerKey(1));
        vm.prank(bob);
        game.sitDown(_viewerKey(2));
        _readyUpAll();

        vm.prank(alice);
        // forge-lint: disable-next-line(unchecked-call) — game may revert naturally in test
        game.call();
        vm.prank(bob);
        game.check();

        biteMock.sendCallback();

        assertEq(uint8(game.phase()), 0);
        assertEq(game.pot(), 0);
    }
}
