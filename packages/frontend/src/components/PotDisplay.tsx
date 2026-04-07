interface PotDisplayProps {
  pot: number;
  currentBet: number;
}

export function PotDisplay({ pot, currentBet }: PotDisplayProps) {
  return (
    <div className="flex flex-col items-center gap-2 animate-fade-in">
      {/* Pot */}
      <div className="pot-glow flex items-center gap-2 px-4 py-2 rounded-full bg-poker-gold/10 border border-poker-gold/20">
        <span className="text-poker-gold text-lg">💰</span>
        <div className="text-center">
          <p className="text-[10px] text-poker-gold/60 uppercase tracking-wider">
            Pot
          </p>
          <p className="text-sm sm:text-base font-bold text-poker-gold font-mono">
            {pot.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Current Bet */}
      {currentBet > 0 && (
        <p className="text-xs text-gray-400">
          Current bet:{" "}
          <span className="text-white font-mono font-semibold">
            {currentBet.toLocaleString()}
          </span>
        </p>
      )}
    </div>
  );
}
