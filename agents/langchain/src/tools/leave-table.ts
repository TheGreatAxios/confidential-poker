import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { encodeFunctionData, type Address } from "viem";
import { getKeyStore } from "../wallet/key-store";
import { POKER_GAME_ABI } from "../abis/poker-game";

export const leaveTable = tool(
  async ({ tableAddress }: { tableAddress: string }) => {
    try {
      const ks = getKeyStore();
      const addr = tableAddress as Address;

      const requestData = encodeFunctionData({
        abi: POKER_GAME_ABI,
        functionName: "requestLeave",
        args: [],
      });
      const txHash = await ks.signAndSend(addr, requestData);

      return JSON.stringify({
        action: "requestLeave",
        txHash,
        tableAddress: addr,
        note: "Leave requested. The table will process your exit between hands via leaveTable() or you may call leaveTable() while in Waiting phase.",
      });
    } catch (err) {
      return JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "leave_table",
    description: "Request to leave a poker table. The request is queued and processed between hands. Use when you want to exit the current table.",
    schema: z.object({
      tableAddress: z.string().describe("Address of the poker table contract"),
    }),
  },
);
