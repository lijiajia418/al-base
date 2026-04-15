import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ILLMClient } from "./types";
import type { AgentRole, ModelConfig } from "./model-config";
import { ConfigurationError } from "./claude-llm-client";

const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy;

if (proxyUrl && typeof globalThis !== "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ProxyAgent, setGlobalDispatcher } = require("undici");
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    console.log(`[Gemini] Proxy configured: ${proxyUrl}`);
  } catch {
    console.warn("[Gemini] undici not available, proxy not configured");
  }
}

const TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Gemini API timeout after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
}

const GEMINI_CONFIGS: Record<AgentRole, ModelConfig> = {
  observer: { model: "gemini-2.5-flash", maxTokens: 500, temperature: 0.3 },
  conductor: { model: "gemini-2.5-flash", maxTokens: 1000, temperature: 0.4 },
  tutor: { model: "gemini-2.5-flash", maxTokens: 2000, temperature: 0.7 },
};

export class GeminiLLMClient implements ILLMClient {
  private readonly genAI: GoogleGenerativeAI;
  private readonly config: ModelConfig;

  constructor(
    private readonly role: AgentRole,
    options?: { apiKey?: string },
  ) {
    const apiKey = options?.apiKey ?? process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new ConfigurationError(
        "GEMINI_API_KEY is required. Provide it via constructor options or environment variable.",
      );
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.config = GEMINI_CONFIGS[role];
  }

  async call(systemPrompt: string, userMessage: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({
      model: this.config.model,
      systemInstruction: systemPrompt,
      generationConfig: {
        maxOutputTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      },
    });

    const result = await withTimeout(model.generateContent(userMessage));
    const response = result.response;
    return response.text();
  }

  async *stream(
    systemPrompt: string,
    userMessage: string,
  ): AsyncGenerator<string> {
    const model = this.genAI.getGenerativeModel({
      model: this.config.model,
      systemInstruction: systemPrompt,
      generationConfig: {
        maxOutputTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      },
    });

    const result = await withTimeout(model.generateContentStream(userMessage));

    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        yield text;
      }
    }
  }
}
