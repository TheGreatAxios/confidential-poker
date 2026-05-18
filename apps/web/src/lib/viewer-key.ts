import type { Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

export interface ViewerKeyPair {
  privateKey: Hex;
  publicKey: Hex;
  x: Hex;
  y: Hex;
}

const VIEWER_KEY_PREFIX = "ai-poker:viewer-key:";

function splitUncompressedPublicKey(publicKey: Hex): Pick<ViewerKeyPair, "x" | "y"> {
  if (!publicKey.startsWith("0x04") || publicKey.length !== 132) {
    throw new Error("Unexpected public key format");
  }

  return {
    x: `0x${publicKey.slice(4, 68)}` as Hex,
    y: `0x${publicKey.slice(68, 132)}` as Hex,
  };
}

export function generateViewerKeyPair(): ViewerKeyPair {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const publicKey = account.publicKey;
  const { x, y } = splitUncompressedPublicKey(publicKey);

  return {
    privateKey,
    publicKey,
    x,
    y,
  };
}

export function persistViewerKey(address: string, key: ViewerKeyPair) {
  const storageKey = `${VIEWER_KEY_PREFIX}${address.toLowerCase()}`;
  window.localStorage.setItem(
    storageKey,
    JSON.stringify({
      privateKey: key.privateKey,
      publicKey: key.publicKey,
      x: key.x,
      y: key.y,
      createdAt: Date.now(),
    }),
  );
}

export function loadViewerKey(address: string | null | undefined): ViewerKeyPair | null {
  if (!address || typeof window === "undefined") {
    return null;
  }

  const storageKey = `${VIEWER_KEY_PREFIX}${address.toLowerCase()}`;
  const rawValue = window.localStorage.getItem(storageKey);
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<ViewerKeyPair>;
    if (
      typeof parsed.privateKey !== "string" ||
      typeof parsed.publicKey !== "string" ||
      typeof parsed.x !== "string" ||
      typeof parsed.y !== "string"
    ) {
      return null;
    }

    return {
      privateKey: parsed.privateKey as Hex,
      publicKey: parsed.publicKey as Hex,
      x: parsed.x as Hex,
      y: parsed.y as Hex,
    };
  } catch {
    return null;
  }
}
