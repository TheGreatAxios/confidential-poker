import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getKeyStore } from "../wallet/key-store";
import { config } from "../config";
import { ERC20_ABI } from "../abis/erc20";
import { CHIP_TOKEN_ABI } from "../abis/chip-token";
import type { Address } from "viem";

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

      let underlyingAddress = "";
      let underlyingBalance = "0";
      try {
        underlyingAddress = (await ks.readContract(
          config.chipTokenAddress,
          CHIP_TOKEN_ABI,
          "UNDERLYING",
          [],
        )) as string;
        underlyingBalance = (await ks.readContract(
          underlyingAddress as Address,
          ERC20_ABI,
          "balanceOf",
          [address],
        )) as string;
      } catch {
        // underlying token not readable
      }

      return JSON.stringify({
        credits: credits.toString(),
        chipTokens: chipTokens.toString(),
        underlyingBalance,
        underlyingAddress,
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
    description: "Check your sFUEL credit balance, ChipToken balance, and underlying MockSKL balance on SKALE.",
    schema: z.object({}),
  },
);
