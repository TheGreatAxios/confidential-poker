import type { GameState } from "@/lib/types";
import { Card } from "./Card";

interface PlayerHandPanelProps {
  gameState: GameState;
}

export function PlayerHandPanel({ gameState }: PlayerHandPanelProps) {
  const humanPlayer = gameState.humanPlayer;
  if (!humanPlayer) {
    return null;
  }

  const viewerKeyLabel = humanPlayer.viewerKey
    ? `${humanPlayer.viewerKey.slice(0, 12)}...${humanPlayer.viewerKey.slice(-10)}`
    : "Missing";

  return (
    <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-poker-text-dim">
            Your Hand
          </div>
          <div className="text-sm font-semibold text-white">
            {humanPlayer.address
              ? `${humanPlayer.address.slice(0, 6)}...${humanPlayer.address.slice(-4)}`
              : "Wallet not connected"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-[0.16em] text-poker-text-dim">
            Viewer Key
          </div>
          <div className="text-xs text-poker-gold">{viewerKeyLabel}</div>
        </div>
      </div>

      <div className="mt-3 flex min-h-[88px] items-center gap-2">
        {humanPlayer.cards.length > 0 ? (
          humanPlayer.cards.map((card, index) => (
            <Card key={`${card.rank}-${card.suit}-${index}`} card={card} index={index} />
          ))
        ) : (
          <div className="text-sm text-poker-text-dim">
            {humanPlayer.viewerKey === null
              ? "Viewer key missing on this device. Restore it to decrypt cards."
              : "Waiting for encrypted cards..."}
          </div>
        )}
      </div>

      {gameState.handComplete && (
        <div className={`mt-3 text-xs font-semibold uppercase tracking-[0.16em] ${humanPlayer.isWinner ? "text-emerald-300" : "text-poker-text-dim"}`}>
          {humanPlayer.isWinner ? "Hand Won" : "Hand Complete"}
        </div>
      )}
    </div>
  );
}
