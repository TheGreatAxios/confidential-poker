# Frontend Multi-Table Migration Plan

## Context

The smart contracts were rewritten with new architecture. The frontend is still hardcoded to a single table. This plan migrates the frontend to support the new contracts.

### Current Frontend State
- Single `PokerGame` address in `config.ts`
- `useGameState.ts` reads from one table
- `usePokerTable.ts` reads from one table
- `JoinPanel.tsx` does approve(ERC20) → sitDown(viewerKey)
- `GameControls.tsx` sends txs to one hardcoded address
- No lobby, no table selection, no chip deposit flow

### New Contract Architecture
1. **PokerFactory.sol** — deploys `PokerGame` instances, tracks all tables via `getAllTables()`, `getTablesByBuyIn()`, `getTableInfo()`. Fee collection and withdrawal.
2. **ChipToken.sol** — ERC20 wrapping an underlying token 1:1. `deposit(amount)` mints chips, `withdraw(amount)` burns chips and returns underlying. Tables use ChipToken for all mechanics (not the raw ERC20).
3. **PokerGame.sol** — updated with:
   - Leave queue: `requestLeave()`, `cancelLeave()`, auto-processed at hand end
   - Side pots + split pots: `_distributePots()` with per-player contribution tracking, multiple `PotAwarded` events per hand
   - `minBuyIn`, `maxBuyIn`, `chipToken()` view functions
   - New events: `PotAwarded(address, uint256)`, `PlayerWentAllIn(address, uint256)`, `LeaveRequested(address)`, `LeaveCancelled(address)`
4. **Math fix** — pot only accumulated via `_collectBets()`, no double-counting

### Key Files (read these first)
- `src/lib/contracts.ts` — current ABI (single PokerGame)
- `src/lib/config.ts` — single address config
- `src/lib/types.ts` — all TypeScript types
- `src/hooks/useGameState.ts` — main game state hook (reads single table, builds GameState)
- `src/hooks/usePokerTable.ts` — raw contract reads (phase, pot, etc.)
- `src/components/JoinPanel.tsx` — join flow (approve + sitDown)
- `src/components/GameControls.tsx` — all player actions (fold, check, call, raise, leave)
- `src/components/PokerTable.tsx` — table rendering
- `src/components/PotDisplay.tsx` — pot display (single pot only)
- `src/components/ShowdownSummary.tsx` — showdown results
- `src/App.tsx` — root component

---

## Implementation Phases

Execute these phases in order. Each phase should be a separate prompt/session boundary.

---

### Phase 1: ABI & Config Foundation

**Goal:** Replace single-table hardcoded addresses with factory-driven architecture.

**Tasks:**

1. Update `src/lib/config.ts`:
   - Replace `pokerTableAddress` and `tokenAddress` with `factoryAddress` and `underlyingTokenAddress`
   - Keep all chain/rpc/explorer config unchanged

2. Update `src/lib/contracts.ts`:
   - Add `POKER_FACTORY_ABI` with functions:
     - `createTable(uint256 buyIn, uint256 smallBlind, uint256 bigBlind, uint256 maxPlayers)` payable
     - `getAllTables()` returns `address[]`
     - `getTablesByBuyIn(uint256 buyIn)` returns `address[]`
     - `getTableInfo(address table)` returns tuple of (buyIn, smallBlind, bigBlind, maxPlayers, playerCount, isActive)
     - `feeRecipient()` returns address
     - `withdrawFees(address token, uint256 amount)`
     - Events: `TableCreated(address indexed table, address indexed creator, uint256 buyIn)`
   - Add `CHIP_TOKEN_ABI` with functions:
     - `deposit(uint256 amount)` — transfer underlying in, mint chips
     - `withdraw(uint256 amount)` — burn chips, transfer underlying back
     - `underlyingToken()` returns address
     - Standard ERC20 (balanceOf, approve, allowance, transfer, decimals, symbol)
   - Update `POKER_GAME_ABI` (currently `POKER_TABLE_ABI`):
     - Add: `requestLeave()`, `cancelLeave()`, `chipToken()`, `minBuyIn()`, `maxBuyIn()`
     - Add events: `PotAwarded(address indexed player, uint256 amount)`, `LeaveRequested(address indexed player)`, `LeaveCancelled(address indexed player)`
     - Keep all existing functions and events
   - Export `POKER_FACTORY_ADDRESS` from new config
   - Keep `isContractDeployed()` helper
   - Rename `POKER_TABLE_ABI` → `POKER_GAME_ABI` (update all imports)

**Verification:** `npm run typecheck` passes. No runtime changes yet.

---

### Phase 2: Type System Updates

**Goal:** Add types needed for multi-table, chip tokens, side pots, and leave queue.

**Tasks:**

1. Update `src/lib/types.ts`:
   - Add `TableInfo` interface:
     ```ts
     interface TableInfo {
       address: `0x${string}`;
       buyIn: bigint;
       smallBlind: bigint;
       bigBlind: bigint;
       maxPlayers: number;
       playerCount: number;
       isActive: boolean;
     }
     ```
   - Add `SidePot` interface:
     ```ts
     interface SidePot {
       amount: bigint;
       eligiblePlayerIds: string[];
       winnerIds: string[];
     }
     ```
   - Add `"leaving"` to `PlayerStatus` union
   - Update `GameState`:
     - Add `tableAddress: string`
     - Add `sidePots: SidePot[]`
     - Add `humanPlayer.leaveRequested: boolean`
     - Add `humanPlayer.chipTokenBalance: bigint`
   - Add `FactoryState` type for lobby:
     ```ts
     interface FactoryState {
       tables: TableInfo[];
       isLoading: boolean;
       error: string | null;
     }
     ```

**Verification:** `npm run typecheck` passes. Components will have type errors until later phases — that's expected.

---

### Phase 3: New Hooks

**Goal:** Build the data layer for factory, chip tokens, and parameterized table reads.

**Tasks:**

1. Create `src/hooks/useFactory.ts`:
   - Reads from `POKER_FACTORY_ADDRESS` using `POKER_FACTORY_ABI`
   - `getAllTables()` → `address[]`
   - For each table address, call `getTableInfo(address)` → `TableInfo[]`
   - Returns `{ tables: TableInfo[], isLoading, error, refetch }`
   - Refetch interval: 10s (tables change less frequently)

2. Create `src/hooks/useChipToken.ts`:
   - Takes `chipTokenAddress` parameter (resolved from game contract)
   - Reads: `balanceOf(user)`, `underlyingToken()`, `allowance(user, game)`, `decimals()`, `symbol()`
   - Writes (via `useWriteContract`):
     - `deposit(amount)` — requires prior `underlying.approve(chipToken, amount)`
     - `withdraw(amount)`
     - `approve(game, amount)` — approve game contract to spend chip tokens
   - Returns `{ chipBalance, underlyingBalance, needsDeposit, needsApproval, deposit, withdraw, approve, ... }`

3. Refactor `src/hooks/usePokerTable.ts`:
   - Accept `tableAddress: \`0x${string}\`` parameter (required)
   - Replace all `POKER_TABLE_ADDRESS` references with `tableAddress`
   - Add read for `chipToken()` address
   - Keep all existing reads (phase, pot, currentBet, etc.)
   - Returns same `PokerTableState` shape plus `chipTokenAddress`

4. Refactor `src/hooks/useGameState.ts`:
   - Accept `tableAddress: \`0x${string}\`` parameter
   - Pass `tableAddress` to `usePokerTable(tableAddress)`
   - Replace all `POKER_TABLE_ADDRESS` references with `tableAddress`
   - Event listeners: replace hardcoded address with `tableAddress`
   - Add event listeners for:
     - `PotAwarded` → build `sidePots` array (group by eligible players)
     - `LeaveRequested` → track `leaveRequested` per player
     - `LeaveCancelled` → clear `leaveRequested`
   - Populate `gameState.sidePots` from `PotAwarded` events
   - Populate `gameState.humanPlayer.leaveRequested`
   - Handle multiple `Winner` events correctly (already partially done, but side pots mean multiple winners with different amounts per pot)
   - Set `gameState.tableAddress = tableAddress`

5. Create `src/hooks/useTableActions.ts`:
   - Takes `tableAddress: \`0x${string}\`` parameter
   - Wraps `useWriteContract()` with all game actions:
     - `fold()`, `check()`, `call()`, `raise(amount)`
     - `dealNewHand()`
     - `leaveTable()`, `forfeitAndLeave()`
     - `requestLeave()`, `cancelLeave()`
   - Each action: sends tx → waits for receipt → returns result
   - Tracks `acting` state (mutual exclusion)
   - Returns `{ actions, acting, error }`

**Verification:** `npm run typecheck` passes for all new/updated hooks. Existing components still broken (expected).

---

### Phase 4: Lobby & Routing

**Goal:** Add table browsing and selection before entering a game.

**Tasks:**

1. Create `src/components/TableLobby.tsx`:
   - Uses `useFactory()` to list all tables
   - Grid layout (2-3 columns on desktop, 1 on mobile)
   - Each table card shows:
     - Buy-in amount, blinds (SB/BB)
     - Player count / max players
     - Active/inactive status
     - "Join" button → sets selected table
   - "Create Table" button → opens `CreateTableModal`
   - Loading skeleton state
   - Empty state ("No tables yet. Create one!")

2. Create `src/components/CreateTableModal.tsx`:
   - Modal overlay with glassmorphism style (match existing design)
   - Form fields:
     - Buy-in (number input, with token symbol)
     - Small blind (number input)
     - Big blind (number input, defaults to 2x small blind)
     - Max players (select: 2-6)
   - Calls `factory.createTable(buyIn, sb, bb, maxPlayers)` with ETH value for CTX gas reserve
   - Shows tx status (confirming → success → redirect to table)
   - Cancel button to dismiss

3. Update `src/App.tsx`:
   - Add state: `selectedTableAddress: \`0x${string}\` | null`
   - If no table selected → render `<TableLobby onSelectTable={setSelectedTable} />`
   - If table selected → render existing game view (PokerTable, GameControls, etc.)
   - Add "Back to Lobby" button in header when at a table
   - Pass `tableAddress` to `useGameState` and `useTableActions`

**Verification:** Full app renders. Can browse tables, create a table, select a table to play.

---

### Phase 5: Join Flow with ChipToken

**Goal:** Update the join flow to handle deposit → approve → sitDown.

**Tasks:**

1. Update `src/components/JoinPanel.tsx`:
   - Accept `tableAddress` and `tableInfo: TableInfo` props
   - New multi-step flow:
     1. Check underlying token balance
     2. If no chip tokens: `approve(underlying, chipToken, buyIn)` → `chipToken.deposit(buyIn)`
     3. `approve(chipToken, game, buyIn)` (if not already approved)
     4. `game.sitDown(viewerKey)` (unchanged)
   - Show step progress indicator (1/3 → 2/3 → 3/3)
   - Each step shows tx hash with explorer link
   - Error handling per step with retry
   - After join: call `onJoined(address)` and trigger refetch

2. Add chip balance display to `PlayerHandPanel.tsx`:
   - Show chip token balance alongside table chips
   - Show "Deposit more chips" link if balance is low

**Verification:** Full join flow works end-to-end with chip token deposit.

---

### Phase 6: Game UI Updates

**Goal:** Update game controls and display for new contract features.

**Tasks:**

1. Update `src/components/GameControls.tsx`:
   - Replace all hardcoded `POKER_TABLE_ADDRESS` with dynamic `tableAddress`
   - Use `useTableActions(tableAddress)` instead of inline `useWriteContract`
   - Add **"Request Leave"** button:
     - Visible when: seated, during active hand (not waiting phase)
     - Calls `requestLeave()`
     - Shows confirmation: "You'll leave at the end of this hand"
   - Add **"Cancel Leave"** button:
     - Visible when: `leaveRequested === true`
     - Calls `cancelLeave()`
   - Replace inline action handlers with hook methods
   - Keep all existing buttons (fold, check, call, raise, all-in, leave, deal)

2. Update `src/components/PotDisplay.tsx`:
   - Accept `sidePots: SidePot[]` prop
   - When `sidePots.length <= 1`: current single-pot display (unchanged)
   - When `sidePots.length > 1`: show pot breakdown
     - Main pot + each side pot with amount
     - Each pot lists eligible player names
     - Collapsed by default, click to expand
   - Use monospace amounts, gold color scheme

3. Update `src/components/ShowdownSummary.tsx`:
   - Accept `sidePots: SidePot[]` prop
   - For each side pot, show which player(s) won it
   - "Split Pot" badge when tied players share a pot
   - Show pot amount per winner
   - Highlighted winner cards with pot allocation

4. Update `src/components/AgentSeat.tsx` and `src/components/AgentAvatar.tsx`:
   - Accept `leaveRequested: boolean` prop
   - When `leaveRequested`: show dimmed overlay + "Leaving..." text
   - Add "leaving" to visual status rendering

5. Update `src/components/PokerTable.tsx`:
   - Pass `sidePots` and `leaveRequested` down to children
   - Pass `tableAddress` to all children that need it

**Verification:** All game actions work. Side pots display correctly. Leave queue UI shows pending state.

---

### Phase 7: Polish & Context (Optional)

**Goal:** Clean up prop drilling, add context provider.

**Tasks:**

1. Create `src/contexts/TableContext.tsx`:
   - Provides `{ tableAddress, gameState, actions, tableInfo }` via context
   - Wraps the active table view in App.tsx
   - `GameControls`, `PlayerHandPanel`, `PokerTable`, `AgentSeat` consume context instead of props
   - Reduces prop drilling for `tableAddress` and `gameState`

2. Final cleanup:
   - Remove all remaining hardcoded address references
   - Ensure all components use dynamic `tableAddress`
   - Test with multiple tables (switch between tables in lobby)
   - Verify event listeners filter by correct table address

**Verification:** Full app works with multiple tables. Can switch between tables. No hardcoded addresses remain.

---

## Notes

- The new contract ABIs need to be provided (copy from `packages/contracts/artifacts` after build)
- The factory address needs to be deployed and set in config before frontend works
- All existing visual design (glassmorphism, poker theme, animations) should be preserved
- The `encrypted-cards.ts`, `viewer-key.ts`, `hand-evaluator.ts` modules are unchanged
- The `FaucetPanel.tsx` and `TipButton.tsx` remain unchanged
- No new npm dependencies required for Phases 1-6 (react-router is optional)
