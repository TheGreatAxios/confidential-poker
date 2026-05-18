#!/usr/bin/env bun
/**
 * Deploy contracts, extract addresses, and sync shared packages.
 *
 * Usage:
 *   bun run scripts/deploy-and-sync.ts [chainId] [rpcUrl] [extra forge args...]
 *
 * Examples:
 *   bun run scripts/deploy-and-sync.ts
 *   bun run scripts/deploy-and-sync.ts 324705682 https://base-sepolia-testnet.skalenodes.com/v1/base-testnet
 *   bun run scripts/deploy-and-sync.ts -- --legacy --slow --account bite-deployer
 *
 * Pipeline:
 *   1. forge script script/Deploy.s.sol --broadcast --rpc-url <rpcUrl> [<extra forge args>]
 *   2. Extract addresses from broadcast/<chainId>/run-latest.json
 *   3. Sync ABIs + config to packages/
 */

import { spawn } from "child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..");
const CONTRACTS_DIR = join(ROOT, "contracts");
const DEPLOYMENT_JSON = join(CONTRACTS_DIR, "deployment.json");
const BROADCAST_DIR = join(CONTRACTS_DIR, "broadcast/Deploy.s.sol");

function readDeployment(): { chainId?: number; rpcUrl?: string } {
  if (!existsSync(DEPLOYMENT_JSON)) return {};
  const raw = readFileSync(DEPLOYMENT_JSON, "utf8");
  return JSON.parse(raw) as { chainId?: number; rpcUrl?: string };
}

function run(cmd: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n▶ ${cmd} ${args.join(" ")}\n`);
    const proc = spawn(cmd, args, { cwd, stdio: "inherit" });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command exited with code ${code}`));
    });
    proc.on("error", reject);
  });
}

function findLatestChainId(): string | null {
  if (!existsSync(BROADCAST_DIR)) return null;
  const dirs = readdirSync(BROADCAST_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let latest: { chainId: string; mtime: number } | null = null;
  for (const chainId of dirs) {
    const runFile = join(BROADCAST_DIR, chainId, "run-latest.json");
    if (!existsSync(runFile)) continue;
    const mtime = statSync(runFile).mtimeMs;
    if (!latest || mtime > latest.mtime) {
      latest = { chainId, mtime };
    }
  }
  return latest?.chainId ?? null;
}

function isNumeric(str: string): boolean {
  return /^\d+$/.test(str);
}

function looksLikeUrl(str: string): boolean {
  return str.startsWith("http://") || str.startsWith("https://") || str.startsWith("ws://") || str.startsWith("wss://");
}

function parseArgs(): { chainId: string; rpcUrl: string; extraForgeArgs: string[] } {
  const args = process.argv.slice(2);
  const deployment = readDeployment();

  let chainId = String(deployment.chainId ?? "");
  let rpcUrl = deployment.rpcUrl ?? process.env.RPC_URL ?? "";
  let extraForgeArgs: string[] = [];

  // No args at all
  if (args.length === 0) {
    return { chainId, rpcUrl, extraForgeArgs };
  }

  // First arg is numeric → chainId, second looks like URL → rpcUrl, rest → forge
  if (isNumeric(args[0])) {
    chainId = args[0];
    if (args.length > 1 && looksLikeUrl(args[1])) {
      rpcUrl = args[1];
      extraForgeArgs = args.slice(2);
    } else {
      extraForgeArgs = args.slice(1);
    }
    return { chainId, rpcUrl, extraForgeArgs };
  }

  // First arg starts with "--" → everything is forge args, use deployment defaults
  if (args[0].startsWith("--")) {
    extraForgeArgs = args;
    return { chainId, rpcUrl, extraForgeArgs };
  }

  // Fallback: first arg as chainId, second as rpcUrl, rest as forge
  chainId = args[0];
  if (args.length > 1) {
    rpcUrl = args[1];
    extraForgeArgs = args.slice(2);
  }
  return { chainId, rpcUrl, extraForgeArgs };
}

async function main() {
  const { chainId, rpcUrl, extraForgeArgs } = parseArgs();

  if (!chainId) {
    console.error("FATAL: No chainId. Provide as arg or set in contracts/deployment.json");
    process.exit(1);
  }
  if (!rpcUrl) {
    console.error("FATAL: No RPC_URL. Provide as arg, set in deployment.json, or export RPC_URL=");
    process.exit(1);
  }

  console.log("🔧 Deploy pipeline");
  console.log(`   chainId: ${chainId}`);
  console.log(`   rpcUrl:  ${rpcUrl}`);
  if (extraForgeArgs.length > 0) {
    console.log(`   extra:   ${extraForgeArgs.join(" ")}`);
  }
  console.log("");

  // Step 1: Deploy
  const forgeArgs = [
    "script",
    "script/Deploy.s.sol",
    "--broadcast",
    "--rpc-url", rpcUrl,
    ...extraForgeArgs,
  ];
  await run("forge", forgeArgs, CONTRACTS_DIR);

  // Step 2: Detect chainId from broadcast if not provided
  const detectedChainId = findLatestChainId();
  const extractChainId = detectedChainId ?? chainId;

  console.log(`\n📡 Extracting deployment from broadcast/${extractChainId}/run-latest.json...`);

  // Step 3: Extract
  await run("bun", [
    "run",
    join(ROOT, "contracts/script/extract-deployment.ts"),
    extractChainId,
  ], ROOT);

  // Step 4: Build ABIs
  console.log("\n🔨 Building contract artifacts...");
  await run("forge", ["build"], CONTRACTS_DIR);

  // Step 5: Sync packages
  console.log("\n📦 Syncing shared packages...");
  await run("bun", [
    "run",
    join(ROOT, "packages/config/scripts/sync.ts"),
  ], ROOT);

  console.log("\n✅ Deploy pipeline complete.");
  console.log("");
  console.log("   Shared packages updated:");
  console.log("     packages/config/src/index.ts  (addresses + chain config)");
  console.log("     packages/abis/src/*.ts         (contract ABIs)");
  console.log("");
  console.log("   Affected consumers:");
  console.log("     apps/web/      (frontend)");
  console.log("     agents/langchain/ (agent)");
}

main().catch((err) => {
  console.error("\n❌ Deploy pipeline failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
