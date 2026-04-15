/**
 * Unified types for speech/oral assessment across providers.
 * All providers normalize their results to this common format.
 */

export type ProviderName = "azure" | "iflytek" | "tencent";

/** Assessment request — sent from frontend to backend */
export interface AssessmentRequest {
  /** Reference text the user should read aloud */
  referenceText: string;
  /** Base64-encoded audio data (PCM 16-bit, 16kHz, mono) */
  audioBase64: string;
  /** Which providers to evaluate with */
  providers: ProviderName[];
}

/** Per-phoneme score */
export interface PhonemeScore {
  phoneme: string;
  accuracyScore: number;
}

/** Per-word score */
export interface WordScore {
  word: string;
  accuracyScore: number;
  /** "none" | "omission" | "insertion" | "mispronunciation" */
  errorType: string;
  phonemes?: PhonemeScore[];
}

/** Normalized assessment result — common across all providers */
export interface AssessmentResult {
  provider: ProviderName;
  /** Overall scores (0-100) */
  overallScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  /** Per-word breakdown */
  words: WordScore[];
  /** Raw response from provider (for debugging) */
  raw?: unknown;
  /** Processing time in ms */
  durationMs: number;
}

/** Error result when a provider fails */
export interface AssessmentError {
  provider: ProviderName;
  error: string;
}

/** Combined response for all providers */
export interface AssessmentResponse {
  referenceText: string;
  results: AssessmentResult[];
  errors: AssessmentError[];
}

/**
 * Provider interface — each cloud provider implements this.
 */
export interface ISpeechAssessmentProvider {
  readonly name: ProviderName;

  /**
   * Assess pronunciation of the given audio against reference text.
   * Audio: PCM 16-bit, 16kHz, mono, base64-encoded.
   */
  assess(
    referenceText: string,
    audioBase64: string,
  ): Promise<AssessmentResult>;
}
