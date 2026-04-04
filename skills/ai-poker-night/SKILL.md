# AI Poker Night

## Description
Play Texas Hold'em poker on SKALE against AI agents. Cards are encrypted with BITE so nobody can peek. Buy-in and cash-out are gasless via EIP-3009. Your wallet talks directly to the smart contract — no middleman.

## Prerequisites
- A wallet with sFUEL on SKALE Base Sepolia
- [RainbowKit](https://www.rainbowkit.com/) or any EIP-1193 wallet

## Getting sFUEL

Run the FaucetDrip contract to get 0.05 ETH (sFUEL) per drip (1hr cooldown):
```bash
# Using cast
cast send $FAUCET_ADDRESS "drip()" --rpc-url https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha --private-key $YOUR_KEY
```

Or use the sFUEL miner skill to top up automatically.

## Playing a Hand

### 1. Join a Table
Call `joinTable()` on PokerTable with a buy-in amount (native ETH until PokerChip is integrated):
```bash
cast send $POKER_GAME_ADDRESS "joinTable()" --value 0.01ether --rpc-url $RPC_URL --private-key $YOUR_KEY
```

### 2. Game Flow
The contract enforces Texas Hold'em rules automatically:
- **Waiting** → enough players join → **Preflop** → **Flop** → **Turn** → **River** → **Showdown** → **Finished**
- Blinds are posted automatically when the hand starts
- Community cards are dealt on-chain (BITE-encrypted until reveal)

### 3. Take an Action
When it's your turn, call one of:
```bash
# Fold
cast send $POKER_GAME_ADDRESS "fold()" --rpc-url $RPC_URL --private-key $YOUR_KEY

# Check (no bet to call)
cast send $POKER_GAME_ADDRESS "check()" --rpc-url $RPC_URL --private-key $YOUR_KEY

# Call (match current bet)
cast send $POKER_GAME_ADDRESS "call()" --value <amount> --rpc-url $RPC_URL --private-key $YOUR_KEY

# Raise
cast send $POKER_GAME_ADDRESS "raise(uint256)" <totalAmount> --value <totalAmount> --rpc-url $RPC_URL --private-key $YOUR_KEY
```

Or use the frontend — all actions go wallet→contract directly via RainbowKit.

### 4. Showdown
At showdown, the contract reveals hands using BITE viewer keys. Use your viewer key to decrypt your own hole cards. The HandEvaluator library ranks hands automatically and awards the pot.

### 5. Cash Out
Leave the table and withdraw your balance (1% withdrawal fee applies):
```bash
cast send $POKER_GAME_ADDRESS "withdraw()" --rpc-url $RPC_URL --private-key $YOUR_KEY
```

**Note**: Early quit before showdown incurs a 10% penalty.

## AI Agents

The server runs autonomous poker agents with different personalities:
| Agent | Style |
|-------|-------|
| Rage Bot | Aggressive, raises frequently |
| Caution Bot | Tight, only plays strong hands |
| Bluff Master | Mixes bluffs with solid play |
| Math Genius | Probability-based decisions |

To deploy your own agent, see the [poker-agents skill](/skills/poker-agents/SKILL.md) — each agent is an independent wallet with its own BITE viewer key and strategy loop.

## Frontend

The web UI handles everything wallet-side:
1. Connect wallet via RainbowKit
2. Browse open tables or create one
3. Join, play actions, watch showdown in real-time
4. No server needed for game actions — all calls go directly to the contract

```bash
cd frontend && npm install && npm run dev
# Set NEXT_PUBLIC_POKER_TABLE_ADDRESS and NEXT_PUBLIC_FAUCET_ADDRESS in .env.local
```

## Contract Addresses (SKALE Base Sepolia)

| Contract | Env Variable |
|----------|-------------|
| PokerTable | `POKER_GAME_ADDRESS` |
| FaucetDrip | `NEXT_PUBLIC_FAUCET_ADDRESS` |
| MockSKL | `MOCK_SKL_ADDRESS` |
| PokerChip | `POKER_CHIP_ADDRESS` (pending) |

**RPC**: `https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha`
**Chain ID**: 324705682

## References
- [BITE Protocol](https://docs.skale.network/bite)
- [SKALE Docs](https://docs.skale.network)
- [EIP-3009](https://eips.ethereum.org/EIPS/eip-3009)
- [GitHub](https://github.com/TheGreatAxios/ai-poker-night)
