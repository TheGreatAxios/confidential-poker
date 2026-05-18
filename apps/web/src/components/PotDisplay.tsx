import { formatTokenDisplay, TOKEN_SYMBOL } from "@/lib/token-format";
import type { SidePot } from "@/lib/types";

interface PotDisplayProps {
  pot: bigint;
  currentBet: bigint;
  sidePots?: SidePot[];
}

export function PotDisplay({ pot, currentBet, sidePots = [] }: PotDisplayProps) {
  const hasAwardedPots = sidePots.length > 0;

  return (
    <div className="flex flex-col items-center gap-2 animate-fade-in">
      <div className="pot-glow flex items-center gap-2 rounded-full border border-poker-gold/20 bg-poker-gold/10 px-4 py-2">
        <span className="text-poker-gold text-lg">💰</span>
        <p className="font-mono text-sm font-bold text-poker-gold sm:text-base">
          Pot {formatTokenDisplay(pot)}
        </p>
      </div>

      {currentBet > 0n && (
        <p className="text-xs text-gray-400">
          Current bet:{" "}
          <span className="text-white font-mono font-semibold">
            {formatTokenDisplay(currentBet, { symbol: TOKEN_SYMBOL })}
          </span>
        </p>
      )}

      {hasAwardedPots && (
        <div className="rounded-2xl border border-poker-gold/15 bg-black/25 px-3 py-2 text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-poker-text-dim">
            Awarded Pots
          </div>
          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {sidePots.map((sidePot, index) => (
              <span key={`${sidePot.amount}-${index}`} className="rounded-full border border-poker-gold/20 bg-poker-gold/10 px-2 py-1 font-mono text-[11px] text-poker-gold">
                Pot {index + 1}: {formatTokenDisplay(sidePot.amount)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
