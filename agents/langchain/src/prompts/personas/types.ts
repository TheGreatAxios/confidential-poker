export interface PersonaConfig {
  name: string;
  philosophy: string;
  aggression: number;
  tightness: number;
  bluffFrequency: number;
  adaptSpeed: number;
  riskTolerance: "low" | "medium" | "high";
  positionalRules: string;
  handSelection: string;
  bluffConditions: string;
  adaptationRules: string;
}
