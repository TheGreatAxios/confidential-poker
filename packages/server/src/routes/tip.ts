// ─── Tip Route ────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { MIN_TIP_AMOUNT, PRIVATE_KEY } from '../config.js';
import { encodeTip } from '../lib/abis.js';
import { sendEncryptedTx, getWalletClient, mockTxHash } from '../lib/viem.js';

/**
 * Tip route for sending tips to AI agents.
 * Attempts on-chain encrypted transaction via BITE Protocol when a private key
 * is configured, otherwise falls back to in-memory tracking.
 */

const tip = new Hono();

// In-memory tip tracking
const tipRecords: Array<{
  from: string;
  to: string;
  amount: number;
  message?: string;
  timestamp: string;
}> = [];

const tipTotals = new Map<string, number>();

/** POST /tip — tip an AI agent */
tip.post('/tip', async (c) => {
  const body = await c.req.json<{
    from?: string;
    to?: string;
    amount?: number;
    message?: string;
  }>();
  const { from, to, amount, message } = body;

  if (!from || !to) {
    return c.json({ success: false, error: 'Missing from/to addresses' }, 400);
  }

  if (!amount || amount < MIN_TIP_AMOUNT) {
    return c.json({
      success: false,
      error: `Minimum tip is ${MIN_TIP_AMOUNT}`,
    }, 400);
  }

  const tipRecord = {
    from,
    to,
    amount,
    message: message ?? undefined,
    timestamp: new Date().toISOString(),
  };

  tipRecords.push(tipRecord);

  // Update totals
  const current = tipTotals.get(to) ?? 0;
  tipTotals.set(to, current + amount);

  // ── Attempt on-chain encrypted tip transaction ─────────────────────────
  // Fire-and-forget: don't block the tip response on the blockchain tx
  (async () => {
    try {
      if (!PRIVATE_KEY) {
        console.warn('⚠️  No PRIVATE_KEY configured — skipping on-chain tip');
        return;
      }

      const encoded = encodeTip(
        to as `0x${string}`,
        message ?? '',
      );
      const wallet = getWalletClient(PRIVATE_KEY);
      const txHash = await sendEncryptedTx(
        wallet,
        encoded.to,
        encoded.data,
        BigInt(amount),
      );
      console.log(`💰 On-chain tip tx: ${txHash}`);
    } catch (err) {
      console.error(
        '❌ On-chain tip failed (tip still recorded in-memory):',
        err instanceof Error ? err.message : String(err),
      );
    }
  })();

  return c.json({
    success: true,
    message: `Tipped ${amount} to ${to}! ${message ? `"${message}"` : ''} 💰`,
    tip: tipRecord,
    txHash: mockTxHash(`tip-${from}-${to}-${Date.now()}`),
  });
});

/** GET /tip/leaderboard — tip leaderboard */
tip.get('/tip/leaderboard', (c) => {
  const leaderboard = Array.from(tipTotals.entries())
    .map(([agent, total]) => ({ agent, total }))
    .sort((a, b) => b.total - a.total);

  return c.json({ leaderboard });
});

function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export default tip;
