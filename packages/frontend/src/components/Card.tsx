
import type { Card as CardType } from "@/lib/types";

interface CardProps {
  card: CardType;
  index?: number;
  size?: "default" | "large";
}

const SUIT_COLOR: Record<string, string> = {
  "♠": "text-slate-900",
  "♥": "text-red-500",
  "♦": "text-red-500",
  "♣": "text-slate-900",
};

export function Card({ card, index = 0, size = "default" }: CardProps) {
  const isLarge = size === "large";
  const cardClass = isLarge ? "h-[88px] w-16 sm:h-[112px] sm:w-20" : "h-[56px] w-10 sm:h-[80px] sm:w-14";
  const backInnerClass = isLarge ? "h-14 w-10 sm:h-16 sm:w-12" : "h-9 w-7 sm:h-12 sm:w-10";
  const rankClass = isLarge ? "text-sm sm:text-lg" : "text-[10px] sm:text-sm";
  const suitClass = isLarge ? "mt-1 text-xl sm:text-3xl" : "mt-0.5 text-base sm:text-xl";

  if (!card.faceUp) {
    return (
      <div
        className={`card-deal flex items-center justify-center rounded-lg border-2 border-blue-700/50 bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 shadow-lg ${cardClass}`}
        style={{ animationDelay: `${index * 0.15}s` }}
      >
        <div className={`flex items-center justify-center rounded border border-blue-600/30 bg-blue-800/50 ${backInnerClass}`}>
          <span className="text-lg sm:text-xl opacity-60">🂠</span>
        </div>
      </div>
    );
  }

  const colorClass = SUIT_COLOR[card.suit] || "text-gray-100";

  return (
    <div
      className={`card-deal flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white shadow-lg transition-shadow hover:shadow-xl ${cardClass}`}
      style={{ animationDelay: `${index * 0.15}s` }}
    >
      <span className={`${rankClass} font-extrabold leading-none ${colorClass}`}>
        {card.rank}
      </span>
      <span className={`${suitClass} font-extrabold leading-none ${colorClass}`}>
        {card.suit}
      </span>
    </div>
  );
}
