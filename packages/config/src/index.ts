import type { Chain } from "viem";

export const DEPLOYMENT_CONFIG = {
  chainId: 324705682,
  rpcUrl: "https://base-sepolia-testnet.skalenodes.com/v1/base-testnet",
  explorerUrl: "https://base-sepolia-testnet-explorer.skalenodes.com/",
  contracts: {
    mockSkl: "0x5d8331b22604fafc4cc1c42c5203e96dcc82644b",
    chipToken: "0x0389277b52231a69f5207dae822eaa1d005182dc",
    pokerFactory: "0xd43e49caaf9278d6855bedeeee22506567b639cc"
  },
} as const;

export const SKALE_CHAIN: Chain = {
  id: DEPLOYMENT_CONFIG.chainId,
  name: "SKALE",
  nativeCurrency: { name: "sFUel", symbol: "sFUel", decimals: 18 },
  rpcUrls: { default: { http: [DEPLOYMENT_CONFIG.rpcUrl] } },
};
