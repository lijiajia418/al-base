import type {
  ISpeechAssessmentProvider,
  AssessmentResult,
  WordScore,
} from "../types";

/**
 * Azure Speech Service — Pronunciation Assessment provider.
 *
 * Uses REST API with Content-Type audio/wav.
 * Docs: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment
 *
 * Required env vars:
 *   AZURE_SPEECH_KEY — subscription key
 *   AZURE_SPEECH_REGION — e.g. "eastasia", "westus2"
 */
export class AzureSpeechProvider implements ISpeechAssessmentProvider {
  readonly name = "azure" as const;

  private key: string;
  private region: string;

  constructor() {
    this.key = process.env.AZURE_SPEECH_KEY ?? "";
    this.region = process.env.AZURE_SPEECH_REGION ?? "eastasia";

    if (!this.key) {
      console.warn("[speech-azure] AZURE_SPEECH_KEY not set");
    }
  }

  async assess(
    referenceText: string,
    audioBase64: string,
  ): Promise<AssessmentResult> {
    const start = Date.now();

    // Build pronunciation assessment config
    const pronConfig = {
      ReferenceText: referenceText,
      GradingSystem: "HundredMark",
      Granularity: "Phoneme",
      Dimension: "Comprehensive",
      EnableMiscue: true,
    };

    const pronConfigBase64 = Buffer.from(
      JSON.stringify(pronConfig),
    ).toString("base64");

    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Add WAV header if raw PCM
    const wavBuffer = addWavHeader(audioBuffer, 16000, 16, 1);

    const url =
      `https://${this.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1` +
      `?language=en-US&format=detailed`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": this.key,
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        "Pronunciation-Assessment": pronConfigBase64,
        Accept: "application/json",
      },
      body: new Uint8Array(wavBuffer),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Azure API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const durationMs = Date.now() - start;

    return this.normalize(data, durationMs);
  }

  private normalize(data: any, durationMs: number): AssessmentResult {
    const nbest = data.NBest?.[0];
    const pa = nbest?.PronunciationAssessment ?? {};

    const words: WordScore[] = (nbest?.Words ?? []).map((w: any) => ({
      word: w.Word,
      accuracyScore: w.PronunciationAssessment?.AccuracyScore ?? 0,
      errorType: (w.PronunciationAssessment?.ErrorType ?? "None").toLowerCase(),
      phonemes: (w.Phonemes ?? []).map((p: any) => ({
        phoneme: p.Phoneme,
        accuracyScore: p.PronunciationAssessment?.AccuracyScore ?? 0,
      })),
    }));

    return {
      provider: "azure",
      overallScore: pa.PronScore ?? 0,
      accuracyScore: pa.AccuracyScore ?? 0,
      fluencyScore: pa.FluencyScore ?? 0,
      completenessScore: pa.CompletenessScore ?? 0,
      words,
      raw: data,
      durationMs,
    };
  }
}

/** Add WAV header to raw PCM data */
function addWavHeader(
  pcm: Buffer,
  sampleRate: number,
  bitsPerSample: number,
  channels: number,
): Buffer {
  const byteRate = (sampleRate * bitsPerSample * channels) / 8;
  const blockAlign = (bitsPerSample * channels) / 8;
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}
