import "dotenv/config";

export interface Config {
  port: number;
  rpcUrl: string;
  chainId: number;
  privateKey: `0x${string}`;
  pokerTableAddress: `0x${string}`;
  mockSklAddress: `0x${string}`;
  axiosUsdAddress: `0x${string}`;
  apiKey: string;
  gasPrice: bigint;
}

function required(env: string | undefined, name: string): string {
  if (!env) {
    throw new Error(`${name} is required. Set it in .env or environment.`);
  }
  return env;
}

function optional(env: string | undefined, fallback: string): string {
  return env ?? fallback;
}

export const config: Config = {
  port: parseInt(optional(process.env.PORT, "3001"), 10),
  rpcUrl: optional(process.env.RPC_URL, "https://base-sepolia-testnet.skalenodes.com/v1/base-testnet"),
  chainId: parseInt(optional(process.env.CHAIN_ID, "324705682"), 10),
  privateKey: required(process.env.PRIVATE_KEY, "PRIVATE_KEY") as `0x${string}`,
  pokerTableAddress: required(process.env.POKER_TABLE_ADDRESS, "POKER_TABLE_ADDRESS") as `0x${string}`,
  mockSklAddress: required(process.env.MOCK_SKL_ADDRESS, "MOCK_SKL_ADDRESS") as `0x${string}`,
  axiosUsdAddress: required(process.env.AXIOS_USD_ADDRESS, "AXIOS_USD_ADDRESS") as `0x${string}`,
  apiKey: optional(process.env.API_KEY, "batshit-bot-3009"),
  gasPrice: BigInt(optional(process.env.GAS_PRICE, "100000")),
};
