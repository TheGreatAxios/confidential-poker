#!/usr/bin/env bun
/**
 * Generate N agent wallets and write them to .env.<strategy> files.
 *
 * Usage:
 *   bun run scripts/gen-wallets.ts <count>
 *   bun run scripts/gen-wallets.ts 6 --force
 *
 * Default behavior:
 *   - Generates wallets
 *   - Creates .env.<strategy> for each
 *   - Skips existing .env.<strategy> files that already have PRIVATE_KEY
 *
 * --force:
 *   - Overwrites existing .env.<strategy> files (destructive, logs warning)
 */

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const STRATEGIES = ["wolf", "shark", "fox", "owl", "bull", "cat"] as const;

const count = Number(process.argv[2] ?? 1);
const force = process.argv.includes("--force");

function hasPrivateKey(envPath: string): boolean {
  if (!existsSync(envPath)) return false;
  const content = readFileSync(envPath, "utf8");
  return /^PRIVATE_KEY=/m.test(content);
}

function generateWallet(index: number) {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return {
    index,
    strategy: STRATEGIES[index % STRATEGIES.length],
    privateKey,
    address: account.address,
    publicKey: account.publicKey,
  };
}

function main() {
  console.log(`Generating ${count} agent wallet(s)...\n`);

  const wallets = Array.from({ length: count }, (_, i) => generateWallet(i));

  console.log("┌───────┬──────────┬──────────────────────────────────────────┬──────────────────────────────────────────────┐");
  console.log("│ Index │ Strategy │ Address                                  │ Private Key                                  │");
  console.log("├───────┼──────────┼──────────────────────────────────────────┼──────────────────────────────────────────────┤");
  for (const w of wallets) {
    console.log(`│ ${String(w.index).padStart(5)} │ ${w.strategy.padStart(8)} │ ${w.address} │ ${w.privateKey} │`);
  }
  console.log("└───────┴──────────┴──────────────────────────────────────────┴──────────────────────────────────────────────┘");

  const baseEnvPath = join(import.meta.dir, "../.env");
  const baseExists = existsSync(baseEnvPath);

  const written: string[] = [];
  const skipped: string[] = [];
  const overwritten: string[] = [];

  for (const w of wallets) {
    const envPath = join(import.meta.dir, `../.env.${w.strategy}`);
    const alreadyHasKey = hasPrivateKey(envPath);

    if (alreadyHasKey && !force) {
      skipped.push(envPath);
      continue;
    }

    let content = "";
    if (baseExists) {
      content = readFileSync(baseEnvPath, "utf8");
    }

    const lines = content.split("\n");
    const filtered = lines.filter(
      (line) => !line.startsWith("PRIVATE_KEY=") && !line.startsWith("STRATEGY="),
    );
    filtered.push(`PRIVATE_KEY=${w.privateKey}`);
    filtered.push(`STRATEGY=${w.strategy}`);

    writeFileSync(envPath, filtered.join("\n") + "\n", "utf8");

    if (alreadyHasKey && force) {
      overwritten.push(envPath);
    } else {
      written.push(envPath);
    }
  }

  if (written.length > 0) {
    console.log("\n  Created:");
    for (const p of written) console.log(`    ✓ ${p}`);
  }
  if (skipped.length > 0) {
    console.log("\n  Skipped (already has PRIVATE_KEY — use --force to overwrite):");
    for (const p of skipped) console.log(`    ⊘ ${p}`);
  }
  if (overwritten.length > 0) {
    console.log("\n  Overwritten (--force):");
    for (const p of overwritten) console.log(`    ⚠ ${p}`);
  }

  console.log("\n  To start agents:");
  for (const w of wallets) {
    console.log(`    bun run agent:langchain:${w.strategy}`);
  }
}

main();
