import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getKeyStore } from "../wallet/key-store";
import { config } from "../config";
import { POKER_FACTORY_ABI } from "../abis/poker-factory";
import { POKER_GAME_ABI } from "../abis/poker-game";
import type { Address } from "viem";

export const listTables = tool(
  async () => {
    try {
      const ks = getKeyStore();
      const tables = (await ks.readContract(
        config.factoryAddress,
        POKER_FACTORY_ABI,
        "getAllTables",
        [],
      )) as Address[];
      const results = [];
      for (const addr of tables) {
        const info = (await ks.readContract(
          config.factoryAddress,
          POKER_FACTORY_ABI,
          "getTableInfo",
          [addr],
        )) as [bigint, bigint, bigint, bigint, bigint, number, string];
        const phase = (await ks.readContract(
          addr,
          POKER_GAME_ABI,
          "getPhaseName",
          [],
        )) as string;
        results.push({
          address: addr,
          name: info[6],
          buyIn: info[0].toString(),
          playerCount: Number(info[3]),
          phase,
          bigBlind: info[2].toString(),
        });
      }
      return JSON.stringify(results);
    } catch (err) {
      return JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "list_tables",
    description: "List all available poker tables from the factory with their buy-in, player count, and phase.",
    schema: z.object({}),
  },
);
