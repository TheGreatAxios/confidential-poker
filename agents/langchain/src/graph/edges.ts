import type { AgentStateType } from "./types";

export function afterRecoverSession(state: AgentStateType): string {
  if (state.sessionRecovered && state.tableAddress && state.seat >= 0) {
    return "readyUp";
  }
  return "discoverTable";
}

export function afterDiscoverTable(state: AgentStateType): string {
  if (state.error) return "handleError";
  return "joinOrRecoverSeat";
}

export function afterJoinOrRecoverSeat(state: AgentStateType): string {
  if (state.error) return "handleError";
  if (state.seat < 0) return "discoverTable";
  return "saveSession";
}

export function afterSaveSession(state: AgentStateType): string {
  return "readyUp";
}

export function afterReadyUp(state: AgentStateType): string {
  return "pollTurn";
}

export function afterPollTurn(state: AgentStateType): string {
  if (state.isMyTurn && state.pollResult && state.pollResult.phase >= 1 && state.pollResult.phase <= 4) {
    return "readGameState";
  }
  return "__end__";
}

export function afterReadGameState(state: AgentStateType): string {
  return "buildPolicy";
}

export function afterBuildPolicy(state: AgentStateType): string {
  return "llmDecide";
}

export function afterLlmDecide(state: AgentStateType): string {
  return "extractDecision";
}

export function afterExtractDecision(state: AgentStateType): string {
  if (state.actionArgs) return "submitAction";
  return "fallbackPolicy";
}

export function afterSubmitAction(state: AgentStateType): string {
  if (state.submitted) return "logAction";
  if (state.fallbackDepth === 0) return "fallbackPolicy";
  if (state.fallbackDepth === 1) return "safeFallback";
  return "handleError";
}

export function afterFallbackPolicy(state: AgentStateType): string {
  if (state.actionArgs) return "submitAction";
  return "safeFallback";
}

export function afterSafeFallback(state: AgentStateType): string {
  if (state.actionArgs) return "submitAction";
  return "handleError";
}

export function afterLogAction(state: AgentStateType): string {
  return "settle";
}

export function afterSettle(state: AgentStateType): string {
  return "__end__";
}

export function afterHandleError(state: AgentStateType): string {
  if (state.clearTable) return "recoverSession";
  return "__end__";
}
