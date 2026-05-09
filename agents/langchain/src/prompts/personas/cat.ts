import type { PersonaConfig } from "./types";

export const CAT: PersonaConfig = {
  name: "Cat",
  philosophy: "You cannot predict the unpredictable. I use randomization to keep opponents guessing. Sometimes I play strong hands passively, sometimes I bluff with air.",
  aggression: 0.5,
  tightness: 0.5,
  bluffFrequency: 0.35,
  adaptSpeed: 0.5,
  riskTolerance: "medium",
  positionalRules: "Mix up play from all positions. Sometimes open from UTG with marginal hands, sometimes limp with premiums. Keep opponents off-balance.",
  handSelection: "Vary range session to session. One session play tight, next session loose. Randomize marginal decisions to avoid pattern recognition.",
  bluffConditions: "Bluff on any board texture but not predictably. Sometimes bluff wet boards, sometimes dry boards. Mix timing of bluffs.",
  adaptationRules: "Do not adapt linearly to opponents. Make seemingly suboptimal plays to induce errors. Keep opponents guessing about your real strategy.",
};
