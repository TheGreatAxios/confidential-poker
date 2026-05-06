import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getKeyStore } from "../wallet/key-store";
import { POKER_GAME_ABI } from "../abis/poker-game";
import type { Address } from "viem";

const SUITS = ["Spades", "Hearts", "Diamonds", "Clubs"] as const;
const RANKS = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "Jack", "Queen", "King", "Ace",
] as const;

function decodeCard(encoded: number): string {
  if (encoded === 0) return "None";
  const rank = (encoded % 13) + 2;
  const suit = Math.floor(encoded / 13);
  return `${RANKS[rank - 2]} of ${SUITS[suit]}`;
}

export const getGameState = tool(
  async ({ tableAddress }: { tableAddress: string }) => {
    try {
      const ks = getKeyStore();
      const addr = tableAddress as Address;
      const thisAddress = ks.getAddress();

      const phase = (await ks.readContract(addr, POKER_GAME_ABI, "phase", [])) as number;
      const phaseNames = ["Waiting", "Preflop", "Flop", "Turn", "River", "Showdown"];
      const phaseName = phaseNames[phase] ?? "Unknown";

      const pot = (await ks.readContract(addr, POKER_GAME_ABI, "pot", [])) as bigint;
      const currentBet = (await ks.readContract(addr, POKER_GAME_ABI, "currentBet", [])) as bigint;
      const turnIdx = (await ks.readContract(addr, POKER_GAME_ABI, "getCurrentTurnIndex", [])) as bigint;
      const playerCount = (await ks.readContract(addr, POKER_GAME_ABI, "playerCount", [])) as bigint;
      const handNumber = (await ks.readContract(addr, POKER_GAME_ABI, "handNumber", [])) as bigint;
      const community = (await ks.readContract(addr, POKER_GAME_ABI, "getCommunityCards", [])) as number[];

      let myIdx = -1;
      for (let i = 0; i < Number(playerCount); i++) {
        const pAddr = (await ks.readContract(
          addr,
          POKER_GAME_ABI,
          "getPlayer",
          [BigInt(i)],
        )) as Address;
        if (pAddr.toLowerCase() === thisAddress.toLowerCase()) {
          myIdx = i;
          break;
        }
      }

      const myStack = myIdx >= 0
        ? ((await ks.readContract(addr, POKER_GAME_ABI, "getPlayerStack", [BigInt(myIdx)])) as bigint)
        : 0n;

      const myInfo = myIdx >= 0
        ? ((await ks.readContract(addr, POKER_GAME_ABI, "getPlayerInfo", [BigInt(myIdx)])) as [
            Address, boolean, boolean, bigint, boolean, bigint,
          ])
        : null;

      const opponents = [];
      for (let i = 0; i < Number(playerCount); i++) {
        if (i === myIdx) continue;
        const info = (await ks.readContract(addr, POKER_GAME_ABI, "getPlayerInfo", [BigInt(i)])) as [
          Address, boolean, boolean, bigint, boolean, bigint,
        ];
        opponents.push({
          index: i,
          address: info[0],
          active: info[1],
          acted: info[2],
          bet: info[3].toString(),
          allIn: info[4],
          stack: info[5].toString(),
        });
      }

      const decodedCommunity = Array.from(community)
        .filter((c) => c > 0)
        .map(decodeCard);

      const isMyTurn = myIdx >= 0 && Number(turnIdx) === myIdx;

      return JSON.stringify({
        phase: phaseName,
        handNumber: Number(handNumber),
        pot: pot.toString(),
        currentBet: currentBet.toString(),
        myPlayerIndex: myIdx,
        myStack: myStack.toString(),
        myBet: myInfo ? myInfo[3].toString() : "0",
        myAllIn: myInfo ? myInfo[4] : false,
        isMyTurn,
        currentTurnIndex: Number(turnIdx),
        communityCards: decodedCommunity,
        communityCardsEncoded: Array.from(community).filter((c) => c > 0),
        opponents,
      });
    } catch (err) {
      return JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "get_game_state",
    description: "Get the full game state: phase, pot, my stack/bet, community cards, opponents, and whether it's your turn.",
    schema: z.object({
      tableAddress: z.string().describe("Address of the poker table contract"),
    }),
  },
);
