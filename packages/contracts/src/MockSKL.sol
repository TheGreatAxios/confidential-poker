// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

/**
 * @title MockSKL
 * @notice Mock ERC20 token for tipping AI agents in the Poker Night game.
 *         Includes a faucet that dispenses 1000 tokens per call.
 */
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockSKL is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 1000 * 10 ** 18;
    uint256 public faucetCooldown = 1 hours;
    mapping(address => uint256) public lastFaucetTime;

    event FaucetDripped(address indexed recipient, uint256 amount);

    constructor() ERC20("Mock SKL", "SKL") {
        _mint(msg.sender, 1_000_000 * 10 ** 18);
    }

    /// @notice Faucet: gives caller 1000 tokens, once per hour
    function faucet() external {
        require(
            block.timestamp >= lastFaucetTime[msg.sender] + faucetCooldown,
            "Faucet cooldown not elapsed"
        );
        lastFaucetTime[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetDripped(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Mint tokens (only owner for testing convenience)
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
