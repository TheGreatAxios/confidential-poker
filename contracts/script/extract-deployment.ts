#!/usr/bin/env bun
/**
 * Extract contract addresses from Foundry broadcast JSON
 * and update contracts/deployment.json.
 *
 * Usage:
 *   bun run contracts/script/extract-deployment.ts <chainId>
 *
 * Example:
 *   bun run contracts/script/extract-deployment.ts 324705682
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const CHAIN_ID = process.argv[2];
if (!CHAIN_ID) {
  console.error("Usage: bun run extract-deployment.ts <chainId>");
  console.error("Example: bun run extract-deployment.ts 324705682");
  process.exit(1);
}

const ROOT = join(import.meta.dirname, "../..");
const BROADCAST_DIR = join(ROOT, "contracts/broadcast/Deploy.s.sol", CHAIN_ID);
const BROADCAST_FILE = join(BROADCAST_DIR, "run-latest.json");
const DEPLOYMENT_FILE = join(ROOT, "contracts/deployment.json");

if (!existsSync(BROADCAST_FILE)) {
  console.error(`Broadcast file not found: ${BROADCAST_FILE}`);
  console.error("Run `forge script script/Deploy.s.sol --broadcast --rpc-url ...` first.");
  process.exit(1);
}

interface Tx {
  contractName?: string;
  contractAddress?: string;
  transactionType?: string;
}

interface Broadcast {
  transactions: Tx[];
}

const raw = readFileSync(BROADCAST_FILE, "utf8");
const broadcast = JSON.parse(raw) as Broadcast;

const addressMap: Record<string, string> = {};
for (const tx of broadcast.transactions) {
  if (tx.transactionType === "CREATE" && tx.contractName && tx.contractAddress) {
    const key = tx.contractName === "MockSKL" ? "mockSkl"
      : tx.contractName === "ChipToken" ? "chipToken"
      : tx.contractName === "PokerFactory" ? "pokerFactory"
      : tx.contractName;
    addressMap[key] = tx.contractAddress;
  }
}

let existing: Record<string, unknown> = {};
if (existsSync(DEPLOYMENT_FILE)) {
  existing = JSON.parse(readFileSync(DEPLOYMENT_FILE, "utf8"));
}

const merged = {
  ...existing,
  chainId: Number(CHAIN_ID),
  contracts: {
    ...(existing.contracts as Record<string, string> || {}),
    ...addressMap,
  },
};

writeFileSync(DEPLOYMENT_FILE, JSON.stringify(merged, null, 2) + "\n", "utf8");
console.log(`✓ Updated ${DEPLOYMENT_FILE}`);
for (const [key, addr] of Object.entries(addressMap)) {
  console.log(`  ${key}: ${addr}`);
}
