import type { Address } from "viem";
import { encodeFunctionData } from "viem";
import { getKeyStore } from "../wallet/key-store";
import { config } from "../config";
import type { MemoryBackend } from "../memory/types";
import { createPoller } from "../loop/poller";
import { discoverOrCreate } from "../loop/discovery";
import { POKER_GAME_ABI } from "@confidential-poker/abis";
import { POKER_FACTORY_ABI } from "@confidential-poker/abis";
import { MIN_GAS } from "../tools/claim-faucet";
import { getGameState as getGameStateTool } from "../tools/get-game-state";
import { readHoleCards as readHoleCardsTool } from "../tools/read-hole-cards";
import { submitAction as submitActionTool } from "../tools/submit-action";
import { logAction as logActionTool } from "../tools/log-action";
import { buildPhasePlaybook } from "../prompts/phase-playbooks";
import { decidePokerAction, type PolicyDecision, type PokerAction } from "../strategy/action-policy";
import { extractResponseText, extractToolCalls, extractSubmitActionArgs, getFallbackAction } from "./extract";
import type { AgentStateType } from "./types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------- Session & Setup ----------

export async function recoverSessionNode(
  state: AgentStateType,
  memoryBackend: MemoryBackend,
): Promise<Partial<AgentStateType>> {
  const ks = getKeyStore();
  const ourAddress = ks.getAddress();
  const publicClient = ks.getPublicClient();
  const sessionKey = `session:${ourAddress.toLowerCase()}`;
  const saved = await memoryBackend.getSessionState(sessionKey);

  let tableAddress: Address | null = null;
  let seat = -1;

  if (saved) {
    try {
      const parsed = JSON.parse(saved) as { tableAddress?: Address; seat?: number };
      if (parsed.tableAddress && typeof parsed.seat === "number" && parsed.seat >= 0) {
        tableAddress = parsed.tableAddress;
        seat = parsed.seat;

        // Verify still seated
        const playerCount = (await publicClient.readContract({
          address: tableAddress,
          abi: POKER_GAME_ABI,
          functionName: "playerCount",
        })) as bigint;
        let found = false;
        for (let i = 0; i < Number(playerCount); i++) {
          const pAddr = (await publicClient.readContract({
            address: tableAddress,
            abi: POKER_GAME_ABI,
            functionName: "getPlayer",
            args: [BigInt(i)],
          })) as Address;
          if (pAddr.toLowerCase() === ourAddress.toLowerCase()) {
            found = true;
            seat = i;
            break;
          }
        }
        if (!found) {
          tableAddress = null;
          seat = -1;
          await memoryBackend.setSessionState(sessionKey, "");
        }
      }
    } catch {
      tableAddress = null;
      seat = -1;
    }
  }

  return { ourAddress, tableAddress, seat, sessionRecovered: tableAddress !== null && seat >= 0 };
}

export async function discoverTableNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const tableAddress = await discoverOrCreate();
  return { tableAddress };
}

export async function joinOrRecoverSeatNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const ks = getKeyStore();
  const ourAddress = state.ourAddress;
  const publicClient = ks.getPublicClient();
  const tableAddress = state.tableAddress;
  if (!tableAddress) return { error: "No table address", errorType: "fatal" };

  // Check if already seated (restart recovery)
  const playerCount = (await publicClient.readContract({
    address: tableAddress,
    abi: POKER_GAME_ABI,
    functionName: "playerCount",
  })) as bigint;

  let existingSeat = -1;
  for (let i = 0; i < Number(playerCount); i++) {
    const addr = (await publicClient.readContract({
      address: tableAddress,
      abi: POKER_GAME_ABI,
      functionName: "getPlayer",
      args: [BigInt(i)],
    })) as Address;
    if (addr.toLowerCase() === ourAddress.toLowerCase()) {
      existingSeat = i;
      break;
    }
  }

  if (existingSeat >= 0) {
    console.log(`Already seated at ${tableAddress} seat ${existingSeat}`);
    return { seat: existingSeat };
  }

  // Join table
  const { joinTable } = await import("../tools/join-table");
  const joinResult = await joinTable.invoke({ tableAddress: tableAddress.toString() });
  const parsed = JSON.parse(joinResult as string) as { error?: string; seat?: number };
  if (parsed.error) {
    return { error: `Join failed: ${parsed.error}`, errorType: "transient", clearTable: true };
  }
  return { seat: parsed.seat ?? -1 };
}

export async function saveSessionNode(
  state: AgentStateType,
  memoryBackend: MemoryBackend,
): Promise<Partial<AgentStateType>> {
  const sessionKey = `session:${state.ourAddress.toLowerCase()}`;
  await memoryBackend.setSessionState(
    sessionKey,
    JSON.stringify({ tableAddress: state.tableAddress, seat: state.seat }),
  );
  return {};
}

export async function readyUpNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const ks = getKeyStore();
  const tableAddress = state.tableAddress;
  if (!tableAddress) return {};

  const publicClient = ks.getPublicClient();
  const phase = (await publicClient.readContract({
    address: tableAddress,
    abi: POKER_GAME_ABI,
    functionName: "phase",
  })) as number;

  if (phase !== 0) return {};

  const isReady = (await publicClient.readContract({
    address: tableAddress,
    abi: POKER_GAME_ABI,
    functionName: "isReady",
    args: [state.ourAddress],
  })) as boolean;

  if (isReady) return {};

  console.log("Table is waiting — readying up...");
  const readyData = encodeFunctionData({
    abi: POKER_GAME_ABI,
    functionName: "readyUp",
  });
  await ks.signAndSend(tableAddress, readyData);
  return {};
}

// ---------- Turn Detection ----------

export async function pollTurnNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const ks = getKeyStore();
  const tableAddress = state.tableAddress;
  if (!tableAddress) return { isMyTurn: false, pollResult: null };

  const publicClient = ks.getPublicClient();
  const poller = createPoller(publicClient, tableAddress, state.ourAddress);
  const result = await poller.poll();
  if (!result) return { isMyTurn: false, pollResult: null };

  const isMyTurn = result.isMyTurn && result.phase >= 1 && result.phase <= 4;
  return { isMyTurn, pollResult: result };
}

// ---------- State Gathering ----------

export async function readGameStateNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const tableAddress = state.tableAddress;
  if (!tableAddress) return {};

  const [stateJson, cardsJson] = await Promise.all([
    getGameStateTool.invoke({ tableAddress: tableAddress.toString() }),
    readHoleCardsTool.invoke({ tableAddress: tableAddress.toString() }),
  ]);

  const handNumber = state.pollResult?.handNumber ?? 0;
  console.log(`\n=== Hand ${handNumber} — ${state.pollResult?.phaseName ?? "?"} — OUR TURN ===`);
  console.log(`Game state: ${stateJson}`);
  console.log(`Cards: ${cardsJson}`);

  const phasePlaybook = buildPhasePlaybook(JSON.parse(stateJson as string).phase ?? "");
  return { gameStateJson: stateJson as string, holeCardsJson: cardsJson as string, phasePlaybook };
}

// ---------- Decision ----------

export async function buildPolicyNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const gameState = JSON.parse(state.gameStateJson || "{}") as {
    phase?: string;
    pot?: string;
    currentBet?: string;
    myBet?: string;
    toCall?: string;
    bigBlind?: string;
    myStack?: string;
    facingPreflopRaise?: boolean;
    communityCardsEncoded?: number[];
  };
  const holeCards = JSON.parse(state.holeCardsJson || "{}") as {
    card1Encoded?: number;
    card2Encoded?: number;
  };

  const decision = decidePokerAction(gameState, holeCards);
  console.log(`Policy decision: ${decision.action}${decision.raiseAmount ? ` ${decision.raiseAmount}` : ""} — ${decision.reason}${decision.score !== undefined ? ` (hand score: ${decision.score})` : ""}`);
  return { policyDecision: decision };
}

export async function llmDecideNode(
  state: AgentStateType,
  submitActionCaller: { invoke(input: unknown, options?: unknown): Promise<unknown> },
): Promise<Partial<AgentStateType>> {
  const tableAddress = state.tableAddress;
  if (!tableAddress) return { llmResponse: null, responseText: "" };

  const handNumber = state.pollResult?.handNumber ?? 0;
  const phaseName = state.pollResult?.phaseName ?? "?";

  const invokeInput = [
    {
      role: "user",
      content: `It is your turn in hand ${handNumber} (phase: ${phaseName}).

Game state: ${state.gameStateJson}
Your hole cards: ${state.holeCardsJson}

${state.phasePlaybook}

Think step by step about your decision, then call submit_action with your chosen action.`,
    },
  ] as never[];

  try {
    const response = await submitActionCaller.invoke(
      invokeInput,
      { configurable: { thread_id: `hand-${handNumber}` } } as never,
    );
    const responseText = extractResponseText(response);
    if (responseText) {
      console.log("Agent response:", responseText.slice(0, 300));
    }
    return { llmResponse: response, responseText };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`Agent decision failed: ${errMsg}`);
    return { llmResponse: null, responseText: errMsg };
  }
}

export async function extractDecisionNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const tableAddress = state.tableAddress;
  if (!tableAddress) return { actionArgs: null, fallbackDepth: 0 };

  const args = extractSubmitActionArgs(state.llmResponse, tableAddress);
  if (args) {
    console.log(`Agent returned submit_action: ${args.action}${args.raiseAmount ? ` ${args.raiseAmount}` : ""}`);
    return { actionArgs: args, fallbackDepth: 0, thinking: state.responseText || state.policyDecision?.reason || "" };
  }
  console.log("Agent did not return submit_action tool call; will use policy fallback");
  return { actionArgs: null, fallbackDepth: 0, thinking: state.responseText || state.policyDecision?.reason || "" };
}

export async function fallbackPolicyNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const decision = state.policyDecision;
  if (!decision) return { actionArgs: null, fallbackDepth: 1 };

  const tableAddress = state.tableAddress;
  if (!tableAddress) return { actionArgs: null, fallbackDepth: 1 };

  return {
    actionArgs: {
      tableAddress,
      action: decision.action,
      raiseAmount: decision.raiseAmount,
    },
    fallbackDepth: 1,
    thinking: decision.reason,
  };
}

export async function safeFallbackNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const tableAddress = state.tableAddress;
  if (!tableAddress) return { actionArgs: null, fallbackDepth: 2 };

  const gameState = JSON.parse(state.gameStateJson || "{}") as {
    currentBet?: string;
    myBet?: string;
  };
  const action = getFallbackAction(gameState);
  return {
    actionArgs: { tableAddress, action, raiseAmount: null },
    fallbackDepth: 2,
    thinking: `Safe fallback: ${action}`,
  };
}

// ---------- Execution ----------

export async function submitActionNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const args = state.actionArgs;
  if (!args) return { submitted: false, error: "No action args", errorType: "transient" };

  console.log(`Submitting action: ${args.action}${args.raiseAmount ? ` ${args.raiseAmount}` : ""}`);
  try {
    const result = await submitActionTool.invoke({
      tableAddress: args.tableAddress.toString(),
      action: args.action,
      raiseAmount: args.raiseAmount,
    });
    const parsed = JSON.parse(result as string) as { error?: string; txHash?: string; action?: string; raiseAmount?: string };
    if (parsed.error) {
      console.error(`Submit failed: ${parsed.error}`);
      return { submitted: false, error: String(parsed.error), errorType: "transient" };
    }
    console.log(`Action submitted: ${parsed.action}, txHash: ${parsed.txHash}`);
    return {
      submitted: true,
      txHash: parsed.txHash ?? null,
      finalAction: (parsed.action as PokerAction) ?? args.action,
      finalRaiseAmount: parsed.raiseAmount ?? args.raiseAmount,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`Submit exception: ${errMsg}`);
    return { submitted: false, error: errMsg, errorType: "transient" };
  }
}

// ---------- Logging & Settlement ----------

export async function logActionNode(
  state: AgentStateType,
  memoryBackend: MemoryBackend,
): Promise<Partial<AgentStateType>> {
  const handNumber = state.pollResult?.handNumber ?? 0;
  if (!state.finalAction) return {};

  const result = await logActionTool.invoke({
    handNumber,
    action: state.finalAction,
    amount: state.finalRaiseAmount ?? "0",
    thinking: state.thinking,
    gameStateSnapshot: state.gameStateJson,
  });
  console.log(`log_action result: ${result}`);
  return {};
}

export async function settleNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const ks = getKeyStore();
  const tableAddress = state.tableAddress;
  if (!tableAddress) return {};

  const publicClient = ks.getPublicClient();
  const poller = createPoller(publicClient, tableAddress, state.ourAddress);

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const result = await poller.poll();
    if (!result || !result.isMyTurn || result.phase === 0 || result.phase === 5) {
      console.log("Action settled, watching for next turn...");
      return { submitted: false, isMyTurn: false };
    }
    await sleep(1000);
  }
  console.log("Settlement timeout reached");
  return { submitted: false, isMyTurn: false };
}

// ---------- Error Handling ----------

export async function handleErrorNode(state: AgentStateType): Promise<Partial<AgentStateType>> {
  const errMsg = state.error ?? "Unknown error";
  console.error("Graph error:", errMsg);

  const fatalPatterns = ["private key", "Missing required", "FATAL"];
  if (fatalPatterns.some((p) => errMsg.includes(p))) {
    console.error("Fatal error, exiting");
    process.exit(1);
  }

  if (errMsg.includes("Insufficient sFUel") || errMsg.includes("Insufficient sFUEL")) {
    return { clearTable: true, tableAddress: null, seat: -1, error: null, errorType: null };
  }

  const delays = [1000, 2000, 4000, 8000, 30000];
  const delay = delays[Math.min(state.backoffAttempt, delays.length - 1)];
  const nextAttempt = state.backoffAttempt + 1;
  console.log(`Transient error, backing off ${delay}ms (attempt ${nextAttempt})`);
  await sleep(delay);

  return {
    error: null,
    errorType: null,
    backoffAttempt: nextAttempt,
    clearTable: state.clearTable,
  };
}
