
import { useMemo } from "react";
import type { Agent } from "@/lib/types";
import { formatTokenAmount } from "@/lib/token-format";

interface AgentStatsProps {
  agents: Agent[];
}

export function AgentStats({ agents }: AgentStatsProps) {
  const sorted = useMemo(
    () => [...agents].sort((a, b) => (a.chips === b.chips ? 0 : a.chips > b.chips ? -1 : 1)),
    [agents],
  );

  return (
    <div className="w-full max-w-5xl">
      <h3 className="mb-2 text-center text-[11px] uppercase tracking-[0.2em] text-gray-500 sm:mb-3 sm:text-xs">
        Leaderboard
      </h3>
      <div className="leaderboard-scroll -mx-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-2 sm:grid sm:min-w-0 sm:grid-cols-3 lg:grid-cols-6">
          {sorted.map((agent, i) => (
            <div
              key={agent.id}
              className={`flex min-w-[148px] flex-col items-center gap-1 rounded-xl border p-3 transition-all sm:min-w-0 ${
                i === 0
                  ? "border-poker-gold/30 bg-poker-gold/10"
                  : agent.status === "busted"
                    ? "border-gray-800/30 bg-gray-900/50 opacity-50"
                    : "border-gray-700/30 bg-gray-800/30"
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="text-sm">{agent.emoji}</span>
                <span className="max-w-[90px] truncate text-xs font-semibold text-white">
                  {agent.name}
                </span>
              </div>
              <div className="text-xs font-bold font-mono text-gray-200">
                {formatTokenAmount(agent.chips)}
              </div>
              <div className="text-[10px] text-gray-600">
                {agent.handsPlayed} hands
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
