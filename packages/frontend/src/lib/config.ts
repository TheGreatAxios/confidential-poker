import { getAddress } from "viem";

function defineAddress(address: string): `0x${string}` {
  return getAddress(address);
}

export const FRONTEND_CONFIG = {
  factoryAddress: defineAddress(import.meta.env.VITE_POKER_FACTORY_ADDRESS ?? "0xeb294cDa6AC79F2ca65e5B85cf50805F278efD4D"),
  chipTokenAddress: defineAddress(import.meta.env.VITE_CHIP_TOKEN_ADDRESS ?? "0x5Fe81f5437b754cb747E2d32b8Fb4fa34D6607B3"),
  underlyingTokenAddress: defineAddress(import.meta.env.VITE_UNDERLYING_TOKEN_ADDRESS ?? "0x278320F5E1a3ABA7Fdcc98f90132ed02075C4eCc"),
  chainId: 324705682,
  rpcUrl: "https://base-sepolia-testnet.skalenodes.com/v1/base-testnet",
  explorerUrl: "https://base-sepolia-testnet-explorer.skalenodes.com/",

} as const;
