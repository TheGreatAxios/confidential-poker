import { getAddress } from "viem";

function defineAddress(address: string): `0x${string}` {
  return getAddress(address);
}

export const FRONTEND_CONFIG = {
  pokerTableAddress: defineAddress("0xFcD02AD6B0A4A25a61779ED4fD9b5C71e0F03834"),
  tokenAddress: defineAddress("0x4a5A4CE7270C4a35f67427eA85641eB83f316725"),
  chainId: 324705682,
  rpcUrl: "https://base-sepolia-testnet.skalenodes.com/v1/base-testnet",
  explorerUrl: "https://base-sepolia-testnet-explorer.skalenodes.com/",
  apiUrl: "",
  faucetUrl: "",
} as const;
