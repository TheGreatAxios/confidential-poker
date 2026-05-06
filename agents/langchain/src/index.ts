import "dotenv/config";
import { config } from "./config";
import { getKeyStore } from "./wallet/key-store";
import { createMemoryBackend } from "./memory/factory";
import { runGameLoop } from "./loop/game-loop";

async function main() {
  console.log("=== Confidential Poker — AI Agent ===");
  console.log(`Strategy: ${config.strategy}`);
  console.log(`LLM Provider: ${config.llmProvider}`);
  console.log(`LLM Model: ${config.llmModel}`);
  console.log(`Memory Backend: ${config.memoryBackend}`);
  console.log(`RPC URL: ${config.rpcUrl}`);
  console.log(`Chain ID: ${config.chainId}`);

  const ks = getKeyStore();
  console.log(`Agent Address: ${ks.getAddress()}`);

  const balance = await ks.getBalance(ks.getAddress());
  console.log(`sFUEL Balance: ${balance.toString()}`);

  const memoryBackend = await createMemoryBackend();
  console.log(`Memory backend initialized: ${config.memoryBackend}`);

  process.on("SIGINT", () => {
    console.log("\nReceived SIGINT, shutting down...");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.log("\nReceived SIGTERM, shutting down...");
    process.exit(0);
  });

  await runGameLoop();
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
