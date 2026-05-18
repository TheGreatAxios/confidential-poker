import type { PokerAction } from "../strategy/action-policy";

type MessageLike = {
  content?: unknown;
  tool_calls?: unknown;
  invalid_tool_calls?: unknown;
  response_metadata?: unknown;
  usage_metadata?: unknown;
  id?: unknown;
};

export function isPokerAction(action: unknown): action is PokerAction {
  return action === "fold" || action === "check" || action === "call" || action === "raise";
}

export function textFromMessage(message: unknown): string {
  if (typeof message === "string") return message;
  if (!message || typeof message !== "object") return "";
  const content = (message as MessageLike).content;
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (!part || typeof part !== "object") return "";
      const text = (part as { text?: unknown }).text;
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean)
    .join("\n");
}

export function extractResponseText(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const content = (response as { content?: unknown }).content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return "";
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
    if (text) return text;
  }
  const messages = (response as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return "";
  for (let i = messages.length - 1; i >= 0; i--) {
    const text = textFromMessage(messages[i]).trim();
    if (text) return text;
  }
  return "";
}

export function extractToolCalls(response: unknown): Array<{ name?: unknown; args?: unknown }> {
  if (!response || typeof response !== "object") return [];
  const directToolCalls = (response as { tool_calls?: unknown }).tool_calls;
  if (Array.isArray(directToolCalls)) return directToolCalls as never[];
  const messages = (response as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const toolCalls = (messages[i] as { tool_calls?: unknown }).tool_calls;
    if (Array.isArray(toolCalls)) return toolCalls as never[];
  }
  return [];
}

export function extractSubmitActionArgs(
  response: unknown,
  tableAddress: `0x${string}`,
): { tableAddress: `0x${string}`; action: PokerAction; raiseAmount: string | null } | null {
  const toolCall = extractToolCalls(response).find((call) => call.name === "submit_action");
  if (!toolCall || !toolCall.args || typeof toolCall.args !== "object") return null;
  const args = toolCall.args as {
    tableAddress?: unknown;
    action?: unknown;
    raiseAmount?: unknown;
  };
  if (!isPokerAction(args.action)) return null;
  const raiseAmount = typeof args.raiseAmount === "string" ? args.raiseAmount : null;
  return {
    tableAddress,
    action: args.action,
    raiseAmount: args.action === "raise" ? raiseAmount : null,
  };
}

export function getFallbackAction(state: { currentBet?: string; myBet?: string }): PokerAction {
  const currentBet = BigInt(state.currentBet ?? "0");
  const myBet = BigInt(state.myBet ?? "0");
  return currentBet > myBet ? "call" : "check";
}
