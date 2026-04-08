# Contracts — Agent Instructions

## Overview
Solidity smart contracts for the AI Poker Night application, built with Foundry. Includes hand evaluation, game state management, and token contracts.

## Commands
- `forge build` — Compile contracts
- `forge test -vvv` — Run tests with verbose output
- `forge test --match-test <pattern>` — Run specific tests
- `forge fmt` — Format Solidity code

## Tech Stack
- Solidity + Foundry (forge)
- OpenZeppelin Contracts
- SKALE RNG library
- BITE Solidity for confidential compute

## Key Contracts
- `HandEvaluator.sol` — Pure hand evaluation library
- `MockSKL.sol` — ERC20 token for tipping
- `PokerGame.sol` — On-chain game state machine

## Conventions
- Follow existing Solidity style and patterns
- Use Foundry testing patterns (forge-std)
- Run `forge fmt` before committing
- On SKALE, do not derive BITE CTX callback gas from `tx.gasprice`; use deterministic gas limits based on callback work plus buffer, and treat callback funding as a separate native-value reserve
- No comments unless explicitly requested
- No emojis unless explicitly requested
