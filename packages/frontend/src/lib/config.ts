import { getAddress } from "viem";

function defineAddress(address: string): `0x${string}` {
  return getAddress(address);
}

export const FRONTEND_CONFIG = {
  pokerTableAddress: defineAddress("0xbbEc6d68EA0bEbd730266aB59F85e59fC1C06C1c"),
  tokenAddress: defineAddress("0x4EEE7185154Aa14Db16278B400f62705c03499AF"),
  chainId: 324705682,
  rpcUrl: "https://base-sepolia-testnet.skalenodes.com/v1/base-testnet",
  explorerUrl: "https://base-sepolia-testnet-explorer.skalenodes.com/",
  apiUrl: "",
  faucetUrl: "",
} as const;
