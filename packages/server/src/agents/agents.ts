// ─── All 6 Agent Instances ────────────────────────────────────────────────────

import { Agent } from './agent.js';
import { SHARK, FOX, OWL, BULL, CAT, WOLF } from './personalities.js';
import type { IAgent } from './types.js';

/**
 * Create and export all 6 AI agent instances.
 * Seat indices 0-5 correspond to the 6 AI seats at the table.
 */
export function createAgents(): IAgent[] {
  return [
    new Agent(SHARK, 0), // Seat 0
    new Agent(FOX, 1),   // Seat 1
    new Agent(OWL, 2),   // Seat 2
    new Agent(BULL, 3),  // Seat 3
    new Agent(CAT, 4),   // Seat 4
    new Agent(WOLF, 5),  // Seat 5
  ];
}

/** Default agent factory — creates a fresh set of agents */
export function createDefaultAgents(): IAgent[] {
  return createAgents();
}
