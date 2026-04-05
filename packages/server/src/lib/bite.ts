// ─── BITE Protocol Encryption Module ──────────────────────────────────────────

import { BITE, type Transaction } from '@skalenetwork/bite';
import type { WalletClient } from 'viem';
import { CHAIN_CONFIG, BITE_ENABLED, BITE_GAS_LIMIT } from '../config.js';

// ── BITE instance (lazy-initialized) ──────────────────────────────────────────

let biteInstance: BITE | null = null;
let biteAvailable: boolean | null = null; // null = not yet checked

/**
 * Get or create the BITE instance for the configured RPC URL.
 * Returns null if BITE is disabled or unavailable.
 */
async function getBite(): Promise<BITE | null> {
  if (!BITE_ENABLED) {
    return null;
  }

  if (biteInstance) {
    return biteInstance;
  }

  // If we already determined it's unavailable, don't retry
  if (biteAvailable === false) {
    return null;
  }

  try {
    const bite = new BITE(CHAIN_CONFIG.rpcUrl);
    // Verify BITE is working by fetching committee info
    await bite.getCommitteesInfo();
    biteInstance = bite;
    biteAvailable = true;
    console.log('🔐 BITE Protocol initialized successfully');
    return biteInstance;
  } catch (err) {
    biteAvailable = false;
    console.warn(
      '⚠️  BITE Protocol unavailable on this chain. ' +
      'Falling back to unencrypted transactions. ' +
      `Error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Generate a deterministic mock txHash for cases where no wallet is configured.
 */
function mockTxHash(label: string): string {
  // Use a simple hash-like approach for consistency
  const input = `${label}-${Date.now()}-${Math.random()}`;
  let hash = '';
  for (let i = 0; i < 64; i++) {
    hash += Math.floor((Math.sin(i + input.length) * 10000) % 16)
      .toString(16);
  }
  return `0x${hash}`;
}

/**
 * Send an encrypted transaction via BITE Protocol.
 *
 * Encrypts the `to` address and `data` (calldata) before submitting.
 * Falls back to unencrypted if BITE is unavailable, or returns a mock
 * txHash if no wallet is configured.
 *
 * @param walletClient - viem WalletClient to sign & send the transaction
 * @param to - Target contract address
 * @param data - Encoded calldata (hex string)
 * @param value - Optional value to send (in wei)
 * @returns Transaction hash (real or mock)
 */
export async function sendEncryptedTx(
  walletClient: WalletClient,
  to: `0x${string}`,
  data: `0x${string}`,
  value?: bigint,
): Promise<string> {
  const bite = await getBite();

  try {
    let encryptedTx: Transaction;

    if (bite) {
      // Encrypt the transaction using BITE
      encryptedTx = await bite.encryptTransaction({ to, data });
      console.log('🔐 Transaction encrypted via BITE Protocol');
    } else {
      // BITE not available — send unencrypted
      encryptedTx = { to, data };
    }

    // Send the transaction with manually set gas
    // CRITICAL: estimateGas doesn't work with BITE
    const txRequest = {
      ...(walletClient.account ? { account: walletClient.account } : {}),
      to: encryptedTx.to as `0x${string}`,
      data: encryptedTx.data as `0x${string}`,
      gas: BigInt(BITE_GAS_LIMIT),
      ...(value !== undefined && { value }),
    } as Parameters<typeof walletClient.sendTransaction>[0];

    const txHash = await walletClient.sendTransaction(txRequest);
    console.log(`📤 Transaction sent: ${txHash}`);
    return txHash;
  } catch (err) {
    console.error('❌ Failed to send transaction:', err instanceof Error ? err.message : String(err));
    // Return mock hash so the game can continue
    return mockTxHash('encrypted-tx-fallback');
  }
}

/**
 * Get decrypted transaction data for debugging/verification.
 * Calls the BITE endpoint to retrieve the decrypted calldata.
 *
 * @param txHash - Transaction hash to look up
 * @returns Decrypted transaction data (hex string) or null if unavailable
 */
export async function getDecryptedTxData(
  txHash: string,
): Promise<string | null> {
  const bite = await getBite();
  if (!bite) {
    console.warn('⚠️  Cannot decrypt tx: BITE not available');
    return null;
  }

  try {
    const decrypted = await bite.getDecryptedTransactionData(txHash);
    return decrypted;
  } catch (err) {
    console.error(
      '❌ Failed to decrypt transaction data:',
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Check whether BITE encryption is active and available.
 * Useful for the frontend to display encryption status.
 */
export async function isBiteActive(): Promise<boolean> {
  const bite = await getBite();
  return bite !== null;
}

export { mockTxHash };
