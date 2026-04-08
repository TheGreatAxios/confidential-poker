
import type { Agent } from "@/lib/types";
import { Card } from "./Card";
import { ChipStack } from "./ChipStack";

interface AgentAvatarProps {
  agent: Agent;
}

export function AgentAvatar({ agent }: AgentAvatarProps) {
  const seatBadges = [
    agent.isDealer
      ? {
          key: "dealer",
          label: "Dealer",
          className:
            "border-poker-dark bg-poker-gold text-poker-dark shadow-[0_4px_14px_rgba(240,180,41,0.35)]",
        }
      : null,
    agent.isSmallBlind
      ? {
          key: "small-blind",
          label: "Small Blind",
          className:
            "border-sky-300/50 bg-sky-400/15 text-sky-100 shadow-[0_6px_16px_rgba(56,189,248,0.2)]",
        }
      : null,
    agent.isBigBlind
      ? {
          key: "big-blind",
          label: "Big Blind",
          className:
            "border-rose-300/50 bg-rose-400/15 text-rose-100 shadow-[0_6px_16px_rgba(251,113,133,0.2)]",
        }
      : null,
  ].filter((badge): badge is { key: string; label: string; className: string } => badge !== null);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="text-center">
        <p className="max-w-[88px] truncate text-[11px] font-semibold leading-tight text-white sm:max-w-[104px] sm:text-xs">
          {agent.name}
        </p>
      </div>

      <div className="relative">
        {seatBadges.length > 0 && (
          <div className="absolute right-full top-1/2 mr-2.5 flex min-w-max -translate-y-1/2 flex-col items-end gap-1">
            {seatBadges.map((badge) => (
              <div
                key={badge.key}
                className={`flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] whitespace-nowrap ${badge.className}`}
              >
                {badge.label}
              </div>
            ))}
          </div>
        )}

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
        </div>
      </div>

      <ChipStack amount={agent.chips} color={agent.color} />

      {agent.cards.length > 0 && (
        <div className="flex gap-0.5">
          {agent.cards.map((card, i) => (
            <Card key={i} card={card} index={i} />
          ))}
        </div>
      )}

      {agent.message && agent.status !== "busted" && (
        <div className="chat-bubble hidden animate-slide-up text-gray-300 md:block">
          {agent.message}
        </div>
      )}

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
