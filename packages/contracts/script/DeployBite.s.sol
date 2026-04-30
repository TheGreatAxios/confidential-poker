// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {MockSKL} from "../src/MockSKL.sol";
import {ChipToken} from "../src/ChipToken.sol";
import {PokerFactory} from "../src/PokerFactory.sol";

contract DeployBite is Script {
    uint256 constant DEFAULT_CTX_CALLBACK_VALUE = 1 ether;
    uint256 constant DEFAULT_INITIAL_RESERVE = 100 ether;

    function run() external {
        address tokenAddress = vm.envOr("TOKEN_ADDRESS", address(0));
        uint256 ctxCallbackValue = vm.envOr("CTX_CALLBACK_VALUE", DEFAULT_CTX_CALLBACK_VALUE);
        uint256 initialReserve = vm.envOr("INITIAL_CTX_RESERVE", DEFAULT_INITIAL_RESERVE);

        uint256 buyIn = vm.envOr("BUY_IN", uint256(1000e18));
        uint256 sb = vm.envOr("SMALL_BLIND", uint256(5e17));
        uint256 bb = vm.envOr("BIG_BLIND", uint256(1e18));
        uint256 maxPlayers = vm.envOr("MAX_PLAYERS", uint256(6));

        vm.startBroadcast();

        if (tokenAddress == address(0)) {
            MockSKL skl = new MockSKL();
            console.log("MockSKL:", address(skl));
            tokenAddress = address(skl);
        } else {
            console.log("Using existing token:", tokenAddress);
        }

        ChipToken chips = new ChipToken(tokenAddress, "Poker Chips", "CHIPS");
        PokerFactory factory = new PokerFactory(address(chips), ctxCallbackValue);

        factory.createTable{value: initialReserve}(buyIn, sb, bb, maxPlayers, "Main Table");

        console.log("ChipToken:", address(chips));
        console.log("PokerFactory:", address(factory));

        vm.stopBroadcast();
    }
}
