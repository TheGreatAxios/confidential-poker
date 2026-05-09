// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PokerGame} from "./PokerGame.sol";

contract PokerFactory is Ownable {
    address[] public tables;
    mapping(address => bool) public isKnownTable;
    address public immutable CHIP_TOKEN;
    uint256 public immutable CTX_CALLBACK_VALUE_WEI;
    uint256 public totalFeesCollected;

    event TableCreated(
        address indexed table,
        address indexed creator,
        string tableName,
        uint256 buyIn,
        uint256 smallBlind,
        uint256 bigBlind,
        uint256 maxPlayers
    );
    event FeesCollected(address indexed table, uint256 amount, bool isEarlyQuit);
    event FeesWithdrawn(address indexed recipient, uint256 amount);
    event TableRefilled(address indexed table, uint256 amount);

    error TableNotFound(address table);
    error InsufficientPayment(uint256 required, uint256 provided);
    error TransferFailed();

    constructor(address _chipToken, uint256 _ctxCallbackValueWei) payable Ownable(msg.sender) {
        require(_chipToken != address(0), "Zero address");
        require(_ctxCallbackValueWei > 0, "Zero callback value");
        CHIP_TOKEN = _chipToken;
        CTX_CALLBACK_VALUE_WEI = _ctxCallbackValueWei;
    }

    function createTable(
        uint256 buyIn,
        uint256 smallBlind,
        uint256 bigBlind,
        uint256 maxPlayers,
        string calldata tableName
    ) external payable returns (address) {
        uint256 minReserve = CTX_CALLBACK_VALUE_WEI * 11;
        require(msg.value >= minReserve, InsufficientPayment(minReserve, msg.value));

        PokerGame table = new PokerGame{value: msg.value}(
            address(this),
            CHIP_TOKEN,
            msg.sender,
            buyIn,
            smallBlind,
            bigBlind,
            maxPlayers,
            CTX_CALLBACK_VALUE_WEI,
            tableName
        );

        tables.push(address(table));
        isKnownTable[address(table)] = true;

        emit TableCreated(address(table), msg.sender, tableName, buyIn, smallBlind, bigBlind, maxPlayers);
        return address(table);
    }

    function getTableCount() external view returns (uint256) {
        return tables.length;
    }

    function getTable(uint256 index) external view returns (address) {
        require(index < tables.length, "Index out of bounds");
        return tables[index];
    }

    function getAllTables() external view returns (address[] memory) {
        return tables;
    }

    function getTablesByBuyIn(uint256 targetBuyIn) external view returns (address[] memory) {
        uint256 count;
        for (uint256 i = 0; i < tables.length; i++) {
            if (PokerGame(payable(tables[i])).BUY_IN() == targetBuyIn) {
                count++;
            }
        }
        address[] memory result = new address[](count);
        uint256 idx;
        for (uint256 i = 0; i < tables.length; i++) {
            if (PokerGame(payable(tables[i])).BUY_IN() == targetBuyIn) {
                result[idx++] = tables[i];
            }
        }
        return result;
    }

    function getTableInfo(address table)
        external
        view
        returns (
            uint256 buyInAmount,
            uint256 smallBlindAmount,
            uint256 bigBlindAmount,
            uint256 playerCount,
            uint256 potAmount,
            uint8 phaseValue,
            string memory name
        )
    {
        require(isKnownTable[table], TableNotFound(table));
        PokerGame t = PokerGame(payable(table));
        return (t.BUY_IN(), t.SMALL_BLIND(), t.BIG_BLIND(), t.playerCount(), t.pot(), uint8(t.phase()), t.tableName());
    }

    function collectFee(bool isEarlyQuit) external payable {
        require(isKnownTable[msg.sender], TableNotFound(msg.sender));
        totalFeesCollected += msg.value;
        emit FeesCollected(msg.sender, msg.value, isEarlyQuit);
    }

    function refillTable(address table, uint256 amount) external {
        require(isKnownTable[table], TableNotFound(table));
        require(amount > 0, "Zero amount");
        uint256 available = address(this).balance;
        uint256 actual = amount < available ? amount : available;
        if (actual > 0) {
            (bool ok,) = payable(table).call{value: actual}("");
            require(ok, TransferFailed());
            emit TableRefilled(table, actual);
        }
    }

    function withdrawFees() external onlyOwner {
        uint256 amount = totalFeesCollected;
        totalFeesCollected = 0;
        (bool ok,) = payable(owner()).call{value: amount}("");
        require(ok, TransferFailed());
        emit FeesWithdrawn(owner(), amount);
    }

    receive() external payable {}
}
