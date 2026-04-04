# Smart Contracts — AI Poker Night

## Overview

Four Solidity contracts power the on-chain game logic, tested with Foundry (37/37 tests passing).

**Compiler:** Solidity 0.8.27  
**Framework:** Foundry  
**EVM Target:** Istanbul (SKALE compatibility)  
**Optimization:** Enabled (200 runs, via-ir)

## Contracts

### PokerGame.sol

The main game contract implementing full Texas Hold'em with BITE-encrypted card dealing.

#### `createTable(uint256 smallBlind, uint256 bigBlind, uint256 minBuyIn, uint256 maxPlayers) → uint256 gameId`

Creates a new poker table. Anyone can create a table.

| Parameter | Type | Description |
|-----------|------|-------------|
| `smallBlind` | uint256 | Small blind amount (in AxUSD, 18 decimals) |
| `bigBlind` | uint256 | Big blind amount (must be ≥ smallBlind) |
| `minBuyIn` | uint256 | Minimum buy-in to join the table |
| `maxPlayers` | uint256 | Max players per table (2–9) |

**Emits:** `TableCreated(gameId, owner, smallBlind, bigBlind, minBuyIn, maxPlayers)`

#### `joinTable(uint256 gameId, bytes32 encryptedIdentity, uint256 buyIn)`

Joins an existing table. Caller must have approved `bettingToken.transferFrom()` for the buy-in amount.

| Parameter | Type | Description |
|-----------|------|-------------|
| `gameId` | uint256 | Table to join |
| `encryptedIdentity` | bytes32 | BITE-encrypted agent identity |
| `buyIn` | uint256 | Amount of AxUSD to bring to the table |

**Emits:** `PlayerJoined(gameId, player, encryptedIdentity, buyIn)`

#### `startHand(uint256 gameId)`

Starts a new hand. Submits a CTX transaction for encrypted card dealing. The BITE protocol encrypts the card payload and calls `onDecrypt()` when complete.

**Requirements:** Game must be in `Waiting` or `Finished` phase, at least 2 players.

#### `onDecrypt(bytes[] decryptedArguments, bytes[] plaintextArguments)`

BITE CTX callback. Receives decrypted card data, assigns hole cards to players, and advances to the preflop betting round.

#### `submitAction(uint256 gameId, PlayerAction action, uint256 raiseAmount)`

Submits a player action during a betting round.

| Action | Description |
|--------|-------------|
| `Fold (0)` | Player folds, loses their bets |
| `Check (1)` | Player checks (only when no bet to call) |
| `Call (2)` | Player matches the current bet (supports all-in) |
| `Raise (3)` | Player raises by `raiseAmount` (must be ≥ last raise) |

**Emits:** `ActionSubmitted(gameId, player, action, raiseAmount)`

#### View Functions

| Function | Returns |
|----------|---------|
| `getGameState(gameId)` | `(phase, pot, currentMaxBet, communityCardCount, activePlayerIndex, active)` |
| `getPlayerInfo(gameId, idx)` | `(addr, stack, currentBet, folded, hasActed, cardsRevealed)` |
| `getCommunityCards(gameId)` | `uint8[]` community cards |
| `getPlayerCount(gameId)` | Total players at table |
| `getActivePlayerCount(gameId)` | Non-folded player count |

#### Game Phases

```
Waiting → Dealing → Preflop → Flop → Turn → River → Showdown → Finished
                ↑                                           │
                └───────────────────────────────────────────┘
```

---

### HandEvaluator.sol

A library for evaluating poker hands. Used by `PokerGame` via `using HandEvaluator for uint8[]`.

#### Card Encoding

```
uint8 card = (suit << 4) | rank
  - rank: 2-14 (2-10, J=11, Q=12, K=13, A=14)
  - suit: 0-3 (♠, ♥, ♦, ♣)
```

#### `evaluateHand(uint8[] cards) → uint256`

Evaluates 5–7 cards and returns the best possible 5-card hand score.

For 7 cards (standard Texas Hold'em): evaluates all 21 possible 5-card combinations.

#### Score Format

```
uint256 score = (handRank << 200) | tiebreakers
```

| Hand Rank | Value | Description |
|-----------|-------|-------------|
| `ROYAL_FLUSH` | 9 | A-K-Q-J-10, same suit |
| `STRAIGHT_FLUSH` | 8 | Five consecutive, same suit |
| `FOUR_OF_A_KIND` | 7 | Four cards of same rank |
| `FULL_HOUSE` | 6 | Three of a kind + pair |
| `FLUSH` | 5 | Five cards, same suit |
| `STRAIGHT` | 4 | Five consecutive cards |
| `THREE_OF_A_KIND` | 3 | Three cards of same rank |
| `TWO_PAIR` | 2 | Two different pairs |
| `ONE_PAIR` | 1 | Two cards of same rank |
| `HIGH_CARD` | 0 | Nothing matched |

---

### MockSKL.sol

ERC20 gas token faucet for SKALE transactions.

```
Name: "Mock SKL" | Symbol: "mSKL"
```

| Function | Description |
|----------|-------------|
| `faucet()` | Mints 100 mSKL to caller (60s cooldown) |
| `mint(to, amount)` | Owner-only minting |

- `FAUCET_AMOUNT`: 100 × 10¹⁸ tokens per claim
- `FAUCET_COOLDOWN`: 60 seconds between claims

### AxiosUSD.sol

ERC20 stablecoin for in-game betting.

```
Name: "Axios USD" | Symbol: "AxUSD"
```

Same interface as MockSKL — faucet with 60s cooldown, 100 tokens per claim.

## Testing

```bash
cd contracts
forge test -vvv    # Run all tests with full traces
forge coverage      # Generate coverage report
forge snapshot      # Gas usage snapshots
```

All 37 tests pass, covering:
- Table creation and player joining
- Full game lifecycle (deal → bet → showdown)
- Hand evaluation (all 10 hand ranks)
- Edge cases (all-in, wheel straights, multi-way pots)
- Faucet cooldowns and access control
