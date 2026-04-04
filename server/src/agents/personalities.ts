import type { Personality, AgentPersonality } from "./types.js";

/**
 * Six distinct agent personalities for the poker game.
 * Each has different risk tolerance, aggression, and play style.
 */

export const RAGE_BOT: Personality & { tag: AgentPersonality } = {
  name: "Rage Bot",
  emoji: "🤬",
  tag: "aggressive",
  description: "Always raises. Throws chips at the pot. Zero chill.",
  foldThreshold: 0.05,
  raiseAggression: 0.95,
  bluffFrequency: 0.7,
  usesMath: false,
};

export const CAUTION_BOT: Personality & { tag: AgentPersonality } = {
  name: "Caution Bot",
  emoji: "🧐",
  tag: "conservative",
  description: "Plays it safe. Only bets with strong hands. Avoids confrontation.",
  foldThreshold: 0.6,
  raiseAggression: 0.2,
  bluffFrequency: 0.05,
  usesMath: false,
};

export const BLUFF_MASTER: Personality & { tag: AgentPersonality } = {
  name: "Bluff Master",
  emoji: "🎭",
  tag: "bluffer",
  description: "You never know what they have. Expert at the art of deception.",
  foldThreshold: 0.2,
  raiseAggression: 0.65,
  bluffFrequency: 0.8,
  usesMath: false,
};

export const MATH_GENIUS: Personality & { tag: AgentPersonality } = {
  name: "Math Genius",
  emoji: "🧮",
  tag: "mathematical",
  description: "Calculates pot odds and expected value. Cold, precise, optimal.",
  foldThreshold: 0.4,
  raiseAggression: 0.5,
  bluffFrequency: 0.15,
  usesMath: true,
};

export const LUCKY_BOT: Personality & { tag: AgentPersonality } = {
  name: "Lucky Louie",
  emoji: "🎲",
  tag: "loose",
  description: "Plays almost every hand. Loves the action. Calls everything.",
  foldThreshold: 0.15,
  raiseAggression: 0.1,
  bluffFrequency: 0.3,
  usesMath: false,
};

export const WOLF_BOT: Personality & { tag: AgentPersonality } = {
  name: "The Wolf",
  emoji: "🐺",
  tag: "tight",
  description: "Patient hunter. Waits for premium hands, then strikes hard.",
  foldThreshold: 0.55,
  raiseAggression: 0.75,
  bluffFrequency: 0.1,
  usesMath: false,
};

export const ALL_PERSONALITIES: (Personality & { tag: AgentPersonality })[] = [
  RAGE_BOT,
  CAUTION_BOT,
  BLUFF_MASTER,
  MATH_GENIUS,
  LUCKY_BOT,
  WOLF_BOT,
];
