export type Suit = "♠" | "♥" | "♦" | "♣";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";

export interface Card {
  suit: Suit;
  rank: Rank;
  faceUp?: boolean;
}

export type PokerAction = "fold" | "check" | "call" | "raise";

export type PlayerStatus =
  | "waiting"
  | "acting"
  | "folded"
  | "all-in"
  | "leaving"
  | "busted";

export type GamePhase =
  | "waiting"
  | "preflop"
  | "flop"
  | "turn"
  | "river"
  | "showdown";

export interface Player {
  id: string;
  address: `0x${string}`;
  name: string;
  chips: bigint;
  cards: Card[];
  status: PlayerStatus;
  currentBet: bigint;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  seatIndex: number;
  leaveRequested: boolean;
}

export interface TableInfo {
  address: `0x${string}`;
  buyIn: bigint;
  smallBlind: bigint;
  bigBlind: bigint;
  playerCount: number;
  pot: bigint;
  phase: GamePhase;
  name: string;
  isActive: boolean;
}

export interface SidePot {
  amount: bigint;
  winnerIds: string[];
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
  players: Player[];
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
}

export interface FactoryState {
  tables: TableInfo[];
  isLoading: boolean;
  error: string | null;
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

export const SEAT_POSITIONS = [
  "top-left",
  "top-center",
  "top-right",
  "bottom-right",
  "bottom-center",
  "bottom-left",
] as const;

export type SeatPosition = (typeof SEAT_POSITIONS)[number];
