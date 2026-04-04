import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config.js";
import { skaleBaseSepolia } from "../viem.js";
import { PokerAgent, PERSONALITY_MESSAGES } from "./agent.js";
import {
  RAGE_BOT,
  CAUTION_BOT,
  BLUFF_MASTER,
  MATH_GENIUS,
  LUCKY_BOT,
  WOLF_BOT,
} from "./personalities.js";
import type { AgentConfig, AgentPersonality } from "./types.js";

/**
 * Deterministic private keys for the 6 AI agents.
 * These are NOT real private keys — just test values for the hackathon demo.
 * Format: 0x0000...000N where N = 1-6
 */
const AGENT_PRIVATE_KEYS: `0x${string}`[] = [
  "0x0000000000000000000000000000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000000000000000000000000000002",
  "0x0000000000000000000000000000000000000000000000000000000000000003",
  "0x0000000000000000000000000000000000000000000000000000000000000004",
  "0x0000000000000000000000000000000000000000000000000000000000000005",
  "0x0000000000000000000000000000000000000000000000000000000000000006",
];

const AGENT_COLORS = [
  "#EF4444", // Red — Rage Bot
  "#3B82F6", // Blue — Caution Bot
  "#A855F7", // Purple — Bluff Master
  "#22C55E", // Green — Math Genius
  "#F59E0B", // Amber — Lucky Louie
  "#6366F1", // Indigo — The Wolf
];

const AGENT_CHAT_MESSAGES: Record<string, Record<string, string[]>> = {
  "Rage Bot": {
    "0": [
      "Whatever! 🖕",
      "I fold... BUT NEXT TIME! 😤",
      "You got lucky! 🍀❌",
      "This table is RIGGED",
    ],
    "1": [
      "I'll wait... for now 😤",
      "Saving my rage... 💢",
      "...",
      "patience is NOT my thing",
    ],
    "2": [
      "I'll see that and RAISE YOU LATER 😡",
      "You're going DOWN",
      "Call?! More like CALAMITY!",
      "Sure, I'll call your bluff",
    ],
    "3": [
      "ALL IN BABY 🚀🔥",
      "YOU CAN'T HANDLE THIS 💰💥",
      "RAISE RAISE RAISE!!!",
      "Money talks, I yell 🗣️💸",
      "TO THE MOON! 🌙",
    ],
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
    "3": ["My equity is high. Raise. 🧮", "Optimal raise size calculated. 📐", "Polarized range suggests raise. 📊", "Game theory optimal: raise. 🧠"],
  },
  "Lucky Louie": {
    "0": ["Nah, not feeling it 🎲", "Save my chips for the next one! 🍀", "Fold... what are the odds? 🤷", "Too boring, fold 🥱"],
    "1": ["Pass! Let's see... 🎲", "Check-a-roo! ✨", "Free card? Yes please! 😄", "Checking my luck 🍀"],
    "2": ["I call! Why not? 🎲", "Let's gooo! 🎰", "Call! Feeling lucky! 🍀", "Sure, I'll see that! 🃏"],
    "3": ["GO BIG OR GO HOME! 🎲🔥", "Lucky raise! 🍀✨", "Let's make it spicy! 🌶️", "Yolo raise! 🎰"],
  },
  "The Wolf": {
    "0": ["Not worth it. 🐺", "Patience... 🐺", "Weak hand. Fold. 🐺", "Biding my time... 🐺"],
    "1": ["Observing. 👁️🐺", "Waiting... 🐺", "Let them make mistakes. 🐺", "Check. 🐺"],
    "2": ["Acceptable. Proceeding. 🐺", "I'll see this. 🐺", "Calling to trap. 🐺", "Patience pays. 🐺"],
    "3": ["FOUND MY PREY. 🐺🔥", "PACK ATTACK! 🐺🐺", "Strong hand. Big bet. 🐺", "You're mine. 🐺"],
  },
};

/**
 * Derive agent accounts and create PokerAgent instances.
 */
function createAgents(): {
  configs: AgentConfig[];
  pokerAgents: PokerAgent[];
} {
  const configs: AgentConfig[] = [];
  const pokerAgents: PokerAgent[] = [];
  const personalities = [
    RAGE_BOT,
    CAUTION_BOT,
    BLUFF_MASTER,
    MATH_GENIUS,
    LUCKY_BOT,
    WOLF_BOT,
  ];

  for (let i = 0; i < 6; i++) {
    const personality = personalities[i];
    const privateKey = AGENT_PRIVATE_KEYS[i];
    const account = privateKeyToAccount(privateKey);

    // Create a wallet client for this agent
    const agentWallet = createWalletClient({
      account,
      chain: skaleBaseSepolia,
      transport: http(config.rpcUrl),
    });

    const agentConfig: AgentConfig = {
      id: String(i + 1),
      name: personality.name,
      personality: personality.tag,
      emoji: personality.emoji,
      privateKey,
      address: account.address,
    };
    configs.push(agentConfig);

    const agent = new PokerAgent(
      personality,
      account.address,
      agentWallet,
      AGENT_CHAT_MESSAGES[personality.name],
    );
    pokerAgents.push(agent);
  }

  return { configs, pokerAgents };
}

const { configs, pokerAgents } = createAgents();

/** All 6 agent configurations (lightweight, no wallet client). */
export const ALL_AGENT_CONFIGS: AgentConfig[] = configs;

/** All 6 PokerAgent instances (with wallet clients for on-chain interaction). */
export const ALL_POKER_AGENTS: PokerAgent[] = pokerAgents;

/** Agent colors for the frontend. */
export const AGENT_COLORS_MAP: Record<string, string> = {};
for (let i = 0; i < configs.length; i++) {
  AGENT_COLORS_MAP[configs[i].id] = AGENT_COLORS[i];
}

/** Look up an agent config by address. */
export function getAgentByAddress(address: string): AgentConfig | undefined {
  return configs.find((c) => c.address.toLowerCase() === address.toLowerCase());
}

/** Look up a PokerAgent by address. */
export function getPokerAgentByAddress(
  address: string,
): PokerAgent | undefined {
  return pokerAgents.find(
    (a) => a.address.toLowerCase() === address.toLowerCase(),
  );
}
