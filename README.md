# AI Poker Night

> Live Texas Hold'em on SKALE. AI agents with unique personalities play against each other — and you. All game state is on-chain. The frontend talks directly to contracts — no backend required.

## Architecture

```
confidential-poker/
├── packages/
│   ├── contracts/     # Foundry — Solidity (PokerGame, PokerFactory, ChipToken, MockSKL)
│   └── frontend/      # Vite + React — live poker table UI, direct-to-chain via wagmi/viem
├── agents/
│   └── langchain/     # LangChain Deep Agents — autonomous poker agents (Bun runtime)
│       ├── compose.yml            # single-agent Docker Compose
│       ├── Dockerfile
│       ├── skills/                # Agent Skills (agentskills.io)
│       └── src/
│           ├── tools/    # 10 on-chain tools
│           ├── prompts/  # 6 strategy personas (shark, fox, owl, bull, cat, wolf)
│           ├── memory/   # memory / sqlite / postgres backends
│           ├── wallet/   # secp256k1 key management + viewer key derivation
│           └── loop/     # autonomous game loop (event watcher + poller)
└── skills/              # human-facing guides (how-to-play, create-wallet, create-viewer-key)
```

## Prerequisites

- Node.js 20+ / Bun
- Docker (for agents)
- Foundry (for contract work)
- A WalletConnect project ID (free at https://cloud.walletconnect.com)

---

## 1. Deploy Contracts

```bash
cd packages/contracts
forge build

export RPC_URL=https://base-sepolia-testnet.skalenodes.com/v1/base-testnet
export PRIVATE_KEY=0x...
forge script script/Deploy.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
```

The script logs:
- `MockSKL` — underlying ERC20 token
- `ChipToken` — wrappable chip token
- `PokerFactory` — table factory

Note these addresses — you need them for every other component.

---

## 2. Run the Frontend

```bash
cd packages/frontend
npm install

# Configure (use the addresses from step 1)
cp .env.example .env
# Edit .env as needed

npm run dev
# Opens at http://localhost:5173
```

Connect a wallet, browse tables, join one. All reads and writes go directly to the SKALE chain via wagmi/viem.

### Production build

```bash
npm run build     # outputs to dist/
# Deploy dist/ to any static host (Vercel, Netlify, Cloudflare Pages, S3)
```

---

## 3. Run AI Agents

Each agent is a single `bun run src/index.ts` process with environment config. Run as many as you want — one per private key.

### Using Docker (recommended)

```bash
cd agents/langchain

# Create a .env for the agent
cat > .env << 'EOF'
PRIVATE_KEY=0x...
LLM_API_KEY=sk-ant-...
STRATEGY=wolf
EOF

# Start one agent
docker compose up -d
# Starts a single container. Run again with different .env for more agents.
```

### Using Bun directly

```bash
cd agents/langchain
cp .env.example .env
# Fill in PRIVATE_KEY, LLM_API_KEY, STRATEGY
bun run start
```

### Available strategies

| Env value | Personality | Style |
|-----------|-------------|-------|
| `shark` | Aggressive | Calculated, bluffs rarely but hard |
| `fox` | Tricky | Semi-bluffs often, exploits weaknesses |
| `owl` | Tight | Mathematical, only premium hands |
| `bull` | Maniac | Raises constantly, forces decisions |
| `cat` | Unpredictable | Mixed strategy, hard to read |
| `wolf` | Balanced | GTO-style, adapts to opponents |

Each strategy is a LangChain prompt persona at `agents/langchain/src/prompts/personas/`.

---

## 4. Test the Full System

1. Deploy contracts (step 1)
2. Open the frontend (step 2), connect a wallet, join a table
3. Fund and deposit chips into the ChipToken contract via the Join Panel
4. Start one or more agents (step 3) — each discovers the table via `PokerFactory.getAllTables()`, sits down, and plays autonomously
5. Play as the human while agents act via their LangChain loops
6. Watch events on the [block explorer](https://base-sepolia-testnet-explorer.skalenodes.com/)

### Validation

| What | How |
|------|-----|
| Game state renders | Connect — verify phase, pot, community cards update |
| Human can act | Fold/check/call/raise sends a tx, contract advances |
| Agents respond | Watch for agent transactions on the explorer |
| Hand resolves | Winner event fires, pot is distributed |
| New hand | `dealNewHand` advances to next round |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.28, Foundry, OpenZeppelin, SKALE RNG, BITE |
| Frontend | React 19, Vite, Tailwind CSS 4, Framer Motion, wagmi, viem |
| AI Engine | LangChain Deep Agents, Anthropic/OpenAI/Google LLMs |
| Runtime | Bun |

## AI Agents

The `packages/server/` package (in-memory game engine with hardcoded 6 agents) has been removed. All AI agents now run independently via `agents/langchain/` and play directly on-chain through contract calls. See `agents/langchain/` for details.

## License

MIT
