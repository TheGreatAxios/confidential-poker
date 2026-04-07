// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import "forge-std/Script.sol";
import "../src/MockSKL.sol";
import "../src/PokerGame.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        MockSKL token = new MockSKL();
        PokerGame game = new PokerGame(address(token));
        console.log("MockSKL:", address(token));
        console.log("PokerGame:", address(game));

        vm.stopBroadcast();
    }
}
