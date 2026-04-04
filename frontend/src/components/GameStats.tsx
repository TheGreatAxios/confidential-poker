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
    <div className="rounded-xl glass-panel p-4">
      {/* Header */}
      <h3 className="text-sm font-semibold text-white/90 mb-3 flex items-center gap-2">
        <Activity className="w-4 h-4 text-poker-green" style={{
          filter: "drop-shadow(0 0 4px rgba(34, 197, 94, 0.3))",
        }} />
        Leaderboard
      </h3>

      {/* Hand info */}
      <div className="flex items-center gap-3 mb-3 text-[10px] text-gray-500 tracking-wide">
        <span>Hand #{String(game.handNumber)}</span>
        <span className="w-1 h-1 rounded-full bg-gray-700" />
        <span>{activePlayers} players</span>
        <span className="w-1 h-1 rounded-full bg-gray-700" />
        <span>{game.phase}</span>
      </div>

      {/* Leaderboard rows */}
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

          // Rank badge colors — gold for #1, silver for #2, bronze for #3
          const rankStyle = index === 0
            ? { background: "linear-gradient(135deg, rgba(212, 175, 55, 0.2), rgba(255, 215, 0, 0.15))", color: "#FFD700", boxShadow: "0 0 8px rgba(255, 215, 0, 0.15)" }
            : index === 1
            ? { background: "linear-gradient(135deg, rgba(192, 192, 192, 0.15), rgba(192, 192, 192, 0.08))", color: "#C0C0C0", boxShadow: "none" }
            : index === 2
            ? { background: "linear-gradient(135deg, rgba(180, 120, 60, 0.15), rgba(180, 120, 60, 0.08))", color: "#CD7F32", boxShadow: "none" }
            : { background: "rgba(255,255,255,0.04)", color: "#4B5563", boxShadow: "none" };

          return (
            <motion.div
              key={player.address}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.06, duration: 0.3 }}
              className={clsx(
                "flex items-center gap-2 p-2 rounded-lg border transition-all duration-200",
                isDealer
                  ? "border-poker-gold/20"
                  : isActive
                  ? "border-poker-gold/10"
                  : "border-white/[0.04]"
              )}
              style={{
                background: "linear-gradient(135deg, rgba(0,0,0,0.2), rgba(0,0,0,0.1))",
              }}
            >
              {/* Rank badge */}
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                style={rankStyle}
              >
                {index === 0 ? (
                  <Trophy className="w-3 h-3" />
                ) : (
                  index + 1
                )}
              </span>

              {/* Address avatar */}
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 font-mono" style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
                color: "rgba(255,255,255,0.4)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}>
                {shortAddr.slice(0, 2)}
              </div>

              {/* Name + PnL */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-white/85 truncate font-mono">
                    {shortAddr}
                  </span>
                  {isDealer && (
                    <span className="text-[8px] px-1 py-0 rounded font-bold" style={{
                      background: "rgba(212, 175, 55, 0.15)",
                      color: "#D4AF37",
                    }}>
                      D
                    </span>
                  )}
                  {player.folded && (
                    <span className="text-[9px] text-gray-600 font-medium">FOLDED</span>
                  )}
                </div>
                <span
                  className={clsx(
                    "text-[10px] font-mono",
                    isWinning && "text-poker-green",
                    isLosing && "text-poker-red",
                    !isWinning && !isLosing && "text-gray-500"
                  )}
                  style={isWinning ? { textShadow: "0 0 6px rgba(34, 197, 94, 0.2)" } : {}}
                >
                  {pnl >= 0 ? "+" : ""}
                  {formatChips(pnl)} ({pnl >= 0 ? "+" : ""}
                  {formatPercent(pnlPercent)})
                </span>
              </div>

              {/* Stack bar */}
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-mono font-bold text-white/90">
                  {formatChips(stack)}
                </span>
                <div className="w-14 h-1 rounded-full overflow-hidden" style={{
                  background: "rgba(255,255,255,0.04)",
                }}>
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, (stack / (startingStack * 2)) * 100)}%`,
                    }}
                    transition={{ duration: 0.8, delay: index * 0.08, ease: "easeOut" }}
                    style={{
                      background: isWinning
                        ? "linear-gradient(90deg, #16A34A, #22C55E)"
                        : isLosing
                        ? "linear-gradient(90deg, #DC2626, #EF4444)"
                        : "linear-gradient(90deg, #6B7280, #9CA3AF)",
                      boxShadow: isWinning
                        ? "0 0 6px rgba(34, 197, 94, 0.3)"
                        : isLosing
                        ? "0 0 6px rgba(239, 68, 68, 0.2)"
                        : "none",
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
