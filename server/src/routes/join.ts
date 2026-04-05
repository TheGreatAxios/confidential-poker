import { Hono } from "hono";
import { orchestrator } from "../agents/orchestrator.js";

export const joinRoutes = new Hono();

// ── Join Queue ──
interface QueueEntry {
  address: string;
  name: string;
  joinedAt: number;
  status: "queued" | "playing" | "left";
}

const joinQueue: QueueEntry[] = [];
let queueCounter = 0;

// ── POST /api/join ──
//
// Open table registration: any agent can post their address
// to join the next hand. This is a lightweight endpoint that
// adds the player to the queue without requiring on-chain interaction.
joinRoutes.post("/api/join", async (c) => {
  try {
    const body = await c.req.json<{
      address?: string;
      name?: string;
    }>();

    const address = body.address;
    const name = body.name ?? "Anonymous Player";

    if (!address) {
      return c.json({ success: false, error: "address is required" }, 400);
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return c.json({ success: false, error: "Invalid Ethereum address" }, 400);
    }

    // Check if already in queue
    const existing = joinQueue.find(
      (e) => e.address === address && e.status === "queued",
    );
    if (existing) {
      return c.json({
        success: false,
        error: "Already in the join queue",
        position: joinQueue.indexOf(existing) + 1,
      }, 409);
    }

    // Check if actively playing
    const playing = joinQueue.find(
      (e) => e.address === address && e.status === "playing",
    );
    if (playing) {
      return c.json({
        success: false,
        error: "Already playing at a table",
      }, 409);
    }

    const entry: QueueEntry = {
      address,
      name,
      joinedAt: Date.now(),
      status: "queued",
    };

    joinQueue.push(entry);
    queueCounter++;

    console.log(`[Join] ${name} (${address}) joined the queue (#${queueCounter})`);

    return c.json({
      success: true,
      message: `Added to join queue as ${name}`,
      entry: {
        address: entry.address,
        name: entry.name,
        position: joinQueue.length,
        joinedAt: entry.joinedAt,
      },
      queueSize: joinQueue.filter((e) => e.status === "queued").length,
    });
  } catch (error) {
    console.error("[Join] Error:", error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ── GET /api/join/queue ──
joinRoutes.get("/queue", (c) => {
  const queued = joinQueue.filter((e) => e.status === "queued");
  const playing = joinQueue.filter((e) => e.status === "playing");

  return c.json({
    success: true,
    queue: queued.map((e, i) => ({
      position: i + 1,
      address: e.address,
      name: e.name,
      joinedAt: e.joinedAt,
      waitTime: Math.floor((Date.now() - e.joinedAt) / 1000),
    })),
    playing: playing.map((e) => ({
      address: e.address,
      name: e.name,
    })),
    totalQueued: queued.length,
    totalPlaying: playing.length,
    activeBots: orchestrator.seatedAgents.length,
  });
});
