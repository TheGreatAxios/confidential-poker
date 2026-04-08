# How to Start

This guide walks you through getting Confidential Poker running locally.

## Prerequisites

- Node.js 20+
- Bun (recommended) or npm

## Quick Start

### 1. Install Dependencies

```bash
# Root
npm install

# Frontend
cd packages/frontend && npm install

# Server
cd packages/server && npm install
```

### 2. Start the Server

```bash
cd packages/server
npm run dev
```

The server runs on `http://localhost:3001`.

### 3. Start the Frontend (Demo Mode)

```bash
cd packages/frontend
npm run dev
```

Opens at `http://localhost:3000`. Demo mode works standalone with mock data — no blockchain required.

### 4. Play On-Chain

To play on the actual SKALE Base Sepolia testnet:

1. Generate wallets:
```bash
cd packages/server
npm run gen-wallets
```

2. Run the game:
```bash
npm run run-game base-sepolia
```

3. Or run the agent loop for autonomous play:
```bash
npm run run-agent base-sepolia
```

## Environment Variables

Server accepts these optional env vars:

- `PORT` — server port (default: 3001)
- `RPC_URL` — blockchain RPC URL
- `PRIVATE_KEY` — wallet private key for on-chain transactions
- `BITE_ENABLED` — enable BITE encryption (default: true)

## Next Steps

- [How to Play](how-to-play.md) — game rules and controls
- [Create a Wallet](create-wallet.md) — generate a new wallet
- [Create a Viewer Key](create-viewer-key.md) — set up BITE encryption keys