# AI Poker Night — Agent Instructions

## Project Overview
A live Texas Hold'em poker table where AI agents with unique personalities play against each other — and you. Autonomous AI agents use LangChain Deep Agents to reason about game state and play on-chain. Frontend is direct-to-chain — no backend required.

## Architecture
```
confidential-poker/
├── adr/               # Architecture Decision Records — all changes go through here
├── apps/
│   └── web/           # Vite + React — Live poker table UI (direct-to-chain via wagmi/viem)
├── contracts/         # Foundry — Solidity smart contracts (PokerGame, PokerFactory, ChipToken)
├── packages/
│   ├── abis/          # Shared contract ABIs
│   ├── cards/         # Card encoding/decoding + hand evaluation
│   ├── config/        # Deployment config + chain definition
│   ├── poker-types/   # Shared domain TypeScript types
│   └── token-utils/   # Token formatting utilities
├── agents/
│   └── langchain/     # LangGraph state machine — Autonomous poker agent (Bun runtime)
│       ├── skills/    # Agent Skills (agentskills.io) — domain knowledge
│       └── src/
│           ├── graph/ # LangGraph nodes, edges, state, and orchestration
│           ├── tools/ # 10 granular on-chain tools
│           ├── prompts/ # 6 strategy personas + phase playbooks
│           ├── strategy/ # Deterministic policy fallback
│           ├── memory/ # Plugin backends (memory/sqlite/postgres)
│           ├── wallet/ # Secure key management
│           └── loop/  # Table discovery and polling utilities
├── skills/
│   ├── human/         # Human-facing guides (how to play, create wallet)
│   └── agent/         # (redirects to agents/langchain/skills/)
```

## Commands

### Contracts
- `bun run test:contracts` — Run Foundry test suite
- `bun run deploy:contracts` — Deploy contracts + auto-extract addresses + sync shared packages

### Frontend
- `bun run dev:frontend` — Start Vite dev server at localhost:5173
- `bun run build:frontend` — Production build

### Agents

#### 1. Generate wallets

```bash
cd agents/langchain

# Generate 6 wallets + auto-write .env.* files
bun run gen:wallets 6 --write

# Or print only (manual copy-paste)
bun run gen:wallets 3
```

#### 2. Fund wallets

- SKALE Base uses a credit system for gas — agents auto-claim via browser at https://base-sepolia-faucet.skale.space when low
- Table creation is free (factory pays from its own balance)
- MockSKL tokens are auto-claimed by the agent via the built-in contract faucet

#### 3. Configure env files

```bash
cd agents/langchain
cp .env.example .env          # shared defaults: LLM_API_KEY, LLM_PROVIDER, etc.
# .env.* files are auto-created by gen:wallets --write
# Edit .env — add your LLM_API_KEY
```

Run from root. Required env: `PRIVATE_KEY`, `LLM_API_KEY` (auto-loaded from `.env` + `.env.<strategy>`).

```bash
# Generic — loads .env + .env.wolf (default strategy)
bun run agent:langchain

# Per-strategy shorthands — loads .env + .env.<strategy>
bun run agent:langchain:wolf
bun run agent:langchain:shark
bun run agent:langchain:fox
bun run agent:langchain:owl
bun run agent:langchain:bull
bun run agent:langchain:cat

# Shell overrides take precedence over env files
PRIVATE_KEY=0x... LLM_API_KEY=sk-... bun run agent:langchain:shark
```

## Deploy workflow
1. **Deploy + sync everything**: `bun run deploy:contracts`
   - Runs `forge script` to deploy contracts
   - Auto-extracts addresses from broadcast JSON
   - Auto-rebuilds ABIs via `forge build`
   - Syncs `packages/config/src/index.ts` and `packages/abis/src/*.ts`
   - Optional args: `bun run deploy:contracts <chainId> <rpcUrl>`
   - Pass extra forge flags after `--`: `bun run deploy:contracts -- --legacy --slow --account bite-deployer`
2. Configure `apps/web/.env` with new addresses if needed
3. Build and deploy `apps/web/dist/` to any static host
4. Start AI agents via `PRIVATE_KEY=... bun run agent:langchain:wolf`

## Conventions
- Follow existing code style and patterns in each package
- No comments unless explicitly requested
- No emojis unless explicitly requested
- Keep responses concise

---

## Change Process (all features, bugs, and refactors)

Every non-trivial change must go through the ADR process. No code is written until the ADR is approved by a human.

### Workflow

```
define -> plan -> approve -> test/build setup -> code -> pass tests -> ship
```

1. **Define** — Open a new ADR in `adr/` using `000-template.md`. State the problem, constraints, and success criteria.
2. **Plan** — Deeply explore all viable options. List trade-offs, risks, and effort estimates for each side. The ADR must present a clear proposal with rationale.
3. **Approve** — Submit the ADR for human review. Explicit approval is required before any implementation begins.
4. **Test / Build Setup** — Before writing production code, ensure the test infrastructure and build pipeline are ready to validate the change.
5. **Code** — Implement against the approved ADR. Document any deviation from the plan in the ADR decision log.
6. **Pass Tests** — All quality gates must pass before merge.
7. **Ship** — Merge only after human sign-off on the implementation.

### Quality Gates (must pass for every change)

- **Test suite** passes in all affected packages
- **Test coverage** stays above 80% in all affected packages; create tests as needed to maintain this
- **Linting** — `oxlint` passes (or is added and passes) in all affected packages
- **Typecheck** — `tsc --noEmit` passes in all affected packages
- **Build** — passes if the package has a build step
- **Documentation** — updated if the change affects user-facing behavior, architecture, or deployment workflow

### Triage Rule

When a bug or feature request arrives, the first action is always to open or update an ADR. Exploration of root cause and options happens inside the ADR, not in code.

---

## Active ADRs

| # | Title | Status | Date |
|---|-------|--------|------|
| 001 | LangGraph Migration for Agent Orchestration | implemented | 2026-05-18 |
| 002 | Monorepo Restructure and Shared Package Extraction | implemented | 2026-05-18 |
