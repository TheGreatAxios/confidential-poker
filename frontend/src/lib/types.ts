// ============================================================
// AI Poker Night — TypeScript Types
// ============================================================

/** Card encoding: rank (2-14) in bits 0-3, suit (0-3) in bits 4-5 */
export interface CardData {
  rank: number;      // 2-14 (14 = Ace)
  suit: number;      // 0=spades, 1=hearts, 2=diamonds, 3=clubs
  encrypted: boolean; // true = face-down / encrypted
}

export interface AgentInfo {
  id: number;
  name: string;
  emoji: string;
  color: string;
  personality: "Aggressive" | "Conservative" | "Deceptive" | "Mathematical" | "Loose" | "Tight";
  description: string;
}

export interface AgentState {
  id: number;
  name: string;
  emoji: string;
  color: string;
  personality: string;
  stack: number;
  currentBet: number;
  cards: CardData[];
  action: string;
  folded: boolean;
  allIn: boolean;
  isDealer: boolean;
  isSB: boolean;
  isBB: boolean;
  isActive: boolean;
  isWinner: boolean;
}

export interface AgentStats {
  id: number;
  name: string;
  emoji: string;
  color: string;
  personality: string;
  handsPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  bluffs: number;
  bluffRate: number;
  totalWon: number;
  totalLost: number;
  tipsReceived: number;
  chipHistory: number[]; // last N hands for sparkline
}

export type Phase =
  | "Waiting"
  | "Pre-Flop"
  | "Flop"
  | "Turn"
  | "River"
  | "Showdown";

export interface GameState {
  id: string;
  handNumber: number;
  phase: Phase;
  pot: number;
  communityCards: CardData[];
  agents: AgentState[];
  deckCount: number;
  isRunning: boolean;
  ante: number;
}

export type SeatPosition = "top" | "bottom" | "left" | "right";

export type ActionType = "fold" | "check" | "call" | "raise" | "all-in" | "wait";

export interface ToastMessage {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}
