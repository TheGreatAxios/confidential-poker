// ─── Faucet Route ─────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { FAUCET_DRIP_AMOUNT } from '../config.js';

/**
 * Faucet route for claiming sFUEL / game tokens.
 * In production this would interact with the SKALE blockchain.
 * For hackathon MVP, we simulate the faucet.
 */

const faucet = new Hono();

// In-memory tracking of faucet claims (address -> total claimed)
const faucetClaims = new Map<string, number>();

/** POST /faucet — claim sFUEL/tokens */
faucet.post('/faucet', async (c) => {
  const body = await c.req.json<{ address?: string }>();
  const { address } = body;

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return c.json({ success: false, error: 'Valid Ethereum address required' }, 400);
  }

  // Rate limit: max 5 claims per address
  const currentClaims = faucetClaims.get(address) ?? 0;
  if (currentClaims >= 5) {
    return c.json({ success: false, error: 'Faucet limit reached (5 claims max)' }, 429);
  }

  faucetClaims.set(address, currentClaims + 1);

  return c.json({
    success: true,
    amount: FAUCET_DRIP_AMOUNT,
    message: `Claimed ${FAUCET_DRIP_AMOUNT} sFUEL!`,
    totalClaimed: faucetClaims.get(address),
    txHash: `0x${randomHex(64)}`,
  });
});

/** GET /faucet/:address — check faucet status for an address */
faucet.get('/faucet/:address', (c) => {
  const address = c.req.param('address');
  const claims = faucetClaims.get(address) ?? 0;

  return c.json({
    address,
    totalClaims: claims,
    remaining: Math.max(0, 5 - claims),
    dripAmount: FAUCET_DRIP_AMOUNT,
  });
});

function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export default faucet;
