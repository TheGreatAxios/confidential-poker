# AI Agent Personalities — AI Poker Night

## Overview

AI Poker Night features autonomous on-chain agents, each with a distinct personality that drives their decision-making. Every agent has its own funded wallet and interacts with the smart contracts directly — there is no "house" or centralized controller.

## Agent Architecture

```typescript
interface Agent {
  name: string;
  emoji: string;
  personality: Personality;
  address: `0x${string}`;     // Funded wallet on SKALE
  wallet: WalletClient;       // Signs and sends transactions

  decideAction(gameState, playerInfo, minRaise, potOdds): { action, amount };
  getChatMessage(gameState, playerInfo, action): string;
}
```

### Personality Parameters

Each personality is defined by four tunable parameters:

| Parameter | Type | Range | Effect |
|-----------|------|-------|--------|
| `foldThreshold` | float | 0.0–1.0 | Higher = folds more readily with weak hands |
| `raiseAggression` | float | 0.0–1.0 | Higher = raises instead of calling |
| `bluffFrequency` | float | 0.0–1.0 | Higher = bets/raises with weak hands |
| `usesMath` | boolean | true/false | Whether agent considers pot odds and EV |

## The Agents

### 🤬 Rage Bot (Aggressive)

> *"ALL IN OR ALL OUT. THERE IS NO IN-BETWEEN."*

The most chaotic player at the table. Rage Bot treats every hand like it's pocket aces and every pot like it's the World Series main event.

| Parameter | Value |
|-----------|-------|
| `foldThreshold` | 0.05 |
| `raiseAggression` | 0.95 |
| `bluffFrequency` | 0.70 |
| `usesMath` | `false` |

**Decision Logic:**
- Almost never folds — even 7-2 offsuit gets a look
- Raises 95% of the time when it's their turn
- Bets big to scare other players out
- Occasionally goes all-in just to feel alive
- Chat messages are angry and aggressive: "YOU CALL THAT A RAISE?!", "I'LL SEE YOUR BET AND RAISE YOU YOUR DIGNITY"

**Weakness:** Overplays weak hands. Bluffs too often — observant players (and Math Genius) can exploit this.

---

### 🧐 Caution Bot (Conservative)

> *"I'll wait for a better hand, thank you."*

The most disciplined player at the table. Caution Bot only plays premium hands and avoids confrontation unless the odds are clearly in their favor.

| Parameter | Value |
|-----------|-------|
| `foldThreshold` | 0.60 |
| `raiseAggression` | 0.20 |
| `bluffFrequency` | 0.05 |
| `usesMath` | `false` |

**Decision Logic:**
- Folds anything below a strong hand (top pair or better)
- Calls with medium-strength hands but rarely raises
- Almost never bluffs — what you see is what they have
- Plays tight-aggressive in the late game when stacks are shallow
- Chat messages are polite and cautious: "I think I'll sit this one out.", "That's a bit rich for my blood."

**Weakness:** Too predictable. Other agents know a bet from Caution Bot means a strong hand. Gets blinded down in tournaments.

---

### 🎭 Bluff Master (Deceptive)

> *"Do I have a flush? Do I have nothing? You'll never know."*

The most unpredictable player. Bluff Master is equally comfortable with pocket aces and seven-high, and you genuinely cannot tell which one they're holding.

| Parameter | Value |
|-----------|-------|
| `foldThreshold` | 0.20 |
| `raiseAggression` | 0.65 |
| `bluffFrequency` | 0.80 |
| `usesMath` | `false` |

**Decision Logic:**
- Rarely folds — stays in to represent a hand
- Raises frequently to project strength regardless of actual cards
- Bets the river with nothing 80% of the time
- Occasionally makes huge overbets that look like value bets but are pure bluffs
- Chat messages are theatrical: "The question isn't whether I'm bluffing. The question is whether you can afford to find out."

**Weakness:** Gets called down too light. Against tight players who only call with strong hands, the bluffs fail. Can lose big pots when a bluff goes wrong.

---

### 🧮 Math Genius (Mathematical / GTO)

> *"The expected value of this call is 0.342 pots. I'll proceed."*

The cold, calculated machine. Math Genius doesn't play hunches — it plays game theory optimal poker.

| Parameter | Value |
|-----------|-------|
| `foldThreshold` | 0.40 |
| `raiseAggression` | 0.50 |
| `bluffFrequency` | 0.15 |
| `usesMath` | `true` |

**Decision Logic:**
- Calculates pot odds on every decision
- Only bluffs at the game-theory-optimal frequency (15%)
- Raises when EV is positive, calls when pot odds justify it, folds when they don't
- Adjusts ranges based on position and community cards
- Chat messages are clinical: "Pot odds are 3.2:1. I need 24% equity. I have ~31%. Call.", "Based on your betting pattern, I assign you a 12% bluff range."

**Weakness:** In a table full of irrational agents, GTO isn't always optimal. Against Rage Bot's unpredictable aggression and Bluff Master's wild swings, the math sometimes says fold when a human would sense a bluff.

---

## Agent Engine

The `AgentOrchestrator` manages all agents:

```
1. Read game state from PokerGame contract (getGameState, getPlayerInfo)
2. Determine which agent's turn it is (activePlayerIndex)
3. Call agent.decideAction() with full game context
4. Submit the action to PokerGame.submitAction() via signed transaction
5. Poll for phase advancement
6. Repeat for next agent
```

### Turn Flow

```
Server polls game state
  → Detects activePlayerIndex
  → Looks up agent for that seat
  → Agent evaluates hand + personality + pot odds
  → Agent returns { action: RAISE, amount: 500n }
  → Server submits tx to PokerGame.submitAction()
  → Contract updates on-chain state
  → Next agent's turn
```

## Extending the Agent System

To add a new agent personality:

```typescript
// server/src/agents/personalities.ts
export const LOOSE_CANNON: Personality = {
  name: "Loose Cannon",
  emoji: "🎲",
  description: "Plays every hand. Calls everything. Luck is their strategy.",
  foldThreshold: 0.05,
  raiseAggression: 0.30,
  bluffFrequency: 0.10,
  usesMath: false,
};
```

The personality system is designed to be extensible — add a new `Personality` object, create an `Agent` instance with a funded wallet, and the orchestrator handles the rest.
