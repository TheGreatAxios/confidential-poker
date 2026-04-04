// ============================================================
// Confidential Poker — TypeScript Types
// ============================================================

/** Card encoding from contract: (suit << 4) | rank */
export interface CardData {
  rank: number;      // 2-14 (14 = Ace)
  suit: number;      // 0=spades, 1=hearts, 2=diamonds, 3=clubs
  encrypted: boolean; // true = face-down / BITE-encrypted
}

/** Phase enum matching PokerTable.sol GamePhase */
export type Phase =
  | "Waiting"    // 0
  | "Preflop"    // 1
  | "Flop"       // 2
  | "Turn"       // 3
  | "River"      // 4
  | "Showdown"   // 5
  | "Finished";  // 6

/** Phase number → name mapping */
export const PHASE_MAP: Record<number, Phase> = {
  0: "Waiting",
  1: "Preflop",
  2: "Flop",
  3: "Turn",
  4: "River",
  5: "Showdown",
  6: "Finished",
};

/** Player state derived from contract Player struct */
export interface PlayerState {
  address: `0x${string}`;
  stack: bigint;
  currentBet: bigint;
  folded: boolean;
  hasActed: boolean;
  holeCards: [number, number]; // encoded cards (suit<<4)|rank
  isSeated: boolean;
  // Derived flags
  isDealer: boolean;
  isActive: boolean;   // is it this player's turn?
  isWinner: boolean;
}

/** Full game state read from contract */
export interface GameState {
  phase: Phase;
  pot: bigint;
  handNumber: bigint;
  communityCards: number[]; // encoded uint8 values
  players: PlayerState[];
  activePlayerAddress: `0x${string}`;
  dealerAddress: `0x${string}`;
  smallBlind: bigint;
  bigBlind: bigint;
  maxPlayers: bigint;
  minBuyIn: bigint;
  currentMaxBet: bigint;
  seatedPlayerCount: number;
  activePlayerCount: number;
  // Whether connected wallet is seated
  isConnectedSeated: boolean;
  // Whether it's connected wallet's turn
  isMyTurn: boolean;
}

/** Seat position around the table oval */
export type SeatPosition = "top" | "bottom" | "left" | "right";

/** Player action types */
export type ActionType = "fold" | "check" | "call" | "raise" | "all-in" | "wait";

/** Toast notification */
export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

/** Raw player data from contract getPlayers() */
export interface RawPlayer {
  addr: `0x${string}`;
  viewerKey: `0x${string}`;
  stack: bigint;
  currentBet: bigint;
  folded: boolean;
  hasActed: boolean;
  holeCards: [number, number];
  isSeated: boolean;
}
