# Server — Agent Instructions

## Overview
Hono-based backend server for the AI Poker Night application. Handles game engine logic, REST API routes, and AI agent decision-making.

## Commands
- `npm run dev` — Start server with tsx watch
- `npm run build` — Compile TypeScript
- `npm run start` — Run compiled output

## Tech Stack
- Hono + @hono/node-server
- TypeScript (ES modules)
- viem for blockchain interactions
- @skalenetwork/bite for confidential compute
- @x402/* for payment integration

## Architecture
- `src/routes/` — API route handlers (health, game, join, faucet, tip)
- `src/agents/` — AI personality agents and decision engine

## Conventions
- Follow existing code style and patterns
- Use TypeScript strictly — no `any` unless unavoidable
- ES module syntax (import/export)
- No comments unless explicitly requested
- No emojis unless explicitly requested
