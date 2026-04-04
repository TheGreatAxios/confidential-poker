"use client";

import { motion } from "framer-motion";
import { Trophy, TrendingUp, Activity } from "lucide-react";
import type { GameState } from "@/lib/types";
import { formatChips, formatPercent } from "@/lib/format";
import clsx from "clsx";

interface GameStatsProps {
  game: GameState;
}

export default function GameStats({ game }: GameStatsProps) {
  // Sort players by stack (descending)
  const leaderboard = [...game.players]
    .filter((p) => p.isSeated)
    .sort((a, b) => Number(b.stack - a.stack));
  const totalStack = leaderboard.reduce((sum, p) => sum + Number(p.stack), 0);
  const startingStack = 10000;

  const activePlayers = leaderboard.filter((p) => !p.folded).length;

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 backdrop-blur-sm">
      <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
        <Activity className="w-4 h-4 text-poker-green" />
        Leaderboard
      </h3>

      {/* Hand info */}
      <div className="flex items-center gap-3 mb-3 text-[10px] text-gray-500">
        <span>Hand #{String(game.handNumber)}</span>
        <span className="w-1 h-1 rounded-full bg-gray-700" />
        <span>{activePlayers} players</span>
        <span className="w-1 h-1 rounded-full bg-gray-700" />
        <span>{game.phase}</span>
      </div>

      {/* Leaderboard */}
      <div className="space-y-2">
        {leaderboard.map((player, index) => {
          const stack = Number(player.stack);
          const pnl = stack - startingStack;
          const pnlPercent = pnl / startingStack;
          const isWinning = pnl > 0;
          const isLosing = pnl < 0;
          const isDealer = player.isDealer;
          const isActive = player.isActive;

          // Truncate address for display
          const shortAddr = player.address
            ? `${player.address.slice(0, 6)}...${player.address.slice(-4)}`
            : "Unknown";

          return (
            <motion.div
              key={player.address}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={clsx(
                "flex items-center gap-2 p-2 rounded-lg bg-black/20 border transition-colors",
                isDealer
                  ? "border-poker-gold/30"
                  : isActive
                  ? "border-poker-gold/20"
                  : "border-white/5"
              )}
            >
              {/* Rank */}
              <span
                className={clsx(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                  index === 0 && "bg-poker-gold/20 text-poker-gold",
                  index === 1 && "bg-gray-400/20 text-gray-300",
                  index === 2 && "bg-amber-700/20 text-amber-600",
                  index > 2 && "bg-white/5 text-gray-600"
                )}
              >
                {index + 1}
              </span>

              {/* Address avatar */}
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 bg-white/10 text-gray-400 font-mono">
                {shortAddr.slice(0, 2)}
              </div>

              {/* Name + PnL */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-white truncate font-mono">
                    {shortAddr}
                  </span>
                  {isDealer && (
                    <span className="text-[8px] px-1 py-0 rounded bg-poker-gold/20 text-poker-gold font-bold">
                      D
                    </span>
                  )}
                  {player.folded && (
                    <span className="text-[9px] text-gray-600">FOLDED</span>
                  )}
                </div>
                <span
                  className={clsx(
                    "text-[10px] font-mono",
                    isWinning && "text-poker-green",
                    isLosing && "text-poker-red",
                    !isWinning && !isLosing && "text-gray-500"
                  )}
                >
                  {pnl >= 0 ? "+" : ""}
                  {formatChips(pnl)} ({pnl >= 0 ? "+" : ""}
                  {formatPercent(pnlPercent)})
                </span>
              </div>

              {/* Stack bar */}
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-mono font-bold text-white">
                  {formatChips(stack)}
                </span>
                <div className="w-12 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (stack / (startingStack * 2)) * 100)}%`,
                      backgroundColor: isWinning ? "#22C55E" : isLosing ? "#EF4444" : "#9CA3AF",
                    }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
