import "dotenv/config";

export interface Config {
  port: number;
  rpcUrl: string;
  chainId: number;
  privateKey: `0x${string}`;
  mockSklAddress: `0x${string}`;
  axiosUsdAddress: `0x${string}`;
  pokerGameAddress: `0x${string}`;
  x402FacilitatorUrl: string;
  x402Network: string;
  x402TokenAddress: `0x${string}`;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function required(env: string | undefined, name: string): string {
  if (!env || env === ZERO_ADDRESS) {
    console.warn(`⚠️  ${name} is not configured. Some features will be unavailable.`);
    return ZERO_ADDRESS as `0x${string}`;
  }
  return env;
}

function optional(env: string | undefined, fallback: string): string {
  return env ?? fallback;
}

export const config: Config = {
  port: parseInt(optional(process.env.PORT, "3001"), 10),
  rpcUrl: optional(process.env.RPC_URL, "https://base-sepolia-testnet.skalenodes.com/v1/jubilant-horrible-ancha"),
  chainId: parseInt(optional(process.env.CHAIN_ID, "324705682"), 10),
  privateKey: (process.env.PRIVATE_KEY ?? "0x0000000000000000000000000000000000000000000000000000000000000001") as `0x${string}`,
  mockSklAddress: required(process.env.MOCK_SKL_ADDRESS, "MOCK_SKL_ADDRESS") as `0x${string}`,
  axiosUsdAddress: required(process.env.AXIOS_USD_ADDRESS, "AXIOS_USD_ADDRESS") as `0x${string}`,
  pokerGameAddress: required(process.env.POKER_GAME_ADDRESS, "POKER_GAME_ADDRESS") as `0x${string}`,
  x402FacilitatorUrl: optional(process.env.X402_FACILITATOR_URL, "https://facilitator.payai.network"),
  x402Network: optional(process.env.X402_NETWORK, "eip155:324705682"),
  x402TokenAddress: (process.env.X402_TOKEN_ADDRESS ?? "0x61a26022927096f444994dA1e53F0FD9487EAfcf") as `0x${string}`,
};
