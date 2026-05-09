---
name: poker-fundamentals
description: Texas Hold'em rules, hand rankings, pot odds, position value, and basic GTO concepts. Guaranteed-load — appended as base knowledge for every poker agent persona.
---

# Poker Fundamentals

## Hand Rankings (High to Low)

1. **Royal Flush** — A-K-Q-J-10, same suit
2. **Straight Flush** — 5 consecutive, same suit
3. **Four of a Kind** — Four of the same rank
4. **Full House** — Three of a kind + a pair
5. **Flush** — 5 cards same suit
6. **Straight** — 5 consecutive (A-2-3-4-5 is lowest straight)
7. **Three of a Kind** — Three of the same rank
8. **Two Pair** — Two different pairs
9. **One Pair** — One pair
10. **High Card** — Highest card wins

## Starting Hand Selection by Position

### UTG (Under the Gun — first to act preflop)
Play tight: AA, KK, QQ, JJ, TT, AKs, AKo, AQs, AQo. Fold everything else.

### MP (Middle Position)
Add: 99, 88, AJs, ATs, KQs, KQo, QJs, JTs.

### CO (Cutoff — one off button)
Add: 77, 66, A9s, A8s, KJs, KTs, QTs, J9s, T9s, 98s, all pairs.

### BTN (Button — dealer position)
Play all pairs, suited aces, suited connectors, broadway cards. Maximum range.

### BB (Big Blind)
Defend wide against raises. Call with any pair, suited connectors, broadway cards. 3-bet with premium hands.

## Pot Odds Formula

```
Pot Odds = (Call Amount) / (Current Pot + Call Amount)
```

Call if your hand's equity exceeds pot odds. Example: pot is 100, opponent bets 50. Pot odds = 50 / (100+50) = 33.3%. Call if hand equity > 33%.

## Implied Odds

Consider future bets you can win if you hit your draw. Multiply pot odds by 1.5-3x for implied odds on draws.

## SPR (Stack-to-Pot Ratio)

SPR = Effective Stack / Pot
- Low SPR (< 5): Commit with top pair+; draws lose value
- Medium SPR (5-15): Play standard; draws have value
- High SPR (> 15): Deep stacked; strong draws and speculative hands gain value

## Position Value

- **In position** (acting last): You see opponents' actions before deciding. Value: +20-30% equity.
- **Out of position** (acting first): You reveal information first. Tighten range by 10-15%.

## Basic GTO Concepts

- **Balanced range**: Mix value bets (60-70%) with bluffs (30-40%) at correct frequency
- **Minimum defense frequency (MDF)**: Fold no more than 1 - (bet/pot+bet) to prevent opponent auto-profiting
- **C-bet frequency**: Flop 70-80% (in position), 50-60% (out of position)
- **Turn aggression**: Polarize — strong value or bluffs, check marginal hands
