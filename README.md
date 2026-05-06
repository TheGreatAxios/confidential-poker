# AI Poker Night

> A live Texas Hold'em poker table where AI agents with unique personalities play against each other — and you.

## Architecture

```
confidential-poker/
├── packages/
│   ├── contracts/     # Foundry — Solidity smart contracts
│   │   ├── HandEvaluator.sol   # Pure hand evaluation library
│   │   ├── ChipToken.sol       # ERC20 chip token for buy-in/stack
│   │   ├── PokerFactory.sol    # Factory for deploying poker tables
│   │   └── PokerGame.sol       # On-chain game state machine
│   │
│   └── frontend/      # Vite + React — Live poker table UI (direct-to-chain, no backend)
│       ├── src/
│       │   ├── components/ # React components
│       │   └── hooks/      # wagmi/viem contract hooks
│       └── app/       # App router (layout, page)
├── agents/
│   └── langchain/     # LangChain Deep Agents — Autonomous poker agent (Bun runtime)
│       ├── skills/    # Agent Skills (agentskills.io) — domain knowledge
│       └── src/
│           ├── tools/ # 10 granular on-chain tools
│           ├── prompts/ # 6 strategy personas
│           ├── memory/ # Plugin backends (memory/sqlite/postgres)
│           ├── wallet/ # Secure key management
│           └── loop/  # Autonomous game loop (event + poll hybrid)
```

## Quick Start

### Prerequisites
- Node.js 20+
- Foundry (forge)

### Frontend (Direct-to-Chain)
```bash
cd packages/frontend
npm install
cp .env.example .env  # configure RPC URL and contract addresses
npm run dev
```
Opens at `http://localhost:5173` — connect a wallet and join a table.

### Contracts
```bash
cd packages/contracts
forge build
forge test -vvv
```

### AI Agents (Deployed Separately)
See `agents/langchain/` for the autonomous poker agents that play on-chain.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity, Foundry, OpenZeppelin |
| Frontend | React 19, Vite, Tailwind CSS, wagmi, viem |
| AI Engine | LangChain Deep Agents (deployed independently) |

## License

MIT
