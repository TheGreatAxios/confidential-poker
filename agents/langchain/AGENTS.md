# LangChain Agent — Agent Instructions

## Overview
Autonomous Texas Hold'em poker agent that plays on-chain. Uses LangChain Deep Agents with a strategy persona prompt, on-chain tools (viem), and a game loop that polls/watches for turns.

## Quick Start

```bash
cp .env.example .env
# Fill in PRIVATE_KEY, LLM_API_KEY, FACTORY_ADDRESS, CHIP_TOKEN_ADDRESS, STRATEGY
bun run start
```

Or via Docker:

```bash
docker compose up -d
# Configure via .env or environment variables
```

## Commands
- `bun run start` — Start the agent loop
- `bun run dev` — Start with watch mode
- `bun run typecheck` — TypeScript check

## Source structure
```
src/
├── abis/       # Contract ABIs (chip-token, erc20, poker-factory, poker-game)
├── agent.ts    # createAgent — wires persona prompt + tools into a Deep Agent
├── config.ts   # Environment config (private key, LLM, RPC, strategy)
├── index.ts    # Entry point — inits wallet, memory, runs game loop
├── loop/       # Autonomous loop
│   ├── discovery.ts     # Discover/create tables from PokerFactory
│   ├── event-watcher.ts # Watch for TurnChanged events
│   ├── game-loop.ts     # Main loop: turn detection → tool invocation
│   └── poller.ts        # Fallback polling when events don't fire
├── memory/     # Backend implementations (memory / sqlite / postgres)
├── prompts/    # Strategy personas + base poker knowledge
│   └── personas/  # shark, fox, owl, bull, cat, wolf, custom
├── tools/      # 10 on-chain tools (check-balance, list-tables, join-table, submit-action, etc.)
└── wallet/     # secp256k1 key + viewer key derivation
skills/         # Agent Skills (agentskills.io) — bankroll, card-encryption, game-play, etc.
```

## Environment variables
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PRIVATE_KEY` | Yes | — | Agent wallet private key |
| `LLM_API_KEY` | Yes | — | API key for the LLM provider |
| `FACTORY_ADDRESS` | Yes | — | PokerFactory contract address |
| `CHIP_TOKEN_ADDRESS` | Yes | — | ChipToken contract address |
| `RPC_URL` | No | SKALE Base Sepolia | Chain RPC endpoint |
| `CHAIN_ID` | No | 324705682 | Chain ID |
| `STRATEGY` | No | `wolf` | Persona (shark/fox/owl/bull/cat/wolf/custom) |
| `LLM_PROVIDER` | No | `anthropic` | anthropic, openai, google-genai, openrouter, xai |
| `LLM_MODEL` | No | `claude-sonnet-4-6` | Model name |
| `MEMORY_BACKEND` | No | `memory` | memory, sqlite, or postgres |
| `POLL_INTERVAL_MS` | No | 5000 | Poll interval for fallback polling |

## Docker

The `compose.yml` builds and runs a single agent instance. All config comes from environment — run multiple instances with different keys/strategies:

```bash
PRIVATE_KEY=0x... STRATEGY=shark docker compose up -d
PRIVATE_KEY=0x... STRATEGY=fox  docker compose up -d
```

## Personas

| Strategy | Archetype | Personality |
|----------|-----------|-------------|
| `shark` | 🦈 Aggressive | Calculated, bluffs rarely |
| `fox` | 🦊 Tricky | Semi-bluffs, exploits weaknesses |
| `owl` | 🦉 Tight | Mathematical, premium hands |
| `bull` | 🐂 Maniac | Raises constantly |
| `cat` | 🐱 Unpredictable | Mixed strategy, hard to read |
| `wolf` | 🐺 Balanced | GTO-style, adapts to opponents |

## Conventions
- No comments unless explicitly requested
- No emojis unless explicitly requested
- Keep responses concise
