"use client";

import type { Card as CardType } from "@/lib/types";
import { Card } from "./Card";

interface CommunityCardsProps {
  cards: CardType[];
}

export function CommunityCards({ cards }: CommunityCardsProps) {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {cards.length === 0 ? (
        <div className="flex gap-1 sm:gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex h-[56px] w-10 items-center justify-center rounded-lg border-2 border-dashed border-gray-700/50 sm:h-[80px] sm:w-14"
            >
              <span className="text-gray-700 text-xs">{i + 1}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-1 sm:gap-2">
          {cards.map((card, i) => (
            <Card key={i} card={card} index={i} />
          ))}
          {/* Empty slots for remaining community cards */}
          {Array.from({ length: 5 - cards.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex h-[56px] w-10 items-center justify-center rounded-lg border-2 border-dashed border-gray-700/30 sm:h-[80px] sm:w-14"
            >
              <span className="text-gray-700/50 text-xs">?</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
