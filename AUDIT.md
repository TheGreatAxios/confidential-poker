# AI Poker Night — Comprehensive Security Audit

**Audit Date:** 2026-04-04  
**Auditor:** Automated Security Analysis  
**Scope:** 5 Solidity contracts, 12 React components, 3 hooks, 6 lib modules  
**Severity Scale:** Critical → High → Medium → Low → Informational  

---

## 1. Executive Summary

The AI Poker Night project implements an on-chain Texas Hold'em poker table with BITE-encrypted card delivery, an ERC20 chip token with EIP-3009 meta-transactions, a faucet for testnet tokens, and a Next.js frontend with RainbowKit wallet integration.

The audit identified **5 Critical**, **7 High**, **10 Medium**, and **10 Low/Informational** findings. The most severe issues are:

1. **Game-breaking logic flaws:** No side pot support for all-in scenarios and no split-pot handling for tied hands make the poker rules fundamentally incorrect. Real money (ETH) can be unfairly redistributed.
2. **Miner-manipulable randomness:** Card dealing uses `block.timestamp + block.prevrandao`, allowing miners/validators to predict and influence which cards are dealt.
3. **Duplicate card dealing:** The card generation system does not track dealt cards, meaning the same physical card (rank+suit) can be dealt to multiple players.
4. **Unprotected `receive()` function:** ETH sent directly to the contract is permanently locked with no recovery mechanism.
5. **Game stalling DoS:** No timeout mechanism exists; a single player can permanently freeze the game, locking all other players' funds.

**The contract should NOT be used with real funds in its current state** until at least the Critical and High findings are addressed.

---

## 2. Critical Findings

### C-01: No Side Pot Implementation — All-In Funds Redistributed Incorrectly

| | |
|---|---|
| **Severity** | Critical |
| **Contract** | `PokerTable.sol` — `_evaluateAndDistribute()` (L498-551), `raise()` (L282-315), `call()` (L265-280) |
| **Impact** | All-in player can win more than their fair share; other players lose funds they shouldn't |

**Description:**  
Texas Hold'em requires side pots when a player goes all-in for less than the current bet. The contract tracks a single `pot` variable. When a player goes all-in (line 294-297), their contribution is capped at `p.stack` but added to the shared pot. At showdown, the entire pot goes to the single best hand.

**Example attack scenario:**
- Player A: 1 ETH stack, goes all-in
- Player B: 10 ETH stack, calls
- Player C: 10 ETH stack, calls  
- Total pot: 21 ETH
- Player A wins with the best hand and receives all 21 ETH, despite only contributing 1 ETH
- Players B and C each lose 10 ETH to a player who only risked 1 ETH

**Recommended Fix:**  
Implement side pot tracking. For each all-in, create a separate pot with eligible players. At showdown, evaluate pots from smallest to largest, removing ineligible players at each level.

---

### C-02: No Split Pot Handling — Tied Hands Produce Unfair Winner

| | |
|---|---|
| **Severity** | Critical |
| **Contract** | `PokerTable.sol` — `_evaluateAndDistribute()` (L526) |
| **Impact** | Player with tied best hand unfairly loses the entire pot |

**Description:**  
In `_evaluateAndDistribute()`, the winner is determined by strict greater-than comparison:

```solidity
if (score > bestScore) {   // L526
    bestScore = score;
    winner    = p.addr;
}
```

When two players have identical hand scores (e.g., both have a flush A-K-9-7-3 of the same suit, or both have a pair of Aces with identical kickers), only the first player encountered in the array wins. The second player with the identical hand loses their entire bet.

**Recommended Fix:**  
Track all players with the maximum score and divide the pot equally among them (split pot). Handle remainder by awarding it to the player closest to the left of the dealer.

---

### C-03: Miner-Manipulable Card Dealing

| | |
|---|---|
| **Severity** | Critical |
| **Contract** | `PokerTable.sol` — `_dealHoleCards()` (L624-646), `_dealCommunity()` (L648-656) |
| **Impact** | Miners/validators can predict or influence which cards every player receives |

**Description:**  
The random seed for card generation is:

```solidity
uint256 seed = uint256(keccak256(abi.encodePacked(
    handCount, block.timestamp, block.prevrandao  // L625-626
)));
```

Both `block.timestamp` and `block.prevrandao` are values the block producer controls or can predict:
- `block.timestamp` can be manipulated within ~15 seconds
- `block.prevrandao` is known to the validator producing the block

A colluding validator can pre-compute all possible card distributions for different `prevrandao` values, choose the one most favorable to them, and include that transaction in their block.

**Community cards** use the same weak source (L649-650):
```solidity
uint256 seed = uint256(keccak256(abi.encodePacked(
    handCount, communityCardCount, block.timestamp, block.prevrandao
)));
```

**Recommended Fix:**  
Use a commit-reveal scheme, Chainlink VRF, or SKALE's RNG precompile. For a commit-reveal approach:
1. Each player submits a hash of their random contribution
2. After all commitments, players reveal their values
3. The final seed is derived from all revealed values + block data
4. Since BITE is already in the stack, consider using it for randomness contribution

---

### C-04: Duplicate Card Dealing — Same Physical Card to Multiple Players

| | |
|---|---|
| **Severity** | Critical |
| **Contract** | `PokerTable.sol` — `_genCard()` (L658-663), `_dealHoleCards()` (L624-646), `_dealCommunity()` (L648-656) |
| **Impact** | Multiple players can receive the same card; community cards can duplicate hole cards; fundamentally breaks poker |

**Description:**  
`_genCard` generates cards from a seed but does not track which cards have already been dealt:

```solidity
function _genCard(uint256 seed, uint256 index) internal pure returns (uint8) {
    uint256 h    = uint256(keccak256(abi.encodePacked(seed, index)));
    uint8   rank = uint8((h % 13) + 2);   // 2-14
    uint8   suit = uint8((h >> 8) % 4);    // 0-3
    return HandEvaluator.encodeCard(rank, suit);
}
```

The while loop in `_dealHoleCards` (L636-639) only ensures a player's two hole cards differ from each other:

```solidity
while (c2 == c1) {
    seed = uint256(keccak256(abi.encodePacked(seed, c2)));
    c2   = _genCard(seed, i * 2 + 1);
}
```

It does NOT check against cards dealt to other players or against community cards. In a standard 52-card deck, duplicates are impossible. Here, two players could both receive the A♠, making the game fundamentally unfair.

**Recommended Fix:**  
Maintain a dealt-cards tracking mechanism. Use a bitmap or array to track the 52-card deck. Resample when a duplicate is generated, or use Fisher-Yates shuffle on a fixed deck.

---

### C-05: Unprotected `receive()` — ETH Permanently Locked

| | |
|---|---|
| **Severity** | Critical |
| **Contract** | `PokerTable.sol` — `receive()` (L127) |
| **Impact** | Any ETH sent directly to the contract address is permanently irrecoverable |

**Description:**  

```solidity
receive() external payable {}
```

This function accepts any ETH with zero logic. The ETH becomes part of `address(this).balance` but:
1. No event is emitted
2. No accounting tracks it
3. No function can withdraw it (there's no `owner` function or emergency withdraw)
4. It is NOT added to any player's stack or the pot
5. It contributes to `address(this).balance` used implicitly in no-ETH-flow

**Recommended Fix:**  
Either remove `receive()` entirely (reverting direct ETH transfers) or add an owner-only emergency withdraw function and emit an event. If direct funding is needed, track it in a dedicated variable.

```solidity
// Option A: Reject direct ETH
// (remove receive() entirely)

// Option B: Allow with tracking
event ReceivedEth(address indexed from, uint256 amount);
receive() external payable {
    emit ReceivedEth(msg.sender, msg.value);
}
```

---

## 3. High Findings

### H-01: Game Stalling Denial of Service — No Timeout Mechanism

| | |
|---|---|
| **Severity** | High |
| **Contract** | `PokerTable.sol` — `_requireActiveTurn()` (L581-586), `_afterAction()` (L422-430) |
| **Impact** | A single player can permanently freeze the game, locking all other players' funds in the pot |

**Description:**  
The game progresses only when the active player calls `fold()`, `check()`, `call()`, or `raise()`. There is no timeout or auto-fold mechanism. If the active player stops interacting:
- `activePlayerIndex` permanently points to them
- The pot remains locked
- No other player can take any action
- The 10% early-quit penalty discourages others from leaving (they lose 10% + 1% of their stack)
- All funds are effectively frozen

This is especially dangerous on SKALE where transaction costs are minimal, making griefing essentially free.

**Recommended Fix:**  
Implement a time-based timeout system. Options include:
1. A `lastActionTimestamp` variable; if `block.timestamp > lastActionTimestamp + TIMEOUT`, the active player is auto-folded
2. Allow any player to call a `forceFold(address)` function after a timeout period
3. An owner/admin function to resolve stuck hands

---

### H-02: Reentrancy in `leaveTable()` — External Call Before `_afterAction()`

| | |
|---|---|
| **Severity** | High |
| **Contract** | `PokerTable.sol` — `leaveTable()` (L159-196) |
| **Impact** | During the ETH transfer callback, game state is in an inconsistent intermediate state |

**Description:**  

```solidity
// State changes BEFORE external call — good
p.stack    = 0;
p.isSeated = false;
p.folded   = true;

// External call
(bool ok,) = payable(msg.sender).call{value: amount}("");  // L187
if (!ok) revert TransferFailed();

// State-dependent logic AFTER external call — dangerous
if (wasActive) {
    _afterAction();  // L194
}
```

While the CEI pattern is partially followed (player state updated before call), `_afterAction()` is called AFTER the external call. During the callback:
- The leaving player is marked as unseated and folded, but `activePlayerIndex` still points to their slot
- `_afterAction()` hasn't run yet, so the game hasn't advanced
- Another player cannot act because `activePlayerIndex` still points to the (now-unseated) leaving player
- However, a malicious contract receiving the ETH callback could attempt to exploit other functions

**Recommended Fix:**  
Call `_afterAction()` BEFORE the external ETH transfer, or add a `ReentrancyGuard` modifier to all external functions.

---

### H-03: Unbounded Player Array Growth — Gas Griefing

| | |
|---|---|
| **Severity** | High |
| **Contract** | `PokerTable.sol` — `sitDown()` (L135-156), all iteration functions |
| **Impact** | After many sit/leave cycles, gas costs increase linearly for all players; eventual out-of-gas for transactions |

**Description:**  
The `players` array never shrinks. When a player leaves, their entry is marked `isSeated = false` but stays in the array. Every function that iterates the array — `_countSeated()`, `getActivePlayerCount()`, `_getPlayerIndex()`, `sitDown()` (already-seated check), `_afterAction()`, `_advancePhase()`, `_evaluateAndDistribute()` — must scan through all historical entries.

With 10 max players but unlimited sit/leave cycles, the array grows without bound. After 1000 sessions, every game action costs significantly more gas. After enough entries, transactions will exceed block gas limits.

```solidity
// sitDown checks all entries
for (uint256 i = 0; i < players.length; i++) {
    if (players[i].addr == msg.sender) revert AlreadySeated();
}
```

**Recommended Fix:**  
Implement array compaction: when a player leaves, either:
1. Swap-and-pop the last element into the vacated slot (adjusting dealer/active indices), or
2. Maintain a separate mapping from address to index and compact periodically, or
3. Keep a `uint256 activePlayerCount` separate from `players.length` and only iterate up to seated players

---

### H-04: Pot Lost When All Players Fold/Leave

| | |
|---|---|
| **Severity** | High |
| **Contract** | `PokerTable.sol` — `_evaluateAndDistribute()` (L498-551) |
| **Impact** | ETH permanently lost if all remaining players fold or leave during a hand |

**Description:**  
If every active player folds or leaves during a hand (or during showdown evaluation when no player satisfies `isSeated && !folded`), the `winner` variable remains `address(0)`:

```solidity
address winner = address(0);
// ...
if (winner != address(0)) {
    players[_getPlayerIndex(winner)].stack += prize;
}
// pot is zeroed, winner is 0x0 — ETH is lost
```

The pot is zeroed (`pot = 0`) but the ETH is not distributed to anyone. The ETH remains in the contract's balance but is unrecoverable since there's no withdraw function.

**Recommended Fix:**  
Add a safety mechanism: if no winner is found, emit a `PotUnclaimed` event and either:
1. Return funds proportionally to all seated (but folded) players based on their contributions
2. Allow an owner to recover unclaimed pots
3. Add the unclaimed amount back to players' stacks proportionally

---

### H-05: Frontend — Broken Imports Cause Runtime Failures

| | |
|---|---|
| **Severity** | High |
| **File** | `frontend/src/lib/api.ts`, `frontend/src/hooks/useFaucet.ts`, `frontend/src/hooks/useTips.ts`, `frontend/src/components/TipButton.tsx`, `frontend/src/app/page.tsx` |
| **Impact** | Application crashes when faucet, tips, or game controls are used |

**Description:**  
Multiple broken imports and type mismatches exist:

1. **`api.ts` is empty** (contains only a comment), but is imported by:
   - `useFaucet.ts` (L4): `import { api } from "@/lib/api";`
   - `useTips.ts` (L4): `import { api } from "@/lib/api";`
   - `page.tsx` (L7): `import { api } from "@/lib/api";`

2. **`AGENTS` not exported from `constants.ts`**: `TipButton.tsx` (L7) imports `AGENTS` from `@/lib/constants`, but `constants.ts` does not define or export `AGENTS`.

3. **`useGameState` signature mismatch**: `page.tsx` (L26) calls `useGameState("current")` with a string argument, but the hook definition takes no parameters.

4. **`GameState` type mismatch**: `page.tsx` references `game.isRunning`, `game.ante`, `game.agents` (L136-139), but the `GameState` interface in `types.ts` has `players` (not `agents`), no `isRunning` field, and no `ante` field.

**Recommended Fix:**  
Reconcile all type definitions, implement the `api` module (or remove imports), and ensure all component props match their actual data sources.

---

### H-06: ABI Mismatch With Deployed Contract

| | |
|---|---|
| **Severity** | High |
| **File** | `frontend/src/lib/abis.ts` vs `contracts/src/PokerTable.sol` |
| **Impact** | Contract reads return incorrect data; write calls may fail or have wrong parameter encoding |

**Description:**  
The ABI in `abis.ts` includes fields and functions that don't exist in `PokerTable.sol`:

| ABI Entry | Contract Reality |
|---|---|
| `cardsRevealed` (Player field) | Does not exist in the `Player` struct |
| `isAgent` view function | Does not exist in the contract |
| `AgentRegistered` event | Does not exist in the contract |
| `playerCount` getter | Does not exist (only `players.length`) |
| `getPlayerCount` view function | Does not exist (only `getSeatedPlayerCount`) |
| `TableCreated` event | Does not exist (no such event in contract) |

The `Player` struct in the contract has 8 fields; the ABI specifies 9 fields (extra `cardsRevealed`). This means `getPlayers()` return data will be decoded incorrectly — every subsequent field after `holeCards` will be shifted by one position.

**Recommended Fix:**  
Regenerate the ABI from the compiled contract artifacts. Use `forge build` and extract the ABI automatically rather than hand-writing it.

---

### H-07: Frontend — Missing Error Boundaries and Silent Failures

| | |
|---|---|
| **Severity** | High |
| **File** | `frontend/src/hooks/useFaucet.ts`, `frontend/src/hooks/useTips.ts`, `frontend/src/app/page.tsx` |
| **Impact** | Users are unaware of failed transactions and data fetching errors; demo mode masks production issues |

**Description:**  
Error handling in hooks silently swallows errors:

```typescript
// useFaucet.ts L74-82
} catch {
    // Demo: simulate cooldown
    setState((prev) => ({
        ...prev,
        msklCooldown: 60,
        claimingMskl: false,
        msklBalance: prev.msklBalance + 100,  // Fake success!
    }));
}
```

```typescript
// page.tsx L36-38
} catch {
    // Demo mode — just trigger a refetch
}
```

When connected to a real contract, failed transactions are masked as "demo mode" behavior. Users see fake successful states (fake balance increases, fake cooldowns) while their actual transactions failed.

**Recommended Fix:**  
Implement proper error reporting with toast notifications. Distinguish between demo mode and production mode. Log errors for debugging.

---

## 4. Medium Findings

### M-01: Missing `onlyOwner` Admin Functions

| | |
|---|---|
| **Severity** | Medium |
| **Contract** | `PokerTable.sol` |
| **Impact** | No ability to recover stuck ETH, adjust blinds, pause the contract, or resolve frozen games |

**Description:**  
The `owner` address is set in the constructor (L121) but is never used. There are no administrative functions:
- No `withdraw()` to recover ETH sent via `receive()` or from lost pots
- No `setBlinds()` to adjust game parameters
- No `pause()` mechanism for emergencies
- No `resolveStuckHand()` to handle timeout situations

**Recommended Fix:**  
Add owner-only administrative functions for contract management and fund recovery.

---

### M-02: `dealerIndex` Points to Unseated Player After All-In/Leave

| | |
|---|---|
| **Severity** | Medium |
| **Contract** | `PokerTable.sol` — `_evaluateAndDistribute()` (L544-547), `dealNewHand()` (L228-229) |
| **Impact** | Blind posting and first-to-act logic can reference non-existent players |

**Description:**  
The `dealerIndex` is advanced in `_evaluateAndDistribute()` using `_nextSeatedFrom(dealerIndex)`, which is correct. However, between hands, if players have left, the stored `dealerIndex` may point to an unseated player. While `_nextSeatedFrom` and `_nextActiveFrom` handle this by skipping unseated players, the initial check in `dealNewHand` relies on `_countSeated() >= 2` without verifying the dealer index is valid.

In edge cases where the players array has many unseated entries, `_nextSeatedFrom` iterates the full array, which ties into the unbounded array growth issue (H-03).

**Recommended Fix:**  
Validate `dealerIndex` at the start of `dealNewHand()` and reset if needed.

---

### M-03: `_afterAction` Recursive Call Path

| | |
|---|---|
| **Severity** | Medium |
| **Contract** | `PokerTable.sol` — `_afterAction()` (L422-430), `_findNextActivePlayer()` (L445-457), `_advancePhase()` (L459-492) |
| **Impact** | Multiple internal function calls in a single transaction increase gas unpredictability |

**Description:**  
`_afterAction` → `_advancePhase` → `_evaluateAndDistribute` can be called recursively within a single transaction through this path:
1. Player calls `fold()` → `_afterAction()`
2. `_afterAction()` → `_isBettingRoundDone()` → `_advancePhase()`
3. `_advancePhase()` → `getActivePlayerCount() <= 1` → `_evaluateAndDistribute()`

Or:
1. Player calls `fold()` → `_afterAction()`
2. `_afterAction()` → `_findNextActivePlayer()`
3. `_findNextActivePlayer()` → `_advancePhase()` (if everyone has acted)

This chained execution is not reentrant (all internal), but the gas cost varies significantly depending on how many phases advance and how many players are evaluated.

**Recommended Fix:**  
Document the maximum gas cost path. Consider limiting advancement to one phase per transaction and requiring explicit `advancePhase()` calls.

---

### M-04: Missing Events for State Changes

| | |
|---|---|
| **Severity** | Medium |
| **Contract** | `PokerTable.sol` — `receive()` (L127), `_advancePhase()` community dealing, `revealCards()` (L322-344), `resolveHand()` (L347-350) |
| **Impact** | Off-chain indexers and frontend cannot track all state transitions; harder to audit |

**Description:**  
Several state-changing operations lack events:
- `receive()`: No event for received ETH
- Community card dealing: No event when cards are added to the board
- `revealCards()`: Only emits `PhaseAdvanced(Showdown)`, not a dedicated reveal event
- `resolveHand()`: No dedicated event (only the events inside `_evaluateAndDistribute`)
- BITE callback sender authorization: `isCallbackSender[cb] = true` (L341) has no event

**Recommended Fix:**  
Add events for all state changes: `EthReceived`, `CommunityCardDealt`, `HandResolved`, etc.

---

### M-05: `useGameState` Polling Without Error Handling for Contract Changes

| | |
|---|---|
| **Severity** | Medium |
| **File** | `frontend/src/hooks/useGameState.ts` (L24-45) |
| **Impact** | If the contract is upgraded or the ABI is wrong, polling silently produces garbage data |

**Description:**  
The hook polls at 2-second intervals using `refetchInterval: POLL_INTERVAL`. If the contract address is the zero address placeholder (`enabled` is false), polling is disabled. However, if a real address is configured but the ABI is wrong (see H-06), the hook will silently receive malformed data and attempt to process it.

Line 61 performs an unsafe cast:
```typescript
const players: RawPlayer[] = (rawPlayers as unknown as RawPlayer[]) || [];
```

Line 68 has a potential out-of-bounds access:
```typescript
const dealerAddr = players[dealerIdx]?.addr ?? "0x" as `0x${string}`;
```

**Recommended Fix:**  
Add schema validation on received data. Compare the number of returned fields with expected field counts. Log warnings when data appears malformed.

---

### M-06: WalletConnect Project ID Fallback is Invalid

| | |
|---|---|
| **Severity** | Medium |
| **File** | `frontend/src/lib/wagmi.ts` (L49-50) |
| **Impact** | If env var is unset, WalletConnect connections fail silently with a cryptic error |

**Description:**  

```typescript
projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id",
```

`"demo-project-id"` is not a valid WalletConnect Cloud project ID. If the environment variable is not set, users will see connection failures with no clear indication of the root cause.

**Recommended Fix:**  
Either:
1. Remove the fallback and show a clear error when the project ID is missing
2. Use a real development project ID
3. Make WalletConnect optional and handle the missing configuration gracefully

---

### M-07: HandEvaluator — Three-of-a-Kind Kicker Detection Fails with Rank 0

| | |
|---|---|
| **Severity** | Medium |
| **Contract** | `HandEvaluator.sol` — `_score5Fixed()` (L170-180) |
| **Impact** | Kicker detection uses `== 0` as sentinel, which could collide with a valid (but impossible) rank 0 |

**Description:**  

```solidity
uint8 kicker1 = 0;
uint8 kicker2 = 0;
for (uint i = 0; i < 5; i++) {
    if (ranks[i] != maxRank) {
        if (kicker1 == 0) kicker1 = ranks[i];  // L175
        else kicker2 = ranks[i];
    }
}
```

The sentinel value `0` is used to indicate "no kicker found yet." While rank 0 is not a valid poker rank (valid is 2-14), this is fragile and relies on an implicit invariant. If card encoding ever changes to include rank 0, this breaks silently.

**Recommended Fix:**  
Use a boolean flag or a separate counter for kicker assignment rather than a sentinel value.

---

### M-08: `FaucetDrip` — No Event on `fund()`

| | |
|---|---|
| **Severity** | Medium |
| **Contract** | `FaucetDrip.sol` — `fund()` (L14) |
| **Impact** | Cannot track who funded the faucet or how much; reduces transparency |

**Description:**  

```solidity
function fund() external payable {}
```

No event is emitted when someone funds the faucet. This makes it impossible to track funding history off-chain.

**Recommended Fix:**  

```solidity
event FaucetFunded(address indexed from, uint256 amount);
function fund() external payable {
    emit FaucetFunded(msg.sender, msg.value);
}
```

---

### M-09: `PokerChip` — EIP-3009 Nonce Marked Used Even If Transfer Fails

| | |
|---|---|
| **Severity** | Medium |
| **Contract** | `PokerChip.sol` — `transferWithAuthorization()` (L71-84) |
| **Impact** | If the ERC20 transfer reverts, the nonce is consumed and the authorization is permanently lost |

**Description:**  

```solidity
function transferWithAuthorization(...) external {
    _verifyTransferAuthorization(...);       // L80
    _markAuthorizationAsUsed(nonce);          // L81 — nonce consumed
    emit AuthorizationUsed(from, nonce);      // L82
    _transfer(from, to, value);              // L83 — if this reverts, nonce is lost
}
```

The nonce is marked as used BEFORE `_transfer` is called. If `_transfer` reverts (e.g., insufficient balance), the entire transaction reverts due to the `require` in `_transfer`, so the nonce is NOT actually consumed (the state change is rolled back). This is actually safe in Solidity since atomicity ensures all changes revert.

**Revised Severity:** Informational — Solidity's atomic transaction model protects against this.

---

### M-10: `PokerChip` — `cancelAuthorization` Does Not Verify Signer's Balance

| | |
|---|---|
| **Severity** | Medium (Low) |
| **Contract** | `PokerChip.sol` — `cancelAuthorization()` (L102-115) |
| **Impact** | Any holder of a signed cancel message can cancel an authorization, which is correct behavior |

**Description:**  
The `cancelAuthorization` function correctly verifies the `authorizer` signature. However, it does not verify that the authorizer has sufficient balance for the original transfer. This means an authorization for a transfer that would fail (insufficient balance) can be canceled, which is actually correct behavior — you should be able to cancel any authorization you've signed.

**Revised Severity:** Low — This is correct behavior per EIP-3009 spec.

---

## 5. Low / Informational Findings

### L-01: `PokerTable` — `_nextActiveFrom` Returns `from` as Fallback

| | |
|---|---|
| **Severity** | Low |
| **Contract** | `PokerTable.sol` — `_nextActiveFrom()` (L603-610) |
| **Description** | If no active player is found (all folded/unseated), returns the `from` index. This could reference a folded player. While callers should check conditions before calling, this is a fragile assumption. |

---

### L-02: `PokerTable` — `lastRaise` Reset to `bigBlind` on Phase Advance

| | |
|---|---|
| **Severity** | Low |
| **Contract** | `PokerTable.sol` — `_advancePhase()` (L466) |
| **Description** | Minimum re-raise resets to `bigBlind` each betting round. This is correct for fixed-limit but differs from no-limit where the minimum re-raise should be the size of the last raise. The contract currently acts as fixed-limit without stating so. |

---

### L-03: `MockSKL` — Short 60-Second Faucet Cooldown

| | |
|---|---|
| **Severity** | Low |
| **Contract** | `MockSKL.sol` — `FAUCET_COOLDOWN` (L11) |
| **Description** | 60-second cooldown is very short for a faucet. While this is a testnet token, it could be abused to mint unlimited tokens through automated scripts. |

---

### L-04: Frontend — `NEXT_PUBLIC_API_URL` Defined but Unused

| | |
|---|---|
| **Severity** | Low |
| **File** | `.env.example` (L18) |
| **Description** | `NEXT_PUBLIC_API_URL=http://localhost:3001` is defined but `api.ts` is empty and no server API calls are made. This is dead configuration. |

---

### L-05: Frontend — `PRIVATE_KEY` in `.env.example`

| | |
|---|---|
| **Severity** | Low |
| **File** | `.env.example` (L16) |
| **Description** | While the value is empty, having `PRIVATE_KEY=` in the example file may encourage bad practices. No private keys are hardcoded in the source. |

---

### L-06: Frontend — `useTips` Mock Generates Fake Transaction Hashes

| | |
|---|---|
| **Severity** | Low |
| **File** | `frontend/src/hooks/useTips.ts` (L83) |
| **Description** | `"0x" + Math.random().toString(16).slice(2, 10) + "..."` generates fake tx hashes that look real. This could mislead users in demo mode into thinking a real transaction occurred. |

---

### L-07: Frontend — `useFaucet` setInterval Cleanup

| | |
|---|---|
| **Severity** | Low (Positive) |
| **File** | `frontend/src/hooks/useFaucet.ts` (L49-58) |
| **Description** | The 1-second cooldown timer interval is properly cleaned up with `clearInterval`. This is correct. |

---

### L-08: Frontend — Missing CSP and Security Headers

| | |
|---|---|
| **Severity** | Informational |
| **File** | `frontend/src/app/layout.tsx` |
| **Description** | No Content-Security-Policy, X-Frame-Options, or other security headers are configured. Consider adding them in `next.config.js` or via middleware. |

---

### L-09: `HandEvaluator` — Card Encoding Only Uses 6 of 8 Bits

| | |
|---|---|
| **Severity** | Informational |
| **Contract** | `HandEvaluator.sol` — `encodeCard()` (L30-34), `getRank()` (L21-23), `getSuit()` (L26-27) |
| **Description** | Rank uses bits 0-3 (4 bits), suit uses bits 4-5 (2 bits), bits 6-7 are unused. This is fine but limits future extensibility. A 6-bit encoding (4 rank + 2 suit) could allow 6 cards per byte if packed differently. |

---

### L-10: `PokerTable` — `owner` Is Immutable With No Transfer

| | |
|---|---|
| **Severity** | Informational |
| **Contract** | `PokerTable.sol` (L121) |
| **Description** | `owner` is set once in the constructor and never changed. There's no `transferOwnership()` function. If the owner key is lost, there's no way to add admin functions later (though none exist currently). |

---

## 6. Recommendations (Prioritized)

### Immediate (Before Any Deployment With Real Funds)

| Priority | Finding | Action |
|---|---|---|
| **P0** | C-01 + C-02 | Implement side pots and split pot handling. Without correct poker rules, the game is fundamentally broken. |
| **P0** | C-03 | Replace `block.timestamp + block.prevrandao` with commit-reveal, Chainlink VRF, or SKALE RNG. |
| **P0** | C-04 | Implement a 52-card deck with duplicate prevention (Fisher-Yates shuffle or bitmap). |
| **P0** | C-05 | Remove `receive()` or add owner-only withdraw function. |
| **P0** | H-01 | Add timeout mechanism to prevent game stalling. |

### High Priority (Before Mainnet)

| Priority | Finding | Action |
|---|---|---|
| **P1** | H-02 | Add ReentrancyGuard or reorder `_afterAction()` call in `leaveTable()`. |
| **P1** | H-03 | Implement player array compaction or capped iteration. |
| **P1** | H-04 | Add unclaimed pot recovery mechanism. |
| **P1** | H-05 + H-06 | Fix all frontend imports, type mismatches, and ABI inconsistencies. |
| **P1** | H-07 | Add proper error boundaries and user-facing error notifications. |
| **P1** | M-01 | Add owner-only admin functions (withdraw, pause, resolve stuck hands). |

### Medium Priority (Before Production Launch)

| Priority | Finding | Action |
|---|---|---|
| **P2** | M-04 | Add comprehensive events for all state changes. |
| **P2** | M-05 | Add data validation in `useGameState` hook. |
| **P2** | M-06 | Configure valid WalletConnect project ID. |
| **P2** | M-08 | Add events to `FaucetDrip.fund()`. |

### Low Priority (Quality Improvements)

| Priority | Finding | Action |
|---|---|---|
| **P3** | L-01 through L-10 | Address all low-severity findings. |
| **P3** | M-07 | Refactor kicker detection to use explicit counter. |
| **P3** | L-08 | Add CSP headers in Next.js configuration. |

---

## Appendix A: Files Audited

### Smart Contracts
- `contracts/src/PokerTable.sol` (664 lines)
- `contracts/src/PokerChip.sol` (155 lines)
- `contracts/src/FaucetDrip.sol` (31 lines)
- `contracts/src/MockSKL.sol` (30 lines)
- `contracts/src/HandEvaluator.sol` (243 lines)

### Frontend
- `frontend/src/lib/abis.ts` (175 lines)
- `frontend/src/lib/wagmi.ts` (56 lines)
- `frontend/src/lib/types.ts` (95 lines)
- `frontend/src/lib/constants.ts` (50 lines)
- `frontend/src/lib/api.ts` (2 lines)
- `frontend/src/lib/format.ts` (56 lines)
- `frontend/src/lib/mockData.ts` (152 lines)
- `frontend/src/hooks/useGameState.ts` (134 lines)
- `frontend/src/hooks/useFaucet.ts` (115 lines)
- `frontend/src/hooks/useTips.ts` (91 lines)
- `frontend/src/components/*.tsx` (12 files, ~1,500 lines total)
- `frontend/src/app/page.tsx` (231 lines)
- `frontend/src/app/layout.tsx` (33 lines)
- `frontend/package.json` (33 lines)
- `.env.example` (19 lines)

---

## Appendix B: Gas Analysis Notes

- `dealNewHand()` iterates all players twice (reset + blind posting) and calls `_dealHoleCards()` which iterates again. With unbounded array growth (H-03), this becomes increasingly expensive.
- `raise()` iterates all players to reset `hasActed` flags (L306-310). This is O(n) per raise.
- `getPlayers()` returns the entire array including unseated entries, wasting bandwidth.
- `_evaluateAndDistribute()` with 7 players evaluates 21 five-card combinations per player = 147 total evaluations. With up to 10 players, this is 210 evaluations.
- Hand evaluator's `_score5Fixed` uses bubble sort (O(n²) for n=5 = 25 comparisons) which is acceptable for fixed-size arrays.

---

## Appendix C: Assumptions

1. No proxy/upgrade pattern is used (contracts are deployed directly).
2. SKALE Network's gasless model makes gas griefing cheaper but not free (block gas limits still apply).
3. BITE protocol's `submitCTX` and `onDecrypt` callback mechanism is assumed to be secure and correctly implemented by the SKALE team.
4. The frontend is a standard Next.js SPA with no server-side state management (confirmed by empty `api.ts`).
5. The `ECDSA.recover` in PokerChip uses OpenZeppelin's implementation, which is audited and secure against signature malleability.
