import { Hono, Context } from "hono";
import { config } from "../config.js";
import { publicClient, walletClient } from "../viem.js";
import { mockSklAbi } from "../abis/MockSKL.js";
import { axiosUsdAbi } from "../abis/AxiosUSD.js";

const faucet = new Hono();

// ── Rate Limiting (in-memory, per address) ──

const claimTimestamps = new Map<
  string,
  { mskl: number; axusd: number }
>();

const RATE_LIMIT_MS = 60_000; // 60 seconds

function canClaim(address: string, token: "mskl" | "axusd"): boolean {
  const now = Date.now();
  const record = claimTimestamps.get(address.toLowerCase());
  if (!record) return true;
  return now - record[token] >= RATE_LIMIT_MS;
}

function recordClaim(address: string, token: "mskl" | "axusd"): void {
  const key = address.toLowerCase();
  const record = claimTimestamps.get(key) ?? { mskl: 0, axusd: 0 };
  record[token] = Date.now();
  claimTimestamps.set(key, record);
}

// ── POST /api/faucet/mskl (or /api/faucet/gas) — Claim MockSKL ──

async function claimMskl(c: Context, address?: string) {
  const claimAddress = (address ?? c.req.header("x-address")) as `0x${string}` | undefined;

  if (!claimAddress) {
    return c.json(
      { error: "Address is required. Pass ?address= or x-address header." },
      400,
    );
  }

  if (!canClaim(claimAddress, "mskl")) {
    const record = claimTimestamps.get(claimAddress.toLowerCase());
    const remaining = record
      ? Math.max(0, RATE_LIMIT_MS - (Date.now() - record.mskl))
      : 0;
    return c.json(
      {
        error: "Rate limited. Please wait before claiming again.",
        retryAfterMs: remaining,
      },
      429,
    );
  }

  try {
    // Server claims from faucet, then transfers to the user
    const hash = await walletClient.writeContract({
      address: config.mockSklAddress,
      abi: mockSklAbi,
      functionName: "faucet",
      args: [],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    // Transfer tokens to the requesting address
    // MockSKL faucet mints 100 tokens (18 decimals)
    const transferAmount = 100n * 10n ** 18n;
    const transferHash = await walletClient.writeContract({
      address: config.mockSklAddress,
      abi: mockSklAbi,
      functionName: "transfer",
      args: [claimAddress, transferAmount],
    });

    await publicClient.waitForTransactionReceipt({ hash: transferHash });

    recordClaim(claimAddress, "mskl");

    return c.json({
      success: true,
      token: "MSKL",
      amount: "100",
      to: claimAddress,
      txHash: transferHash,
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to claim MSKL",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

faucet.post("/api/faucet/mskl", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return claimMskl(c, body.address);
});

faucet.post("/api/faucet/gas", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return claimMskl(c, body.address);
});

// ── POST /api/faucet/axusd (or /api/faucet/usdc) — Claim AxiosUSD ──

async function claimAxusd(c: Context, address?: string) {
  const claimAddress = (address ?? c.req.header("x-address")) as `0x${string}` | undefined;

  if (!claimAddress) {
    return c.json(
      { error: "Address is required. Pass ?address= or x-address header." },
      400,
    );
  }

  if (!canClaim(claimAddress, "axusd")) {
    const record = claimTimestamps.get(claimAddress.toLowerCase());
    const remaining = record
      ? Math.max(0, RATE_LIMIT_MS - (Date.now() - record.axusd))
      : 0;
    return c.json(
      {
        error: "Rate limited. Please wait before claiming again.",
        retryAfterMs: remaining,
      },
      429,
    );
  }

  try {
    const hash = await walletClient.writeContract({
      address: config.axiosUsdAddress,
      abi: axiosUsdAbi,
      functionName: "faucet",
      args: [],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    // AxiosUSD has 6 decimals, faucet mints 1000 tokens
    const transferAmount = 1000n * 10n ** 6n;
    const transferHash = await walletClient.writeContract({
      address: config.axiosUsdAddress,
      abi: axiosUsdAbi,
      functionName: "transfer",
      args: [claimAddress, transferAmount],
    });

    await publicClient.waitForTransactionReceipt({ hash: transferHash });

    recordClaim(claimAddress, "axusd");

    return c.json({
      success: true,
      token: "AXUSD",
      amount: "1000",
      to: claimAddress,
      txHash: transferHash,
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to claim AXUSD",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

faucet.post("/api/faucet/axusd", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return claimAxusd(c, body.address);
});

faucet.post("/api/faucet/usdc", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  return claimAxusd(c, body.address);
});

// ── GET /api/faucet/balances — Get token balances for an address ──

async function getBalances(c: Context, address: string) {
  try {
    const [msklBalance, axusdBalance] = await Promise.all([
      publicClient.readContract({
        address: config.mockSklAddress,
        abi: mockSklAbi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      }) as Promise<bigint>,

      publicClient.readContract({
        address: config.axiosUsdAddress,
        abi: axiosUsdAbi,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      }) as Promise<bigint>,
    ]);

    const record = claimTimestamps.get(address.toLowerCase());

    return c.json({
      address,
      mskl: Number(msklBalance) / 1e18,
      axusd: Number(axusdBalance) / 1e6,
      msklRaw: msklBalance.toString(),
      axusdRaw: axusdBalance.toString(),
      msklCooldown: record
        ? Math.max(0, Math.ceil((RATE_LIMIT_MS - (Date.now() - record.mskl)) / 1000))
        : 0,
      axusdCooldown: record
        ? Math.max(0, Math.ceil((RATE_LIMIT_MS - (Date.now() - record.axusd)) / 1000))
        : 0,
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to fetch balances",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

// Query param style: GET /api/faucet/balances?address=0x...
faucet.get("/api/faucet/balances", async (c) => {
  const address = c.req.query("address");
  if (!address) {
    return c.json({ error: "address query parameter is required" }, 400);
  }
  return getBalances(c, address);
});

// Path param style: GET /api/faucet/balances/:address
faucet.get("/api/faucet/balances/:address", async (c) => {
  const address = c.req.param("address");
  return getBalances(c, address);
});

export default faucet;
