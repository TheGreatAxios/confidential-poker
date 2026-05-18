import type { Card as CardType } from "@/lib/types";
import { Card } from "./Card";
import { StreetBanner } from "./ui/street-banner";

interface CommunityCardsProps {
  cards: CardType[];
}

const EMPTY_SLOT_CLASS =
  "flex h-[88px] w-16 items-center justify-center rounded-lg border-2 border-dashed border-gray-700/50 sm:h-[112px] sm:w-20";
const EMPTY_SLOT_DIM_CLASS =
  "flex h-[88px] w-16 items-center justify-center rounded-lg border-2 border-dashed border-gray-700/30 sm:h-[112px] sm:w-20";

export function CommunityCards({ cards }: CommunityCardsProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <StreetBanner communityCardCount={cards.length} />
      <div className="flex items-center gap-1 sm:gap-2">
        {cards.length === 0 ? (
          <div className="flex gap-1 sm:gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className={EMPTY_SLOT_CLASS}>
                <span className="text-xs text-gray-700">{i + 1}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-1 sm:gap-2">
            {cards.map((card, i) => (
              <Card key={i} card={card} index={i} size="large" />
            ))}
            {Array.from({ length: 5 - cards.length }).map((_, i) => (
              <div key={`empty-${i}`} className={EMPTY_SLOT_DIM_CLASS}>
                <span className="text-xs text-gray-700/50">?</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
