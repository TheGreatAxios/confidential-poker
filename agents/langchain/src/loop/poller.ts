import { type Address, type PublicClient } from "viem";
import { POKER_GAME_ABI } from "../abis/poker-game";
import { config } from "../config";

export interface PollResult {
  isMyTurn: boolean;
  phase: number;
  phaseName: string;
  handNumber: number;
  pot: string;
  currentBet: string;
  myPlayerIndex: number;
  currentTurnIndex: number;
  activePlayerCount: number;
}

export function createPoller(
  publicClient: PublicClient,
  tableAddress: Address,
  ourAddress: Address,
) {
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const poll = async (): Promise<PollResult | null> => {
    try {
      const playerCount = (await publicClient.readContract({
        address: tableAddress,
        abi: POKER_GAME_ABI,
        functionName: "playerCount",
      })) as bigint;

      let myPlayerIndex = -1;
      for (let i = 0; i < Number(playerCount); i++) {
        const addr = (await publicClient.readContract({
          address: tableAddress,
          abi: POKER_GAME_ABI,
          functionName: "getPlayer",
          args: [BigInt(i)],
        })) as Address;
        if (addr.toLowerCase() === ourAddress.toLowerCase()) {
          myPlayerIndex = i;
          break;
        }
      }

      if (myPlayerIndex < 0) {
        return null;
      }

      const phase = (await publicClient.readContract({
        address: tableAddress,
        abi: POKER_GAME_ABI,
        functionName: "phase",
      })) as number;

      const phaseNames = ["Waiting", "Preflop", "Flop", "Turn", "River", "Showdown"];
      const handNumber = (await publicClient.readContract({
        address: tableAddress,
        abi: POKER_GAME_ABI,
        functionName: "handNumber",
      })) as bigint;

      const pot = (await publicClient.readContract({
        address: tableAddress,
        abi: POKER_GAME_ABI,
        functionName: "pot",
      })) as bigint;

      const currentBet = (await publicClient.readContract({
        address: tableAddress,
        abi: POKER_GAME_ABI,
        functionName: "currentBet",
      })) as bigint;

      const turnIdx = (await publicClient.readContract({
        address: tableAddress,
        abi: POKER_GAME_ABI,
        functionName: "getCurrentTurnIndex",
      })) as bigint;

      const activeCount = (await publicClient.readContract({
        address: tableAddress,
        abi: POKER_GAME_ABI,
        functionName: "activePlayerCount",
      })) as bigint;

      return {
        isMyTurn: Number(turnIdx) === myPlayerIndex,
        phase,
        phaseName: phaseNames[phase] ?? "Unknown",
        handNumber: Number(handNumber),
        pot: pot.toString(),
        currentBet: currentBet.toString(),
        myPlayerIndex,
        currentTurnIndex: Number(turnIdx),
        activePlayerCount: Number(activeCount),
      };
    } catch (err) {
      console.error("Poll error:", err instanceof Error ? err.message : String(err));
      return null;
    }
  };

  const start = (callback: (result: PollResult) => void) => {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(async () => {
      const result = await poll();
      if (result && result.isMyTurn && result.phase >= 1 && result.phase <= 4) {
        callback(result);
      }
    }, config.pollIntervalMs);
  };

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  return { poll, start, stop };
}
