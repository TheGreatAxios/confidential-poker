"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { GameState } from "@/lib/types";
import { MOCK_GAME_STATE, getRandomMessage } from "@/lib/mock-data";

const POLL_INTERVAL = 3000;
const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export function useGameState() {
  const [gameState, setGameState] = useState<GameState>(MOCK_GAME_STATE);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchGameState = useCallback(async () => {
    if (!API_URL) {
      // Use mock data with simulated updates
      setGameState((prev) => {
        const agents = prev.agents.map((agent) => ({
          ...agent,
          isThinking: Math.random() > 0.7,
          message: Math.random() > 0.6 ? getRandomMessage(agent.id) : agent.message,
        }));
        return { ...prev, agents };
      });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/game-state`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: GameState = await res.json();
      setGameState(data);
      setIsConnected(true);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch game state:", err);
      setError(err instanceof Error ? err.message : "Connection failed");
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    fetchGameState();
    intervalRef.current = setInterval(fetchGameState, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchGameState]);

  // Simulate periodic mock updates when no server
  useEffect(() => {
    if (API_URL) return;
    const id = setInterval(() => {
      setGameState((prev) => {
        const phases: GameState["phase"][] = ["preflop", "flop", "turn", "river", "showdown"];
        const currentIdx = phases.indexOf(prev.phase);
        // Occasionally advance the phase
        const advance = Math.random() > 0.85;
        const newPhase = advance
          ? phases[Math.min(currentIdx + 1, phases.length - 1)]
          : prev.phase;

        const agents = prev.agents.map((agent, i) => ({
          ...agent,
          isThinking: i === prev.currentPlayerIndex ? true : Math.random() > 0.8,
          message: Math.random() > 0.5 ? getRandomMessage(agent.id) : agent.message,
        }));

        return {
          ...prev,
          phase: newPhase,
          agents,
          lastAction: advance ? `Phase advanced to ${newPhase}` : prev.lastAction,
        };
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return { gameState, isConnected, error, refetch: fetchGameState };
}
