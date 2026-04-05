// ─── Decision Engine: Hand Strength + Bluff Logic ─────────────────────────────

import type { Card, AgentDecision, DecisionContext, PlayerAction } from './types.js';

// ── Card Utilities ────────────────────────────────────────────────────────────

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

function rankValue(rank: string): number {
  return RANK_VALUES[rank] ?? 0;
}

/** Evaluate a 5-card hand and return a numeric score (higher = better). */
export function evaluateHand(cards: Card[]): number {
  if (cards.length < 5) return 0;

  const ranks = cards.map((c) => rankValue(c.rank)).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);

  const isFlush = suits.every((s) => s === suits[0]);

  // Check for straight
  let isStraight = false;
  const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
  if (uniqueRanks.length === 5) {
    if (uniqueRanks[0] - uniqueRanks[4] === 4) {
      isStraight = true;
    }
    // Ace-low straight (A-2-3-4-5)
    if (uniqueRanks[0] === 14 && uniqueRanks[1] === 5 && uniqueRanks[2] === 4 && uniqueRanks[3] === 3 && uniqueRanks[4] === 2) {
      isStraight = true;
    }
  }

  // Count rank frequencies
  const freq: Record<number, number> = {};
  for (const r of ranks) {
    freq[r] = (freq[r] ?? 0) + 1;
  }
  const counts = Object.values(freq).sort((a, b) => b - a);

  // ── Hand Rankings (base * multiplier + kickers) ──
  // Royal Flush / Straight Flush
  if (isFlush && isStraight) return 8_000_000 + ranks[0];

  // Four of a Kind
  if (counts[0] === 4) return 7_000_000 + Number(Object.entries(freq).find(([, c]) => c === 4)![0]) * 15;

  // Full House
  if (counts[0] === 3 && counts[1] === 2) {
    const tripsRank = Number(Object.entries(freq).find(([, c]) => c === 3)![0]);
    const pairRank = Number(Object.entries(freq).find(([, c]) => c === 2)![0]);
    return 6_000_000 + tripsRank * 15 + pairRank;
  }

  // Flush
  if (isFlush) return 5_000_000 + ranks[0] * 225 + ranks[1] * 15 + ranks[2];

  // Straight
  if (isStraight) return 4_000_000 + ranks[0];

  // Three of a Kind
  if (counts[0] === 3) {
    const tripsRank = Number(Object.entries(freq).find(([, c]) => c === 3)![0]);
    return 3_000_000 + tripsRank * 225;
  }

  // Two Pair
  if (counts[0] === 2 && counts[1] === 2) {
    const pairs = Object.entries(freq)
      .filter(([, c]) => c === 2)
      .map(([r]) => Number(r))
      .sort((a, b) => b - a);
    return 2_000_000 + pairs[0] * 225 + pairs[1] * 15;
  }

  // One Pair
  if (counts[0] === 2) {
    const pairRank = Number(Object.entries(freq).find(([, c]) => c === 2)![0]);
    return 1_000_000 + pairRank * 225 + ranks[0] * 15;
  }

  // High Card
  return ranks[0] * 225 + ranks[1] * 15 + ranks[2];
}

/** Get the best 5-card hand from a collection of 5-7 cards. */
export function bestHand(allCards: Card[]): number {
  if (allCards.length < 5) return evaluateHand(allCards);
  if (allCards.length === 5) return evaluateHand(allCards);

  // Generate all 5-card combinations and return the best
  let best = 0;
  const n = allCards.length;
  for (let i = 0; i < n - 4; i++) {
    for (let j = i + 1; j < n - 3; j++) {
      for (let k = j + 1; k < n - 2; k++) {
        for (let l = k + 1; l < n - 1; l++) {
          for (let m = l + 1; m < n; m++) {
            const score = evaluateHand([allCards[i], allCards[j], allCards[k], allCards[l], allCards[m]]);
            if (score > best) best = score;
          }
        }
      }
    }
  }
  return best;
}

/** Pre-flop hand strength estimate (0-1). Considers pairs, suited, connectedness. */
export function preflopStrength(hand: Card[]): number {
  const r1 = rankValue(hand[0].rank);
  const r2 = rankValue(hand[1].rank);
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const isPair = r1 === r2;
  const isSuited = hand[0].suit === hand[1].suit;
  const gap = high - low;

  let strength = 0;

  // Pairs are strong
  if (isPair) {
    strength = 0.5 + (high / 14) * 0.5; // 0.57 – 1.0
    if (high >= 12) strength = Math.min(strength + 0.1, 1.0); // QQ+
    return strength;
  }

  // High cards
  strength = ((high + low) / 28) * 0.6;

  // Suited bonus
  if (isSuited) strength += 0.08;

  // Connectedness bonus (smaller gap = better)
  if (gap === 1) strength += 0.1;
  else if (gap === 2) strength += 0.05;
  else if (gap === 3) strength += 0.02;

  // Broadway bonus (both cards ≥ 10)
  if (high >= 10 && low >= 10) strength += 0.12;

  // Ace-King / Ace-Queen premium
  if (high === 14 && low >= 12) strength += 0.15;
  if (high === 14 && low === 11) strength += 0.08;

  return Math.min(strength, 1.0);
}

/** Post-flop hand strength as a 0-1 ratio against a max possible hand. */
export function postflopStrength(hand: Card[], community: Card[]): number {
  const allCards = [...hand, ...community];
  if (allCards.length < 5) return preflopStrength(hand);

  const score = bestHand(allCards);
  // Normalize: Royal flush ≈ 8M+14 ≈ 8,000,014
  // We'll map to 0-1 using a logarithmic-ish scale
  return Math.min(score / 8_000_014, 1.0);
}

// ── Decision Engine ───────────────────────────────────────────────────────────

/** Seeded-ish pseudo-random for deterministic-ish decisions per hand */
function jitter(base: number, range: number): number {
  return base + (Math.random() - 0.5) * range;
}

/**
 * Core decision function. Returns an AgentDecision based on:
 *  - hand strength
 *  - personality (aggression, tightness, bluff frequency)
 *  - pot odds
 *  - position
 */
export function makeDecision(ctx: DecisionContext): AgentDecision {
  const { player, gameState, numActivePlayers, potOdds } = ctx;
  const personality = getPlayerPersonality(player.id);

  if (!personality) {
    // Fallback: simple play
    return { action: 'check', isBluff: false, confidence: 0.5 };
  }

  const isPreflop = gameState.phase === 'preflop';
  const handStrength = isPreflop
    ? preflopStrength(player.hand)
    : postflopStrength(player.hand, gameState.communityCards);

  const callAmount = gameState.currentBet - player.currentBet;
  const canCheck = callAmount === 0;

  // ── Should we bluff? ──
  const shouldBluff = Math.random() < personality.bluffFrequency * (isPreflop ? 0.6 : 1.0);

  // ── Effective hand strength (includes bluff factor) ──
  let effectiveStrength = handStrength;
  if (shouldBluff) {
    effectiveStrength = jitter(Math.min(handStrength + 0.3, 1.0), 0.15);
  }

  // ── Personality adjustments ──
  // Tight players need higher strength to proceed
  const strengthThreshold = 1 - personality.tightness * 0.5;
  // Aggressive players are more likely to raise
  const raiseThreshold = strengthThreshold - personality.aggression * 0.2;

  // ── Decision Matrix ──

  // VERY STRONG HAND (top tier)
  if (effectiveStrength > 0.85) {
    const raiseAmount = Math.floor(
      gameState.pot * (0.5 + personality.aggression * 0.75),
    );
    if (raiseAmount >= player.chips) {
      return {
        action: 'all-in',
        amount: player.chips,
        isBluff: shouldBluff,
        confidence: effectiveStrength,
      };
    }
    return {
      action: 'raise',
      amount: Math.max(gameState.currentBet + raiseAmount, gameState.currentBet * 2),
      isBluff: shouldBluff,
      confidence: effectiveStrength,
    };
  }

  // STRONG HAND
  if (effectiveStrength > 0.65) {
    if (Math.random() < personality.aggression) {
      const raiseAmount = Math.floor(gameState.pot * (0.3 + personality.aggression * 0.5));
      return {
        action: 'raise',
        amount: Math.max(gameState.currentBet + raiseAmount, gameState.currentBet * 2),
        isBluff: shouldBluff,
        confidence: effectiveStrength,
      };
    }
    if (canCheck) {
      return { action: 'check', isBluff: false, confidence: effectiveStrength };
    }
    return {
      action: 'call',
      amount: callAmount,
      isBluff: shouldBluff,
      confidence: effectiveStrength,
    };
  }

  // MEDIUM HAND
  if (effectiveStrength > strengthThreshold) {
    if (canCheck) {
      // Sometimes trap with a medium hand
      if (Math.random() < 0.3 * personality.aggression) {
        return { action: 'check', isBluff: false, confidence: effectiveStrength };
      }
      // Check or small raise
      if (Math.random() < personality.aggression * 0.4) {
        return {
          action: 'raise',
          amount: Math.max(gameState.currentBet + Math.floor(gameState.pot * 0.33), BIG_BLIND),
          isBluff: true,
          confidence: effectiveStrength * 0.7,
        };
      }
      return { action: 'check', isBluff: false, confidence: effectiveStrength };
    }
    // Pot odds consideration
    if (callAmount <= gameState.pot * potOdds * 1.5 || Math.random() < 0.3) {
      return {
        action: 'call',
        amount: callAmount,
        isBluff: shouldBluff,
        confidence: effectiveStrength,
      };
    }
    return { action: 'fold', isBluff: false, confidence: 1 - effectiveStrength };
  }

  // WEAK HAND
  if (effectiveStrength > strengthThreshold * 0.6) {
    if (canCheck) {
      return { action: 'check', isBluff: false, confidence: effectiveStrength };
    }
    // Occasional bluff-raise with weak hand
    if (shouldBluff && Math.random() < personality.aggression * 0.5) {
      return {
        action: 'raise',
        amount: Math.max(gameState.currentBet + Math.floor(gameState.pot * 0.5), gameState.currentBet * 2),
        isBluff: true,
        confidence: effectiveStrength * 0.4,
      };
    }
    // Small pot call
    if (callAmount <= BIG_BLIND * 2 && Math.random() < 0.4) {
      return {
        action: 'call',
        amount: callAmount,
        isBluff: false,
        confidence: effectiveStrength,
      };
    }
    return { action: 'fold', isBluff: false, confidence: 1 - effectiveStrength };
  }

  // VERY WEAK HAND
  if (canCheck) {
    return { action: 'check', isBluff: false, confidence: 0.2 };
  }

  // Pure bluff opportunity
  if (shouldBluff && Math.random() < personality.aggression * 0.3) {
    return {
      action: 'raise',
      amount: Math.max(gameState.currentBet + Math.floor(gameState.pot * 0.66), gameState.currentBet * 2),
      isBluff: true,
      confidence: 0.15,
    };
  }

  return { action: 'fold', isBluff: false, confidence: 0.1 };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const BIG_BLIND = 100;

/** Quick lookup for personality by player id (populated by agent.ts) */
const _personalityMap = new Map<string, { aggression: number; tightness: number; bluffFrequency: number }>();

function getPlayerPersonality(_id: string): { aggression: number; tightness: number; bluffFrequency: number } | null {
  return _personalityMap.get(_id) ?? null;
}

/** Register a player's personality traits for the decision engine */
export function registerPersonality(
  playerId: string,
  personality: { aggression: number; tightness: number; bluffFrequency: number },
): void {
  _personalityMap.set(playerId, personality);
}

/** Unregister a player */
export function unregisterPersonality(playerId: string): void {
  _personalityMap.delete(playerId);
}

// ── Utility: choose a random element from an array ────────────────────────────

export function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Format a chat message for a player action */
export function formatActionMessage(
  playerName: string,
  action: PlayerAction,
  amount?: number,
): string {
  switch (action) {
    case 'fold':
      return `${playerName} folds.`;
    case 'check':
      return `${playerName} checks.`;
    case 'call':
      return `${playerName} calls ${amount ?? 0}.`;
    case 'raise':
      return `${playerName} raises to ${amount ?? 0}!`;
    case 'all-in':
      return `${playerName} goes ALL IN for ${amount ?? 0}! 🔥`;
  }
}
