// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import "forge-std/Script.sol";
import "../src/MockSKL.sol";
import "../src/PokerGame.sol";

contract Deploy is Script {
    function run() external {
        uint256 ctxCallbackValueWei = vm.envOr("CTX_CALLBACK_VALUE_WEI", uint256(1e15));
        uint256 initialCtxReserveWei = vm.envOr(
            "INITIAL_CTX_RESERVE_WEI",
            ctxCallbackValueWei * 10
        );

        vm.startBroadcast();

        MockSKL token = new MockSKL();
        PokerGame game = new PokerGame{value: initialCtxReserveWei}(address(token), ctxCallbackValueWei);
        console.log("MockSKL:", address(token));
        console.log("PokerGame:", address(game));
        console.log("CTX callback value:", ctxCallbackValueWei);
        console.log("Initial CTX reserve:", initialCtxReserveWei);

        vm.stopBroadcast();
    }
}
