// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import "forge-std/Script.sol";
import "../src/PokerGameTestnet.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        PokerGameTestnet game = new PokerGameTestnet();
        console.log("PokerGameTestnet:", address(game));

        vm.stopBroadcast();
    }
}
