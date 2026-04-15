export type AgentRole = "observer" | "conductor" | "tutor";

export interface ModelConfig {
  model: string;
  maxTokens: number;
  temperature: number;
}

export const MODEL_CONFIGS: Record<AgentRole, ModelConfig> = {
  observer: {
    model: "claude-haiku-4-5-20251001",
    maxTokens: 500,
    temperature: 0.3,
  },
  conductor: {
    model: "claude-sonnet-4-6-20250514",
    maxTokens: 1000,
    temperature: 0.4,
  },
  tutor: {
    model: "claude-sonnet-4-6-20250514",
    maxTokens: 2000,
    temperature: 0.7,
  },
};
