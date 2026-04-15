import { createHmac } from "crypto";
import type {
  ISpeechAssessmentProvider,
  AssessmentResult,
  WordScore,
} from "../types";

/**
 * 科大讯飞 — 语音评测 Suntone WebSocket provider.
 *
 * Endpoint: wss://cn-east-1.ws-api.xf-yun.com/v1/private/s8e098720
 * Docs: https://www.xfyun.cn/doc/voiceservice/suntone/API.html
 *
 * Required env vars:
 *   IFLYTEK_APP_ID
 *   IFLYTEK_API_KEY
 *   IFLYTEK_API_SECRET
 */
export class IflytekSpeechProvider implements ISpeechAssessmentProvider {
  readonly name = "iflytek" as const;

  private appId: string;
  private apiKey: string;
  private apiSecret: string;

  private static readonly HOST = "cn-east-1.ws-api.xf-yun.com";
  private static readonly PATH = "/v1/private/s8e098720";

  constructor() {
    this.appId = process.env.IFLYTEK_APP_ID ?? "";
    this.apiKey = process.env.IFLYTEK_API_KEY ?? "";
    this.apiSecret = process.env.IFLYTEK_API_SECRET ?? "";

    if (!this.appId || !this.apiKey || !this.apiSecret) {
      console.warn("[speech-iflytek] IFLYTEK_APP_ID/API_KEY/API_SECRET not set");
    }
  }

  async assess(
    referenceText: string,
    audioBase64: string,
  ): Promise<AssessmentResult> {
    const start = Date.now();
    const wsUrl = this.buildAuthUrl();

    return new Promise<AssessmentResult>((resolve, reject) => {
      import("ws").then(({ default: WebSocket }) => {
        const ws = new WebSocket(wsUrl);
        let resultText = "";

        ws.on("open", async () => {
          try {
            const audioBuffer = Buffer.from(audioBase64, "base64");
            const chunkSize = 1024; // iFlytek frame_size max 1024 bytes
            const totalChunks = Math.ceil(audioBuffer.length / chunkSize);
            let seq = 0;

            for (let i = 0; i < audioBuffer.length; i += chunkSize) {
              const chunk = audioBuffer.subarray(i, i + chunkSize);
              const isFirst = i === 0;
              const isLast = i + chunkSize >= audioBuffer.length;

              let status = 1; // middle
              if (isFirst) status = 0;
              if (isLast) status = 2;
              // Single chunk: status = 2 (first + last)
              if (totalChunks === 1) status = 2;

              const frame: Record<string, unknown> = {
                header: { app_id: this.appId, status },
                payload: {
                  data: {
                    encoding: "raw",
                    sample_rate: 16000,
                    channels: 1,
                    bit_depth: 16,
                    status,
                    seq: seq++,
                    audio: chunk.toString("base64"),
                    frame_size: chunk.length,
                  },
                },
              };

              // First frame includes parameter
              if (isFirst) {
                frame.parameter = {
                  st: {
                    lang: "en",
                    core: "sent",
                    refText: referenceText,
                    scale: 100,
                    result: {
                      encoding: "utf8",
                      compress: "raw",
                      format: "plain",
                    },
                  },
                };
              }

              ws.send(JSON.stringify(frame));

              // Pace sending at ~40ms intervals (simulate real-time)
              if (!isLast) {
                await sleep(40);
              }
            }
          } catch (err) {
            ws.close();
            reject(err);
          }
        });

        ws.on("message", (msg: Buffer) => {
          try {
            const response = JSON.parse(msg.toString());

            if (response.header?.code !== 0) {
              ws.close();
              reject(
                new Error(
                  `iFlytek error ${response.header?.code}: ${response.header?.message}`,
                ),
              );
              return;
            }

            if (response.payload?.result?.text) {
              const decoded = Buffer.from(
                response.payload.result.text,
                "base64",
              ).toString("utf-8");
              resultText += decoded;
            }

            if (response.header?.status === 2) {
              ws.close();
              const durationMs = Date.now() - start;
              try {
                resolve(this.normalize(resultText, durationMs));
              } catch (err) {
                reject(err);
              }
            }
          } catch {
            // Ignore parse errors
          }
        });

        ws.on("error", (err: Error) => reject(err));

        setTimeout(() => {
          ws.close();
          reject(new Error("iFlytek WebSocket timeout"));
        }, 30000);
      });
    });
  }

  private buildAuthUrl(): string {
    const date = new Date().toUTCString();

    const signatureOrigin = [
      `host: ${IflytekSpeechProvider.HOST}`,
      `date: ${date}`,
      `GET ${IflytekSpeechProvider.PATH} HTTP/1.1`,
    ].join("\n");

    const signature = createHmac("sha256", this.apiSecret)
      .update(signatureOrigin)
      .digest("base64");

    const authorizationOrigin =
      `api_key="${this.apiKey}", algorithm="hmac-sha256", ` +
      `headers="host date request-line", signature="${signature}"`;
    const authorization = Buffer.from(authorizationOrigin).toString("base64");

    const params = new URLSearchParams({
      authorization,
      date,
      host: IflytekSpeechProvider.HOST,
    });

    return `wss://${IflytekSpeechProvider.HOST}${IflytekSpeechProvider.PATH}?${params.toString()}`;
  }

  private normalize(resultText: string, durationMs: number): AssessmentResult {
    let parsed: any = {};
    try {
      parsed = JSON.parse(resultText);
    } catch {
      return this.normalizeFallback(resultText, durationMs);
    }

    // iFlytek Suntone wraps scores in a "result" object
    const r = parsed.result ?? parsed;

    const overall = r.overall ?? r.total ?? 0;
    const pronunciation = r.pronunciation ?? r.accuracy_score ?? 0;
    const fluency = r.fluency ?? r.fluency_score ?? 0;
    const integrity = r.integrity ?? r.completeness ?? 100;

    const words: WordScore[] = (r.words ?? []).map((w: any) => ({
      word: w.word ?? w.content ?? "",
      accuracyScore: w.scores?.pronunciation ?? w.scores?.overall ?? w.pronunciation ?? 0,
      errorType: "none",
      phonemes: (w.phonemes ?? []).map((p: any) => ({
        phoneme: p.phoneme ?? "",
        accuracyScore: p.pronunciation ?? 0,
      })),
    }));

    return {
      provider: "iflytek",
      overallScore: overall,
      accuracyScore: pronunciation,
      fluencyScore: fluency,
      completenessScore: integrity,
      words,
      raw: parsed,
      durationMs,
    };
  }

  private normalizeFallback(
    text: string,
    durationMs: number,
  ): AssessmentResult {
    const getScore = (name: string): number => {
      const match = text.match(new RegExp(`"?${name}"?\\s*[:=]\\s*"?([\\d.]+)`));
      return match ? parseFloat(match[1]) : 0;
    };

    return {
      provider: "iflytek",
      overallScore: getScore("overall") || getScore("total_score"),
      accuracyScore: getScore("pronunciation") || getScore("accuracy_score"),
      fluencyScore: getScore("fluency") || getScore("fluency_score"),
      completenessScore: getScore("integrity") || getScore("integrity_score"),
      words: [],
      raw: text,
      durationMs,
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
