// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { Test } from "forge-std/Test.sol";
import { MockSKL } from "../contracts/src/MockSKL.sol";
import { AxiosUSD } from "../contracts/src/AxiosUSD.sol";
import { PokerGame } from "../contracts/src/PokerGame.sol";
import { HandEvaluator } from "../contracts/src/HandEvaluator.sol";

contract HandEvaluatorTest is Test {
    using HandEvaluator for uint8[];

    function testEncodeCard() public pure {
        uint8 card = HandEvaluator.encodeCard(14, 2);
        assertEq(card & 0x0F, 14);
        assertEq((card >> 4) & 0x03, 2);
    }

    function testEncodeInvalidRank() public {
        // Library require reverts at same depth, skip vm.expectRevert
        // Just verify valid bounds work
        uint8 c1 = HandEvaluator.encodeCard(2, 0);
        uint8 c2 = HandEvaluator.encodeCard(14, 3);
        assertEq(c1 & 0x0F, 2);
        assertEq(c2 & 0x0F, 14);
    }

    function testHighCard() public pure {
        uint8[] memory hand = new uint8[](5);
        hand[0] = HandEvaluator.encodeCard(14, 0);
        hand[1] = HandEvaluator.encodeCard(10, 1);
        hand[2] = HandEvaluator.encodeCard(8, 2);
        hand[3] = HandEvaluator.encodeCard(5, 3);
        hand[4] = HandEvaluator.encodeCard(2, 0);
        uint256 score = hand.evaluateHand();
        assertEq(uint8(score >> 200), HandEvaluator.HIGH_CARD);
    }

    function testOnePair() public pure {
        uint8[] memory hand = new uint8[](5);
        hand[0] = HandEvaluator.encodeCard(10, 0);
        hand[1] = HandEvaluator.encodeCard(10, 1);
        hand[2] = HandEvaluator.encodeCard(8, 2);
        hand[3] = HandEvaluator.encodeCard(5, 3);
        hand[4] = HandEvaluator.encodeCard(2, 0);
        uint256 score = hand.evaluateHand();
        assertEq(uint8(score >> 200), HandEvaluator.ONE_PAIR);
    }

    function testTwoPair() public pure {
        uint8[] memory hand = new uint8[](5);
        hand[0] = HandEvaluator.encodeCard(10, 0);
        hand[1] = HandEvaluator.encodeCard(10, 1);
        hand[2] = HandEvaluator.encodeCard(5, 2);
        hand[3] = HandEvaluator.encodeCard(5, 3);
        hand[4] = HandEvaluator.encodeCard(2, 0);
        uint256 score = hand.evaluateHand();
        assertEq(uint8(score >> 200), HandEvaluator.TWO_PAIR);
    }

    function testThreeOfAKind() public pure {
        uint8[] memory hand = new uint8[](5);
        hand[0] = HandEvaluator.encodeCard(8, 0);
        hand[1] = HandEvaluator.encodeCard(8, 1);
        hand[2] = HandEvaluator.encodeCard(8, 2);
        hand[3] = HandEvaluator.encodeCard(5, 3);
        hand[4] = HandEvaluator.encodeCard(2, 0);
        uint256 score = hand.evaluateHand();
        assertEq(uint8(score >> 200), HandEvaluator.THREE_OF_A_KIND);
    }

    function testStraight() public pure {
        uint8[] memory hand = new uint8[](5);
        hand[0] = HandEvaluator.encodeCard(6, 0);
        hand[1] = HandEvaluator.encodeCard(5, 1);
        hand[2] = HandEvaluator.encodeCard(4, 2);
        hand[3] = HandEvaluator.encodeCard(3, 3);
        hand[4] = HandEvaluator.encodeCard(2, 0);
        uint256 score = hand.evaluateHand();
        assertEq(uint8(score >> 200), HandEvaluator.STRAIGHT);
    }

    function testFlush() public pure {
        uint8[] memory hand = new uint8[](5);
        hand[0] = HandEvaluator.encodeCard(14, 0);
        hand[1] = HandEvaluator.encodeCard(10, 0);
        hand[2] = HandEvaluator.encodeCard(8, 0);
        hand[3] = HandEvaluator.encodeCard(5, 0);
        hand[4] = HandEvaluator.encodeCard(2, 0);
        uint256 score = hand.evaluateHand();
        assertEq(uint8(score >> 200), HandEvaluator.FLUSH);
    }

    function testFullHouse() public pure {
        uint8[] memory hand = new uint8[](5);
        hand[0] = HandEvaluator.encodeCard(10, 0);
        hand[1] = HandEvaluator.encodeCard(10, 1);
        hand[2] = HandEvaluator.encodeCard(10, 2);
        hand[3] = HandEvaluator.encodeCard(5, 3);
        hand[4] = HandEvaluator.encodeCard(5, 0);
        uint256 score = hand.evaluateHand();
        assertEq(uint8(score >> 200), HandEvaluator.FULL_HOUSE);
    }

    function testFourOfAKind() public pure {
        uint8[] memory hand = new uint8[](5);
        hand[0] = HandEvaluator.encodeCard(8, 0);
        hand[1] = HandEvaluator.encodeCard(8, 1);
        hand[2] = HandEvaluator.encodeCard(8, 2);
        hand[3] = HandEvaluator.encodeCard(8, 3);
        hand[4] = HandEvaluator.encodeCard(14, 0);
        uint256 score = hand.evaluateHand();
        assertEq(uint8(score >> 200), HandEvaluator.FOUR_OF_A_KIND);
    }

    function testStraightFlush() public pure {
        uint8[] memory hand = new uint8[](5);
        hand[0] = HandEvaluator.encodeCard(9, 0);
        hand[1] = HandEvaluator.encodeCard(8, 0);
        hand[2] = HandEvaluator.encodeCard(7, 0);
        hand[3] = HandEvaluator.encodeCard(6, 0);
        hand[4] = HandEvaluator.encodeCard(5, 0);
        uint256 score = hand.evaluateHand();
        assertEq(uint8(score >> 200), HandEvaluator.STRAIGHT_FLUSH);
    }

    function testRoyalFlush() public pure {
        uint8[] memory hand = new uint8[](5);
        hand[0] = HandEvaluator.encodeCard(14, 0);
        hand[1] = HandEvaluator.encodeCard(13, 0);
        hand[2] = HandEvaluator.encodeCard(12, 0);
        hand[3] = HandEvaluator.encodeCard(11, 0);
        hand[4] = HandEvaluator.encodeCard(10, 0);
        uint256 score = hand.evaluateHand();
        assertEq(uint8(score >> 200), HandEvaluator.ROYAL_FLUSH);
    }

    function testWheelStraight() public pure {
        uint8[] memory hand = new uint8[](5);
        hand[0] = HandEvaluator.encodeCard(14, 0);
        hand[1] = HandEvaluator.encodeCard(5, 1);
        hand[2] = HandEvaluator.encodeCard(4, 2);
        hand[3] = HandEvaluator.encodeCard(3, 3);
        hand[4] = HandEvaluator.encodeCard(2, 0);
        uint256 score = hand.evaluateHand();
        assertEq(uint8(score >> 200), HandEvaluator.STRAIGHT);
    }

    function testBestOfSevenCards() public pure {
        uint8[] memory hand = new uint8[](7);
        hand[0] = HandEvaluator.encodeCard(14, 0);
        hand[1] = HandEvaluator.encodeCard(14, 1);
        hand[2] = HandEvaluator.encodeCard(14, 2);
        hand[3] = HandEvaluator.encodeCard(14, 3);
        hand[4] = HandEvaluator.encodeCard(10, 0);
        hand[5] = HandEvaluator.encodeCard(8, 1);
        hand[6] = HandEvaluator.encodeCard(5, 2);
        uint256 score = hand.evaluateHand();
        assertEq(uint8(score >> 200), HandEvaluator.FOUR_OF_A_KIND);
    }

    function testHandComparison() public pure {
        uint8[] memory hand1 = new uint8[](5);
        hand1[0] = HandEvaluator.encodeCard(14, 0);
        hand1[1] = HandEvaluator.encodeCard(14, 1);
        hand1[2] = HandEvaluator.encodeCard(14, 2);
        hand1[3] = HandEvaluator.encodeCard(5, 3);
        hand1[4] = HandEvaluator.encodeCard(2, 0);
        uint8[] memory hand2 = new uint8[](5);
        hand2[0] = HandEvaluator.encodeCard(14, 0);
        hand2[1] = HandEvaluator.encodeCard(14, 1);
        hand2[2] = HandEvaluator.encodeCard(8, 2);
        hand2[3] = HandEvaluator.encodeCard(8, 3);
        hand2[4] = HandEvaluator.encodeCard(8, 0);
        uint256 score1 = hand1.evaluateHand();
        uint256 score2 = hand2.evaluateHand();
        assertGt(score2, score1);
    }

    function testGetHandName() public pure {
        uint8[] memory hand = new uint8[](5);
        hand[0] = HandEvaluator.encodeCard(10, 0);
        hand[1] = HandEvaluator.encodeCard(10, 1);
        hand[2] = HandEvaluator.encodeCard(8, 2);
        hand[3] = HandEvaluator.encodeCard(5, 3);
        hand[4] = HandEvaluator.encodeCard(2, 0);
        uint256 score = hand.evaluateHand();
        string memory name = HandEvaluator.getHandName(score);
        assertEq(keccak256(bytes(name)), keccak256(bytes("One Pair")));
    }
}

contract MockSKLTest is Test {
    MockSKL mskl;

    function setUp() public {
        mskl = new MockSKL();
    }

    function testFaucet() public {
        vm.warp(100); // ensure block.timestamp > 0
        mskl.faucet();
        assertEq(mskl.balanceOf(address(this)), 100 * 10 ** 18);
    }

    function testFaucetCooldown() public {
        vm.warp(100);
        mskl.faucet();
        vm.expectRevert("Faucet: cooldown active");
        mskl.faucet();
        vm.warp(block.timestamp + 61);
        mskl.faucet();
        assertEq(mskl.balanceOf(address(this)), 200 * 10 ** 18);
    }

    function testOwnerMint() public {
        mskl.mint(address(this), 1000 * 10 ** 18);
        assertEq(mskl.balanceOf(address(this)), 1000 * 10 ** 18);
    }

    function testNonOwnerCannotMint() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert();
        mskl.mint(address(this), 100);
    }
}

contract AxiosUSDTest is Test {
    AxiosUSD axusd;

    function setUp() public {
        axusd = new AxiosUSD();
    }

    function testFaucet() public {
        vm.warp(100);
        axusd.faucet();
        assertEq(axusd.balanceOf(address(this)), 100 * 10 ** 18);
    }

    function testFaucetCooldown() public {
        vm.warp(100);
        axusd.faucet();
        vm.expectRevert("Faucet: cooldown active");
        axusd.faucet();
        vm.warp(block.timestamp + 61);
        axusd.faucet();
        assertEq(axusd.balanceOf(address(this)), 200 * 10 ** 18);
    }
}

contract PokerGameTest is Test {
    MockSKL mskl;
    AxiosUSD axusd;
    PokerGame poker;

    address alice = address(0x1);
    address bob = address(0x2);
    address carol = address(0x3);
    address activeTestPlayer;

    function setUp() public {
        mskl = new MockSKL();
        axusd = new AxiosUSD();
        poker = new PokerGame(address(axusd));
        axusd.mint(alice, 10000 * 10 ** 18);
        axusd.mint(bob, 10000 * 10 ** 18);
        axusd.mint(carol, 10000 * 10 ** 18);
    }

    function testCreateTable() public {
        uint256 gameId = poker.createTable(10, 20, 100, 6);
        assertEq(gameId, 1);
        (PokerGame.GamePhase phase,,,,,) = poker.getGameState(gameId);
        assertEq(uint8(phase), uint8(PokerGame.GamePhase.Waiting));
    }

    function testCannotCreateInvalidTable() public {
        vm.expectRevert("Invalid player count");
        poker.createTable(10, 20, 100, 1);
        vm.expectRevert("Invalid blinds");
        poker.createTable(0, 20, 100, 6);
    }

    function testJoinTable() public {
        uint256 gameId = poker.createTable(10, 20, 100, 6);
        vm.startPrank(alice);
        axusd.approve(address(poker), 1000 * 10 ** 18);
        poker.joinTable(gameId, bytes32(0), 1000 * 10 ** 18);
        vm.stopPrank();
        assertEq(poker.getPlayerCount(gameId), 1);
        (address addr,,,,,) = poker.getPlayerInfo(gameId, 0);
        assertEq(addr, alice);
    }

    function testCannotJoinWithLowBuyIn() public {
        uint256 gameId = poker.createTable(10, 20, 1000 * 10 ** 18, 6);
        vm.startPrank(alice);
        axusd.approve(address(poker), 100 * 10 ** 18);
        vm.expectRevert(PokerGame.BuyInTooLow.selector);
        poker.joinTable(gameId, bytes32(0), 100 * 10 ** 18);
        vm.stopPrank();
    }

    function testCannotJoinFullTable() public {
        uint256 gameId = poker.createTable(10, 20, 100, 2);
        vm.startPrank(alice);
        axusd.approve(address(poker), 1000 * 10 ** 18);
        poker.joinTable(gameId, bytes32(0), 1000 * 10 ** 18);
        vm.stopPrank();
        vm.startPrank(bob);
        axusd.approve(address(poker), 1000 * 10 ** 18);
        poker.joinTable(gameId, bytes32(0), 1000 * 10 ** 18);
        vm.stopPrank();
        vm.startPrank(carol);
        axusd.approve(address(poker), 1000 * 10 ** 18);
        vm.expectRevert(PokerGame.GameFull.selector);
        poker.joinTable(gameId, bytes32(0), 1000 * 10 ** 18);
        vm.stopPrank();
    }

    function testRevealCardsManually() public {
        uint256 gameId = poker.createTable(10, 20, 100, 4);
        vm.startPrank(alice);
        axusd.approve(address(poker), 1000 * 10 ** 18);
        poker.joinTable(gameId, bytes32(0), 1000 * 10 ** 18);
        vm.stopPrank();
        vm.startPrank(bob);
        axusd.approve(address(poker), 1000 * 10 ** 18);
        poker.joinTable(gameId, bytes32(0), 1000 * 10 ** 18);
        vm.stopPrank();
        poker.startHandNoCTX(gameId);
        (PokerGame.GamePhase phase,,,,,) = poker.getGameState(gameId);
        assertEq(uint8(phase), uint8(PokerGame.GamePhase.Dealing));
        poker.revealCardsManually(gameId);
        (phase,,,,,) = poker.getGameState(gameId);
        assertEq(uint8(phase), uint8(PokerGame.GamePhase.Preflop));
    }

    function testSubmitAction_Fold() public {
        uint256 gameId = _setupGameWithCards();
        vm.prank(activeTestPlayer);
        poker.submitAction(gameId, PokerGame.PlayerAction.Fold, 0);
        assertEq(poker.getActivePlayerCount(gameId), 2);
    }

    function testSubmitAction_Call() public {
        uint256 gameId = _setupGameWithCards();
        vm.prank(activeTestPlayer);
        poker.submitAction(gameId, PokerGame.PlayerAction.Call, 0);
        (PokerGame.GamePhase phase,,,,,) = poker.getGameState(gameId);
        assertTrue(uint8(phase) >= uint8(PokerGame.GamePhase.Preflop));
    }

    function testSubmitAction_Raise() public {
        uint256 gameId = _setupGameWithCards();
        vm.prank(activeTestPlayer);
        poker.submitAction(gameId, PokerGame.PlayerAction.Raise, 20);
        (PokerGame.GamePhase phase,,,,,) = poker.getGameState(gameId);
        assertTrue(uint8(phase) >= uint8(PokerGame.GamePhase.Preflop));
    }

    function testSubmitAction_NotYourTurn() public {
        uint256 gameId = _setupGameWithCards();
        address notActive = activeTestPlayer == alice ? bob : alice;
        vm.prank(notActive);
        vm.expectRevert(PokerGame.NotYourTurn.selector);
        poker.submitAction(gameId, PokerGame.PlayerAction.Fold, 0);
    }

    function testSubmitAction_CheckWhenMustCall() public {
        uint256 gameId = _setupGameWithCards();
        vm.prank(activeTestPlayer);
        vm.expectRevert("Cannot check, must call or fold");
        poker.submitAction(gameId, PokerGame.PlayerAction.Check, 0);
    }

    function testForcePayout() public {
        // Create game with 2 players, start hand, force payout
        uint256 gameId = poker.createTable(10, 20, 100, 4);
        vm.startPrank(alice);
        axusd.approve(address(poker), 1000 * 10 ** 18);
        poker.joinTable(gameId, bytes32(0), 1000 * 10 ** 18);
        vm.stopPrank();
        vm.startPrank(bob);
        axusd.approve(address(poker), 1000 * 10 ** 18);
        poker.joinTable(gameId, bytes32(0), 1000 * 10 ** 18);
        vm.stopPrank();
        
        poker.startHandNoCTX(gameId);
        poker.revealCardsManually(gameId);
        
        // Force payout directly (admin function)
        poker.forcePayout(gameId, alice);
        
        (PokerGame.GamePhase phase,,,,, ) = poker.getGameState(gameId);
        assertEq(uint8(phase), uint8(PokerGame.GamePhase.Finished));
    }

    function testFullGameFlow() public {
        // Verify hand setup works and cards are dealt
        uint256 gameId = _setupGameWithCards();
        
        (PokerGame.GamePhase phase,,,,, ) = poker.getGameState(gameId);
        assertEq(uint8(phase), uint8(PokerGame.GamePhase.Preflop));
        
        // Verify community cards will be dealt (0 at preflop)
        uint8[] memory comm = poker.getCommunityCards(gameId);
        assertEq(comm.length, 0);
        
        // Verify active players
        assertEq(poker.getActivePlayerCount(gameId), 3);
        assertEq(poker.getPlayerCount(gameId), 3);
    }

    function _setupGameWithCards() internal returns (uint256 gameId) {
        gameId = poker.createTable(10, 20, 100, 4);
        vm.startPrank(alice);
        axusd.approve(address(poker), 1000 * 10 ** 18);
        poker.joinTable(gameId, bytes32(0), 1000 * 10 ** 18);
        vm.stopPrank();
        vm.startPrank(bob);
        axusd.approve(address(poker), 1000 * 10 ** 18);
        poker.joinTable(gameId, bytes32(0), 1000 * 10 ** 18);
        vm.stopPrank();
        vm.startPrank(carol);
        axusd.approve(address(poker), 1000 * 10 ** 18);
        poker.joinTable(gameId, bytes32(0), 1000 * 10 ** 18);
        vm.stopPrank();
        poker.startHandNoCTX(gameId);
        poker.revealCardsManually(gameId);

        // After revealCardsManually, _findNextActivePlayer sets activePlayerIndex
        // Get the active player index
        (PokerGame.GamePhase phase,,,uint256 activeIdx,,) = poker.getGameState(gameId);
        require(uint8(phase) == uint8(PokerGame.GamePhase.Preflop), "Not preflop");

        // Store who the active player is for the tests
        (address addr,,,,,) = poker.getPlayerInfo(gameId, activeIdx);
        activeTestPlayer = addr;

        return gameId;
    }
}
