// ─── Server Entry Point ───────────────────────────────────────────────────────

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import {
  x402ResourceServer,
  HTTPFacilitatorClient,
} from '@x402/core/server';
import { paymentMiddleware } from '@x402/hono';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import { PORT, X402_FACILITATOR_URL } from './config.js';
import { createDefaultAgents } from './agents/agents.js';
import { GameOrchestrator } from './agents/orchestrator.js';
import health from './routes/health.js';
import { createGameRoutes } from './routes/game.js';
import { createJoinRoutes } from './routes/join.js';
import faucet from './routes/faucet.js';
import tip from './routes/tip.js';
import premium, { premiumRoutesConfig } from './routes/premium.js';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const app = new Hono();

// Middleware
app.use('*', cors());

// ── x402 Payment Setup ───────────────────────────────────────────────────────

let x402PaymentMiddleware: ReturnType<typeof paymentMiddleware> | null = null;

try {
  const facilitatorClient = new HTTPFacilitatorClient({
    url: X402_FACILITATOR_URL,
  });
  const resourceServer = new x402ResourceServer(facilitatorClient);
  resourceServer.register('eip155:*', new ExactEvmScheme());

  x402PaymentMiddleware = paymentMiddleware(
    premiumRoutesConfig,
    resourceServer,
  );

  console.log('💎 x402 payment middleware initialized (PayAI facilitator)');
} catch (err) {
  console.warn(
    '⚠️  x402 payment middleware failed to initialize. ' +
      'Premium endpoints will not require payment.\n' +
      `   Error: ${err instanceof Error ? err.message : String(err)}`,
  );
}

// Create agents and orchestrator
const agents = createDefaultAgents();
const orchestrator = new GameOrchestrator(agents);

// ── Mount Routes ──────────────────────────────────────────────────────────────

app.route('/', health);
app.route('/', createGameRoutes(orchestrator));
app.route('/', createJoinRoutes(orchestrator));
app.route('/', faucet);
app.route('/', tip);

// ── Mount Premium Routes (x402-protected) ────────────────────────────────────
// Payment middleware intercepts paywalled endpoints before the route handler.
// Free-tier endpoints (pricing, status) are served without payment.
app.route('/', premium);

// Apply x402 payment middleware AFTER mounting premium routes
// so it intercepts requests to paywalled endpoints.
if (x402PaymentMiddleware) {
  app.use('/api/premium/*', x402PaymentMiddleware);
}

// ── Start Server ──────────────────────────────────────────────────────────────

console.log('🃏 AI Poker Night — Server starting...');
console.log(`   6 AI Agents: 🦈 Sharky  🦊 Sly  🦉 Professor  🐂 Thunder  🐱 Whiskers  🐺 Alpha`);
console.log(`   Listening on http://localhost:${PORT}`);

serve(
  { fetch: app.fetch, port: PORT },
  (info) => {
    console.log(`   Server running at http://localhost:${info.port}`);
  },
);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  orchestrator.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  orchestrator.stop();
  process.exit(0);
});
