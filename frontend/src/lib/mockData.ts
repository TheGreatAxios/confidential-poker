// ============================================================
// AI Poker Night — Mock Data for Standalone Demo
// ============================================================

import type { MockGameState, AgentState, CardData, AgentStats } from "./types";

// ---- Agent Definitions ----
export const MOCK_AGENTS: Omit<AgentState, "stack" | "currentBet" | "cards" | "action" | "folded" | "allIn" | "isDealer" | "isSB" | "isBB" | "isActive" | "isWinner">[] = [
  {
    id: 1,
    name: "Rage Bot",
    emoji: "🤬",
    color: "#EF4444",
    personality: "Aggressive",
  },
  {
    id: 2,
    name: "Caution",
    emoji: "🧐",
    color: "#3B82F6",
    personality: "Conservative",
  },
  {
    id: 3,
    name: "Bluffer",
    emoji: "🎭",
    color: "#A855F7",
    personality: "Deceptive",
  },
  {
    id: 4,
    name: "Calculus",
    emoji: "🧮",
    color: "#22C55E",
    personality: "Mathematical",
  },
];

// ---- Create cards ----
function makeCard(encoded: number, encrypted = false): CardData {
  return {
    rank: encoded & 0x0f,
    suit: (encoded >> 4) & 0x03,
    encrypted,
  };
}

// Sample hands for each demo phase
const PHASE_DATA = {
  "Pre-Flop": {
    communityCards: [] as CardData[],
    agents: [
      { stack: 9800, currentBet: 100, cards: [makeCard(0x2e, true), makeCard(0x3d, true)], action: "Raise", folded: false, allIn: false, isDealer: true, isSB: false, isBB: false, isActive: false, isWinner: false },
      { stack: 9750, currentBet: 50, cards: [makeCard(0x0a, true), makeCard(0x1b, true)], action: "Call", folded: false, allIn: false, isDealer: false, isSB: true, isBB: false, isActive: false, isWinner: false },
      { stack: 9900, currentBet: 200, cards: [makeCard(0x1c, true), makeCard(0x2b, true)], action: "Raise", folded: false, allIn: false, isDealer: false, isSB: false, isBB: true, isActive: false, isWinner: false },
      { stack: 10000, currentBet: 0, cards: [makeCard(0x3a, true), makeCard(0x0d, true)], action: "Wait", folded: false, allIn: false, isDealer: false, isSB: false, isBB: false, isActive: true, isWinner: false },
    ],
    pot: 450,
  },
  "Flop": {
    communityCards: [makeCard(0x0a), makeCard(0x1d), makeCard(0x2c)],
    agents: [
      { stack: 9700, currentBet: 150, cards: [makeCard(0x2e), makeCard(0x3d)], action: "Bet", folded: false, allIn: false, isDealer: true, isSB: false, isBB: false, isActive: false, isWinner: false },
      { stack: 9700, currentBet: 0, cards: [makeCard(0x0a), makeCard(0x1b)], action: "Call", folded: false, allIn: false, isDealer: false, isSB: true, isBB: false, isActive: false, isWinner: false },
      { stack: 9900, currentBet: 400, cards: [makeCard(0x1c), makeCard(0x2b)], action: "Raise", folded: false, allIn: false, isDealer: false, isSB: false, isBB: true, isActive: false, isWinner: false },
      { stack: 10000, currentBet: 0, cards: [makeCard(0x3a), makeCard(0x0d)], action: "Fold", folded: true, allIn: false, isDealer: false, isSB: false, isBB: false, isActive: false, isWinner: false },
    ],
    pot: 850,
  },
  "Turn": {
    communityCards: [makeCard(0x0a), makeCard(0x1d), makeCard(0x2c), makeCard(0x3b)],
    agents: [
      { stack: 9400, currentBet: 300, cards: [makeCard(0x2e), makeCard(0x3d)], action: "Bet", folded: false, allIn: false, isDealer: true, isSB: false, isBB: false, isActive: false, isWinner: false },
      { stack: 9400, currentBet: 300, cards: [makeCard(0x0a), makeCard(0x1b)], action: "Call", folded: false, allIn: false, isDealer: false, isSB: true, isBB: false, isActive: false, isWinner: false },
      { stack: 9900, currentBet: 0, cards: [makeCard(0x1c), makeCard(0x2b)], action: "Check", folded: false, allIn: false, isDealer: false, isSB: false, isBB: true, isActive: true, isWinner: false },
      { stack: 10000, currentBet: 0, cards: [makeCard(0x3a), makeCard(0x0d)], action: "Fold", folded: true, allIn: false, isDealer: false, isSB: false, isBB: false, isActive: false, isWinner: false },
    ],
    pot: 1450,
  },
  "River": {
    communityCards: [makeCard(0x0a), makeCard(0x1d), makeCard(0x2c), makeCard(0x3b), makeCard(0x0e)],
    agents: [
      { stack: 9100, currentBet: 500, cards: [makeCard(0x2e), makeCard(0x3d)], action: "All In", folded: false, allIn: true, isDealer: true, isSB: false, isBB: false, isActive: false, isWinner: false },
      { stack: 8900, currentBet: 500, cards: [makeCard(0x0a), makeCard(0x1b)], action: "Call", folded: false, allIn: false, isDealer: false, isSB: true, isBB: false, isActive: false, isWinner: true },
      { stack: 9900, currentBet: 0, cards: [makeCard(0x1c), makeCard(0x2b)], action: "Fold", folded: true, allIn: false, isDealer: false, isSB: false, isBB: true, isActive: false, isWinner: false },
      { stack: 10000, currentBet: 0, cards: [makeCard(0x3a), makeCard(0x0d)], action: "Fold", folded: true, allIn: false, isDealer: false, isSB: false, isBB: false, isActive: false, isWinner: false },
    ],
    pot: 2450,
  },
  "Showdown": {
    communityCards: [makeCard(0x0a), makeCard(0x1d), makeCard(0x2c), makeCard(0x3b), makeCard(0x0e)],
    agents: [
      { stack: 9100, currentBet: 0, cards: [makeCard(0x2e), makeCard(0x3d)], action: "Lost", folded: false, allIn: false, isDealer: true, isSB: false, isBB: false, isActive: false, isWinner: false },
      { stack: 11350, currentBet: 0, cards: [makeCard(0x0a), makeCard(0x1b)], action: "Won!", folded: false, allIn: false, isDealer: false, isSB: true, isBB: false, isActive: false, isWinner: true },
      { stack: 9900, currentBet: 0, cards: [makeCard(0x1c), makeCard(0x2b)], action: "Folded", folded: true, allIn: false, isDealer: false, isSB: false, isBB: true, isActive: false, isWinner: false },
      { stack: 10000, currentBet: 0, cards: [makeCard(0x3a), makeCard(0x0d)], action: "Folded", folded: true, allIn: false, isDealer: false, isSB: false, isBB: false, isActive: false, isWinner: false },
    ],
    pot: 0,
  },
};

// ---- Simulated Agent Stats ----
export const MOCK_AGENT_STATS: AgentStats[] = [
  {
    id: 1, name: "Rage Bot", emoji: "🤬", color: "#EF4444", personality: "Aggressive",
    handsPlayed: 24, wins: 8, losses: 16, winRate: 0.33, bluffs: 14, bluffRate: 0.58,
    totalWon: 4200, totalLost: 3800, tipsReceived: 3,
    chipHistory: [10000, 10200, 9800, 10500, 9900, 10100, 9700, 10400, 10000, 10200],
  },
  {
    id: 2, name: "Caution", emoji: "🧐", color: "#3B82F6", personality: "Conservative",
    handsPlayed: 24, wins: 10, losses: 14, winRate: 0.42, bluffs: 2, bluffRate: 0.08,
    totalWon: 3600, totalLost: 2800, tipsReceived: 5,
    chipHistory: [10000, 10100, 10300, 10200, 10500, 10400, 10600, 10500, 10800, 11350],
  },
  {
    id: 3, name: "Bluffer", emoji: "🎭", color: "#A855F7", personality: "Deceptive",
    handsPlayed: 24, wins: 5, losses: 19, winRate: 0.21, bluffs: 20, bluffRate: 0.83,
    totalWon: 3100, totalLost: 4200, tipsReceived: 1,
    chipHistory: [10000, 9800, 9600, 9900, 9400, 9700, 9200, 9500, 9100, 9900],
  },
  {
    id: 4, name: "Calculus", emoji: "🧮", color: "#22C55E", personality: "Mathematical",
    handsPlayed: 24, wins: 11, losses: 13, winRate: 0.46, bluffs: 4, bluffRate: 0.17,
    totalWon: 4800, totalLost: 3200, tipsReceived: 7,
    chipHistory: [10000, 10100, 10200, 10100, 10300, 10200, 10400, 10300, 10500, 10000],
  },
];

// ---- Phase cycling logic ----
const PHASE_ORDER: Array<keyof typeof PHASE_DATA> = ["Pre-Flop", "Flop", "Turn", "River", "Showdown"];

export function createMockGameState(handNumber: number, phaseIndex: number): MockGameState {
  const phaseKey = PHASE_ORDER[phaseIndex % PHASE_ORDER.length];
  const phaseState = PHASE_DATA[phaseKey];
  return {
    id: "demo-001",
    handNumber,
    phase: phaseKey,
    pot: phaseState.pot,
    communityCards: phaseState.communityCards,
    agents: MOCK_AGENTS.map((base, i) => ({
      ...base,
      ...phaseState.agents[i],
    })),
    deckCount: 52 - 8 - phaseState.communityCards.length,
    isRunning: phaseKey !== "Showdown",
    ante: 25,
  };
}

export const INITIAL_MOCK_STATE = createMockGameState(1, 0);
