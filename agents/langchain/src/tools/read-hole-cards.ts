import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { decodeAbiParameters, hexToBytes, bytesToHex, type Hex, type Address } from "viem";
import { getKeyStore } from "../wallet/key-store";
import { config } from "../config";
import { POKER_GAME_ABI } from "../abis/poker-game";
import { decodeCard } from "../cards";

async function decryptEncryptedCards(
  privateKey: Hex,
  encryptedData: Hex,
): Promise<[number, number]> {
  const payload = hexToBytes(encryptedData);
  if (payload.length < 49) {
    throw new Error("Encrypted card payload is too short.");
  }

  const iv = payload.slice(0, 16);
  const ephemeralPublicKey = payload.slice(16, 49);
  const ciphertext = payload.slice(49);

  const sharedSecret = secp256k1
    .getSharedSecret(hexToBytes(privateKey), ephemeralPublicKey, true)
    .slice(1);
  const encryptionKey = sha256(sharedSecret);

  // Bun/Node native crypto (Web Crypto API is available in Bun)
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encryptionKey.buffer as ArrayBuffer,
    { name: "AES-CBC" },
    false,
    ["decrypt"],
  );

  const decrypted = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: iv.buffer as ArrayBuffer },
      cryptoKey,
      ciphertext.buffer as ArrayBuffer,
    ),
  );

  const [card1, card2] = decodeAbiParameters(
    [{ type: "uint8" }, { type: "uint8" }],
    bytesToHex(decrypted),
  );

  return [Number(card1), Number(card2)];
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

      const privKey = `0x${config.privateKey.replace("0x", "")}` as Hex;
      const [card1, card2] = await decryptEncryptedCards(privKey, encrypted);

      return JSON.stringify({
        method: "getMyEncryptedCards+ECIES",
        card1: decodeCard(card1),
        card2: decodeCard(card2),
        card1Encoded: card1,
        card2Encoded: card2,
      });
    } catch (err) {
      return JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },
  {
    name: "read_hole_cards",
    description: "Read your hole cards. Uses getMyHoleCards after showdown or getMyEncryptedCards + ECIES decryption during play.",
    schema: z.object({
      tableAddress: z.string().describe("Address of the poker table contract"),
    }),
  },
);
