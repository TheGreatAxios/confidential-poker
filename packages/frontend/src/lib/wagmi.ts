// ─── Wagmi Configuration for SKALE Base Sepolia ─────────────────────────────────
//
// Defines the custom SKALE chain and wagmi config for RainbowKit.
// Falls back to hardcoded values when env vars are absent.

import { cookieStorage, createStorage, http } from "wagmi";
import { defineChain } from "viem";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { FRONTEND_CONFIG } from "@/lib/config";

// ── SKALE Base Sepolia Chain Definition ────────────────────────────────────────

export const skaleBaseSepolia = defineChain({
  id: FRONTEND_CONFIG.chainId,
  name: "SKALE Base Sepolia",
  nativeCurrency: {
    name: "SKALE",
    symbol: "sFUEL",
    decimals: 18,
  },
  blockTime: 1_000,
  rpcUrls: {
    default: {
      http: [FRONTEND_CONFIG.rpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "SKALE Explorer",
      url: FRONTEND_CONFIG.explorerUrl.replace(/\/$/, ""),
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
      import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "demo-project-id",
    chains: [skaleBaseSepolia],
    transports: {
      [skaleBaseSepolia.id]: http(FRONTEND_CONFIG.rpcUrl),
    },
    storage: createStorage({
      storage: cookieStorage,
    }),
    ssr: false,
  });
}
