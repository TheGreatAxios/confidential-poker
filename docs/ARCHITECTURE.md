# Architecture — AI Poker Night

## Overview

AI Poker Night is a three-tier decentralized application for playing Texas Hold'em with AI agents on SKALE Base Sepolia. The system combines on-chain smart contracts for game state, a Hono API server for AI agent orchestration, and a Next.js frontend for the player interface.

## System Components

### 1. Smart Contracts (SKALE Base Sepolia)

All game logic lives on-chain. No off-chain game state — the blockchain is the single source of truth.

#### PokerGame.sol
- **Table Management**: Anyone can create a table with configurable blinds (2–9 players)
- **Player Registration**: Players join with a BITE-encrypted identity and AxiosUSD buy-in
- **Game Flow**: Full Texas Hold'em lifecycle — Waiting → Dealing → Preflop → Flop → Turn → River → Showdown → Finished
- **Betting Engine**: Fold, Check, Call, Raise with proper round completion logic
- **CTX Integration**: Card dealing via BITE Protocol's `submitCTX()` with `onDecrypt()` callback
- **Hand Resolution**: 7-card evaluation with automatic pot distribution

#### HandEvaluator.sol
- Evaluates 5–7 cards to find the best 5-card hand
- Returns a deterministic `uint256` score: `(handRank << 200) | tiebreakers`
- Supports all poker hands: High Card through Royal Flush
- Handles edge cases: wheel straights (A-2-3-4-5), kicker comparison

#### MockSKL.sol & AxiosUSD.sol
- ERC20 faucet tokens with 60-second cooldowns
- MockSKL: Gas token for SKALE transactions
- AxiosUSD: Stablecoin for in-game betting (100 tokens per claim)

### 2. Server (Hono + TypeScript)

The server bridges the frontend and the blockchain, and runs the AI agent engine.

#### Game API
- Reads on-chain game state via `viem` public client
- Submits agent actions via `viem` wallet client (signed transactions)
- Provides RESTful endpoints for the frontend to poll game state

#### Agent Engine
- **Orchestrator**: Manages turn order, calls agents in sequence, submits transactions
- **Agent Interface**: Each agent implements `decideAction()` and `getChatMessage()`
- **Personality System**: Configurable parameters (foldThreshold, raiseAggression, bluffFrequency, usesMath)
- **Wallet Management**: Each agent has its own funded wallet for autonomous on-chain play

#### x402 Integration
- HTTP 402 machine-payable endpoints for agent tipping
- `$0.05` per tip, settled via x402 facilitator on SKALE
- Uses AxiosUSD as the payment token

### 3. Frontend (Next.js 14 + React 18)

Dark-themed poker interface with real-time updates.

#### Components
- **Table View**: Oval poker table with agent seats, community cards, pot display
- **Card Display**: Visual card rendering with suit colors and face values
- **Agent Seat**: Shows agent name, emoji, personality, chip count, current action
- **Faucet Page**: One-click token claiming for gas and betting tokens

#### Hooks
- `useGameState`: Polls server for current game state, auto-refreshes
- `useFaucet`: Claims MockSKL and AxiosUSD tokens
- `useTips`: Sends x402 payments to agents

## Data Flow

```
1. Player creates/joins table
   Frontend → Server API → PokerGame.createTable() / joinTable()

2. Hand starts (dealing)
   Server → PokerGame.startHand() → BITE.submitCTX() → onDecrypt() callback

3. Agent takes action
   Server AgentEngine reads getGameState() → Agent.decideAction() → submitAction()

4. Frontend displays
   Frontend polls GET /game/:id → renders table, cards, agent states

5. Showdown
   PokerGame._resolveShowdown() → evaluateHand() → pot distribution
```

## Security Considerations

- **No admin keys in production**: The game is fully decentralized — no owner-only functions in the core flow
- **Testing helpers**: `startHandNoCTX()`, `revealCardsManually()`, and `forcePayout()` are for testing only (can be removed for mainnet)
- **BITE encryption**: Hole cards are encrypted in transit and only revealed via the CTX callback
- **Reentrancy**: OpenZeppelin contracts used for ERC20, standard checks-effects-interactions pattern

## Deployment

1. Deploy MockSKL → Deploy AxiosUSD → Deploy PokerGame (with AxiosUSD address)
2. Mint initial tokens for the server's agent wallets
3. Configure server with deployed addresses and private keys
4. Start server → agents auto-join and begin playing
