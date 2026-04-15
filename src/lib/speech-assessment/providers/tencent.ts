import { createHmac } from "crypto";
import type {
  ISpeechAssessmentProvider,
  AssessmentResult,
  WordScore,
} from "../types";

/**
 * 腾讯云 — 智聆口语评测（新版）WebSocket provider.
 *
 * Protocol: WSS (WebSocket Secure)
 * Endpoint: wss://soe.cloud.tencent.com/soe/api/<appid>?{签名参数}
 * Docs: https://cloud.tencent.com/document/product/1774/107497
 *
 * Required env vars:
 *   TENCENT_SECRET_ID
 *   TENCENT_SECRET_KEY
 *   TENCENT_SOE_APPID — 腾讯云 AppID
 */
export class TencentSpeechProvider implements ISpeechAssessmentProvider {
  readonly name = "tencent" as const;

  private secretId: string;
  private secretKey: string;
  private appId: string;

  constructor() {
    this.secretId = process.env.TENCENT_SECRET_ID ?? "";
    this.secretKey = process.env.TENCENT_SECRET_KEY ?? "";
    this.appId = process.env.TENCENT_SOE_APPID ?? "";

    if (!this.secretId || !this.secretKey || !this.appId) {
      console.warn(
        "[speech-tencent] TENCENT_SECRET_ID/SECRET_KEY/SOE_APPID not set",
      );
    }
  }

  async assess(
    referenceText: string,
    audioBase64: string,
  ): Promise<AssessmentResult> {
    const start = Date.now();
    const wsUrl = this.buildSignedUrl(referenceText);

    return new Promise<AssessmentResult>((resolve, reject) => {
      import("ws").then(({ default: WebSocket }) => {
        const ws = new WebSocket(wsUrl);
        let finalResult: any = null;

        ws.on("open", async () => {
          try {
            // Send audio in chunks (1280 bytes = 40ms @ 16kHz 16bit mono)
            const audioBuffer = Buffer.from(audioBase64, "base64");
            const chunkSize = 1280;

            for (let i = 0; i < audioBuffer.length; i += chunkSize) {
              const chunk = audioBuffer.subarray(i, i + chunkSize);
              ws.send(new Uint8Array(chunk));

              // Pace sending at ~40ms intervals
              if (i + chunkSize < audioBuffer.length) {
                await new Promise((r) => setTimeout(r, 40));
              }
            }

            // Signal end of audio
            ws.send(JSON.stringify({ type: "end" }));
          } catch (err) {
            ws.close();
            reject(err instanceof Error ? err : new Error(String(err)));
          }
        });

        ws.on("message", (msg: Buffer) => {
          try {
            const response = JSON.parse(msg.toString());

            if (response.code !== 0) {
              ws.close();
              reject(
                new Error(
                  `Tencent SOE error ${response.code}: ${response.message}`,
                ),
              );
              return;
            }

            // final=1 means the complete assessment result
            if (response.final === 1) {
              finalResult = response;
              ws.close();
            }
          } catch {
            // Ignore non-JSON messages
          }
        });

        ws.on("close", () => {
          if (finalResult) {
            const durationMs = Date.now() - start;
            resolve(this.normalize(finalResult, durationMs));
          } else if (!finalResult) {
            reject(new Error("Tencent SOE: connection closed without result"));
          }
        });

        ws.on("error", (err: Error) => reject(err));

        // Timeout after 30s
        setTimeout(() => {
          ws.close();
          reject(new Error("Tencent SOE WebSocket timeout"));
        }, 30000);
      });
    });
  }

  /**
   * Build signed WSS URL per Tencent docs.
   *
   * Signature = Base64(HmacSHA1(签名原文, SecretKey))
   * 签名原文 = 按字典序排列的参数拼接到 URL path 上
   */
  private buildSignedUrl(referenceText: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const expired = timestamp + 600; // 10 min validity
    const nonce = Math.floor(Math.random() * 1000000000);
    const voiceId = `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // All params except signature, sorted alphabetically
    const params: Record<string, string> = {
      eval_mode: "1", // sentence
      expired: expired.toString(),
      nonce: nonce.toString(),
      ref_text: referenceText,
      score_coeff: "1.0",
      secretid: this.secretId,
      sentence_info_enabled: "1",
      server_engine_type: "16k_en",
      timestamp: timestamp.toString(),
      voice_format: "0", // PCM
      voice_id: voiceId,
    };

    // Sort keys alphabetically and build query string
    const sortedKeys = Object.keys(params).sort();
    const queryString = sortedKeys
      .map((k) => `${k}=${params[k]}`)
      .join("&");

    // Signature origin: URL path without protocol
    const signOrigin = `soe.cloud.tencent.com/soe/api/${this.appId}?${queryString}`;

    // HMAC-SHA1 sign
    const signature = createHmac("sha1", this.secretKey)
      .update(signOrigin)
      .digest("base64");

    const encodedSignature = encodeURIComponent(signature);

    return `wss://soe.cloud.tencent.com/soe/api/${this.appId}?${queryString}&signature=${encodedSignature}`;
  }

  private normalize(response: any, durationMs: number): AssessmentResult {
    const result = response.result ?? {};

    const words: WordScore[] = (result.Words ?? []).map((w: any) => ({
      word: w.Word ?? w.Mword ?? "",
      accuracyScore: w.PronAccuracy ?? 0,
      errorType: matchTagToError(w.MatchTag ?? 0),
      phonemes: (w.PhoneInfos ?? []).map((p: any) => ({
        phoneme: p.Phone ?? "",
        accuracyScore: p.PronAccuracy ?? 0,
      })),
    }));

    return {
      provider: "tencent",
      overallScore: result.SuggestedScore ?? 0,
      accuracyScore: result.PronAccuracy ?? 0,
      fluencyScore: (result.PronFluency ?? 0) * 100,
      completenessScore: (result.PronCompletion ?? 0) * 100,
      words,
      raw: response,
      durationMs,
    };
  }
}

function matchTagToError(tag: number): string {
  switch (tag) {
    case 0: return "none";
    case 1: return "omission";
    case 2: return "insertion";
    case 3: return "mispronunciation";
    default: return "none";
  }
}
