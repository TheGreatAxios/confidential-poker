import { type Address } from "viem";
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

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function exponentialBackoff(attempt: number): number {
  const delays = [1000, 2000, 4000, 8000, 30000];
  return delays[Math.min(attempt, delays.length - 1)];
}

export async function runGameLoop() {
  console.log("Starting autonomous poker agent loop");

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
      }
    } catch {
      console.log("Invalid saved session, will discover fresh");
    }
  }

  while (true) {
    try {
      // Phase 1: No table — discover, join and ready up
      if (!tableAddress) {
        if (busted) {
          const balanceResult = await checkBalanceTool({});
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
        console.log(`Joining table ${tableAddress}...`);
        const joinResult = await joinTableTool({ tableAddress });
        const joinParsed = JSON.parse(joinResult as string);
        if (joinParsed.error) {
          console.error(`Join failed: ${joinParsed.error}`);
          tableAddress = null;
          await sleep(5000);
          continue;
        }
        seat = joinParsed.seat;
        console.log(`Joined table ${tableAddress} at seat ${seat}`);
        await memoryBackend.setSessionState(
          sessionKey,
          JSON.stringify({ tableAddress, seat }),
        );
      }

      // Phase 2: Wait for our turn (event watcher + poller hybrid)
      let turnTriggered = false;
      const unwatch = watchTurnChanged(
        publicClient,
        tableAddress,
        ourAddress,
        () => { turnTriggered = true; },
      );

      const poller = createPoller(publicClient, tableAddress, ourAddress);
      poller.start(() => { turnTriggered = true; });

      console.log(`Watching for turn at table ${tableAddress}...`);
      while (!turnTriggered) {
        await sleep(1000);
      }

      const pollResult = await poller.poll();
      if (!pollResult || !pollResult.isMyTurn) {
        poller.stop();
        unwatch();
        continue;
      }

      handNumber = pollResult.handNumber;
      console.log(`\n=== Hand ${handNumber} — ${pollResult.phaseName} — OUR TURN ===`);

      // Phase 3: Read game state and hole cards for the LLM
      const stateJson = await getGameStateTool({ tableAddress });
      const state = JSON.parse(stateJson as string);
      console.log(`Pot: ${state.pot}, Stack: ${state.myStack}, Phase: ${state.phase}`);

      const cardsJson = await readHoleCardsTool({ tableAddress });
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
              address: tableAddress,
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
      poller.stop();
      unwatch();

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
        const leaveResult = await leaveTableTool({ tableAddress });
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

      const fatalPatterns = ["private key", "Missing required", "FATAL", "Insufficient sFUEL"];
      if (fatalPatterns.some((p) => errMsg.includes(p))) {
        console.error("Fatal error, exiting");
        process.exit(1);
      }

      const delay = exponentialBackoff(backoffAttempt);
      backoffAttempt++;
      console.log(`Transient error, backing off ${delay}ms (attempt ${backoffAttempt})`);
      await sleep(delay);
    }
  }
}
