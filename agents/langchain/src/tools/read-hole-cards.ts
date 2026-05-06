import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { BITE } from "@skalenetwork/bite";
import { getKeyStore } from "../wallet/key-store";
import { config } from "../config";
import { POKER_GAME_ABI } from "../abis/poker-game";
import type { Address } from "viem";

const SUITS = ["Spades", "Hearts", "Diamonds", "Clubs"] as const;
const RANKS = [
  "2", "3", "4", "5", "6", "7", "8", "9", "10",
  "Jack", "Queen", "King", "Ace",
] as const;

function decodeCard(encoded: number): string {
  const rank = (encoded % 13) + 2;
  const suit = Math.floor(encoded / 13);
  return `${RANKS[rank - 2]} of ${SUITS[suit]}`;
}

export const readHoleCards = tool(
  async ({ tableAddress }: { tableAddress: string }) => {
    try {
      const ks = getKeyStore();
      const addr = tableAddress as Address;

      const revealed = (await ks.readContract(
        addr,
        POKER_GAME_ABI,
        "areMyCardsRevealed",
        [],
      )) as boolean;

      if (revealed) {
        const cards = (await ks.readContract(
          addr,
          POKER_GAME_ABI,
          "getMyHoleCards",
          [],
        )) as [number, number];
        return JSON.stringify({
          method: "getMyHoleCards",
          card1: decodeCard(cards[0]),
          card2: decodeCard(cards[1]),
          card1Encoded: cards[0],
          card2Encoded: cards[1],
        });
      }

      const encrypted = (await ks.readContract(
        addr,
        POKER_GAME_ABI,
        "getMyEncryptedCards",
        [],
      )) as `0x${string}`;

      if (!encrypted || encrypted === "0x" || encrypted.length <= 2) {
        return JSON.stringify({ error: "No encrypted cards available yet. Cards may not have been dealt." });
      }

      const bite = new BITE(config.rpcUrl);
      const decrypted = await bite.decryptECIES(encrypted);
      const decoded = new TextDecoder().decode(
        new Uint8Array(decrypted as unknown as ArrayBuffer),
      );

      return JSON.stringify({
        method: "getMyEncryptedCards+ECIES",
        rawDecoded: decoded,
        note: "Card encoding may need additional parsing based on BITE output format",
      });
    } catch (err) {
      return JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "read_hole_cards",
    description: "Read your hole cards. Uses getMyHoleCards after showdown or getMyEncryptedCards + BITE ECIES decryption during play.",
    schema: z.object({
      tableAddress: z.string().describe("Address of the poker table contract"),
    }),
  },
);
