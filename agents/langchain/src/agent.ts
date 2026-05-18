import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { ChatOpenRouter } from "@langchain/openrouter";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage } from "@langchain/core/messages";
import { config } from "./config";
import { buildPrompt } from "./prompts/build-prompt";
import { submitAction } from "./tools/submit-action";

type MessageLike = {
  content?: unknown;
  tool_calls?: unknown;
  invalid_tool_calls?: unknown;
  response_metadata?: unknown;
  usage_metadata?: unknown;
  id?: unknown;
};

export type SubmitActionCaller = {
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
      return createDeepAgentCompatModel(new ChatOpenRouter({
        model: config.llmModel,
        temperature: 0.3,
        apiKey: config.llmApiKey,
      }));
    case "zai": {
      return createDeepAgentCompatModel(new ChatOpenAI({
        model: config.zaiModel,
        temperature: 0.3,
        apiKey: config.zaiPrivateKey,
        configuration: { baseURL: "https://api.z.ai/api/coding/paas/v4" },
      }));
    }
    default:
      console.error(`Unknown LLM provider: ${provider}, falling back to anthropic`);
      return createDeepAgentCompatModel(new ChatAnthropic({
        model: config.llmModel,
        temperature: 0.3,
        apiKey: config.llmApiKey,
      }));
  }
}

export function createSubmitActionCaller(): SubmitActionCaller {
  const systemPrompt = buildPrompt();
  const model = createModel().bindTools(
    [submitAction],
    {
      tool_choice: "required",
      strict: true,
    } as never,
  ) as never;

  // Wrap the bound model so the first message in every invoke carries the system prompt
  return {
    invoke: async (input: unknown, options?: unknown) => {
      const messages = Array.isArray(input) ? input : [];
      const withSystem = [
        { role: "system", content: systemPrompt },
        ...messages,
      ];
      return model.invoke(withSystem as never, options);
    },
  };
}
