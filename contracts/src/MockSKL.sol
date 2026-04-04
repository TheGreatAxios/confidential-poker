// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockSKL - Mock SKL token for gas faucet
/// @notice ERC20 token with a faucet that mints 100 tokens per call (60s cooldown)
contract MockSKL is ERC20, Ownable {
    mapping(address => uint256) public lastFaucetTime;
    uint256 public constant FAUCET_COOLDOWN = 5 minutes;
    uint256 public constant FAUCET_AMOUNT = 100 * 10 ** 18;

    constructor() ERC20("Mock SKL", "mSKL") Ownable(msg.sender) {}

    /// @notice Mint tokens to any address (owner only)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Faucet: mints 100 mSKL to caller, 5 min cooldown
    function faucet() external {
        require(block.timestamp >= lastFaucetTime[msg.sender] + FAUCET_COOLDOWN, "Faucet: cooldown active");
        lastFaucetTime[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
    }
}
