// ============================================================
// Frontend TypeScript types for AI Poker Night
// Extends shared domain types with UI-specific fields
// ============================================================

import type {
  Suit,
  Rank,
  Card,
  PokerAction,
  PlayerStatus,
  GamePhase,
  TableInfo,
  SidePot,
  FactoryState,
  FaucetState,
  TipState,
  SeatPosition,
} from "@confidential-poker/poker-types";

import { SEAT_POSITIONS } from "@confidential-poker/poker-types";

export type {
  Suit,
  Rank,
  Card,
  PokerAction,
  PlayerStatus,
  GamePhase,
  TableInfo,
  SidePot,
  FactoryState,
  FaucetState,
  TipState,
  SeatPosition,
};

export { SEAT_POSITIONS };

export type AgentPersonality =
  | "aggressive"
  | "cautious"
  | "bluffer"
  | "calculator"
  | "tight"
  | "loose";

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
  isSmallBlind: boolean;
  isBigBlind: boolean;
  isThinking: boolean;
  isWinner: boolean;
  cardsRevealed: boolean;
  message: string | null;
  seatIndex: number;
  winRate: number;
  handsPlayed: number;
  color: string;
  handComplete: boolean;
  handOutcome: "winner" | "lost" | "folded" | null;
  leaveRequested: boolean;
}

export interface GameState {
  tableAddress: `0x${string}`;
  chipTokenAddress: `0x${string}` | null;
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
  handSummary: {
    headline: string;
    detail: string | null;
    winnerNames: string[];
    endedBy: "showdown" | "folds" | "unknown";
  } | null;
  winners: string[] | null;
  canStartNextHand: boolean;
  handComplete: boolean;
  sidePots: SidePot[];
  humanPlayer: {
    isConnected: boolean;
    address: string | null;
    viewerKey: string | null;
    chips: bigint;
    cards: Card[];
    status: PlayerStatus;
    currentBet: bigint;
    seatIndex: number;
    isWinner: boolean;
    leaveRequested: boolean;
    chipTokenBalance: bigint;
  } | null;
}

export const PERSONALITY_CONFIG: Record<AgentPersonality, { label: string; color: string; emoji: string }> = {
  aggressive: { label: "Aggressive", color: "text-red-400", emoji: "🔥" },
  cautious: { label: "Cautious", color: "text-blue-400", emoji: "🛡️" },
  bluffer: { label: "Bluffer", color: "text-purple-400", emoji: "🎭" },
  calculator: { label: "Calculator", color: "text-green-400", emoji: "🧮" },
  tight: { label: "Tight", color: "text-yellow-400", emoji: "🔒" },
  loose: { label: "Loose", color: "text-pink-400", emoji: "🎲" },
};
