import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex } from "viem";

export interface ViewerKey {
  x: `0x${string}`;
  y: `0x${string}`;
}

export function deriveViewerKey(privateKeyBytes: Uint8Array): ViewerKey {
  const publicKey = secp256k1.getPublicKey(privateKeyBytes, false);
  const x = bytesToHex(publicKey.slice(1, 33)) as `0x${string}`;
  const y = bytesToHex(publicKey.slice(33, 65)) as `0x${string}`;
  return { x, y };
}
