import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";

export interface ActionLog {
  handNumber: number;
  seat: number;
  action: string;
  amount: string;
  thinking: string;
  gameSnapshot: string;
  createdAt: string;
}

export interface MemoryBackend {
  checkpointer: BaseCheckpointSaver;
  logAction(entry: ActionLog): Promise<void>;
  getHandHistory(limit: number): Promise<ActionLog[]>;
  getSessionState(key: string): Promise<string | null>;
  setSessionState(key: string, value: string): Promise<void>;
}
