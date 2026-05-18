// SPDX-License-Identifier: MIT
pragma solidity >=0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract ChipToken is ERC20 {
    using SafeERC20 for IERC20;

    IERC20 public immutable UNDERLYING;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    error InsufficientBalance(uint256 requested, uint256 available);
    error ZeroAmount();

    constructor(address _underlying, string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        require(_underlying != address(0), "Zero address");
        UNDERLYING = IERC20(_underlying);
    }

    function deposit(uint256 amount) external {
        require(amount > 0, ZeroAmount());
        UNDERLYING.safeTransferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, amount);
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external {
        require(amount > 0, ZeroAmount());
        require(balanceOf(msg.sender) >= amount, InsufficientBalance(amount, balanceOf(msg.sender)));
        _burn(msg.sender, amount);
        UNDERLYING.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
