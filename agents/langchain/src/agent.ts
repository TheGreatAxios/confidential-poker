import { createDeepAgent } from "deepagents";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
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

function createModel() {
  const provider = config.llmProvider.toLowerCase();
  switch (provider) {
    case "anthropic":
      return new ChatAnthropic({
        model: config.llmModel,
        temperature: 0.3,
        apiKey: config.llmApiKey,
      });
    case "openai":
      return new ChatOpenAI({
        model: config.llmModel,
        temperature: 0.3,
        apiKey: config.llmApiKey,
      });
    case "xai": {
      return new ChatOpenAI({
        model: config.llmModel,
        temperature: 0.3,
        apiKey: config.llmApiKey,
        configuration: { baseURL: "https://api.x.ai/v1" },
      });
    }
    case "google-genai":
      return new ChatGoogleGenerativeAI({
        model: config.llmModel,
        temperature: 0.3,
        apiKey: config.llmApiKey,
      });
    case "openrouter":
      return new ChatOpenAI({
        model: config.llmModel,
        temperature: 0.3,
        apiKey: config.llmApiKey,
        configuration: { baseURL: "https://openrouter.ai/api/v1" },
      });
    default:
      console.error(`Unknown LLM provider: ${provider}, falling back to anthropic`);
      return new ChatAnthropic({
        model: config.llmModel,
        temperature: 0.3,
        apiKey: config.llmApiKey,
      });
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

export function createAgent(memoryBackend: MemoryBackend) {
  const systemPrompt = buildPrompt();

  const agent = createDeepAgent({
    model: createModel(),
    tools: allTools as never[],
    systemPrompt,
    skills: ["./skills"],
    checkpointer: memoryBackend.checkpointer as never,
  });

  return agent;
}
