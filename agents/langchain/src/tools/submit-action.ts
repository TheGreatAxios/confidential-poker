import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { encodeFunctionData, type Address } from "viem";
import { getKeyStore } from "../wallet/key-store";
import { POKER_GAME_ABI } from "../abis/poker-game";

const actionFuncs: Record<string, string> = {
  fold: "fold",
  check: "check",
  call: "call",
  raise: "raise",
};

export const submitAction = tool(
  async ({
    tableAddress,
    action,
    raiseAmount,
  }: {
    tableAddress: string;
    action: "fold" | "check" | "call" | "raise";
    raiseAmount: string | null;
  }) => {
    try {
      const ks = getKeyStore();
      const addr = tableAddress as Address;

      const funcName = actionFuncs[action];
      if (!funcName) {
        return JSON.stringify({ error: `Invalid action: ${action}` });
      }

      const args: readonly [] | readonly [bigint] = action === "raise"
        ? [BigInt(raiseAmount ?? "0")]
        : [];

      const data = encodeFunctionData({
        abi: POKER_GAME_ABI,
        functionName: funcName as "fold" | "check" | "call" | "raise",
        args,
      });

      const txHash = await ks.signAndSend(addr, data);

      return JSON.stringify({
        action,
        raiseAmount: action === "raise" ? (raiseAmount ?? "0") : undefined,
        txHash,
        tableAddress: addr,
      });
    } catch (err) {
      return JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "submit_action",
    description: "Submit a poker action: fold, check, call, or raise. For raise, provide raiseAmount in wei. Minimum raise is MIN_BET (0.5 tokens).",
    schema: z.object({
      tableAddress: z.string().describe("Address of the poker table contract"),
      action: z.enum(["fold", "check", "call", "raise"]).describe("Poker action to submit"),
      raiseAmount: z.string().nullable().describe("Raise amount in wei for raise actions, otherwise null"),
    }),
  },
);
