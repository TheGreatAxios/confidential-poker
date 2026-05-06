import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getKeyStore } from "../wallet/key-store";
import { POKER_GAME_ABI } from "../abis/poker-game";
import type { Address } from "viem";

export const getTableInfo = tool(
  async ({ tableAddress }: { tableAddress: string }) => {
    try {
      const ks = getKeyStore();
      const addr = tableAddress as Address;
      const phase = (await ks.readContract(addr, POKER_GAME_ABI, "getPhaseName", [])) as string;
      const pot = (await ks.readContract(addr, POKER_GAME_ABI, "pot", [])) as bigint;
      const currentBet = (await ks.readContract(addr, POKER_GAME_ABI, "currentBet", [])) as bigint;
      const turnIdx = (await ks.readContract(addr, POKER_GAME_ABI, "getCurrentTurnIndex", [])) as bigint;
      const playerCount = (await ks.readContract(addr, POKER_GAME_ABI, "playerCount", [])) as bigint;
      const activeCount = (await ks.readContract(addr, POKER_GAME_ABI, "activePlayerCount", [])) as bigint;
      const handNumber = (await ks.readContract(addr, POKER_GAME_ABI, "handNumber", [])) as bigint;
      const dealer = (await ks.readContract(addr, POKER_GAME_ABI, "dealer", [])) as Address;
      const community = (await ks.readContract(addr, POKER_GAME_ABI, "getCommunityCards", [])) as number[];
      const tableName = (await ks.readContract(addr, POKER_GAME_ABI, "tableName", [])) as string;
      const buyIn = (await ks.readContract(addr, POKER_GAME_ABI, "BUY_IN", [])) as bigint;
      const bigBlind = (await ks.readContract(addr, POKER_GAME_ABI, "BIG_BLIND", [])) as bigint;
      const smallBlind = (await ks.readContract(addr, POKER_GAME_ABI, "SMALL_BLIND", [])) as bigint;

      const players = [];
      for (let i = 0; i < Number(playerCount); i++) {
        const info = (await ks.readContract(addr, POKER_GAME_ABI, "getPlayerInfo", [BigInt(i)])) as [
          Address, boolean, boolean, bigint, boolean, bigint,
        ];
        players.push({
          index: i,
          address: info[0],
          active: info[1],
          acted: info[2],
          bet: info[3].toString(),
          allIn: info[4],
          stack: info[5].toString(),
        });
      }

      return JSON.stringify({
        address: addr,
        name: tableName,
        phase,
        pot: pot.toString(),
        currentBet: currentBet.toString(),
        currentTurnIndex: Number(turnIdx),
        playerCount: Number(playerCount),
        activePlayerCount: Number(activeCount),
        handNumber: Number(handNumber),
        dealer,
        buyIn: buyIn.toString(),
        bigBlind: bigBlind.toString(),
        smallBlind: smallBlind.toString(),
        communityCards: Array.from(community).filter((c) => c > 0),
        players,
      });
    } catch (err) {
      return JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "get_table_info",
    description: "Get detailed info about a poker table including phase, pot, players, stacks, and community cards.",
    schema: z.object({
      tableAddress: z.string().describe("Address of the poker table contract"),
    }),
  },
);
