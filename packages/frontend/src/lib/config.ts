import { getAddress } from "viem";
import { DEPLOYMENT_CONFIG } from "@/lib/deployment";

function defineAddress(address: string): `0x${string}` {
  return getAddress(address);
}

export const FRONTEND_CONFIG = {
  factoryAddress: defineAddress(DEPLOYMENT_CONFIG.contracts.pokerFactory),
  chipTokenAddress: defineAddress(DEPLOYMENT_CONFIG.contracts.chipToken),
  underlyingTokenAddress: defineAddress(DEPLOYMENT_CONFIG.contracts.mockSkl),
  chainId: DEPLOYMENT_CONFIG.chainId,
  rpcUrl: DEPLOYMENT_CONFIG.rpcUrl,
  explorerUrl: DEPLOYMENT_CONFIG.explorerUrl,

} as const;
