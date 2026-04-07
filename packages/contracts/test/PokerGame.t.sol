// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import "forge-std/Test.sol";
import "../src/MockSKL.sol";
import "../src/PokerGame.sol";
import {PublicKey} from "@skalenetwork/bite-solidity/BITE.sol";

contract PokerGameHarness is PokerGame {
    constructor(address _sklToken, uint256 _ctxCallbackValueWei) payable PokerGame(_sklToken, _ctxCallbackValueWei) {}

    function buildDeckForTest(uint256 cursor) external returns (uint8[52] memory) {
        rngCursor = cursor;
        return _buildShuffledDeck();
    }
}

contract PokerGameTest is Test {
    uint256 internal constant CALLBACK_VALUE = 1 ether;
    uint256 internal constant BUY_IN = 1000 * 10 ** 18;
    uint256 internal constant MIN_CTX_RESERVE = CALLBACK_VALUE * 10;
    MockSKL internal token;
    PokerGame internal game;
    PokerGameHarness internal harness;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() external {
        token = new MockSKL();
        game = new PokerGame{value: MIN_CTX_RESERVE * 2}(address(token), CALLBACK_VALUE);
        harness = new PokerGameHarness{value: MIN_CTX_RESERVE * 2}(address(token), CALLBACK_VALUE);

        token.mint(alice, BUY_IN);
        token.mint(bob, BUY_IN);

        vm.prank(alice);
        token.approve(address(game), BUY_IN);

        vm.prank(bob);
        token.approve(address(game), BUY_IN);
    }

    function testConstructorRequiresMinimumReserve() external {
        vm.expectRevert(PokerGame.InsufficientCtxReserve.selector);
        new PokerGame{value: MIN_CTX_RESERVE - 1}(address(token), CALLBACK_VALUE);
    }

    function testSecondSeatCannotStartGameWithoutCtxReserve() external {
        vm.deal(address(game), CALLBACK_VALUE);

        vm.prank(alice);
        game.sitDown(_viewerKey(1));

        vm.expectRevert(PokerGame.InsufficientCtxReserve.selector);
        vm.prank(bob);
        game.sitDown(_viewerKey(2));
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

    function _viewerKey(uint256 seed) internal pure returns (PublicKey memory) {
        return PublicKey({x: bytes32(seed), y: bytes32(seed + 1)});
    }
}
