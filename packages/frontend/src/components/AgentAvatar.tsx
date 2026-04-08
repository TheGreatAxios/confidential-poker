
import type { Agent } from "@/lib/types";
import { Card } from "./Card";
import { ChipStack } from "./ChipStack";

interface AgentAvatarProps {
  agent: Agent;
}

export function AgentAvatar({ agent }: AgentAvatarProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        {agent.status === "acting" && (
          <div className="absolute inset-[-10px] rounded-full border-2 border-poker-gold/70 shadow-[0_0_32px_rgba(240,180,41,0.55)] animate-pulse" />
        )}
        {agent.isWinner && (
          <div className="absolute inset-[-14px] rounded-full border border-emerald-300/60 shadow-[0_0_36px_rgba(52,211,153,0.45)]" />
        )}

        {/* Avatar Circle */}
        <div
          className={`relative h-12 w-12 rounded-full border-2 text-xl transition-all duration-300 sm:h-16 sm:w-16 sm:text-3xl ${
          agent.status === "busted"
            ? "bg-gray-800 border-gray-700 opacity-50"
            : agent.isWinner
            ? "bg-emerald-900/50 border-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.35)]"
            : agent.status === "acting"
            ? "bg-amber-950/90 border-poker-gold glow-gold"
            : agent.status === "folded"
            ? "bg-gray-800 border-gray-600 opacity-70"
            : agent.status === "all-in"
            ? "bg-red-900/30 border-red-500 animate-pulse"
            : "bg-gray-800 border-gray-600"
        } flex items-center justify-center`}
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

          {agent.isDealer && (
            <div className="absolute -bottom-3 -right-6 flex items-center justify-center rounded-full border border-poker-dark bg-poker-gold px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-poker-dark shadow-[0_4px_14px_rgba(240,180,41,0.35)]">
              Dealer
            </div>
          )}

          {agent.isSmallBlind && (
            <div className="absolute -left-16 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full border border-sky-300/50 bg-sky-400/15 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-sky-100 shadow-[0_6px_16px_rgba(56,189,248,0.2)]">
              Small Blind
            </div>
          )}

          {agent.isBigBlind && (
            <div className="absolute -right-16 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full border border-rose-300/50 bg-rose-400/15 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-rose-100 shadow-[0_6px_16px_rgba(251,113,133,0.2)]">
              Big Blind
            </div>
          )}
        </div>
      </div>

      {/* Agent Name */}
      <div className="text-center">
        <p className="max-w-[72px] truncate text-[11px] font-semibold leading-tight text-white sm:max-w-[86px] sm:text-xs">
          {agent.name}
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
        <div className="chat-bubble hidden animate-slide-up text-gray-300 md:block">
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
      {agent.isWinner && (
        <span className="rounded-full border border-emerald-300/35 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200">
          Winner
        </span>
      )}
      {agent.status === "acting" && (
        <span className="rounded-full border border-poker-gold/40 bg-poker-gold/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-poker-gold">
          Acting
        </span>
      )}
    </div>
  );
}
