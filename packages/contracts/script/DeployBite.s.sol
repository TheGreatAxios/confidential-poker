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
        PokerGame game = new PokerGame(tokenAddress);
        console.log("PokerGame (BITE):", address(game));

        vm.stopBroadcast();
    }
}
