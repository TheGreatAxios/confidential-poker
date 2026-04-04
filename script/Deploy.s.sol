// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { Script, console } from "forge-std/Script.sol";
import { MockSKL } from "../contracts/src/MockSKL.sol";
import { AxiosUSD } from "../contracts/src/AxiosUSD.sol";
import { PokerGame } from "../contracts/src/PokerGame.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);

        // Deploy tokens
        MockSKL mskl = new MockSKL();
        console.log("MockSKL:", address(mskl));

        AxiosUSD axusd = new AxiosUSD();
        console.log("AxiosUSD:", address(axusd));

        // Deploy poker game
        PokerGame poker = new PokerGame(address(axusd));
        console.log("PokerGame:", address(poker));

        vm.stopBroadcast();

        // Output addresses as JSON for frontend
        string memory json = string.concat(
            '{',
            '"mockSKL": "', vm.toString(address(mskl)), '",',
            '"axiosUSD": "', vm.toString(address(axusd)), '",',
            '"pokerGame": "', vm.toString(address(poker)), '"',
            '}'
        );
        vm.writeFile("deployments.json", json);
        console.log("\nDeployment JSON written to deployments.json");
    }
}
