import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getKeyStore } from "../wallet/key-store";
import { config } from "../config";
import { ERC20_ABI } from "../abis/erc20";

export const checkBalance = tool(
  async () => {
    try {
      const ks = getKeyStore();
      const address = ks.getAddress();
      const credits = await ks.getBalance(address);
      const chipTokens = (await ks.readContract(
        config.chipTokenAddress,
        ERC20_ABI,
        "balanceOf",
        [address],
      )) as bigint;
      return JSON.stringify({
        credits: credits.toString(),
        chipTokens: chipTokens.toString(),
        address,
      });
    } catch (err) {
      return JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "check_balance",
    description: "Check your sFUEL credit balance and ChipToken balance on SKALE.",
    schema: z.object({}),
  },
);
