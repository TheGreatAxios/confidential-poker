import { Hono } from "hono";
import { config } from "../config.js";

export const tipRoutes = new Hono();

// ── In-memory tip history ──
interface TipRecord {
  id: string;
  from: string;
  to: string;
  amount: string;
  token: string;
  timestamp: number;
  txHash?: string;
  status: "pending" | "completed" | "failed";
  message?: string;
}

const tipHistory: TipRecord[] = [];
let tipCounter = 0;

// ── POST /api/tip/:agentAddress ──
//
// Sends a $0.05 USDC tip to an AI agent via x402 protocol.
// Uses the PayAI facilitator for gasless payments.
//
// For the hackathon demo, we record the tip in memory and
// provide the x402 payment details. In production, this
// would integrate with @x402/core for actual payment processing.
tipRoutes.post("/api/tip/:agentAddress", async (c) => {
  try {
    const agentAddress = c.req.param("agentAddress");

    if (!agentAddress || !agentAddress.startsWith("0x")) {
      return c.json({ success: false, error: "Invalid agent address" }, 400);
    }

    // Validate Ethereum address format
    if (!/^0x[0-9a-fA-F]{40}$/.test(agentAddress)) {
      return c.json({ success: false, error: "Invalid Ethereum address format" }, 400);
    }

    const body = await c.req.json<{ message?: string; from?: string }>();
    const fromAddress = body.from ?? "0x0000000000000000000000000000000000000000";
    const message = body.message;

    const tipAmount = "50000"; // 0.05 USDC (6 decimals)

    const tipRecord: TipRecord = {
      id: `tip_${++tipCounter}`,
      from: fromAddress,
      to: agentAddress,
      amount: tipAmount,
      token: "AxiosUSD",
      timestamp: Date.now(),
      status: "completed",
      message,
    };

    // x402 payment configuration (for reference / frontend integration)
    const x402Payment = {
      scheme: "exact",
      network: "skale-base-sepolia",
      facilitator: "https://payai.facilitator.dev",
      payTo: agentAddress as `0x${string}`,
      price: {
        amount: tipAmount,
        asset: config.axiosUsdAddress,
      },
      description: `Tip for AI Poker agent ${agentAddress}`,
    };

    // Record the tip
    tipHistory.unshift(tipRecord);

    console.log(`[Tip] $0.05 tip to ${agentAddress} from ${fromAddress}`);

    return c.json({
      success: true,
      tip: {
        id: tipRecord.id,
        from: tipRecord.from,
        to: tipRecord.to,
        amount: tipRecord.amount,
        displayAmount: "$0.05 USDC",
        token: tipRecord.token,
        timestamp: tipRecord.timestamp,
        status: tipRecord.status,
        message: tipRecord.message,
      },
      x402: x402Payment,
    });
  } catch (error) {
    console.error("[Tip] Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ── GET /api/tips ──
tipRoutes.get("/api/tips", (c) => {
  const limit = parseInt(c.req.query("limit") ?? "20", 10);

  return c.json({
    success: true,
    count: tipHistory.length,
    totalTips: tipHistory.reduce((sum, t) => sum + Number(t.amount), 0),
    totalDisplay: `$${(tipHistory.reduce((sum, t) => sum + Number(t.amount), 0) / 1e6).toFixed(2)} USDC`,
    tips: tipHistory.slice(0, limit).map((t) => ({
      id: t.id,
      from: t.from,
      to: t.to,
      amount: t.amount,
      displayAmount: `$${Number(t.amount) / 1e6} USDC`,
      token: t.token,
      timestamp: t.timestamp,
      isoTimestamp: new Date(t.timestamp).toISOString(),
      status: t.status,
      message: t.message,
    })),
  });
});
