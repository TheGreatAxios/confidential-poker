// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title PokerChip — ERC20 chip token with EIP-3009 transferWithAuthorization
/// @notice Used for buy-in/cash-out at PokerTable. Supports gasless meta-transactions
///         via server relayer submitting signed EIP-712 payloads.
contract PokerChip is ERC20Permit, Ownable {
    using ECDSA for bytes32;

    // ── EIP-3009 State ──
    mapping(bytes32 => uint256) public _authorizationStates;
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );
    bytes32 public constant RECEIVE_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "ReceiveWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );
    bytes32 public constant CANCEL_AUTHORIZATION_TYPEHASH = keccak256(
        "CancelAuthorization(address authorizer,bytes32 nonce)"
    );
    uint256 public constant AUTHORIZATION_STATE_ACTIVE = 1;

    // ── Minter ──
    address public minter;

    // ── Events ──
    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);
    event AuthorizationCanceled(address indexed authorizer, bytes32 indexed nonce);
    event MinterChanged(address oldMinter, address newMinter);

    // ── Errors ──
    error AuthorizationAlreadyUsed();
    error SignatureExpired();
    error SignatureNotYetValid();
    error InvalidSignature();
    error NotMinter();
    error ZeroAddress();

    constructor(
        address _minter
    ) ERC20("PokerChip", "CHIP") ERC20Permit("PokerChip") Ownable(msg.sender) {
        if (_minter == address(0)) revert ZeroAddress();
        minter = _minter;
    }

    modifier onlyMinter() {
        if (msg.sender != minter) revert NotMinter();
        _;
    }

    // ── Minting ──
    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }

    function setMinter(address newMinter) external onlyOwner {
        if (newMinter == address(0)) revert ZeroAddress();
        emit MinterChanged(minter, newMinter);
        minter = newMinter;
    }

    // ══════════════════════════════════════════════════════════
    //  EIP-3009: Transfer With Authorization
    // ══════════════════════════════════════════════════════════

    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external {
        _verifyTransferAuthorization(from, to, value, validAfter, validBefore, nonce, signature);
        _markAuthorizationAsUsed(nonce);
        emit AuthorizationUsed(from, nonce);
        _transfer(from, to, value);
    }

    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) external {
        require(to == address(this), "Transfer not to self");
        _verifyTransferAuthorization(from, to, value, validAfter, validBefore, nonce, signature);
        _markAuthorizationAsUsed(nonce);
        emit AuthorizationUsed(from, nonce);
        _transfer(from, to, value);
    }

    function cancelAuthorization(
        address authorizer,
        bytes32 nonce,
        bytes calldata signature
    ) external {
        require(authorizer != address(0), "Zero address");
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(CANCEL_AUTHORIZATION_TYPEHASH, authorizer, nonce))
        );
        require(authorizer == ECDSA.recover(digest, signature), "Invalid signature");
        require(_authorizationStates[nonce] == 0, "Already used/canceled");
        _authorizationStates[nonce] = AUTHORIZATION_STATE_ACTIVE + 1; // canceled
        emit AuthorizationCanceled(authorizer, nonce);
    }

    function authorizationState(bytes32 nonce) external view returns (uint256) {
        return _authorizationStates[nonce];
    }

    // ══════════════════════════════════════════════════════════
    //  Internal
    // ══════════════════════════════════════════════════════════

    function _verifyTransferAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        bytes calldata signature
    ) internal view {
        require(_authorizationStates[nonce] == 0, "Authorization used");
        require(block.timestamp >= validAfter, "Signature not yet valid");
        require(block.timestamp <= validBefore, "Signature expired");

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(
                TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                from,
                to,
                value,
                validAfter,
                validBefore,
                nonce
            ))
        );
        require(from == ECDSA.recover(digest, signature), "Invalid signature");
    }

    function _markAuthorizationAsUsed(bytes32 nonce) internal {
        _authorizationStates[nonce] = AUTHORIZATION_STATE_ACTIVE;
    }
}
