import { useCallback } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { FRONTEND_CONFIG } from "@/lib/config";
import { CHIP_TOKEN_ABI, ERC20_ABI, isContractDeployed } from "@/lib/contracts";

interface UseChipTokenParams {
  chipTokenAddress: `0x${string}` | null;
  gameAddress: `0x${string}` | null;
}

async function waitForReceipt(
  publicClient: ReturnType<typeof usePublicClient>,
  hash: `0x${string}`,
) {
  if (!publicClient) {
    throw new Error("No RPC client.");
  }

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    pollingInterval: 1_000,
  });
  if (receipt.status !== "success") {
    throw new Error("Transaction reverted on-chain.");
  }
  return receipt;
}

export function useChipToken({ chipTokenAddress, gameAddress }: UseChipTokenParams) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const chipReady = !!chipTokenAddress && isContractDeployed(chipTokenAddress);

  const { data: underlyingTokenAddress } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: chipTokenAddress ?? undefined,
    abi: CHIP_TOKEN_ABI,
    functionName: "UNDERLYING",
    query: { enabled: chipReady },
  });

  const underlyingAddress = typeof underlyingTokenAddress === "string"
    ? underlyingTokenAddress as `0x${string}`
    : FRONTEND_CONFIG.underlyingTokenAddress;

  const { data: chipBalance, refetch: refetchChipBalance } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: chipTokenAddress ?? undefined,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: chipReady && isConnected },
  });

  const { data: underlyingBalance, refetch: refetchUnderlyingBalance } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: underlyingAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && isContractDeployed(underlyingAddress) },
  });

  const { data: gameAllowance, refetch: refetchGameAllowance } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: chipTokenAddress ?? undefined,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && gameAddress ? [address, gameAddress] : undefined,
    query: { enabled: chipReady && isConnected && !!gameAddress },
  });

  const { data: depositAllowance, refetch: refetchDepositAllowance } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: underlyingAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && chipTokenAddress ? [address, chipTokenAddress] : undefined,
    query: { enabled: chipReady && isConnected && isContractDeployed(underlyingAddress) },
  });

  const { data: symbol } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: chipTokenAddress ?? undefined,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: chipReady },
  });

  const approveUnderlying = useCallback(async (amount: bigint) => {
    if (!chipTokenAddress) throw new Error("Missing chip token address.");
    const hash = await writeContractAsync({
      chainId: FRONTEND_CONFIG.chainId,
      address: underlyingAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [chipTokenAddress, amount],
    });
    await waitForReceipt(publicClient, hash);
    await refetchDepositAllowance();
    return hash;
  }, [chipTokenAddress, publicClient, refetchDepositAllowance, underlyingAddress, writeContractAsync]);

  const deposit = useCallback(async (amount: bigint) => {
    if (!chipTokenAddress) throw new Error("Missing chip token address.");
    const hash = await writeContractAsync({
      chainId: FRONTEND_CONFIG.chainId,
      address: chipTokenAddress,
      abi: CHIP_TOKEN_ABI,
      functionName: "deposit",
      args: [amount],
    });
    await waitForReceipt(publicClient, hash);
    await refetchChipBalance();
    await refetchUnderlyingBalance();
    return hash;
  }, [chipTokenAddress, publicClient, refetchChipBalance, refetchUnderlyingBalance, writeContractAsync]);

  const approveGame = useCallback(async (amount: bigint) => {
    if (!chipTokenAddress || !gameAddress) throw new Error("Missing table token approval target.");
    const hash = await writeContractAsync({
      chainId: FRONTEND_CONFIG.chainId,
      address: chipTokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [gameAddress, amount],
    });
    await waitForReceipt(publicClient, hash);
    await refetchGameAllowance();
    return hash;
  }, [chipTokenAddress, gameAddress, publicClient, refetchGameAllowance, writeContractAsync]);

  const withdraw = useCallback(async (amount: bigint) => {
    if (!chipTokenAddress) throw new Error("Missing chip token address.");
    const hash = await writeContractAsync({
      chainId: FRONTEND_CONFIG.chainId,
      address: chipTokenAddress,
      abi: CHIP_TOKEN_ABI,
      functionName: "withdraw",
      args: [amount],
    });
    await waitForReceipt(publicClient, hash);
    await refetchChipBalance();
    await refetchUnderlyingBalance();
    return hash;
  }, [chipTokenAddress, publicClient, refetchChipBalance, refetchUnderlyingBalance, writeContractAsync]);

  return {
    chipBalance: chipBalance ?? 0n,
    underlyingBalance: underlyingBalance ?? 0n,
    gameAllowance: gameAllowance ?? 0n,
    depositAllowance: depositAllowance ?? 0n,
    underlyingTokenAddress: underlyingAddress,
    symbol: symbol ?? "CHIPS",
    approveUnderlying,
    deposit,
    approveGame,
    withdraw,
    refetch: () => {
      void refetchChipBalance();
      void refetchUnderlyingBalance();
      void refetchGameAllowance();
      void refetchDepositAllowance();
    },
  };
}
