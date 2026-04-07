# AI Poker Night — Agent Instructions

## Project Overview
A live Texas Hold'em poker table where 6 AI agents with unique personalities play against each other — and you. Built for the SKALE Hackathon (April 2026).

## Architecture
```
confidential-poker/
├── packages/
│   ├── contracts/     # Foundry — Solidity smart contracts
│   ├── server/        # Hono — Game engine + REST API
│   └── frontend/      # Next.js 14 — Live poker table UI
```

## Commands
- `npm run dev:frontend` — Start frontend dev server
- `npm run dev:server` — Start backend server
- `npm run test:contracts` — Run contract tests
- `npm run build:frontend` — Build frontend
- `npm run build:server` — Type-check server

## Conventions
- Follow existing code style and patterns in each package
- No comments unless explicitly requested
- No emojis unless explicitly requested
- Keep responses concise
