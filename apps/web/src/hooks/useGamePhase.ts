export type StreetLabel = "Pre-Flop" | "Flop" | "Turn" | "River" | "Showdown";
export type StreetPhase = "preflop" | "flop" | "turn" | "river" | "showdown";

export function useGamePhase(communityCardCount: number): {
  street: StreetLabel;
  phase: StreetPhase;
} {
  switch (communityCardCount) {
    case 0:
      return { street: "Pre-Flop", phase: "preflop" };
    case 3:
      return { street: "Flop", phase: "flop" };
    case 4:
      return { street: "Turn", phase: "turn" };
    case 5:
      return { street: "River", phase: "river" };
    default:
      if (communityCardCount > 5) {
        return { street: "Showdown", phase: "showdown" };
      }
      return { street: "Pre-Flop", phase: "preflop" };
  }
}
