
import type { Card as CardType } from "@/lib/types";

interface CardProps {
  card: CardType;
  index?: number;
}

const SUIT_COLOR: Record<string, string> = {
  "♠": "text-slate-900",
  "♥": "text-red-500",
  "♦": "text-red-500",
  "♣": "text-slate-900",
};

export function Card({ card, index = 0 }: CardProps) {
  if (!card.faceUp) {
    return (
      <div
        className="card-deal flex h-[56px] w-10 items-center justify-center rounded-lg border-2 border-blue-700/50 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 shadow-lg sm:h-[80px] sm:w-14"
        style={{ animationDelay: `${index * 0.15}s` }}
      >
        <div className="flex h-9 w-7 items-center justify-center rounded border border-blue-600/30 bg-blue-800/50 sm:h-12 sm:w-10">
          <span className="text-lg sm:text-xl opacity-60">🂠</span>
        </div>
      </div>
    );
  }

  const colorClass = SUIT_COLOR[card.suit] || "text-gray-100";

  return (
    <div
      className="card-deal flex h-[56px] w-10 flex-col items-center justify-center rounded-lg border border-gray-200 bg-white shadow-lg transition-shadow hover:shadow-xl sm:h-[80px] sm:w-14"
      style={{ animationDelay: `${index * 0.15}s` }}
    >
      <span className={`text-[10px] font-extrabold leading-none sm:text-sm ${colorClass}`}>
        {card.rank}
      </span>
      <span className={`mt-0.5 text-base font-extrabold leading-none sm:text-xl ${colorClass}`}>
        {card.suit}
      </span>
    </div>
  );
}
