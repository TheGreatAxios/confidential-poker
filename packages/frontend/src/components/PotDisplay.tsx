import { formatTokenDisplay, TOKEN_SYMBOL } from "@/lib/token-format";

interface PotDisplayProps {
  pot: bigint;
  currentBet: bigint;
}

export function PotDisplay({ pot, currentBet }: PotDisplayProps) {
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
    </div>
  );
}
