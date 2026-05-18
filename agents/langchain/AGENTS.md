# LangChain Agent — Agent Instructions

## Overview
Autonomous Texas Hold'em poker agent that plays on-chain. Uses a native LangGraph state machine for turn lifecycle orchestration, with a strategy persona prompt, on-chain tools (viem), and checkpoint-based crash recovery.

## Quick Start

Create your env files:

```bash
# Shared defaults (LLM key, RPC, etc.)
cp .env.example .env

# Per-strategy overrides (private key, persona, model)
cp .env.example .env.shark
# Edit .env.shark — set STRATEGY=shark and a unique PRIVATE_KEY
```

Run an agent:

```bash
# Uses .env + .env.<strategy> (strategy defaults to wolf)
bun run start

# Or explicitly
STRATEGY=shark bun run start
```

Or via Docker:

```bash
PRIVATE_KEY=0x... STRATEGY=wolf docker compose up -d
```

## Commands
- `bun run start` — Start the agent loop
- `bun run dev` — Start with watch mode
- `bun run typecheck` — TypeScript check
- `bun run test` — Run test suite
- `bun run lint` — Run oxlint

## Source structure
```
src/
├── agent.ts    # Model factory + submitAction caller
├── config.ts   # Runtime config (private key, LLM, deployment, strategy)
├── graph/      # LangGraph state machine (nodes, edges, types, extract)
├── index.ts    # Entry point — inits wallet, memory, runs graph loop
├── loop/       # Discovery and poller (reused by graph nodes)
├── memory/     # Backends: in-memory / sqlite / postgres
├── prompts/    # Strategy personas + base poker knowledge + phase playbooks
├── strategy/   # Deterministic policy fallback + unit tests
├── tools/      # 10 on-chain tools (import ABIs from @confidential-poker/abis)
└── wallet/     # secp256k1 key + viewer key derivation
skills/         # Agent Skills (bankroll, card-encryption, game-play, etc.)
```

## Environment variables

### `.env` — shared defaults
Place common config here: `LLM_API_KEY`, `LLM_PROVIDER`, `LLM_MODEL`, `MEMORY_BACKEND`, `DATABASE_URL`, etc.

### `.env.<strategy>` — per-agent overrides
Create one per agent personality. Example `.env.shark`:

```
STRATEGY=shark
PRIVATE_KEY=0x...
LLM_MODEL=claude-sonnet-4-6
```

**Merge precedence:** shell env vars > `.env.<strategy>` > `.env`

So `LLM_API_KEY` lives in `.env` as a fallback, and each `.env.<strategy>` only needs `PRIVATE_KEY` + `STRATEGY`.

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
