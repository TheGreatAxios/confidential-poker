import type { Chain } from "viem";

export const DEPLOYMENT_CONFIG = {
  chainId: 324705682,
  rpcUrl: "https://base-sepolia-testnet.skalenodes.com/v1/base-testnet",
  explorerUrl: "https://base-sepolia-testnet-explorer.skalenodes.com/",
  contracts: {
    mockSkl: "0x72d39a1f7a3870961e2fbdfc1ccc1a34bc92e22f",
    chipToken: "0x9a796aed889eff4869934966d9621a36b8bd586d",
    pokerFactory: "0xdf9837159ffaf47baf86f3cb6e92a430ec1e9929"
  },
} as const;

export const SKALE_CHAIN: Chain = {
  id: DEPLOYMENT_CONFIG.chainId,
  name: "SKALE",
  nativeCurrency: { name: "sFUel", symbol: "sFUel", decimals: 18 },
  rpcUrls: { default: { http: [DEPLOYMENT_CONFIG.rpcUrl] } },
};
