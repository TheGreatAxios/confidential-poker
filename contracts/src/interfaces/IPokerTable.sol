// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import {PublicKey} from "@skalenetwork/bite-solidity/types.sol";

interface IPokerTable {
    function buyIn() external view returns (uint256);
    function smallBlind() external view returns (uint256);
    function bigBlind() external view returns (uint256);
    function maxPlayers() external view returns (uint256);
    function tableName() external view returns (string memory);

    function phase() external view returns (uint8);
    function pot() external view returns (uint256);
    function playerCount() external view returns (uint256);

    function sitDown(PublicKey calldata viewerKey) external;
    function leaveTable() external;
    function requestLeave() external;
    function cancelLeave() external;

    function fold() external;
    function check() external;
    function call() external;
    function raise(uint256 amount) external;

    function dealNewHand() external;
    function dealNext() external;
    function resolveHand() external;
    function forfeitAndLeave() external;
    function readyUp() external;
    function unready() external;

    function isReady(address player) external view returns (bool);
    function readyCount() external view returns (uint256);

    event PlayerJoined(address indexed player, uint256 seat);
    event PlayerLeft(address indexed player, uint256 returned);
    event LeaveRequested(address indexed player);
    event PlayerFolded(address indexed player);
    event PlayerChecked(address indexed player);
    event PlayerCalled(address indexed player, uint256 amount);
    event PlayerRaised(address indexed player, uint256 totalBet);
    event Winner(address indexed player, uint256 amount, string handName);
    event PotAwarded(address indexed player, uint256 amount);
    event HandComplete();
    event PlayerReady(address indexed player);
    event PlayerUnready(address indexed player);
    event TurnChanged(uint256 indexed playerIndex, address indexed player);
    event PlayerAction(address indexed player, string action, uint256 amount);
    event HandResult(address[] winners, uint256[] amounts, string[] handNames);
}
