"use client";

import { useEffect, useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { POKER_TABLE_ABI, POKER_TABLE_ADDRESS, isContractDeployed } from "@/lib/contracts";
import { generateViewerKeyPair, persistViewerKey } from "@/lib/viewer-key";

interface JoinPanelProps {
  onJoined?: (address: `0x${string}`) => void;
}

function getJoinErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (error.message.toLowerCase().includes("user rejected")) {
      return "Transaction rejected in wallet.";
    }
    return error.message;
  }
  return "Failed to join the table.";
}

export function JoinPanel({ onJoined }: JoinPanelProps) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>(undefined);
  const [message, setMessage] = useState<string | null>(null);
  const [hasJoined, setHasJoined] = useState(false);
  const { writeContractAsync, isPending: isSubmitting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, error: receiptError } =
    useWaitForTransactionReceipt({
      hash: txHash,
      query: { enabled: !!txHash },
    });

  const isJoining = isSubmitting || isConfirming;

  const handleJoin = async () => {
    if (hasJoined || isJoining) return;
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    if (!address) {
      setMessage("❌ Wallet address is unavailable.");
      return;
    }

    setMessage(null);
    const viewerKey = generateViewerKeyPair();
    persistViewerKey(address, viewerKey);

    if (!isContractDeployed(POKER_TABLE_ADDRESS)) {
      setMessage("❌ Poker table contract is not deployed.");
      return;
    }

    try {
      const hash = await writeContractAsync({
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "sitDown",
        args: [{ x: viewerKey.x, y: viewerKey.y }],
      });
      setTxHash(hash);
      setMessage("⏳ Join transaction submitted...");
    } catch (error) {
      setMessage(`❌ ${getJoinErrorMessage(error)}`);
    }
  };

  useEffect(() => {
    if (!receiptError) return;
    setMessage(`❌ ${getJoinErrorMessage(receiptError)}`);
  }, [receiptError]);

  useEffect(() => {
    if (!isSuccess || !address || hasJoined) return;
    onJoined?.(address);
    setHasJoined(true);
    setMessage("✅ Joined table on-chain.");
  }, [isSuccess, address, hasJoined, onJoined]);

  return (
    <div className="w-full max-w-3xl">
      <div className="flex w-full flex-col items-stretch justify-center gap-2 sm:w-auto sm:flex-row sm:items-center">
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-poker-text-muted">
          {address
            ? `${address.slice(0, 6)}...${address.slice(-4)}`
            : "Connect wallet to join"}
        </div>
        <button
          onClick={isConnected ? handleJoin : () => openConnectModal?.()}
          disabled={isJoining || hasJoined}
          className="rounded-lg border border-poker-gold/30 bg-poker-gold/20 px-4 py-2 text-sm font-semibold text-poker-gold transition-colors hover:bg-poker-gold/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isConnected
            ? isJoining
              ? "Joining..."
              : hasJoined
                ? "Joined"
                : "Join Table"
            : "Connect Wallet"}
        </button>
        {txHash && (
          <a
            href={`https://base-sepia.explorer.skale.network/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-white/10 px-3 py-2 text-center text-xs text-poker-text-muted transition-colors hover:text-white"
          >
            View tx
          </a>
        )}
      </div>
      {message && (
        <p className="mt-2 text-center text-xs text-gray-400 sm:text-left">{message}</p>
      )}
    </div>
  );
}
