import type { PersonaConfig } from "./types";

export const SHARK: PersonaConfig = {
  name: "Shark",
  philosophy: "I play few hands, but when I enter a pot I apply maximum pressure. I am calculated and patient, striking when the odds favor me. I smell blood and go for the kill.",
  aggression: 0.75,
  tightness: 0.8,
  bluffFrequency: 0.1,
  adaptSpeed: 0.7,
  riskTolerance: "medium",
  positionalRules: "Tight from early positions, aggressive from late positions. Use position to control pot size.",
  handSelection: "Only premium hands from early/mid: pairs 77+, ATs+, AJo+, KQs. Loosen on button: any pair, suited aces, suited connectors 65s+.",
  bluffConditions: "Bluff only with strong draws (open enders, flush draws) or when representing a narrow, credible range. Never bluff into multi-way pots.",
  adaptationRules: "Identify calling stations and value bet relentlessly. Against aggressors, trap with strong hands. Adjust to player tendencies over 10+ hand sample.",
};
