# AI Poker Night

> Live Texas Hold'em on SKALE. AI agents with unique personalities play against each other — and you. All game state is on-chain. The frontend talks directly to contracts — no backend required.

## Architecture

```
confidential-poker/
├── adr/               # Architecture Decision Records
├── apps/
│   └── web/           # Vite + React — live poker table UI, direct-to-chain via wagmi/viem
├── contracts/         # Foundry — Solidity (PokerGame, PokerFactory, ChipToken, MockSKL)
├── packages/
│   ├── abis/          # Shared contract ABIs
│   ├── cards/         # Card encoding/decoding + hand evaluation
│   ├── config/        # Deployment config + chain definition
│   ├── poker-types/   # Shared domain TypeScript types
│   └── token-utils/   # Token formatting utilities
├── agents/
│   └── langchain/     # LangGraph state machine — autonomous poker agents (Bun runtime)
│       ├── compose.yml            # single-agent Docker Compose
│       ├── Dockerfile
│       ├── skills/                # Agent Skills (agentskills.io)
│       └── src/
│           ├── graph/  # LangGraph nodes, edges, state, and orchestration
│           ├── tools/    # 10 on-chain tools
│           ├── prompts/  # 6 strategy personas (shark, fox, owl, bull, cat, wolf)
│           ├── strategy/ # deterministic policy fallback
│           ├── memory/   # memory / sqlite / postgres backends
│           ├── wallet/   # secp256k1 key management + viewer key derivation
│           └── loop/     # table discovery and polling utilities
└── skills/              # human-facing guides (how-to-play, create-wallet, create-viewer-key)
```

## Prerequisites

- Bun (runtime + package manager)
- Foundry (`forge`, `cast`) for contract work
- Docker (optional, for agent containers)
- LLM API key (Anthropic, OpenAI, Google, etc.)
- WalletConnect project ID (optional, free at https://cloud.walletconnect.com)

## Setup

```bash
# Install all workspace dependencies across apps/, packages/, and agents/
bun install
```

Bun workspaces (configured in root `package.json`) resolve workspace packages (`@confidential-poker/*`) and install everything in one shot.

---

## 1. Deploy Contracts

```bash
cd contracts
forge build

export RPC_URL=https://base-sepolia-testnet.skalenodes.com/v1/base-testnet
export PRIVATE_KEY=0x...
forge script script/Deploy.s.sol --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast
```

Or from root: `bun run deploy:contracts` — auto-extracts addresses and syncs shared packages.

For SKALE deployments with legacy transactions:
```bash
bun run deploy:contracts -- --legacy --slow --account bite-deployer
```

The script deploys:
- `MockSKL` — underlying ERC20 token
- `ChipToken` — wrappable chip token
- `PokerFactory` — table factory

---

## 2. Frontend

```bash
cp apps/web/.env.example apps/web/.env
# Edit .env — add VITE_WALLETCONNECT_PROJECT_ID if you have one

# Dev server
bun run dev:frontend
# Opens at http://localhost:5173
```

Connect a wallet, browse tables, join one. All reads and writes go directly to the SKALE chain via wagmi/viem.

### Production build

```bash
bun run build:frontend
# Deploy apps/web/dist/ to any static host
```

---

## 3. Run AI Agents

### Generate wallets

Each agent needs a unique funded wallet. Generate them automatically:

```bash
cd agents/langchain

# Generate 6 wallets + write .env.* files
bun run gen:wallets 6 --write

# Or print only
bun run gen:wallets 3
```

SKALE Base uses a credit system for gas — agents auto-claim via browser at https://base-sepolia-faucet.skale.space when low

### Configure

```bash
cd agents/langchain
cp .env.example .env          # shared defaults: LLM_API_KEY, LLM_PROVIDER, etc.
# .env.* files are auto-created by gen:wallets --write
# Edit .env — add your LLM_API_KEY
```

**Env merge precedence:** shell env vars > `.env.<strategy>` > `.env`

### Run

```bash
# Per-strategy — loads .env + .env.<strategy>
bun run agent:langchain:wolf
bun run agent:langchain:shark
bun run agent:langchain:fox
bun run agent:langchain:owl
bun run agent:langchain:bull
bun run agent:langchain:cat

# Shell overrides always win
PRIVATE_KEY=0x... LLM_API_KEY=sk-... bun run agent:langchain:shark
```

Run multiple terminals for a full table.

### Docker

```bash
cd agents/langchain
PRIVATE_KEY=0x... LLM_API_KEY=sk-... STRATEGY=wolf docker compose up -d
```

### Strategies

| Script | Personality | Style |
|--------|-------------|-------|
| `agent:langchain:shark` | Aggressive | Calculated, bluffs rarely |
| `agent:langchain:fox` | Tricky | Semi-bluffs, exploits |
| `agent:langchain:owl` | Tight | Mathematical, premium hands |
| `agent:langchain:bull` | Maniac | Raises constantly |
| `agent:langchain:cat` | Unpredictable | Mixed strategy |
| `agent:langchain:wolf` | Balanced | GTO-style |

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
| AI Engine | LangGraph, Anthropic/OpenAI/Google LLMs |
| Runtime | Bun |

## AI Agents

The `packages/server/` package (in-memory game engine with hardcoded 6 agents) has been removed. All AI agents now run independently via `agents/langchain/` and play directly on-chain through contract calls. See `agents/langchain/` for details.

## License

MIT
