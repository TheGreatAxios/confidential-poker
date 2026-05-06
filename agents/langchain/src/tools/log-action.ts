import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { MemoryBackend } from "../memory/types";

let _memoryBackend: MemoryBackend | null = null;

export function setLogActionBackend(backend: MemoryBackend): void {
  _memoryBackend = backend;
}

export const logAction = tool(
  async ({
    handNumber,
    action,
    amount,
    thinking,
    gameStateSnapshot,
  }: {
    handNumber: number;
    action: string;
    amount: string;
    thinking: string;
    gameStateSnapshot: string;
  }) => {
    try {
      if (!_memoryBackend) {
        return JSON.stringify({ error: "Memory backend not initialized" });
      }
      await _memoryBackend.logAction({
        handNumber,
        seat: 0,
        action,
        amount,
        thinking,
        gameSnapshot: gameStateSnapshot,
        createdAt: new Date().toISOString(),
      });
      return JSON.stringify({ logged: true, handNumber, action });
    } catch (err) {
      return JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "log_action",
    description: "Log an action with thinking and game state snapshot to durable memory. Call this after every action to build hand history.",
    schema: z.object({
      handNumber: z.number().describe("Current hand number"),
      action: z.string().describe("The action taken (fold/check/call/raise)"),
      amount: z.string().describe("Amount in wei if applicable"),
      thinking: z.string().describe("Your reasoning for this action"),
      gameStateSnapshot: z.string().describe("JSON snapshot of the game state at decision time"),
    }),
  },
);
