import "./env";
import type { Address } from "viem";
import { DEPLOYMENT_CONFIG } from "@confidential-poker/config";

export const config = {
  privateKey: process.env.PRIVATE_KEY ?? "",
  llmProvider: process.env.LLM_PROVIDER ?? "anthropic",
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmModel: process.env.LLM_MODEL ?? "claude-sonnet-4-6",
  zaiPrivateKey: process.env.ZAI_PRIVATE_KEY ?? "",
  zaiModel: process.env.ZAI_MODEL ?? "glm-5.1",
  rpcUrl: DEPLOYMENT_CONFIG.rpcUrl,
  chainId: DEPLOYMENT_CONFIG.chainId,
  mockSklAddress: DEPLOYMENT_CONFIG.contracts.mockSkl as Address,
  factoryAddress: DEPLOYMENT_CONFIG.contracts.pokerFactory as Address,
  chipTokenAddress: DEPLOYMENT_CONFIG.contracts.chipToken as Address,
  memoryBackend: process.env.MEMORY_BACKEND ?? "memory",
  databaseUrl: process.env.DATABASE_URL ?? "",
  strategy: process.env.STRATEGY ?? "wolf",
  customPrompt: process.env.CUSTOM_PROMPT ?? "",
  logLevel: process.env.LOG_LEVEL ?? "info",
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 5000),
  idleBalanceCheckMs: Number(process.env.IDLE_BALANCE_CHECK_MS ?? 60000),
} as const;

// llmApiKey is required unless using zai with its own ZAI_PRIVATE_KEY
const usingZai = config.llmProvider.toLowerCase() === "zai";
if (!config.privateKey) {
  console.error("FATAL: Missing required env var: PRIVATE_KEY");
  process.exit(1);
}
if (!config.llmApiKey && !(usingZai && config.zaiPrivateKey)) {
  console.error("FATAL: Missing required env var: LLM_API_KEY (or ZAI_PRIVATE_KEY when provider is zai)");
  process.exit(1);
}

export type Config = typeof config;
