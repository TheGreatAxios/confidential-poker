export type RankValue = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export type SuitName = "Spades" | "Hearts" | "Diamonds" | "Clubs";

export type Card = {
  encoded: number;
  rank: RankValue;
  rankName: string;
  suit: SuitName;
};

export type DisplayCard = {
  suit: "♠" | "♥" | "♦" | "♣";
  rank: "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
};

const SUITS: SuitName[] = ["Spades", "Hearts", "Diamonds", "Clubs"];
const RANKS = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "Jack", "Queen", "King", "Ace",
] as const;

const SUIT_SYMBOLS: Record<SuitName, DisplayCard["suit"]> = {
  Spades: "♠",
  Hearts: "♥",
  Diamonds: "♦",
  Clubs: "♣",
};

const RANK_DISPLAY: Record<string, DisplayCard["rank"]> = {
  "2": "2", "3": "3", "4": "4", "5": "5", "6": "6",
  "7": "7", "8": "8", "9": "9", "10": "10",
  Jack: "J", Queen: "Q", King: "K", Ace: "A",
};

const RANK_VALUE: Record<DisplayCard["rank"], number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6,
  "7": 7, "8": 8, "9": 9, "10": 10,
  J: 11, Q: 12, K: 13, A: 14,
};

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

export function toDisplayCard(card: Card): DisplayCard {
  return {
    suit: SUIT_SYMBOLS[card.suit],
    rank: RANK_DISPLAY[card.rankName] ?? "2",
  };
}

export function fromDisplayCard(display: DisplayCard): number {
  const suitIndex = SUITS.findIndex((s) => SUIT_SYMBOLS[s] === display.suit);
  const rankValue = RANK_VALUE[display.rank];
  if (suitIndex < 0 || !rankValue) return 0;
  return rankValue | (suitIndex << 4);
}

export function encodeCard(rank: RankValue, suit: 0 | 1 | 2 | 3): number {
  return rank | (suit << 4);
}

// ---------- Hand Evaluation ----------

type EvalResult = {
  handRank: number;
  primary: number;
  secondary: number;
  tertiary: number;
  quaternary: number;
  quinary: number;
};

function compareEval(a: EvalResult, b: EvalResult): number {
  if (a.handRank !== b.handRank) return a.handRank - b.handRank;
  if (a.primary !== b.primary) return a.primary - b.primary;
  if (a.secondary !== b.secondary) return a.secondary - b.secondary;
  if (a.tertiary !== b.tertiary) return a.tertiary - b.tertiary;
  if (a.quaternary !== b.quaternary) return a.quaternary - b.quaternary;
  return a.quinary - b.quinary;
}

function rankOf(card: DisplayCard): number {
  return RANK_VALUE[card.rank];
}

function sortDesc(cards: DisplayCard[]): DisplayCard[] {
  return [...cards].sort((a, b) => rankOf(b) - rankOf(a));
}

function isFlush(cards: DisplayCard[]): boolean {
  return cards.every((card) => card.suit === cards[0]?.suit);
}

function straightHigh(cards: DisplayCard[]): number {
  const ranks = sortDesc(cards).map(rankOf);
  if (ranks[0] === ranks[1] + 1 && ranks[1] === ranks[2] + 1 && ranks[2] === ranks[3] + 1 && ranks[3] === ranks[4] + 1) {
    return ranks[0];
  }
  if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
    return 5;
  }
  return 0;
}

function evaluateFive(cards: DisplayCard[]): EvalResult {
  const sorted = sortDesc(cards);
  const straight = straightHigh(sorted);
  const flush = isFlush(sorted);
  const counts = new Map<number, number>();

  for (const card of sorted) {
    const rank = rankOf(card);
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }

  let fourRank = 0;
  let threeRank = 0;
  const pairRanks: number[] = [];
  const kickers: number[] = [];

  for (let rank = 14; rank >= 2; rank -= 1) {
    const count = counts.get(rank) ?? 0;
    if (count === 4) fourRank = rank;
    else if (count === 3) threeRank = rank;
    else if (count === 2) pairRanks.push(rank);
    else if (count === 1) kickers.push(rank);
  }

  if (flush && straight) {
    return { handRank: 8, primary: straight, secondary: 0, tertiary: 0, quaternary: 0, quinary: 0 };
  }
  if (fourRank) {
    return { handRank: 7, primary: fourRank, secondary: kickers[0] ?? 0, tertiary: 0, quaternary: 0, quinary: 0 };
  }
  if (threeRank && pairRanks.length > 0) {
    return { handRank: 6, primary: threeRank, secondary: pairRanks[0] ?? 0, tertiary: 0, quaternary: 0, quinary: 0 };
  }
  if (flush) {
    const ranks = sorted.map(rankOf);
    return {
      handRank: 5,
      primary: ranks[0] ?? 0,
      secondary: ranks[1] ?? 0,
      tertiary: ranks[2] ?? 0,
      quaternary: ranks[3] ?? 0,
      quinary: ranks[4] ?? 0,
    };
  }
  if (straight) {
    return { handRank: 4, primary: straight, secondary: 0, tertiary: 0, quaternary: 0, quinary: 0 };
  }
  if (threeRank) {
    return {
      handRank: 3,
      primary: threeRank,
      secondary: kickers[0] ?? 0,
      tertiary: kickers[1] ?? 0,
      quaternary: 0,
      quinary: 0,
    };
  }
  if (pairRanks.length >= 2) {
    return {
      handRank: 2,
      primary: pairRanks[0] ?? 0,
      secondary: pairRanks[1] ?? 0,
      tertiary: kickers[0] ?? 0,
      quaternary: 0,
      quinary: 0,
    };
  }
  if (pairRanks.length === 1) {
    return {
      handRank: 1,
      primary: pairRanks[0] ?? 0,
      secondary: kickers[0] ?? 0,
      tertiary: kickers[1] ?? 0,
      quaternary: kickers[2] ?? 0,
      quinary: 0,
    };
  }

  const ranks = sorted.map(rankOf);
  return {
    handRank: 0,
    primary: ranks[0] ?? 0,
    secondary: ranks[1] ?? 0,
    tertiary: ranks[2] ?? 0,
    quaternary: ranks[3] ?? 0,
    quinary: ranks[4] ?? 0,
  };
}

export function evaluateBestHand(cards: DisplayCard[]): EvalResult | null {
  let best: EvalResult | null = null;

  for (let i = 0; i < cards.length; i += 1) {
    for (let j = i + 1; j < cards.length; j += 1) {
      const five = cards.filter((_, index) => index !== i && index !== j);
      const current = evaluateFive(five);
      if (!best || compareEval(current, best) > 0) {
        best = current;
      }
    }
  }

  return best;
}

export function findWinningPlayerIds(
  players: Array<{ id: string; cards: DisplayCard[] }>,
  communityCards: DisplayCard[],
): string[] {
  let best: EvalResult | null = null;
  const winners: string[] = [];

  for (const player of players) {
    const result = evaluateBestHand([...player.cards, ...communityCards]);
    if (!result) continue;

    if (!best || compareEval(result, best) > 0) {
      best = result;
      winners.length = 0;
      winners.push(player.id);
      continue;
    }

    if (compareEval(result, best) === 0) {
      winners.push(player.id);
    }
  }

  return winners;
}
