import type { PublicClient, WalletClient } from "viem";

// ── On-Chain Action Types ──

/**
 * Action types matching the on-chain submitAction(uint8 actionType, uint256 amount).
 */
export enum ActionType {
  FOLD = 0,
  CHECK = 1,
  CALL = 2,
  RAISE = 3,
}

/**
 * Game phases as reported by getGameState().
 */
export enum GamePhase {
  WAITING = 0,
  PREFLOP = 1,
  FLOP = 2,
  TURN = 3,
  RIVER = 4,
  SHOWDOWN = 5,
}

export const PHASE_NAMES: string[] = [
  "Waiting",
  "Pre-Flop",
  "Flop",
  "Turn",
  "River",
  "Showdown",
];

// ── On-Chain Data Types ──

/**
 * On-chain player info returned by getPlayerInfo().
 */
export interface PlayerInfo {
  player: `0x${string}`;
  balance: bigint;
  currentBet: bigint;
  isFolded: boolean;
  isAllIn: boolean;
  card1: bigint;
  card2: bigint;
}

/**
 * On-chain game state returned by getGameState().
 */
export interface OnChainGameState {
  phase: number;
  pot: bigint;
  currentBet: bigint;
  dealerIndex: number;
  currentPlayerIndex: number;
  communityCards: bigint[];
}

/**
 * Formatted game state for the frontend API.
 */
export interface GameState {
  id: string;
  handNumber: number;
  phase: string;
  pot: number;
  communityCards: CardData[];
  agents: FrontendAgentState[];
  deckCount: number;
  isRunning: boolean;
}

// ── Card Types ──

export interface CardData {
  rank: number;
  suit: number;
  encrypted: boolean;
}

// ── Agent Personality (string enum for frontend) ──

export type AgentPersonality =
  | "aggressive"
  | "conservative"
  | "bluffer"
  | "mathematical"
  | "loose"
  | "tight";

// ── Agent Configuration (spec-defined lightweight Agent type) ──

export interface AgentConfig {
  id: string;
  name: string;
  personality: AgentPersonality;
  emoji: string;
  privateKey: `0x${string}`;
  address: `0x${string}`;
}

// ── Agent State (runtime state for a seat at the table) ──

export interface AgentRuntimeState {
  agent: AgentConfig;
  hand: number[];
  phase: "waiting" | "thinking" | "acted" | "folded" | "winner";
  lastAction: string;
  stack: bigint;
  currentBet: bigint;
}

// ── Frontend-facing Agent State ──

export interface FrontendAgentState {
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

// ── Personality Configuration (for PokerAgent decision engine) ──

/**
 * Personality configuration for the PokerAgent decision engine.
 */
export interface Personality {
  name: string;
  emoji: string;
  description: string;
  /** Likelihood of folding weak hands (0-1) */
  foldThreshold: number;
  /** Likelihood of raising (0-1) */
  raiseAggression: number;
  /** Bluff frequency (0-1) */
  bluffFrequency: number;
  /** Whether the agent considers pot odds */
  usesMath: boolean;
}

/**
 * Agent interface — each AI player implements this.
 */
export interface Agent {
  readonly name: string;
  readonly emoji: string;
  readonly personality: Personality;
  readonly address: `0x${string}`;
  readonly wallet: WalletClient;

  decideAction(
    gameState: OnChainGameState,
    playerInfo: PlayerInfo,
    minRaise: bigint,
    potOdds: number,
  ): { action: ActionType; amount: bigint };

  getChatMessage(
    gameState: OnChainGameState,
    playerInfo: PlayerInfo,
    action: ActionType,
  ): string;
}

/**
 * Represents a pending action from an agent (or timeout).
 */
export interface PendingAction {
  agentIndex: number;
  action: ActionType;
  amount: bigint;
  timestamp: number;
}

// ── Card Encoding Helpers ──

export function decodeCard(card: number): CardData {
  return {
    rank: card & 0x0f,
    suit: (card >> 4) & 0x03,
    encrypted: card === 0,
  };
}

export function encodeCard(rank: number, suit: number): number {
  return (suit << 4) | (rank & 0x0f);
}

export const RANK_NAMES: Record<number, string> = {
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
};

export const SUIT_SYMBOLS: string[] = ["♠", "♥", "♦", "♣"];
export const SUIT_COLORS: Record<number, string> = {
  0: "black", // Spades
  1: "red", // Hearts
  2: "red", // Diamonds
  3: "black", // Clubs
};
