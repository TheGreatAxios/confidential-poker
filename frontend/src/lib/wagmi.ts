"use client";

import { http, createConfig } from "wagmi";
import { defineChain } from "viem";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

// ============================================================
// SKALE Chain Definition — Base Sepolia Testnet
// ============================================================
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://base-sepolia-testnet.skalenodes.com/v1/base-testnet";

export const skaleChain = defineChain({
  id: 324705682,
  name: "SKALE Base Sepolia",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: "SKALE Explorer",
      url: "https://base-sepolia-testnet-explorer.skalenodes.com",
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
    [skaleChain.id]: http(RPC_URL),
  },
  ssr: true,
});
