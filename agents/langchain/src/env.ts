import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";

const ROOT = join(dirname(import.meta.dir), "../..");
const LOCAL = dirname(import.meta.dir);

function parseEnvFile(path: string): Record<string, string> | null {
  if (!existsSync(path)) return null;

  const content = readFileSync(path, "utf8");
  const result: Record<string, string> = {};

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // Skip empty values so they don't overwrite valid ones in other files
    if (!value) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

function loadEnv() {
  // 1. Load shared defaults from root .env
  const rootBasePath = join(ROOT, ".env");
  const rootBase = parseEnvFile(rootBasePath) ?? {};
  console.log(`[env] ${rootBasePath}: ${Object.keys(rootBase).length} keys`);

  // 2. Load local defaults from agents/langchain/.env
  const localBasePath = join(LOCAL, ".env");
  const localBase = parseEnvFile(localBasePath) ?? {};
  console.log(`[env] ${localBasePath}: ${Object.keys(localBase).length} keys`);

  // 3. Detect strategy from shell, local base, root base, or default
  const strategy = process.env.STRATEGY ?? localBase.STRATEGY ?? rootBase.STRATEGY ?? "wolf";
  console.log(`[env] strategy=${strategy}`);

  // 4. Load strategy-specific overrides
  const rootOverridePath = join(ROOT, `.env.${strategy}`);
  const rootOverride = parseEnvFile(rootOverridePath) ?? {};
  console.log(`[env] ${rootOverridePath}: ${Object.keys(rootOverride).length} keys`);

  const localOverridePath = join(LOCAL, `.env.${strategy}`);
  const localOverride = parseEnvFile(localOverridePath) ?? {};
  console.log(`[env] ${localOverridePath}: ${Object.keys(localOverride).length} keys`);

  // 5. Merge: shell > local strategy > root strategy > local base > root base
  const merged = { ...rootBase, ...localBase, ...rootOverride, ...localOverride };

  // 6. Apply to process.env only if not already set by shell
  // Empty strings count as "not set" so .env files can fill them
  for (const [key, value] of Object.entries(merged)) {
    const current = process.env[key];
    if (current === undefined || current === "") {
      process.env[key] = value;
    }
  }

  const hasPk = Boolean(process.env.PRIVATE_KEY);
  console.log(`[env] PRIVATE_KEY loaded: ${hasPk}`);
}

loadEnv();
