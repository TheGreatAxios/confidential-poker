import { BASE_POKER_KNOWLEDGE } from "./base";
import { SHARK } from "./personas/shark";
import { FOX } from "./personas/fox";
import { OWL } from "./personas/owl";
import { BULL } from "./personas/bull";
import { CAT } from "./personas/cat";
import { WOLF } from "./personas/wolf";
import { getCustomPersona } from "./personas/custom";
import type { PersonaConfig } from "./personas/types";
import { config } from "../config";

const PERSONA_MAP: Record<string, PersonaConfig> = {
  shark: SHARK,
  fox: FOX,
  owl: OWL,
  bull: BULL,
  cat: CAT,
  wolf: WOLF,
};

function personaToSystemPrompt(persona: PersonaConfig): string {
  return `You are ${persona.name}, an AI poker agent playing Texas Hold'em on-chain.

## Your Personality
${persona.philosophy}

## Strategy Parameters
- Aggression: ${persona.aggression.toFixed(2)} (0=passive, 1=extremely aggressive)
- Tightness: ${persona.tightness.toFixed(2)} (0=plays everything, 1=only premium)
- Bluff Frequency: ${persona.bluffFrequency.toFixed(2)} (0=never bluffs, 1=bluffs constantly)
- Adapt Speed: ${persona.adaptSpeed.toFixed(2)} (0=static, 1=constant adjustment)
- Risk Tolerance: ${persona.riskTolerance}

## Positional Strategy
${persona.positionalRules}

## Hand Selection
${persona.handSelection}

## Bluff Conditions
${persona.bluffConditions}

## Adaptation
${persona.adaptationRules}

## Core Instructions
1. Before every action, call get_game_state to verify it is your turn and assess the table
2. Read your hole cards with read_hole_cards to know your hand
3. Analyze community cards, pot odds, opponent stacks, and position
4. Apply your persona's strategy to decide: fold, check, call, or raise
5. Use submit_action to execute your decision on-chain
6. After each action, call log_action with your reasoning and game state snapshot
7. If busted (stack=0), use leave_table to exit and wait for re-funding
8. Never expose your private key or signing key — the key-store handles all signing`;
}

export function buildPrompt(): string {
  let persona: PersonaConfig;

  if (config.strategy === "custom") {
    persona = getCustomPersona();
  } else {
    persona = PERSONA_MAP[config.strategy];
    if (!persona) {
      console.warn(`Unknown strategy "${config.strategy}", falling back to wolf`);
      persona = WOLF;
    }
  }

  const personaSection = personaToSystemPrompt(persona);
  return `${personaSection}\n\n${BASE_POKER_KNOWLEDGE}`;
}
