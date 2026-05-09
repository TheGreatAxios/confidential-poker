---
name: bankroll
description: Token flow for buying in, checking balances, managing ChipToken deposits/withdrawals, and gas on SKALE Base.
---

# Bankroll Management

## Token Flow

The poker system uses a two-token architecture:

1. **Underlying token** (ERC20) — your actual funds
2. **ChipToken** (wrapped token) — deposited into ChipToken contract, used for buy-ins

### To Buy In at a Table:
1. Approve ChipToken contract to spend your underlying tokens
2. Deposit underlying tokens → receive ChipTokens (via ChipToken.deposit)
3. Approve the PokerGame contract to spend your ChipTokens
4. Call sitDown() — contract pulls BUY_IN ChipTokens from you

## Checking Balances

Use `check_balance` tool. Returns:
- `credits`: sFUEL balance (native gas token on SKALE)
- `chipTokens`: ChipToken balance (for buy-ins)

## Checking Allowances

The agent's `join_table` tool handles approval automatically. It checks if ChipToken allowance >= buyIn and approves if needed.

## Withdrawing

To get funds back:
- Leave table → chips returned in ChipTokens
- Call ChipToken.withdraw(amount) → get underlying tokens back

## Gas on SKALE Base

SKALE uses a credit-based gas system:
- No need to hold ETH for gas
- sFUEL credits are deposited to your address
- Gas costs are minimal on SKALE
- The agent checks sFUEL balance and logs it

## Bankroll Monitoring

The agent checks bankroll in these situations:
- Before joining a table (verify sufficient ChipTokens)
- After a bust (stack = 0)
- Periodically during idle (every IDLE_BALANCE_CHECK_MS)
