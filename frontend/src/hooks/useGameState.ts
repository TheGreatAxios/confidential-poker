"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { AGENTS } from "@/lib/constants";
import type { Phase } from "@/lib/types";

export interface CardData {
  rank: number;
  suit: number;
  encrypted: boolean;
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

const DEMO_STATE: GameState = {
  id: "demo-001",
  handNumber: 1,
  phase: "Pre-Flop" as Phase,
  pot: 450,
  communityCards: [],
  agents: AGENTS.map((agent, i) => ({
    id: agent.id,
    name: agent.name,
    emoji: agent.emoji,
    color: agent.color,
    personality: agent.personality,
    stack: [9200, 9800, 8550, 10000][i],
    currentBet: [100, 50, 200, 0][i],
    cards: [
      { rank: 14 - i, suit: i, encrypted: true },
      { rank: 13 - i, suit: (i + 1) % 4, encrypted: true },
    ],
    action: ["Raise", "Call", "Raise", "Wait"][i] as string,
    folded: false,
    allIn: false,
    isDealer: i === 0,
    isSB: i === 1,
    isBB: i === 2,
    isActive: i === 3,
    isWinner: false,
  })),
  deckCount: 44,
  isRunning: true,
  ante: 50,
};

export function useGameState(gameId: string = "current") {
  const [game, setGame] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const fetchGame = useCallback(async () => {
    try {
      const data = await api.getGame(gameId);
      setGame(data);
      setIsDemo(false);
    } catch {
      // Use demo state when server is not available
      if (!game) {
        setGame(DEMO_STATE);
        setIsDemo(true);
      }
    } finally {
      setLoading(false);
    }
  }, [gameId, game]);

  useEffect(() => {
    fetchGame();
    const interval = setInterval(fetchGame, 2000);
    return () => clearInterval(interval);
  }, [fetchGame]);

  return { game, loading, isDemo, refetch: fetchGame };
}
