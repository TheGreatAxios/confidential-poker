/**
 * AI Poker Night — Server Entry Point
 *
 * A Hono + TypeScript server for managing live Texas Hold'em poker
 * games between AI agents on SKALE Base Sepolia.
 */

import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { config } from "./config.js";
import game from "./routes/game.js";
import faucet from "./routes/faucet.js";
import { tipRoutes } from "./routes/tip.js";
import { joinRoutes } from "./routes/join.js";
import {
  RAGE_BOT,
  CAUTION_BOT,
  BLUFF_MASTER,
  MATH_GENIUS,
} from "./agents/personalities.js";
import { PokerAgent, PERSONALITY_MESSAGES } from "./agents/agent.js";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { skaleBaseSepolia } from "./viem.js";

// ── Create Hono App ──
const app = new Hono();

// ── Middleware ──
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["*"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposeHeaders: ["X-Request-Id"],
    maxAge: 86400,
  }),
);

// ── Health Check (root) ──
app.get("/", (c) => {
  return c.json({
    name: "🃏 AI Poker Night",
    version: "1.0.0",
    description: "Live Texas Hold'em with AI agents on SKALE",
    chain: "SKALE Base Sepolia",
    chainId: config.chainId,
    endpoints: {
      health: "GET /api/health",
      table: "GET /api/table",
      tableHistory: "GET /api/table/history",
      sitDown: "POST /api/sit-down",
      leave: "POST /api/leave",
      deal: "POST /api/deal",
      action: "POST /api/action",
      resolve: "POST /api/resolve",
      forceFold: "POST /api/force-fold",
      botStart: "POST /api/bot/start",
      botStop: "POST /api/bot/stop",
      botStatus: "POST /api/bot/status",
      faucetSKL: "POST /api/faucet/mskl",
      faucetUSDC: "POST /api/faucet/axusd",
      balances: "GET /api/faucet/balances/:address",
      tip: "POST /api/tip/:agentAddress",
      tips: "GET /api/tips",
      join: "POST /api/join",
      queue: "GET /api/join/queue",
    },
    timestamp: new Date().toISOString(),
  });
});

// ── Mount Route Groups ──
app.route("/", game);
app.route("/", faucet);
app.route("/", tipRoutes);
app.route("/", joinRoutes);

// ── 404 Handler ──
app.notFound((c) => {
  return c.json(
    {
      error: "Not Found",
      message: `Route ${c.req.method} ${c.req.path} does not exist`,
      hint: "Visit / for available endpoints",
    },
    404,
  );
});

// ── Error Handler ──
app.onError((err, c) => {
  console.error(`[Server] Error: ${err.message}`);
  return c.json(
    {
      error: "Internal Server Error",
      message: err.message,
    },
    500,
  );
});

// ── Setup AI Agents ──
function setupAgents(): void {
  const agentKeys = [
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  ];

  const personalities = [RAGE_BOT, CAUTION_BOT, BLUFF_MASTER, MATH_GENIUS];
  const names = ["Rage Bot", "Caution Bot", "Bluff Master", "Math Genius"];

  for (let i = 0; i < personalities.length; i++) {
    const account = privateKeyToAccount(agentKeys[i] as `0x${string}`);
    const wallet = createWalletClient({
      account,
      chain: skaleBaseSepolia,
      transport: http(config.rpcUrl),
    });

    const agent = new PokerAgent(
      personalities[i],
      account.address,
      wallet,
      PERSONALITY_MESSAGES[names[i]],
    );

    console.log(`[Agents] ${agent.emoji} ${agent.name} ready at ${agent.address}`);
  }
}

// ── Start Server ──
function main(): void {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║           🃏 AI POKER NIGHT 🃏                  ║
  ║     Live Texas Hold'em with AI on SKALE         ║
  ╠══════════════════════════════════════════════════╣
  ║  Chain:     SKALE Base Sepolia                  ║
  ║  Chain ID:  ${config.chainId.toString().padEnd(33)}║
  ║  Port:      ${config.port.toString().padEnd(33)}║
  ║  RPC:       ${config.rpcUrl.substring(0, 33).padEnd(33)}║
  ╠══════════════════════════════════════════════════╣
  ║  Contracts:                                      ║
  ║  PokerTable: ${config.pokerTableAddress.substring(0, 36).padEnd(37)}║
  ║  Tokens:                                         ║
  ║    MockSKL:  deployed                            ║
  ║    AxiosUSD: deployed                            ║
  ╚══════════════════════════════════════════════════╝
  `);

  setupAgents();

  serve(
    {
      fetch: app.fetch,
      port: config.port,
    },
    (info) => {
      console.log(`\n🚀 Server running at http://localhost:${info.port}`);
      console.log(`📊 Health: http://localhost:${info.port}/api/health`);
      console.log(`📋 API:    http://localhost:${info.port}/\n`);
    },
  );
}

main();
