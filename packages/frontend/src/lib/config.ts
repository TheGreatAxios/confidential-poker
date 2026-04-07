import { getAddress } from "viem";

function defineAddress(address: string): `0x${string}` {
  return getAddress(address);
}

export const FRONTEND_CONFIG = {
  pokerTableAddress: defineAddress("0x3592B30eb9b6E262F79F4536526878db162c507E"),
  tokenAddress: defineAddress("0x5360932BF964C4e5CFe369CDAFEA48933F725833"),
  chainId: 324705682,
  rpcUrl: "https://base-sepolia-testnet.skalenodes.com/v1/base-testnet",
  explorerUrl: "https://base-sepolia-testnet-explorer.skalenodes.com/",
  apiUrl: "",
  faucetUrl: "",
} as const;
