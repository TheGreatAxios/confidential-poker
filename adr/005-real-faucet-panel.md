# ADR-005: Real FaucetPanel — Wire MockSKL.faucet() to the Frontend

## Status

proposed

## Context

`FaucetPanel.tsx` (`apps/web/src/components/FaucetPanel.tsx`) is currently a UI stub. When a user clicks "Claim sFUEL", it runs `setTimeout(..., 800)` and prints a fake success message. No contract call is made. Human players have no way to acquire MockSKL tokens from the frontend UI; they must use `cast send` or rely on agents to auto-claim.

The agent side already has a working pattern: `agents/langchain/src/tools/claim-faucet.ts` calls `MockSKL.faucet()` directly via viem. The contract method exists and is permissionless (`_mint(msg.sender, FAUCET_AMOUNT)`). The frontend should do the same.

## Constraints

- Must remain direct-to-chain via wagmi/viem; no backend faucet proxy
- Must not break the existing `FaucetPanel` UI shape or styling
- Must handle the 1-hour cooldown between claims gracefully (contract reverts if called too soon)
- Must pass `tsc --noEmit`, `oxlint`, and `bun test` in `apps/web`
- Must maintain test coverage above 80% in affected packages

## Options Considered

### Option A: Wire `MockSKL.faucet()` via wagmi `useWriteContract` (recommended)
- Replace the stub `handleClaim` with a real `writeContractAsync` call to `MockSKL.faucet()`
- Use `MOCK_SKL_ABI` from `@confidential-poker/abis` (already a workspace dependency)
- Address comes from `FRONTEND_CONFIG.underlyingTokenAddress`
- Wait for receipt, parse error messages for cooldown/failure, update UI state
- **Pros:** Zero new dependencies; aligns with agent implementation; direct-to-chain; permissionless
- **Cons:** Requires a small amount of error-message parsing for the cooldown revert
- **Effort:** Small — 2-4 hours
- **Risks:** Low. The contract method is simple and already battle-tested by agents.

### Option B: Backend Faucet Proxy
- Add a lightweight API endpoint (e.g., Cloudflare Worker or Express) that holds a private key and sends `faucet()` transactions on behalf of users, or drips tokens directly via `mint()`
- **Pros:** Could bypass cooldown by using a rotating key pool
- **Cons:** Violates direct-to-chain architecture; introduces centralization, key custody, and infra cost; overkill for a testnet faucet
- **Effort:** Medium — 1-2 days + infra setup
- **Risks:** High. Adds operational surface area and breaks the "no backend" principle.

### Option C: Remove FaucetPanel, Document Manual Claim
- Delete the stub component and instruct users to run `cast send` or claim via the agent tooling
- **Pros:** Zero code, zero risk
- **Cons:** Bad onboarding UX; humans should not need a CLI to start playing; the component already exists and just needs wiring
- **Effort:** Trivial
- **Risks:** Moderate. High friction for non-technical users.

### Option D: Do Nothing
- **Pros:** Zero effort
- **Cons:** Faucet button is actively misleading; users think they claimed tokens but received nothing; support burden and confusion

## Proposal

Adopt **Option A** — wire the existing `MockSKL.faucet()` contract call into `FaucetPanel.tsx`.

Implementation plan:
1. Import `useWriteContract`, `usePublicClient` from wagmi, and `MOCK_SKL_ABI` from `@confidential-poker/abis`
2. Import `FRONTEND_CONFIG` for the `underlyingTokenAddress`
3. Replace `handleClaim` stub with:
   - `writeContractAsync({ address: FRONTEND_CONFIG.underlyingTokenAddress, abi: MOCK_SKL_ABI, functionName: "faucet", args: [] })`
   - Wait for receipt via `publicClient.waitForTransactionReceipt`
   - On success, display the claimed amount (can read `FAUCET_AMOUNT` from contract or hardcode)
   - On revert, parse the error message and show "Faucet on cooldown — try again later" if appropriate
4. Keep the existing loading/disabled states and styling
5. Add a `useReadContract` call to `FAUCET_AMOUNT` and `balanceOf` so the UI can show the user's MockSKL balance and the per-claim drip size

## Impact

- `apps/web/src/components/FaucetPanel.tsx` — full rewrite of `handleClaim`, add wagmi hooks
- `apps/web/src/lib/contracts.ts` — verify `MOCK_SKL_ABI` is exported (if not, add it)
- `apps/web/package.json` — no new dependencies; `MOCK_SKL_ABI` comes from existing `@confidential-poker/abis`
- `skills/how-to-play.md` and `skills/create-wallet.md` — update to remove references to manual `cast send` as the primary path

## Test Plan

1. Unit test `FaucetPanel` with mocked wagmi hooks:
   - Success path: click → spinner → success message
   - Revert path: click → error message (e.g., cooldown)
2. Integration-style test for `handleClaim` logic using a mock viem client
3. `tsc --noEmit` and `oxlint` must pass
4. `bun run build:frontend` must pass
5. Manual test on SKALE Base Sepolia to confirm real tokens are minted

## Rollback Plan

Revert the single commit. The component was already a stub; rollback restores the harmless (but useless) stub.

## Decision Log

| Date | Actor | Action |
|------|-------|--------|
| 2026-05-19 | Agent | Drafted ADR from frontend audit |
