export type {
  ProviderName,
  AssessmentRequest,
  AssessmentResult,
  AssessmentResponse,
  AssessmentError,
  ISpeechAssessmentProvider,
  WordScore,
  PhonemeScore,
} from "./types";

export { AzureSpeechProvider } from "./providers/azure";
export { IflytekSpeechProvider } from "./providers/iflytek";
export { TencentSpeechProvider } from "./providers/tencent";

import type {
  ISpeechAssessmentProvider,
  ProviderName,
  AssessmentRequest,
  AssessmentResponse,
} from "./types";
import { AzureSpeechProvider } from "./providers/azure";
import { IflytekSpeechProvider } from "./providers/iflytek";
import { TencentSpeechProvider } from "./providers/tencent";

/** Create all available providers */
export function createProviders(): Map<ProviderName, ISpeechAssessmentProvider> {
  const providers = new Map<ProviderName, ISpeechAssessmentProvider>();
  providers.set("azure", new AzureSpeechProvider());
  providers.set("iflytek", new IflytekSpeechProvider());
  providers.set("tencent", new TencentSpeechProvider());
  return providers;
}

/** Run assessment across multiple providers in parallel */
export async function assessParallel(
  request: AssessmentRequest,
  providers: Map<ProviderName, ISpeechAssessmentProvider>,
): Promise<AssessmentResponse> {
  const tasks = request.providers.map(async (name) => {
    const provider = providers.get(name);
    if (!provider) {
      return { type: "error" as const, provider: name, error: `Provider "${name}" not found` };
    }
    try {
      const result = await provider.assess(request.referenceText, request.audioBase64);
      return { type: "result" as const, result };
    } catch (err) {
      return {
        type: "error" as const,
        provider: name,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  });

  const settled = await Promise.all(tasks);

  return {
    referenceText: request.referenceText,
    results: settled
      .filter((s) => s.type === "result")
      .map((s) => (s as any).result),
    errors: settled
      .filter((s) => s.type === "error")
      .map((s) => ({ provider: (s as any).provider, error: (s as any).error })),
  };
}
