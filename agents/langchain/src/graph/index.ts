import { StateGraph } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph-checkpoint";
import { AgentState } from "./types";
import {
  recoverSessionNode,
  discoverTableNode,
  joinOrRecoverSeatNode,
  saveSessionNode,
  readyUpNode,
  pollTurnNode,
  readGameStateNode,
  buildPolicyNode,
  llmDecideNode,
  extractDecisionNode,
  fallbackPolicyNode,
  safeFallbackNode,
  submitActionNode,
  logActionNode,
  settleNode,
  handleErrorNode,
} from "./nodes";
import {
  afterRecoverSession,
  afterDiscoverTable,
  afterJoinOrRecoverSeat,
  afterSaveSession,
  afterReadyUp,
  afterPollTurn,
  afterReadGameState,
  afterBuildPolicy,
  afterLlmDecide,
  afterExtractDecision,
  afterSubmitAction,
  afterFallbackPolicy,
  afterSafeFallback,
  afterLogAction,
  afterSettle,
  afterHandleError,
} from "./edges";
import type { MemoryBackend } from "../memory/types";
import { getKeyStore } from "../wallet/key-store";

export type CompiledAgentGraph = ReturnType<typeof buildAgentGraph>;

export function buildAgentGraph(
  memoryBackend: MemoryBackend,
  submitActionCaller: { invoke(input: unknown, options?: unknown): Promise<unknown> },
) {
  const ks = getKeyStore();
  const ourAddress = ks.getAddress();

  const graph = new StateGraph(AgentState)
    .addNode("recoverSession", async (state) => recoverSessionNode(state, memoryBackend))
    .addNode("discoverTable", discoverTableNode)
    .addNode("joinOrRecoverSeat", joinOrRecoverSeatNode)
    .addNode("saveSession", async (state) => saveSessionNode(state, memoryBackend))
    .addNode("readyUp", readyUpNode)
    .addNode("pollTurn", pollTurnNode)
    .addNode("readGameState", readGameStateNode)
    .addNode("buildPolicy", buildPolicyNode)
    .addNode("llmDecide", async (state) => llmDecideNode(state, submitActionCaller))
    .addNode("extractDecision", extractDecisionNode)
    .addNode("submitAction", submitActionNode)
    .addNode("fallbackPolicy", fallbackPolicyNode)
    .addNode("safeFallback", safeFallbackNode)
    .addNode("logAction", async (state) => logActionNode(state, memoryBackend))
    .addNode("settle", settleNode)
    .addNode("handleError", handleErrorNode)

    .addEdge("__start__", "recoverSession")

    .addConditionalEdges("recoverSession", afterRecoverSession, {
      readyUp: "readyUp",
      discoverTable: "discoverTable",
    })
    .addConditionalEdges("discoverTable", afterDiscoverTable, {
      joinOrRecoverSeat: "joinOrRecoverSeat",
      handleError: "handleError",
    })
    .addConditionalEdges("joinOrRecoverSeat", afterJoinOrRecoverSeat, {
      saveSession: "saveSession",
      discoverTable: "discoverTable",
      handleError: "handleError",
    })
    .addConditionalEdges("saveSession", afterSaveSession, { readyUp: "readyUp" })

    .addConditionalEdges("readyUp", afterReadyUp, { pollTurn: "pollTurn" })
    .addConditionalEdges("pollTurn", afterPollTurn, {
      readGameState: "readGameState",
      __end__: "__end__",
    })

    .addConditionalEdges("readGameState", afterReadGameState, { buildPolicy: "buildPolicy" })
    .addConditionalEdges("buildPolicy", afterBuildPolicy, { llmDecide: "llmDecide" })
    .addConditionalEdges("llmDecide", afterLlmDecide, { extractDecision: "extractDecision" })
    .addConditionalEdges("extractDecision", afterExtractDecision, {
      submitAction: "submitAction",
      fallbackPolicy: "fallbackPolicy",
    })

    .addConditionalEdges("submitAction", afterSubmitAction, {
      logAction: "logAction",
      fallbackPolicy: "fallbackPolicy",
      safeFallback: "safeFallback",
      handleError: "handleError",
    })
    .addConditionalEdges("fallbackPolicy", afterFallbackPolicy, {
      submitAction: "submitAction",
      safeFallback: "safeFallback",
    })
    .addConditionalEdges("safeFallback", afterSafeFallback, {
      submitAction: "submitAction",
      handleError: "handleError",
    })

    .addConditionalEdges("logAction", afterLogAction, { settle: "settle" })
    .addConditionalEdges("settle", afterSettle, { __end__: "__end__" })

    .addConditionalEdges("handleError", afterHandleError, {
      recoverSession: "recoverSession",
      __end__: "__end__",
    });

  return graph.compile({ checkpointer: memoryBackend.checkpointer as unknown as BaseCheckpointSaver });
}
