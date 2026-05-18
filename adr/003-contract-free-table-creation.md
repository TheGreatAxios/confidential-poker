# ADR-003: Factory-Paid Table Creation + Auto-Shutdown on Empty

## Status

approved

## Context

Currently every agent needs ~11 sFUEL (11 × `CTX_CALLBACK_VALUE_WEI`) in its wallet to create a table via `PokerFactory.createTable{value: ...}`. This is a bottleneck:

- Each agent needs its own faucet drip
- The factory is already deployed with 100,000 sFUEL that sits unused
- The contract already sweeps ETH back to the factory when `players.length == 0`

## Constraints

- Must not break existing table creation by deployer/owner
- Must preserve CTX reserve mechanics (BITE callbacks still need gas)
- Must pass all Foundry tests
- Must update agent discovery logic to remove reserve check

## Options Considered

### Option A: Factory pays from its own balance
- `createTable` pulls `minReserve` from `address(this).balance` and forwards it to `new PokerGame{value: minReserve}`
- Removes `payable` from `createTable` and `msg.value` requirement
- **Pros:** Agents need 0 sFUEL to create tables. Factory's 100k sFUEL is actually used.
- **Cons:** Factory balance could drain if many tables are created. Mitigated by auto-shutdown sweeping back.
- **Effort:** Small — one function change

### Option B: Keep current model, require all agents to be funded
- **Pros:** Zero contract changes
- **Cons:** Scales poorly. Each new agent = new faucet request. Operational burden.
- **Effort:** Zero code, high ops

### Option C: Add a `createTableFor(address)` owner-only function
- Factory owner pre-creates tables on behalf of agents
- **Pros:** Controlled table creation
- **Cons:** Centralized, owner becomes a bottleneck, more code

## Proposal

Adopt **Option A**:

1. `PokerFactory.createTable` pulls reserve from factory balance instead of `msg.value`
2. Add `PokerFactory.removeTable(address)` callable by the table itself when sweeping, so the factory's table list stays clean
3. `PokerGame._sweepReserve()` calls `PokerFactory.removeTable(address(this))` before sending ETH back
4. Update agent `discovery.ts` to remove the `11 sFUEL` reserve check
5. Update Foundry tests to fund the factory on creation and use `createTable()` without `value:`

## Impact

- `contracts/src/PokerFactory.sol` — `createTable` signature and logic
- `contracts/src/PokerGame.sol` — `_sweepReserve` calls factory to remove itself
- `contracts/test/PokerGame.t.sol` — remove `{value: MIN_RESERVE}` from all `createTable` calls
- `contracts/script/Deploy.s.sol` — deploy factory with larger seed if needed
- `agents/langchain/src/loop/discovery.ts` — remove `11 sFUEL` reserve check

## Test Plan

1. Foundry tests pass after removing `{value: ...}` and adding factory funding in `setUp`
2. Verify `_sweepReserve` + `removeTable` integration: create table → all players leave → factory balance increases → table removed from `tables[]`

## Rollback Plan

Revert commit. The old `createTable` with `msg.value` is additive; removing `payable` is a breaking change to the ABI, but only affects the frontend and agent. If needed, add an overload that accepts both modes.

## Decision Log

| Date | Actor | Action |
|------|-------|--------|
| 2026-05-18 | Agent | Drafted ADR |
| 2026-05-18 | Human | Approved for implementation |
