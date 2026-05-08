import type { Card, RankValue } from "../cards";
import { parseCard } from "../cards";

export type PokerAction = "fold" | "check" | "call" | "raise";

export type PolicyGameState = {
  phase?: string;
  pot?: string;
  currentBet?: string;
  myBet?: string;
  toCall?: string;
  bigBlind?: string;
  myStack?: string;
  facingPreflopRaise?: boolean;
  communityCardsEncoded?: number[];
};

export type PolicyHoleCards = {
  card1Encoded?: number;
  card2Encoded?: number;
};

export type PolicyDecision = {
  action: PokerAction;
  raiseAmount: string | null;
  reason: string;
};

const MIN_RAISE_WEI = 500000000000000000n;
const TOKEN_WEI = 1000000000000000000n;
const RANK_ORDER = "23456789TJQKA";

function toBigInt(value: string | undefined): bigint {
  return BigInt(value ?? "0");
}

function clampBigInt(value: bigint, min: bigint, max: bigint): bigint {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function rankCode(rank: RankValue): string {
  if (rank === 10) return "T";
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  if (rank === 14) return "A";
  return String(rank);
}

function handCode(cards: readonly [Card, Card]): string {
  const sorted = [...cards].sort((a, b) => b.rank - a.rank);
  const suffix = sorted[0].rank === sorted[1].rank ? "" : sorted[0].suit === sorted[1].suit ? "s" : "o";
  return `${rankCode(sorted[0].rank)}${rankCode(sorted[1].rank)}${suffix}`;
}

function rankIndex(rank: RankValue): number {
  return RANK_ORDER.indexOf(rankCode(rank));
}

function isAtLeast(code: string, min: string): boolean {
  return rankIndex(code[0] as never) >= rankIndex(min[0] as never)
    && rankIndex(code[1] as never) >= rankIndex(min[1] as never);
}

function isPair(code: string): boolean {
  return code.length === 2;
}

function pairRank(code: string): number {
  return rankIndex(code[0] as never);
}

function isSuitedConnector(cards: readonly [Card, Card]): boolean {
  return cards[0].suit === cards[1].suit && Math.abs(cards[0].rank - cards[1].rank) <= 1;
}

function parseCards(holeCards: PolicyHoleCards, state: PolicyGameState): [Card, Card, Card[]] | null {
  if (typeof holeCards.card1Encoded !== "number" || typeof holeCards.card2Encoded !== "number") return null;
  const card1 = parseCard(holeCards.card1Encoded);
  const card2 = parseCard(holeCards.card2Encoded);
  if (!card1 || !card2) return null;

  const board = (state.communityCardsEncoded ?? [])
    .map(parseCard)
    .filter((card): card is Card => card !== null);

  return [card1, card2, board];
}

function rankCounts(cards: readonly Card[]): Map<RankValue, number> {
  const counts = new Map<RankValue, number>();
  for (const card of cards) counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  return counts;
}

function suitCounts(cards: readonly Card[]): Map<Card["suit"], number> {
  const counts = new Map<Card["suit"], number>();
  for (const card of cards) counts.set(card.suit, (counts.get(card.suit) ?? 0) + 1);
  return counts;
}

function countBestStraightWindow(cards: readonly Card[]): number {
  const ranks = new Set(cards.flatMap((card) => card.rank === 14 ? [14, 1] : [card.rank]));
  let best = 0;
  for (let start = 1; start <= 10; start++) {
    let present = 0;
    for (let rank = start; rank < start + 5; rank++) {
      if (ranks.has(rank)) present++;
    }
    best = Math.max(best, present);
  }
  return best;
}

function hasStraight(cards: readonly Card[]): boolean {
  return countBestStraightWindow(cards) >= 5;
}

function hasStraightDraw(cards: readonly Card[]): boolean {
  return countBestStraightWindow(cards) >= 4;
}

function madeHandScore(holeCards: readonly [Card, Card], board: readonly Card[]): number {
  const cards = [...holeCards, ...board];
  const ranks = rankCounts(cards);
  const counts = [...ranks.values()].sort((a, b) => b - a);
  const flush = [...suitCounts(cards).values()].some((count) => count >= 5);
  const straight = board.length >= 3 && hasStraight(cards);

  if (flush && straight) return 8;
  if (counts[0] === 4) return 7;
  if (counts[0] === 3 && counts[1] >= 2) return 6;
  if (flush) return 5;
  if (straight) return 4;
  if (counts[0] === 3) return 3;
  if (counts[0] === 2 && counts[1] === 2) return 2;
  if (counts[0] === 2) return 1;
  return 0;
}

function holeImprovesBoard(holeCards: readonly [Card, Card], board: readonly Card[], score: number): boolean {
  const boardRanks = rankCounts(board);
  const allRanks = rankCounts([...holeCards, ...board]);
  const holeMakesPairOrBetter = holeCards.some((card) => (allRanks.get(card.rank) ?? 0) >= 2);
  const boardFlushSuit = [...suitCounts(board)].find(([, count]) => count >= 5)?.[0];
  const holeMakesFlush = boardFlushSuit ? false : [...suitCounts([...holeCards, ...board]).values()].some((count) => count >= 5);
  const holeMakesStraight = !hasStraight(board) && hasStraight([...holeCards, ...board]);

  if (score <= 1) return holeMakesPairOrBetter;
  return holeMakesPairOrBetter
    || holeMakesFlush
    || holeMakesStraight
    || holeCards.some((card) => !boardRanks.has(card.rank) && card.rank >= 11);
}

function actionableHandScore(holeCards: readonly [Card, Card], board: readonly Card[]): number {
  const score = madeHandScore(holeCards, board);
  if (score === 0) return 0;
  return holeImprovesBoard(holeCards, board, score) ? score : 0;
}

function hasStrongDraw(holeCards: readonly [Card, Card], board: readonly Card[]): boolean {
  const cards = [...holeCards, ...board];
  const flushDraw = [...suitCounts(cards).values()].some((count) => count >= 4);
  return flushDraw || hasStraightDraw(cards);
}

function preflopDecision(state: PolicyGameState, holeCards: readonly [Card, Card]): PolicyDecision {
  const code = handCode(holeCards);
  const toCall = toBigInt(state.toCall);
  const facingRaise = Boolean(state.facingPreflopRaise);
  const canCheck = toCall === 0n;
  const bigBlind = toBigInt(state.bigBlind);
  const stack = toBigInt(state.myStack);
  const pair = isPair(code);
  const suited = code.endsWith("s");
  const broadway = [...code.slice(0, 2)].every((rank) => rankIndex(rank as never) >= rankIndex("T" as never));
  const premium = pair && pairRank(code) >= rankIndex("T" as never) || ["AKs", "AQs", "AJs", "KQs", "AKo"].includes(code);
  const playable = premium
    || pair
    || broadway
    || suited && isAtLeast(code, "A2")
    || suited && isAtLeast(code, "K7")
    || isSuitedConnector(holeCards);

  const openSize = clampBigInt(bigBlind > 0n ? bigBlind * 2n : TOKEN_WEI, TOKEN_WEI, stack > 0n ? stack : TOKEN_WEI);

  if (premium && !facingRaise) return { action: "raise", raiseAmount: openSize.toString(), reason: `${code} is a value open heads-up with dynamic sizing.` };
  if (canCheck) return { action: "check", raiseAmount: null, reason: `${code} can realize equity for free.` };
  if (!facingRaise || playable) return { action: "call", raiseAmount: null, reason: `${code} is playable at current price.` };
  return { action: "fold", raiseAmount: null, reason: `${code} is too weak against a real raise.` };
}

function postflopDecision(state: PolicyGameState, holeCards: readonly [Card, Card], board: readonly Card[]): PolicyDecision {
  const toCall = toBigInt(state.toCall);
  const pot = toBigInt(state.pot);
  const stack = toBigInt(state.myStack);
  const canCheck = toCall === 0n;
  const score = actionableHandScore(holeCards, board);
  const draw = hasStrongDraw(holeCards, board);
  const cheapCall = toCall > 0n && (pot === 0n || toCall * 4n <= pot + toCall);
  const valueRaise = clampBigInt(pot / (score >= 4 ? 2n : 3n), MIN_RAISE_WEI, stack > 0n ? stack : MIN_RAISE_WEI);

  if (score >= 2 && canCheck) return { action: "raise", raiseAmount: valueRaise.toString(), reason: "Value hand should size against the pot, not use a fixed minimum." };
  if (score >= 2) return { action: "call", raiseAmount: null, reason: "Made value hand continues against pressure." };
  if (score === 1 && canCheck) return { action: "check", raiseAmount: null, reason: "One pair has showdown value." };
  if (score === 1 && cheapCall) return { action: "call", raiseAmount: null, reason: "One pair has enough equity at this price." };
  if (draw && canCheck) return { action: "check", raiseAmount: null, reason: "Draw can take a free card." };
  if (draw && cheapCall) return { action: "call", raiseAmount: null, reason: "Strong draw has acceptable pot odds." };
  if (canCheck) return { action: "check", raiseAmount: null, reason: "No made hand or strong draw; avoid bluffing by default." };
  return { action: "fold", raiseAmount: null, reason: "Weak hand facing a bet without enough equity." };
}

export function decidePokerAction(state: PolicyGameState, holeCards: PolicyHoleCards): PolicyDecision {
  const parsed = parseCards(holeCards, state);
  if (!parsed) {
    const action = toBigInt(state.toCall) > 0n ? "call" : "check";
    return { action, raiseAmount: null, reason: "Card read unavailable; using legal low-risk fallback." };
  }

  const [card1, card2, board] = parsed;
  if (state.phase === "Preflop") return preflopDecision(state, [card1, card2]);
  return postflopDecision(state, [card1, card2], board);
}
