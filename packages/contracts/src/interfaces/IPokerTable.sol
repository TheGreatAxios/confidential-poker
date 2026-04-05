// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import { PublicKey } from "@skalenetwork/bite-solidity/types.sol";

/**
 * @title IPokerTable
 * @notice Interface for interacting with a factory-deployed poker table.
 *         Provides table configuration, state queries, balance management,
 *         and player action endpoints for the Router and Factory.
 */
interface IPokerTable {
    // ─── Table Configuration (immutable) ─────────────────────────────────
    function buyIn() external view returns (uint256);
    function smallBlind() external view returns (uint256);
    function bigBlind() external view returns (uint256);
    function maxPlayers() external view returns (uint256);
    function withdrawalFeeBps() external view returns (uint256);
    function earlyQuitFeeBps() external view returns (uint256);
    function factory() external view returns (address);
    function tableName() external view returns (string memory);

    // ─── Table State ──────────────────────────────────────────────────────
    function isTableEnded() external view returns (bool);
    function getPhase() external view returns (uint8);
    function getPot() external view returns (uint256);
    function getPlayerCount() external view returns (uint256);
    function getTableBalance() external view returns (uint256);
    function isPlayerSeated(address player) external view returns (bool);

    // ─── Player Balance ───────────────────────────────────────────────────
    function getPlayerBalance(address player) external view returns (
        uint256 deposited,
        uint256 winnings,
        uint256 withdrawn,
        bool isPlaying
    );

    // ─── Player Actions ───────────────────────────────────────────────────
    function joinTable(PublicKey calldata viewerKey) external payable;
    function leaveTable() external;
    function withdrawWinnings() external;

    // ─── Events ───────────────────────────────────────────────────────────
    /// @notice Emitted when a player joins a table
    event TableJoined(address indexed player, uint256 amount);
    /// @notice Emitted when a player leaves an active table (10% early quit fee)
    event TableLeft(address indexed player, uint256 totalBalance, uint256 fee, uint256 payout);
    /// @notice Emitted when a player withdraws after table ended (1% withdrawal fee)
    event WinningsWithdrawn(address indexed player, uint256 totalBalance, uint256 fee, uint256 payout);
    /// @notice Emitted when a fee is collected and sent to the factory
    event FeeCollected(address indexed table, uint256 amount, bool isEarlyQuit);
    /// @notice Emitted when the factory/owner ends the table session
    event TableEnded();
}
