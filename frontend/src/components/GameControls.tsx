"use client";

import { motion } from "framer-motion";
import { Play, Square, RotateCcw, Zap, Info, FoldVertical, Check, CircleDot, TrendingUp } from "lucide-react";
import clsx from "clsx";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import { POKER_TABLE_ABI } from "@/lib/abis";
import { CONTRACTS } from "@/lib/wagmi";
import type { Phase } from "@/lib/types";

interface GameControlsProps {
  isRunning: boolean;
  phase: Phase;
  handNumber: number;
  ante: number;
  busy?: boolean;
  onStart: () => void;
  onNewHand: () => void;
  onStop: () => void;
  isConnectedSeated: boolean;
  isMyTurn?: boolean;
  currentMaxBet?: bigint;
  playerBet?: bigint;
}

export default function GameControls({
  isRunning,
  phase,
  handNumber,
  ante,
  busy = false,
  onStart,
  onNewHand,
  onStop,
  isConnectedSeated,
  isMyTurn = false,
  currentMaxBet = 0n,
  playerBet = 0n,
}: GameControlsProps) {
  const { address, isConnected } = useAccount();
  const { writeContractAsync, data: txHash, isPending: isWriting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const isLoading = isWriting || isConfirming;

  // Join Table — call sitDown() with 0.01 ETH buy-in + empty viewer key
  const handleJoinTable = async () => {
    if (!isConnected || !address) return;
    try {
      await writeContractAsync({
        address: CONTRACTS.pokerTable,
        abi: POKER_TABLE_ABI,
        functionName: "sitDown",
        args: ["0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`],
        value: parseEther("0.01"),
      });
    } catch (err) {
      console.error("sitDown failed:", err);
    }
  };

  // Start Game — deal a new hand
  const handleDeal = async () => {
    if (!isConnected) return;
    try {
      await writeContractAsync({
        address: CONTRACTS.pokerTable,
        abi: POKER_TABLE_ABI,
        functionName: "dealNewHand",
      });
    } catch (err) {
      console.error("dealNewHand failed:", err);
    }
  };

  // In-game actions
  const handleFold = async () => {
    if (!isConnected) return;
    try {
      await writeContractAsync({
        address: CONTRACTS.pokerTable,
        abi: POKER_TABLE_ABI,
        functionName: "fold",
      });
    } catch (err) {
      console.error("fold failed:", err);
    }
  };

  const handleCheck = async () => {
    if (!isConnected) return;
    try {
      await writeContractAsync({
        address: CONTRACTS.pokerTable,
        abi: POKER_TABLE_ABI,
        functionName: "check",
      });
    } catch (err) {
      console.error("check failed:", err);
    }
  };

  const handleCall = async () => {
    if (!isConnected) return;
    try {
      await writeContractAsync({
        address: CONTRACTS.pokerTable,
        abi: POKER_TABLE_ABI,
        functionName: "call",
      });
    } catch (err) {
      console.error("call failed:", err);
    }
  };

  const handleRaise = async () => {
    if (!isConnected) return;
    const raiseAmount = currentMaxBet + parseEther("0.001"); // raise by 0.001 ETH
    try {
      await writeContractAsync({
        address: CONTRACTS.pokerTable,
        abi: POKER_TABLE_ABI,
        functionName: "raise",
        args: [raiseAmount],
      });
    } catch (err) {
      console.error("raise failed:", err);
    }
  };

  const callAmount = currentMaxBet > playerBet ? currentMaxBet - playerBet : 0n;

  return (
    <div className="w-full max-w-[900px] mx-auto">
      <div className="rounded-2xl glass-panel p-5">
        {/* Top row: Game info */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}>
              <Info className="w-3.5 h-3.5 text-white/35" />
              <span className="text-[11px] text-white/45 font-medium">
                Ante: <span className="text-poker-gold font-bold" style={{ textShadow: "0 0 8px rgba(212, 175, 55, 0.2)" }}>${ante}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}>
              <Zap className="w-3.5 h-3.5 text-white/35" />
              <span className="text-[11px] text-white/45 font-medium">
                Hand: <span className="text-white/75 font-bold">#{handNumber}</span>
              </span>
            </div>
          </div>

          {/* Wallet status */}
          <div className="flex items-center gap-2">
            {isConnected && (
              <span className="text-[10px] px-2.5 py-1 rounded-full font-medium" style={{
                background: "linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))",
                color: "rgba(34, 197, 94, 0.85)",
                border: "1px solid rgba(34, 197, 94, 0.15)",
              }}>
                {isConnectedSeated ? "SEATED" : "CONNECTED"}
              </span>
            )}
            {/* Status indicator with pulsing dot */}
            <div className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full border",
              isRunning
                ? "border-green-500/25"
                : "border-gray-600/25"
            )} style={{
              background: isRunning
                ? "linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(34, 197, 94, 0.03))"
                : "linear-gradient(135deg, rgba(107, 114, 128, 0.08), rgba(107, 114, 128, 0.03))",
            }}>
              <motion.div
                animate={isRunning ? { scale: [1, 1.4, 1], opacity: [1, 0.4, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
                className={clsx(
                  "w-1.5 h-1.5 rounded-full",
                  isRunning ? "bg-green-400" : "bg-gray-500"
                )}
                style={isRunning ? { boxShadow: "0 0 8px rgba(34, 197, 94, 0.5)" } : {}}
              />
              <span className={clsx(
                "text-[10px] font-bold uppercase tracking-[0.15em]",
                isRunning ? "text-green-400" : "text-gray-500"
              )}>
                {isRunning ? "Live" : "Paused"}
              </span>
            </div>
          </div>
        </div>

        {/* TX Status */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg"
            style={{
              background: "rgba(212, 175, 55, 0.05)",
              border: "1px solid rgba(212, 175, 55, 0.1)",
            }}
          >
            <div className="w-3 h-3 rounded-full border-2 border-poker-gold/30 border-t-poker-gold animate-spin" />
            <span className="text-[11px] text-poker-gold/80">
              {isWriting ? "Confirm in wallet..." : "Confirming on-chain..."}
            </span>
            {txHash && (
              <a
                href={`https://base-sepolia-testnet-explorer.skalenodes.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-blue-400 hover:text-blue-300 ml-auto underline"
              >
                View TX
              </a>
            )}
          </motion.div>
        )}

        {isSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 px-3 py-2 rounded-lg"
            style={{
              background: "rgba(34, 197, 94, 0.05)",
              border: "1px solid rgba(34, 197, 94, 0.15)",
            }}
          >
            <span className="text-[11px] text-green-400/90">✓ Transaction confirmed</span>
          </motion.div>
        )}

        {/* Bottom row: Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Start Game / Deal — green gradient */}
          {!isRunning && (
            <motion.button
              whileHover={{ scale: isLoading ? 1 : 1.04 }}
              whileTap={{ scale: isLoading ? 1 : 0.96 }}
              onClick={handleDeal}
              disabled={isLoading || !isConnectedSeated}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
                text-white
                transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #16A34A, #22C55E, #16A34A)",
                boxShadow: "0 4px 16px rgba(34, 197, 94, 0.25), 0 0 0 0 rgba(34, 197, 94, 0)",
              }}
            >
              <Play className="w-4 h-4" />
              Deal Hand
            </motion.button>
          )}

          {/* New Hand — blue gradient */}
          {isRunning && phase === "Showdown" && (
            <motion.button
              whileHover={{ scale: isLoading ? 1 : 1.04 }}
              whileTap={{ scale: isLoading ? 1 : 0.96 }}
              onClick={handleDeal}
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
                text-white
                transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, #2563EB, #3B82F6, #2563EB)",
                boxShadow: "0 4px 16px rgba(59, 130, 246, 0.25)",
              }}
            >
              <RotateCcw className="w-4 h-4" />
              New Hand
            </motion.button>
          )}

          {/* Stop Game — red gradient */}
          {isRunning && (
            <motion.button
              whileHover={{ scale: isLoading ? 1 : 1.04 }}
              whileTap={{ scale: isLoading ? 1 : 0.96 }}
              onClick={onStop}
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
                text-white
                transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #DC2626, #EF4444, #DC2626)",
                boxShadow: "0 4px 16px rgba(239, 68, 68, 0.25)",
              }}
            >
              <Square className="w-4 h-4" />
              Stop
            </motion.button>
          )}

          {/* Join Table — gold gradient (hide if already seated) */}
          {!isConnectedSeated && (
            <motion.button
              whileHover={{ scale: isLoading ? 1 : 1.04 }}
              whileTap={{ scale: isLoading ? 1 : 0.96 }}
              onClick={handleJoinTable}
              disabled={isLoading || !isConnected}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm ml-auto
                text-black
                transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #9A7B2A, #D4AF37, #FFD700, #D4AF37)",
                boxShadow: "0 4px 16px rgba(212, 175, 55, 0.3), 0 0 32px rgba(212, 175, 55, 0.08)",
              }}
            >
              <Zap className="w-4 h-4" />
              Join Table (0.01 ETH)
            </motion.button>
          )}

          {/* Leave Table (when seated) */}
          {isConnectedSeated && !isRunning && (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm ml-auto
                text-white/80
                transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              Leave Table
            </motion.button>
          )}
        </div>

        {/* In-Game Action Buttons — only when it's your turn */}
        {isRunning && isMyTurn && phase !== "Showdown" && phase !== "Finished" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-xl"
            style={{
              background: "linear-gradient(135deg, rgba(212, 175, 55, 0.06), rgba(212, 175, 55, 0.02))",
              border: "1px solid rgba(212, 175, 55, 0.15)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-poker-gold"
                style={{ boxShadow: "0 0 8px rgba(212, 175, 55, 0.6)" }}
              />
              <span className="text-xs font-bold text-poker-gold tracking-widest uppercase">Your Turn — {phase}</span>
              {callAmount > 0n && (
                <span className="text-[10px] text-white/40 ml-auto">
                  To call: <span className="text-poker-gold font-mono">{callAmount.toString()}</span> wei
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Fold */}
              <motion.button
                whileHover={{ scale: isLoading ? 1 : 1.04 }}
                whileTap={{ scale: isLoading ? 1 : 0.96 }}
                onClick={handleFold}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs
                  text-white/80 transition-all disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, rgba(220, 38, 38, 0.2), rgba(220, 38, 38, 0.1))",
                  border: "1px solid rgba(220, 38, 38, 0.25)",
                }}
              >
                Fold
              </motion.button>

              {/* Check (when no bet to call) */}
              {callAmount === 0n && (
                <motion.button
                  whileHover={{ scale: isLoading ? 1 : 1.04 }}
                  whileTap={{ scale: isLoading ? 1 : 0.96 }}
                  onClick={handleCheck}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs
                    text-white transition-all disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))",
                    border: "1px solid rgba(34, 197, 94, 0.25)",
                  }}
                >
                  Check
                </motion.button>
              )}

              {/* Call (when there's a bet to match) */}
              {callAmount > 0n && (
                <motion.button
                  whileHover={{ scale: isLoading ? 1 : 1.04 }}
                  whileTap={{ scale: isLoading ? 1 : 0.96 }}
                  onClick={handleCall}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs
                    text-white transition-all disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))",
                    border: "1px solid rgba(34, 197, 94, 0.25)",
                  }}
                >
                  Call
                </motion.button>
              )}

              {/* Raise */}
              <motion.button
                whileHover={{ scale: isLoading ? 1 : 1.04 }}
                whileTap={{ scale: isLoading ? 1 : 0.96 }}
                onClick={handleRaise}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs
                  text-black transition-all disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #D4AF37, #FFD700)",
                  border: "1px solid rgba(212, 175, 55, 0.4)",
                }}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Raise
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Status message */}
        {isRunning && phase !== "Showdown" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-[11px] text-white/30 text-center tracking-wide"
          >
            Game running... Hand #{handNumber} • {phase}
          </motion.p>
        )}
        {!isRunning && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-[11px] text-white/30 text-center tracking-wide"
          >
            {!isConnected
              ? "Connect your wallet to join the table"
              : !isConnectedSeated
              ? "Press <span className=\"text-poker-gold/80 font-semibold\">Join Table</span> to take a seat (0.01 ETH buy-in)"
              : "Press <span className=\"text-green-400/80 font-semibold\">Deal Hand</span> to start playing"}
          </motion.p>
        )}
      </div>
    </div>
  );
}
