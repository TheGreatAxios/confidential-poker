"use client";

import { motion } from "framer-motion";
import { Play, Square, RotateCcw, Zap, Info } from "lucide-react";
import clsx from "clsx";
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
}: GameControlsProps) {
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

        {/* Bottom row: Buttons — gradient, tactile */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Start Game — green gradient */}
          {!isRunning && (
            <motion.button
              whileHover={{ scale: busy ? 1 : 1.04 }}
              whileTap={{ scale: busy ? 1 : 0.96 }}
              onClick={onStart}
              disabled={busy}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
                text-white
                transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #16A34A, #22C55E, #16A34A)",
                boxShadow: "0 4px 16px rgba(34, 197, 94, 0.25), 0 0 0 0 rgba(34, 197, 94, 0)",
              }}
            >
              <Play className="w-4 h-4" />
              Start Game
            </motion.button>
          )}

          {/* New Hand — blue gradient */}
          {isRunning && phase === "Showdown" && (
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={onNewHand}
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
              whileHover={{ scale: busy ? 1 : 1.04 }}
              whileTap={{ scale: busy ? 1 : 0.96 }}
              onClick={onStop}
              disabled={busy}
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

          {/* Join Table — gold gradient */}
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm ml-auto
              text-black
              transition-all duration-200"
            style={{
              background: "linear-gradient(135deg, #9A7B2A, #D4AF37, #FFD700, #D4AF37)",
              boxShadow: "0 4px 16px rgba(212, 175, 55, 0.3), 0 0 32px rgba(212, 175, 55, 0.08)",
            }}
          >
            <Zap className="w-4 h-4" />
            Join Table
          </motion.button>
        </div>

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
            Press <span className="text-green-400/80 font-semibold">Start Game</span> to begin the AI poker night
          </motion.p>
        )}
      </div>
    </div>
  );
}
