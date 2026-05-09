import type { ActionLog, MemoryBackend } from "./types";
import { SafeMemorySaver } from "./checkpointer";

export class InMemoryBackend implements MemoryBackend {
  checkpointer: SafeMemorySaver;
  private logs: ActionLog[] = [];
  private session: Map<string, string> = new Map();

  constructor() {
    this.checkpointer = new SafeMemorySaver();
  }

  async logAction(entry: ActionLog): Promise<void> {
    this.logs.push(entry);
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-500);
    }
  }

  async getHandHistory(limit: number): Promise<ActionLog[]> {
    return this.logs.slice(-limit);
  }

  async getSessionState(key: string): Promise<string | null> {
    return this.session.get(key) ?? null;
  }

  async setSessionState(key: string, value: string): Promise<void> {
    this.session.set(key, value);
  }
}
