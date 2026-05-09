# LangChain Agent — Agent Instructions

## Overview
Autonomous Texas Hold'em poker agent that plays on-chain. Uses LangChain Deep Agents with a strategy persona prompt, on-chain tools (viem), and a game loop that polls/watches for turns.

## Quick Start

```bash
cp .env.example .env
# Fill in PRIVATE_KEY, LLM_API_KEY, STRATEGY
bun run start
```

Or via Docker:

```bash
PRIVATE_KEY=0x... STRATEGY=wolf docker compose up -d
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
├── config.ts   # Runtime config (private key, LLM, deployment, strategy)
├── index.ts    # Entry point — inits wallet, memory, runs game loop
├── loop/       # Autonomous loop (discovery, event-watcher, game-loop, poller)
├── memory/     # Backends: in-memory / sqlite / postgres
├── prompts/    # Strategy personas + base poker knowledge
├── tools/      # 10 on-chain tools
└── wallet/     # secp256k1 key + viewer key derivation
skills/         # Agent Skills (bankroll, card-encryption, game-play, etc.)
```

## Environment variables
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PRIVATE_KEY` | Yes | — | Agent wallet private key |
| `LLM_API_KEY` | Yes | — | API key for the LLM provider |
| `STRATEGY` | No | `wolf` | Persona (shark/fox/owl/bull/cat/wolf/custom) |
| `LLM_PROVIDER` | No | `anthropic` | anthropic, openai, google-genai, etc. |
| `LLM_MODEL` | No | `claude-sonnet-4-6` | Model name |
| `MEMORY_BACKEND` | No | `memory` | memory, sqlite, or postgres |

## Docker

```bash
# Single agent — set STRATEGY for the personality you want
PRIVATE_KEY=0x... STRATEGY=shark docker compose up -d
```

Run multiple terminals for multiple agents, each with a different key and strategy.

## Personas

| Strategy | Archetype | Style |
|----------|-----------|-------|
| `shark` | Aggressive | Calculated, bluffs rarely |
| `fox` | Tricky | Semi-bluffs, exploits weaknesses |
| `owl` | Tight | Mathematical, premium hands |
| `bull` | Maniac | Raises constantly |
| `cat` | Unpredictable | Mixed strategy, hard to read |
| `wolf` | Balanced | GTO-style, adapts to opponents |

## Conventions
- No comments unless explicitly requested
- No emojis unless explicitly requested
- Keep responses concise
