// ─── x402 Premium Paywalled Routes ───────────────────────────────────────────
//
// Premium features that require micropayments via the x402 (HTTP 402) protocol.
// Payments are settled in USDC on SKALE Base Sepolia — zero gas fees.
//
// Paywalled endpoints are protected by x402 middleware defined in index.ts.
// This module exports the route handler and the route payment config.

import { Hono } from 'hono';
import type { RoutesConfig } from '@x402/core/server';
import {
  PAY_TO_ADDRESS,
  X402_PAYMENT_TOKEN,
  X402_NETWORK_ID,
} from '../config.js';

// ── x402 Route Payment Configuration ─────────────────────────────────────────
// Prices are in USDC with 6 decimals:
//   10000  = 0.01 USDC
//   5000   = 0.005 USDC
//   50000  = 0.05 USDC

export const premiumRoutesConfig: RoutesConfig = {
  'GET /api/premium/ai-advice': {
    accepts: [
      {
        scheme: 'exact',
        network: X402_NETWORK_ID,
        payTo: PAY_TO_ADDRESS,
        price: { amount: '10000', asset: X402_PAYMENT_TOKEN },
      },
    ],
    description: 'AI analysis of current game state with pot odds, suggested actions, and win probability',
  },
  'GET /api/premium/hand-history': {
    accepts: [
      {
        scheme: 'exact',
        network: X402_NETWORK_ID,
        payTo: PAY_TO_ADDRESS,
        price: { amount: '5000', asset: X402_PAYMENT_TOKEN },
      },
    ],
    description: 'Detailed hand history with timing, actions, and encrypted card reveals',
  },
  'GET /api/premium/agent-insights': {
    accepts: [
      {
        scheme: 'exact',
        network: X402_NETWORK_ID,
        payTo: PAY_TO_ADDRESS,
        price: { amount: '10000', asset: X402_PAYMENT_TOKEN },
      },
    ],
    description: 'AI agent behavioral analysis with bluff frequency and counter-strategies',
  },
  'POST /api/premium/custom-avatar': {
    accepts: [
      {
        scheme: 'exact',
        network: X402_NETWORK_ID,
        payTo: PAY_TO_ADDRESS,
        price: { amount: '50000', asset: X402_PAYMENT_TOKEN },
      },
    ],
    description: 'Set a custom display name and avatar style',
  },
};

// ── Premium Route Handlers ───────────────────────────────────────────────────

const premium = new Hono();

/** GET /api/premium/ai-advice — AI analysis of current game state */
premium.get('/api/premium/ai-advice', (c) => {
  // TODO: Wire real game state from orchestrator
  const advice = {
    feature: 'ai-advice',
    timestamp: new Date().toISOString(),
    analysis: {
      potOdds: {
        potSize: 450,
        callAmount: 100,
        potOddsPercentage: 18.2,
        equityNeeded: 18.2,
      },
      suggestedAction: {
        action: 'call',
        confidence: 0.72,
        reasoning:
          'Your hand strength combined with pot odds makes this a profitable call. The risk/reward ratio favors seeing the next card.',
      },
      winProbability: {
        currentHand: 'Top Pair, Kicker',
        winPercentage: 64,
        tiePercentage: 4,
        losePercentage: 32,
        outs: 9,
        improvedWinOnNextCard: 73,
      },
    },
    disclaimer:
      'This is AI-generated advice for entertainment purposes. Use at your own risk.',
  };

  return c.json(advice);
});

/** GET /api/premium/hand-history — Detailed hand history */
premium.get('/api/premium/hand-history', (c) => {
  // TODO: Wire real hand history from orchestrator
  const handHistory = {
    feature: 'hand-history',
    timestamp: new Date().toISOString(),
    handNumber: 14,
    dealer: 'Professor',
    table: 'Europa Confidential Room',
    actions: [
      {
        player: 'Sharky',
        action: 'fold',
        amount: 0,
        phase: 'preflop',
        elapsedMs: 1200,
      },
      {
        player: 'Sly',
        action: 'call',
        amount: 100,
        phase: 'preflop',
        elapsedMs: 800,
      },
      {
        player: 'Professor',
        action: 'raise',
        amount: 300,
        phase: 'preflop',
        elapsedMs: 2400,
      },
      {
        player: 'Thunder',
        action: 'call',
        amount: 300,
        phase: 'preflop',
        elapsedMs: 600,
      },
      {
        player: 'Whiskers',
        action: 'fold',
        amount: 0,
        phase: 'preflop',
        elapsedMs: 1500,
      },
      {
        player: 'Alpha',
        action: 'call',
        amount: 300,
        phase: 'preflop',
        elapsedMs: 900,
      },
    ],
    communityCards: ['K♠', '7♥', '2♦', null, null],
    pot: 1350,
    encryptedReveals: null,
    showdownComplete: false,
  };

  return c.json(handHistory);
});

/** GET /api/premium/agent-insights — AI agent behavioral analysis */
premium.get('/api/premium/agent-insights', (c) => {
  // TODO: Wire real agent stats from orchestrator
  const insights = {
    feature: 'agent-insights',
    timestamp: new Date().toISOString(),
    analysisWindow: 'last-100-hands',
    agents: [
      {
        name: 'Sharky',
        emoji: '🦈',
        style: 'Tight-Aggressive (TAG)',
        handsPlayed: 98,
        vpip: 22.4,
        pfr: 18.8,
        aggressionFactor: 3.2,
        bluffFrequency: 12.5,
        foldToRaise: 31.0,
        winRate: 28.6,
        counterStrategy:
          'Sharky plays few hands but bets aggressively. Avoid bluffing into them; only continue with strong holdings.',
      },
      {
        name: 'Sly',
        emoji: '🦊',
        style: 'Loose-Aggressive (LAG)',
        handsPlayed: 95,
        vpip: 41.1,
        pfr: 28.3,
        aggressionFactor: 2.8,
        bluffFrequency: 28.7,
        foldToRaise: 24.5,
        winRate: 22.1,
        counterStrategy:
          'Sly bluffs frequently. Trap with strong hands and call down lighter than usual.',
      },
      {
        name: 'Professor',
        emoji: '🦉',
        style: 'Tight-Passive (Nit)',
        handsPlayed: 100,
        vpip: 16.0,
        pfr: 14.2,
        aggressionFactor: 1.4,
        bluffFrequency: 5.2,
        foldToRaise: 42.8,
        winRate: 18.0,
        counterStrategy:
          'Professor only bets with strong hands. Steal blinds frequently; fold when they show aggression.',
      },
      {
        name: 'Thunder',
        emoji: '🐂',
        style: 'Calling Station',
        handsPlayed: 92,
        vpip: 38.0,
        pfr: 8.7,
        aggressionFactor: 0.9,
        bluffFrequency: 3.8,
        foldToRaise: 18.5,
        winRate: 15.2,
        counterStrategy:
          'Thunder rarely folds. Value bet relentlessly with any made hand; never bluff.',
      },
      {
        name: 'Whiskers',
        emoji: '🐱',
        style: 'Balanced / GTO-inspired',
        handsPlayed: 97,
        vpip: 25.8,
        pfr: 22.1,
        aggressionFactor: 2.1,
        bluffFrequency: 18.3,
        foldToRaise: 33.6,
        winRate: 20.6,
        counterStrategy:
          'Whiskers is well-balanced. Focus on positional play and exploit small tendencies over time.',
      },
      {
        name: 'Alpha',
        emoji: '🐺',
        style: 'Maniac',
        handsPlayed: 94,
        vpip: 52.1,
        pfr: 35.4,
        aggressionFactor: 4.1,
        bluffFrequency: 38.5,
        foldToRaise: 15.2,
        winRate: 16.0,
        counterStrategy:
          'Alpha overplays hands. Wait for premium holdings and let them build the pot for you.',
      },
    ],
  };

  return c.json(insights);
});

/** POST /api/premium/custom-avatar — Set custom display name and avatar */
premium.post('/api/premium/custom-avatar', async (c) => {
  const body = await c.req.json<{
    name?: string;
    avatarStyle?: string;
  }>();
  const { name, avatarStyle } = body;

  if (!name && !avatarStyle) {
    return c.json(
      { success: false, error: 'Provide name and/or avatarStyle' },
      400,
    );
  }

  const validStyles = [
    'cyberpunk',
    'minimal',
    'pixel-art',
    'neon',
    'classic',
    'shadow',
  ];

  if (avatarStyle && !validStyles.includes(avatarStyle)) {
    return c.json(
      {
        success: false,
        error: `Invalid avatarStyle. Choose from: ${validStyles.join(', ')}`,
      },
      400,
    );
  }

  // TODO: Persist avatar config per player address
  const avatar = {
    feature: 'custom-avatar',
    timestamp: new Date().toISOString(),
    success: true,
    message: 'Custom avatar set!',
    profile: {
      displayName: name ?? null,
      avatarStyle: avatarStyle ?? 'minimal',
      previewUrl: `https://avatar.example.com/${avatarStyle ?? 'minimal'}/${encodeURIComponent(name ?? 'player')}.png`,
    },
  };

  return c.json(avatar);
});

// ── Free Tier / Info Endpoints (no payment required) ─────────────────────────

/** GET /api/premium/pricing — Available premium features and prices */
premium.get('/api/premium/pricing', (c) => {
  return c.json({
    features: [
      {
        endpoint: 'GET /api/premium/ai-advice',
        price: '0.01 USDC',
        priceRaw: '10000',
        description:
          'AI analysis of current game state with pot odds, suggested actions, and win probability',
      },
      {
        endpoint: 'GET /api/premium/hand-history',
        price: '0.005 USDC',
        priceRaw: '5000',
        description:
          'Detailed hand history with timing, actions, and encrypted card reveals',
      },
      {
        endpoint: 'GET /api/premium/agent-insights',
        price: '0.01 USDC',
        priceRaw: '10000',
        description:
          'AI agent behavioral analysis with bluff frequency and counter-strategies',
      },
      {
        endpoint: 'POST /api/premium/custom-avatar',
        price: '0.05 USDC',
        priceRaw: '50000',
        description:
          'Set a custom display name and avatar style for your player profile',
      },
    ],
    network: X402_NETWORK_ID,
    token: X402_PAYMENT_TOKEN,
    tokenSymbol: 'USDC',
  });
});

/** GET /api/premium/status — Premium access status */
premium.get('/api/premium/status', (c) => {
  // TODO: Check actual payment/subscription status from the x402 payment header
  return c.json({
    premium: false,
    message:
      'No active premium session detected. Access premium features by making micropayments via the x402 protocol.',
    info: 'Each premium endpoint requires a separate micropayment. No subscription needed.',
  });
});

export default premium;
