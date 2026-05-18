import { describe, test, expect } from "bun:test";
import {
  afterRecoverSession,
  afterDiscoverTable,
  afterJoinOrRecoverSeat,
  afterPollTurn,
  afterSubmitAction,
  afterHandleError,
} from "./edges";
import type { AgentStateType } from "./types";

function makeState(partial: Partial<AgentStateType>): AgentStateType {
  return {
    ourAddress: "0x0000000000000000000000000000000000000000",
    tableAddress: null,
    seat: -1,
    sessionRecovered: false,
    pollResult: null,
    isMyTurn: false,
    gameStateJson: "",
    holeCardsJson: "",
    phasePlaybook: "",
    policyDecision: null,
    llmResponse: null,
    responseText: "",
    actionArgs: null,
    submitted: false,
    txHash: null,
    finalAction: null,
    finalRaiseAmount: null,
    thinking: "",
    fallbackDepth: 0,
    error: null,
    errorType: null,
    clearTable: false,
    backoffAttempt: 0,
    ...partial,
  } as AgentStateType;
}

describe("afterRecoverSession", () => {
  test("routes to readyUp when session is recovered", () => {
    const state = makeState({ sessionRecovered: true, tableAddress: "0x1234", seat: 2 });
    expect(afterRecoverSession(state)).toBe("readyUp");
  });

  test("routes to discoverTable when no session", () => {
    const state = makeState({ sessionRecovered: false, tableAddress: null, seat: -1 });
    expect(afterRecoverSession(state)).toBe("discoverTable");
  });
});

describe("afterDiscoverTable", () => {
  test("routes to handleError on error", () => {
    const state = makeState({ error: "fail", errorType: "transient" });
    expect(afterDiscoverTable(state)).toBe("handleError");
  });

  test("routes to joinOrRecoverSeat on success", () => {
    const state = makeState({ tableAddress: "0x1234" });
    expect(afterDiscoverTable(state)).toBe("joinOrRecoverSeat");
  });
});

describe("afterJoinOrRecoverSeat", () => {
  test("routes to handleError on error", () => {
    const state = makeState({ error: "fail", errorType: "transient" });
    expect(afterJoinOrRecoverSeat(state)).toBe("handleError");
  });

  test("routes back to discoverTable if seat invalid", () => {
    const state = makeState({ seat: -1 });
    expect(afterJoinOrRecoverSeat(state)).toBe("discoverTable");
  });

  test("routes to saveSession when seated", () => {
    const state = makeState({ seat: 2 });
    expect(afterJoinOrRecoverSeat(state)).toBe("saveSession");
  });
});

describe("afterPollTurn", () => {
  test("routes to readGameState when it is our turn in betting phase", () => {
    const state = makeState({
      isMyTurn: true,
      pollResult: { phase: 2, phaseName: "Flop", handNumber: 5, pot: "0", currentBet: "0", myPlayerIndex: 0, currentTurnIndex: 0, activePlayerCount: 2 } as never,
    });
    expect(afterPollTurn(state)).toBe("readGameState");
  });

  test("routes to __end__ when not our turn", () => {
    const state = makeState({ isMyTurn: false, pollResult: { phase: 2 } as never });
    expect(afterPollTurn(state)).toBe("__end__");
  });

  test("routes to __end__ when phase is 0", () => {
    const state = makeState({ isMyTurn: false, pollResult: { phase: 0 } as never });
    expect(afterPollTurn(state)).toBe("__end__");
  });
});

describe("afterSubmitAction", () => {
  test("routes to logAction on success", () => {
    const state = makeState({ submitted: true });
    expect(afterSubmitAction(state)).toBe("logAction");
  });

  test("routes to fallbackPolicy on first failure", () => {
    const state = makeState({ submitted: false, fallbackDepth: 0 });
    expect(afterSubmitAction(state)).toBe("fallbackPolicy");
  });

  test("routes to safeFallback on second failure", () => {
    const state = makeState({ submitted: false, fallbackDepth: 1 });
    expect(afterSubmitAction(state)).toBe("safeFallback");
  });

  test("routes to handleError on third failure", () => {
    const state = makeState({ submitted: false, fallbackDepth: 2 });
    expect(afterSubmitAction(state)).toBe("handleError");
  });
});

describe("afterHandleError", () => {
  test("routes to recoverSession when table should be cleared", () => {
    const state = makeState({ clearTable: true });
    expect(afterHandleError(state)).toBe("recoverSession");
  });

  test("routes to __end__ for transient errors", () => {
    const state = makeState({ clearTable: false });
    expect(afterHandleError(state)).toBe("__end__");
  });
});
