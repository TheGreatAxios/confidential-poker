import { describe, test, expect } from "bun:test";
import { decidePokerAction } from "./action-policy";

// Card encoding: rank = encoded & 0x0f, suit = (encoded >> 4) & 0x03
// Ranks: 2=2, 3=3, ..., 10=10, 11=J, 12=Q, 13=K, 14=A
// Suits: 0=Spades, 1=Hearts, 2=Diamonds, 3=Clubs

describe("decidePokerAction", () => {
  test("returns call when card read unavailable and bet to call", () => {
    const result = decidePokerAction({ toCall: "100" }, {});
    expect(result.action).toBe("call");
  });

  test("returns check when card read unavailable and no bet", () => {
    const result = decidePokerAction({}, {});
    expect(result.action).toBe("check");
  });

  test("folds weak preflop hand facing raise", () => {
    // 2 of Spades (rank=2, suit=0) = 2, 7 of Clubs (rank=7, suit=3) = 7 | 48 = 55
    const result = decidePokerAction(
      { phase: "Preflop", toCall: "100", bigBlind: "50", facingPreflopRaise: true, myStack: "1000" },
      { card1Encoded: 2, card2Encoded: 55 },
    );
    expect(result.action).toBe("fold");
  });

  test("raises premium preflop hand (pocket Aces)", () => {
    // Ace of Spades = 14, Ace of Hearts = 14 | 16 = 30
    const result = decidePokerAction(
      { phase: "Preflop", toCall: "0", bigBlind: "50", facingPreflopRaise: false, myStack: "1000" },
      { card1Encoded: 14, card2Encoded: 30 },
    );
    expect(result.action).toBe("raise");
  });

  test("checks playable preflop when no bet", () => {
    // King of Spades = 13, Queen of Hearts = 12 | 16 = 28 (KQo is broadway, playable)
    const result = decidePokerAction(
      { phase: "Preflop", toCall: "0", bigBlind: "50", facingPreflopRaise: false, myStack: "1000" },
      { card1Encoded: 13, card2Encoded: 28 },
    );
    expect(result.action).toBe("check");
  });

  test("calls playable hand facing small preflop raise", () => {
    // King of Spades = 13, Queen of Hearts = 28 — KQo is playable (broadway)
    const result = decidePokerAction(
      { phase: "Preflop", toCall: "50", bigBlind: "50", facingPreflopRaise: true, myStack: "1000" },
      { card1Encoded: 13, card2Encoded: 28 },
    );
    expect(result.action).toBe("call");
  });

  test("value raises made hand postflop when checked to", () => {
    // Ace of Spades = 14, 2 of Hearts = 2 | 16 = 18
    // Board: Ace of Diamonds = 46, 2 of Clubs = 2 | 48 = 50, King of Spades = 13
    // Hand: two pair (Aces and Deuces)
    const result = decidePokerAction(
      { phase: "Flop", toCall: "0", pot: "100", myStack: "1000", communityCardsEncoded: [46, 50, 13] },
      { card1Encoded: 14, card2Encoded: 18 },
    );
    expect(result.action).toBe("raise");
  });

  test("calls with one pair facing cheap bet", () => {
    // Ace of Spades = 14, 5 of Hearts = 5 | 16 = 21
    // Board: Ace of Diamonds = 46, 7 of Clubs = 55, 2 of Spades = 2
    // One pair of Aces
    const result = decidePokerAction(
      { phase: "Flop", toCall: "20", pot: "100", myStack: "1000", communityCardsEncoded: [46, 55, 2] },
      { card1Encoded: 14, card2Encoded: 21 },
    );
    expect(result.action).toBe("call");
  });

  test("checks draw when no bet", () => {
    // 5 of Spades = 5, 6 of Spades = 6 — suited connector
    // Board: Ace of Diamonds = 46, 7 of Clubs = 55, 2 of Spades = 2
    const result = decidePokerAction(
      { phase: "Turn", toCall: "0", pot: "100", myStack: "1000", communityCardsEncoded: [46, 55, 2, 14] },
      { card1Encoded: 5, card2Encoded: 6 },
    );
    expect(result.action).toBe("check");
  });

  test("folds weak hand facing large bet on river", () => {
    // 4 of Hearts = 4 | 16 = 20, 8 of Diamonds = 8 | 32 = 40
    // Board: Ace of Diamonds = 46, King of Clubs = 13 | 48 = 61, Queen of Spades = 12, Jack of Hearts = 11 | 16 = 27, 9 of Spades = 9
    const result = decidePokerAction(
      { phase: "River", toCall: "200", pot: "100", myStack: "1000", communityCardsEncoded: [46, 61, 12, 27, 9] },
      { card1Encoded: 20, card2Encoded: 40 },
    );
    expect(result.action).toBe("fold");
  });
});
