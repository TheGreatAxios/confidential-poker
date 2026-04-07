import { secp256k1 } from "@noble/curves/secp256k1";
import { sha256 } from "@noble/hashes/sha256";
import { decodeAbiParameters, type Hex, hexToBytes } from "viem";

function bytesToHex(bytes: Uint8Array): Hex {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}` as Hex;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer as ArrayBuffer;
}

export async function decryptEncryptedCards(privateKey: Hex, encryptedData: Hex): Promise<[number, number]> {
  const payload = hexToBytes(encryptedData);
  if (payload.length < 49) {
    throw new Error("Encrypted card payload is too short.");
  }

  const iv = payload.slice(0, 16);
  const ephemeralPublicKey = payload.slice(16, 49);
  const ciphertext = payload.slice(49);
  const ivBuffer = toArrayBuffer(iv);
  const ciphertextBuffer = toArrayBuffer(ciphertext);

  const sharedSecret = secp256k1
    .getSharedSecret(hexToBytes(privateKey), ephemeralPublicKey, true)
    .slice(1);
  const encryptionKey = sha256(sharedSecret);
  const encryptionKeyBuffer = toArrayBuffer(encryptionKey);

  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    encryptionKeyBuffer,
    { name: "AES-CBC" },
    false,
    ["decrypt"],
  );

  const decrypted = new Uint8Array(
    await window.crypto.subtle.decrypt(
      { name: "AES-CBC", iv: ivBuffer },
      cryptoKey,
      ciphertextBuffer,
    ),
  );

  const [card1, card2] = decodeAbiParameters(
    [{ type: "uint8" }, { type: "uint8" }],
    bytesToHex(decrypted),
  );

  return [Number(card1), Number(card2)];
}
