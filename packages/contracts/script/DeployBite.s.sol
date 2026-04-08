// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import "forge-std/Script.sol";
import "../src/PokerGame.sol";
import "../src/MockSKL.sol";

contract DeployBite is Script {
    uint256 internal constant DEFAULT_INITIAL_CTX_RESERVE_MULTIPLIER = 100;
    uint256 internal constant DEFAULT_CTX_CALLBACK_NATIVE_VALUE = 1 ether;

    function run() external {
        address tokenAddress = vm.envOr("TOKEN_ADDRESS", address(0x4C1928684B7028C2805FA1d12aCEd5c839A8D42C));
        uint256 ctxCallbackValue = vm.envOr("CTX_CALLBACK_VALUE", DEFAULT_CTX_CALLBACK_NATIVE_VALUE);
        uint256 initialCtxReserve =
            vm.envOr("INITIAL_CTX_RESERVE", ctxCallbackValue * DEFAULT_INITIAL_CTX_RESERVE_MULTIPLIER);

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
        PokerGame game = new PokerGame{value: initialCtxReserve}(tokenAddress, ctxCallbackValue);
        console.log("PokerGame (BITE):", address(game));
        console.log("CTX callback native value:", ctxCallbackValue);
        console.log("Initial native reserve:", initialCtxReserve);

        vm.stopBroadcast();
    }
}
