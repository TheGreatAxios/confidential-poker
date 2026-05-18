#!/usr/bin/env bun
/**
 * Sync deployment config and ABIs from contracts/ into shared packages.
 *
 * Usage:
 *   bun run packages/config/scripts/sync.ts
 *
 * Reads:
 *   - contracts/deployment.json  (addresses, chainId, rpcUrl)
 *   - contracts/out/<Name>.sol/<Name>.json  (compiled ABIs)
 *
 * Writes:
 *   - packages/config/src/index.ts
 *   - packages/abis/src/*.ts
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "../../..");
const CONTRACTS_OUT = join(ROOT, "contracts/out");
const DEPLOYMENT_JSON = join(ROOT, "contracts/deployment.json");
const CONFIG_PKG = join(ROOT, "packages/config/src/index.ts");
const ABIS_PKG = join(ROOT, "packages/abis/src");

interface Deployment {
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
  contracts: Record<string, string>;
}

function loadDeployment(): Deployment {
  const raw = readFileSync(DEPLOYMENT_JSON, "utf8");
  return JSON.parse(raw) as Deployment;
}

function toPascalCase(kebab: string): string {
  return kebab
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function generateConfig(deployment: Deployment): string {
  const entries = Object.entries(deployment.contracts)
    .map(([key, addr]) => `    ${key}: "${addr}"`)
    .join(",\n");

  return `import type { Chain } from "viem";

export const DEPLOYMENT_CONFIG = {
  chainId: ${deployment.chainId},
  rpcUrl: "${deployment.rpcUrl}",
  explorerUrl: "${deployment.explorerUrl}",
  contracts: {
${entries}
  },
} as const;

export const SKALE_CHAIN: Chain = {
  id: DEPLOYMENT_CONFIG.chainId,
  name: "SKALE",
  nativeCurrency: { name: "sFUel", symbol: "sFUel", decimals: 18 },
  rpcUrls: { default: { http: [DEPLOYMENT_CONFIG.rpcUrl] } },
};
`;
}

function extractAbi(contractName: string): unknown[] | null {
  const solDir = join(CONTRACTS_OUT, `${contractName}.sol`);
  if (!existsSync(solDir)) {
    console.warn(`  ⚠ contracts/out/${contractName}.sol not found, skipping ABI`);
    return null;
  }

  const jsonFile = join(solDir, `${contractName}.json`);
  if (!existsSync(jsonFile)) {
    console.warn(`  ⚠ ${jsonFile} not found, skipping ABI`);
    return null;
  }

  const raw = readFileSync(jsonFile, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed.abi)) {
    console.warn(`  ⚠ ${jsonFile} missing abi array`);
    return null;
  }

  return parsed.abi;
}

function abiToTs(abi: unknown[], exportName: string): string {
  return `export const ${exportName} = ${JSON.stringify(abi, null, 2)} as const;\n`;
}

const ABI_MAP: Array<{ contract: string; export: string; file: string }> = [
  { contract: "PokerGame", export: "POKER_GAME_ABI", file: "poker-game" },
  { contract: "PokerFactory", export: "POKER_FACTORY_ABI", file: "poker-factory" },
  { contract: "ChipToken", export: "CHIP_TOKEN_ABI", file: "chip-token" },
  { contract: "MockSKL", export: "MOCK_SKL_ABI", file: "mock-skl" },
];

// ERC20 is a special case — we use a minimal inline ABI
const ERC20_ABI = [
  { type: "function", name: "balanceOf", inputs: [{ name: "", type: "address", internalType: "address" }], outputs: [{ name: "", type: "uint256", internalType: "uint256" }], stateMutability: "view" },
  { type: "function", name: "approve", inputs: [{ name: "spender", type: "address", internalType: "address" }, { name: "amount", type: "uint256", internalType: "uint256" }], outputs: [{ name: "", type: "bool", internalType: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "allowance", inputs: [{ name: "owner", type: "address", internalType: "address" }, { name: "spender", type: "address", internalType: "address" }], outputs: [{ name: "", type: "uint256", internalType: "uint256" }], stateMutability: "view" },
  { type: "function", name: "transfer", inputs: [{ name: "to", type: "address", internalType: "address" }, { name: "amount", type: "uint256", internalType: "uint256" }], outputs: [{ name: "", type: "bool", internalType: "bool" }], stateMutability: "nonpayable" },
  { type: "function", name: "transferFrom", inputs: [{ name: "from", type: "address", internalType: "address" }, { name: "to", type: "address", internalType: "address" }, { name: "amount", type: "uint256", internalType: "uint256" }], outputs: [{ name: "", type: "bool", internalType: "bool" }], stateMutability: "nonpayable" },
  { type: "event", name: "Transfer", inputs: [{ name: "from", type: "address", indexed: true, internalType: "address" }, { name: "to", type: "address", indexed: true, internalType: "address" }, { name: "value", type: "uint256", indexed: false, internalType: "uint256" }], anonymous: false },
  { type: "event", name: "Approval", inputs: [{ name: "owner", type: "address", indexed: true, internalType: "address" }, { name: "spender", type: "address", indexed: true, internalType: "address" }, { name: "value", type: "uint256", indexed: false, internalType: "uint256" }], anonymous: false },
];

function run() {
  console.log("🔁 Syncing deployment config and ABIs from contracts/...\n");

  // 1. Config
  const deployment = loadDeployment();
  console.log(`  → Read ${DEPLOYMENT_JSON}`);
  console.log(`     chainId=${deployment.chainId}, contracts=${Object.keys(deployment.contracts).length}`);

  const configTs = generateConfig(deployment);
  writeFileSync(CONFIG_PKG, configTs, "utf8");
  console.log(`  ✓ Wrote ${CONFIG_PKG}\n`);

  // 2. ABIs
  const abiExports: string[] = [];

  for (const { contract, export: exportName, file } of ABI_MAP) {
    const abi = extractAbi(contract);
    if (!abi) continue;

    const ts = abiToTs(abi, exportName);
    const outPath = join(ABIS_PKG, `${file}.ts`);
    writeFileSync(outPath, ts, "utf8");
    console.log(`  ✓ Wrote ${outPath} (${abi.length} entries)`);
    abiExports.push(`export { ${exportName} } from "./${file}.js";`);
  }

  // ERC20
  const erc20Path = join(ABIS_PKG, "erc20.ts");
  writeFileSync(erc20Path, abiToTs(ERC20_ABI, "ERC20_ABI"), "utf8");
  console.log(`  ✓ Wrote ${erc20Path} (${ERC20_ABI.length} entries)`);
  abiExports.push(`export { ERC20_ABI } from "./erc20.js";`);

  // Index
  const indexPath = join(ABIS_PKG, "index.ts");
  writeFileSync(indexPath, abiExports.join("\n") + "\n", "utf8");
  console.log(`  ✓ Wrote ${indexPath}\n`);

  console.log("🎉 Sync complete. Run typecheck in affected packages to verify.");
  console.log("");
  console.log("   cd packages/config && bun run typecheck");
  console.log("   cd packages/abis && bun run typecheck");
}

run();
