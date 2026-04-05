// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

/**
 * @title IPokerFactory
 * @notice Interface for the poker table factory.
 *         Manages table creation, discovery, and fee collection.
 */
interface IPokerFactory {
    // ─── Table Creation ───────────────────────────────────────────────────
    function createTable(
        uint256 buyIn,
        uint256 smallBlind,
        uint256 bigBlind,
        uint256 maxPlayers,
        uint256 withdrawalFeeBps,
        uint256 earlyQuitFeeBps,
        string calldata tableName
    ) external returns (address tableAddress);

    // ─── Table Discovery ──────────────────────────────────────────────────
    function getTableCount() external view returns (uint256);
    function getTable(uint256 index) external view returns (address);
    function getAllTables() external view returns (address[] memory);
    function getTablesByBuyIn(uint256 targetBuyIn) external view returns (address[] memory);

    /// @notice Get comprehensive info about a table
    function getTableInfo(address table) external view returns (
        uint256 buyInAmount,
        uint256 smallBlindAmount,
        uint256 bigBlindAmount,
        uint256 playerCount,
        uint256 potAmount,
        uint8 phaseValue,
        bool ended
    );

    // ─── Fee Management ───────────────────────────────────────────────────
    function owner() external view returns (address);
    function totalFeesCollected() external view returns (uint256);
    function withdrawFees() external;
    function isKnownTable(address table) external view returns (bool);

    /// @notice Called by tables to register collected fees
    function collectFee(bool isEarlyQuit) external payable;

    // ─── Events ───────────────────────────────────────────────────────────
    event TablesCreated(address indexed table, address indexed creator, string tableName, uint256 buyIn);
    event FeesCollected(address indexed table, uint256 amount, bool isEarlyQuit);
    event FeesWithdrawn(address indexed recipient, uint256 amount);
}
