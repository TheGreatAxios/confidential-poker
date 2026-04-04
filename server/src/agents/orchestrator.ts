import type { Address } from "viem";
import { config } from "../config.js";
import { publicClient, skaleBaseSepolia } from "../viem.js";
import { pokerTableAbi } from "../abis/PokerTable.js";
import { PokerAgent } from "./agent.js";
import { ALL_POKER_AGENTS, ALL_AGENT_CONFIGS } from "./agents.js";
import type { OnChainGameState, PlayerInfo } from "./types.js";
import { ActionType, GamePhase } from "./types.js";

/** Polling interval for bot loop (ms). */
const POLL_INTERVAL_MS = 3_000;
/** Delay between actions for visual effect (ms). */
const ACTION_DELAY_MS = 1_500;
/** Delay after a hand finishes before dealing next (ms). */
const HAND_DELAY_MS = 5_000;
/** Timeout for agent decisions (ms). */
const ACTION_TIMEOUT_MS = 10_000;
/** How long before force-folding a timed-out player (ms). */
const FORCE_FOLD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Bot Orchestrator — manages autonomous bot gameplay against PokerTable.sol.
 *
 * The orchestrator:
 * 1. Has bot agents sitDown() with ETH buy-in
 * 2. Polls contract state to detect its turn
 * 3. Uses PokerAgent.decideAction() to decide, then calls fold()/check()/call()/raise()
 * 4. When phase is Finished, calls dealNewHand() after a delay
 * 5. Uses forceFold() when a player times out
 */
export class BotOrchestrator {
  private _running = false;
  private _processing = false;
  private _loopTimer: ReturnType<typeof setInterval> | null = null;
  private _handNumber = 0;
  private _botPlayers: PokerAgent[] = [];

  /** Which agents are seated at the table. */
  private _seatedAgents: Map<string, PokerAgent> = new Map();

  get running(): boolean {
    return this._running;
  }

  get processing(): boolean {
    return this._processing;
  }

  get handNumber(): number {
    return this._handNumber;
  }

  get seatedAgents(): PokerAgent[] {
    return Array.from(this._seatedAgents.values());
  }

  get botPlayers(): PokerAgent[] {
    return this._botPlayers;
  }

  /**
   * Start the autonomous bot loop with the given number of bots.
   */
  async start(numBots: number = 4): Promise<{ success: boolean; message: string }> {
    if (this._running) {
      return { success: false, message: "Bot loop is already running" };
    }

    const count = Math.min(numBots, ALL_POKER_AGENTS.length);
    this._botPlayers = ALL_POKER_AGENTS.slice(0, count);

    // Sit down each bot
    for (const agent of this._botPlayers) {
      try {
        const isSeated = await this.checkIsSeated(agent.address);
        if (!isSeated) {
          const zeroViewerKey = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;
          const buyInAmount = 10000000000000000n; // 0.01 ETH

          await (agent.wallet as any).writeContract({
            address: config.pokerTableAddress,
            abi: pokerTableAbi,
            functionName: "sitDown",
            args: [zeroViewerKey],
            value: buyInAmount,
            gasPrice: config.gasPrice,
          });

          console.log(`[Orchestrator] ✅ ${agent.emoji} ${agent.name} sat down (${agent.address.slice(0, 8)}...)`);
        } else {
          console.log(`[Orchestrator] ${agent.emoji} ${agent.name} already seated`);
        }
        this._seatedAgents.set(agent.address.toLowerCase(), agent);
      } catch (err) {
        console.error(`[Orchestrator] ❌ ${agent.emoji} ${agent.name} failed to sit down:`, err);
      }
    }

    this._running = true;
    console.log(`[Orchestrator] 🎰 Bot loop started with ${this._seatedAgents.size} agents`);

    // Start the poll loop
    this._loopTimer = setInterval(() => {
      this.tick().catch((err) => {
        console.error("[Orchestrator] Tick error:", err);
      });
    }, POLL_INTERVAL_MS);

    return { success: true, message: `Bot loop started with ${this._seatedAgents.size} agents` };
  }

  /**
   * Stop the autonomous bot loop.
   */
  stop(): { success: boolean; message: string } {
    if (!this._running) {
      return { success: false, message: "Bot loop is not running" };
    }
    this._running = false;
    if (this._loopTimer) {
      clearInterval(this._loopTimer);
      this._loopTimer = null;
    }
    console.log("[Orchestrator] Bot loop stopped");
    return { success: true, message: "Bot loop stopped" };
  }

  /**
   * Get current orchestrator status.
   */
  getStatus(): {
    running: boolean;
    processing: boolean;
    handNumber: number;
    seatedBots: { name: string; emoji: string; address: string }[];
  } {
    return {
      running: this._running,
      processing: this._processing,
      handNumber: this._handNumber,
      seatedBots: Array.from(this._seatedAgents.values()).map((a) => ({
        name: a.name,
        emoji: a.emoji,
        address: a.address,
      })),
    };
  }

  /**
   * Main tick — called on interval.
   * Reads contract state and acts when it's a bot's turn.
   */
  private async tick(): Promise<void> {
    if (!this._running || this._processing) return;

    try {
      const tableState = await this.readTableState();
      if (!tableState) return;

      const { phase, activePlayerAddr, lastActionTimestamp, currentMaxBet, pot, communityCards, handCount } = tableState;

      // Track hand count
      if (Number(handCount) > this._handNumber) {
        this._handNumber = Number(handCount);
        console.log(`[Orchestrator] Hand #${this._handNumber} detected`);
      }

      // Phase 0 = Waiting, Phase 6 = Finished
      // If Finished, deal a new hand after delay
      if (phase === 6 || phase === 0) {
        // Check if there are enough seated players
        if (phase === 0 && this._seatedAgents.size >= 2) {
          console.log("[Orchestrator] Phase is Waiting, dealing new hand...");
          await this.delay(HAND_DELAY_MS);
          try {
            // Use first seated bot's wallet to send the TX
            const firstBot = this._botPlayers.find((b) => this._seatedAgents.has(b.address.toLowerCase()));
            if (firstBot) {
              await (firstBot.wallet as any).writeContract({
                address: config.pokerTableAddress,
                abi: pokerTableAbi,
                functionName: "dealNewHand",
                gasPrice: config.gasPrice,
              });
              console.log("[Orchestrator] New hand dealt");
            }
          } catch (err: any) {
            // Might already be dealt or not enough players — ignore
            if (!err?.message?.includes("already") && !err?.message?.includes("Waiting")) {
              console.error("[Orchestrator] dealNewHand failed:", err?.message ?? err);
            }
          }
        }
        return;
      }

      // Check for force-fold timeout
      if (lastActionTimestamp > 0n) {
        const elapsed = Date.now() / 1000 - Number(lastActionTimestamp);
        if (elapsed > FORCE_FOLD_TIMEOUT_MS / 1000 && activePlayerAddr) {
          // Force fold the timed-out player using the deployer wallet
          try {
            const { walletClient } = await import("../viem.js");
            await walletClient.writeContract({
              address: config.pokerTableAddress,
              abi: pokerTableAbi,
              functionName: "forceFold",
              gasPrice: config.gasPrice,
            });
            console.log(`[Orchestrator] ⏰ Force-folded ${activePlayerAddr.slice(0, 10)}... (timed out)`);
          } catch {
            // Ignore errors (might not be the right timing)
          }
          return;
        }
      }

      // Check if it's one of our bot's turn
      if (!activePlayerAddr) return;
      const bot = this._seatedAgents.get(activePlayerAddr.toLowerCase());
      if (!bot) return; // Not our bot's turn

      this._processing = true;
      try {
        await this.actForBot(bot, tableState);
      } finally {
        this._processing = false;
      }
    } catch (error) {
      console.error("[Orchestrator] Tick error:", error);
    }
  }

  /**
   * Execute an action for a bot based on its personality.
   */
  private async actForBot(bot: PokerAgent, tableState: TableState): Promise<void> {
    const { phase, currentMaxBet, pot, communityCards } = tableState;

    // Build the on-chain game state for the agent's decision engine
    const playerInfo = tableState.players.find(
      (p) => p.addr.toLowerCase() === bot.address.toLowerCase(),
    );
    if (!playerInfo) return;

    const gameState: OnChainGameState = {
      phase: phase,
      pot: pot,
      currentBet: currentMaxBet,
      dealerIndex: Number(tableState.dealerIndex),
      currentPlayerIndex: Number(tableState.activePlayerIndex),
      communityCards: communityCards.map((c) => BigInt(c)),
    };

    const pInfo: PlayerInfo = {
      player: bot.address,
      balance: playerInfo.stack,
      currentBet: playerInfo.currentBet,
      isFolded: playerInfo.folded,
      isAllIn: false,
      card1: BigInt(playerInfo.holeCards[0]),
      card2: BigInt(playerInfo.holeCards[1]),
    };

    const toCall = currentMaxBet > playerInfo.currentBet
      ? currentMaxBet - playerInfo.currentBet
      : 0n;
    const potOdds = pot > 0n && toCall > 0n
      ? Number(toCall) / Number(pot + toCall)
      : 0;
    const minRaise = currentMaxBet + (tableState.bigBlind > 0n ? tableState.bigBlind : 100n);

    const decision = bot.decideAction(gameState, pInfo, minRaise, potOdds);

    // Execute the action on-chain
    await this.delay(ACTION_DELAY_MS);

    try {
      switch (decision.action) {
        case ActionType.FOLD: {
          await (bot.wallet as any).writeContract({
            address: config.pokerTableAddress,
            abi: pokerTableAbi,
            functionName: "fold",
            gasPrice: config.gasPrice,
          });
          console.log(`  ${bot.emoji} ${bot.name}: FOLD`);
          break;
        }
        case ActionType.CHECK: {
          await (bot.wallet as any).writeContract({
            address: config.pokerTableAddress,
            abi: pokerTableAbi,
            functionName: "check",
            gasPrice: config.gasPrice,
          });
          console.log(`  ${bot.emoji} ${bot.name}: CHECK`);
          break;
        }
        case ActionType.CALL: {
          await (bot.wallet as any).writeContract({
            address: config.pokerTableAddress,
            abi: pokerTableAbi,
            functionName: "call",
            gasPrice: config.gasPrice,
          });
          console.log(`  ${bot.emoji} ${bot.name}: CALL`);
          break;
        }
        case ActionType.RAISE: {
          const raiseAmount = decision.amount > 0n ? decision.amount : minRaise;
          await (bot.wallet as any).writeContract({
            address: config.pokerTableAddress,
            abi: pokerTableAbi,
            functionName: "raise",
            args: [raiseAmount],
            gasPrice: config.gasPrice,
          });
          console.log(`  ${bot.emoji} ${bot.name}: RAISE ${raiseAmount}`);
          break;
        }
      }
    } catch (err: any) {
      console.error(`  ${bot.emoji} ${bot.name} action failed:`, err?.message ?? err);
    }
  }

  /**
   * Check if an address is seated at the table.
   */
  private async checkIsSeated(address: string): Promise<boolean> {
    try {
      const seated = await publicClient.readContract({
        address: config.pokerTableAddress,
        abi: pokerTableAbi,
        functionName: "isPlayerSeated",
        args: [address as `0x${string}`],
      });
      return seated as boolean;
    } catch {
      return false;
    }
  }

  /**
   * Read the full table state from the contract.
   */
  async readTableState(): Promise<TableState | null> {
    try {
      const results = await Promise.all([
        publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "phase" }),
        publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "pot" }),
        publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "handCount" }),
        publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "dealerIndex" }),
        publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "activePlayerIndex" }),
        publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "currentMaxBet" }),
        publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "smallBlind" }),
        publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "bigBlind" }),
        publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "getPlayers" }),
        publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "getCommunityCards" }),
        publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "getSeatedPlayerCount" }),
        publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "getActivePlayerCount" }),
        publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "getActivePlayer" }),
        publicClient.readContract({ address: config.pokerTableAddress, abi: pokerTableAbi, functionName: "lastActionTimestamp" }),
      ]);

      const [phaseNum, pot, handCount, dealerIndex, activePlayerIndex, currentMaxBet, smallBlind, bigBlind,
        rawPlayers, rawCommunityCards, seatedCount, activeCount, activePlayerAddr, lastActionTimestamp] = results;

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

      const players = (rawPlayers as unknown as RawPlayer[]).map((p) => ({
        addr: p.addr,
        stack: p.stack,
        currentBet: p.currentBet,
        folded: p.folded,
        isSeated: p.isSeated,
        holeCards: [Number(p.holeCards[0]), Number(p.holeCards[1])] as [number, number],
      }));

      return {
        phase: Number(phaseNum),
        pot: pot as bigint,
        handCount: handCount as bigint,
        dealerIndex: dealerIndex as bigint,
        activePlayerIndex: activePlayerIndex as bigint,
        currentMaxBet: currentMaxBet as bigint,
        smallBlind: smallBlind as bigint,
        bigBlind: bigBlind as bigint,
        players,
        communityCards: Array.isArray(rawCommunityCards) ? (rawCommunityCards as bigint[]).map(Number) : [],
        seatedPlayerCount: Number(seatedCount),
        activePlayerCount: Number(activeCount),
        activePlayerAddr: (activePlayerAddr as string) || null,
        lastActionTimestamp: (lastActionTimestamp as bigint) ?? 0n,
      };
    } catch (err) {
      console.error("[Orchestrator] Failed to read table state:", err);
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ── Table State Type ──

export interface TableState {
  phase: number;
  pot: bigint;
  handCount: bigint;
  dealerIndex: bigint;
  activePlayerIndex: bigint;
  currentMaxBet: bigint;
  smallBlind: bigint;
  bigBlind: bigint;
  players: {
    addr: Address;
    stack: bigint;
    currentBet: bigint;
    folded: boolean;
    isSeated: boolean;
    holeCards: [number, number];
  }[];
  communityCards: number[];
  seatedPlayerCount: number;
  activePlayerCount: number;
  activePlayerAddr: string | null;
  lastActionTimestamp: bigint;
}

// ── Singleton ──
export const orchestrator = new BotOrchestrator();
