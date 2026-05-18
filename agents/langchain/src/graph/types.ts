import { Annotation } from "@langchain/langgraph";
import type { Address } from "viem";
import type { PollResult } from "../loop/poller";
import type { PolicyDecision, PokerAction } from "../strategy/action-policy";

export const AgentState = Annotation.Root({
  ourAddress: Annotation<Address>(),

  tableAddress: Annotation<Address | null>({ default: () => null }),
  seat: Annotation<number>({ default: () => -1 }),
  sessionRecovered: Annotation<boolean>({ default: () => false }),

  pollResult: Annotation<PollResult | null>({ default: () => null }),
  isMyTurn: Annotation<boolean>({ default: () => false }),

  gameStateJson: Annotation<string>({ default: () => "" }),
  holeCardsJson: Annotation<string>({ default: () => "" }),
  phasePlaybook: Annotation<string>({ default: () => "" }),

  policyDecision: Annotation<PolicyDecision | null>({ default: () => null }),

  llmResponse: Annotation<unknown>({ default: () => null }),
  responseText: Annotation<string>({ default: () => "" }),
  actionArgs: Annotation<{
    tableAddress: Address;
    action: PokerAction;
    raiseAmount: string | null;
  } | null>({ default: () => null }),

  submitted: Annotation<boolean>({ default: () => false }),
  txHash: Annotation<string | null>({ default: () => null }),
  finalAction: Annotation<PokerAction | null>({ default: () => null }),
  finalRaiseAmount: Annotation<string | null>({ default: () => null }),
  thinking: Annotation<string>({ default: () => "" }),

  fallbackDepth: Annotation<number>({ default: () => 0 }),

  error: Annotation<string | null>({ default: () => null }),
  errorType: Annotation<"transient" | "fatal" | null>({ default: () => null }),
  clearTable: Annotation<boolean>({ default: () => false }),
  backoffAttempt: Annotation<number>({ default: () => 0 }),
});

export type AgentStateType = typeof AgentState.State;
