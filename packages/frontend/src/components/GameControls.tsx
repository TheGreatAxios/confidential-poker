
import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import type { GameState } from "@/lib/types";
import { POKER_TABLE_ABI, POKER_TABLE_ADDRESS } from "@/lib/contracts";
import { FRONTEND_CONFIG } from "@/lib/config";
import { formatTokenAmount, formatTokenDisplay, parseTokenAmount } from "@/lib/token-format";

interface GameControlsProps {
  gameState: GameState;
  onLeft?: () => void;
  layout?: "default" | "panel";
}

const ACTION_BUTTON_CLASS =
  "min-w-[132px] rounded-xl border px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY_BUTTON_CLASS = `${ACTION_BUTTON_CLASS} border-white/20 bg-white/[0.03] text-white hover:bg-white/[0.06]`;
const GOLD_BUTTON_CLASS = `${ACTION_BUTTON_CLASS} border-poker-gold/30 bg-poker-gold/15 text-poker-gold hover:bg-poker-gold/25`;
const RED_BUTTON_CLASS = `${ACTION_BUTTON_CLASS} border-poker-red/30 bg-poker-red/15 text-poker-red hover:bg-poker-red/25`;
const AMBER_BUTTON_CLASS = `${ACTION_BUTTON_CLASS} border-amber-400/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20`;

function getActionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    if (error.message.toLowerCase().includes("user rejected")) {
      return "Transaction rejected in wallet.";
    }
    return error.message;
  }
  return "Action failed.";
}

export function GameControls({ gameState, onLeft, layout = "default" }: GameControlsProps) {
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
  const canDealNextHand = gameState.humanPlayer !== null && gameState.canStartNextHand;
  const isPanelLayout = layout === "panel";
  const checkOrCallLabel = canCheckNow ? "Check" : `Call ${formatTokenDisplay(callAmount)}`;
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

  const handleDealNextHand = async () => {
    if (!address || !publicClient || acting || !canDealNextHand) return;
    setActing(true);
    setMessage(null);
    try {
      const hash = await writeContractAsync({
        chainId: FRONTEND_CONFIG.chainId,
        address: POKER_TABLE_ADDRESS,
        abi: POKER_TABLE_ABI,
        functionName: "dealNewHand",
      });
      await sendAndWait(hash);
    } catch (error) {
      setMessage(`❌ ${getActionErrorMessage(error)}`);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${isPanelLayout ? "items-start" : "items-center"}`}>
      {canAct && (
        <div className="rounded-full border border-poker-gold/40 bg-poker-gold/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-poker-gold shadow-[0_8px_24px_rgba(240,180,41,0.12)]">
          Your Turn
        </div>
      )}
      <div className={`w-full ${isPanelLayout ? "space-y-2.5" : "grid gap-3"}`}>
        {isPanelLayout ? (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                className={`${SECONDARY_BUTTON_CLASS} w-full min-w-0`}
                onClick={handleFold}
                disabled={acting || !canAct}
              >
                Fold
              </button>

              <button
                className={`${SECONDARY_BUTTON_CLASS} w-full min-w-0`}
                onClick={canCheckNow ? handleCheck : handleCall}
                disabled={acting || !canAct}
              >
                {checkOrCallLabel}
              </button>

              <button
                className={`${RED_BUTTON_CLASS} w-full min-w-0`}
                onClick={handleAllIn}
                disabled={acting || !canAct}
              >
                ALL IN
              </button>
            </div>

            <div className={`grid gap-2 ${canDealNextHand ? "sm:grid-cols-[minmax(0,1.35fr),minmax(0,1fr),minmax(0,1.1fr)]" : "sm:grid-cols-[minmax(0,1.45fr),minmax(0,1fr)]"}`}>
              <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2 py-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={raiseAmountInput}
                  onChange={(e) => setRaiseAmountInput(e.target.value)}
                  className="w-24 rounded-lg border border-gray-700 bg-gray-800 px-3 py-3 text-center font-mono text-base font-semibold text-white focus:border-poker-gold/50 focus:outline-none sm:w-28"
                />
                <button
                  className={`${GOLD_BUTTON_CLASS} min-w-0 flex-1 text-sm`}
                  onClick={handleRaise}
                  disabled={acting || !canAct || !isRaiseAmountValid}
                >
                  Raise / Bet
                </button>
              </div>

              <button
                className={`${AMBER_BUTTON_CLASS} w-full min-w-0`}
                onClick={handleLeave}
                disabled={acting}
              >
                {canCashOut ? "Leave Table" : "Forfeit & Leave"}
              </button>

              {canDealNextHand && (
                <button
                  className={`${SECONDARY_BUTTON_CLASS} w-full min-w-0`}
                  onClick={handleDealNextHand}
                  disabled={acting}
                >
                  {gameState.handComplete ? "Play Another Hand" : "Play Again"}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className={`flex flex-wrap items-center ${isPanelLayout ? "justify-start" : "justify-center"} gap-2 sm:gap-3`}>
              <button
                className={SECONDARY_BUTTON_CLASS}
                onClick={handleFold}
                disabled={acting || !canAct}
              >
                Fold
              </button>

              {canCheckNow ? (
                <button
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={handleCheck}
                  disabled={acting || !canAct}
                >
                  Check
                </button>
              ) : (
                <button
                  className={SECONDARY_BUTTON_CLASS}
                  onClick={handleCall}
                  disabled={acting || !canAct}
                >
                  Call {formatTokenDisplay(callAmount)}
                </button>
              )}
            </div>

            <div className={`flex flex-wrap items-center ${isPanelLayout ? "justify-start" : "justify-center"} gap-2 sm:gap-3`}>
              <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-2 py-2">
                <input
                  type="text"
                  inputMode="decimal"
                  value={raiseAmountInput}
                  onChange={(e) => setRaiseAmountInput(e.target.value)}
                  className="w-24 rounded-lg border border-gray-700 bg-gray-800 px-3 py-3 text-center font-mono text-base font-semibold text-white focus:border-poker-gold/50 focus:outline-none sm:w-32"
                />
                <button
                  className={`${GOLD_BUTTON_CLASS} min-w-[148px] text-sm`}
                  onClick={handleRaise}
                  disabled={acting || !canAct || !isRaiseAmountValid}
                >
                  Raise / Bet
                </button>
              </div>

              <button
                className={RED_BUTTON_CLASS}
                onClick={handleAllIn}
                disabled={acting || !canAct}
              >
                ALL IN
              </button>

              <button
                className={AMBER_BUTTON_CLASS}
                onClick={handleLeave}
                disabled={acting}
              >
                {canCashOut ? "Leave Table" : "Forfeit & Leave"}
              </button>

              {canDealNextHand && (
                <button
                  className={`${SECONDARY_BUTTON_CLASS} min-w-[172px]`}
                  onClick={handleDealNextHand}
                  disabled={acting}
                >
                  {gameState.handComplete ? "Play Another Hand" : "Play Again"}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {!canAct && !gameState.handComplete && !canDealNextHand && (
        <p className={`text-xs text-gray-500 ${isPanelLayout ? "self-start" : "text-center"}`}>Waiting for the other player...</p>
      )}

      {canAct && !isRaiseAmountValid && (
        <p className={`text-xs text-gray-500 ${isPanelLayout ? "self-start" : "text-center"}`}>
          Raise must be at least {formatTokenDisplay(gameState.minRaise)}.
        </p>
      )}

      {canDealNextHand && (
        <p className={`text-xs text-gray-500 ${isPanelLayout ? "self-start" : "text-center"}`}>
          {isDealer ? "You can start the next hand now." : "Any seated player can start the next hand now."}
        </p>
      )}

      {message && <p className={`text-xs text-gray-400 ${isPanelLayout ? "self-start" : "text-center"}`}>{message}</p>}
    </div>
  );
}
