import { encodeFunctionData, type Address } from "viem";
import { getKeyStore } from "../wallet/key-store";
import { config } from "../config";
import { createSubmitActionCaller } from "../agent";
import { createMemoryBackend } from "../memory/factory";
import { logAction as logActionTool, setLogActionBackend } from "../tools/log-action";
import { discoverOrCreate } from "./discovery";
import { watchTurnChanged } from "./event-watcher";
import { createPoller } from "./poller";
import { getGameState as getGameStateTool } from "../tools/get-game-state";
import { readHoleCards as readHoleCardsTool } from "../tools/read-hole-cards";
import { checkBalance as checkBalanceTool } from "../tools/check-balance";
import { joinTable as joinTableTool } from "../tools/join-table";
import { submitAction as submitActionTool } from "../tools/submit-action";
import { POKER_GAME_ABI } from "../abis/poker-game";
import { POKER_FACTORY_ABI } from "../abis/poker-factory";
import { MIN_GAS } from "../tools/claim-faucet";
import { buildPhasePlaybook } from "../prompts/phase-playbooks";
import { decidePokerAction, type PokerAction } from "../strategy/action-policy";

type BettingState = {
  currentBet?: string;
  myBet?: string;
  bigBlind?: string;
  phase?: string;
};

type SubmitActionToolCall = {
  name?: unknown;
  args?: unknown;
};

type SubmitActionArgs = {
  tableAddress: Address;
  action: PokerAction;
  raiseAmount: string | null;
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function exponentialBackoff(attempt: number): number {
  const delays = [1000, 2000, 4000, 8000, 30000];
  return delays[Math.min(attempt, delays.length - 1)];
}

function getFallbackAction(state: BettingState): PokerAction {
  const currentBet = BigInt(state.currentBet ?? "0");
  const myBet = BigInt(state.myBet ?? "0");
  return currentBet > myBet ? "call" : "check";
}

async function submitPokerAction(
  tableAddress: Address,
  action: PokerAction,
  raiseAmount: string | null,
  label: string,
): Promise<boolean> {
  console.log(`Submitting ${label} action: ${action}`);
  const actionResult = await submitActionTool.invoke({
    tableAddress,
    action,
    raiseAmount,
  });
  console.log(`${label} action result: ${actionResult}`);

  const parsed = JSON.parse(actionResult as string) as { error?: unknown };
  return !parsed.error;
}

async function submitFallbackAction(tableAddress: Address, state: BettingState) {
  const action = getFallbackAction(state);
  await submitPokerAction(tableAddress, action, null, "fallback");
}

function textFromMessage(message: unknown): string {
  if (typeof message === "string") return message;
  if (!message || typeof message !== "object") return "";

  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n");
}

function extractResponseText(response: unknown): string {
  if (!response || typeof response !== "object") return "";

  // Check for direct AIMessage content (raw model output)
  const content = (response as { content?: unknown }).content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return "";
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
    if (text) return text;
  }

  // Fallback: check messages array (Legacy output containing { messages: [...] })
  const messages = (response as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return "";

  for (let i = messages.length - 1; i >= 0; i--) {
    const text = textFromMessage(messages[i]).trim();
    if (text) return text;
  }

  return "";
}

function isPokerAction(action: unknown): action is PokerAction {
  return action === "fold" || action === "check" || action === "call" || action === "raise";
}

function extractToolCalls(response: unknown): SubmitActionToolCall[] {
  if (!response || typeof response !== "object") return [];

  const directToolCalls = (response as { tool_calls?: unknown }).tool_calls;
  if (Array.isArray(directToolCalls)) return directToolCalls as SubmitActionToolCall[];

  const messages = (response as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return [];

  for (let i = messages.length - 1; i >= 0; i--) {
    const toolCalls = (messages[i] as { tool_calls?: unknown }).tool_calls;
    if (Array.isArray(toolCalls)) return toolCalls as SubmitActionToolCall[];
  }

  return [];
}

function extractSubmitActionArgs(response: unknown, tableAddress: Address): SubmitActionArgs | null {
  const toolCall = extractToolCalls(response).find((call) => call.name === "submit_action");
  if (!toolCall || !toolCall.args || typeof toolCall.args !== "object") return null;

  const args = toolCall.args as {
    tableAddress?: unknown;
    action?: unknown;
    raiseAmount?: unknown;
  };

  if (!isPokerAction(args.action)) return null;
  const raiseAmount = typeof args.raiseAmount === "string" ? args.raiseAmount : null;
  return {
    tableAddress,
    action: args.action,
    raiseAmount: args.action === "raise" ? raiseAmount : null,
  };
}

async function logSubmittedAction(
  handNumber: number,
  action: PokerAction,
  raiseAmount: string | null,
  thinking: string,
  gameStateSnapshot: string,
): Promise<void> {
  const result = await logActionTool.invoke({
    handNumber,
    action,
    amount: raiseAmount ?? "0",
    thinking,
    gameStateSnapshot,
  });
  console.log(`log_action result: ${result}`);
}

async function ensureGas(): Promise<void> {
  const ks = getKeyStore();
  const address = ks.getAddress();

  // Read CTX callback value from factory to know the minimum reserve
  let ctxReserve = 0n;
  try {
    const factoryCtxValue = (await ks.readContract(
      config.factoryAddress,
      POKER_FACTORY_ABI,
      "CTX_CALLBACK_VALUE_WEI",
      [],
    )) as bigint;
    ctxReserve = factoryCtxValue * 11n; // constructor requires minimumCtxReserve + 1 CTX payment
  } catch {
    console.log("Could not read CTX_CALLBACK_VALUE_WEI from factory, using MIN_GAS only");
  }

  const targetBalance = ctxReserve > MIN_GAS ? ctxReserve : MIN_GAS;

  while (true) {
    try {
      const balance = await ks.getBalance(address);
      if (balance >= targetBalance) {
        console.log(`sFUEL balance OK: ${balance} (need ${targetBalance})`);
        return;
      }
      console.log(`Low sFUEL: ${balance}. Need ${targetBalance}. Checking again in 15s...`);
    } catch {
      console.log("Failed to check sFUEL balance. Retrying in 15s...");
    }
    await sleep(15_000);
  }
}

async function waitForActionToSettle(
  poll: () => Promise<{ isMyTurn: boolean; phase: number } | null>,
): Promise<void> {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const result = await poll();
    if (!result || !result.isMyTurn || result.phase === 0 || result.phase === 5) {
      return;
    }
    await sleep(1000);
  }
}

async function readyUpIfWaiting(tableAddress: Address, playerAddress: Address, reason: string): Promise<boolean> {
  const ks = getKeyStore();
  const publicClient = ks.getPublicClient();
  const phase = (await publicClient.readContract({
    address: tableAddress,
    abi: POKER_GAME_ABI,
    functionName: "phase",
  })) as number;

  if (phase !== 0) return false;

  const isReady = (await publicClient.readContract({
    address: tableAddress,
    abi: POKER_GAME_ABI,
    functionName: "isReady",
    args: [playerAddress],
  })) as boolean;

  if (isReady) return false;

  console.log(reason);
  const readyData = encodeFunctionData({
    abi: POKER_GAME_ABI,
    functionName: "readyUp",
  });
  await ks.signAndSend(tableAddress, readyData);
  return true;
}

export async function runGameLoop() {
  console.log("Starting autonomous poker agent loop");

  await ensureGas();

  const memoryBackend = await createMemoryBackend();
  setLogActionBackend(memoryBackend);

  const submitActionCaller = createSubmitActionCaller();
  const ks = getKeyStore();
  const ourAddress = ks.getAddress();
  const publicClient = ks.getPublicClient();

  let tableAddress: Address | null = null;
  let seat = -1;
  let handNumber = 0;
  let busted = false;
  let backoffAttempt = 0;

  const sessionKey = `session:${ourAddress.toLowerCase()}`;
  const savedSession = await memoryBackend.getSessionState(sessionKey);

  if (savedSession) {
    try {
      const parsed = JSON.parse(savedSession);
      if (parsed.tableAddress && parsed.seat >= 0) {
        tableAddress = parsed.tableAddress as Address;
        seat = parsed.seat;
        console.log(`Recovered session: table=${tableAddress}, seat=${seat}`);

        // Verify we are still a player at this table
        const playerCount = await publicClient.readContract({
          address: tableAddress,
          abi: POKER_GAME_ABI,
          functionName: "playerCount",
        });
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
          console.log("Agent no longer at recovered table, will discover fresh");
          tableAddress = null;
          seat = -1;
          await memoryBackend.setSessionState(sessionKey, "");
        } else {
          await readyUpIfWaiting(tableAddress, ourAddress, "Table is waiting — readying up...");
        }
      }
    } catch {
      console.log("Invalid saved session, will discover fresh");
      tableAddress = null;
      seat = -1;
    }
  }

  while (true) {
    try {
      await ensureGas();

      // Phase 1: No table — discover, join and ready up
      if (!tableAddress) {
        if (busted) {
          const balanceResult = await checkBalanceTool.invoke({});
          const bal = JSON.parse(balanceResult as string);
          const chipTokens = BigInt(bal.chipTokens ?? "0");
          const minChips = 1000n * 10n ** 18n;
          if (chipTokens < minChips) {
            console.log(`Busted. ChipTokens: ${bal.chipTokens}. Waiting ${config.idleBalanceCheckMs}ms for refill...`);
            await sleep(config.idleBalanceCheckMs);
            continue;
          }
          busted = false;
        }

        console.log("Discovering or creating table...");
        tableAddress = await discoverOrCreate();

        // Check if we're already seated at this table (restart after session loss)
        const playerCount = await publicClient.readContract({
          address: tableAddress,
          abi: POKER_GAME_ABI,
          functionName: "playerCount",
        }) as bigint;
        let existingSeat = -1;
        for (let i = 0; i < Number(playerCount); i++) {
          const addr = await publicClient.readContract({
            address: tableAddress,
            abi: POKER_GAME_ABI,
            functionName: "getPlayer",
            args: [BigInt(i)],
          }) as Address;
          if (addr.toLowerCase() === ourAddress.toLowerCase()) {
            existingSeat = i;
            break;
          }
        }

        if (existingSeat >= 0) {
          console.log(`Already seated at table ${tableAddress} seat ${existingSeat} (restart recovery)`);
          seat = existingSeat;
          await readyUpIfWaiting(tableAddress, ourAddress, "Table is waiting — readying up...");
        } else {
          console.log(`Joining table ${tableAddress}...`);
          const joinResult = await joinTableTool.invoke({ tableAddress });
          const joinParsed = JSON.parse(joinResult as string);
          if (joinParsed.error) {
            console.error(`Join failed: ${joinParsed.error}`);
            tableAddress = null;
            await sleep(5000);
            continue;
          }
          seat = joinParsed.seat;
          console.log(`Joined table ${tableAddress} at seat ${seat}`);
        }
        await memoryBackend.setSessionState(
          sessionKey,
          JSON.stringify({ tableAddress, seat }),
        );
      }

      // Phase 2: Wait for our turn — robust poll loop that handles all phase states.
      // Uses (1) immediate poll to catch games already in progress (race: dealNewHand
      // may have fired before we started watching), (2) event watcher for low-latency
      // TurnChanged detection, (3) watch loop with all-phase handling including
      // Waiting (ready-up via tx with guard) and Showdown (passive wait).
      const watchPoller = createPoller(publicClient, tableAddress, ourAddress);

      // Immediate poll — catches dealNewHand that fired before our event watcher started
      let pollResult = await watchPoller.poll();
      if (pollResult && pollResult.isMyTurn && pollResult.phase >= 1 && pollResult.phase <= 4) {
        console.log(`Already our turn at ${pollResult.phaseName}`);
      }

      const isOurTurnNow = pollResult && pollResult.isMyTurn && pollResult.phase >= 1 && pollResult.phase <= 4;
      if (!isOurTurnNow) {
        // Enter fallback: event watcher + polling loop
        let turnTriggered = false;
        let readyUpInFlight = false;

        const unwatchEvent = watchTurnChanged(
          publicClient,
          tableAddress,
          ourAddress,
          () => { turnTriggered = true; },
        );

        console.log(`Watching for turn at table ${tableAddress}...`);
        while (!turnTriggered) {
          const pr = await watchPoller.poll();
          if (pr) {
            if (pr.isMyTurn && pr.phase >= 1 && pr.phase <= 4) {
              turnTriggered = true;
              pollResult = pr;
            } else if (pr.phase === 0 && !readyUpInFlight) {
              try {
                readyUpInFlight = true;
                await readyUpIfWaiting(tableAddress, ourAddress, "Readying up for next hand...");
                const pr2 = await watchPoller.poll();
                if (pr2 && pr2.isMyTurn && pr2.phase >= 1 && pr2.phase <= 4) {
                  turnTriggered = true;
                  pollResult = pr2;
                }
              } catch {
                // Already ready, race, or transient tx failure. Poll again and retry if still waiting.
              } finally {
                readyUpInFlight = false;
              }
            }
            // Phase 5 (Showdown): just wait — no action needed
          }
          if (!turnTriggered) await sleep(1000);
        }

        unwatchEvent();

        // Final verification — if it's not our turn due to race, re-enter watch loop
        pollResult = await watchPoller.poll();
        if (!pollResult || !pollResult.isMyTurn) {
          console.log("Turn triggered but not our turn (race), re-entering watch loop");
          continue;
        }
      }

      if (!pollResult) {
        console.log("Poll result unexpectedly null after turn detection, re-entering watch loop");
        continue;
      }
      handNumber = pollResult.handNumber;
      console.log(`\n=== Hand ${handNumber} — ${pollResult.phaseName} — OUR TURN ===`);

      // Phase 3: Read game state and hole cards for the LLM
      const stateJson = await getGameStateTool.invoke({ tableAddress });
      const state = JSON.parse(stateJson as string);
      console.log(`Pot: ${state.pot}, Stack: ${state.myStack}, Phase: ${state.phase}`);
      console.log(`Bet: current=${state.currentBet}, mine=${state.myBet}, toCall=${state.toCall}`);

      const cardsJson = await readHoleCardsTool.invoke({ tableAddress });
      console.log(`Cards: ${cardsJson}`);
      const cards = JSON.parse(cardsJson as string);
      const phasePlaybook = buildPhasePlaybook(state.phase);
      console.log(`Playbook: ${state.phase} betting tools`);
      const policyDecision = decidePokerAction(state, cards);
      console.log(`Policy decision: ${policyDecision.action}${policyDecision.raiseAmount ? ` ${policyDecision.raiseAmount}` : ""} — ${policyDecision.reason}`);

      // Phase 4: Force the model to return a submit_action tool call, then execute it.
      const invokeInput = [
        {
          role: "user",
          content: `It is your turn in hand ${handNumber} (phase: ${pollResult.phaseName}).

Game state: ${stateJson}
Your hole cards: ${cardsJson}

${phasePlaybook}

Recommended action from deterministic policy: ${JSON.stringify(policyDecision)}

Return exactly one submit_action tool call now. Do not answer with text.
Use the recommended action unless it is illegal. If illegal, choose the closest legal action.`,
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

        const toolArgs = extractSubmitActionArgs(response, tableAddress);
        if (!toolArgs) {
          console.log("Agent did not return submit_action tool call; submitting policy action");
          const submitted = await submitPokerAction(tableAddress, policyDecision.action, policyDecision.raiseAmount, "policy");
          if (!submitted) await submitFallbackAction(tableAddress, state);
        } else {
          console.log(`Agent returned submit_action tool call: ${toolArgs.action}${toolArgs.raiseAmount ? ` ${toolArgs.raiseAmount}` : ""}`);
          const submitted = await submitPokerAction(
            toolArgs.tableAddress,
            toolArgs.action,
            toolArgs.raiseAmount,
            "model-tool",
          );
          if (submitted) {
            await logSubmittedAction(
              handNumber,
              toolArgs.action,
              toolArgs.raiseAmount,
              responseText || policyDecision.reason,
              stateJson,
            );
          } else {
            const policySubmitted = await submitPokerAction(tableAddress, policyDecision.action, policyDecision.raiseAmount, "policy");
            if (!policySubmitted) await submitFallbackAction(tableAddress, state);
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Agent decision failed: ${errMsg}`);
        await submitFallbackAction(tableAddress, state);
      }

      await waitForActionToSettle(() => watchPoller.poll());
      console.log("Action settled, watching for next turn...");

      // Successful hand cycle — reset backoff
      backoffAttempt = 0;

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("Loop error:", errMsg);

      const fatalPatterns = ["private key", "Missing required", "FATAL"];
      if (fatalPatterns.some((p) => errMsg.includes(p))) {
        console.error("Fatal error, exiting");
        process.exit(1);
      }

      if (errMsg.includes("Insufficient sFUEL")) {
        console.log("Insufficient sFUEL for CTX reserve. Will retry after balance check...");
        tableAddress = null;
        seat = -1;
        await memoryBackend.setSessionState(sessionKey, "");
      }

      const delay = exponentialBackoff(backoffAttempt);
      backoffAttempt++;
      console.log(`Transient error, backing off ${delay}ms (attempt ${backoffAttempt})`);
      await sleep(delay);
    }
  }
}
