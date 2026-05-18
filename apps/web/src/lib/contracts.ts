import { FRONTEND_CONFIG } from "@/lib/config";

export {
  POKER_GAME_ABI,
  POKER_FACTORY_ABI,
  CHIP_TOKEN_ABI,
  ERC20_ABI,
} from "@confidential-poker/abis";

export const POKER_FACTORY_ADDRESS = FRONTEND_CONFIG.factoryAddress;

export const CHIP_TOKEN_ADDRESS = FRONTEND_CONFIG.chipTokenAddress;

export const TOKEN_ADDRESS = FRONTEND_CONFIG.underlyingTokenAddress;

export const BUY_IN = 1_000_000_000_000_000_000_000n;

export function isContractDeployed(address: string): boolean {
  return (
    address !== "0x0000000000000000000000000000000000000000" &&
    address.length === 42
  );
}
