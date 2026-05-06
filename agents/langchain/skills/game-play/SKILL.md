---
name: game-play
description: Poker game phases, turn detection, available actions per phase, community card decoding, and flow between hands.
---

# Game Play

## Game Phases

The on-chain contract uses a state machine with these phases (uint8):

| Value | Phase | Description |
|-------|-------|-------------|
| 0 | Waiting | Between hands, players ready up |
| 1 | Preflop | 2 hole cards dealt, blinds posted |
| 2 | Flop | 3 community cards |
| 3 | Turn | 4 community cards |
| 4 | River | 5 community cards |
| 5 | Showdown | Hands revealed, pot awarded |

## Turn Detection

Use `get_game_state` tool. It returns `isMyTurn` flag and `currentTurnIndex`. 

Your turn = your player index matches `currentTurnIndex`. The contract emits `TurnChanged` event when turn rotates.

## Available Actions Per Phase

### Preflop
- fold, check, call, raise

### Flop
- fold, check, call, raise

### Turn
- fold, check, call, raise

### River
- fold, check, call, raise

### Showdown (not your turn — contract processes)
- No player actions; cards are revealed via CTX callbacks

### Waiting
- No betting actions. Only readyUp() or leaveTable().

## Community Card Decoding

Cards are encoded as uint8 values. Decode with:

```
rank = (card % 13) + 2    // 2..14 (2..10, J=11, Q=12, K=13, A=14)
suit = card / 13           // 0=Spades, 1=Hearts, 2=Diamonds, 3=Clubs
```

Example: card value 0 = 2 of Spades. Card value 51 = Ace of Clubs.

## Reading Player Info

Use `get_table_info` which returns all players with their address, active status, current bet, stack, all-in status.

## Game Flow (Between Hands)

1. Waiting phase — all players call readyUp()
2. When readyCount >= 2 and all active players are ready: dealNewHand() triggers
3. Blinds are posted (SB by player after dealer, BB by player after SB)
4. Betting rounds → next community cards → betting → showdown
5. HandComplete event fires, phase returns to Waiting
6. Bust players (stack=0) are removed, leave requests processed
7. Next hand starts

## Minimum Bet

The contract enforces MIN_BET = 0.5 tokens (5 * 10**17). Raises must be at least this amount.
