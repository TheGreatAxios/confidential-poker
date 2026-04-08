import type { GameState } from "@/lib/types";
import type { ReactNode } from "react";
import { formatTokenDisplay } from "@/lib/token-format";
import { Card } from "./Card";

interface PlayerHandPanelProps {
  gameState: GameState;
  controls?: ReactNode;
}

export function PlayerHandPanel({ gameState, controls }: PlayerHandPanelProps) {
  const humanPlayer = gameState.humanPlayer;
  if (!humanPlayer) {
    return null;
  }

  const winnerNames = gameState.agents.filter((agent) => agent.isWinner).map((agent) => agent.name);
  const handStatusLabel = humanPlayer.isWinner
    ? "You won this hand."
    : winnerNames.length > 0
      ? `${winnerNames.join(" & ")} won the hand.`
      : gameState.handComplete
        ? "Hand complete."
        : humanPlayer.status === "acting"
          ? "Your action is live."
          : "Waiting for the next action.";

  return (
    <div className="w-full max-w-5xl rounded-[28px] border border-white/10 bg-white/[0.04] px-5 py-5 shadow-[0_24px_70px_rgba(0,0,0,0.38)] backdrop-blur-sm sm:px-6">
      <div className="flex flex-col gap-5 md:flex-row md:items-stretch">
        <div className="rounded-2xl border border-white/8 bg-black/10 px-5 py-5 md:flex md:w-[340px] md:flex-none md:flex-col md:items-center md:justify-center">
          <div className="md:text-center">
            <div className="text-[11px] uppercase tracking-[0.16em] text-poker-text-dim">
              Your Hand
            </div>
            <div className="mt-1 text-sm font-semibold text-white">{handStatusLabel}</div>
          </div>

          <div className="mt-5 flex min-h-[180px] items-center gap-3 md:justify-center">
            {humanPlayer.cards.length > 0 ? (
              humanPlayer.cards.map((card, index) => (
                <Card key={`${card.rank}-${card.suit}-${index}`} card={card} index={index} size="large" />
              ))
            ) : (
              <div className="text-sm text-poker-text-dim">
                {humanPlayer.viewerKey === null
                  ? "Viewer key missing on this device. Restore it to decrypt cards."
                  : "Waiting for encrypted cards..."}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-black/10 px-4 py-4 md:min-w-0 md:flex-1">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-white/8 pb-3 text-sm">
            <div className="font-mono text-white">{formatTokenDisplay(humanPlayer.chips)}</div>
            <div className={`${humanPlayer.isWinner ? "text-emerald-200" : "text-poker-text-dim"}`}>
              {humanPlayer.isWinner ? "Winner" : handStatusLabel}
            </div>
          </div>

          {gameState.handSummary && (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-poker-text-dim">
                Round Summary
              </div>
              <div className="mt-1 text-xs font-semibold text-white">{gameState.handSummary.headline}</div>
              {gameState.handSummary.detail && (
                <div className="mt-1 text-[11px] text-poker-text-dim">{gameState.handSummary.detail}</div>
              )}
            </div>
          )}

          {controls && <div className="mt-4">{controls}</div>}
        </div>
      </div>
    </div>
  );
}
