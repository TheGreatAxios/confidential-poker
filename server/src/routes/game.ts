import { Hono } from "hono";
import { config } from "../config.js";
import { publicClient, walletClient } from "../viem.js";
import { pokerTableAbi } from "../abis/PokerTable.js";
import type { Address } from "viem";
import { orchestrator } from "../agents/orchestrator.js";

const game = new Hono();

// ── Auth Middleware ──

function checkAuth(c: any): boolean {
  const auth = c.req.header("Authorization");
  if (!auth || auth !== `Bearer ${config.apiKey}`) {
    return false;
  }
  return true;
}

function unauthorized(c: any) {
  return c.json({ error: "Unauthorized. Provide Authorization: Bearer <API_KEY> header." }, 401);
}

// ── GET /api/table — Full table state (public) ──

game.get("/api/table", async (c) => {
  try {
    const results = await Promise.all([
      publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "phase" }),
      publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "pot" }),
      publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "handCount" }),
      publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "dealerIndex" }),
      publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "activePlayerIndex" }),
      publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "smallBlind" }),
      publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "bigBlind" }),
      publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "maxPlayers" }),
      publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "minBuyIn" }),
      publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "currentMaxBet" }),
      publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "getPlayers" }),
      publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "getCommunityCards" }),
      publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "getSeatedPlayerCount" }),
      publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "getActivePlayerCount" }),
    ]);

    const [phaseNum, pot, handCount, dealerIndex, activePlayerIndex, smallBlind, bigBlind, maxPlayers, minBuyIn, currentMaxBet, rawPlayers, rawCommunityCards, seatedCount, activeCount] = results;

    type RawPlayer = {
      addr: Address;
      viewerKey: `0x${string}`;
      stack: bigint;
      currentBet: bigint;
      folded: boolean;
      hasActed: boolean;
      isSeated: boolean;
      holeCards: readonly [number, number];
    };

    const phaseNames = ["Waiting", "Pre-Flop", "Flop", "Turn", "River", "Showdown", "Finished"];
    const phaseName = phaseNames[Number(phaseNum)] ?? "Unknown";

    const players = (rawPlayers as unknown as RawPlayer[]).map((p, i) => ({
      index: i,
      address: p.addr,
      stack: p.stack.toString(),
      currentBet: p.currentBet.toString(),
      folded: p.folded,
      hasActed: p.hasActed,
      isSeated: p.isSeated,
      holeCards: [Number(p.holeCards[0]), Number(p.holeCards[1])],
    }));

    const communityCards = Array.isArray(rawCommunityCards)
      ? (rawCommunityCards as bigint[]).map(Number)
      : [];

    return c.json({
      contract: config.pokerTableAddress,
      phase: Number(phaseNum),
      phaseName,
      pot: (pot as bigint).toString(),
      handCount: (handCount as bigint).toString(),
      dealerIndex: (dealerIndex as bigint).toString(),
      activePlayerIndex: (activePlayerIndex as bigint).toString(),
      smallBlind: (smallBlind as bigint).toString(),
      bigBlind: (bigBlind as bigint).toString(),
      maxPlayers: (maxPlayers as bigint).toString(),
      minBuyIn: (minBuyIn as bigint).toString(),
      currentMaxBet: (currentMaxBet as bigint).toString(),
      players,
      communityCards,
      seatedPlayerCount: Number(seatedCount),
      activePlayerCount: Number(activeCount),
    });
  } catch (error) {
    return c.json({
      error: "Failed to read table state",
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

// ── GET /api/table/history — Hand history from events (public) ──

game.get("/api/table/history", async (c) => {
  try {
    const currentBlock = await publicClient.getBlockNumber();
    const fromBlock = currentBlock > 10000n ? currentBlock - 10000n : 0n;

    // Fetch ShowdownComplete and HandFinished events
    const showdownLogs = await publicClient.getContractEvents({
      address: config.pokerTableAddress,
      abi: pokerTableAbi,
      eventName: "ShowdownComplete",
      fromBlock,
      toBlock: "latest",
    });

    const handFinishedLogs = await publicClient.getContractEvents({
      address: config.pokerTableAddress,
      abi: pokerTableAbi,
      eventName: "HandFinished",
      fromBlock,
      toBlock: "latest",
    });

    type ShowdownEvent = { winner: string; pot: bigint; winningHand: string; winningScore: bigint };
    type HandFinishedEvent = { handNumber: bigint };

    const showdowns = showdownLogs.map((log) => {
      const args = log.args as unknown as ShowdownEvent;
      return {
        type: "ShowdownComplete",
        winner: args.winner,
        pot: args.pot?.toString() ?? "0",
        winningHand: args.winningHand ?? "",
        winningScore: args.winningScore?.toString() ?? "0",
        blockNumber: log.blockNumber.toString(),
        txHash: log.transactionHash,
      };
    });

    const handFinished = handFinishedLogs.map((log) => {
      const args = log.args as unknown as HandFinishedEvent;
      return {
        type: "HandFinished",
        handNumber: args.handNumber?.toString() ?? "0",
        blockNumber: log.blockNumber.toString(),
        txHash: log.transactionHash,
      };
    });

    return c.json({
      showdowns,
      handFinished,
      total: showdowns.length + handFinished.length,
    });
  } catch (error) {
    return c.json({
      error: "Failed to fetch hand history",
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

// ── POST /api/sit-down — Sit down at the table (auth required) ──

game.post("/api/sit-down", async (c) => {
  if (!checkAuth(c)) return unauthorized(c);

  try {
    const body = await c.req.json().catch(() => ({}));
    const viewerKey = (body.viewerKey ?? "0x0000000000000000000000000000000000000000000000000000000000000000") as `0x${string}`;
    const value = body.value ? BigInt(body.value) : 10000000000000000n; // Default 0.01 ETH

    const hash = await walletClient.writeContract({
      address: config.pokerTableAddress,
      abi: pokerTableAbi,
      functionName: "sitDown",
      args: [viewerKey],
      value,
      gasPrice: config.gasPrice,
    });

    await publicClient.waitForTransactionReceipt({ hash });

    return c.json({ success: true, txHash: hash, viewerKey, value: value.toString() });
  } catch (error) {
    return c.json({
      error: "Failed to sit down",
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

// ── POST /api/leave — Leave the table (auth required) ──

game.post("/api/leave", async (c) => {
  if (!checkAuth(c)) return unauthorized(c);

  try {
    const hash = await walletClient.writeContract({
      address: config.pokerTableAddress,
      abi: pokerTableAbi,
      functionName: "leaveTable",
      gasPrice: config.gasPrice,
    });

    await publicClient.waitForTransactionReceipt({ hash });

    return c.json({ success: true, txHash: hash });
  } catch (error) {
    return c.json({
      error: "Failed to leave table",
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

// ── POST /api/deal — Deal a new hand (auth required) ──

game.post("/api/deal", async (c) => {
  if (!checkAuth(c)) return unauthorized(c);

  try {
    const hash = await walletClient.writeContract({
      address: config.pokerTableAddress,
      abi: pokerTableAbi,
      functionName: "dealNewHand",
      gasPrice: config.gasPrice,
    });

    await publicClient.waitForTransactionReceipt({ hash });

    return c.json({ success: true, txHash: hash });
  } catch (error) {
    return c.json({
      error: "Failed to deal new hand",
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

// ── POST /api/action — Execute a game action (auth required) ──

game.post("/api/action", async (c) => {
  if (!checkAuth(c)) return unauthorized(c);

  try {
    const body = await c.req.json();
    const { action, amount } = body;

    if (!action || !["fold", "check", "call", "raise"].includes(action)) {
      return c.json({ error: "Invalid action. Use: fold, check, call, raise" }, 400);
    }

    let hash: `0x${string}` | undefined;

    switch (action) {
      case "fold":
        hash = await walletClient.writeContract({
          address: config.pokerTableAddress,
          abi: pokerTableAbi,
          functionName: "fold",
          gasPrice: config.gasPrice,
        });
        break;
      case "check":
        hash = await walletClient.writeContract({
          address: config.pokerTableAddress,
          abi: pokerTableAbi,
          functionName: "check",
          gasPrice: config.gasPrice,
        });
        break;
      case "call":
        hash = await walletClient.writeContract({
          address: config.pokerTableAddress,
          abi: pokerTableAbi,
          functionName: "call",
          gasPrice: config.gasPrice,
        });
        break;
      case "raise":
        if (amount === undefined || amount === null) {
          return c.json({ error: "raise action requires 'amount' field" }, 400);
        }
        hash = await walletClient.writeContract({
          address: config.pokerTableAddress,
          abi: pokerTableAbi,
          functionName: "raise",
          args: [BigInt(amount)],
          gasPrice: config.gasPrice,
        });
        break;
    }

    if (!hash) {
      return c.json({ error: "No transaction was created" }, 500);
    }

    await publicClient.waitForTransactionReceipt({ hash });

    return c.json({ success: true, action, amount: amount?.toString() ?? null, txHash: hash });
  } catch (error) {
    return c.json({
      error: "Failed to execute game action",
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

// ── POST /api/resolve — Resolve hand after revealCards (auth required) ──

game.post("/api/resolve", async (c) => {
  if (!checkAuth(c)) return unauthorized(c);

  try {
    const hash = await walletClient.writeContract({
      address: config.pokerTableAddress,
      abi: pokerTableAbi,
      functionName: "resolveHand",
      gasPrice: config.gasPrice,
    });

    await publicClient.waitForTransactionReceipt({ hash });

    return c.json({ success: true, txHash: hash });
  } catch (error) {
    return c.json({
      error: "Failed to resolve hand",
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

// ── POST /api/force-fold — Force-fold timed-out player (auth required) ──

game.post("/api/force-fold", async (c) => {
  if (!checkAuth(c)) return unauthorized(c);

  try {
    const hash = await walletClient.writeContract({
      address: config.pokerTableAddress,
      abi: pokerTableAbi,
      functionName: "forceFold",
      gasPrice: config.gasPrice,
    });

    await publicClient.waitForTransactionReceipt({ hash });

    return c.json({ success: true, txHash: hash });
  } catch (error) {
    return c.json({
      error: "Failed to force-fold",
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

// ── Bot Control Endpoints ──

// POST /api/bot/start — Start autonomous bot loop (auth required)
game.post("/api/bot/start", async (c) => {
  if (!checkAuth(c)) return unauthorized(c);

  try {
    const body = await c.req.json().catch(() => ({}));
    const numBots = body.numBots ?? 4;
    const result = await orchestrator.start(Number(numBots));
    return c.json(result);
  } catch (error) {
    return c.json({
      error: "Failed to start bot",
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
});

// POST /api/bot/stop — Stop bot loop (auth required)
game.post("/api/bot/stop", async (c) => {
  if (!checkAuth(c)) return unauthorized(c);

  const result = orchestrator.stop();
  return c.json(result);
});

// POST /api/bot/status — Bot status (auth required)
game.post("/api/bot/status", async (c) => {
  if (!checkAuth(c)) return unauthorized(c);

  return c.json(orchestrator.getStatus());
});

export default game;
