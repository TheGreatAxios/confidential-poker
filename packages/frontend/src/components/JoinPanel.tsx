"use client";

import { createElement, useEffect, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useWriteContract,
} from "wagmi";
import {
  POKER_GAME_ABI,
} from "@/lib/contracts";
import { FRONTEND_CONFIG } from "@/lib/config";
import { isContractDeployed } from "@/lib/contracts";
import { addSKALEChain } from "@/providers";
import { generateViewerKeyPair, loadViewerKey, persistViewerKey } from "@/lib/viewer-key";
import { ensureAppKit } from "@/lib/appkit";
import { useChipToken } from "@/hooks/useChipToken";
import type { TableInfo } from "@/lib/types";
import { formatTokenDisplay } from "@/lib/token-format";

type Step = "idle" | "approving-underlying" | "depositing" | "approving-game" | "joining" | "done";

interface JoinPanelProps {
  tableAddress: `0x${string}`;
  chipTokenAddress: `0x${string}` | null;
  tableInfo?: TableInfo | null;
  onJoined?: (joinedAddress: `0x${string}`) => void;
  onLeft?: () => void;
  mode?: "join" | "rejoin";
  canCashOut?: boolean;
}

export function JoinPanel({
  tableAddress,
  chipTokenAddress,
  tableInfo,
  onJoined,
  onLeft: _onLeft,
  mode = "join",
  canCashOut: _canCashOut = false,
}: JoinPanelProps) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const chipToken = useChipToken({
    chipTokenAddress: chipTokenAddress ?? FRONTEND_CONFIG.chipTokenAddress,
    gameAddress: tableAddress,
  });

  const [step, setStep] = useState<Step>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [isAppKitReady, setIsAppKitReady] = useState(isConnected);

  useEffect(() => {
    if (isConnected) {
      setIsAppKitReady(true);
      return;
    }

    let cancelled = false;

    void ensureAppKit().then(() => {
      if (!cancelled) {
        setIsAppKitReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isConnected]);

  const activeBuyIn = tableInfo?.buyIn ?? 1_000_000_000_000_000_000_000n;
  const hasUnderlyingBalance = chipToken.underlyingBalance >= activeBuyIn;
  const hasChipBalance = chipToken.chipBalance >= activeBuyIn;
  const needsDepositApproval = chipToken.depositAllowance < activeBuyIn;
  const needsGameApproval = chipToken.gameAllowance < activeBuyIn;

  const handleJoin = async () => {
    await addSKALEChain();

    if (!isContractDeployed(tableAddress)) {
      setMessage("Poker table contract is not deployed.");
      return;
    }

    if (!isContractDeployed(chipTokenAddress ?? FRONTEND_CONFIG.chipTokenAddress)) {
      setMessage("Chip token address is not configured.");
      return;
    }

    if (!address) {
      setMessage("Connect wallet to join.");
      return;
    }

    const viewerKey = loadViewerKey(address) ?? generateViewerKeyPair();
    persistViewerKey(address, viewerKey);

    try {
      if (!hasChipBalance) {
        if (!hasUnderlyingBalance) {
          throw new Error("Insufficient underlying token balance.");
        }

        if (needsDepositApproval) {
          setStep("approving-underlying");
          setMessage("Approving deposit...");
          const approveHash = await chipToken.approveUnderlying(activeBuyIn);
          setTxHash(approveHash);
        }

        setStep("depositing");
        setMessage("Depositing chips...");
        const depositHash = await chipToken.deposit(activeBuyIn);
        setTxHash(depositHash);
      }

      if (needsGameApproval) {
        setStep("approving-game");
        setMessage("Approving table spend...");
        const approveHash = await chipToken.approveGame(activeBuyIn);
        setTxHash(approveHash);
      }

      setStep("joining");
      setMessage(mode === "rejoin" ? "Restoring viewer key..." : "Joining table...");
      const joinHash = await writeContractAsync({
        chainId: FRONTEND_CONFIG.chainId,
        address: tableAddress,
        abi: POKER_GAME_ABI,
        functionName: "sitDown",
        args: [{ x: viewerKey.x, y: viewerKey.y }],
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
      onJoined?.(address);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Transaction failed");
      setStep("idle");
    }
  };

  const statusLabel = (() => {
    if (step === "approving-underlying") return "Approving Deposit...";
    if (step === "depositing") return "Depositing...";
    if (step === "approving-game") return "Approving Table...";
    if (step === "joining") return mode === "rejoin" ? "Rejoining..." : "Joining...";
    if (step === "done") return mode === "rejoin" ? "Restored" : "Joined";
    return mode === "rejoin" ? "Restore Viewer Key" : "Join Table";
  })();

  const isBusy = step !== "idle" && step !== "done";

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
          isAppKitReady ? (
            createElement("appkit-button")
          ) : (
            <button
              disabled
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-poker-text-muted opacity-70"
            >
              Loading wallet...
            </button>
          )
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
                {formatTokenDisplay(activeBuyIn)}
              </span>
            </span>
            {isConnected && !hasUnderlyingBalance && !hasChipBalance && (
              <span className="text-poker-red">Insufficient balance</span>
            )}
            {isConnected && hasUnderlyingBalance && (needsDepositApproval || needsGameApproval) && step === "idle" && (
              <span className="text-yellow-400">Requires approval</span>
            )}
            {isConnected && !hasChipBalance && hasUnderlyingBalance && (
              <span className="text-poker-text-muted">Deposit required</span>
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
