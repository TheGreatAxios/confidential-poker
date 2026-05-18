import { describe, expect, test } from "bun:test";
import { useGamePhase } from "./useGamePhase";

describe("useGamePhase", () => {
  test("0 cards → Pre-Flop", () => {
    expect(useGamePhase(0)).toEqual({ street: "Pre-Flop", phase: "preflop" });
  });

  test("3 cards → Flop", () => {
    expect(useGamePhase(3)).toEqual({ street: "Flop", phase: "flop" });
  });

  test("4 cards → Turn", () => {
    expect(useGamePhase(4)).toEqual({ street: "Turn", phase: "turn" });
  });

  test("5 cards → River", () => {
    expect(useGamePhase(5)).toEqual({ street: "River", phase: "river" });
  });

  test(">5 cards → Showdown", () => {
    expect(useGamePhase(6)).toEqual({ street: "Showdown", phase: "showdown" });
    expect(useGamePhase(10)).toEqual({ street: "Showdown", phase: "showdown" });
  });

  test("invalid low counts fall back to Pre-Flop", () => {
    expect(useGamePhase(1)).toEqual({ street: "Pre-Flop", phase: "preflop" });
    expect(useGamePhase(2)).toEqual({ street: "Pre-Flop", phase: "preflop" });
    expect(useGamePhase(-1)).toEqual({ street: "Pre-Flop", phase: "preflop" });
  });
});
