import { Hono } from "hono";
import { config } from "../config.js";
import { publicClient, walletClient } from "../viem.js";
import { pokerGameAbi } from "../abis/PokerGame.js";
import { mockSklAbi } from "../abis/MockSKL.js";
import { orchestrator } from "../agents/orchestrator.js";
import {
  ALL_AGENT_CONFIGS,
  AGENT_COLORS_MAP,
} from "../agents/agents.js";
import type {
  OnChainGameState,
  PlayerInfo,
  CardData,
  GameState,
  FrontendAgentState,
  AgentConfig,
} from "../agents/types.js";
import { PHASE_NAMES, decodeCard } from "../agents/types.js";

const game = new Hono();

// ── GET /api/game/:id — Get game state for the frontend ──
// Frontend calls GET /api/game/current

game.get("/api/game/:id", async (c) => {
  const gameId = c.req.param("id");

  // If the orchestrator has a running game, return its state
  const latestState = orchestrator.latestGameState;
  if (latestState && (gameId === "current" || gameId === latestState.id)) {
    return c.json(latestState);
  }

  // Otherwise, try to read from the on-chain contract
  const isZeroAddr = (addr: string) =>
    addr === "0x0000000000000000000000000000000000000000";

  if (isZeroAddr(config.pokerGameAddress)) {
    // No contract deployed — return demo state
    return c.json(getDemoGameState(gameId));
  }

  // Read from chain
  try {
    const tableId = BigInt(gameId === "current" ? "0" : gameId);
    const chainState = (await publicClient.readContract({
      address: config.pokerGameAddress,
      abi: pokerGameAbi,
      functionName: "getGameState",
      args: [tableId],
    })) as unknown as OnChainGameState;

    const playerCount = (await publicClient.readContract({
      address: config.pokerGameAddress,
      abi: pokerGameAbi,
      functionName: "getPlayerCount",
      args: [tableId],
    })) as bigint;

    const agents: FrontendAgentState[] = [];
    for (let i = 0; i < Number(playerCount); i++) {
      const info = (await publicClient.readContract({
        address: config.pokerGameAddress,
        abi: pokerGameAbi,
        functionName: "getPlayerInfo",
        args: [tableId, BigInt(i)],
      })) as unknown as PlayerInfo;

      const agentConfig = ALL_AGENT_CONFIGS.find(
        (ac: AgentConfig) => ac.address.toLowerCase() === info.player.toLowerCase(),
      );

      agents.push({
        id: i + 1,
        name: agentConfig?.name ?? `Player ${i + 1}`,
        emoji: agentConfig?.emoji ?? "👤",
        color: AGENT_COLORS_MAP[String(i + 1)] ?? "#666",
        personality: agentConfig?.personality ?? "unknown",
        stack: Number(info.balance),
        currentBet: Number(info.currentBet),
        cards: [
          decodeCard(Number(info.card1)),
          decodeCard(Number(info.card2)),
        ],
        action: info.isFolded ? "Fold" : "Wait",
        folded: info.isFolded,
        allIn: info.isAllIn,
        isDealer: i === chainState.dealerIndex,
        isSB: i === (chainState.dealerIndex + 1) % Number(playerCount),
        isBB: i === (chainState.dealerIndex + 2) % Number(playerCount),
        isActive: i === chainState.currentPlayerIndex,
        isWinner: false,
      });
    }

    const communityCards: CardData[] = chainState.communityCards.map((c) =>
      decodeCard(Number(c)),
    );

    const gameState: GameState = {
      id: gameId,
      handNumber: orchestrator.getGameStatus().handNumber,
      phase: PHASE_NAMES[chainState.phase] ?? "Unknown",
      pot: Number(chainState.pot),
      communityCards,
      agents,
      deckCount: 52 - agents.length * 2 - communityCards.length,
      isRunning: orchestrator.gameRunning,
    };

    return c.json(gameState);
  } catch (error) {
    return c.json(
      {
        error: "Failed to fetch game state",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// ── GET /api/game/state/:tableId — Raw on-chain game state ──

game.get("/api/game/state/:tableId", async (c) => {
  const tableId = BigInt(c.req.param("tableId"));

  try {
    const [chainState, playerCount, communityCards] = await Promise.all([
      publicClient.readContract({
        address: config.pokerGameAddress,
        abi: pokerGameAbi,
        functionName: "getGameState",
        args: [tableId],
      }) as Promise<unknown>,
      publicClient.readContract({
        address: config.pokerGameAddress,
        abi: pokerGameAbi,
        functionName: "getPlayerCount",
        args: [tableId],
      }),
      publicClient.readContract({
        address: config.pokerGameAddress,
        abi: pokerGameAbi,
        functionName: "getCommunityCards",
        args: [tableId],
      }) as Promise<bigint[]>,
    ]);

    const state = chainState as unknown as OnChainGameState;

    const players: PlayerInfo[] = [];
    for (let i = 0; i < Number(playerCount); i++) {
      const info = (await publicClient.readContract({
        address: config.pokerGameAddress,
        abi: pokerGameAbi,
        functionName: "getPlayerInfo",
        args: [tableId, BigInt(i)],
      })) as unknown as PlayerInfo;
      players.push(info);
    }

    return c.json({
      tableId: tableId.toString(),
      phase: state.phase,
      phaseName: PHASE_NAMES[state.phase] ?? "Unknown",
      pot: state.pot.toString(),
      currentBet: state.currentBet.toString(),
      dealerIndex: state.dealerIndex,
      currentPlayerIndex: state.currentPlayerIndex,
      communityCards: communityCards.map((c) => decodeCard(Number(c))),
      players: players.map((p, i) => ({
        index: i,
        address: p.player,
        balance: p.balance.toString(),
        currentBet: p.currentBet.toString(),
        isFolded: p.isFolded,
        isAllIn: p.isAllIn,
        card1: p.card1.toString(),
        card2: p.card2.toString(),
        cards: [decodeCard(Number(p.card1)), decodeCard(Number(p.card2))],
      })),
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to fetch game state from contract",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// ── POST /api/game/create — Create a new table ──

game.post("/api/game/create", async (c) => {
  try {
    const body = await c.req.json();
    const { smallBlind, bigBlind, minBuyIn, maxPlayers } = body;

    if (smallBlind === undefined || bigBlind === undefined || minBuyIn === undefined || maxPlayers === undefined) {
      return c.json({ error: "Missing required fields: smallBlind, bigBlind, minBuyIn, maxPlayers" }, 400);
    }

    const hash = await walletClient.writeContract({
      address: config.pokerGameAddress,
      abi: pokerGameAbi,
      functionName: "createTable",
      args: [BigInt(minBuyIn), BigInt(maxPlayers), BigInt(smallBlind), BigInt(bigBlind)],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Try to extract tableId from events
    let tableId = orchestrator.listTables().length; // Fallback

    if (receipt.logs && receipt.logs.length > 0) {
      for (const log of receipt.logs) {
        try {
          // Try to extract tableId from event topics (TableCreated event)
          // Topic[0] is the event signature hash
          if (log.topics && log.topics.length > 1) {
            tableId = Number(log.topics[1]);
          }
        } catch {
          // Not our event
        }
      }
    }

    const tableIdStr = String(tableId);

    orchestrator.registerTable({
      id: tableIdStr,
      tableId: BigInt(tableId),
      creator: (await walletClient.getAddresses())[0],
      smallBlind: BigInt(smallBlind),
      bigBlind: BigInt(bigBlind),
      minBuyIn: BigInt(minBuyIn),
      maxPlayers: Number(maxPlayers),
      playerCount: 0,
      createdAt: Date.now(),
    });

    return c.json({
      success: true,
      tableId: tableIdStr,
      txHash: hash,
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to create table",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// ── POST /api/game/join — Join a table ──

game.post("/api/game/join", async (c) => {
  try {
    const body = await c.req.json();
    const { tableId, buyIn } = body;

    if (tableId === undefined || buyIn === undefined) {
      return c.json({ error: "Missing required fields: tableId, buyIn" }, 400);
    }

    const zeroHash = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

    const hash = await walletClient.writeContract({
      address: config.pokerGameAddress,
      abi: pokerGameAbi,
      functionName: "joinTable",
      args: [BigInt(tableId), zeroHash, BigInt(buyIn)],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    return c.json({
      success: true,
      tableId,
      buyIn,
      txHash: hash,
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to join table",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// ── POST /api/game/start — Start a hand ──

game.post("/api/game/start", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const tableId = body.tableId ?? orchestrator.listTables()[0]?.tableId;

    if (tableId === undefined) {
      return c.json({ error: "No table available. Create one first." }, 400);
    }

    const hash = await walletClient.writeContract({
      address: config.pokerGameAddress,
      abi: pokerGameAbi,
      functionName: "startHandNoCTX",
      args: [BigInt(tableId)],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    return c.json({
      success: true,
      tableId,
      txHash: hash,
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to start hand",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// ── POST /api/game/reveal — Reveal cards manually ──

game.post("/api/game/reveal", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const tableId = body.tableId ?? orchestrator.listTables()[0]?.tableId;

    if (tableId === undefined) {
      return c.json({ error: "No table available." }, 400);
    }

    const hash = await walletClient.writeContract({
      address: config.pokerGameAddress,
      abi: pokerGameAbi,
      functionName: "revealCardsManually",
      args: [BigInt(tableId)],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    return c.json({
      success: true,
      tableId,
      txHash: hash,
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to reveal cards",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// ── POST /api/game/action — Submit a player action ──

game.post("/api/game/action", async (c) => {
  try {
    const body = await c.req.json();
    const { tableId, actionType, amount } = body;

    if (tableId === undefined || actionType === undefined) {
      return c.json({ error: "Missing required fields: tableId, actionType" }, 400);
    }

    // actionType: 0=fold, 1=check, 2=call, 3=raise
    const actionMap: Record<string, number> = {
      fold: 0,
      check: 1,
      call: 2,
      raise: 3,
    };
    const numericAction =
      typeof actionType === "string"
        ? actionMap[actionType.toLowerCase()] ?? Number(actionType)
        : Number(actionType);

    if (![0, 1, 2, 3].includes(numericAction)) {
      return c.json({ error: "Invalid actionType. Use 0-3 or fold/check/call/raise" }, 400);
    }

    const hash = await walletClient.writeContract({
      address: config.pokerGameAddress,
      abi: pokerGameAbi,
      functionName: "submitAction",
      args: [BigInt(tableId), numericAction, BigInt(amount ?? 0)],
    });

    await publicClient.waitForTransactionReceipt({ hash });

    const actionNames = ["fold", "check", "call", "raise"];

    return c.json({
      success: true,
      tableId,
      action: actionNames[numericAction],
      amount: amount ?? 0,
      txHash: hash,
    });
  } catch (error) {
    return c.json(
      {
        error: "Failed to submit action",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});

// ── GET /api/game/tables — List known tables ──

game.get("/api/game/tables", async (c) => {
  return c.json({
    tables: orchestrator.listTables(),
    activeTable: orchestrator.getGameStatus(),
  });
});

// ── Helpers ──

function getDemoGameState(gameId: string): GameState {
  return {
    id: gameId,
    handNumber: 1,
    phase: "Pre-Flop",
    pot: 450,
    communityCards: [],
    agents: ALL_AGENT_CONFIGS.slice(0, 4).map((agent, i) => ({
      id: i + 1,
      name: agent.name,
      emoji: agent.emoji,
      color: AGENT_COLORS_MAP[agent.id] ?? "#666",
      personality: agent.personality,
      stack: [9200, 9800, 8550, 10000][i],
      currentBet: [100, 50, 200, 0][i],
      cards: [
        { rank: 14 - i, suit: i, encrypted: true },
        { rank: 13 - i, suit: (i + 1) % 4, encrypted: true },
      ],
      action: ["Raise", "Call", "Raise", "Wait"][i],
      folded: false,
      allIn: false,
      isDealer: i === 0,
      isSB: i === 1,
      isBB: i === 2,
      isActive: i === 3,
      isWinner: false,
    })),
    deckCount: 44,
    isRunning: orchestrator.gameRunning,
  };
}

export default game;
