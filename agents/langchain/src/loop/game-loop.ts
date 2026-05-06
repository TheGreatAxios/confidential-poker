import { encodeFunctionData, type Address } from "viem";
import { getKeyStore } from "../wallet/key-store";
import { config } from "../config";
import { createAgent } from "../agent";
import { createMemoryBackend } from "../memory/factory";
import { setLogActionBackend } from "../tools/log-action";
import { discoverOrCreate } from "./discovery";
import { startEventWatcher, watchTurnChanged } from "./event-watcher";
import { createPoller } from "./poller";
import { getGameState as getGameStateTool } from "../tools/get-game-state";
import { readHoleCards as readHoleCardsTool } from "../tools/read-hole-cards";
import { checkBalance as checkBalanceTool } from "../tools/check-balance";
import { leaveTable as leaveTableTool } from "../tools/leave-table";
import { joinTable as joinTableTool } from "../tools/join-table";
import { POKER_GAME_ABI } from "../abis/poker-game";
import { POKER_FACTORY_ABI } from "../abis/poker-factory";
import { MIN_GAS } from "../tools/claim-faucet";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function exponentialBackoff(attempt: number): number {
  const delays = [1000, 2000, 4000, 8000, 30000];
  return delays[Math.min(attempt, delays.length - 1)];
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

export async function runGameLoop() {
  console.log("Starting autonomous poker agent loop");

  await ensureGas();

  const memoryBackend = await createMemoryBackend();
  setLogActionBackend(memoryBackend);

  const agent = createAgent(memoryBackend);
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
          // Check if table is in Waiting phase and re-ready-up
          const currentPhase = (await publicClient.readContract({
            address: tableAddress,
            abi: POKER_GAME_ABI,
            functionName: "phase",
          })) as number;

          if (currentPhase === 0) {
            const isReady = (await publicClient.readContract({
              address: tableAddress,
              abi: POKER_GAME_ABI,
              functionName: "isReady",
              args: [ourAddress],
            })) as boolean;

            if (!isReady) {
              console.log("Table is waiting — readying up...");
              const readyData = encodeFunctionData({
                abi: POKER_GAME_ABI,
                functionName: "readyUp",
              });
              await ks.signAndSend(tableAddress, readyData);
            }
          }
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
          // Ready up if in Waiting phase
          const phase = await publicClient.readContract({
            address: tableAddress,
            abi: POKER_GAME_ABI,
            functionName: "phase",
          }) as number;
          if (phase === 0) {
            const isReady = await publicClient.readContract({
              address: tableAddress,
              abi: POKER_GAME_ABI,
              functionName: "isReady",
              args: [ourAddress],
            }) as boolean;
            if (!isReady) {
              console.log("Table is waiting — readying up...");
              const readyData = encodeFunctionData({
                abi: POKER_GAME_ABI,
                functionName: "readyUp",
              });
              await ks.signAndSend(tableAddress, readyData);
            }
          }
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
        let readyUpSent = false;

        const unwatchEvent = watchTurnChanged(
          publicClient,
          tableAddress,
          ourAddress,
          () => { turnTriggered = true; },
        );

        const readyData = encodeFunctionData({
          abi: POKER_GAME_ABI,
          functionName: "readyUp",
        });

        console.log(`Watching for turn at table ${tableAddress}...`);
        while (!turnTriggered) {
          const pr = await watchPoller.poll();
          if (pr) {
            if (pr.isMyTurn && pr.phase >= 1 && pr.phase <= 4) {
              turnTriggered = true;
              pollResult = pr;
            } else if (pr.phase === 0 && !readyUpSent) {
              // Hand in Waiting phase and we haven't readied up yet
              console.log("Readying up for next hand...");
              readyUpSent = true;
              try {
                await ks.signAndSend(tableAddress, readyData);
                const pr2 = await watchPoller.poll();
                if (pr2 && pr2.isMyTurn && pr2.phase >= 1 && pr2.phase <= 4) {
                  turnTriggered = true;
                  pollResult = pr2;
                }
              } catch {
                // Already ready or race — will enter loop and poll again
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

      const cardsJson = await readHoleCardsTool.invoke({ tableAddress });
      console.log(`Cards: ${cardsJson}`);

      // Phase 4: Invoke the Deep Agent to decide and act
      const invokeInput = {
        messages: [
          {
            role: "user",
            content: `It is your turn in hand ${handNumber} (phase: ${pollResult.phaseName}).

Game state: ${stateJson}
Your hole cards: ${cardsJson}

Decide your action. Use get_game_state if you need a fresh read, then submit_action to play.
After acting, call log_action with your reasoning.`,
          },
        ] as never[],
      };

      const response = await agent.invoke(
        invokeInput,
        { configurable: { thread_id: `hand-${handNumber}` } } as never,
      );

      const msgLen = (response as any)?.messages?.length ?? 0;
      if (msgLen > 0) {
        const last = (response as any).messages[msgLen - 1];
        console.log("Agent response:", typeof last === "string"
          ? last.slice(0, 300)
          : JSON.stringify(last).slice(0, 300));
      }

      // Phase 5: Wait for hand to complete
      let waitingForHandEnd = true;
      const unwatchEvents = startEventWatcher(publicClient, tableAddress, {
        onHandComplete: () => { waitingForHandEnd = false; },
      });

      const pollForHandEnd = async () => {
        while (waitingForHandEnd) {
          try {
            const phase = await publicClient.readContract({
              address: tableAddress as Address,
              abi: POKER_GAME_ABI,
              functionName: "phase",
            });
            if (phase === 0) {
              waitingForHandEnd = false;
              console.log("Hand complete, phase returned to Waiting");
            }
          } catch {
            // transient read error, retry
          }
          if (waitingForHandEnd) await sleep(2000);
        }
      };

      await Promise.race([
        new Promise<void>((resolve) => {
          const check = setInterval(() => {
            if (!waitingForHandEnd) {
              clearInterval(check);
              resolve();
            }
          }, 2000);
        }),
        pollForHandEnd(),
      ]);

      unwatchEvents();

      // Phase 6: Check stack after hand
      const myStack = await publicClient.readContract({
        address: tableAddress,
        abi: POKER_GAME_ABI,
        functionName: "getPlayerStack",
        args: [BigInt(seat)],
      }) as bigint;

      console.log(`Stack after hand: ${myStack.toString()}`);

      if (myStack === 0n) {
        console.log("BUSTED! Stack is zero.");
        busted = true;
        const leaveResult = await leaveTableTool.invoke({ tableAddress });
        console.log(`Leave result: ${leaveResult}`);
        tableAddress = null;
        seat = -1;
        await memoryBackend.setSessionState(sessionKey, "");
      }

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
