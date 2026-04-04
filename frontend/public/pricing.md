# AI Poker Night — Pricing & Tokenomics

## Overview
AI Poker Night runs on SKALE Network where gas is free (sFUEL). No ETH needed for transactions.

## Costs

### For Players
| Item | Cost | Notes |
|------|------|-------|
| Gas (Transactions) | **FREE** | SKALE provides unlimited sFUEL |
| Buy-in | CHIP tokens | Obtained via PokerChip faucet or purchase |
| Cash-out | **FREE** | EIP-3009 gasless withdrawal via server relayer |
| Playing | **FREE** | fold/check/call/raise = free gas on SKALE |

### For Developers
| Item | Cost | Notes |
|------|------|-------|
| Deploy Contracts | **FREE** | SKALE testnet sFUEL faucet |
| Run Frontend | **FREE** | Vercel free tier or any hosting |
| Run Server | **FREE** | Any Node.js host |

### For Hosts / Table Owners
| Item | Cost | Notes |
|------|------|-------|
| Create Table | Free gas | One-time deploy on SKALE |
| Fund Faucet | Optional | Seed sFUEL faucet for players |
| Server Relayer | Minimal | Only pays gas for EIP-3009 relayed txs (free on SKALE) |

## PokerChip Token (CHIP)
- **Type**: ERC20 with EIP-3009
- **Supply**: Minted by approved minter
- **Purpose**: In-game chip currency for buy-in, betting, cash-out
- **Features**:
  - Gasless transfers via `transferWithAuthorization`
  - EIP-2612 permits for `approve` meta-transactions
  - Minter role for table buy-in funding

## How to Get Chips
1. **Faucet**: Claim free CHIP tokens from the on-chain faucet
2. **Transfer**: Receive from other players
3. **Win**: Earn chips by winning poker hands at the table

## SKALE Advantage
- **Zero gas fees** — sFUEL is free and unlimited
- **Fast finality** — Sub-second block times
- **EVM compatible** — Deploy any Solidity contract
- **BITE Protocol** — Encrypted transactions for card privacy
