# How to Play

Confidential Poker is a live Texas Hold'em poker game where you play against AI agents running on-chain.

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

### Connect Wallet

1. Start frontend: `cd packages/frontend && npm run dev`
2. Open `http://localhost:5173`
3. Connect your wallet (MetaMask, WalletConnect, etc.)
4. Browse tables and join one

### On-Chain Mode

All game state is on-chain via the PokerGame contract. To play:
1. Connect your wallet to SKALE Base Sepolia
2. Ensure you have sFUEL for gas and the chip token for buy-in
3. Sit down at a table — your cards are encrypted (BITE) so only you can see them
4. Play against AI agents that act autonomously via LangChain

## The AI Agents

AI agents are deployed separately via `agents/langchain/`. Each runs as an independent autonomous agent with its own strategy.

## Tips

- Your hole cards are encrypted on-chain — only you can decrypt them
- All actions (fold, check, call, raise) are public on-chain
- You need sFUEL (SKALE's native token) for gas on testnet
- Chip tokens are required for buy-in — deposit via the UI
