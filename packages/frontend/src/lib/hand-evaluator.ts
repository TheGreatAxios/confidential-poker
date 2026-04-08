import type { Card } from "@/lib/types";

type EvalResult = {
  handRank: number;
  primary: number;
  secondary: number;
  tertiary: number;
  quaternary: number;
  quinary: number;
};

const RANK_TO_VALUE: Record<Card["rank"], number> = {
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

function compareEval(a: EvalResult, b: EvalResult) {
  if (a.handRank !== b.handRank) return a.handRank - b.handRank;
  if (a.primary !== b.primary) return a.primary - b.primary;
  if (a.secondary !== b.secondary) return a.secondary - b.secondary;
  if (a.tertiary !== b.tertiary) return a.tertiary - b.tertiary;
  if (a.quaternary !== b.quaternary) return a.quaternary - b.quaternary;
  return a.quinary - b.quinary;
}

function rankOf(card: Card) {
  return RANK_TO_VALUE[card.rank];
}

function sortDesc(cards: Card[]) {
  return [...cards].sort((a, b) => rankOf(b) - rankOf(a));
}

function isFlush(cards: Card[]) {
  return cards.every((card) => card.suit === cards[0]?.suit);
}

function straightHigh(cards: Card[]) {
  const ranks = sortDesc(cards).map(rankOf);
  if (ranks[0] === ranks[1] + 1 && ranks[1] === ranks[2] + 1 && ranks[2] === ranks[3] + 1 && ranks[3] === ranks[4] + 1) {
    return ranks[0];
  }
  if (ranks[0] === 14 && ranks[1] === 5 && ranks[2] === 4 && ranks[3] === 3 && ranks[4] === 2) {
    return 5;
  }
  return 0;
}

function evaluateFive(cards: Card[]): EvalResult {
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

export function evaluateBestHand(cards: Card[]) {
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

export function findWinningPlayerIds(players: Array<{ id: string; cards: Card[] }>, communityCards: Card[]) {
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
