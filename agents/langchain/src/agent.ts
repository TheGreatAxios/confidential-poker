import { createDeepAgent } from "deepagents";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage } from "../node_modules/deepagents/node_modules/@langchain/core/dist/messages/ai.js";
import type { MemoryBackend } from "./memory/types";
import { config } from "./config";
import { buildPrompt } from "./prompts/build-prompt";

import { checkBalance } from "./tools/check-balance";
import { listTables } from "./tools/list-tables";
import { getTableInfo } from "./tools/get-table-info";
import { joinTable } from "./tools/join-table";
import { createTable } from "./tools/create-table";
import { readHoleCards } from "./tools/read-hole-cards";
import { getGameState } from "./tools/get-game-state";
import { submitAction } from "./tools/submit-action";
import { leaveTable } from "./tools/leave-table";
import { logAction } from "./tools/log-action";
import { claimFaucet } from "./tools/claim-faucet";

type MessageLike = {
  content?: unknown;
  tool_calls?: unknown;
  invalid_tool_calls?: unknown;
  response_metadata?: unknown;
  usage_metadata?: unknown;
  id?: unknown;
};

export type PokerAgent = {
  invoke(input: unknown, options?: unknown): Promise<unknown>;
};

function toDeepAgentMessage(message: unknown) {
  if (AIMessage.isInstance(message)) return message;
  if (!message || typeof message !== "object") return message;

  const source = message as MessageLike;
  const content = typeof source.content === "string" || Array.isArray(source.content) ? source.content : "";
  return new AIMessage({
    content,
    tool_calls: Array.isArray(source.tool_calls) ? source.tool_calls as never[] : [],
    invalid_tool_calls: Array.isArray(source.invalid_tool_calls) ? source.invalid_tool_calls as never[] : [],
    response_metadata: typeof source.response_metadata === "object" && source.response_metadata !== null
      ? source.response_metadata as Record<string, unknown>
      : {},
    usage_metadata: typeof source.usage_metadata === "object" && source.usage_metadata !== null
      ? source.usage_metadata as never
      : undefined,
    id: typeof source.id === "string" ? source.id : undefined,
  });
}

function createDeepAgentCompatModel<T extends object>(model: T): T {
  return new Proxy(model, {
    get(target, prop, receiver) {
      if (prop === "bindTools") {
        return (...args: unknown[]) => {
          const bindTools = Reflect.get(target, prop, receiver);
          if (typeof bindTools !== "function") return receiver;
          return createDeepAgentCompatModel(Reflect.apply(bindTools, target, args) as object);
        };
      }

      if (prop === "invoke") {
        return async (...args: unknown[]) => {
          const invoke = Reflect.get(target, prop, receiver);
          if (typeof invoke !== "function") throw new Error("Chat model is missing invoke");
          return toDeepAgentMessage(await Reflect.apply(invoke, target, args));
        };
      }

      return Reflect.get(target, prop, receiver);
    },
  });
}

function createModel() {
  const provider = config.llmProvider.toLowerCase();
  switch (provider) {
    case "anthropic":
      return createDeepAgentCompatModel(new ChatAnthropic({
        model: config.llmModel,
        temperature: 0.3,
        apiKey: config.llmApiKey,
      }));
    case "openai":
      return createDeepAgentCompatModel(new ChatOpenAI({
        model: config.llmModel,
        temperature: 0.3,
        apiKey: config.llmApiKey,
      }));
    case "xai": {
      return createDeepAgentCompatModel(new ChatOpenAI({
        model: config.llmModel,
        temperature: 0.3,
        apiKey: config.llmApiKey,
        configuration: { baseURL: "https://api.x.ai/v1" },
      }));
    }
    case "google-genai":
      return createDeepAgentCompatModel(new ChatGoogleGenerativeAI({
        model: config.llmModel,
        temperature: 0.3,
        apiKey: config.llmApiKey,
      }));
    case "openrouter":
      return createDeepAgentCompatModel(new ChatOpenAI({
        model: config.llmModel,
        temperature: 0.3,
        apiKey: config.llmApiKey,
        configuration: { baseURL: "https://openrouter.ai/api/v1" },
      }));
    default:
      console.error(`Unknown LLM provider: ${provider}, falling back to anthropic`);
      return createDeepAgentCompatModel(new ChatAnthropic({
        model: config.llmModel,
        temperature: 0.3,
        apiKey: config.llmApiKey,
      }));
  }
}

const allTools = [
  checkBalance,
  claimFaucet,
  listTables,
  getTableInfo,
  joinTable,
  createTable,
  readHoleCards,
  getGameState,
  submitAction,
  leaveTable,
  logAction,
];

export function createAgent(memoryBackend: MemoryBackend): PokerAgent {
  const systemPrompt = buildPrompt();

  const agent = createDeepAgent({
    model: createModel() as never,
    tools: allTools as never[],
    systemPrompt,
    skills: ["./skills"],
    checkpointer: memoryBackend.checkpointer as never,
  });

  return agent;
}
