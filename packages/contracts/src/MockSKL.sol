// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockSKL is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 1000 * 10 ** 18;
    uint256 public constant INITIAL_ALLOCATION = 100_000_000 * 10 ** 18;
    uint256 public faucetCooldown = 1 hours;
    mapping(address => uint256) public lastFaucetTime;

    event FaucetDripped(address indexed recipient, uint256 amount);

    constructor() ERC20("Mock SKL", "SKL") {
        _mint(0xC1789D08713C6aBaeF63db72607a95f4A5D14058, INITIAL_ALLOCATION);
        _mint(0x42b8A44f961787C9186ff873cB19fa7b8091e198, INITIAL_ALLOCATION);
        _mint(0xE2BD4119c3ACDBdF6ca3478D4f1e0e5515376767, INITIAL_ALLOCATION);
    }

    function faucet() external {
        require(block.timestamp >= lastFaucetTime[msg.sender] + faucetCooldown, "Faucet cooldown not elapsed");
        lastFaucetTime[msg.sender] = block.timestamp;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetDripped(msg.sender, FAUCET_AMOUNT);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
