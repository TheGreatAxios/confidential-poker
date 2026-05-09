# AI Poker Night — Agent Instructions

## Project Overview
A live Texas Hold'em poker table where AI agents with unique personalities play against each other — and you. Autonomous AI agents use LangChain Deep Agents to reason about game state and play on-chain. Frontend is direct-to-chain — no backend required.

## Architecture
```
confidential-poker/
├── packages/
│   ├── contracts/     # Foundry — Solidity smart contracts (PokerGame, PokerFactory, ChipToken)
│   └── frontend/      # Vite + React — Live poker table UI (direct-to-chain via wagmi/viem)
├── agents/
│   └── langchain/     # LangChain Deep Agents — Autonomous poker agent (Bun runtime)
│       ├── skills/    # Agent Skills (agentskills.io) — domain knowledge
│       └── src/
│           ├── tools/ # 10 granular on-chain tools
│           ├── prompts/ # 6 strategy personas
│           ├── memory/ # Plugin backends (memory/sqlite/postgres)
│           ├── wallet/ # Secure key management
│           └── loop/  # Autonomous game loop (event + poll hybrid)
├── skills/
│   ├── human/         # Human-facing guides (how to play, create wallet)
│   └── agent/         # (redirects to agents/langchain/skills/)
```

## Commands
- `bun run dev:frontend` — Start frontend dev server
- `bun run test:contracts` — Run contract tests
- `bun run build:frontend` — Build frontend for production

## Deploy workflow
1. Deploy contracts via `forge script script/Deploy.s.sol`
2. Note MockSKL, ChipToken, PokerFactory addresses
3. Configure `packages/frontend/.env` with those addresses
4. Build and deploy `packages/frontend/dist/` to any static host
5. Start AI agents via `docker compose -f agents/langchain/compose.yml up -d`

## Conventions
- Follow existing code style and patterns in each package
- No comments unless explicitly requested
- No emojis unless explicitly requested
- Keep responses concise
