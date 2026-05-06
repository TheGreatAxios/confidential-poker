import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { encodeFunctionData, maxUint256, type Address } from "viem";
import { getKeyStore } from "../wallet/key-store";
import { config } from "../config";
import { POKER_GAME_ABI } from "../abis/poker-game";
import { ERC20_ABI } from "../abis/erc20";

export const joinTable = tool(
  async ({ tableAddress }: { tableAddress: string }) => {
    try {
      const ks = getKeyStore();
      const addr = tableAddress as Address;
      const thisAddress = ks.getAddress();

      const phase = (await ks.readContract(addr, POKER_GAME_ABI, "phase", [])) as number;
      if (phase !== 0) {
        return JSON.stringify({ error: "Table is not in Waiting phase" });
      }

      const buyIn = (await ks.readContract(addr, POKER_GAME_ABI, "BUY_IN", [])) as bigint;

      const chipAllowance = (await ks.readContract(
        config.chipTokenAddress,
        ERC20_ABI,
        "allowance",
        [thisAddress, addr],
      )) as bigint;

      if (chipAllowance < buyIn) {
        const approveData = encodeFunctionData({
          abi: ERC20_ABI,
          functionName: "approve",
          args: [addr, maxUint256],
        });
        await ks.signAndSend(config.chipTokenAddress, approveData);
      }

      const viewerKey = ks.getViewerKey();
      const sitDownData = encodeFunctionData({
        abi: POKER_GAME_ABI,
        functionName: "sitDown",
        args: [viewerKey],
      });
      const txHash = await ks.signAndSend(addr, sitDownData);

      const playerCount = (await ks.readContract(addr, POKER_GAME_ABI, "playerCount", [])) as bigint;
      const seat = Number(playerCount) - 1;

      const readyData = encodeFunctionData({
        abi: POKER_GAME_ABI,
        functionName: "readyUp",
        args: [],
      });
      await ks.signAndSend(addr, readyData);

      return JSON.stringify({
        txHash,
        seat,
        tableAddress: addr,
        buyIn: buyIn.toString(),
      });
    } catch (err) {
      return JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "join_table",
    description: "Join and sit down at a poker table. Approves ChipToken if needed, sits down with viewer key, and readies up.",
    schema: z.object({
      tableAddress: z.string().describe("Address of the poker table contract to join"),
    }),
  },
);
