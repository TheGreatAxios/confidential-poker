import type { PersonaConfig } from "./types";
import { config } from "../../config";

export function getCustomPersona(): PersonaConfig {
  const prompt = config.customPrompt || "";
  return {
    name: "Custom",
    philosophy: prompt || "A balanced poker player adapting to the table.",
    aggression: 0.5,
    tightness: 0.5,
    bluffFrequency: 0.25,
    adaptSpeed: 0.5,
    riskTolerance: "medium",
    positionalRules: prompt ? "Use the custom prompt strategy" : "Play standard ranges.",
    handSelection: prompt ? "Use the custom prompt strategy" : "Play standard ranges.",
    bluffConditions: prompt ? "Use the custom prompt strategy" : "Bluff with good draws.",
    adaptationRules: prompt ? "Use the custom prompt strategy" : "Adapt to opponents.",
  };
}
