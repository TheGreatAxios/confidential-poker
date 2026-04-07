// ============================================================
// Shared TypeScript types for AI Poker Night
// ============================================================

export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface Card {
  suit: Suit;
  rank: Rank;
  faceUp?: boolean;
}

export type AgentPersonality =
  | "aggressive"
  | "cautious"
  | "bluffer"
  | "calculator"
  | "tight"
  | "loose";

export type PlayerStatus =
  | "waiting"
  | "acting"
  | "folded"
  | "all-in"
  | "busted";

export type GamePhase =
  | "waiting"
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "showdown";

export interface Agent {
  id: string;
  name: string;
  personality: AgentPersonality;
  emoji: string;
  chips: bigint;
  cards: Card[];
  status: PlayerStatus;
  currentBet: bigint;
  isDealer: boolean;
  isThinking: boolean;
  message: string | null;
  seatIndex: number;
  winRate: number;
  handsPlayed: number;
  color: string;
}

export interface GameState {
  phase: GamePhase;
  communityCards: Card[];
  pot: bigint;
  currentBet: bigint;
  minRaise: bigint;
  dealerIndex: number;
  currentPlayerIndex: number | null;
  agents: Agent[];
  handNumber: number;
  roundNumber: number;
  lastAction: string | null;
  winners: string[] | null;
  humanPlayer: {
    isConnected: boolean;
    address: string | null;
    viewerKey: string | null;
    chips: bigint;
    cards: Card[];
    status: PlayerStatus;
    currentBet: bigint;
    seatIndex: number;
  } | null;
}

export interface FaucetState {
  isLoading: boolean;
  txHash: string | null;
  error: string | null;
  lastClaim: number | null;
}

export interface TipState {
  isLoading: boolean;
  txHash: string | null;
  error: string | null;
}

// Seat positions around the table (clockwise from top-left)
export const SEAT_POSITIONS = [
  "top-left",    // 0
  "top-center",  // 1
  "top-right",   // 2
  "bottom-right",// 3
  "bottom-center",// 4
  "bottom-left", // 5
] as const;

export type SeatPosition = (typeof SEAT_POSITIONS)[number];

// Personality display config
export const PERSONALITY_CONFIG: Record<AgentPersonality, { label: string; color: string; emoji: string }> = {
  aggressive: { label: "Aggressive", color: "text-red-400", emoji: "🔥" },
  cautious: { label: "Cautious", color: "text-blue-400", emoji: "🛡️" },
  bluffer: { label: "Bluffer", color: "text-purple-400", emoji: "🎭" },
  calculator: { label: "Calculator", color: "text-green-400", emoji: "🧮" },
  tight: { label: "Tight", color: "text-yellow-400", emoji: "🔒" },
  loose: { label: "Loose", color: "text-pink-400", emoji: "🎲" },
};
