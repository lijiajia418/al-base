import Anthropic from "@anthropic-ai/sdk";
import type { ILLMClient } from "./types";
import { MODEL_CONFIGS } from "./model-config";
import type { AgentRole, ModelConfig } from "./model-config";

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

function getHttpStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    return (error as { status: number }).status;
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ClaudeLLMClientOptions {
  apiKey?: string;
  timeoutMs?: number;
  /** @internal — base delay for retry backoff, exposed for testing */
  _retryBaseDelayMs?: number;
}

export class ClaudeLLMClient implements ILLMClient {
  private readonly client: Anthropic;
  private readonly config: ModelConfig;
  private readonly timeoutMs: number;
  private readonly retryBaseDelayMs: number;

  constructor(
    private readonly role: AgentRole,
    options?: ClaudeLLMClientOptions,
  ) {
    const apiKey = options?.apiKey ?? process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new ConfigurationError(
        "ANTHROPIC_API_KEY is required. Provide it via constructor options or environment variable.",
      );
    }

    this.client = new Anthropic({ apiKey });
    this.config = MODEL_CONFIGS[role];
    this.timeoutMs = options?.timeoutMs ?? 30_000;
    this.retryBaseDelayMs = options?._retryBaseDelayMs ?? 1000;
  }

  async call(systemPrompt: string, userMessage: string): Promise<string> {
    const makeRequest = () =>
      this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

    const response = await this.withRetry(() =>
      this.withTimeout(makeRequest()),
    );

    return this.extractText(response);
  }

  async *stream(
    systemPrompt: string,
    userMessage: string,
  ): AsyncGenerator<string> {
    const eventStream = this.client.messages.stream({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    for await (const event of eventStream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }

  private extractText(response: {
    content: Array<{ type: string; text?: string }>;
  }): string {
    const textBlocks = response.content
      .filter((block) => block.type === "text" && block.text)
      .map((block) => block.text!);

    return textBlocks.join("");
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`LLM request timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const MAX_429_RETRIES = 3;
    const MAX_500_RETRIES = 1;
    const BASE_DELAY_MS = this.retryBaseDelayMs;

    let retries429 = 0;
    let retries500 = 0;

    while (true) {
      try {
        return await fn();
      } catch (error) {
        const status = getHttpStatus(error);

        if (status === 429 && retries429 < MAX_429_RETRIES) {
          retries429++;
          const delay = BASE_DELAY_MS * Math.pow(2, retries429 - 1);
          await sleep(delay);
          continue;
        }

        if (status === 500 && retries500 < MAX_500_RETRIES) {
          retries500++;
          await sleep(BASE_DELAY_MS);
          continue;
        }

        throw error;
      }
    }
  }
}
