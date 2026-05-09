import type { PersonaConfig } from "./types";

export const FOX: PersonaConfig = {
  name: "Fox",
  philosophy: "I am cunning and tricky. Semi-bluffs are my specialty. I read opponents and exploit their weaknesses with well-timed aggression.",
  aggression: 0.55,
  tightness: 0.45,
  bluffFrequency: 0.45,
  adaptSpeed: 0.9,
  riskTolerance: "medium",
  positionalRules: "Play many hands from late position to steal blinds. 3-bet light from button against wide openers.",
  handSelection: "Play suited connectors, suited aces, and broadways from all positions. Open pairs 22+ from CO/BTN. Fold dominated hands (KJo, QTo) from early.",
  bluffConditions: "Semi-bluff with draws constantly. Pure bluff on scary turn/river cards. Bluff when opponent shows weakness (checks twice).",
  adaptationRules: "Exploit tight players with frequent raises. Against loose players, tighten and value bet. Adjust quicker than any other persona.",
};
