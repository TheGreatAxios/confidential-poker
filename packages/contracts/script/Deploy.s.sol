// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {MockSKL} from "../src/MockSKL.sol";
import {ChipToken} from "../src/ChipToken.sol";
import {PokerFactory} from "../src/PokerFactory.sol";

contract Deploy is Script {
    uint256 constant DEFAULT_CTX_CALLBACK_VALUE = 1 ether;
    uint256 constant FACTORY_SEED = 100_000 ether;
    uint256 constant TABLE_INITIAL_RESERVE = 14 ether;

    function run() external {
        uint256 ctxCallbackValue = vm.envOr("CTX_CALLBACK_VALUE", DEFAULT_CTX_CALLBACK_VALUE);
        uint256 factorySeed = vm.envOr("FACTORY_SEED", FACTORY_SEED);
        uint256 tableReserve = vm.envOr("TABLE_INITIAL_RESERVE", TABLE_INITIAL_RESERVE);

        uint256 buyIn = vm.envOr("BUY_IN", uint256(1000e18));
        uint256 sb = vm.envOr("SMALL_BLIND", uint256(5e17));
        uint256 bb = vm.envOr("BIG_BLIND", uint256(1e18));
        uint256 maxPlayers = vm.envOr("MAX_PLAYERS", uint256(6));

        vm.startBroadcast();

        MockSKL skl = new MockSKL();
        ChipToken chips = new ChipToken(address(skl), "Poker Chips", "CHIPS");
        PokerFactory factory = new PokerFactory{value: factorySeed}(address(chips), ctxCallbackValue);

        factory.createTable{value: tableReserve}(buyIn, sb, bb, maxPlayers, "Main Table");

        console.log("MockSKL:", address(skl));
        console.log("ChipToken:", address(chips));
        console.log("PokerFactory:", address(factory));
        console.log("Factory sFUEL:", address(factory).balance);
        console.log("Table count:", factory.getTableCount());

        vm.stopBroadcast();
    }
}
