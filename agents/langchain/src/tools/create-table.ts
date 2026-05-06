import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { encodeFunctionData, parseEther, type Address } from "viem";
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
    buyIn: string;
    smallBlind: string;
    bigBlind: string;
    maxPlayers: number;
    tableName: string;
  }) => {
    try {
      const ks = getKeyStore();
      const buyInBig = BigInt(buyIn);
      const sbBig = BigInt(smallBlind);
      const bbBig = BigInt(bigBlind);

      const data = encodeFunctionData({
        abi: POKER_FACTORY_ABI,
        functionName: "createTable",
        args: [buyInBig, sbBig, bbBig, BigInt(maxPlayers), tableName],
      });

      const txHash = await ks.signAndSend(config.factoryAddress, data, MIN_CTX_RESERVE);

      return JSON.stringify({
        txHash,
        buyIn: buyInBig.toString(),
        smallBlind: sbBig.toString(),
        bigBlind: bbBig.toString(),
        maxPlayers,
        tableName,
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
      buyIn: z.string().default("1000000000000000000000"),
      smallBlind: z.string().default("5000000000000000000"),
      bigBlind: z.string().default("10000000000000000000"),
      maxPlayers: z.number().default(6),
      tableName: z.string().default("Agent Table"),
    }),
  },
);
