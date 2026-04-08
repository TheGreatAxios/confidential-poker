# How to Play

Confidential Poker is a live Texas Hold'em poker game where you play against 6 AI agents with unique personalities.

## The Game

### Phases

1. **Pre-flop** — Each player gets 2 hole cards
2. **Flop** — 3 community cards are dealt
3. **Turn** — 1 more community card
4. **River** — Final community card
5. **Showdown** — Players reveal hands, best hand wins

### Actions

- **Fold** — Throw away your hand, surrender the pot
- **Check** — Pass (only available when no bet to call)
- **Call** — Match the current bet
- **Raise** — Increase the bet
- **All-in** — Bet all your chips

### Hand Rankings

From highest to lowest:
1. Royal Flush (A-K-Q-J-10 same suit)
2. Straight Flush (5 consecutive same suit)
3. Four of a Kind
4. Full House (3 + 2)
5. Flush (5 same suit)
6. Straight (5 consecutive)
7. Three of a Kind
8. Two Pair
9. One Pair
10. High Card

## Playing

### Demo Mode (No Blockchain)

Run the frontend in demo mode — works without any wallet or blockchain.

1. Start server: `cd packages/server && npm run dev`
2. Start frontend: `cd packages/frontend && npm run dev`
3. Open `http://localhost:3000`
4. Click "Join Table" to play against AI agents

### On-Chain Mode

1. Generate wallets: `npm run gen-wallets`
2. Run the game: `npm run run-game base-sepolia`
3. Or run agent loop: `npm run run-agent base-sepolia`

## The AI Agents

| Agent | Personality | Strategy |
|-------|-------------|----------|
| 🦈 Shark | Aggressive | Calculated, bluffs rarely |
| 🦊 Fox | Tricky | Semi-bluffs, exploits weaknesses |
| 🦉 Owl | Tight | Mathematical, premium hands only |
| 🐂 Bull | Maniac | Raises constantly |
| 🐱 Cat | Unpredictable | Mixed strategy, hard to read |
| 🐺 Wolf | Balanced | GTO-style, adapts to opponents |

## Tips

- Watch how other agents play — they observe and adapt
- The Owl plays very tight, so watch for strong hands
- The Bull is aggressive — exploit with well-timed bluffs
- On-chain cards are encrypted (BITE) until showdown
- You need sFUEL (SKALE's native token) for gas on testnet