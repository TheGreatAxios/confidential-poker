# ADR-001: Migrate Agent Orchestration from deepagents to Native LangGraph

## Status

implemented

## Context

The `agents/langchain` package currently uses `deepagents` as a wrapper around LangChain tooling. The actual game loop (`src/loop/game-loop.ts`) is ~400 lines of imperative code with nested conditionals, manual tool call extraction, fallback chains, and session recovery logic. The exported `createAgent` (full DeepAgent with all 10 tools) is dead code — the runtime loop uses a stripped-down `model.bindTools([submitAction])` instead.

LangGraph is already a declared dependency (`@langchain/langgraph@^1.3.0`) but is unused.

## Constraints

- Must not break on-chain interaction behavior (same RPC calls, same transaction flow)
- Must preserve deterministic policy fallback (`strategy/action-policy.ts`)
- Must preserve persona-driven prompts and memory backends
- Must not increase per-turn inference cost
- Must maintain Bun runtime compatibility

## Options Considered

### Option A: Migrate to native LangGraph
- **Pros:** Explicit state machine via nodes/edges; built-in checkpoint resumption; parallel tool invocation; cleaner error routing; removes unused `deepagents` dependency
- **Cons:** Moderate migration effort (~1–2 days); test suite must be built from scratch (agent package currently has zero tests)
- **Effort estimate:** 1–2 days focused work + test suite creation
- **Risks:** Checkpoint schema changes during iteration; need to validate graph resumption after crash

### Option B: Keep deepagents, refactor the imperative loop only
- **Pros:** Smaller surface area; less dependency churn
- **Cons:** Still dependent on an opaque wrapper; game loop remains a hidden state machine; no built-in observability
- **Effort estimate:** 1 day
- **Risks:** Does not solve maintainability root cause

### Option C: Do Nothing
- **Pros:** Zero effort
- **Cons:** Technical debt accumulates; onboarding cost increases; cannot leverage LangSmith traces or graph-based observability

## Proposal

Adopt **Option A**: replace `deepagents` usage with a native LangGraph state machine. The graph will model the game loop as explicit nodes (Discover/Join → Wait → Gather State → Decide → Submit → Settle) with conditional edges for error handling and fallback chains. The `createAgent` dead code will be removed. All existing tools, prompts, memory backends, and the deterministic policy layer will be reused as-is.

## Impact

- `agents/langchain/src/agent.ts` — rewrite to export a LangGraph compiled graph instead of DeepAgent
- `agents/langchain/src/loop/game-loop.ts` — port logic into graph nodes/edges; file likely removed or significantly reduced
- `agents/langchain/package.json` — remove `deepagents` dependency
- `agents/langchain/` — new test suite required (currently zero tests)

## Test Plan

1. Unit-test each graph node in isolation (mocked viem client)
2. Integration-test the full graph against a local Anvil/SKALE testnet instance
3. Validate checkpoint save/resume mid-hand
4. Maintain >80% coverage across `agents/langchain/src`

## Rollback Plan

- Pin the previous working commit before merging
- `deepagents` removal is a single dependency line; revertable in minutes if critical

## Decision Log

| Date | Actor | Action |
|------|-------|--------|
| 2026-05-18 | Agent | Drafted ADR |
| 2026-05-18 | Human | Approved for implementation |
| 2026-05-18 | Agent | Implemented graph architecture, removed deepagents, added tests |
