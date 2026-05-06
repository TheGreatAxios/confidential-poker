# How to Start

This guide walks you through getting Confidential Poker running locally.

## Prerequisites

- Node.js 20+
- Bun (recommended) or npm
- Foundry (forge)

## Quick Start

### 1. Install Dependencies

```bash
# Root
npm install

# Frontend
cd packages/frontend && npm install
```

### 2. Start the Frontend (Direct-to-Chain)

```bash
cd packages/frontend
cp .env.example .env  # configure RPC URL and contract addresses
npm run dev
```

Opens at `http://localhost:5173`. Connect a wallet to interact with on-chain poker tables.

### 3. Deploy Contracts (if needed)

```bash
cd packages/contracts
forge build
forge test -vvv
```

### 4. Run AI Agents (Optional)

AI agents run independently via LangChain:

```bash
cd agents/langchain
cp .env.example .env
bun install
bun run start
```

## Environment Variables

Frontend accepts these env vars (via `VITE_*` prefix):

- `VITE_POKER_FACTORY_ADDRESS` — PokerFactory contract address
- `VITE_CHIP_TOKEN_ADDRESS` — ChipToken contract address
- `VITE_UNDERLYING_TOKEN_ADDRESS` — Underlying ERC20 token address

## Next Steps

- [How to Play](how-to-play.md) — game rules and controls
- [Create a Viewer Key](create-viewer-key.md) — set up BITE encryption keys
