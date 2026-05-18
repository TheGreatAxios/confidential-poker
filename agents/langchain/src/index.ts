import "./env";
import { config } from "./config";
import { getKeyStore } from "./wallet/key-store";
import { createMemoryBackend } from "./memory/factory";
import { createSubmitActionCaller } from "./agent";
import { buildAgentGraph } from "./graph";
import { MIN_GAS } from "./tools/claim-faucet";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureGas(): Promise<void> {
  const ks = getKeyStore();
  const address = ks.getAddress();

  // Agent only needs enough credits for its own transaction gas.
  // The PokerFactory is pre-funded on deployment; table creation reserve
  // is handled by the contract, not the agent's wallet.
  const targetBalance = MIN_GAS;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const balance = await ks.getBalance(address);
      if (balance >= targetBalance) {
        console.log(`Credit balance OK: ${balance} (need ${targetBalance})`);
        return;
      }
      console.log(`Low credits: ${balance}. Need ${targetBalance}. Faucet attempt ${attempt}/3...`);

      const { claimSkaleGas } = await import("./tools/claim-skale-gas");
      const result = await claimSkaleGas.invoke({});
      const parsed = JSON.parse(result as string) as { success?: boolean; message?: string };
      console.log(`Faucet result: ${parsed.message ?? "unknown"}`);

      if (parsed.success) {
        await sleep(5000);
        const newBalance = await ks.getBalance(address);
        if (newBalance >= targetBalance) {
          console.log(`Credit balance OK after faucet: ${newBalance}`);
          return;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`Faucet attempt ${attempt}/3 failed: ${msg}`);
    }

    if (attempt < 3) {
      console.log("Retrying in 15s...");
      await sleep(15_000);
    }
  }

  console.warn("Faucet maxed out at 3 attempts. Proceeding — transactions may fail if credits are insufficient.");
}

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
  console.log(`sFUel Balance: ${balance.toString()}`);

  await ensureGas();

  const memoryBackend = await createMemoryBackend();
  console.log(`Memory backend initialized: ${config.memoryBackend}`);

  const { setLogActionBackend } = await import("./tools/log-action");
  setLogActionBackend(memoryBackend);

  const submitActionCaller = createSubmitActionCaller();
  const graph = buildAgentGraph(memoryBackend, submitActionCaller);

  const threadId = `agent:${ks.getAddress().toLowerCase()}`;
  let running = true;

  process.on("SIGINT", () => {
    console.log("\nReceived SIGINT, shutting down...");
    running = false;
  });

  process.on("SIGTERM", () => {
    console.log("\nReceived SIGTERM, shutting down...");
    running = false;
  });

  while (running) {
    try {
      const result = await graph.invoke(
        {},
        { configurable: { thread_id: threadId } },
      ) as { isMyTurn?: boolean; tableAddress?: string | null };

      if (!result.isMyTurn) {
        await sleep(1000);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("Graph invocation error:", errMsg);
      const fatalPatterns = ["private key", "Missing required", "FATAL"];
      if (fatalPatterns.some((p) => errMsg.includes(p))) {
        console.error("Fatal error, exiting");
        process.exit(1);
      }
      await sleep(2000);
    }
  }

  console.log("Agent loop terminated gracefully");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
