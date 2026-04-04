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
  onStart: () => void;
  onNewHand: () => void;
  onStop: () => void;
}

export default function GameControls({
  isRunning,
  phase,
  handNumber,
  ante,
  onStart,
  onNewHand,
  onStop,
}: GameControlsProps) {
  return (
    <div className="w-full max-w-[900px] mx-auto">
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-5">
        {/* Top row: Game info */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <Info className="w-3.5 h-3.5 text-white/40" />
              <span className="text-[11px] text-white/50 font-medium">
                Ante: <span className="text-poker-gold font-bold">$${ante}</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <Zap className="w-3.5 h-3.5 text-white/40" />
              <span className="text-[11px] text-white/50 font-medium">
                Hand: <span className="text-white/80 font-bold">#{handNumber}</span>
              </span>
            </div>
          </div>

          {/* Status indicator */}
          <div className={clsx(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full border",
            isRunning
              ? "bg-green-500/10 border-green-500/30"
              : "bg-gray-500/10 border-gray-500/30"
          )}>
            <motion.div
              animate={isRunning ? { scale: [1, 1.3, 1], opacity: [1, 0.5, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}
              className={clsx(
                "w-1.5 h-1.5 rounded-full",
                isRunning ? "bg-green-500" : "bg-gray-500"
              )}
            />
            <span className={clsx(
              "text-[10px] font-bold uppercase tracking-wider",
              isRunning ? "text-green-400" : "text-gray-400"
            )}>
              {isRunning ? "Live" : "Paused"}
            </span>
          </div>
        </div>

        {/* Bottom row: Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Start Game */}
          {!isRunning && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onStart}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
                bg-gradient-to-r from-green-600 to-green-500 text-white
                shadow-lg shadow-green-500/20
                hover:shadow-green-500/40 hover:from-green-500 hover:to-green-400
                transition-all duration-200"
            >
              <Play className="w-4 h-4" />
              Start Game
            </motion.button>
          )}

          {/* New Hand */}
          {isRunning && phase === "Showdown" && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onNewHand}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
                bg-gradient-to-r from-blue-600 to-blue-500 text-white
                shadow-lg shadow-blue-500/20
                hover:shadow-blue-500/40 hover:from-blue-500 hover:to-blue-400
                transition-all duration-200"
            >
              <RotateCcw className="w-4 h-4" />
              New Hand
            </motion.button>
          )}

          {/* Stop Game */}
          {isRunning && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onStop}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
                bg-gradient-to-r from-red-600 to-red-500 text-white
                shadow-lg shadow-red-500/20
                hover:shadow-red-500/40 hover:from-red-500 hover:to-red-400
                transition-all duration-200"
            >
              <Square className="w-4 h-4" />
              Stop
            </motion.button>
          )}

          {/* Join Table (decorative) */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm ml-auto
              bg-gradient-to-r from-poker-goldDark to-poker-gold text-black
              shadow-lg shadow-poker-gold/20
              hover:shadow-poker-gold/40 hover:from-poker-gold hover:to-poker-goldLight
              transition-all duration-200"
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
            className="mt-3 text-[11px] text-white/40 text-center"
          >
            Game running... Hand #{handNumber} • {phase}
          </motion.p>
        )}
        {!isRunning && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 text-[11px] text-white/40 text-center"
          >
            Press <span className="text-green-400 font-semibold">Start Game</span> to begin the AI poker night
          </motion.p>
        )}
      </div>
    </div>
  );
}
