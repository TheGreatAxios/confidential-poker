# Contracts — Agent Instructions

## Overview
Solidity smart contracts for the AI Poker Night application, built with Foundry. Includes hand evaluation, game state management, token wrappers, and a table factory.

## Commands
- `forge build` — Compile contracts
- `forge test -vvv` — Run tests with verbose output
- `forge test --match-test <pattern>` — Run specific tests
- `forge fmt` — Format Solidity code
- `forge script script/Deploy.s.sol --rpc-url <URL> --private-key <KEY> --broadcast` — Deploy

## Tech Stack
- Solidity 0.8.28 + Foundry
- OpenZeppelin Contracts (ERC20, Ownable)
- SKALE RNG library (`@dirtroad/skale-rng`)
- BITE Solidity for confidential compute (`@skalenetwork/bite-solidity`)

## Key Contracts
- `HandEvaluator.sol` — Pure hand evaluation library (no storage)
- `MockSKL.sol` — ERC20 token for chip backing
- `ChipToken.sol` — Wrappable chip token (deposit MockSKL, get CHIPS)
- `PokerGame.sol` — On-chain game state machine (phases, blinds, actions, showdown)
- `PokerFactory.sol` — Deploys and tracks PokerGame tables

## Deploy output
`forge script` logs the following addresses — update package deployment config:
- MockSKL → `mockSkl`
- ChipToken → `chipToken`
- PokerFactory → `pokerFactory`

## Environment
- Default target: SKALE Base Sepolia (chain ID 324705682)
- BITE V2 Sandbox 2 profile uses Istanbul EVM
- Default profile uses Shanghai EVM

## Conventions
- Solc 0.8.28, optimizer on, runs = 1
- Follow existing Solidity style and patterns
- Use Foundry testing patterns (forge-std)
- Run `forge fmt` before committing
- On SKALE, do not derive BITE CTX callback gas from `tx.gasprice`; use deterministic gas limits based on callback work plus buffer, and treat callback funding as a separate native-value reserve
- No comments unless explicitly requested
- No emojis unless explicitly requested
