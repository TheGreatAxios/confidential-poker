import { getAddress } from "viem";

function defineAddress(address: string): `0x${string}` {
  return getAddress(address);
}

export const FRONTEND_CONFIG = {
  pokerTableAddress: defineAddress("0x76D28c7f91DcDbF00816E35B9A6FC47e101Afe97"),
  tokenAddress: defineAddress("0x2195cf130F5133FF020aF9403761878f53385Bc4"),
  chainId: 324705682,
  rpcUrl: "https://base-sepolia-testnet.skalenodes.com/v1/base-testnet",
  explorerUrl: "https://base-sepolia-testnet-explorer.skalenodes.com/",
  apiUrl: "",
  faucetUrl: "",
} as const;
