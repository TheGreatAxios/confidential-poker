# E2E Test Report — AI Poker Night (SKALE Base Sepolia)
## Date: 2026-04-05

### Contract Addresses
- PokerTable: 0x0dA344c11C1BaffC0e57fc1e23c619836E47b3F2
- MockSKL: 0x09c7Cbd3CC1eb8BCa7AFbd9521e15001a2B1cE00
- AxiosUSD: 0x3400B4B901d24c4a53a1d36Dd6cD455bF476b7Fa

### Test Wallets Created
| # | Address | Role |
|---|---------|------|
| 1 | 0x2F3Ca9f2aA0Ec5c0ea7A23D05E5083E09A54e238 | Deployer/Owner |
| 2 | 0xdD72487D709Daa8Fee9d89E25D2CA465A9A3ccdF | Player 2 |
| 3 | 0x4913Fb83FD42F053234Ea53E654A8E7E1bEa9718 | Player 3 |
| 4 | 0x1A45008827Ab3e3eDA79Da285e26E2EF4f3948cb | Player 4 |
| 5 | 0x21BA1B6b1BD81abBDE85551838864696109266Ac | Player 5 |
| 6 | 0x178389f7DEFf1A5E9054c8F20a90b6B4C1719727 | Player 6 |
| 7 | 0x18b8... (created) | Rejected - TableFull |

---

## ✅ PASSED TESTS

### Table Management
1. **sitDown** — Player joins with 0.01 ETH buy-in ✅
2. **AlreadySeated** — Revert when already seated player tries again ✅
3. **BuyInTooLow** — Revert when buy-in below minimum (0.01 ETH) ✅
4. **TableFull** — Revert when 7th player tries to join (maxPlayers=6) ✅
5. **getSeatedPlayerCount** — Correctly returns 6 after all seated ✅

### Dealing
6. **dealNewHand** — Deals cards, posts blinds, advances to Preflop ✅
   - Phase: 0 → 1
   - Pot: 0.003 ETH (SB 0.001 + BB 0.002)
   - 6 CardsDealt events emitted

### Betting Actions (Preflop)
7. **fold** — Player folds, moves to next active ✅
8. **call** — Player matches current bet ✅
9. **check** — Player checks when bet is matched ✅
10. **raise** — Player raises 0.005 ETH, max bet updates ✅
11. **CannotCheck** — Revert when player tries to check while behind ✅
12. **NothingToCall** — Revert when player tries to call with 0 debt ✅

### Phase Advancement
13. **Flop** — 3 community cards dealt after preflop betting complete ✅
14. **Turn** — 4th community card dealt ✅
15. **River** — 5th community card dealt ✅
16. **Max bet reset** — Resets to 0 on each new street ✅

### View Functions
17. **isPlayerSeated** — Correctly reports seating status ✅
18. **isPlayerFolded** — Correctly reports fold status ✅
19. **getActivePlayer** — Returns correct active player address ✅
20. **getDealer** — Returns correct dealer address ✅
21. **getActivePlayerCount** — Correctly counts non-folded players ✅
22. **getCommunityCards** — Returns correct community cards ✅

### Owner Functions
23. **emergencyWithdraw** — Owner can drain contract ETH (46K gas) ✅

---

## ❌ CRITICAL BUG FOUND

### River → Showdown: Gas Exhaustion on SKALE Base Sepolia

**Severity**: CRITICAL — Game cannot complete a hand

**Description**: When the last betting action on the River (phase 4) completes all actions, `_advancePhase()` is called, which calls `_evaluateAndDistribute()`. On SKALE Base Sepolia, this function consumes ALL provided gas (50M-100M tested) and the transaction reverts. The game becomes permanently stuck.

**Reproduction**:
1. Seat 6 players
2. Deal hand → preflop
3. Play through all streets (fold some, check/call others)
4. When on River, the last action triggers `_evaluateAndDistribute()`
5. Transaction uses all gas and reverts (status 0)

**Forge local test**: Same flow uses only **97,651 gas** for fold and works perfectly. All 37 foundry tests pass.

**Root cause hypothesis**: The issue is SKALE Base Sepolia chain-specific. Possible causes:
1. SKALE precompile at address `0x1B` (BITE SUBMIT_CTX) may be interfering with contract execution even when not directly called
2. SKALE's EVM implementation may handle certain opcodes differently (e.g., string allocation, event emission with strings)
3. The HandEvaluator library functions, while cheap on standard EVM, may be expensive on SKALE's specific node implementation

**Note**: The same issue affects `forceFold()` when it would trigger hand evaluation.

**Workaround**: `emergencyWithdraw()` works to recover locked funds.

**Affected game states**: Game is stuck at Phase 4 (River) with 2 active players and 0.02 ETH in pot. No player can advance the game. New hands cannot be dealt.

---

## Next Steps
1. Deploy to a different SKALE chain (e.g., Europa testnet) to see if issue reproduces
2. Try a simplified PokerTable without BITE integration (remove `using HandEvaluator`, `IBiteSupplicant`)
3. File issue with SKALE team if chain-specific behavior confirmed
4. Consider using a different hand evaluation approach (off-chain evaluation with on-chain verification)
