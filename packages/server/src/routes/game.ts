// ─── Game State & Control Route ───────────────────────────────────────────────

import { Hono } from 'hono';
import type { GameOrchestrator } from '../agents/orchestrator.js';
import { encodeGameAction } from '../lib/abis.js';
import { sendEncryptedTx, getWalletClient, mockTxHash } from '../lib/viem.js';
import { PRIVATE_KEY } from '../config.js';

export function createGameRoutes(orchestrator: GameOrchestrator): Hono {
  const game = new Hono();

  /** GET /game — return the current game state */
  game.get('/game', (c) => {
    return c.json(orchestrator.getPublicState());
  });

  /** POST /game/start — start or restart the game */
  game.post('/game/start', (c) => {
    orchestrator.startGame();
    return c.json({
      success: true,
      message: 'Game started!',
      state: orchestrator.getPublicState(),
    });
  });

  /** POST /game/action — submit a human player action */
  game.post('/game/action', async (c) => {
    const body = await c.req.json<{ action: string; amount?: number }>();
    const { action, amount } = body;

    const validActions = ['fold', 'check', 'call', 'raise', 'all-in'];
    if (!action || !validActions.includes(action)) {
      return c.json({ success: false, error: 'Invalid action' }, 400);
    }

    if (!orchestrator.humanActionPending) {
      return c.json({ success: false, error: 'No action pending' }, 400);
    }

    const success = orchestrator.submitHumanAction(
      action as 'fold' | 'check' | 'call' | 'raise' | 'all-in',
      amount,
    );

    if (!success) {
      return c.json({ success: false, error: 'Action rejected' }, 400);
    }

    // ── Attempt on-chain encrypted transaction ───────────────────────────
    let txHash: string | null = null;

    // Fire-and-forget: don't block the game response on the blockchain tx
    (async () => {
      try {
        const encoded = encodeGameAction(
          action as 'fold' | 'check' | 'call' | 'raise' | 'all-in',
          amount,
        );

        if (!encoded) {
          console.log('ℹ️  No encoding for action:', action);
          return;
        }

        if (!PRIVATE_KEY) {
          console.warn(
            '⚠️  No PRIVATE_KEY configured — skipping on-chain transaction for action:',
            action,
          );
          return;
        }

        const wallet = getWalletClient(PRIVATE_KEY);
        txHash = await sendEncryptedTx(wallet, encoded.to, encoded.data);
        console.log(`🎰 On-chain action "${action}" tx: ${txHash}`);
      } catch (err) {
        console.error(
          '❌ On-chain action failed (game continues in-memory):',
          err instanceof Error ? err.message : String(err),
        );
      }
    })();

    return c.json({
      success: true,
      message: `Action "${action}" submitted`,
      txHash: txHash ?? mockTxHash(`action-${action}`),
    });
  });

  return game;
}
