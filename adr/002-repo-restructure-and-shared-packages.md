# ADR-002: Monorepo Restructure and Shared Package Extraction

## Status

implemented

## Context

The current repository layout is flat and causes significant duplication across the frontend (`packages/frontend/`) and agent (`agents/langchain/`). Both packages independently define contract ABIs, deployment config, card utilities, and viewer-key cryptography. The LangGraph migration (ADR-001) removed ~730 lines of dead code, but the underlying duplication remains untouched.

Current structure:
```
confidential-poker/
├── packages/
│   ├── contracts/     # Foundry — 1,000+ lines of Solidity
│   └── frontend/      # Vite + React — 2,816 lines of inline ABIs, duplicate config
├── agents/
│   └── langchain/     # Bun — 3,160 lines of ABI files, duplicate config
├── skills/
│   ├── human/         # Human-facing guides
│   └── agent/         # Redirects to agents/langchain/skills/
```

## Dead Code Removed in ADR-001 (already done)

| File | Lines | Reason |
|------|-------|--------|
| `agents/langchain/src/loop/game-loop.ts` | 570 | Entire imperative loop replaced by LangGraph |
| `agents/langchain/src/loop/event-watcher.ts` | 159 | Event watching replaced by graph nodes |
| `deepagents` dependency | — | Unused wrapper removed |
| `createAgent` export | ~60 | Dead code, never invoked |

**Total removed**: ~790 lines, 1 dependency.

## Duplication Audit

### 1. Contract ABIs — 5,976 lines duplicated

- **Frontend**: `packages/frontend/src/lib/contracts.ts` — 2,816 lines (inline POKER_GAME_ABI, POKER_FACTORY_ABI, CHIP_TOKEN_ABI)
- **Agent**: `agents/langchain/src/abis/` — 3,160 lines across 5 files (poker-game.ts, poker-factory.ts, chip-token.ts, mock-skl.ts, erc20.ts)
- **Problem**: Same contract ABIs maintained in two formats (frontend inline const, agent separate files). Any contract upgrade requires editing both.

### 2. Deployment Config — duplicated in 2 places

- **Frontend**: `packages/frontend/src/lib/deployment.ts`
- **Agent**: `agents/langchain/src/deployment.ts`
- **Problem**: Identical addresses and RPC URLs. Single source of truth does not exist.

### 3. Card Encoding/Decoding — different representations

- **Frontend**: `packages/frontend/src/lib/types.ts` defines `{suit: "♠", rank: "A"}` objects. `lib/encrypted-cards.ts` decrypts using `window.crypto.subtle`.
- **Agent**: `agents/langchain/src/cards.ts` defines numeric encoding (`rank = encoded & 0x0f`, `suit = (encoded >> 4) & 0x03`).
- **Problem**: Frontend and agent cannot share card logic because representations differ. The agent's `parseCard` is useful for any numeric-encoded card (contract returns uint8). The frontend should be able to convert from numeric to display format.

### 4. Viewer Key Derivation — similar logic, different APIs

- **Frontend**: `packages/frontend/src/lib/viewer-key.ts` — 67 lines. Uses `viem/accounts` (`generatePrivateKey`, `privateKeyToAccount`). Splits uncompressed public key into x/y. Persists to `localStorage`.
- **Agent**: `agents/langchain/src/wallet/viewer-key.ts` — 15 lines. Uses `@noble/curves/secp256k1` directly. Slices public key bytes.
- **Problem**: Two different libraries for the same secp256k1 operation. The agent's version is simpler but less featureful (no persistence). The frontend's version uses browser-only APIs (`window.localStorage`, `window.crypto.subtle`).

### 5. Hand Evaluation — different approaches

- **Frontend**: `packages/frontend/src/lib/hand-evaluator.ts` — 175 lines. Full 7-card evaluator (best 5 from 7), returns `handRank`, `primary`, `secondary`, etc. Used for showdown display.
- **Agent**: `agents/langchain/src/strategy/action-policy.ts` — 200+ lines. Simplified evaluator for policy decisions. Returns score 0–8. Used for deterministic fallback.
- **Problem**: Two evaluators for the same game. The frontend's is more complete. The agent's is tuned for speed/policy. They should at least share the core 5-card evaluation logic.

### 6. Token Formatting — frontend only

- **Frontend**: `packages/frontend/src/lib/token-format.ts` — 46 lines. `formatTokenAmount`, `formatTokenDisplay`, `parseTokenAmount`.
- **Agent**: No equivalent. Uses inline `BigInt` and `.toString()`.
- **Problem**: Agent logs are hard to read (raw wei). Frontend has nice formatting that could be shared.

### 7. Poker Types — frontend only

- **Frontend**: `packages/frontend/src/lib/types.ts` — 120+ lines. Rich types: `GameState`, `Agent`, `TableInfo`, `SidePot`, `Card`, etc.
- **Agent**: Types are scattered across files (`strategy/action-policy.ts`, `loop/poller.ts`, `memory/types.ts`).
- **Problem**: No shared vocabulary. The agent and frontend describe the same domain with different types.

## Constraints

- Must not break existing build scripts (`bun run dev:frontend`, `bun run build:frontend`, `bun run test:contracts`)
- Must preserve Bun runtime for agent, Vite for frontend
- Must preserve Foundry for contracts
- Shared packages must be TypeScript with `tsc --noEmit` passing
- All changes must pass quality gates from AGENTS.md

## Options Considered

### Option A: Extract shared packages into `packages/`

Create 3–4 shared packages under `packages/`:
- `packages/abis` — Contract ABIs as `as const` exports
- `packages/config` — Deployment config
- `packages/cards` — Card encoding/decoding (numeric → display)
- `packages/poker-types` — Shared TypeScript types

- **Pros**: Eliminates duplication. Contract upgrades edit one file. Consistent types across frontend and agent. Clean monorepo boundary.
- **Cons**: Moderate setup effort (workspace config, package.json for each shared package). Bun workspaces or path imports needed.
- **Effort estimate**: 1 day.
- **Risks**: Workspace resolution issues. Both frontend (npm/pnpm via lockfile) and agent (Bun) need to resolve shared packages.

### Option B: Restructure directories only, no shared packages yet

Move directories to the new layout first, keep duplication, extract later:
- `apps/web` ← `packages/frontend`
- `contracts` ← `packages/contracts`
- `packages/` remains empty or minimal

- **Pros**: Immediate directory hygiene. Less risky than extraction + move simultaneously.
- **Cons**: Duplication remains. Second pass required.
- **Effort estimate**: 2–3 hours.
- **Risks**: Path references in build configs (Vite, Foundry, Docker) need updating.

### Option C: Do both — restructure + extract in one pass

Combine Option A and B. Restructure directories and extract shared packages simultaneously.

- **Pros**: Final state achieved in one PR. No intermediate duplication.
- **Cons**: Large surface area. Harder to review and roll back. Higher risk.
- **Effort estimate**: 2 days.
- **Risks**: If workspace resolution fails, both frontend and agent are broken simultaneously.

### Option D: Do Nothing

- **Pros**: Zero effort.
- **Cons**: Duplication grows. Contract upgrades are error-prone. Onboarding cost increases.

## Proposal

Adopt **Option A**: Restructure directories and extract shared packages in one coordinated pass. The risk is manageable because the shared packages are pure TypeScript constants/types with no runtime dependencies beyond `viem` (already used by both sides).

### Target Structure

```
confidential-poker/
├── adr/                   # Architecture Decision Records
├── apps/
│   └── web/               # Vite + React frontend (was packages/frontend)
├── contracts/             # Foundry Solidity (was packages/contracts)
├── packages/
│   ├── abis/              # Contract ABIs (shared)
│   ├── config/            # Deployment config + chain definition (shared)
│   ├── cards/             # Card encoding/decoding (shared)
│   ├── poker-types/       # Shared TypeScript types (shared)
│   └── token-utils/       # Token formatting (shared)
├── agents/
│   └── langchain/         # Bun agent
├── skills/
│   ├── human/
│   └── agent/
├── AGENTS.md
├── package.json           # Root workspace config
└── README.md
```

### Shared Package Details

1. **`packages/abis`** — Exports `POKER_GAME_ABI`, `POKER_FACTORY_ABI`, `CHIP_TOKEN_ABI`, `ERC20_ABI` as `as const`. Both frontend and agent import from here. Removes 5,976 lines of duplication.

2. **`packages/config`** — Exports `DEPLOYMENT_CONFIG` and `SKALE_CHAIN` (viem `Chain` definition). Both frontend and agent import from here. Removes 2× deployment config files.

3. **`packages/cards`** — Exports:
   - `parseCard(encoded: number): Card | null` (from agent's cards.ts)
   - `decodeCard(encoded: number): string`
   - `toDisplayCard(card: Card): { suit: "♠" | "♥" | "♦" | "♣", rank: "2" | ... | "A" }` (bridge to frontend format)
   - `fromDisplayCard(display: { suit, rank }): number` (reverse)

4. **`packages/poker-types`** — Shared domain types:
   - `Card`, `Suit`, `Rank`, `GamePhase`, `PokerAction`, `PlayerStatus`
   - `TableInfo`, `GameState` (minimal, without UI-specific fields like `color`, `emoji`)

5. **`packages/token-utils`** — Exports `formatTokenAmount`, `formatTokenDisplay`, `parseTokenAmount`.

### Hand Evaluation Unification

The frontend's `hand-evaluator.ts` is more complete. After restructuring, the agent's `strategy/action-policy.ts` should import the core `evaluateBestHand` from a shared location (either `packages/cards` or a new `packages/hand-evaluator`). The agent's policy layer will still wrap it with its own decision logic, but the evaluation engine will be shared.

### Viewer Key Unification

The agent's `wallet/viewer-key.ts` is simpler and framework-agnostic. After restructuring, the frontend should import the core `deriveViewerKey` from a shared `packages/crypto` package, then layer `localStorage` persistence and `generatePrivateKey` on top. This removes the `@noble/curves` vs `viem/accounts` duplication.

### Root Workspace Config

Bun workspaces in root `package.json`:
```json
{
  "workspaces": ["apps/*", "packages/*", "agents/*"]
}
```

## Impact

- `packages/frontend/` → `apps/web/` — Vite config, tsconfig path aliases, Docker, CI/CD paths
- `packages/contracts/` → `contracts/` — Foundry config, broadcast paths, scripts
- `agents/langchain/src/abis/` → deleted, imports from `packages/abis`
- `agents/langchain/src/deployment.ts` → deleted, imports from `packages/config`
- `agents/langchain/src/cards.ts` → deleted, imports from `packages/cards`
- `packages/frontend/src/lib/contracts.ts` → deleted, imports from `packages/abis`
- `packages/frontend/src/lib/deployment.ts` → deleted, imports from `packages/config`
- `packages/frontend/src/lib/types.ts` → slimmed, imports base types from `packages/poker-types`

## Test Plan

1. After restructure, `bun run test:contracts` still passes in `contracts/`
2. After restructure, `bun run build:frontend` still passes in `apps/web/`
3. After restructure, `bun test` still passes in `agents/langchain/`
4. TypeScript compiles in all shared packages (`tsc --noEmit`)
5. No regression in agent runtime (integration test against local chain)

## Rollback Plan

- Git commit before restructure. Rollback is `git checkout` or `git revert`.
- Shared packages are additive; if workspace resolution breaks, fall back to relative path imports (`../../packages/abis`) as a temporary fix.

## Decision Log

| Date | Actor | Action |
|------|-------|--------|
| 2026-05-18 | Agent | Drafted ADR |
| 2026-05-18 | Human | Approved for implementation |
| 2026-05-18 | Agent | Implemented restructure: moved frontend to apps/web, contracts to /contracts, extracted 5 shared packages |
