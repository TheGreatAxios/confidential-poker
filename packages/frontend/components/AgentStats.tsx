"use client";

import type { Agent } from "@/lib/types";
import { TipButton } from "./TipButton";

interface AgentStatsProps {
  agents: Agent[];
}

export function AgentStats({ agents }: AgentStatsProps) {
  const sorted = [...agents].sort((a, b) => b.chips - a.chips);

  return (
    <div className="w-full max-w-3xl">
      <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-3 text-center">
        Leaderboard
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {sorted.map((agent, i) => (
          <div
            key={agent.id}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
              i === 0
                ? "bg-poker-gold/10 border-poker-gold/30"
                : agent.status === "busted"
                ? "bg-gray-900/50 border-gray-800/30 opacity-50"
                : "bg-gray-800/30 border-gray-700/30"
            }`}
          >
            <div className="flex items-center gap-1">
              <span className="text-sm">{agent.emoji}</span>
              <span className="text-xs font-semibold text-white truncate max-w-[80px]">
                {agent.name}
              </span>
            </div>
            <div className="text-[10px] font-mono text-gray-400">
              {(agent.winRate * 100).toFixed(0)}% WR
            </div>
            <div className="text-xs font-mono font-bold text-gray-200">
              {agent.chips.toLocaleString()}
            </div>
            <div className="text-[10px] text-gray-600">
              {agent.handsPlayed} hands
            </div>
            <TipButton
              agentId={agent.id}
              agentName={agent.name}
              agentEmoji={agent.emoji}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
