import type { AgentRuntimeState, AgentPersonality, OnChainGameState } from "./types.js";

/**
 * Decision result from the AI decision engine.
 */
export interface Decision {
  action: "fold" | "check" | "call" | "raise";
  amount?: bigint;
  thinkingTimeMs: number;
}

/**
 * Personality-based decision weights for each action.
 */
interface PersonalityWeights {
  foldWeight: number;
  checkWeight: number;
  callWeight: number;
  raiseWeight: number;
  raiseMultiplier: [number, number]; // [min, max] multiplier for min raise
  bluffRaiseMultiplier: [number, number];
}

const PERSONALITY_WEIGHTS: Record<AgentPersonality, PersonalityWeights> = {
  aggressive: {
    foldWeight: 15,
    checkWeight: 0,
    callWeight: 25,
    raiseWeight: 60,
    raiseMultiplier: [2, 4],
    bluffRaiseMultiplier: [3, 6],
  },
  conservative: {
    foldWeight: 40,
    checkWeight: 25,
    callWeight: 20,
    raiseWeight: 15,
    raiseMultiplier: [2, 3],
    bluffRaiseMultiplier: [2, 3],
  },
  bluffer: {
    foldWeight: 33,
    checkWeight: 11,
    callWeight: 22,
    raiseWeight: 34,
    raiseMultiplier: [2, 5],
    bluffRaiseMultiplier: [3, 8],
  },
  mathematical: {
    foldWeight: 30, // Handled by pot odds logic
    checkWeight: 25,
    callWeight: 25,
    raiseWeight: 20,
    raiseMultiplier: [2, 3],
    bluffRaiseMultiplier: [2, 3],
  },
  loose: {
    foldWeight: 10,
    checkWeight: 20,
    callWeight: 60,
    raiseWeight: 10,
    raiseMultiplier: [2, 3],
    bluffRaiseMultiplier: [2, 4],
  },
  tight: {
    foldWeight: 35,
    checkWeight: 5,
    callWeight: 20,
    raiseWeight: 40,
    raiseMultiplier: [3, 5],
    bluffRaiseMultiplier: [2, 3],
  },
};

/**
 * Estimate hand strength on a 0-1 scale.
 * Simple heuristic: considers pairs, high cards, suited, connected, community hits.
 */
function estimateHandStrength(state: AgentRuntimeState, gameState: OnChainGameState): number {
  const [card1, card2] = state.hand;

  if (card1 === 0 && card2 === 0) return 0.5;

  // Decode cards: rank = card & 0x0F, suit = (card >> 4) & 0x03
  const rank1 = card1 & 0x0f;
  const rank2 = card2 & 0x0f;
  const suit1 = (card1 >> 4) & 0x03;
  const suit2 = (card2 >> 4) & 0x03;

  let strength = 0;

  // Pair bonus
  if (rank1 === rank2) {
    strength += 0.35 + (rank1 / 14) * 0.25;
  } else {
    const highRank = Math.max(rank1, rank2);
    const lowRank = Math.min(rank1, rank2);
    strength += (highRank / 14) * 0.25 + (lowRank / 14) * 0.1;

    // Connected cards
    const gap = highRank - lowRank;
    if (gap === 1) strength += 0.05;
    if (highRank >= 12 && lowRank >= 11) strength += 0.08; // Broadway

    // Suited
    if (suit1 === suit2) strength += 0.06;
  }

  // Factor in community cards
  const communityCards = gameState.communityCards.map((c) => Number(c));
  if (communityCards.length > 0) {
    const communityRanks = communityCards.map((c) => c & 0x0f);

    for (const commRank of communityRanks) {
      if (commRank === rank1 || commRank === rank2) {
        strength += 0.12;
      }
    }

    const allRanks = [...communityRanks, rank1, rank2];
    const rankCounts = new Map<number, number>();
    for (const r of allRanks) {
      rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
    }
    for (const count of rankCounts.values()) {
      if (count === 3) strength += 0.2;
      if (count >= 4) strength += 0.35;
    }

    strength += communityCards.length * 0.02;
  }

  return Math.min(1, Math.max(0, strength));
}

/**
 * Weighted random selection from an array of [item, weight] pairs.
 */
function weightedRandom<T>(items: [T, number][]): T {
  const totalWeight = items.reduce((sum, [, w]) => sum + w, 0);
  let rand = Math.random() * totalWeight;
  for (const [item, weight] of items) {
    rand -= weight;
    if (rand <= 0) return item;
  }
  return items[items.length - 1][0];
}

/**
 * Random integer in [min, max] inclusive.
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Make a personality-based decision for an AI agent.
 *
 * This is a rule-based decision engine — no LLM calls needed.
 * Uses personality weights, hand strength estimation, and random factors.
 *
 * @param state  The agent's current runtime state
 * @param gameState  The on-chain game state
 * @param bigBlind  The big blind amount for raise calculations
 * @returns A Decision with action, optional amount, and thinking time
 */
export function makeDecision(
  state: AgentRuntimeState,
  gameState: OnChainGameState,
  bigBlind: bigint = 100n,
): Decision {
  const personality = state.agent.personality;
  const weights = PERSONALITY_WEIGHTS[personality];
  const strength = estimateHandStrength(state, gameState);
  const toCall = gameState.currentBet - state.currentBet;

  // Simulate thinking time (500-2000ms)
  const thinkingTimeMs = randomInt(500, 2000);

  // Can check for free?
  const canCheck = toCall <= 0n;

  // ── Mathematical personality: pot odds comparison ──
  if (personality === "mathematical") {
    const potOdds =
      gameState.pot > 0n && toCall > 0n
        ? Number(toCall) / Number(gameState.pot + toCall)
        : 0;

    // Fold if hand strength doesn't justify the pot odds
    if (strength < potOdds * 0.8 && !canCheck) {
      return { action: "fold", thinkingTimeMs };
    }

    // Raise if strong hand and good odds
    if (strength > 0.7 && potOdds < 0.3) {
      const mult = randomInt(...weights.raiseMultiplier);
      return {
        action: "raise",
        amount: bigBlind * BigInt(mult) + toCall,
        thinkingTimeMs,
      };
    }

    if (canCheck) {
      return { action: "check", thinkingTimeMs };
    }

    // Call if pot odds are favorable
    if (strength >= potOdds * 0.8) {
      return { action: "call", thinkingTimeMs };
    }

    return { action: "fold", thinkingTimeMs };
  }

  // ── Conservative: fold weak hands unless premium ──
  if (personality === "conservative") {
    // Premium hands: pairs, both cards >= 10
    const rank1 = state.hand[0] & 0x0f;
    const rank2 = state.hand[1] & 0x0f;
    const isPremium = rank1 === rank2 || (rank1 >= 11 && rank2 >= 11);

    if (strength < 0.3 && !isPremium && !canCheck) {
      return { action: "fold", thinkingTimeMs };
    }

    if (strength > 0.6 && Math.random() < 0.4) {
      const mult = randomInt(...weights.raiseMultiplier);
      return {
        action: "raise",
        amount: bigBlind * BigInt(mult) + toCall,
        thinkingTimeMs,
      };
    }

    if (canCheck) {
      return { action: "check", thinkingTimeMs };
    }

    if (strength >= 0.3 || isPremium) {
      return { action: "call", thinkingTimeMs };
    }

    return { action: "fold", thinkingTimeMs };
  }

  // ── Tight-Aggressive: fold weak, raise strong ──
  if (personality === "tight") {
    if (strength < 0.4 && !canCheck) {
      return { action: "fold", thinkingTimeMs };
    }

    if (strength > 0.5) {
      const mult = randomInt(...weights.raiseMultiplier);
      return {
        action: "raise",
        amount: bigBlind * BigInt(mult) + toCall,
        thinkingTimeMs,
      };
    }

    if (canCheck) {
      return { action: "check", thinkingTimeMs };
    }

    return { action: "call", thinkingTimeMs };
  }

  // ── Bluffer: random split with big raises ──
  if (personality === "bluffer") {
    // Truly random 33/33/33 split
    const roll = Math.random();
    if (roll < 0.33) {
      if (canCheck) {
        return { action: "check", thinkingTimeMs };
      }
      return { action: "fold", thinkingTimeMs };
    }

    if (roll < 0.66) {
      return { action: canCheck ? "check" : "call", thinkingTimeMs };
    }

    // Always raise big
    const isBluffing = strength < 0.4;
    const mult = randomInt(
      ...(isBluffing ? weights.bluffRaiseMultiplier : weights.raiseMultiplier),
    );
    return {
      action: "raise",
      amount: bigBlind * BigInt(mult) + toCall,
      thinkingTimeMs,
    };
  }

  // ── Aggressive: raise often ──
  if (personality === "aggressive") {
    const roll = Math.random();

    // 60% raise
    if (roll < 0.6) {
      const isBluffing = strength < 0.4;
      const mult = randomInt(
        ...(isBluffing ? weights.bluffRaiseMultiplier : weights.raiseMultiplier),
      );
      return {
        action: "raise",
        amount: bigBlind * BigInt(mult) + toCall,
        thinkingTimeMs,
      };
    }

    // 25% call
    if (roll < 0.85) {
      return { action: canCheck ? "check" : "call", thinkingTimeMs };
    }

    // 15% fold (only if can't check)
    if (canCheck) {
      return { action: "check", thinkingTimeMs };
    }
    return { action: "fold", thinkingTimeMs };
  }

  // ── Loose: call most hands ──
  if (personality === "loose") {
    const roll = Math.random();

    // 10% fold (rarely)
    if (roll < 0.1 && !canCheck && strength < 0.2) {
      return { action: "fold", thinkingTimeMs };
    }

    // 10% raise (occasionally)
    if (roll < 0.2 && strength > 0.4) {
      const mult = randomInt(...weights.raiseMultiplier);
      return {
        action: "raise",
        amount: bigBlind * BigInt(mult) + toCall,
        thinkingTimeMs,
      };
    }

    // 20% check
    if (canCheck || roll < 0.4) {
      return { action: "check", thinkingTimeMs };
    }

    // 60% call
    return { action: "call", thinkingTimeMs };
  }

  // Fallback
  return { action: canCheck ? "check" : "fold", thinkingTimeMs };
}
