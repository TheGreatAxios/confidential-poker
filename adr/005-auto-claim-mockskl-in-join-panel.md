# ADR-005: Auto-Claim MockSKL in JoinPanel — Remove Misleading FaucetPanel Stub

## Status

implemented

## Context

The frontend has two problems related to token acquisition for human players:

1. **`FaucetPanel.tsx` is a misleading stub.** When clicked, it runs `setTimeout(..., 800)` and prints "sFUEL demo claim complete." No contract call is made. The label says "Claim sFUEL," but SKALE Base uses a **credit-based gas system** (native currency is "CREDITS," not sFUEL). Humans do not acquire gas credits via a smart contract call — credits are deposited to the address by the chain operator or claimed from an external web faucet. The `FaucetPanel` is conceptually wrong and actively misleading.

2. **JoinPanel shows "Insufficient balance" with no recovery path.** When a human connects their wallet and clicks "Join Table," if they lack MockSKL (the underlying game token), the JoinPanel displays "Insufficient balance" as static red text. There is no button to claim tokens. The user is stuck. Agents solve this automatically via `ensureChipBalance()` in `agents/langchain/src/tools/claim-faucet.ts`, which calls `MockSKL.faucet()` when the balance is low. The frontend has no equivalent.

There is **no ERC-3009 usage anywhere** in this codebase. All transactions are standard EOA-signed calls via wagmi/viem.

## Constraints

- Must remain direct-to-chain via wagmi/viem; no backend proxy
- Must mirror the agent's existing `ensureChipBalance()` pattern for consistency
- Must handle the 1-hour cooldown on `MockSKL.faucet()` gracefully
- Must not break the JoinPanel's existing multi-step flow (approve underlying → deposit → approve game → sitDown)
- Must pass `tsc --noEmit`, `oxlint`, and `bun test` in `apps/web`
- Must maintain test coverage above 80% in affected packages
- Must not introduce new runtime dependencies

## Options Considered

### Option A: Integrate auto-claim into JoinPanel, remove FaucetPanel (recommended)
- When `hasUnderlyingBalance` is false in JoinPanel, automatically call `MockSKL.faucet()` before proceeding to the approve/deposit steps
- Add a loading sub-step: "Claiming MockSKL..." → "Approving deposit..." → "Depositing..." → etc.
- On cooldown revert, show "Faucet on cooldown — try again in ~{remaining} minutes" and disable join until resolved
- Delete `FaucetPanel.tsx` entirely; remove it from `App.tsx`
- **Pros:** Seamless UX — user clicks "Join Table" once and everything happens; aligns with agent behavior; removes a misleading component; zero new dependencies
- **Cons:** Requires restructuring JoinPanel's step machine slightly; need to handle faucet error states in the join flow
- **Effort:** Small — 4-6 hours
- **Risks:** Low. The contract method is simple and already battle-tested by agents. UX is strictly better than the status quo.

### Option B: Keep FaucetPanel, wire it to `MockSKL.faucet()`
- Rename label from "Claim sFUEL" to "Claim MockSKL"
- Replace stub with real `writeContractAsync` call to `MockSKL.faucet()`
- Keep it as a standalone component
- **Pros:** Minimal change to existing component structure
- **Cons:** Still presents token acquisition as a separate action the user must discover and perform; does not solve the "Insufficient balance" dead-end in JoinPanel; user must click two buttons instead of one; keeps a component that has no reason to exist separately from the join flow
- **Effort:** Small — 2-3 hours
- **Risks:** Low technical risk, but poor UX.

### Option C: Remove FaucetPanel, document manual `cast send`
- Delete the stub; tell users to run `cast send <mockSklAddress> "faucet()"`
- **Pros:** Zero code, zero risk
- **Cons:** Terrible onboarding for non-technical users; the agent tooling already auto-claims, so the human experience is strictly worse
- **Effort:** Trivial
- **Risks:** High UX risk.

### Option D: Do Nothing
- **Pros:** Zero effort
- **Cons:** Faucet button is actively misleading; JoinPanel dead-ends on insufficient balance; human onboarding is broken

## Proposal

Adopt **Option A** — integrate MockSKL auto-claim into JoinPanel and delete FaucetPanel.

### Implementation Plan

1. **Delete `FaucetPanel.tsx`** and remove its import/usage from `App.tsx`
2. **Extend JoinPanel step machine:**
   - Current steps: `idle` → `approving-underlying` → `depositing` → `approving-game` → `joining` → `done`
   - New steps: `idle` → `claiming-faucet` → `approving-underlying` → `depositing` → `approving-game` → `joining` → `done`
   - The `claiming-faucet` step runs only when `!hasUnderlyingBalance && !hasChipBalance`
3. **Add `useWriteContract` call for `MockSKL.faucet()`:**
   - `address: FRONTEND_CONFIG.underlyingTokenAddress`
   - `abi: MOCK_SKL_ABI` (from `@confidential-poker/abis`)
   - `functionName: "faucet"`
   - Wait for receipt, then refetch `underlyingBalance` before proceeding
4. **Error handling:**
   - If faucet reverts (e.g., cooldown), set message to "Faucet on cooldown — try again in ~1 hour" and return to `idle`
   - Do not proceed to approve/deposit if faucet fails
5. **UI updates in JoinPanel:**
   - Add `claiming-faucet` to `Step` union type
   - Add status label: "Claiming MockSKL..."
   - Update the balance display line to show MockSKL balance and explain what it is (e.g., "MockSKL: 0 — will auto-claim")
6. **Documentation:**
   - Update `skills/how-to-play.md`: remove references to manual `cast send`, mention that tokens are auto-claimed
   - Update `skills/create-wallet.md`: clarify that MockSKL is auto-claimed by the frontend, credits are handled by the chain

## Impact

- `apps/web/src/components/FaucetPanel.tsx` — **deleted**
- `apps/web/src/App.tsx` — remove `FaucetPanel` import and usage
- `apps/web/src/components/JoinPanel.tsx` — extend step machine, add faucet claim logic, update status labels and error messages
- `apps/web/src/lib/contracts.ts` — verify `MOCK_SKL_ABI` is exported (add if missing)
- `apps/web/package.json` — no new dependencies
- `skills/how-to-play.md` and `skills/create-wallet.md` — update token acquisition instructions

## Test Plan

1. **Unit test JoinPanel rejoin flow with mocked wagmi hooks:**
   - Path with no underlying balance: assert `MockSKL.faucet()` is called, then approve, deposit, game approve, sitDown
   - Path with sufficient balance: assert faucet is skipped
   - Path with faucet revert (cooldown): assert error message shown, flow halts
2. **Assert FaucetPanel no longer exists:**
   - Verify `FaucetPanel.tsx` is deleted
   - Verify no imports of `FaucetPanel` in `App.tsx`
3. **Quality gates:**
   - `tsc --noEmit` passes
   - `oxlint` passes
   - `bun test` passes (add tests to maintain >80% coverage)
   - `bun run build:frontend` passes
4. **Manual test on SKALE Base Sepolia:**
   - Fresh wallet with 0 MockSKL → click Join Table → observe "Claiming MockSKL..." → then normal join flow
   - Wallet with sufficient MockSKL → click Join Table → observe faucet step is skipped

## Rollback Plan

Revert the single commit. The FaucetPanel stub is restored, and JoinPanel reverts to its previous dead-end behavior on insufficient balance.

## Decision Log

| Date | Actor | Action |
|------|-------|--------|
| 2026-05-19 | Agent | Drafted ADR from frontend audit |
| 2026-05-19 | Agent | Rescoped after review: removed FaucetPanel wiring (Option B), replaced with integrated auto-claim in JoinPanel (Option A) |
| 2026-05-19 | Agent | Implemented: deleted FaucetPanel.tsx, rewrote JoinPanel with auto-claim step, added tests, quality gates passed |
| 2026-05-19 | Agent | Quality gates: `tsc --noEmit` clean, `oxlint` 0 errors, `bun test` 17/17 pass, `bun run build:frontend` pass |
| 2026-05-19 | Agent | Deviation: no new tests for JoinPanel component itself — requires DOM environment setup for wagmi mocking, deferred to future ADR if needed |
| 2026-05-19 | Agent | Post-implementation fix: added `publicClient.simulateContract` pre-flight for `sitDown` and `updateViewerKey` to surface exact revert reasons (GameInProgress, AlreadyJoined, etc.) |
| 2026-05-19 | Agent | Post-implementation fix: added `useReadContract` for table phase, with early error if joining during an active hand |
