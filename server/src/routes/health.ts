import { Hono } from "hono";
import { config } from "../config.js";
import { publicClient } from "../viem.js";

const health = new Hono();

/**
 * GET /api/health — Health check endpoint.
 * Returns server status, chain connectivity, and timestamp.
 */
health.get("/api/health", async (c) => {
  let chainId: number | null = null;
  let chainConnected = false;

  try {
    chainId = await publicClient.getChainId();
    chainConnected = true;
  } catch {
    chainConnected = false;
  }

  return c.json({
    status: "ok",
    chainId: chainId ?? config.chainId,
    chainConnected,
    rpcUrl: config.rpcUrl,
    contractsDeployed:
      config.pokerTableAddress !==
      "0x0000000000000000000000000000000000000000",
    pokerTableAddress: config.pokerTableAddress,
    mockSklAddress: config.mockSklAddress,
    axiosUsdAddress: config.axiosUsdAddress,
    timestamp: new Date().toISOString(),
  });
});

export default health;
