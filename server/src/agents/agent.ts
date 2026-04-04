import type { Address, WalletClient } from "viem";
import type { Agent, Personality, OnChainGameState, PlayerInfo } from "./types.js";
import { ActionType } from "./types.js";

/**
 * Base agent implementation that makes decisions based on personality config.
 *
 * Uses simple hand strength estimation + personality weights.
 * No LLM API needed — fully self-contained for the hackathon demo.
 *
 * Hand strength estimation:
 * - High cards (A, K, Q, J) contribute to strength
 * - Paired cards are strong
 * - Suited cards get a small bonus
 * - Community cards are evaluated against hole cards
 */
export class PokerAgent implements Agent {
  readonly name: string;
  readonly emoji: string;
  readonly personality: Personality;
  readonly address: Address;
  readonly wallet: WalletClient;

  private chatMessages: Record<string, string[]> = {
    [ActionType.FOLD.toString()]: [],
    [ActionType.CHECK.toString()]: [],
    [ActionType.CALL.toString()]: [],
    [ActionType.RAISE.toString()]: [],
  };

  constructor(
    personality: Personality,
    address: Address,
    wallet: WalletClient,
    privateMessages?: Record<string, string[]>,
  ) {
    this.name = personality.name;
    this.emoji = personality.emoji;
    this.personality = personality;
    this.address = address;
    this.wallet = wallet;
    if (privateMessages) {
      this.chatMessages = privateMessages;
    }
  }

  /**
   * Estimate hand strength on a 0-1 scale.
   * Uses the card encoding from on-chain data: rank = card & 0x0F, suit = (card >> 4) & 0x03.
   */
  private estimateHandStrength(gameState: OnChainGameState, playerInfo: PlayerInfo): number {
    const card1 = Number(playerInfo.card1);
    const card2 = Number(playerInfo.card2);

    if (card1 === 0 && card2 === 0) return 0.5; // Unknown cards

    // Contract encoding: rank = card & 0x0F (2-14), suit = (card >> 4) & 0x03 (0-3)
    const rank1 = card1 & 0x0f;
    const rank2 = card2 & 0x0f;
    const suit1 = (card1 >> 4) & 0x03;
    const suit2 = (card2 >> 4) & 0x03;

    let strength = 0;

    // Pair bonus
    if (rank1 === rank2) {
      strength += 0.35 + (rank1 / 14) * 0.25; // Pair of Aces ~0.6, pair of 2s ~0.39
    } else {
      // High card values
      const highRank = Math.max(rank1, rank2);
      const lowRank = Math.min(rank1, rank2);
      strength += (highRank / 14) * 0.25 + (lowRank / 14) * 0.1;

      // Connected cards bonus (straights potential)
      const gap = highRank - lowRank;
      if (gap === 1) strength += 0.05;
      if (gap === 0) strength += 0; // Already handled as pair
      if (highRank >= 12 && lowRank >= 11) strength += 0.08; // Broadway cards

      // Suited bonus (flushes potential)
      if (suit1 === suit2) strength += 0.06;
    }

    // Factor in community cards if available
    if (gameState.communityCards.length > 0) {
      const communityRanks = gameState.communityCards.map((c) => Number(c) & 0x0f);

      // Check for pairs using community
      for (const commRank of communityRanks) {
        if (commRank === rank1 || commRank === rank2) {
          strength += 0.12; // Hit a pair on the board
        }
      }

      // Two pair / trips detection
      const allRanks = [...communityRanks, rank1, rank2];
      const rankCounts = new Map<number, number>();
      for (const r of allRanks) {
        rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
      }
      for (const count of rankCounts.values()) {
        if (count === 3) strength += 0.2;  // Trips
        if (count >= 4) strength += 0.35;  // Quads
      }

      // More community cards = more information = more confidence in estimation
      strength += gameState.communityCards.length * 0.02;
    }

    // Clamp to [0, 1]
    return Math.min(1, Math.max(0, strength));
  }

  /**
   * Decide action based on personality + hand strength.
   */
  decideAction(
    gameState: OnChainGameState,
    playerInfo: PlayerInfo,
    minRaise: bigint,
    potOdds: number,
  ): { action: ActionType; amount: bigint } {
    const strength = this.estimateHandStrength(gameState, playerInfo);
    const personality = this.personality;

    // Math Genius uses pot odds for decision making
    if (personality.usesMath) {
      if (strength < potOdds * 0.8) {
        return { action: ActionType.FOLD, amount: 0n };
      }
      if (strength > 0.7 && potOdds < 0.3) {
        const raiseAmount = minRaise + (gameState.pot * (strength > 0.85 ? 75n : 50n)) / 100n;
        return { action: ActionType.RAISE, amount: raiseAmount };
      }
      if (gameState.currentBet > playerInfo.currentBet) {
        return { action: ActionType.CALL, amount: gameState.currentBet - playerInfo.currentBet };
      }
      return { action: ActionType.CHECK, amount: 0n };
    }

    // Random factor for personality variety
    const rand = Math.random();

    // Bluff check — even with weak hands, bluff sometimes
    const isBluffing = rand < personality.bluffFrequency && strength < 0.4;

    // Fold decision
    if (strength < personality.foldThreshold && !isBluffing) {
      if (gameState.currentBet <= playerInfo.currentBet) {
        // Can check for free
        return { action: ActionType.CHECK, amount: 0n };
      }
      return { action: ActionType.FOLD, amount: 0n };
    }

    // Raise decision
    if (rand < personality.raiseAggression || isBluffing) {
      const raiseMultiplier = isBluffing
        ? 1 + Math.floor(Math.random() * 3)
        : Math.ceil(strength * 4);

      let raiseAmount = minRaise * BigInt(raiseMultiplier);

      // Don't over-raise relative to stack
      const maxRaise = playerInfo.balance + playerInfo.currentBet;
      if (raiseAmount > maxRaise) {
        raiseAmount = maxRaise;
      }

      if (raiseAmount <= gameState.currentBet) {
        // Can't raise, call instead
        return { action: ActionType.CALL, amount: gameState.currentBet - playerInfo.currentBet };
      }

      return { action: ActionType.RAISE, amount: raiseAmount };
    }

    // Default: call if there's a bet, check otherwise
    if (gameState.currentBet > playerInfo.currentBet) {
      const callAmount = gameState.currentBet - playerInfo.currentBet;
      // Only call if not too expensive relative to stack
      if (callAmount > playerInfo.balance * 5n / 10n && strength < 0.5) {
        return { action: ActionType.FOLD, amount: 0n };
      }
      return { action: ActionType.CALL, amount: callAmount };
    }

    return { action: ActionType.CHECK, amount: 0n };
  }

  /**
   * Get a personality-appropriate chat message.
   */
  getChatMessage(gameState: OnChainGameState, playerInfo: PlayerInfo, action: ActionType): string {
    const actionKey = action.toString();
    const messages = this.chatMessages[actionKey];
    if (messages && messages.length > 0) {
      return `${this.emoji} ${messages[Math.floor(Math.random() * messages.length)]}`;
    }
    return `${this.emoji} ...`;
  }
}

/**
 * Pre-configured chat messages per personality.
 */
export const PERSONALITY_MESSAGES: Record<string, Record<string, string[]>> = {
  "Rage Bot": {
    "0": ["Whatever! 🖕", "I fold... BUT NEXT TIME! 😤", "You got lucky! 🍀❌", "This table is RIGGED"],
    "1": ["I'll wait... for now 😤", "Saving my rage... 💢", "...", "patience is NOT my thing"],
    "2": ["I'll see that and RAISE YOU LATER 😡", "You're going DOWN", "Call?! More like CALAMITY!", "Sure, I'll call your bluff"],
    "3": ["ALL IN BABY 🚀🔥", "YOU CAN'T HANDLE THIS 💰💥", "RAISE RAISE RAISE!!!", "Money talks, I yell 🗣️💸", "TO THE MOON! 🌙"],
  },
  "Caution Bot": {
    "0": ["Too risky. 📉", "I'll wait for a better hand 🤔", "Not today... 🚪", "Calculated fold. ✅"],
    "1": ["I'll observe... 👀", "Interesting... 📊", "Let me think... 🤔", "Check. As expected. 📋"],
    "2": ["The odds are acceptable. 📈", "Proceeding with caution. 🐢", "I've calculated this. ✅", "Reasonable bet. 📊"],
    "3": ["My calculations suggest... RAISE! 🧐", "The math checks out! 📐", "I'm quite confident here. 💪", "Expected value is positive. 📊"],
  },
  "Bluff Master": {
    "0": ["Was just testing you... 😏", "Fold? I meant to do that 🎭", "You'll never know what I had ~", "Part of my master plan 🎪"],
    "1": ["Let you wonder... 🃏", "I see right through you... 👁️", "Or do I? 🎭", "The suspense builds... ⏳"],
    "2": ["I see your bet... 👀", "Calling with confidence I may not have 🎭", "Interesting move... 🤔✨", "I'll play along... for now 🎪"],
    "3": ["You CANNOT call this! 🎭🔥", "Or CAN you? 🤔", "I have the nuts! ...probably 🃏", "BLUFF OF THE CENTURY 💎", "Read 'em and weep... maybe 🎭"],
  },
  "Math Genius": {
    "0": ["-EV. Fold. 📉", "Pot odds insufficient. 📊", "Variance reduction. ✂️", "Optimal play is to fold. 🧮"],
    "1": ["Zero additional information. Check. 📊", "Kelly criterion says... check. 📐", "Neutral EV. 📈", "No edge detected. 👁️"],
    "2": ["Pot odds: favorable. Calling. 📊", "+EV decision confirmed. ✅", "Implied odds justify this. 🧮", "Standard GTO call. 📐"],
    "3": ["My equity is ~%.1f. Raise. 🧮", "Optimal raise size calculated. 📐", "Polarized range suggests raise. 📊", "Game theory optimal: raise. 🧠"],
  },
};
