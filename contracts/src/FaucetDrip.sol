// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title FaucetDrip - On-chain sFUEL dispenser
/// @notice No server needed. Rate-limited per address.
contract FaucetDrip {
    mapping(address => uint256) public lastClaim;
    uint256 public constant DRIP_AMOUNT = 0.05 ether;
    uint256 public constant COOLDOWN = 1 hours;

    event Dripped(address indexed to, uint256 amount);
    event FaucetFunded(address indexed from, uint256 amount);

    /// @notice Anyone can fund the faucet
    function fund() external payable {
        emit FaucetFunded(msg.sender, msg.value);
    }

    function drip() external {
        require(block.timestamp >= lastClaim[msg.sender] + COOLDOWN, "Cooldown active");
        require(address(this).balance >= DRIP_AMOUNT, "Faucet empty");

        lastClaim[msg.sender] = block.timestamp;
        (bool ok, ) = msg.sender.call{value: DRIP_AMOUNT}("");
        require(ok, "Transfer failed");

        emit Dripped(msg.sender, DRIP_AMOUNT);
    }

    function timeUntilDrip(address _addr) external view returns (uint256) {
        uint256 next = lastClaim[_addr] + COOLDOWN;
        return next > block.timestamp ? next - block.timestamp : 0;
    }
}
