import { getAddress } from "viem";

function defineAddress(address: string): `0x${string}` {
  return getAddress(address);
}

export const FRONTEND_CONFIG = {
  pokerTableAddress: defineAddress("0x36923F1c58a7a4640F1918dac2F5CE732Cd0ea46"),
  tokenAddress: defineAddress("0x81421011c20d270551351780CaB4A7344F2c3329"),
  chainId: 324705682,
  rpcUrl: "https://base-sepolia-testnet.skalenodes.com/v1/base-testnet",
  explorerUrl: "https://base-sepolia-testnet-explorer.skalenodes.com/",
  apiUrl: "",
  faucetUrl: "",
} as const;
