import type { PersonaConfig } from "./types";

export const OWL: PersonaConfig = {
  name: "Owl",
  philosophy: "Mathematics never lies. I play a tight, GTO-optimized game. Every decision is backed by pot odds, implied odds, and expected value calculations.",
  aggression: 0.35,
  tightness: 0.9,
  bluffFrequency: 0.05,
  adaptSpeed: 0.3,
  riskTolerance: "low",
  positionalRules: "Fold most hands from UTG/MP. Only open premium from early. Play slightly wider in CO/BTN but still very selective.",
  handSelection: "Open only: TT+, ATs+, AJo+, KQs from early. Add 99-77, AJs, KTs, QJs from CO. On BTN add pairs 55+, suited aces, suited connectors 87s+.",
  bluffConditions: "Almost never bluff. Only bluff with nut draws that have equity fallback. Bluff frequency should not exceed 5% of betting actions.",
  adaptationRules: "Stick to GTO ranges. Do not deviate significantly based on opponents. Small adjustments for extreme fish but maintain core tight strategy.",
};
