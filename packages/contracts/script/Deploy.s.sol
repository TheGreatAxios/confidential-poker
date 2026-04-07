// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import "forge-std/Script.sol";
import "../src/MockSKL.sol";
import "../src/PokerGame.sol";

contract Deploy is Script {
    uint256 internal constant DEFAULT_INITIAL_CTX_RESERVE_MULTIPLIER = 100;
    uint256 internal constant DEFAULT_CTX_CALLBACK_NATIVE_VALUE = 1 ether;

    function run() external {
        uint256 ctxCallbackValue = vm.envOr("CTX_CALLBACK_VALUE", DEFAULT_CTX_CALLBACK_NATIVE_VALUE);
        uint256 initialCtxReserve =
            vm.envOr("INITIAL_CTX_RESERVE", ctxCallbackValue * DEFAULT_INITIAL_CTX_RESERVE_MULTIPLIER);

        vm.startBroadcast();

        MockSKL token = new MockSKL();
        PokerGame game = new PokerGame{value: initialCtxReserve}(address(token), ctxCallbackValue);
        console.log("MockSKL:", address(token));
        console.log("PokerGame:", address(game));
        console.log("CTX callback native value:", ctxCallbackValue);
        console.log("Initial native reserve:", initialCtxReserve);

        vm.stopBroadcast();
    }
}
