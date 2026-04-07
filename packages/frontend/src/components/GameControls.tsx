
import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import type { GameState } from "@/lib/types";
import { POKER_TABLE_ABI, POKER_TABLE_ADDRESS } from "@/lib/contracts";

interface GameControlsProps {
  gameState: GameState;
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

export function GameControls({ gameState }: GameControlsProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [raiseAmount, setRaiseAmount] = useState(gameState.minRaise);
  const [message, setMessage] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    setRaiseAmount(gameState.minRaise);
  }, [gameState.minRaise]);

  const canCheck = gameState.currentBet === 0;
  const humanBet = gameState.humanPlayer?.currentBet ?? 0;
  const callAmount = Math.max(0, gameState.currentBet - humanBet);

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
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "call",
        value: BigInt(callAmount),
      });
      await sendAndWait(hash);
    } catch (error) {
      setMessage(`❌ ${getActionErrorMessage(error)}`);
    } finally {
      setActing(false);
    }
  };

  const handleRaise = async () => {
    if (!address || !publicClient || acting) return;
    setActing(true);
    setMessage(null);
    try {
      const hash = await writeContractAsync({
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "raise",
        args: [BigInt(raiseAmount)],
        value: BigInt(raiseAmount),
      });
      await sendAndWait(hash);
    } catch (error) {
      setMessage(`❌ ${getActionErrorMessage(error)}`);
    } finally {
      setActing(false);
    }
  };

  const handleAllIn = async () => {
    const allInAmount = gameState.humanPlayer?.chips ?? 0;
    if (!address || !publicClient || acting || allInAmount <= 0) return;
    setActing(true);
    setMessage(null);
    try {
      const hash = await writeContractAsync({
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "raise",
        args: [BigInt(allInAmount)],
        value: BigInt(allInAmount),
      });
      await sendAndWait(hash);
    } catch (error) {
      setMessage(`❌ ${getActionErrorMessage(error)}`);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:gap-3">
        <button
          className="min-w-[92px] rounded-lg border border-gray-600/50 bg-gray-700/50 px-3 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-600/50 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
          onClick={handleFold}
          disabled={acting}
        >
          Fold
        </button>

        {canCheck ? (
          <button
            className="min-w-[92px] rounded-lg border border-poker-blue/30 bg-poker-blue/20 px-3 py-2 text-sm font-semibold text-poker-blue transition-colors hover:bg-poker-blue/30 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
            onClick={handleCheck}
            disabled={acting}
          >
            Check
          </button>
        ) : (
          <button
            className="min-w-[92px] rounded-lg border border-poker-green/30 bg-poker-green/20 px-3 py-2 text-sm font-semibold text-poker-green transition-colors hover:bg-poker-green/30 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
            onClick={handleCall}
            disabled={acting}
          >
            Call {callAmount}
          </button>
        )}

        <div className="flex items-center gap-2">
          <input
            type="number"
            value={raiseAmount}
            onChange={(e) => setRaiseAmount(Number(e.target.value))}
            min={gameState.minRaise}
            step={gameState.minRaise}
            className="w-16 rounded-lg border border-gray-700 bg-gray-800 px-2 py-2 text-center font-mono text-sm text-white focus:border-poker-gold/50 focus:outline-none sm:w-20"
          />
          <button
            className="min-w-[92px] rounded-lg border border-poker-gold/30 bg-poker-gold/20 px-3 py-2 text-sm font-semibold text-poker-gold transition-colors hover:bg-poker-gold/30 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
            onClick={handleRaise}
            disabled={acting}
          >
            Raise
          </button>
        </div>

        <button
          className="min-w-[92px] rounded-lg border border-poker-red/30 bg-poker-red/20 px-3 py-2 text-sm font-bold text-poker-red transition-colors hover:bg-poker-red/30 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
          onClick={handleAllIn}
          disabled={acting}
        >
          ALL IN
        </button>
      </div>

      {message && (
        <p className="text-center text-xs text-gray-400">{message}</p>
      )}
    </div>
  );
}
