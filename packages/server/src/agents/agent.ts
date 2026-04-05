// ─── Base Agent Class ─────────────────────────────────────────────────────────

import type { IAgent, Personality, Player, AgentDecision, DecisionContext, PlayerAction, Card, ChatTrigger } from './types.js';
import { makeDecision, randomPick, registerPersonality, unregisterPersonality } from './decisions.js';
import { STARTING_CHIPS } from '../config.js';

export class Agent implements IAgent {
  readonly id: string;
  readonly personality: Personality;
  player: Player;

  /** Opponent observation model: records action frequencies */
  private observations: Map<string, { folds: number; checks: number; calls: number; raises: number; allIns: number; total: number }>;

  constructor(personality: Personality, seatIndex: number) {
    this.id = `agent-${personality.archetype}`;
    this.personality = personality;
    this.observations = new Map();

    this.player = {
      id: this.id,
      name: personality.name,
      emoji: personality.emoji,
      isHuman: false,
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

    // Register this agent's personality with the decision engine
    registerPersonality(this.id, {
      aggression: personality.aggression,
      tightness: personality.tightness,
      bluffFrequency: personality.bluffFrequency,
    });
  }

  /** Map action triggers to personality chat keys */
  private chatKeyFor(trigger: ChatTrigger): keyof Personality['chat'] {
    if (trigger === 'all-in') return 'allIn';
    if (trigger === 'bluff') return 'bluff';
    return trigger as keyof Personality['chat'];
  }

  /** Main decision point — called by the orchestrator */
  decide(context: DecisionContext): AgentDecision {
    const decision = makeDecision(context);

    // Adjust based on observations of other players (adaptSpeed)
    if (this.personality.adaptSpeed > 0.5 && context.numActivePlayers > 1) {
      const adjustment = this.adaptToOpponents(context);
      if (adjustment && Math.random() < this.personality.adaptSpeed) {
        // If we detect a passive table, be more aggressive
        if (adjustment === 'exploit-passive' && decision.action === 'call') {
          decision.action = 'raise';
          decision.amount = (context.gameState.currentBet ?? 100) * 2;
        }
        // If we detect an aggressive table, tighten up
        if (adjustment === 'exploit-aggressive' && decision.action === 'raise' && decision.confidence < 0.6) {
          decision.action = 'call';
        }
      }
    }

    return decision;
  }

  /** Return a personality-flavored chat message for an action */
  chat(trigger: ChatTrigger, isBluff?: boolean): string {
    if (isBluff && this.personality.chat.bluff.length > 0 && Math.random() < 0.5) {
      return randomPick(this.personality.chat.bluff);
    }
    const key = this.chatKeyFor(trigger);
    const phrases = this.personality.chat[key];
    if (phrases && phrases.length > 0) {
      return randomPick(phrases);
    }
    return `${this.personality.emoji} ${trigger}`;
  }

  /** Reset agent state for a new hand */
  reset(): void {
    this.player.hand = [];
    this.player.currentBet = 0;
    this.player.totalBetThisRound = 0;
    this.player.hasFolded = false;
    this.player.isAllIn = false;
    this.player.lastAction = undefined;
    this.player.isConnected = true;
  }

  /** Record an observed opponent action for modeling */
  observe(playerId: string, action: PlayerAction): void {
    if (!this.observations.has(playerId)) {
      this.observations.set(playerId, { folds: 0, checks: 0, calls: 0, raises: 0, allIns: 0, total: 0 });
    }
    const obs = this.observations.get(playerId)!;
    obs.total++;
    switch (action) {
      case 'fold': obs.folds++; break;
      case 'check': obs.checks++; break;
      case 'call': obs.calls++; break;
      case 'raise': obs.raises++; break;
      case 'all-in': obs.allIns++; break;
    }
  }

  /** Simple exploitative logic based on observed tendencies */
  private adaptToOpponents(_context: DecisionContext): 'exploit-passive' | 'exploit-aggressive' | null {
    for (const [, obs] of this.observations) {
      if (obs.total < 5) continue;
      const foldRate = obs.folds / obs.total;
      const raiseRate = (obs.raises + obs.allIns) / obs.total;
      if (foldRate > 0.5) return 'exploit-passive';
      if (raiseRate > 0.6) return 'exploit-aggressive';
    }
    return null;
  }

  /** Deal cards to this agent */
  dealHand(cards: Card[]): void {
    this.player.hand = cards;
  }

  /** Clean up */
  destroy(): void {
    unregisterPersonality(this.id);
  }
}
