import type { ILLMClient } from "./types";
import type { AgentRole } from "./model-config";
import { ClaudeLLMClient } from "./claude-llm-client";
import { GeminiLLMClient } from "./gemini-llm-client";

export type LLMProvider = "claude" | "gemini" | "mock";

class MockLLMClient implements ILLMClient {
  async call(): Promise<string> {
    return "Mock response";
  }

  async *stream(): AsyncGenerator<string> {
    yield "Mock streaming response";
  }
}

export function createLLMClient(
  role: AgentRole,
): ILLMClient & {
  stream?(
    systemPrompt: string,
    userMessage: string,
  ): AsyncGenerator<string>;
} {
  const provider = (process.env.LLM_PROVIDER ?? "claude") as LLMProvider;

  switch (provider) {
    case "mock":
      return new MockLLMClient();
    case "gemini":
      return new GeminiLLMClient(role);
    case "claude":
    default:
      return new ClaudeLLMClient(role);
  }
}
