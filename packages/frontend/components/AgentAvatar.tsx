"use client";

import type { Agent } from "@/lib/types";
import { Card } from "./Card";
import { ChipStack } from "./ChipStack";

interface AgentAvatarProps {
  agent: Agent;
}

export function AgentAvatar({ agent }: AgentAvatarProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Avatar Circle */}
      <div
        className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-2xl sm:text-3xl border-2 transition-all duration-300 ${
          agent.status === "busted"
            ? "bg-gray-800 border-gray-700 opacity-50"
            : agent.status === "acting"
            ? "bg-gray-800 border-poker-gold gold-glow"
            : agent.status === "folded"
            ? "bg-gray-800 border-gray-600 opacity-70"
            : agent.status === "all-in"
            ? "bg-red-900/30 border-red-500 animate-pulse"
            : "bg-gray-800 border-gray-600"
        }`}
      >
        <span>{agent.emoji}</span>

        {/* Thinking indicator */}
        {agent.isThinking && (
          <div className="absolute -top-1 -right-1">
            <div className="thinking-dots flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-poker-gold" />
              <span className="w-1 h-1 rounded-full bg-poker-gold" />
              <span className="w-1 h-1 rounded-full bg-poker-gold" />
            </div>
          </div>
        )}

        {/* Dealer chip */}
        {agent.isDealer && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-poker-gold text-poker-dark text-[10px] font-bold flex items-center justify-center border border-poker-dark">
            D
          </div>
        )}
      </div>

      {/* Agent Name */}
      <div className="text-center">
        <p className="text-xs font-semibold text-white leading-tight truncate max-w-[80px]">
          {agent.name}
        </p>
        <p className="text-[10px] text-gray-500">
          {agent.personality}
        </p>
      </div>

      {/* Cards */}
      {agent.cards.length > 0 && (
        <div className="flex gap-0.5">
          {agent.cards.map((card, i) => (
            <Card key={i} card={card} index={i} />
          ))}
        </div>
      )}

      {/* Chat Bubble */}
      {agent.message && agent.status !== "busted" && (
        <div className="chat-bubble animate-slide-up text-gray-300">
          {agent.message}
        </div>
      )}

      {/* Chips */}
      <ChipStack amount={agent.chips} color={agent.color} />

      {/* Status Badge */}
      {agent.status === "folded" && (
        <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
          Folded
        </span>
      )}
      {agent.status === "all-in" && (
        <span className="text-[10px] text-red-400 font-semibold uppercase tracking-wider animate-pulse">
          ALL IN
        </span>
      )}
      {agent.status === "busted" && (
        <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">
          Busted
        </span>
      )}
    </div>
  );
}
