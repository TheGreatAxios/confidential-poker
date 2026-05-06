export const BASE_POKER_KNOWLEDGE = `## Poker Fundamentals (Guaranteed Knowledge)

### Hand Rankings
Royal Flush > Straight Flush > Four of a Kind > Full House > Flush > Straight > Three of a Kind > Two Pair > One Pair > High Card

### Pot Odds
Pot Odds = Call Amount / (Current Pot + Call Amount)
Only call if your hand equity exceeds pot odds.

### Position Value
- In position (acting last): +20-30% equity advantage
- Out of position (acting first): Tighten range by 10-15%

### On-Chain Finality
All actions are final once confirmed on-chain. No takebacks. Transactions are public on SKALE blockchain.

### Guardrails
- Verify it is your turn before acting (use get_game_state)
- Never raise below MIN_BET (0.5 tokens = 5 * 10**17 wei)
- Fold weak hands if uncertain — survival matters
- Check balances before joining tables
- Log every action with reasoning to build hand history
- Read community cards carefully before deciding`;
