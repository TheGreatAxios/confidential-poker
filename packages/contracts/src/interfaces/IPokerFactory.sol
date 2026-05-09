// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

interface IPokerFactory {
    function createTable(
        uint256 buyIn,
        uint256 smallBlind,
        uint256 bigBlind,
        uint256 maxPlayers,
        string calldata tableName
    ) external payable returns (address tableAddress);

    function getTableCount() external view returns (uint256);
    function getTable(uint256 index) external view returns (address);
    function getAllTables() external view returns (address[] memory);
    function getTablesByBuyIn(uint256 targetBuyIn) external view returns (address[] memory);

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
        );

    function owner() external view returns (address);
    function totalFeesCollected() external view returns (uint256);
    function withdrawFees() external;
    function isKnownTable(address table) external view returns (bool);
    function collectFee(bool isEarlyQuit) external payable;

    event TableCreated(address indexed table, address indexed creator, string tableName, uint256 buyIn);
    event FeesCollected(address indexed table, uint256 amount, bool isEarlyQuit);
    event FeesWithdrawn(address indexed recipient, uint256 amount);
}
