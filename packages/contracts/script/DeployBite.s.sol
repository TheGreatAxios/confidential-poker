// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import "forge-std/Script.sol";
import "../src/PokerGame.sol";
import "../src/MockSKL.sol";

contract DeployBite is Script {
    function run() external {
        address tokenAddress = vm.envOr(
            "TOKEN_ADDRESS",
            address(0x4C1928684B7028C2805FA1d12aCEd5c839A8D42C)
        );
        uint256 ctxCallbackValueWei = vm.envOr("CTX_CALLBACK_VALUE_WEI", uint256(1e15));
        uint256 initialCtxReserveWei = vm.envOr(
            "INITIAL_CTX_RESERVE_WEI",
            ctxCallbackValueWei * 10
        );
        
        vm.startBroadcast();

        if (tokenAddress == address(0)) {
            // Deploy MockSKL token (for base-sepolia which has no native USDC)
            MockSKL skl = new MockSKL();
            console.log("MockSKL:", address(skl));
            tokenAddress = address(skl);
        } else {
            console.log("Using existing token:", tokenAddress);
        }

        // Deploy PokerGame (BITE-encrypted version)
        PokerGame game = new PokerGame{value: initialCtxReserveWei}(tokenAddress, ctxCallbackValueWei);
        console.log("PokerGame (BITE):", address(game));
        console.log("CTX callback value:", ctxCallbackValueWei);
        console.log("Initial CTX reserve:", initialCtxReserveWei);

        vm.stopBroadcast();
    }
}
