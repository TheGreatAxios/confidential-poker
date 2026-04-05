// ─── Viem Client Setup for Blockchain Interaction ─────────────────────────────

import { createPublicClient, createWalletClient, http, type PublicClient, type WalletClient } from 'viem';
import { CHAIN_CONFIG } from '../config.js';
import { sendEncryptedTx, getDecryptedTxData, isBiteActive, mockTxHash } from './bite.js';

/**
 * Create a viem public client for the configured SKALE chain.
 * Used for reading contract state and sending transactions.
 */

let publicClient: PublicClient | null = null;

export function getPublicClient(): PublicClient {
  if (!publicClient) {
    publicClient = createPublicClient({
      transport: http(CHAIN_CONFIG.rpcUrl),
      chain: {
        id: CHAIN_CONFIG.chainId,
        name: 'SKALE',
        nativeCurrency: {
          name: 'sFUEL',
          symbol: 'sFUEL',
          decimals: 18,
        },
        rpcUrls: {
          default: { http: [CHAIN_CONFIG.rpcUrl] },
        },
      },
    });
  }
  return publicClient;
}

/**
 * Create a wallet client (if a private key is available).
 * Used for sending on-chain transactions (tips, bets, etc.).
 */
export function getWalletClient(privateKey: `0x${string}`): WalletClient {
  // We use a minimal chain config — viem needs at least these fields
  return createWalletClient({
    transport: http(CHAIN_CONFIG.rpcUrl),
    account: privateKey,
    chain: {
      id: CHAIN_CONFIG.chainId,
      name: 'SKALE',
      nativeCurrency: {
        name: 'sFUEL',
        symbol: 'sFUEL',
        decimals: 18,
      },
      rpcUrls: {
        default: { http: [CHAIN_CONFIG.rpcUrl] },
      },
    },
  });
}

/**
 * Get the sFUEL balance for an address.
 * Returns the balance in sFUEL (formatted).
 */
export async function getBalance(address: `0x${string}`): Promise<string> {
  const client = getPublicClient();
  const balance = await client.getBalance({ address });
  // Format as sFUEL (18 decimals)
  const formatted = (Number(balance) / 1e18).toFixed(4);
  return formatted;
}

// ── Re-export BITE helpers for convenient access ──────────────────────────────

export { sendEncryptedTx, getDecryptedTxData, isBiteActive, mockTxHash };
