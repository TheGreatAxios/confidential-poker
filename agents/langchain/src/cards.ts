export type RankValue = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export type Card = {
  encoded: number;
  rank: RankValue;
  rankName: string;
  suit: "Spades" | "Hearts" | "Diamonds" | "Clubs";
};

const SUITS = ["Spades", "Hearts", "Diamonds", "Clubs"] as const;
const RANKS = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "Jack", "Queen", "King", "Ace",
] as const;

export function parseCard(encoded: number): Card | null {
  if (encoded <= 0) return null;

  const rank = encoded & 0x0f;
  const suit = (encoded >> 4) & 0x03;
  const rankName = RANKS[rank - 2];
  const suitName = SUITS[suit];

  if (!rankName || !suitName) return null;

  return {
    encoded,
    rank: rank as RankValue,
    rankName,
    suit: suitName,
  };
}

export function decodeCard(encoded: number): string {
  const card = parseCard(encoded);
  return card ? `${card.rankName} of ${card.suit}` : `Invalid card (${encoded})`;
}
