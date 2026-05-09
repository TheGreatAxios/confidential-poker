import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { encodeFunctionData, parseEther } from "viem";
import { getKeyStore } from "../wallet/key-store";
import { config } from "../config";
import { POKER_FACTORY_ABI } from "../abis/poker-factory";

const CTX_CALLBACK_VALUE_WEI = parseEther("0.01");
const MIN_CTX_RESERVE = CTX_CALLBACK_VALUE_WEI * 10n;

export const createTable = tool(
  async ({
    buyIn,
    smallBlind,
    bigBlind,
    maxPlayers,
    tableName,
  }: {
    buyIn: string | null;
    smallBlind: string | null;
    bigBlind: string | null;
    maxPlayers: number | null;
    tableName: string | null;
  }) => {
    try {
      const ks = getKeyStore();
      const resolvedBuyIn = buyIn ?? "1000000000000000000000";
      const resolvedSmallBlind = smallBlind ?? "5000000000000000000";
      const resolvedBigBlind = bigBlind ?? "10000000000000000000";
      const resolvedMaxPlayers = maxPlayers ?? 6;
      const resolvedTableName = tableName ?? "Agent Table";
      const buyInBig = BigInt(resolvedBuyIn);
      const sbBig = BigInt(resolvedSmallBlind);
      const bbBig = BigInt(resolvedBigBlind);

      const data = encodeFunctionData({
        abi: POKER_FACTORY_ABI,
        functionName: "createTable",
        args: [buyInBig, sbBig, bbBig, BigInt(resolvedMaxPlayers), resolvedTableName],
      });

      const txHash = await ks.signAndSend(config.factoryAddress, data, MIN_CTX_RESERVE);

      return JSON.stringify({
        txHash,
        buyIn: buyInBig.toString(),
        smallBlind: sbBig.toString(),
        bigBlind: bbBig.toString(),
        maxPlayers: resolvedMaxPlayers,
        tableName: resolvedTableName,
      });
    } catch (err) {
      return JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "create_table",
    description: "Create a new poker table via the factory. Requires sFUEL for CTX reserve (~0.1 sFUEL). Defaults: buyIn=1000000000000000000000 (1000e18), smallBlind=5000000000000000000 (5e18), bigBlind=10000000000000000000 (10e18), maxPlayers=6.",
    schema: z.object({
      buyIn: z.string().nullable().describe("Buy-in in wei, or null for 1000e18"),
      smallBlind: z.string().nullable().describe("Small blind in wei, or null for 5e18"),
      bigBlind: z.string().nullable().describe("Big blind in wei, or null for 10e18"),
      maxPlayers: z.number().nullable().describe("Maximum players, or null for 6"),
      tableName: z.string().nullable().describe("Table name, or null for Agent Table"),
    }),
  },
);
