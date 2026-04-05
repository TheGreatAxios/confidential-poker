// ─── AI Agent Type Definitions ────────────────────────────────────────────────

/** Personality archetypes for AI agents */
export type AgentArchetype =
  | 'shark'
  | 'fox'
  | 'owl'
  | 'bull'
  | 'cat'
  | 'wolf';

/** Risk tolerance on a 0-1 scale */
export type RiskTolerance = 'low' | 'medium' | 'high';

/** A single card: rank + suit */
export interface Card {
  rank: string; // '2'..'10' | 'J' | 'Q' | 'K' | 'A'
  suit: string; // '♠' | '♥' | '♦' | '♣'
}

/** Personality profile that drives the decision engine */
export interface Personality {
  archetype: AgentArchetype;
  name: string;
  emoji: string;
  tagline: string;
  aggression: number;      // 0-1  how often they raise vs call
  tightness: number;       // 0-1  how selective they are pre-flop
  bluffFrequency: number;  // 0-1  how often they bluff
  adaptSpeed: number;      // 0-1  how quickly they adjust to opponents
  riskTolerance: RiskTolerance;
  /** Chat phrases keyed by action */
  chat: {
    fold: string[];
    check: string[];
    call: string[];
    raise: string[];
    allIn: string[];
    win: string[];
    lose: string[];
    bluff: string[];
    greet: string[];
  };
}

/** Actions a player/agent can take */
export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'all-in';

/** Chat message trigger keys (includes game events) */
export type ChatTrigger = PlayerAction | 'win' | 'lose' | 'bluff' | 'greet';

/** The result of an agent's decision */
export interface AgentDecision {
  action: PlayerAction;
  amount?: number;
  isBluff: boolean;
  confidence: number; // 0-1
}

/** Player state at the table */
export interface Player {
  id: string;
  name: string;
  emoji: string;
  isHuman: boolean;
  chips: number;
  hand: Card[];
  currentBet: number;
  totalBetThisRound: number;
  hasFolded: boolean;
  isAllIn: boolean;
  isDealer: boolean;
  position: number; // seat index
  lastAction?: PlayerAction;
  isConnected: boolean;
}

/** Represents the full game state */
export interface GameState {
  phase: string;
  communityCards: Card[];
  pot: number;
  currentBet: number;
  players: Player[];
  activePlayerIndex: number;
  winners: Player[];
  agentMessages: { agentId: string; message: string }[];
  deck: Card[];
  roundNumber: number;
}

/** Minimal info sent to the decision engine */
export interface DecisionContext {
  player: Player;
  gameState: GameState;
  position: number;
  numActivePlayers: number;
  potOdds: number;
}

/** Interface that every agent must satisfy */
export interface IAgent {
  readonly id: string;
  readonly personality: Personality;
  player: Player;
  decide(context: DecisionContext): AgentDecision;
  /** Return a random chat message for the given action or event */
  chat(trigger: ChatTrigger, isBluff?: boolean): string;
  /** Reset agent state between hands */
  reset(): void;
  /** Record an observed action for opponent modeling */
  observe(playerId: string, action: PlayerAction): void;
  /** Deal cards to this agent */
  dealHand(cards: Card[]): void;
  /** Clean up agent resources */
  destroy(): void;
}
