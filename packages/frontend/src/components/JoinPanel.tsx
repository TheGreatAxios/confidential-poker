"use client";

import { useState } from "react";
import "@reown/appkit/react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import {
  POKER_TABLE_ABI,
  POKER_TABLE_ADDRESS,
  TOKEN_ADDRESS,
  ERC20_ABI,
} from "@/lib/contracts";
import { FRONTEND_CONFIG } from "@/lib/config";
import { isContractDeployed } from "@/lib/contracts";
import { addSKALEChain } from "@/providers";

type Step = "idle" | "approving" | "joining" | "done";

interface JoinPanelProps {
  onJoined?: () => void;
  mode?: "join" | "rejoin";
  canCashOut?: boolean;
}

export function JoinPanel({
  onJoined,
  mode = "join",
  canCashOut = false,
}: JoinPanelProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [step, setStep] = useState<Step>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  const { data: onChainBuyIn } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: POKER_TABLE_ADDRESS,
    abi: POKER_TABLE_ABI,
    functionName: "BUY_IN",
    query: { enabled: isContractDeployed(POKER_TABLE_ADDRESS) },
  });

  const { data: tokenSymbol } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "symbol",
    query: { enabled: isContractDeployed(TOKEN_ADDRESS) },
  });

  const { data: tokenDecimals } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "decimals",
    query: { enabled: isContractDeployed(TOKEN_ADDRESS) },
  });

  const { data: tokenAllowance } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, POKER_TABLE_ADDRESS] : undefined,
    query: { enabled: isConnected && isContractDeployed(POKER_TABLE_ADDRESS) },
  });

  const { data: tokenBalance } = useReadContract({
    chainId: FRONTEND_CONFIG.chainId,
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: isConnected && isContractDeployed(TOKEN_ADDRESS) },
  });

  const activeBuyIn = onChainBuyIn ?? 1_000_000_000_000_000_000_000n;
  const symbol = tokenSymbol ?? "SKL";
  const decimals = Number(tokenDecimals ?? 18n);
  const formattedBuyIn = Number(activeBuyIn) / 10 ** decimals;
  const hasBalance = tokenBalance !== undefined && tokenBalance >= activeBuyIn;
  const needsApproval = tokenAllowance !== undefined && tokenAllowance < activeBuyIn;

  const handleJoin = async () => {
    await addSKALEChain()
    
    if (!isContractDeployed(POKER_TABLE_ADDRESS)) {
      setMessage("Poker table contract is not deployed.");
      return;
    }

    setStep("approving");
    try {
      if (needsApproval) {
        setMessage("Approving tokens...");
        const approveHash = await writeContractAsync({
          chainId: FRONTEND_CONFIG.chainId,
          address: TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [POKER_TABLE_ADDRESS, activeBuyIn],
        });
        setTxHash(approveHash);

        if (!publicClient) throw new Error("No RPC client.");
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setStep("joining");
      setMessage(mode === "rejoin" ? "Restoring viewer key..." : "Joining table...");
      const joinHash = await writeContractAsync({
        chainId: FRONTEND_CONFIG.chainId,
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "sitDown",
        args: ["0x"],
      });
      setTxHash(joinHash);

      if (!publicClient) throw new Error("No RPC client.");
      const joinReceipt = await publicClient.waitForTransactionReceipt({
        hash: joinHash,
        pollingInterval: 1_000,
      });
      if (joinReceipt.status !== "success") {
        throw new Error("Join reverted on-chain.");
      }

      setStep("done");
      onJoined?.();
    } catch (err: any) {
      setMessage(err.message || "Transaction failed");
      setStep("idle");
    }
  };

  const statusLabel = (() => {
    if (step === "approving") return "Approving...";
    if (step === "joining") return mode === "rejoin" ? "Rejoining..." : "Joining...";
    if (step === "done") return mode === "rejoin" ? "Restored" : "Joined";
    return mode === "rejoin" ? "Restore Viewer Key" : "Join Table";
  })();

  const isBusy = step === "approving" || step === "joining";

  return (
    <div className="w-full max-w-3xl">
      <div className="flex w-full flex-col items-stretch justify-center gap-2 sm:w-auto sm:flex-row sm:items-center">
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-poker-text-muted">
          {address
            ? `${address.slice(0, 6)}...${address.slice(-4)}`
            : "Connect wallet to join"}
        </div>

        {isConnected ? (
          <button
            onClick={handleJoin}
            disabled={isBusy || step === "done"}
            className="rounded-lg border border-poker-gold/30 bg-poker-gold/20 px-4 py-2 text-sm font-semibold text-poker-gold transition-colors hover:bg-poker-gold/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {statusLabel}
          </button>
        ) : (
          <appkit-button />
        )}

        {txHash && (
          <a
            href={`${FRONTEND_CONFIG.explorerUrl}tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-white/10 px-3 py-2 text-center text-xs text-poker-text-muted transition-colors hover:text-white"
          >
            View tx
          </a>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3 text-xs text-gray-400 sm:text-left">
        {mode === "join" ? (
          <>
            <span>
              Buy-in:{" "}
              <span className="font-semibold text-poker-gold">
                {formattedBuyIn} {symbol}
              </span>
            </span>
            {isConnected && !hasBalance && (
              <span className="text-poker-red">Insufficient balance</span>
            )}
            {isConnected && hasBalance && needsApproval && step === "idle" && (
              <span className="text-yellow-400">Requires approval</span>
            )}
          </>
        ) : null}
        {message && (
          <span className="text-poker-gold animate-pulse">{message}</span>
        )}
      </div>
    </div>
  );
}