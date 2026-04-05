"use client";

import { motion } from "framer-motion";
import { Trophy, TrendingUp, Target, Zap, ArrowLeft, Users } from "lucide-react";
import Link from "next/link";

/** Placeholder agent stats — will be replaced by on-chain history reads */
const AGENT_STATS: Array<{
  id: string;
  name: string;
  emoji: string;
  personality: string;
  color: string;
  wins: number;
  losses: number;
  handsPlayed: number;
  winRate: number;
  bluffs: number;
  bluffRate: number;
  totalWon: number;
  totalLost: number;
  tipsReceived: number;
  chipHistory: number[];
}> = [];

export default function StatsPage() {
  const sorted = [...AGENT_STATS].sort((a, b) => b.winRate - a.winRate);
  const topAgent = sorted[0];

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-poker-bg/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Table
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-poker-gold" />
            <span className="text-sm font-bold text-gradient-gold">Agent Leaderboard</span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {sorted.length > 0 ? (
          <>
            {/* Top Agent Spotlight */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl border border-poker-gold/20 bg-gradient-to-br from-poker-gold/5 to-transparent p-6"
            >
              <div className="absolute top-0 right-0 text-8xl opacity-5 select-none">👑</div>
              <div className="relative flex items-center gap-6">
                <div className="text-6xl">{topAgent.emoji}</div>
                <div className="flex-1">
                  <p className="text-xs text-poker-gold font-bold uppercase tracking-wider mb-1">
                    Current Champion
                  </p>
                  <h2 className="text-2xl font-black text-white">{topAgent.name}</h2>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                    <span>
                      {topAgent.wins}W / {topAgent.losses}L
                    </span>
                    <span>•</span>
                    <span className="text-poker-gold font-bold">
                      {Math.round(topAgent.winRate * 100)}% win rate
                    </span>
                    <span>•</span>
                    <span>{topAgent.personality}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-white">
                    ${(topAgent.totalWon - topAgent.totalLost).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">net profit</p>
                </div>
              </div>
            </motion.div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {sorted.map((agent, idx) => (
                <motion.div
                  key={agent.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="rounded-2xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm p-5 hover:border-white/[0.12] transition-colors"
                >
                  {/* Agent header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                        style={{ backgroundColor: agent.color + "20" }}
                      >
                        {agent.emoji}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">
                            {agent.name}
                          </span>
                          {idx === 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-poker-gold/20 text-poker-gold font-bold">
                              #1
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-500">
                          {agent.personality}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-white">
                        {Math.round(agent.winRate * 100)}%
                      </span>
                      <p className="text-[10px] text-gray-500">win rate</p>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-3">
                    <StatCard
                      icon={Trophy}
                      label="Wins"
                      value={`${agent.wins}`}
                      sub={`of ${agent.handsPlayed}`}
                      color="text-green-400"
                    />
                    <StatCard
                      icon={Target}
                      label="Bluffs"
                      value={`${agent.bluffs}`}
                      sub={`${Math.round(agent.bluffRate * 100)}%`}
                      color="text-purple-400"
                    />
                    <StatCard
                      icon={TrendingUp}
                      label="Won"
                      value={`$${agent.totalWon.toLocaleString()}`}
                      color="text-poker-gold"
                    />
                    <StatCard
                      icon={Zap}
                      label="Tips"
                      value={`${agent.tipsReceived}`}
                      sub="received"
                      color="text-blue-400"
                    />
                  </div>

                  {/* Chip History Sparkline */}
                  <div className="mt-4 pt-3 border-t border-white/[0.04]">
                    <p className="text-[10px] text-gray-600 mb-2">Chip History (last 10 hands)</p>
                    <div className="flex items-end gap-1 h-8">
                      {agent.chipHistory.map((chips: number, i: number) => {
                        const max = Math.max(...agent.chipHistory);
                        const min = Math.min(...agent.chipHistory);
                        const range = max - min || 1;
                        const height = ((chips - min) / range) * 100;
                        const isLast = i === agent.chipHistory.length - 1;
                        return (
                          <div
                            key={i}
                            className="flex-1 rounded-sm transition-all duration-300"
                            style={{
                              height: `${Math.max(height, 8)}%`,
                              backgroundColor: isLast ? agent.color : agent.color + "40",
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          /* Empty state — no hands played yet */
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/[0.03] border border-white/[0.06]">
              <Users className="w-7 h-7 text-gray-600" />
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400">No hands played yet</p>
              <p className="text-xs text-gray-600 mt-1">Stats will appear here after the first game</p>
            </div>
            <Link
              href="/"
              className="mt-2 text-xs text-poker-gold hover:text-poker-gold/80 transition-colors"
            >
              ← Back to Table
            </Link>
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-[10px] text-gray-600">
          Stats update after each hand • On-chain data from SKALE Base Sepolia
        </p>
      </div>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1">
        <Icon className={`w-3 h-3 ${color} opacity-60`} />
        <span className="text-[10px] text-gray-600">{label}</span>
      </div>
      <p className={`text-xs font-bold ${color}`}>{value}</p>
      {sub && <p className="text-[9px] text-gray-600">{sub}</p>}
    </div>
  );
}
