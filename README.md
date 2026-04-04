<div align="center">

# 🃏 AI Poker Night

### Texas Hold'em where AI agents bluff, raise, and go all-in with encrypted cards on SKALE

<p>
  <img src="https://img.shields.io/badge/Solidity-0.8.27-363636?style=flat-square&logo=solidity" alt="Solidity" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/SKALE-Base_Sepolia-FF414C?style=flat-square&logo=skale&logoColor=white" alt="SKALE" />
  <img src="https://img.shields.io/badge/BITE_Protocol-CTX-7B3FE4?style=flat-square&logo=ethereum&logoColor=white" alt="BITE Protocol" />
  <img src="https://img.shields.io/badge/x402-Payments-00D4AA?style=flat-square&logo=dollar-sign&logoColor=white" alt="x402" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License" />
</p>

<img src="docs/demo.gif" alt="AI Poker Night Demo" width="720" />

<p>
  <a href="#-features">✨ Features</a> •
  <a href="#-architecture">🏗️ Architecture</a> •
  <a href="#-ai-agents">🤖 AI Agents</a> •
  <a href="#-smart-contracts">⛓️ Contracts</a> •
  <a href="#-getting-started">🚀 Getting Started</a> •
  <a href="#-hackathon-tracks">🏆 Tracks</a>
</p>

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔒 **Encrypted Card Dealing** | Cards dealt via BITE CTX (Confidential Transaction Extension) — no one sees another player's hand |
| 🤖 **AI Agent Personalities** | 4 unique AI agents with distinct playstyles — aggressive, conservative, bluffer, mathematical |
| 💰 **On-Chain Betting** | Real USDC-style (AxiosUSD) betting with fully on-chain game state on SKALE |
| 🪙 **Dual Faucets** | Gas + stablecoin faucets — jump in and play instantly, zero cost |
| 💸 **x402 Tipping** | Machine-payable HTTP endpoints — tip agents $0.05 for a good bluff |
| 🎨 **Dark Theme UI** | Gorgeous dark-themed frontend with Framer Motion animations and Lucide icons |
| ⛓️ **On-Chain Game Logic** | Complete Texas Hold'em engine in Solidity — dealing, betting rounds, showdown |
| 🔓 **Open Tables** | Anyone can create or join a table — decentralized and permissionless |
| ✅ **37/37 Tests Passing** | Battle-tested smart contracts with comprehensive Foundry test suite |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND                             │
│                 (Next.js 14 + React 18)                  │
│                                                          │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│   │  Table   │  │  Cards   │  │  Agents  │  │ Faucet │ │
│   │  View    │  │  Display │  │  Panel   │  │  Page  │ │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘ │
└────────┼─────────────┼─────────────┼────────────┼───────┘
         │             │             │            │
         └─────────────┴──────┬──────┴────────────┘
                              │
┌─────────────────────────────┴───────────────────────────┐
│                      SERVER                             │
│                  (Hono + TypeScript)                     │
│                                                          │
│  ┌────────────────┐  ┌─────────────┐  ┌───────────────┐ │
│  │   Game API     │  │    x402     │  │ Agent Engine  │ │
│  │  (on-chain     │  │   Tipping   │  │ (4 AI agents  │ │
│  │   interaction) │  │  ($0.05/tip)│  │  w/ wallets)  │ │
│  └───────┬────────┘  └─────────────┘  └───────┬───────┘ │
└──────────┼──────────────────────────────────────┼────────┘
           │                                      │
┌──────────┴──────────────────────────────────────┴────────┐
│               SKALE BASE SEPOLIA (zero gas)               │
│                                                           │
│  ┌────────────────┐  ┌────────────┐  ┌────────────────┐ │
│  │   PokerGame    │  │  MockSKL   │  │   AxiosUSD     │ │
│  │   (on-chain    │  │  (gas token│  │   (betting     │ │
│  │    game logic) │  │   faucet)  │  │    token)      │ │
│  └────────────────┘  └────────────┘  └────────────────┘ │
│                                                           │
│  🔐 BITE Protocol: CTX encrypted card dealing             │
│  💸 x402: Machine-payable HTTP endpoints                  │
└───────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contracts** | Solidity 0.8.27, Foundry (forge + cast) |
| **Card Encryption** | BITE Protocol — CTX (Confidential Transaction Extension) |
| **Server** | Hono, TypeScript 5.7, viem |
| **Agent Engine** | Rule-based AI with personality profiles |
| **Payments** | x402 protocol (HTTP 402 — machine-payable endpoints) |
| **Frontend** | Next.js 14, React 18, Tailwind CSS 3.4 |
| **Animations** | Framer Motion 11, Lucide React icons |
| **Blockchain** | SKALE Base Sepolia — zero gas fees |

---

## 🤖 AI Agents

Each AI agent is an autonomous on-chain player with its own funded wallet and distinct personality. They read game state, evaluate their hand, and submit actions — all on-chain.

| Agent | Personality | Play Style | Traits |
|-------|------------|------------|--------|
| 🤬 **Rage Bot** | Aggressive | Raises often, bluffs constantly | Almost never folds (5%), 95% raise aggression |
| 🧐 **Caution Bot** | Conservative | Folds weak hands, bets premium only | High fold threshold (60%), 5% bluff frequency |
| 🎭 **Bluff Master** | Deceptive | Unpredictable, chaotic plays | Raises to represent strength (65%), 80% bluff rate |
| 🧮 **Math Genius** | Mathematical | Calculates pot odds, GTO-optimal | EV-based decisions, 15% calculated bluffs |

### How Agents Decide

Each agent implements the same `Agent` interface but with different personality parameters:

```
Personality {
  foldThreshold:     0.0 – 1.0   // How quickly they fold weak hands
  raiseAggression:   0.0 – 1.0   // How often they raise vs call
  bluffFrequency:    0.0 – 1.0   // How often they bet without a hand
  usesMath:          boolean     // Whether they calculate pot odds
}
```

The `AgentEngine` orchestrates all agents, reads on-chain game state via `viem`, and submits signed transactions for each agent's turn.

> 📖 See [`docs/AGENTS.md`](docs/AGENTS.md) for full personality specs and decision algorithms.

---

## ⛓️ Smart Contracts

All contracts are written in Solidity 0.8.27 and tested with Foundry (**37/37 tests passing**).

### PokerGame.sol — The Core Engine
The main game contract implementing full Texas Hold'em with BITE-encrypted card dealing.

```solidity
contract PokerGame is IBiteSupplicant {
    // Game phases: Waiting → Dealing → Preflop → Flop → Turn → River → Showdown
    // Player actions: Fold, Check, Call, Raise
    // BITE CTX: submitCTX() for encrypted dealing, onDecrypt() callback
}
```

**Key flows:**
- **Create Table** → Anyone can create a poker table with custom blinds and max players (2–9)
- **Join Table** → Players join with an encrypted identity (BITE) and AxiosUSD buy-in
- **Deal Cards** → `startHand()` submits a CTX transaction; `onDecrypt()` callback reveals cards
- **Betting Rounds** → `submitAction()` for fold/check/call/raise with full round management
- **Showdown** → Automatic hand evaluation using `HandEvaluator`, pot distribution to winner

### HandEvaluator.sol — Poker Hand Ranking
A comprehensive 7-card evaluator that finds the best 5-card hand from any combination of 5–7 cards.

| Rank | Hand |
|------|------|
| 9 | Royal Flush |
| 8 | Straight Flush |
| 7 | Four of a Kind |
| 6 | Full House |
| 5 | Flush |
| 4 | Straight |
| 3 | Three of a Kind |
| 2 | Two Pair |
| 1 | One Pair |
| 0 | High Card |

Scores are encoded as `uint256` for deterministic on-chain comparison: `(handRank << 200) | tiebreakers`.

### MockSKL.sol — Gas Token Faucet
ERC20 faucet dispensing 100 mSKL per call with a 60-second cooldown. Powers zero-gas gameplay on SKALE.

### AxiosUSD.sol — Betting Token Faucet
ERC20 stablecoin faucet dispensing 100 AxUSD per call with a 60-second cooldown. Used for all in-game betting.

> 📖 See [`docs/CONTRACTS.md`](docs/CONTRACTS.md) for full contract APIs and deployment details.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Foundry](https://book.getfoundry.sh/) (forge, cast, anvil)
- A wallet with SKALE Base Sepolia sFUEL (free from [SKALE Portal](https://portal.skale.network/))

### Quick Start

```bash
# 1. Clone the repo (with submodules)
git clone --recurse-submodules https://github.com/TheGreatAxios/confidential-poker.git
cd confidential-poker

# 2. Install Foundry dependencies
cd contracts && forge install OpenZeppelin/openzeppelin-contracts && cd ..

# 3. Install all dependencies
npm run install:all

# 3. Build smart contracts
npm run build:contracts

# 4. Run contract tests (37/37 should pass ✅)
npm run test:contracts

# 5. Start the server (terminal 1)
cp server/.env.example server/.env
# Edit server/.env with your private key and deployed contract addresses
npm run dev:server

# 6. Start the frontend (terminal 2)
npm run dev:frontend
```

### Deploying Contracts

```bash
cd contracts

# Deploy to SKALE Base Sepolia
forge create src/PokerGame.sol:PokerGame \
  --rpc-url https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha \
  --private-key $PRIVATE_KEY \
  --constructor-args $AXIOS_USD_ADDRESS

# Deploy faucets
forge create src/MockSKL.sol:MockSKL \
  --rpc-url https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha \
  --private-key $PRIVATE_KEY

forge create src/AxiosUSD.sol:AxiosUSD \
  --rpc-url https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha \
  --private-key $PRIVATE_KEY
```

### Environment Variables

Copy `server/.env.example` to `server/.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `RPC_URL` | SKALE Base Sepolia RPC | `https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha` |
| `CHAIN_ID` | SKALE Base Sepolia chain ID | `324705682` |
| `PRIVATE_KEY` | Server operator wallet key | _(required)_ |
| `MOCK_SKL_ADDRESS` | Deployed MockSKL contract | _(required)_ |
| `AXIOS_USD_ADDRESS` | Deployed AxiosUSD contract | _(required)_ |
| `POKER_GAME_ADDRESS` | Deployed PokerGame contract | _(required)_ |
| `X402_FACILITATOR_URL` | x402 payment facilitator | `https://facilitator.payai.network` |
| `X402_NETWORK` | x402 network identifier | `eip155:324705682` |
| `X402_TOKEN_ADDRESS` | x402 payment token | `0x61a26022927096f444994dA1e53F0FD9487EAfcf` |

---

## 🏆 Hackathon Tracks

### 🎨 Track 5: Creative / Unhinged
**AI agents with personalities playing poker with encrypted cards on-chain.** This is the unhinged part — autonomous bots with anger issues, trust issues, math obsessions, and deception artists sitting around a virtual table, bluffing each other with real money on a zero-gas blockchain. Each agent has a funded wallet, reads game state, makes decisions based on its personality, and trash-talks via chat messages.

### 🤖 Track 4: Multi-Agent Systems
**4 autonomous agents coordinating in a competitive game environment.** The AgentEngine orchestrates all agents, manages turn ordering, reads on-chain state, and submits signed transactions. Each agent is a full participant — they join tables, post blinds, make betting decisions, and receive payouts. The system demonstrates multi-agent coordination with on-chain state as the single source of truth.

---

## 📁 Project Structure

```
ai-poker-night/
├── contracts/                # Solidity smart contracts (Foundry)
│   ├── src/
│   │   ├── PokerGame.sol     # Main game engine
│   │   ├── HandEvaluator.sol # Poker hand ranking library
│   │   ├── MockSKL.sol       # Gas token faucet
│   │   └── AxiosUSD.sol      # Betting token faucet
│   ├── test/                 # 37 tests, all passing ✅
│   └── foundry.toml
├── server/                   # Hono API server
│   ├── src/
│   │   ├── agents/           # AI agent personalities & engine
│   │   ├── abis/             # Generated contract ABIs
│   │   ├── config.ts         # Environment configuration
│   │   └── viem.ts           # Blockchain client
│   └── package.json
├── frontend/                 # Next.js 14 app
│   ├── src/
│   │   ├── app/              # Pages & layout
│   │   ├── components/       # Table, Cards, AgentSeat
│   │   ├── hooks/            # useGameState, useFaucet, useTips
│   │   └── lib/              # API client, formatting
│   └── package.json
├── docs/
│   ├── ARCHITECTURE.md       # Detailed architecture
│   ├── CONTRACTS.md          # Contract documentation
│   └── AGENTS.md             # Agent personality specs
├── .github/workflows/
│   └── test.yml              # CI — forge fmt, build, test
├── package.json              # Root monorepo scripts
└── README.md                 # ← You are here
```

---

## 🛠️ Development

```bash
# Run all contract tests with full output
npm run test:contracts

# Build contracts
npm run build:contracts

# Clean all build artifacts
npm run clean

# Lint and format Solidity
cd contracts && forge fmt && forge fmt --check
```

---

## 📜 License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built for [Open Wallet Hackathon](https://hackathon.openwallet.sh/)**

<p>
  <sub>Built with 🃏 on SKALE — where the cards are encrypted, the agents are unhinged, and the gas is free.</sub>
</p>

</div>
