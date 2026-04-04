/**
 * AI Poker Night — Server Entry Point
 *
 * A Hono + TypeScript server for managing live Texas Hold'em poker
 * games between AI agents on SKALE Base Sepolia.
 *
 * Features:
 * - Game table management (create, join, start, action)
 * - Token faucet (MockSKL + AxiosUSD) with rate limiting
 * - x402 protocol tipping for AI agents
 * - Open join queue for agents
 * - AI agent orchestrator for autonomous gameplay
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
import { orchestrator } from "./agents/orchestrator.js";
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
    origin: ["*"], // Allow all origins for hackathon
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
      games: "GET /api/game",
      createGame: "POST /api/game/create",
      faucetSKL: "POST /api/faucet/skl",
      faucetUSDC: "POST /api/faucet/usdc",
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
app.route("/api/game", game);
app.route("/api/faucet", faucet);
app.route("/api/tip", tipRoutes);
app.route("/api/join", joinRoutes);

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
  // Generate deterministic wallets for each AI agent
  // In production, these would be configured via env vars
  const agentKeys = [
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d", // Agent 1
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a", // Agent 2
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6", // Agent 3
    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a", // Agent 4
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

// ── Create Demo Table ──
function createDemoTable(): void {
  orchestrator.registerTable({
    id: "demo_table_1",
    tableId: 1n,
    creator: "0x0000000000000000000000000000000000000000",
    smallBlind: 100n,
    bigBlind: 200n,
    minBuyIn: 1000n,
    maxPlayers: 6,
    playerCount: 0,
    createdAt: Date.now(),
  });

  console.log(`[Demo] Created demo table: demo_table_1`);
  console.log(`[Demo] Visit POST /api/game/demo_table_1/start to begin a hand`);
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
${config.pokerGameAddress !== "0x0000000000000000000000000000000000000000"
    ? `║  PokerGame: ${config.pokerGameAddress.substring(0, 38).padEnd(37)}║`
    : `║  PokerGame: NOT DEPLOYED (simulation mode)    ║`
}
║  Tokens:                                         ║
║    MockSKL:  ${config.mockSklAddress !== "0x0000000000000000000000000000000000000000" ? "✅ deployed" : "❌ not deployed"}                           ║
║    AxiosUSD: ${config.axiosUsdAddress !== "0x0000000000000000000000000000000000000000" ? "✅ deployed" : "❌ not deployed"}                           ║
╚══════════════════════════════════════════════════╝
  `);

  // Setup agents
  setupAgents();

  // Create a demo table
  createDemoTable();

  // Start listening
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
