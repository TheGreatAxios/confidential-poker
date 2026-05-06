import "dotenv/config";
import type { Address } from "viem";

export const config = {
  privateKey: process.env.PRIVATE_KEY ?? "",
  llmProvider: process.env.LLM_PROVIDER ?? "anthropic",
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmModel: process.env.LLM_MODEL ?? "claude-sonnet-4-6",
  rpcUrl: process.env.RPC_URL ?? "https://base.skale.space",
  chainId: Number(process.env.CHAIN_ID ?? 2046399126),
  factoryAddress: (process.env.FACTORY_ADDRESS ?? "") as Address,
  chipTokenAddress: (process.env.CHIP_TOKEN_ADDRESS ?? "") as Address,
  memoryBackend: process.env.MEMORY_BACKEND ?? "memory",
  databaseUrl: process.env.DATABASE_URL ?? "",
  strategy: process.env.STRATEGY ?? "wolf",
  customPrompt: process.env.CUSTOM_PROMPT ?? "",
  logLevel: process.env.LOG_LEVEL ?? "info",
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 5000),
  idleBalanceCheckMs: Number(process.env.IDLE_BALANCE_CHECK_MS ?? 60000),
} as const;

const required = ["privateKey", "llmApiKey", "factoryAddress", "chipTokenAddress"] as const;
for (const key of required) {
  if (!config[key]) {
    console.error(`FATAL: Missing required env var: ${key}`);
    process.exit(1);
  }
}

export type Config = typeof config;
