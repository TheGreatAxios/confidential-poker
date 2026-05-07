import type { ActionLog, MemoryBackend } from "./types";
import Database from "bun:sqlite";
import { SafeMemorySaver } from "./checkpointer";

export class SqliteBackend implements MemoryBackend {
  checkpointer: SafeMemorySaver;
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS game_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hand_number INTEGER NOT NULL,
        seat INTEGER NOT NULL,
        action TEXT NOT NULL,
        amount TEXT NOT NULL DEFAULT '0',
        thinking TEXT NOT NULL DEFAULT '',
        game_snapshot TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS session_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    this.checkpointer = new SafeMemorySaver();
  }

  async logAction(entry: ActionLog): Promise<void> {
    this.db.run(
      `INSERT INTO game_actions (hand_number, seat, action, amount, thinking, game_snapshot, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [entry.handNumber, entry.seat, entry.action, entry.amount, entry.thinking, entry.gameSnapshot, entry.createdAt],
    );
  }

  async getHandHistory(limit: number): Promise<ActionLog[]> {
    const rows = this.db.query(
      `SELECT hand_number, seat, action, amount, thinking, game_snapshot, created_at
       FROM game_actions ORDER BY id DESC LIMIT ?`,
    ).all(limit) as Array<{
      hand_number: number;
      seat: number;
      action: string;
      amount: string;
      thinking: string;
      game_snapshot: string;
      created_at: string;
    }>;
    return rows.map((r) => ({
      handNumber: r.hand_number,
      seat: r.seat,
      action: r.action,
      amount: r.amount,
      thinking: r.thinking,
      gameSnapshot: r.game_snapshot,
      createdAt: r.created_at,
    }));
  }

  async getSessionState(key: string): Promise<string | null> {
    const row = this.db.query(
      `SELECT value FROM session_state WHERE key = ?`,
    ).get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  async setSessionState(key: string, value: string): Promise<void> {
    this.db.run(
      `INSERT INTO session_state (key, value, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value],
    );
  }
}
