import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { encodeFunctionData, type Address } from "viem";
import { getKeyStore } from "../wallet/key-store";
import { MOCK_SKL_ABI } from "../abis/mock-skl";
import { ERC20_ABI } from "../abis/erc20";
import { CHIP_TOKEN_ABI } from "../abis/chip-token";
import { config } from "../config";

export const BUY_IN = 1_000_000_000_000_000_000_000n; // 1000 tokens
export const MIN_GAS = 100_000_000_000_000_000n; // 0.1 sFUEL

export const claimFaucet = tool(
  async () => {
    try {
      const ks = getKeyStore();

      const data = encodeFunctionData({
        abi: MOCK_SKL_ABI,
        functionName: "faucet",
        args: [],
      });

      const txHash = await ks.signAndSend(config.mockSklAddress, data);

      const amount = (await ks.readContract(config.mockSklAddress, MOCK_SKL_ABI, "FAUCET_AMOUNT", [])) as bigint;

      return JSON.stringify({
        success: true,
        txHash,
        amountClaimed: amount.toString(),
        mockSklAddress: config.mockSklAddress,
      });
    } catch (err) {
      return JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "claim_faucet",
    description: "Claim free MockSKL tokens from the faucet. Call this when you need underlying tokens to deposit for chips. Cooldown is 1 hour between claims.",
    schema: z.object({}),
  },
);

export async function ensureChipBalance(
  minChips: bigint = BUY_IN,
): Promise<void> {
  const ks = getKeyStore();
  const thisAddress = ks.getAddress();

  const chipBalance = (await ks.readContract(
    config.chipTokenAddress,
    ERC20_ABI,
    "balanceOf",
    [thisAddress],
  )) as bigint;

  if (chipBalance >= minChips) {
    console.log(`Chip balance OK: ${chipBalance}`);
    return;
  }

  console.log(`Chip balance ${chipBalance} below minimum ${minChips}. Funding...`);

  const underlyingAddress = (await ks.readContract(
    config.chipTokenAddress,
    CHIP_TOKEN_ABI,
    "UNDERLYING",
    [],
  )) as Address;

  const sklBalance = (await ks.readContract(
    underlyingAddress,
    ERC20_ABI,
    "balanceOf",
    [thisAddress],
  )) as bigint;

  if (sklBalance < minChips) {
    console.log(`MockSKL balance ${sklBalance} below minimum. Claiming faucet...`);
    const faucetCall = encodeFunctionData({
      abi: MOCK_SKL_ABI,
      functionName: "faucet",
      args: [],
    });
    await ks.signAndSend(underlyingAddress, faucetCall);
  }

  const approveUnderlying = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [config.chipTokenAddress, minChips],
  });
  await ks.signAndSend(underlyingAddress, approveUnderlying);

  const depositCall = encodeFunctionData({
    abi: CHIP_TOKEN_ABI,
    functionName: "deposit",
    args: [minChips],
  });
  await ks.signAndSend(config.chipTokenAddress, depositCall);

  console.log(`Deposited ${minChips} MockSKL → CHIPS`);
}
