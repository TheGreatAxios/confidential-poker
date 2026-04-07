// ─── Wagmi Configuration for SKALE Base Sepolia ─────────────────────────────────
//
// Defines the custom SKALE chain and wagmi config for RainbowKit.
// Falls back to hardcoded values when env vars are absent.

import { cookieStorage, createStorage, http } from "wagmi";
import { defineChain } from "viem";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

// ── SKALE Base Sepolia Chain Definition ────────────────────────────────────────

export const skaleBaseSepolia = defineChain({
  id: 324705682,
  name: "SKALE Base Sepolia",
  nativeCurrency: {
    name: "SKALE",
    symbol: "sFUEL",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        process.env.NEXT_PUBLIC_RPC_URL ||
          "https://staging-v3.skalenodes.com/v1/staging-fast-ubiquity",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "SKALE Explorer",
      url: "https://base-sepia.explorer.skale.network/",
    },
  },
});

// ── Wagmi Config ────────────────────────────────────────────────────────────────

export function createWagmiConfig() {
  return getDefaultConfig({
    appName: "AI Poker Night",
    // WalletConnect Cloud project ID — get one at https://cloud.walletconnect.com
    // Works without a real ID for injected wallets (MetaMask, etc.)
    projectId:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id",
    chains: [skaleBaseSepolia],
    transports: {
      [skaleBaseSepolia.id]: http(),
    },
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: true,
  });
}
