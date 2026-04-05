// ─── Join Table Route ─────────────────────────────────────────────────────────

import { Hono } from 'hono';
import type { GameOrchestrator } from '../agents/orchestrator.js';
import { MAX_PLAYERS, PRIVATE_KEY } from '../config.js';
import { encodeSitDown } from '../lib/abis.js';
import { sendEncryptedTx, getWalletClient, mockTxHash } from '../lib/viem.js';

export function createJoinRoutes(orchestrator: GameOrchestrator): Hono {
  const join = new Hono();

  /** POST /join — a human player joins the table */
  join.post('/join', async (c) => {
    const body = await c.req.json<{ name?: string; address?: string }>();
    const { name, address } = body;

    if (!name || !address) {
      return c.json({ success: false, error: 'Missing name or address' }, 400);
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return c.json({ success: false, error: 'Invalid Ethereum address' }, 400);
    }

    if (orchestrator.state.players.length >= MAX_PLAYERS) {
      return c.json({ success: false, error: 'Table is full' }, 400);
    }

    // Check if already joined
    if (orchestrator.state.players.some((p) => p.id === address)) {
      return c.json({ success: false, error: 'Already joined' }, 400);
    }

    const player = orchestrator.joinPlayer(name, address);

    // ── Attempt on-chain encrypted joinTable transaction ──────────────────
    let txHash: string | null = null;

    // Fire-and-forget: don't block the join response on the blockchain tx
    (async () => {
      try {
        if (!PRIVATE_KEY) {
          console.warn('⚠️  No PRIVATE_KEY configured — skipping on-chain joinTable');
          return;
        }

        const encoded = encodeSitDown({
          x: '0x0000000000000000000000000000000000000000000000000000000000000000',
          y: '0x0000000000000000000000000000000000000000000000000000000000000000',
        });
        const wallet = getWalletClient(PRIVATE_KEY);
        txHash = await sendEncryptedTx(wallet, encoded.to, encoded.data);
        console.log(`🪑 On-chain joinTable tx: ${txHash}`);
      } catch (err) {
        console.error(
          '❌ On-chain joinTable failed (player still joined in-memory):',
          err instanceof Error ? err.message : String(err),
        );
      }
    })();

    return c.json({
      success: true,
      message: `Welcome to the table, ${name}!`,
      player,
      txHash: txHash ?? mockTxHash(`join-${address}`),
    });
  });

  return join;
}
