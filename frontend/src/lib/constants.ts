// ============================================================
// Game Constants
// ============================================================

// Card suits
export const SUITS = ["♠", "♥", "♦", "♣"] as const;
export const SUIT_NAMES = ["Spades", "Hearts", "Diamonds", "Clubs"] as const;

// Card ranks
export const RANKS = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A",
] as const;

// Game phases — matches PokerTable.sol GamePhase enum
export const PHASES = [
  "Waiting",
  "Preflop",
  "Flop",
  "Turn",
  "River",
  "Showdown",
  "Finished",
] as const;

export type Phase = (typeof PHASES)[number];

// Action types
export type ActionType = "fold" | "check" | "call" | "raise" | "all-in" | "wait";

export const ACTION_COLORS: Record<ActionType, string> = {
  fold: "bg-poker-red/20 text-poker-red border-poker-red/30",
  check: "bg-poker-green/20 text-poker-green border-poker-green/30",
  call: "bg-poker-green/20 text-poker-green border-poker-green/30",
  raise: "bg-poker-amber/20 text-poker-amber border-poker-amber/30",
  "all-in": "bg-poker-gold/20 text-poker-gold border-poker-gold/30",
  wait: "bg-white/5 text-gray-500 border-white/10",
};

// Seat positions
export const SEAT_POSITIONS = [
  { id: 0, label: "top", gridArea: "top" },
  { id: 1, label: "top-right", gridArea: "topRight" },
  { id: 2, label: "bottom-right", gridArea: "bottomRight" },
  { id: 3, label: "bottom", gridArea: "bottom" },
  { id: 4, label: "bottom-left", gridArea: "bottomLeft" },
  { id: 5, label: "top-left", gridArea: "topLeft" },
] as const;

// Default gas limit for write calls (BITE precompiles need headroom)
export const DEFAULT_GAS_LIMIT = 500_000n;
