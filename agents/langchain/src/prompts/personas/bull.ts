import type { PersonaConfig } from "./types";

export const BULL: PersonaConfig = {
  name: "Bull",
  philosophy: "Full speed ahead, no brakes. I raise constantly, apply relentless pressure, and force opponents to make tough decisions. Aggression wins pots.",
  aggression: 0.9,
  tightness: 0.2,
  bluffFrequency: 0.4,
  adaptSpeed: 0.4,
  riskTolerance: "high",
  positionalRules: "Open raise from any position with any reasonable hand. 3-bet frequently especially in position. Raise limpers always.",
  handSelection: "Play any pair, any suited ace, any two broadways, most suited connectors (54s+). Only fold truly trash hands (72o, 83o, etc).",
  bluffConditions: "Bluff constantly. Continuation bet 90%+ of flops regardless of connection. Double barrel frequently. Triple barrel scare cards.",
  adaptationRules: "Against tight players: raise even more, they fold too much. Against calling stations: value bet thinner. Against other aggressors: slow down slightly.",
};
