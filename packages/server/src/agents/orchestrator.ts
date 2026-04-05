// ─── Game Orchestrator: Manages Turns, Phases, and Game Flow ───────────────────

import type { IAgent, Player, GameState, Card, DecisionContext, PlayerAction } from './types.js';
import { SMALL_BLIND, BIG_BLIND, STARTING_CHIPS, AI_ACTION_DELAY_MS, type GamePhase } from '../config.js';
import { bestHand, evaluateHand, randomPick, formatActionMessage } from './decisions.js';

// ── Deck Utilities ────────────────────────────────────────────────────────────

const SUITS = ['♠', '♥', '♦', '♣'] as const;
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;

export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/** Fisher-Yates shuffle */
export function shuffleDeck(deck: Card[]): Card[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ── Orchestrator Class ────────────────────────────────────────────────────────

export class GameOrchestrator {
  /** All agents (AI + human) at the table */
  agents: IAgent[];
  /** The human player, if any */
  humanPlayer: Player | null = null;
  /** Whether the human player has an action pending */
  humanActionPending = false;
  /** Resolver for the human player's action promise */
  private humanActionResolver: ((action: { action: PlayerAction; amount?: number }) => void) | null = null;

  // ── Game State ──
  state: GameState;
  private deck: Card[] = [];
  private dealerIndex = 0;
  private roundNumber = 0;
  /** Index into the active players array for whose turn it is */
  private currentActorIndex = 0;
  /** Set of player indices who have acted this round */
  private actedThisRound = new Set<number>();
  /** Callbacks */
  private onStateChange: ((state: GameState) => void) | null = null;
  /** Timer for auto-advancing */
  private advanceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(agents: IAgent[]) {
    this.agents = agents;
    this.state = this.createInitialState();
  }

  /** Subscribe to state changes */
  onStateChangeCallback(cb: (state: GameState) => void): void {
    this.onStateChange = cb;
  }

  private emitState(): void {
    this.onStateChange?.(this.getPublicState());
  }

  // ── Initial State ──

  private createInitialState(): GameState {
    const players: Player[] = this.agents.map((a) => ({ ...a.player }));
    return {
      phase: 'waiting',
      communityCards: [],
      pot: 0,
      currentBet: 0,
      players,
      activePlayerIndex: -1,
      winners: [],
      agentMessages: [],
      deck: [],
      roundNumber: 0,
    };
  }

  /** Get the public-facing game state (no private hand info for AI, human sees own hand) */
  getPublicState(): GameState {
    return {
      ...this.state,
      players: this.state.players.map((p) => {
        // Don't reveal AI hands to the public state
        if (!p.isHuman) {
          return { ...p, hand: [] };
        }
        return { ...p };
      }),
    };
  }

  // ── Game Flow ──────────────────────────────────────────────────────────────

  /** Start a new game / reset everything */
  startGame(): void {
    this.roundNumber = 0;
    this.dealerIndex = 0;
    this.state.agentMessages = [];
    this.state.winners = [];

    for (const agent of this.agents) {
      agent.reset();
      agent.player.chips = STARTING_CHIPS;
      this.state.players[agent.player.position] = { ...agent.player };
    }

    if (this.humanPlayer) {
      this.humanPlayer.chips = STARTING_CHIPS;
      this.humanPlayer.hand = [];
      this.humanPlayer.hasFolded = false;
      this.humanPlayer.isAllIn = false;
      this.humanPlayer.currentBet = 0;
      this.humanPlayer.totalBetThisRound = 0;
      this.humanPlayer.lastAction = undefined;
      // Insert human into players array at their position
      if (!this.state.players.some((p) => p.id === this.humanPlayer!.id)) {
        this.state.players.push({ ...this.humanPlayer });
      }
    }

    this.addAgentMessage('system', '🃏 The game has started! Shuffling up and dealing...');
    this.emitState();
    this.scheduleNext(() => this.startNewHand());
  }

  /** Start a new hand */
  private startNewHand(): void {
    // Check if we have enough players with chips
    const playersWithChips = this.state.players.filter((p) => p.chips > 0 && p.isConnected);
    if (playersWithChips.length < 2) {
      this.state.phase = 'waiting';
      const winner = playersWithChips[0];
      this.state.winners = winner ? [winner] : [];
      this.addAgentMessage('system', `🏆 ${winner?.name ?? 'Nobody'} wins the tournament!`);
      this.emitState();
      return;
    }

    this.roundNumber++;
    this.deck = shuffleDeck(createDeck());
    this.state.deck = [...this.deck];
    this.state.communityCards = [];
    this.state.pot = 0;
    this.state.currentBet = 0;
    this.state.winners = [];

    // Reset all players for new hand
    for (const p of this.state.players) {
      if (!p.isConnected) continue;
      p.hand = [];
      p.currentBet = 0;
      p.totalBetThisRound = 0;
      p.hasFolded = false;
      p.isAllIn = false;
      p.lastAction = undefined;
    }

    // Mark busted players as disconnected
    for (const p of this.state.players) {
      if (p.chips <= 0) p.isConnected = false;
    }

    // Rotate dealer
    this.rotateDealer();

    this.state.phase = 'dealing';
    this.addAgentMessage('system', `--- Hand #${this.roundNumber} ---`);
    this.emitState();

    // Deal hole cards
    this.scheduleNext(() => {
      this.dealHoleCards();
      this.postBlinds();
      this.state.phase = 'preflop';
      this.actedThisRound.clear();
      this.startBettingRound('preflop');
    }, AI_ACTION_DELAY_MS);
  }

  /** Rotate the dealer button */
  private rotateDealer(): void {
    const activePlayers = this.state.players.filter((p) => p.chips > 0 && p.isConnected);
    if (activePlayers.length === 0) return;

    // Find next valid dealer
    let attempts = 0;
    do {
      this.dealerIndex = (this.dealerIndex + 1) % this.state.players.length;
      attempts++;
    } while (
      (this.state.players[this.dealerIndex].chips <= 0 || !this.state.players[this.dealerIndex].isConnected)
      && attempts < this.state.players.length
    );

    for (const p of this.state.players) {
      p.isDealer = false;
    }
    this.state.players[this.dealerIndex].isDealer = true;
  }

  /** Deal 2 cards to each active player */
  private dealHoleCards(): void {
    let cardIndex = 0;
    for (const p of this.state.players) {
      if (!p.isConnected || p.chips <= 0) continue;
      p.hand = [this.deck[cardIndex], this.deck[cardIndex + 1]];
      cardIndex += 2;

      // Also deal to agent if AI
      const agent = this.agents.find((a) => a.id === p.id);
      if (agent) {
        agent.dealHand(p.hand);
      }
    }
  }

  /** Post small and big blinds */
  private postBlinds(): void {
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length < 2) return;

    // Heads-up: dealer is SB
    const sbIndex = this.getPlayerAfterDealer(activePlayers);
    const bbIndex = (sbIndex + 1) % activePlayers.length;

    const sbPlayer = activePlayers[sbIndex];
    const bbPlayer = activePlayers[bbIndex];

    const sbAmount = Math.min(SMALL_BLIND, sbPlayer.chips);
    const bbAmount = Math.min(BIG_BLIND, bbPlayer.chips);

    this.placeBet(sbPlayer, sbAmount);
    this.placeBet(bbPlayer, bbAmount);

    this.state.currentBet = bbAmount;

    this.addAgentMessage('system', `${sbPlayer.emoji} ${sbPlayer.name} posts SB (${sbAmount})`);
    this.addAgentMessage('system', `${bbPlayer.emoji} ${bbPlayer.name} posts BB (${bbAmount})`);
  }

  /** Get index of player after dealer in the active players list */
  private getPlayerAfterDealer(activePlayers: Player[]): number {
    const dealerPos = activePlayers.findIndex((p) => p.isDealer);
    if (dealerPos === -1) return 0;
    return (dealerPos + 1) % activePlayers.length;
  }

  // ── Betting Round Management ────────────────────────────────────────────────

  /** Start a betting round. Preflop starts after BB, others start after dealer. */
  private startBettingRound(phase: string): void {
    this.state.phase = phase;
    this.actedThisRound.clear();
    this.state.currentBet = phase === 'preflop' ? this.state.currentBet : 0;

    // Reset per-round bets
    for (const p of this.state.players) {
      p.currentBet = 0;
    }
    // Preserve currentBet for preflop (already set by blinds)
    if (phase !== 'preflop') {
      this.state.currentBet = 0;
    }

    const activePlayers = this.getActivePlayers();
    if (activePlayers.length <= 1) {
      this.resolveHand();
      return;
    }

    // Determine first to act
    let firstToActIdx: number;
    if (phase === 'preflop') {
      // In preflop, first to act is UTG (after BB)
      const sbIdx = this.getPlayerAfterDealer(activePlayers);
      const bbIdx = (sbIdx + 1) % activePlayers.length;
      firstToActIdx = (bbIdx + 1) % activePlayers.length;
    } else {
      // Post-flop: first active player after dealer
      firstToActIdx = this.getPlayerAfterDealer(activePlayers);
    }

    this.currentActorIndex = firstToActIdx;
    this.state.activePlayerIndex = activePlayers[firstToActIdx].position;
    this.emitState();

    this.scheduleNext(() => this.processCurrentActor());
  }

  /** Process the current actor's turn */
  private processCurrentActor(): void {
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length <= 1) {
      this.resolveHand();
      return;
    }

    const player = activePlayers[this.currentActorIndex];

    if (player.hasFolded || player.isAllIn) {
      this.advanceToNextActor();
      return;
    }

    // Check if betting round is complete
    if (this.isBettingRoundComplete(activePlayers)) {
      this.advancePhase();
      return;
    }

    if (player.isHuman && this.humanPlayer?.id === player.id) {
      // Wait for human action
      this.humanActionPending = true;
      this.state.activePlayerIndex = player.position;
      this.emitState();
      return;
    }

    // AI agent's turn
    this.state.activePlayerIndex = player.position;
    this.emitState();

    this.scheduleNext(() => {
      const agent = this.agents.find((a) => a.id === player.id);
      if (!agent) {
        this.advanceToNextActor();
        return;
      }

      const context = this.buildDecisionContext(player);
      const decision = agent.decide(context);

      this.executeAction(player, decision.action, decision.amount);

      // Add chat message
      const chatMsg = agent.chat(decision.action, decision.isBluff);
      this.addAgentMessage(player.id, `${player.emoji} ${chatMsg}`);

      // Record observation for all other agents
      for (const otherAgent of this.agents) {
        if (otherAgent.id !== player.id) {
          otherAgent.observe(player.id, decision.action);
        }
      }

      this.actedThisRound.add(player.position);
      this.advanceToNextActor();
    }, AI_ACTION_DELAY_MS);
  }

  /** Build the decision context for an agent */
  private buildDecisionContext(player: Player): DecisionContext {
    const activePlayers = this.getActivePlayers();
    const callAmount = Math.max(0, this.state.currentBet - player.currentBet);
    const potOdds = this.state.pot > 0 ? callAmount / (this.state.pot + callAmount) : 0;

    return {
      player,
      gameState: this.state,
      position: player.position,
      numActivePlayers: activePlayers.filter((p) => !p.hasFolded).length,
      potOdds,
    };
  }

  /** Execute a player action */
  private executeAction(player: Player, action: PlayerAction, amount?: number): void {
    player.lastAction = action;

    switch (action) {
      case 'fold':
        player.hasFolded = true;
        break;

      case 'check':
        // Nothing to do
        break;

      case 'call': {
        const callAmount = Math.min(this.state.currentBet - player.currentBet, player.chips);
        this.placeBet(player, callAmount);
        break;
      }

      case 'raise': {
        const raiseTotal = amount ?? this.state.currentBet * 2;
        const needed = raiseTotal - player.currentBet;
        const raiseAmount = Math.min(needed, player.chips);
        this.placeBet(player, raiseAmount);
        // Reset acted set since this is a new raise — others need to act again
        this.actedThisRound.clear();
        this.actedThisRound.add(player.position);
        break;
      }

      case 'all-in': {
        const allInAmount = player.chips;
        this.placeBet(player, allInAmount);
        if (player.currentBet > this.state.currentBet) {
          // This is effectively a raise
          this.state.currentBet = player.currentBet;
          this.actedThisRound.clear();
          this.actedThisRound.add(player.position);
        }
        player.isAllIn = true;
        break;
      }
    }
  }

  /** Place a bet from a player */
  private placeBet(player: Player, amount: number): void {
    const actual = Math.min(amount, player.chips);
    player.chips -= actual;
    player.currentBet += actual;
    player.totalBetThisRound += actual;
    this.state.pot += actual;
    if (player.currentBet > this.state.currentBet) {
      this.state.currentBet = player.currentBet;
    }
    if (player.chips === 0) {
      player.isAllIn = true;
    }
  }

  /** Advance to the next actor in the betting round */
  private advanceToNextActor(): void {
    const activePlayers = this.getActivePlayers();

    if (this.isBettingRoundComplete(activePlayers)) {
      this.scheduleNext(() => this.advancePhase());
      return;
    }

    this.currentActorIndex = (this.currentActorIndex + 1) % activePlayers.length;
    this.state.activePlayerIndex = activePlayers[this.currentActorIndex].position;
    this.emitState();

    this.scheduleNext(() => this.processCurrentActor());
  }

  /** Check if the betting round is complete */
  private isBettingRoundComplete(activePlayers: Player[]): boolean {
    const playersToAct = activePlayers.filter(
      (p) => !p.hasFolded && !p.isAllIn,
    );

    if (playersToAct.length === 0) return true;
    if (playersToAct.length === 1 && activePlayers.filter((p) => !p.hasFolded).length === 1) return true;

    // Everyone has acted and all bets are equalized
    const allActed = playersToAct.every((p) => this.actedThisRound.has(p.position));
    const allBetsEqual = playersToAct.every((p) => p.currentBet === this.state.currentBet);

    return allActed && allBetsEqual;
  }

  /** Advance to the next phase */
  private advancePhase(): void {
    const activePlayers = this.getActivePlayers().filter((p) => !p.hasFolded);

    // If only one player remains, they win
    if (activePlayers.length <= 1) {
      this.resolveHand();
      return;
    }

    const phase = this.state.phase;
    let nextPhase: GamePhase;
    let cardsToDeal = 0;

    switch (phase) {
      case 'preflop':
        nextPhase = 'flop';
        cardsToDeal = 3;
        break;
      case 'flop':
        nextPhase = 'turn';
        cardsToDeal = 1;
        break;
      case 'turn':
        nextPhase = 'river';
        cardsToDeal = 1;
        break;
      case 'river':
        this.state.phase = 'showdown';
        this.resolveHand();
        return;
      default:
        return;
    }

    // Deal community cards
    for (let i = 0; i < cardsToDeal; i++) {
      const cardIdx = 2 * this.state.players.filter((p) => p.isConnected).length + this.state.communityCards.length;
      this.state.communityCards.push(this.deck[cardIdx]);
    }

    // Check if we can still have a betting round
    const canBet = activePlayers.filter((p) => !p.isAllIn).length >= 2;

    if (canBet) {
      this.startBettingRound(nextPhase);
    } else {
      // Skip to next phase or showdown
      this.state.phase = nextPhase;
      this.emitState();
      if (nextPhase === 'river') {
        this.state.phase = 'showdown';
        this.resolveHand();
      } else {
        this.scheduleNext(() => this.advancePhase());
      }
    }
  }

  /** Resolve the hand — determine winners */
  private resolveHand(): void {
    const contenders = this.state.players.filter((p) => !p.hasFolded && p.isConnected);

    if (contenders.length === 1) {
      // Everyone else folded
      const winner = contenders[0];
      winner.chips += this.state.pot;
      this.state.winners = [winner];
      this.state.phase = 'showdown';
      this.addAgentMessage('system', `${winner.emoji} ${winner.name} wins ${this.state.pot} chips! (everyone folded)`);
      this.state.pot = 0;
      this.emitState();
      this.scheduleNext(() => this.startNewHand(), AI_ACTION_DELAY_MS * 3);
      return;
    }

    // Evaluate hands
    let bestScore = -1;
    const results: { player: Player; score: number }[] = [];

    for (const p of contenders) {
      const allCards = [...p.hand, ...this.state.communityCards];
      const score = bestHand(allCards);
      results.push({ player: p, score });
      if (score > bestScore) bestScore = score;
    }

    // Find winner(s) — could be a tie
    const winners = results.filter((r) => r.score === bestScore).map((r) => r.player);

    // Split pot among winners
    const share = Math.floor(this.state.pot / winners.length);
    for (const w of winners) {
      w.chips += share;
    }
    // Remainder goes to first winner (closest to dealer)
    const remainder = this.state.pot - share * winners.length;
    if (remainder > 0) winners[0].chips += remainder;

    this.state.winners = winners;
    this.state.phase = 'showdown';

    if (winners.length === 1) {
      const w = winners[0];
      this.addAgentMessage('system', `🏆 ${w.emoji} ${w.name} wins ${this.state.pot} chips!`);

      // Winner chat
      const agent = this.agents.find((a) => a.id === w.id);
      if (agent) {
        this.addAgentMessage(w.id, `${w.emoji} ${agent.chat('win')}`);
      }

      // Loser chats
      for (const p of contenders.filter((p) => p.id !== w.id)) {
        const agent = this.agents.find((a) => a.id === p.id);
        if (agent && Math.random() < 0.6) {
          this.addAgentMessage(p.id, `${p.emoji} ${agent.chat('lose')}`);
        }
      }
    } else {
      const names = winners.map((w) => `${w.emoji} ${w.name}`).join(' & ');
      this.addAgentMessage('system', `🤝 Split pot! ${names} each win ${share} chips!`);
    }

    this.state.pot = 0;
    this.emitState();

    this.scheduleNext(() => this.startNewHand(), AI_ACTION_DELAY_MS * 4);
  }

  // ── Human Player Integration ────────────────────────────────────────────────

  /** Join a human player to the table */
  joinPlayer(name: string, address: string): Player {
    const seatIndex = this.state.players.length;
    const humanPlayer: Player = {
      id: address,
      name,
      emoji: '👤',
      isHuman: true,
      chips: STARTING_CHIPS,
      hand: [],
      currentBet: 0,
      totalBetThisRound: 0,
      hasFolded: false,
      isAllIn: false,
      isDealer: false,
      position: seatIndex,
      lastAction: undefined,
      isConnected: true,
    };

    this.humanPlayer = humanPlayer;
    this.state.players.push(humanPlayer);

    this.addAgentMessage('system', `👤 ${name} joined the table!`);

    // Greets from agents
    for (const agent of this.agents) {
      if (Math.random() < 0.5) {
        const greet = agent.chat('greet');
        this.addAgentMessage(agent.id, `${agent.personality.emoji} ${greet}`);
      }
    }

    this.emitState();
    return humanPlayer;
  }

  /** Submit an action from the human player */
  submitHumanAction(action: PlayerAction, amount?: number): boolean {
    if (!this.humanActionPending || !this.humanPlayer) return false;
    if (!this.humanActionResolver) return false;

    this.humanActionPending = false;
    const resolver = this.humanActionResolver;
    this.humanActionResolver = null;

    // Validate the action
    const player = this.humanPlayer;
    const callAmount = this.state.currentBet - player.currentBet;

    switch (action) {
      case 'check':
        if (callAmount > 0) return false;
        break;
      case 'call':
        if (callAmount <= 0) return false;
        break;
      case 'raise':
        if (!amount || amount <= this.state.currentBet) return false;
        break;
      case 'all-in':
        if (player.chips <= 0) return false;
        break;
    }

    this.executeAction(player, action, amount);
    this.actedThisRound.add(player.position);

    // Record observation for all agents
    for (const agent of this.agents) {
      agent.observe(player.id, action);
    }

    this.addAgentMessage(player.id, formatActionMessage(player.name, action, amount));

    resolver({ action, amount });
    return true;
  }

  /** Wait for human action — returns a promise */
  waitForHumanAction(): Promise<{ action: PlayerAction; amount?: number }> {
    return new Promise((resolve) => {
      this.humanActionResolver = resolve;
    });
  }

  // ── Utilities ───────────────────────────────────────────────────────────────

  /** Get players who are still in the game (have chips and connected) */
  private getActivePlayers(): Player[] {
    return this.state.players.filter((p) => p.isConnected && p.chips >= 0);
  }

  /** Add an agent message to the state */
  private addAgentMessage(agentId: string, message: string): void {
    this.state.agentMessages.push({ agentId, message });
    // Keep only last 100 messages
    if (this.state.agentMessages.length > 100) {
      this.state.agentMessages = this.state.agentMessages.slice(-50);
    }
  }

  /** Schedule the next action with a delay */
  private scheduleNext(fn: () => void, delay: number = AI_ACTION_DELAY_MS): void {
    if (this.advanceTimer) clearTimeout(this.advanceTimer);
    this.advanceTimer = setTimeout(fn, delay);
  }

  /** Stop the game */
  stop(): void {
    if (this.advanceTimer) clearTimeout(this.advanceTimer);
    for (const agent of this.agents) {
      agent.destroy();
    }
  }
}
