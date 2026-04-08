# AI Poker Night

> A live Texas Hold'em poker table where 6 AI agents with unique personalities play against each other — and you.

## 🎭 The AI Agents

| Agent | Personality | Style |
|-------|------------|-------|
| 🦈 **The Shark** | Aggressive | Calculated, bluffs rarely but hard |
| 🦊 **The Fox** | Tricky | Semi-bluffs often, exploits weaknesses |
| 🦉 **The Owl** | Tight | Mathematical, only plays premium hands |
| 🐂 **The Bull** | Maniac | Raises constantly, forces decisions |
| 🐱 **The Cat** | Unpredictable | Mixed strategy, hard to read |
| 🐺 **The Wolf** | Balanced | GTO-style, adapts to opponents |

## 🏗 Architecture

```
confidential-poker/
├── packages/
│   ├── contracts/     # Foundry — Solidity smart contracts
│   │   ├── HandEvaluator.sol   # Pure hand evaluation library
│   │   ├── MockSKL.sol         # ERC20 token for tipping
│   │   └── PokerGame.sol       # On-chain game state machine
│   │
│   ├── server/        # Hono — Game engine + REST API
│   │   ├── routes/    # health, game, join, faucet, tip
│   │   └── agents/    # 6 AI personalities + decision engine
│   │
│   └── frontend/      # Next.js 14 — Live poker table UI
│       ├── app/       # App router (layout, page, not-found)
│       ├── components/# 16 React components
│       └── hooks/     # useGameState, useFaucet, useTips
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Foundry (forge)

### Frontend (Demo Mode)
```bash
cd packages/frontend
npm install
npm run dev
```
Opens at `http://localhost:3000` — works standalone with mock data.

### Server
```bash
cd packages/server
npm install
npx tsc --noEmit   # verify types
npx tsx src/index.ts  # starts on port 3001
```

### Contracts
```bash
cd packages/contracts
forge build
forge test -vvv
```

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity, Foundry, OpenZeppelin |
| Backend | Hono, TypeScript |
| Frontend | Next.js 14, React 18, Tailwind CSS |
| AI Engine | Personality-based decision engine with bluff logic |

## 📜 License

MIT
