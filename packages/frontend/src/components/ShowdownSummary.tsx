import type { GameState } from "@/lib/types";
import { Card } from "./Card";

interface ShowdownSummaryProps {
  gameState: GameState;
}

export function ShowdownSummary({ gameState }: ShowdownSummaryProps) {
  const revealedAgents = gameState.agents.filter((agent) => agent.cardsRevealed && agent.cards.length > 0);

  if (!gameState.handComplete || revealedAgents.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-poker-text-dim">
        Revealed Hands
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {revealedAgents.map((agent) => (
          <div
            key={agent.id}
            className={`rounded-xl border px-3 py-3 ${
              agent.isWinner
                ? "border-emerald-300/35 bg-emerald-400/10"
                : "border-white/10 bg-black/10"
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">{agent.name}</div>
              {agent.isWinner && (
                <div className="rounded-full border border-emerald-300/35 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200">
                  Winner
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {agent.cards.map((card, index) => (
                <Card key={`${agent.id}-${card.rank}-${card.suit}-${index}`} card={card} index={index} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
