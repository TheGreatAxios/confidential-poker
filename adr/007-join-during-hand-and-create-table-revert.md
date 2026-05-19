# ADR-007: Allow Joining During Active Hand + Fix Create Table Revert

## Status

implemented

## Context

Two critical bugs discovered during live usage:

### Bug 1: Cannot Create Table from UI

The `CreateTableModal` sends `value: parseEther(ctxReserveInput)` to `PokerFactory.createTable()`. But `createTable` is **not marked `payable`** — it pays for table creation from the factory's own balance (`address(this).balance`), not from user funds. Sending any non-zero ETH to a non-payable function causes an automatic revert. The default CTX reserve input is `"0.01"`, which sends 0.01 ETH and triggers the revert.

The factory's `createTable` checks `address(this).balance >= CTX_CALLBACK_VALUE_WEI * 11` and funds the new table from its own reserve. The user never needs to send ETH.

### Bug 2: Cannot Join Table During Active Hand

`sitDown()` requires `phase == GamePhase.Waiting`. AI agents auto-`readyUp()` and start hands immediately. When a human browses tables and clicks "Join Table", the agents have already started a hand, so `sitDown` reverts with `GameInProgress()`. There is no way for a human to "catch" an active table — they must join before any agents sit down.

Similarly, `readyUp()` requires `phase == Waiting`, so even if `sitDown` were bypassed, the player couldn't mark themselves as ready for the next hand.

This breaks the core UX: a table with active agents is permanently inaccessible to humans.

## Constraints

- Contract changes require ABI regeneration and shared-package sync
- Must not break existing agent behavior (agents already handle `readyUp` after each hand)
- Must maintain test coverage above 80%
- Must pass `tsc --noEmit`, `oxlint`, `bun test`, `forge test`

## Options Considered

### Bug 1: Create Table Revert

#### Option A: Remove `value` from frontend call (recommended)
- The factory pays from its own balance; no user ETH needed
- Remove the `value` field from `writeContractAsync` in `CreateTableModal`
- Remove the CTX Reserve input field from the modal UI
- **Pros:** Zero contract changes; fixes the root cause immediately; simpler UX
- **Cons:** If the factory runs low on reserve, table creation fails with `InsufficientPayment` — but that's a deployment/ops issue, not a code bug
- **Effort:** Small — 30 minutes
- **Risks:** None

#### Option B: Make `createTable` payable and accept user ETH
- Change contract to add `payable` to `createTable` and use `msg.value` to refill factory
- **Pros:** Users could fund the factory as they create tables
- **Cons:** Changes the economics; factory was designed to be pre-funded by deployer; adds user friction
- **Effort:** Small
- **Risks:** Changes intended contract behavior; users shouldn't pay for infra

#### Option C: Do Nothing
- **Pros:** Zero effort
- **Cons:** Table creation is permanently broken from the UI

### Bug 2: Join During Hand

#### Option A: Remove `phase == Waiting` from `sitDown` and `readyUp` (recommended)
- `sitDown`: Remove `require(phase == GamePhase.Waiting)`
- `readyUp`: Remove `require(phase == GamePhase.Waiting)`
- New player joins with `isActive = false`, `hasActed = true` (already default)
- Player `readyUp`s during the hand — their `isReady` flag persists through hand end
- When current hand ends, `_resetWaitingState` sets `phase = Waiting`
- Next `readyUp` by any player triggers `dealNewHand` if threshold met
- `dealNewHand` activates all `isReady` players, then clears flags
- All players (including the new one) need to `readyUp` again for the following hand
- **Pros:** Minimal contract changes; aligns with how agents already work; human can join any active table
- **Cons:** New player must `readyUp` twice (once during join, once after first hand ends); existing players also re-ready after each hand (already current behavior)
- **Effort:** Small — 1-2 hours
- **Risks:** Low. The `dealNewHand` guards (`_communityDealPending`, `_showdownPending`) prevent accidental mid-hand starts.

#### Option B: Add a queue/standby mechanism
- New `joinQueue` mapping; players queue during hand; auto-joined when hand ends
- **Pros:** Clean separation; no double-ready-up needed
- **Cons:** More contract complexity; new state to manage; overkill for current scope
- **Effort:** Medium — half a day
- **Risks:** Could introduce edge cases with leave requests and showdown

#### Option C: Do Nothing
- **Pros:** Zero effort
- **Cons:** Human can never join a table with active agents; product is unusable for the intended audience

## Proposal

**Bug 1:** Adopt Option A — remove `value` field and CTX Reserve input from `CreateTableModal`.

**Bug 2:** Adopt Option A — remove `phase == Waiting` checks from `sitDown` and `readyUp`.

## Implementation Plan

### Contract Changes
1. `PokerGame.sol` — remove `require(phase == GamePhase.Waiting)` from `sitDown`
2. `PokerGame.sol` — remove `require(phase == GamePhase.Waiting)` from `readyUp`
3. Regenerate ABI, sync packages

### Frontend Changes
1. `CreateTableModal.tsx`:
   - Remove `value` from `writeContractAsync`
   - Remove CTX Reserve input field and state
   - Remove `ctxReserveInput` state and `parseEther` import
2. `JoinPanel.tsx`:
   - Remove the "hand in progress" early block for `mode === "join"`
   - Keep the phase read for revert-decode fallback
3. `GameControls.tsx` or `PlayerHandPanel.tsx`:
   - Add a "Ready Up" button when player is seated but `!isReady`
   - Wire to `actions.readyUp()` in `useTableActions`
4. `useTableActions.ts`:
   - Add `readyUp` action

### Test Plan
- Foundry: `testSitDownDuringGame` — `sitDown` should succeed when phase != Waiting
- Foundry: `testReadyUpDuringGame` — `readyUp` should succeed when phase != Waiting
- Foundry: `testNewPlayerIncludedInNextHand` — join during hand, ready up, finish hand, verify player is in next hand
- Frontend: `tsc --noEmit`, `oxlint`, `bun test`

## Impact

- `contracts/src/PokerGame.sol` — two `require` lines removed
- `packages/abis/src/poker-game.ts` — ABI regenerated
- `apps/web/src/components/CreateTableModal.tsx` — remove CTX reserve field and value
- `apps/web/src/components/JoinPanel.tsx` — remove hand-in-progress blocker
- `apps/web/src/hooks/useTableActions.ts` — add `readyUp`
- `apps/web/src/components/GameControls.tsx` or `PlayerHandPanel.tsx` — add Ready Up UI

## Rollback Plan

Revert the single commit. Contract changes are minimal — just two `require` removals.

## Decision Log

| Date | Actor | Action |
|------|-------|--------|
| 2026-05-19 | Agent | Drafted ADR from live bug reports |
| 2026-05-19 | Agent | Implemented: removed `phase == Waiting` from `sitDown` and `readyUp`; removed `value` from `CreateTableModal`; added `readyUp`/`unready` actions and Ready Up UI button |
| 2026-05-19 | Agent | Quality gates: `forge test` 16/16 pass, `tsc --noEmit` clean, `oxlint` 0 errors, `bun test` 17/17 pass, `bunx vite build` pass |
