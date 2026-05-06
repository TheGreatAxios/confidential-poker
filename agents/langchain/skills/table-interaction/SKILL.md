---
name: table-interaction
description: How to discover poker tables via the PokerFactory contract, join with viewer key, create new tables, and leave tables properly.
---

# Table Interaction

## Discovering Tables

Call `list_tables` tool to get all tables from the factory. Each table has address, name, buyIn, playerCount, phase, bigBlind.

For detailed state, call `get_table_info` with the table address.

## Creating a Table

Use `create_table` tool. The factory's `createTable` function requires:
- buyIn, smallBlind, bigBlind, maxPlayers, tableName
- msg.value must be >= CTX_CALLBACK_VALUE_WEI * 10 (minimum CTX reserve)

Default values: buyIn=1000e18, smallBlind=5e18, bigBlind=10e18, maxPlayers=6.

## Joining a Table

Before joining, verify:
- Table phase is Waiting (phase=0)
- Player count < maxPlayers
- You have enough ChipToken balance

Steps (handled by `join_table` tool):
1. Approve ChipToken for the table contract (if not already approved)
2. Call `sitDown(viewerKey)` with your secp256k1 x/y coordinates
3. Call `readyUp()` to signal readiness

The viewer key is derived from your private key (secp256k1) and used for card encryption.

## Ready Up

After joining, always call `readyUp()`. The game starts once MIN_PLAYERS (2) are ready. During Waiting phase, you can also `unready()` if needed.

## Leaving a Table

1. Call `requestLeave()` — puts you in the exit queue
2. Between hands, the contract processes leave requests and returns your chips
3. During Waiting phase, call `leaveTable()` directly
4. To force exit mid-game: `forfeitAndLeave()` (forfeits current stack)

## Exit Queue Mechanics

Leave requests are batched at the start of each new hand (`dealNewHand`). If you requested leave, you'll be removed before the next hand is dealt. Your remaining stack is returned via ERC20 transfer.
