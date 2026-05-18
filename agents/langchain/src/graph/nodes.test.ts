import { describe, test, expect } from "bun:test";
import {
  extractResponseText,
  extractToolCalls,
  extractSubmitActionArgs,
  getFallbackAction,
  isPokerAction,
} from "./extract";

describe("extractResponseText", () => {
  test("extracts string content directly", () => {
    const result = extractResponseText({ content: "fold please" });
    expect(result).toBe("fold please");
  });

  test("extracts from text parts array", () => {
    const result = extractResponseText({ content: [{ text: "call" }] });
    expect(result).toBe("call");
  });

  test("extracts from messages array", () => {
    const result = extractResponseText({ messages: [{ content: "raise 1000" }] });
    expect(result).toBe("raise 1000");
  });

  test("returns empty for null", () => {
    expect(extractResponseText(null)).toBe("");
  });
});

describe("extractToolCalls", () => {
  test("extracts direct tool_calls", () => {
    const result = extractToolCalls({ tool_calls: [{ name: "submit_action", args: {} }] });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("submit_action");
  });

  test("extracts from messages array", () => {
    const result = extractToolCalls({ messages: [{ tool_calls: [{ name: "log_action" }] }] });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("log_action");
  });

  test("returns empty for missing tool_calls", () => {
    expect(extractToolCalls({})).toHaveLength(0);
  });
});

describe("extractSubmitActionArgs", () => {
  const table = "0x1234567890123456789012345678901234567890" as `0x${string}`;

  test("extracts valid submit_action", () => {
    const response = {
      tool_calls: [{ name: "submit_action", args: { tableAddress: table, action: "raise", raiseAmount: "1000" } }],
    };
    const result = extractSubmitActionArgs(response, table);
    expect(result).not.toBeNull();
    expect(result?.action).toBe("raise");
    expect(result?.raiseAmount).toBe("1000");
  });

  test("ignores invalid action", () => {
    const response = {
      tool_calls: [{ name: "submit_action", args: { tableAddress: table, action: "invalid" } }],
    };
    expect(extractSubmitActionArgs(response, table)).toBeNull();
  });

  test("ignores wrong tool name", () => {
    const response = {
      tool_calls: [{ name: "log_action", args: { tableAddress: table, action: "call" } }],
    };
    expect(extractSubmitActionArgs(response, table)).toBeNull();
  });

  test("sets raiseAmount to null for non-raise", () => {
    const response = {
      tool_calls: [{ name: "submit_action", args: { tableAddress: table, action: "fold", raiseAmount: "1000" } }],
    };
    const result = extractSubmitActionArgs(response, table);
    expect(result?.raiseAmount).toBeNull();
  });
});

describe("isPokerAction", () => {
  test("accepts valid actions", () => {
    expect(isPokerAction("fold")).toBe(true);
    expect(isPokerAction("check")).toBe(true);
    expect(isPokerAction("call")).toBe(true);
    expect(isPokerAction("raise")).toBe(true);
  });

  test("rejects invalid actions", () => {
    expect(isPokerAction("bet")).toBe(false);
    expect(isPokerAction(null)).toBe(false);
    expect(isPokerAction(undefined)).toBe(false);
  });
});

describe("getFallbackAction", () => {
  test("returns call when currentBet > myBet", () => {
    expect(getFallbackAction({ currentBet: "100", myBet: "0" })).toBe("call");
  });

  test("returns check when currentBet == myBet", () => {
    expect(getFallbackAction({ currentBet: "100", myBet: "100" })).toBe("check");
  });

  test("returns check when no bets", () => {
    expect(getFallbackAction({})).toBe("check");
  });
});
