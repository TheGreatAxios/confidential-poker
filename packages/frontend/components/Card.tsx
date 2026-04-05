"use client";

import type { Card as CardType } from "@/lib/types";

interface CardProps {
  card: CardType;
  index?: number;
}

const SUIT_COLOR: Record<string, string> = {
  "♠": "text-gray-100",
  "♥": "text-red-500",
  "♦": "text-red-500",
  "♣": "text-gray-100",
};

export function Card({ card, index = 0 }: CardProps) {
  if (!card.faceUp) {
    return (
      <div
        className="card-deal w-12 h-[68px] sm:w-14 sm:h-[80px] rounded-lg bg-gradient-to-br from-blue-900 via-blue-800 to-blue-900 border-2 border-blue-700/50 flex items-center justify-center shadow-lg"
        style={{ animationDelay: `${index * 0.15}s` }}
      >
        <div className="w-8 h-10 sm:w-10 sm:h-12 rounded border border-blue-600/30 bg-blue-800/50 flex items-center justify-center">
          <span className="text-lg sm:text-xl opacity-60">🂠</span>
        </div>
      </div>
    );
  }

  const colorClass = SUIT_COLOR[card.suit] || "text-gray-100";

  return (
    <div
      className="card-deal w-12 h-[68px] sm:w-14 sm:h-[80px] rounded-lg bg-white border border-gray-200 flex flex-col items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
      style={{ animationDelay: `${index * 0.15}s` }}
    >
      <span className={`text-xs sm:text-sm font-bold leading-none ${colorClass}`}>
        {card.rank}
      </span>
      <span className={`text-lg sm:text-xl leading-none mt-0.5 ${colorClass}`}>
        {card.suit}
      </span>
    </div>
  );
}
