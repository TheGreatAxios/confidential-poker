import type { Address } from "viem";
import { config } from "../config.js";
import { publicClient, walletClient } from "../viem.js";
import { skaleBaseSepolia } from "../viem.js";
import { pokerGameAbi } from "../abis/PokerGame.js";
import { mockSklAbi } from "../abis/MockSKL.js";
import { PokerAgent } from "./agent.js";
import { ALL_AGENT_CONFIGS, ALL_POKER_AGENTS, AGENT_COLORS_MAP } from "./agents.js";
import type {
  OnChainGameState,
  PlayerInfo,
  CardData,
  GameState,
  FrontendAgentState,
} from "./types.js";
import { ActionType, GamePhase, PHASE_NAMES, decodeCard } from "./types.js";

/** Timeout for agent decisions (ms). */
const ACTION_TIMEOUT_MS = 10_000;
/** Delay between actions for visual effect (ms). */
const ACTION_DELAY_MS = 2_000;
/** Delay between phases (ms). */
const PHASE_DELAY_MS = 1_500;
/** Delay between hands (ms). */
const HAND_DELAY_MS = 5_000;

// ── In-Memory Table Registry ──

export interface TableRegistryEntry {
  id: string;
  tableId: bigint;
  creator: Address;
  smallBlind: bigint;
  bigBlind: bigint;
  minBuyIn: bigint;
  maxPlayers: number;
  playerCount: number;
  createdAt: number;
}

export interface HandResult {
  handNumber: number;
  winner: Address;
  winnerName: string;
  amount: bigint;
  actions: { agent: string; action: string; amount: string; message: string }[];
  phaseResults: { phase: string; communityCards: number[] }[];
}

/**
 * Game Orchestrator — manages the full hand lifecycle.
 *
 * The orchestrator is the "dealer" that:
 * 1. Creates tables on-chain
 * 2. Funds agents from the faucet
 * 3. Has agents approve and join tables
 * 4. Deals cards on-chain via revealCardsManually
 * 5. Collects actions from AI agents (with auto-fold timeout)
 * 6. Advances game phases
 * 7. Resolves showdowns
 * 8. Starts new hands automatically
 */
export class GameOrchestrator {
  private tableRegistry: Map<string, TableRegistryEntry> = new Map();
  private handHistory: HandResult[] = [];
  private activeTableId: string | null = null;
  private activeOnChainTableId: bigint | null = null;
  private isProcessing = false;
  private currentHandNumber = 0;
  private players: PokerAgent[] = [];
  private _gameRunning = false;
  private gameLoopTimer: ReturnType<typeof setTimeout> | null = null;
  private _lastGameState: GameState | null = null;

  // ── Table Registry ──

  registerTable(entry: TableRegistryEntry): void {
    this.tableRegistry.set(entry.id, entry);
  }

  getTable(id: string): TableRegistryEntry | undefined {
    return this.tableRegistry.get(id);
  }

  listTables(): TableRegistryEntry[] {
    return Array.from(this.tableRegistry.values());
  }

  // ── Hand History ──

  getHandHistory(limit = 20): HandResult[] {
    return this.handHistory.slice(-limit);
  }

  get latestGameState(): GameState | null {
    return this._lastGameState;
  }

  // ── Autonomous Game Loop ──

  /**
   * Start an autonomous game loop:
   * 1. Create table on-chain
   * 2. Fund each agent's wallet from faucet
   * 3. Have agents approve and join table
   * 4. Play hands in a loop
   */
  async startGame(): Promise<{
    success: boolean;
    message: string;
    tableId?: string;
  }> {
    if (this._gameRunning) {
      return { success: false, message: "Game is already running" };
    }

    // Check if contracts are deployed
    const isZeroAddr = (addr: string) =>
      addr === "0x0000000000000000000000000000000000000000";

    if (
      isZeroAddr(config.pokerGameAddress) ||
      isZeroAddr(config.mockSklAddress)
    ) {
      console.log("⚠️  Contracts not deployed, running in simulation mode");
      this._gameRunning = true;
      this.runSimulationLoop();
      return {
        success: true,
        message: "Simulation mode started (no contracts deployed)",
      };
    }

    try {
      // ── Step 1: Create table ──
      const buyIn = 1000n; // 1000 MockSKL buy-in
      const smallBlind = 50n;
      const bigBlind = 100n;
      const maxPlayers = 6;

      console.log("[Orchestrator] Creating table on-chain...");
      const txHash = await walletClient.writeContract({
        address: config.pokerGameAddress,
        abi: pokerGameAbi,
        functionName: "createTable",
        args: [buyIn, BigInt(maxPlayers), smallBlind, bigBlind],
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      // Use blockNumber as a fallback tableId since decodeEventLog is not available in viem v2
      const tableId = BigInt(this.tableRegistry.size);

      const tableIdStr = String(tableId);
      this.activeOnChainTableId = tableId;
      this.activeTableId = tableIdStr;

      this.registerTable({
        id: tableIdStr,
        tableId,
        creator: (await walletClient.getAddresses())[0],
        smallBlind,
        bigBlind,
        minBuyIn: buyIn,
        maxPlayers,
        playerCount: 0,
        createdAt: Date.now(),
      });

      console.log(`[Orchestrator] Table ${tableIdStr} created (tx: ${txHash})`);

      // ── Step 2: Fund each agent from faucet + approve + join ──
      const numAgents = Math.min(4, ALL_POKER_AGENTS.length); // Start with 4 agents
      this.players = ALL_POKER_AGENTS.slice(0, numAgents);

      for (let i = 0; i < this.players.length; i++) {
        const agent = this.players[i];
        const agentConfig = ALL_AGENT_CONFIGS[i];

        try {
          // Claim faucet tokens for this agent
          console.log(
            `[Orchestrator] Funding ${agent.emoji} ${agent.name} (${agentConfig.address.slice(0, 8)}...)`,
          );

          await (agent.wallet.writeContract as any)({
            address: config.mockSklAddress,
            abi: mockSklAbi,
            functionName: "faucet",
            args: [],
          });

          // Approve poker contract to spend tokens
          await (agent.wallet.writeContract as any)({
            address: config.mockSklAddress,
            abi: mockSklAbi,
            functionName: "approve",
            args: [config.pokerGameAddress, buyIn * 10n], // approve extra
          });

          // Join table
          await (agent.wallet.writeContract as any)({
            address: config.pokerGameAddress,
            abi: pokerGameAbi,
            functionName: "joinTable",
            args: [tableId, "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`, buyIn],
          });

          console.log(
            `  ✅ ${agent.emoji} ${agent.name} joined the table`,
          );
        } catch (err) {
          console.error(
            `  ❌ ${agent.emoji} ${agent.name} failed to join:`,
            err,
          );
        }
      }

      this._gameRunning = true;
      console.log("[Orchestrator] 🎰 Starting game loop...");
      this.runOnChainLoop();

      return {
        success: true,
        message: `Game started on table ${tableIdStr} with ${this.players.length} agents`,
        tableId: tableIdStr,
      };
    } catch (error) {
      console.error("[Orchestrator] Failed to start game:", error);
      return {
        success: false,
        message: `Failed to start game: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Stop the autonomous game loop.
   */
  stopGame(): { success: boolean; message: string } {
    if (!this._gameRunning) {
      return { success: false, message: "Game is not running" };
    }
    this._gameRunning = false;
    if (this.gameLoopTimer) {
      clearTimeout(this.gameLoopTimer);
      this.gameLoopTimer = null;
    }
    return { success: true, message: "Game stopped" };
  }

  /**
   * Get current game status.
   */
  getGameStatus(): {
    running: boolean;
    tableId: string | null;
    handNumber: number;
    players: { name: string; emoji: string; address: string }[];
    processing: boolean;
    history: HandResult[];
  } {
    return {
      running: this._gameRunning,
      tableId: this.activeTableId,
      handNumber: this.currentHandNumber,
      players: this.players.map((p) => ({
        name: p.name,
        emoji: p.emoji,
        address: p.address,
      })),
      processing: this.isProcessing,
      history: this.handHistory.slice(-10),
    };
  }

  // ── On-Chain Game Loop ──

  private async runOnChainLoop(): Promise<void> {
    if (!this._gameRunning || !this.activeOnChainTableId) return;

    try {
      const result = await this.playOnChainHand();
      if (result) {
        this.handHistory.push(result);
      }
    } catch (error) {
      console.error("[Orchestrator] Hand error:", error);
    }

    // Schedule next hand
    if (this._gameRunning) {
      this.gameLoopTimer = setTimeout(() => {
        this.runOnChainLoop();
      }, HAND_DELAY_MS);
    }
  }

  private async playOnChainHand(): Promise<HandResult | null> {
    if (!this.activeOnChainTableId) return null;
    const tableId = this.activeOnChainTableId;
    this.currentHandNumber++;
    this.isProcessing = true;

    try {
      // Start hand
      await walletClient.writeContract({
        address: config.pokerGameAddress,
        abi: pokerGameAbi,
        functionName: "startHandNoCTX",
        args: [tableId],
      });
      console.log(
        `[Orchestrator] Hand #${this.currentHandNumber} started`,
      );

      // Reveal cards
      await walletClient.writeContract({
        address: config.pokerGameAddress,
        abi: pokerGameAbi,
        functionName: "revealCardsManually",
        args: [tableId],
      });
      console.log("[Orchestrator] Cards revealed");

      const allActions: HandResult["actions"] = [];
      let gameState = await this.fetchGameState(tableId);

      // Play through all betting rounds
      while (
        gameState.phase >= GamePhase.PREFLOP &&
        gameState.phase <= GamePhase.RIVER
      ) {
        await this.playBettingRound(tableId, gameState, allActions);
        gameState = await this.fetchGameState(tableId);
        await this.delay(PHASE_DELAY_MS);
      }

      // Resolve winner
      const winner = await this.resolveWinner(tableId, gameState);
      const winnerAgent = this.players.find(
        (p) => p.address.toLowerCase() === winner.toLowerCase(),
      );

      const result: HandResult = {
        handNumber: this.currentHandNumber,
        winner,
        winnerName: winnerAgent?.name ?? "Unknown",
        amount: gameState.pot,
        actions: allActions,
        phaseResults: [],
      };

      console.log(
        `[Orchestrator] Hand #${this.currentHandNumber} complete. Winner: ${winnerAgent?.emoji ?? ""} ${winnerAgent?.name ?? winner} (${gameState.pot} tokens)`,
      );

      // Update last game state for frontend
      await this.updateFrontendGameState(tableId, gameState);

      return result;
    } catch (error) {
      console.error("[Orchestrator] On-chain hand failed:", error);
      return null;
    } finally {
      this.isProcessing = false;
    }
  }

  // ── Simulation Mode ──

  private async runSimulationLoop(): Promise<void> {
    if (!this._gameRunning) return;

    try {
      const result = await this.simulateHand();
      if (result) {
        this.handHistory.push(result);
      }
    } catch (error) {
      console.error("[Orchestrator] Simulation error:", error);
    }

    if (this._gameRunning) {
      this.gameLoopTimer = setTimeout(() => {
        this.runSimulationLoop();
      }, HAND_DELAY_MS);
    }
  }

  private async simulateHand(): Promise<HandResult> {
    this.currentHandNumber++;
    this.isProcessing = true;

    const numAgents = 4;
    this.players = ALL_POKER_AGENTS.slice(0, numAgents);

    const allActions: HandResult["actions"] = [];
    const phases = ["PREFLOP", "FLOP", "TURN", "RIVER"];
    const bigBlind = 100n;

    // Generate random cards for each agent
    const agentCards: number[][] = [];
    for (let i = 0; i < numAgents; i++) {
      agentCards.push([
        (Math.floor(Math.random() * 13) + 2) | (Math.floor(Math.random() * 4) << 4),
        (Math.floor(Math.random() * 13) + 2) | (Math.floor(Math.random() * 4) << 4),
      ]);
    }

    console.log(
      `[Orchestrator] Simulating hand #${this.currentHandNumber} with ${numAgents} agents`,
    );

    const agentStates: FrontendAgentState[] = this.players.map((agent, i) => ({
      id: i + 1,
      name: agent.name,
      emoji: agent.emoji,
      color: AGENT_COLORS_MAP[String(i + 1)] ?? "#666",
      personality: ALL_AGENT_CONFIGS[i]?.personality ?? "aggressive",
      stack: Number(1000n - BigInt(i * 50)),
      currentBet: 0,
      cards: [
        { rank: agentCards[i][0] & 0x0f, suit: (agentCards[i][0] >> 4) & 0x03, encrypted: false },
        { rank: agentCards[i][1] & 0x0f, suit: (agentCards[i][1] >> 4) & 0x03, encrypted: false },
      ],
      action: "Wait",
      folded: false,
      allIn: false,
      isDealer: i === 0,
      isSB: i === 1,
      isBB: i === 2,
      isActive: i === 3,
      isWinner: false,
    }));

    // Generate community cards
    const communityCards: CardData[] = [];
    const communityRaw: bigint[] = [];
    for (let c = 0; c < 5; c++) {
      const card = (Math.floor(Math.random() * 13) + 2) | (Math.floor(Math.random() * 4) << 4);
      communityRaw.push(BigInt(card));
      communityCards.push({ rank: card & 0x0f, suit: (card >> 4) & 0x03, encrypted: false });
    }

    for (let phaseIdx = 0; phaseIdx < phases.length; phaseIdx++) {
      const phase = phases[phaseIdx];
      console.log(`[Orchestrator] ${phase} phase`);

      // Update community cards shown
      const visibleCommunity = communityCards.slice(0, [0, 3, 4, 5][phaseIdx]);

      for (let i = 0; i < this.players.length; i++) {
        const agent = this.players[i];
        const simState: OnChainGameState = {
          phase: phaseIdx + 1,
          pot: BigInt(this.currentHandNumber * 400 + i * 100),
          currentBet: bigBlind,
          dealerIndex: this.currentHandNumber % this.players.length,
          currentPlayerIndex: i,
          communityCards: communityRaw.slice(0, [0, 3, 4, 5][phaseIdx]),
        };

        const simPlayer: PlayerInfo = {
          player: agent.address,
          balance: BigInt(1000 * (i + 1)),
          currentBet: bigBlind * BigInt(i),
          isFolded: false,
          isAllIn: false,
          card1: BigInt(agentCards[i][0]),
          card2: BigInt(agentCards[i][1]),
        };

        const potOdds = 0.15 + Math.random() * 0.3;
        const decision = agent.decideAction(
          simState,
          simPlayer,
          bigBlind * 2n,
          potOdds,
        );

        const message = agent.getChatMessage(simState, simPlayer, decision.action);
        const actionName = ActionType[decision.action] ?? "UNKNOWN";

        agentStates[i].action = actionName;
        agentStates[i].currentBet = Number(decision.amount);
        agentStates[i].isActive = true;
        if (decision.action === ActionType.FOLD) {
          agentStates[i].folded = true;
        }

        allActions.push({
          agent: agent.name,
          action: actionName,
          amount: decision.amount.toString(),
          message,
        });

        console.log(
          `  ${agent.emoji} ${agent.name}: ${actionName}${decision.amount > 0n ? ` ${decision.amount}` : ""} — ${message}`,
        );

        await this.delay(ACTION_DELAY_MS);
      }

      await this.delay(PHASE_DELAY_MS);
    }

    // Random winner (from non-folded agents)
    const nonFolded = agentStates.filter((a) => !a.folded);
    const winnerIdx = Math.floor(Math.random() * nonFolded.length);
    const winner = nonFolded[winnerIdx];
    if (winner) {
      winner.isWinner = true;
      winner.stack += numAgents * 200;
    }

    // Update frontend state
    this._lastGameState = {
      id: "sim-" + this.currentHandNumber,
      handNumber: this.currentHandNumber,
      phase: "Showdown",
      pot: numAgents * 200,
      communityCards,
      agents: agentStates,
      deckCount: 52 - numAgents * 2 - 5,
      isRunning: true,
    };

    const result: HandResult = {
      handNumber: this.currentHandNumber,
      winner: winner ? `0x_sim_${winner.id}` : ("0x0000000000000000000000000000000000000000" as Address),
      winnerName: winner?.name ?? "Unknown",
      amount: BigInt(numAgents * 200),
      actions: allActions,
      phaseResults: phases.map((p) => ({ phase: p, communityCards: [] })),
    };

    console.log(
      `[Orchestrator] Hand #${this.currentHandNumber} complete. Winner: ${winner?.emoji ?? ""} ${winner?.name ?? "Unknown"}`,
    );

    return result;
  }

  // ── Betting Round Logic ──

  private async playBettingRound(
    tableId: bigint,
    gameState: OnChainGameState,
    allActions: HandResult["actions"],
    bigBlind: bigint = 100n,
  ): Promise<void> {
    let roundComplete = false;
    let currentPlayer = gameState.currentPlayerIndex;
    const actedPlayers = new Set<number>();

    while (!roundComplete) {
      gameState = await this.fetchGameState(tableId);

      if (gameState.phase > GamePhase.RIVER) break;

      // Check if only one player remains
      const activeCount = await this.fetchActivePlayerCount(tableId);
      if (activeCount <= 1) break;

      currentPlayer = gameState.currentPlayerIndex;

      if (
        actedPlayers.has(currentPlayer) &&
        gameState.currentBet === 0n
      ) {
        roundComplete = true;
        break;
      }

      const playerInfo = await this.fetchPlayerInfo(tableId, currentPlayer);
      if (playerInfo.isFolded || playerInfo.isAllIn) {
        actedPlayers.add(currentPlayer);
        continue;
      }

      const agent = this.players[currentPlayer];
      if (!agent) {
        actedPlayers.add(currentPlayer);
        continue;
      }

      const toCall = gameState.currentBet - playerInfo.currentBet;
      const potOdds =
        gameState.pot > 0n && toCall > 0n
          ? Number(toCall) / Number(gameState.pot + toCall)
          : 0;
      const minRaise = gameState.currentBet + bigBlind;

      const decision = await this.withTimeout(
        Promise.resolve(agent.decideAction(gameState, playerInfo, minRaise, potOdds)),
        ACTION_TIMEOUT_MS,
        { action: ActionType.FOLD, amount: 0n },
      );

      // Submit action on-chain using the agent's wallet
      await (agent.wallet.writeContract as any)({
        address: config.pokerGameAddress,
        abi: pokerGameAbi,
        functionName: "submitAction",
        args: [tableId, decision.action, decision.amount],
      });

      const message = agent.getChatMessage(gameState, playerInfo, decision.action);

      allActions.push({
        agent: agent.name,
        action: ActionType[decision.action],
        amount: decision.amount.toString(),
        message,
      });

      console.log(
        `[Orchestrator] ${agent.emoji} ${agent.name}: ${ActionType[decision.action]}${decision.amount > 0n ? ` ${decision.amount}` : ""} — ${message}`,
      );

      actedPlayers.add(currentPlayer);
      await this.delay(ACTION_DELAY_MS);
    }
  }

  // ── Frontend State Builder ──

  private async updateFrontendGameState(
    tableId: bigint,
    chainState: OnChainGameState,
  ): Promise<void> {
    try {
      const playerCount = await publicClient.readContract({
        address: config.pokerGameAddress,
        abi: pokerGameAbi,
        functionName: "getPlayerCount",
        args: [tableId],
      });

      const agents: FrontendAgentState[] = [];

      for (let i = 0; i < Number(playerCount); i++) {
        const info = (await publicClient.readContract({
          address: config.pokerGameAddress,
          abi: pokerGameAbi,
          functionName: "getPlayerInfo",
          args: [tableId, BigInt(i)],
        })) as unknown as PlayerInfo;

        const agentConfig = ALL_AGENT_CONFIGS.find(
          (c) => c.address.toLowerCase() === info.player.toLowerCase(),
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

      this._lastGameState = {
        id: this.activeTableId ?? "unknown",
        handNumber: this.currentHandNumber,
        phase: PHASE_NAMES[chainState.phase] ?? "Unknown",
        pot: Number(chainState.pot),
        communityCards,
        agents,
        deckCount: 52 - agents.length * 2 - communityCards.length,
        isRunning: true,
      };
    } catch (error) {
      console.error("[Orchestrator] Failed to build frontend state:", error);
    }
  }

  // ── Blockchain Helpers ──

  private async fetchGameState(tableId: bigint): Promise<OnChainGameState> {
    try {
      const state = await publicClient.readContract({
        address: config.pokerGameAddress,
        abi: pokerGameAbi,
        functionName: "getGameState",
        args: [tableId],
      });
      return state as unknown as OnChainGameState;
    } catch {
      return {
        phase: GamePhase.WAITING,
        pot: 0n,
        currentBet: 0n,
        dealerIndex: 0,
        currentPlayerIndex: 0,
        communityCards: [],
      };
    }
  }

  private async fetchPlayerInfo(
    tableId: bigint,
    playerIndex: number,
  ): Promise<PlayerInfo> {
    try {
      const info = await publicClient.readContract({
        address: config.pokerGameAddress,
        abi: pokerGameAbi,
        functionName: "getPlayerInfo",
        args: [tableId, BigInt(playerIndex)],
      });
      return info as unknown as PlayerInfo;
    } catch {
      return {
        player: "0x0000000000000000000000000000000000000000" as Address,
        balance: 0n,
        currentBet: 0n,
        isFolded: true,
        isAllIn: false,
        card1: 0n,
        card2: 0n,
      };
    }
  }

  private async fetchActivePlayerCount(tableId: bigint): Promise<number> {
    try {
      const count = await publicClient.readContract({
        address: config.pokerGameAddress,
        abi: pokerGameAbi,
        functionName: "getActivePlayerCount",
        args: [tableId],
      });
      return Number(count);
    } catch {
      return 0;
    }
  }

  private async resolveWinner(
    tableId: bigint,
    gameState: OnChainGameState,
  ): Promise<Address> {
    try {
      const playerCount = await publicClient.readContract({
        address: config.pokerGameAddress,
        abi: pokerGameAbi,
        functionName: "getPlayerCount",
        args: [tableId],
      });

      for (let i = 0; i < Number(playerCount); i++) {
        const info = (await publicClient.readContract({
          address: config.pokerGameAddress,
          abi: pokerGameAbi,
          functionName: "getPlayerInfo",
          args: [tableId, BigInt(i)],
        })) as unknown as PlayerInfo;

        if (!info.isFolded) {
          return info.player;
        }
      }
    } catch {
      // Fallback
    }

    return "0x0000000000000000000000000000000000000000" as Address;
  }

  // ── Utilities ──

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    fallback: T,
  ): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms);
      }),
    ]).finally(() => clearTimeout(timer));
  }

  /** Whether a hand is currently being processed. */
  get processing(): boolean {
    return this.isProcessing;
  }

  /** Whether the autonomous game loop is running. */
  get gameRunning(): boolean {
    return this._gameRunning;
  }
}

// ── Singleton ──
export const orchestrator = new GameOrchestrator();

// ── Module-Level Convenience Exports ──

export async function startGame() {
  return orchestrator.startGame();
}

export function stopGame() {
  return orchestrator.stopGame();
}

export function getGameStatus() {
  return orchestrator.getGameStatus();
}
