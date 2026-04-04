"use client";

import { http, createConfig } from "wagmi";
import { defineChain } from "viem";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

// ============================================================
// SKALE Chain Definition — staging-attentive-steel-laika
// ============================================================
export const skaleChain = defineChain({
  id: 324705682,
  name: "SKALE Base Sepolia",
  nativeCurrency: { name: "sFUEL", symbol: "sFUEL", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.skalenetwork.com/v1/staging-attentive-steel-laika"],
    },
  },
  blockExplorers: {
    default: {
      name: "SKALE Explorer",
      url: "https://staging-attentive-steel-laika.explorer.skalenetwork.com",
    },
  },
});

// ============================================================
// Contract Addresses
// ============================================================
const ZERO = "0x0000000000000000000000000000000000000000" as const;

export const CONTRACTS = {
  pokerTable: (process.env.NEXT_PUBLIC_POKER_TABLE_ADDRESS ||
    ZERO) as `0x${string}`,
  faucet: (process.env.NEXT_PUBLIC_FAUCET_ADDRESS ||
    ZERO) as `0x${string}`,
};

/** True when real contract addresses are configured */
export function isContractReady(addr: `0x${string}`): boolean {
  return addr !== ZERO;
}

// ============================================================
// Wagmi + RainbowKit Config
// ============================================================
export const config = getDefaultConfig({
  appName: "Confidential Poker",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id",
  chains: [skaleChain],
  transports: {
    [skaleChain.id]: http(),
  },
  ssr: true,
});
