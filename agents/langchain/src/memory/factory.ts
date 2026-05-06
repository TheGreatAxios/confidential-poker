import type { MemoryBackend } from "./types";
import { InMemoryBackend } from "./memory-saver";
import { SqliteBackend } from "./sqlite";
import { PostgresBackend } from "./postgres";
import { config } from "../config";

export async function createMemoryBackend(): Promise<MemoryBackend> {
  switch (config.memoryBackend) {
    case "sqlite": {
      const dbPath = config.databaseUrl || "./data/poker-agent.db";
      return new SqliteBackend(dbPath);
    }
    case "postgres": {
      if (!config.databaseUrl) {
        throw new Error("DATABASE_URL required for postgres memory backend");
      }
      const backend = new PostgresBackend(config.databaseUrl);
      await backend.initCheckpointer();
      return backend;
    }
    default: {
      console.log("Using in-memory backend (state lost on restart)");
      return new InMemoryBackend();
    }
  }
}
