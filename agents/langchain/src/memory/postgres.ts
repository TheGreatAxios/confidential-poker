import type { ActionLog, MemoryBackend } from "./types";
import { SafeMemorySaver } from "./checkpointer";

interface PgRow {
  hand_number: number;
  seat: number;
  action: string;
  amount: string;
  thinking: string;
  game_snapshot: string;
  created_at: string | Date;
}

type QueryResult<T> = {
  rows: T[];
};

type PgClient = {
  query<T = unknown>(sql: string, values?: readonly unknown[]): Promise<QueryResult<T>>;
  release(): void;
};

type PgPool = {
  connect(): Promise<PgClient>;
  query<T = unknown>(sql: string, values?: readonly unknown[]): Promise<QueryResult<T>>;
};

type PgModule = {
  Pool: new (options: { connectionString: string }) => PgPool;
};

async function loadPgModule(): Promise<PgModule> {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<unknown>;
  const module = await dynamicImport("pg");
  if (!module || typeof module !== "object" || !("default" in module)) {
    throw new Error("Postgres memory backend requires the pg package");
  }

  const pg = (module as { default: unknown }).default;
  if (!pg || typeof pg !== "object" || !("Pool" in pg)) {
    throw new Error("Postgres memory backend could not load pg.Pool");
  }

  return pg as PgModule;
}

export class PostgresBackend implements MemoryBackend {
  checkpointer: SafeMemorySaver;
  private connectionString: string;
  private pool: PgPool | null = null;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
    this.checkpointer = new SafeMemorySaver();
  }

  private async getPool(): Promise<PgPool> {
    if (!this.pool) {
      const pg = await loadPgModule();
      this.pool = new pg.Pool({ connectionString: this.connectionString });
      const client = await this.pool.connect();
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS game_actions (
            id SERIAL PRIMARY KEY,
            hand_number BIGINT NOT NULL,
            seat INTEGER NOT NULL,
            action TEXT NOT NULL,
            amount TEXT NOT NULL DEFAULT '0',
            thinking TEXT NOT NULL DEFAULT '',
            game_snapshot JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        await client.query(`
          CREATE TABLE IF NOT EXISTS session_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
      } finally {
        client.release();
      }
    }
    return this.pool;
  }

  async logAction(entry: ActionLog): Promise<void> {
    const pool = await this.getPool();
    await pool.query(
      `INSERT INTO game_actions (hand_number, seat, action, amount, thinking, game_snapshot, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [entry.handNumber, entry.seat, entry.action, entry.amount, entry.thinking, entry.gameSnapshot, entry.createdAt],
    );
  }

  async getHandHistory(limit: number): Promise<ActionLog[]> {
    const pool = await this.getPool();
    const result = await pool.query(
      `SELECT hand_number, seat, action, amount, thinking, game_snapshot, created_at
       FROM game_actions ORDER BY id DESC LIMIT $1`,
      [limit],
    );
    return (result.rows as PgRow[]).map((r) => ({
      handNumber: Number(r.hand_number),
      seat: r.seat,
      action: r.action,
      amount: r.amount,
      thinking: r.thinking,
      gameSnapshot: typeof r.game_snapshot === "string" ? r.game_snapshot : JSON.stringify(r.game_snapshot),
      createdAt: typeof r.created_at === "string" ? r.created_at : r.created_at.toISOString(),
    }));
  }

  async getSessionState(key: string): Promise<string | null> {
    const pool = await this.getPool();
    const result = await pool.query<{ value: string }>(
      `SELECT value FROM session_state WHERE key = $1`,
      [key],
    );
    return result.rows[0]?.value ?? null;
  }

  async setSessionState(key: string, value: string): Promise<void> {
    const pool = await this.getPool();
    await pool.query(
      `INSERT INTO session_state (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value],
    );
  }
}
