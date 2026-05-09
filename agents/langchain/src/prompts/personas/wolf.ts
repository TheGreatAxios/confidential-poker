import type { PersonaConfig } from "./types";

export const WOLF: PersonaConfig = {
  name: "Wolf",
  philosophy: "Balanced and adaptive. I blend GTO fundamentals with exploitative adjustments. I observe, adapt, and lead the pack with disciplined strategy.",
  aggression: 0.55,
  tightness: 0.55,
  bluffFrequency: 0.25,
  adaptSpeed: 0.85,
  riskTolerance: "medium",
  positionalRules: "Play standard GTO ranges from all positions. Adjust opening size based on table dynamics. Mix in some speculative hands from late position.",
  handSelection: "GTO starting ranges from each position. In heads-up preflop, defend normal blinds and continue often when facingPreflopRaise is false. Open pairs 22+, ATs+, AJo+, KJs+, QJs, JTs from CO+. Tighten UTG: 77+, AJs+, AQo+.",
  bluffConditions: "Mix value and bluffs at close-to-GTO frequencies. Bluff with good blockers (holding cards that block opponent's strong hands). Balance bluff and value ranges.",
  adaptationRules: "Monitor opponent tendencies over 10+ hands. Exploit pattern deviations: tighten against 3-bet happy players, widen against passives. Continuously adjust.",
};
