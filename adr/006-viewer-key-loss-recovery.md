# ADR-006: Viewer Key Loss Recovery — Fix Rejoin Mode When localStorage Is Cleared

## Status

implemented

## Context

The frontend encrypts each human player's hole cards using a BITE ECIES viewer key. The private key is stored in `localStorage` (keyed by wallet address). The corresponding public key is registered on-chain when the player calls `sitDown(PublicKey)`.

When a user clears `localStorage`, switches browsers, or uses a different device, their viewer key is lost. The frontend detects this (`loadViewerKey(address)` returns `null`) and shows the `JoinPanel` in `mode="rejoin"`. However, the rejoin flow is broken:

1. It generates a **new** random keypair
2. It calls `sitDown(newPublicKey)` on the contract
3. The contract reverts with `AlreadyJoined()` because the player is already seated (`_playerIndex(msg.sender) != type(uint256).max`)
4. Even if `AlreadyJoined` were bypassed, `sitDown` requires `phase == Waiting`, so mid-hand rejoin is impossible

There is **no on-chain method to update a seated player's viewer key**. The `PokerGame.sol` contract stores `PublicKey viewerKey` in the `Player` struct and never exposes a setter. The `IPokerTable` interface has `sitDown`, `leaveTable`, `requestLeave`, `cancelLeave`, but nothing for key rotation.

This means a user who loses their localStorage key cannot see their hole cards for the remainder of the hand, and if they leave and rejoin later, the new public key mismatch may cause card decryption to fail entirely.

## Constraints

- Card encryption/decryption must remain secure; no plaintext key transmission
- Must not introduce a backend or trusted oracle
- Contract changes require ABI regeneration, shared-package sync, and potentially test updates
- Must pass all quality gates: `tsc --noEmit`, `oxlint`, `bun test`, `bun run test:contracts`, build
- Must maintain test coverage above 80% in all affected packages

## Options Considered

### Option A: Add `updateViewerKey(PublicKey)` to the contract + wire frontend (recommended)
- Add `function updateViewerKey(PublicKey calldata newKey) external onlyPlayer` to `PokerGame.sol`
- Add it to `IPokerTable.sol`
- Regenerate ABI in `@confidential-poker/abis`, sync to `packages/config`
- Update `JoinPanel` rejoin mode to call `updateViewerKey` instead of `sitDown`
- **Pros:** Proper fix. Enables cross-device play and browser cache clearing. Keeps the player seated.
- **Cons:** Requires contract change and redeployment. Slightly increases contract bytecode. Must ensure `onlyPlayer` modifier exists or is added.
- **Effort:** Medium — 1 day (contract + ABI + frontend + tests)
- **Risks:** Low. The change is a simple struct field assignment. No fund movement. Must verify that `dealNewHand` encrypts cards with the *current* `viewerKey` (it reads `players[i].viewerKey` at deal time, so a mid-hand update will only affect the next hand — acceptable).

### Option B: Frontend-Only Backup/Restore Flow
- Remove the broken `sitDown` call from rejoin mode entirely
- Add "Export Viewer Key" and "Import Viewer Key" UI in `JoinPanel` and/or a settings modal
- Export: JSON blob `{x, y, privateKey}` downloaded as a file, or a mnemonic-style phrase
- Import: paste/upload the backup; validate and store in `localStorage`
- If no backup exists, instruct the user to request leave and rejoin from the waiting phase
- **Pros:** Zero contract changes. Works immediately.
- **Cons:** Terrible UX if the user never exported. If they lose the key mid-hand, they are blind until the hand ends. Requires user education.
- **Effort:** Small — 4-6 hours
- **Risks:** Low technical risk, but high UX risk. Users will still hit the broken path if they ignore the export prompt.

### Option C: Hybrid — Contract Update + Backup/Restore
- Implement both Option A and Option B
- Contract `updateViewerKey` is the primary recovery path
- Backup/restore UI is a secondary safeguard for users who want offline redundancy
- **Pros:** Best long-term UX. Belt-and-suspenders.
- **Cons:** Most effort.
- **Effort:** Medium — 1.5 days
- **Risks:** Same as A and B, combined.

### Option D: Do Nothing
- Document that clearing localStorage bricks the seat until the next waiting phase
- **Pros:** Zero effort
- **Cons:** The rejoin button is actively broken and confusing. Poor user experience. Not acceptable for a production-facing game.

## Proposal

Adopt **Option A** as the immediate fix, with **Option B** as a fast-follow if time permits.

### Phase 1 (Option A): Contract `updateViewerKey`

1. **Contract change** (`contracts/src/PokerGame.sol`):
   ```solidity
   function updateViewerKey(PublicKey calldata newKey) external onlyPlayer {
       uint256 idx = _playerIndex(msg.sender);
       players[idx].viewerKey = newKey;
   }
   ```
2. **Interface change** (`contracts/src/interfaces/IPokerTable.sol`):
   ```solidity
   function updateViewerKey(PublicKey calldata newKey) external;
   ```
3. **ABI sync**: Run `bun run deploy:contracts` or `forge build` + extract to `packages/abis`
4. **Frontend change** (`apps/web/src/components/JoinPanel.tsx`):
   - In `mode="rejoin"`, after generating/restoring the keypair, call `updateViewerKey` instead of `sitDown`
   - Remove the deposit/approval steps from rejoin mode (the player already has chips at the table)
   - The only on-chain action is the key update
5. **Test plan**:
   - Foundry test for `updateViewerKey` — assert non-player reverts, assert key is updated, assert next hand uses new key
   - Frontend component test for rejoin mode — mock `useWriteContract` and assert `updateViewerKey` is called

### Phase 2 (Option B): Backup/Restore UI (optional fast-follow)
- Add "Export Key" and "Import Key" buttons to a settings or account panel
- Store export as a portable JSON file

## Impact

- `contracts/src/PokerGame.sol` — new function
- `contracts/src/interfaces/IPokerTable.sol` — new interface method
- `packages/abis/src/*.ts` — regenerated ABIs
- `apps/web/src/components/JoinPanel.tsx` — rejoin logic branch changed
- `apps/web/src/lib/contracts.ts` — may need to export `MOCK_SKL_ABI` if not already present (used in related ADR-005)
- `apps/web/src/lib/viewer-key.ts` — may add `exportViewerKey` / `importViewerKey` helpers for Phase 2
- Documentation — update `skills/how-to-play.md` to mention key backup

## Test Plan

1. **Contract tests** (`contracts/test/`):
   - `testUpdateViewerKeyAsPlayer` — happy path
   - `testUpdateViewerKeyAsNonPlayer` — revert
   - `testUpdatedKeyUsedInNextDeal` — join, update key, deal next hand, assert encryption uses new key (can verify via `getMyEncryptedCards` and off-chain decrypt)
2. **Frontend tests** (`apps/web/src/`):
   - Mock rejoin flow in `JoinPanel` — assert `updateViewerKey` contract call with correct `x, y`
   - Assert no `sitDown` call is made in rejoin mode
3. **Quality gates**:
   - `bun run test:contracts` passes
   - `tsc --noEmit` passes in `apps/web`
   - `oxlint` passes
   - `bun test` passes (add tests to maintain >80% coverage)
   - `bun run build:frontend` passes

## Rollback Plan

If the contract change causes issues, redeploy the previous contract version and update `packages/config` with the old addresses. The frontend change is additive (a new branch in rejoin mode); reverting it simply restores the broken-but-harmless old rejoin stub.

## Decision Log

| Date | Actor | Action |
|------|-------|--------|
| 2026-05-19 | Agent | Drafted ADR from frontend audit and contract review |
| 2026-05-19 | Agent | Implemented: added `updateViewerKey` to `PokerGame.sol` and `IPokerTable.sol`, regenerated ABI, fixed JoinPanel rejoin mode |
| 2026-05-19 | Agent | Quality gates: contract tests 13/13 pass (2 pre-existing unrelated integration failures), `tsc --noEmit` clean, `oxlint` 0 errors, `bun test` 17/17 pass, build pass |
| 2026-05-19 | Agent | Phase 2 (backup/restore UI) deferred — no export/import viewer key UI added yet |
