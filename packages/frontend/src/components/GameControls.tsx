
import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import type { GameState } from "@/lib/types";
import { POKER_TABLE_ABI, POKER_TABLE_ADDRESS } from "@/lib/contracts";
import { FRONTEND_CONFIG } from "@/lib/config";
import { formatTokenAmount, parseTokenAmount } from "@/lib/token-format";

interface GameControlsProps {
  gameState: GameState;
  onLeft?: () => void;
}

function getActionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (error.message.toLowerCase().includes("user rejected")) {
      return "Transaction rejected in wallet.";
    }
    return error.message;
  }
  return "Action failed.";
}

export function GameControls({ gameState, onLeft }: GameControlsProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [raiseAmountInput, setRaiseAmountInput] = useState(formatTokenAmount(gameState.minRaise, { maxFractionDigits: 6 }));
  const [message, setMessage] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    setRaiseAmountInput(formatTokenAmount(gameState.minRaise, { maxFractionDigits: 6 }));
  }, [gameState.minRaise]);

  const humanBet = gameState.humanPlayer?.currentBet ?? 0n;
  const callAmount = gameState.currentBet > humanBet ? gameState.currentBet - humanBet : 0n;
  const raiseAmount = parseTokenAmount(raiseAmountInput);
  const isRaiseAmountValid = raiseAmount !== null && raiseAmount >= gameState.minRaise;
  const isMyTurn =
    gameState.humanPlayer !== null &&
    gameState.currentPlayerIndex !== null &&
    gameState.humanPlayer.seatIndex === gameState.currentPlayerIndex;
  const isBettingPhase = ["preflop", "flop", "turn", "river"].includes(gameState.phase);
  const canCheckNow = callAmount === 0n;
  const canAct = isMyTurn && isBettingPhase;
  const canCashOut = gameState.phase === "waiting";
  const isDealer =
    gameState.humanPlayer !== null &&
    gameState.humanPlayer.seatIndex === gameState.dealerIndex;
  const viewerKeyLabel = gameState.humanPlayer?.viewerKey
    ? `${gameState.humanPlayer.viewerKey.slice(0, 12)}...${gameState.humanPlayer.viewerKey.slice(-10)}`
    : null;

  const sendAndWait = async (hash: `0x${string}`) => {
    const receipt = await publicClient!.waitForTransactionReceipt({
      hash,
      pollingInterval: 1_000,
    });
    if (receipt.status !== "success") throw new Error("Transaction reverted on-chain.");
  };

  const handleFold = async () => {
    if (!address || !publicClient || acting) return;
    setActing(true);
    setMessage(null);
    try {
      const hash = await writeContractAsync({
        chainId: FRONTEND_CONFIG.chainId,
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "fold",
      });
      await sendAndWait(hash);
    } catch (error) {
      setMessage(`❌ ${getActionErrorMessage(error)}`);
    } finally {
      setActing(false);
    }
  };

  const handleCheck = async () => {
    if (!address || !publicClient || acting) return;
    setActing(true);
    setMessage(null);
    try {
      const hash = await writeContractAsync({
        chainId: FRONTEND_CONFIG.chainId,
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "check",
      });
      await sendAndWait(hash);
    } catch (error) {
      setMessage(`❌ ${getActionErrorMessage(error)}`);
    } finally {
      setActing(false);
    }
  };

  const handleCall = async () => {
    if (!address || !publicClient || acting) return;
    setActing(true);
    setMessage(null);
    try {
      const hash = await writeContractAsync({
        chainId: FRONTEND_CONFIG.chainId,
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "call",
      });
      await sendAndWait(hash);
    } catch (error) {
      setMessage(`❌ ${getActionErrorMessage(error)}`);
    } finally {
      setActing(false);
    }
  };

  const handleRaise = async () => {
    if (!address || !publicClient || acting || raiseAmount === null || raiseAmount < gameState.minRaise) return;
    setActing(true);
    setMessage(null);
    try {
      const hash = await writeContractAsync({
        chainId: FRONTEND_CONFIG.chainId,
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "raise",
        args: [raiseAmount],
      });
      await sendAndWait(hash);
    } catch (error) {
      setMessage(`❌ ${getActionErrorMessage(error)}`);
    } finally {
      setActing(false);
    }
  };

  const handleAllIn = async () => {
    const allInAmount = gameState.humanPlayer?.chips ?? 0n;
    if (!address || !publicClient || acting || allInAmount <= 0n) return;
    setActing(true);
    setMessage(null);
    try {
      const hash = await writeContractAsync({
        chainId: FRONTEND_CONFIG.chainId,
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "raise",
        args: [allInAmount],
      });
      await sendAndWait(hash);
    } catch (error) {
      setMessage(`❌ ${getActionErrorMessage(error)}`);
    } finally {
      setActing(false);
    }
  };

  const handleLeave = async () => {
    if (!address || !publicClient || acting) return;
    const forfeiting = !canCashOut;

    if (
      forfeiting &&
      typeof window !== "undefined" &&
      !window.confirm("Leave immediately and forfeit your remaining stack?")
    ) {
      return;
    }

    setActing(true);
    setMessage(null);
    try {
      const hash = await writeContractAsync({
        chainId: FRONTEND_CONFIG.chainId,
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: forfeiting ? "forfeitAndLeave" : "leaveTable",
      });
      await sendAndWait(hash);
      onLeft?.();
      setMessage(forfeiting ? "You left the table and forfeited the stack." : "You left the table.");
    } catch (error) {
      setMessage(`❌ ${getActionErrorMessage(error)}`);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      {viewerKeyLabel && (
        <div className="text-[11px] tracking-[0.08em] uppercase text-poker-text-dim">
          Viewer Key {viewerKeyLabel}
        </div>
      )}
      <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:gap-3">
          <button
            className="min-w-[92px] rounded-lg border border-gray-600/50 bg-gray-700/50 px-3 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-600/50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
            onClick={handleFold}
            disabled={acting || !canAct}
          >
            Fold
          </button>

        {canCheckNow ? (
          <button
            className="min-w-[92px] rounded-lg border border-poker-blue/30 bg-poker-blue/20 px-3 py-2 text-sm font-semibold text-poker-blue transition-colors hover:bg-poker-blue/30 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
            onClick={handleCheck}
            disabled={acting || !canAct}
          >
            Check
          </button>
        ) : (
          <button
            className="min-w-[92px] rounded-lg border border-poker-green/30 bg-poker-green/20 px-3 py-2 text-sm font-semibold text-poker-green transition-colors hover:bg-poker-green/30 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
            onClick={handleCall}
            disabled={acting || !canAct}
          >
            Call {formatTokenAmount(callAmount)}
          </button>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={raiseAmountInput}
            onChange={(e) => setRaiseAmountInput(e.target.value)}
            className="w-16 rounded-lg border border-gray-700 bg-gray-800 px-2 py-2 text-center font-mono text-sm text-white focus:border-poker-gold/50 focus:outline-none sm:w-20"
          />
          <button
            className="min-w-[92px] rounded-lg border border-poker-gold/30 bg-poker-gold/20 px-3 py-2 text-sm font-semibold text-poker-gold transition-colors hover:bg-poker-gold/30 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
            onClick={handleRaise}
            disabled={acting || !canAct || !isRaiseAmountValid}
          >
            Raise
          </button>
        </div>

        <button
          className="min-w-[92px] rounded-lg border border-poker-red/30 bg-poker-red/20 px-3 py-2 text-sm font-bold text-poker-red transition-colors hover:bg-poker-red/30 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
          onClick={handleAllIn}
          disabled={acting || !canAct}
        >
          ALL IN
        </button>

        <button
          className="min-w-[120px] rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
          onClick={handleLeave}
          disabled={acting}
        >
          {canCashOut ? "Leave Table" : "Forfeit & Leave"}
        </button>
      </div>

      {!canAct && (
        <p className="text-center text-xs text-gray-500">Waiting for the other player...</p>
      )}

      {canAct && !isRaiseAmountValid && (
        <p className="text-center text-xs text-gray-500">
          Raise must be at least {formatTokenAmount(gameState.minRaise)}.
        </p>
      )}

      {message && (
        <p className="text-center text-xs text-gray-400">{message}</p>
      )}
    </div>
  );
}
