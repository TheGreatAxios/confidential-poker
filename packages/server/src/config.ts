// ─── Configuration Constants ───────────────────────────────────────────────────

export const PORT = Number(process.env.PORT ?? 3001);

export const STARTING_CHIPS = 10_000;
export const SMALL_BLIND = 50;
export const BIG_BLIND = 100;
export const MAX_PLAYERS = 7; // 6 AI + 1 human

/** Milliseconds the orchestrator waits between AI actions (public-facing pace) */
export const AI_ACTION_DELAY_MS = 800;

/** How long before a waiting human player gets auto-folded */
export const HUMAN_TURN_TIMEOUT_MS = 30_000;

/** sFUEL drip amount when someone hits the faucet */
export const FAUCET_DRIP_AMOUNT = 100_000;

/** Minimum tip amount in sFUEL */
export const MIN_TIP_AMOUNT = 1;

/** Default SKALE chain config (overridable via env) */
export const CHAIN_CONFIG = {
  rpcUrl: process.env.RPC_URL ?? 'https://eth-ddc-testnet.skalenetwork.com',
  chainId: Number(process.env.CHAIN_ID ?? 0xa5d4c),
} as const;

/** BITE Protocol encryption settings */
export const BITE_ENABLED = process.env.BITE_ENABLED !== 'false'; // default true
export const BITE_GAS_LIMIT = Number(process.env.BITE_GAS_LIMIT ?? 300_000);

/** Private key for on-chain transactions (optional — falls back to mock if absent) */
export const PRIVATE_KEY = (process.env.PRIVATE_KEY ?? '') as `0x${string}`;

/** x402 Payment configuration */
export const PAY_TO_ADDRESS = (process.env.PAY_TO_ADDRESS ?? '0x0000000000000000000000000000000000000000') as `0x${string}`;

/** x402 Payment token — Bridged USDC on SKALE Base Sepolia */
export const X402_PAYMENT_TOKEN = '0x2e08028E3C4c2356572E096d8EF835cD5C6030bD' as const;

/** x402 Facilitator URL */
export const X402_FACILITATOR_URL = 'https://facilitator.payai.network';

/** x402 Network ID for SKALE Base Sepolia */
export const X402_NETWORK_ID = 'eip155:324705682' as const;

/** Game phases in order */
export const PHASES = [
  'waiting',
  'dealing',
  'preflop',
  'flop',
  'turn',
  'river',
  'showdown',
] as const;

export type GamePhase = (typeof PHASES)[number];
