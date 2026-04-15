import { createHmac } from "crypto";
import WebSocket from "ws";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import type { TypedSocket, SpeechIntermediatePayload, SpeechWordResult } from "@/lib/ws/types";

/**
 * Manages a streaming speech assessment session.
 * Receives PCM audio chunks from the client and fans out to provider connections.
 *
 * - Azure: Speech SDK with PushAudioInputStream (real streaming)
 * - iFlytek: WebSocket with realtime_feedback
 * - Tencent: WebSocket with sentence_info_enabled
 */
export class StreamingSpeechSession {
  private referenceText: string;
  private clientSocket: TypedSocket;
  private iflytekWs: WebSocket | null = null;
  private tencentWs: WebSocket | null = null;
  private iflytekSeq = 0;
  private iflytekFirstSent = false;
  private startTime = Date.now();
  private providers: Set<string>;

  // Azure SDK streaming
  private azurePushStream: sdk.PushAudioInputStream | null = null;
  private azureRecognizer: sdk.SpeechRecognizer | null = null;

  constructor(
    clientSocket: TypedSocket,
    referenceText: string,
    providers: ("azure" | "iflytek" | "tencent")[],
  ) {
    this.clientSocket = clientSocket;
    this.referenceText = referenceText;
    this.providers = new Set(providers);
    this.startTime = Date.now();
  }

  async connect(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.providers.has("azure")) {
      promises.push(this.connectAzure());
    }
    if (this.providers.has("iflytek")) {
      promises.push(this.connectIflytek());
    }
    if (this.providers.has("tencent")) {
      promises.push(this.connectTencent());
    }

    await Promise.all(promises);
  }

  sendAudio(audioBase64: string): void {
    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Azure: push to SDK stream
    if (this.azurePushStream) {
      this.azurePushStream.write(new Uint8Array(audioBuffer).buffer as ArrayBuffer);
    }

    if (this.iflytekWs?.readyState === WebSocket.OPEN) {
      this.sendIflytekChunk(audioBuffer, false);
    }

    if (this.tencentWs?.readyState === WebSocket.OPEN) {
      this.tencentWs.send(new Uint8Array(audioBuffer));
    }
  }

  endAudio(): void {
    // Azure: close push stream to signal end
    if (this.azurePushStream) {
      this.azurePushStream.close();
    }

    // iFlytek: send silent frame with status=2
    if (this.iflytekWs?.readyState === WebSocket.OPEN) {
      const silence = Buffer.alloc(1024);
      const frame = {
        header: { app_id: process.env.IFLYTEK_APP_ID, status: 2 },
        payload: {
          data: {
            encoding: "raw",
            sample_rate: 16000,
            channels: 1,
            bit_depth: 16,
            status: 2,
            seq: this.iflytekSeq++,
            audio: silence.toString("base64"),
            frame_size: silence.length,
          },
        },
      };
      this.iflytekWs.send(JSON.stringify(frame));
    }

    // Tencent: send end signal
    if (this.tencentWs?.readyState === WebSocket.OPEN) {
      this.tencentWs.send(JSON.stringify({ type: "end" }));
    }
  }

  destroy(): void {
    // Azure cleanup
    if (this.azureRecognizer) {
      try { this.azureRecognizer.close(); } catch { /* ignore */ }
      this.azureRecognizer = null;
    }
    if (this.azurePushStream) {
      try { this.azurePushStream.close(); } catch { /* ignore */ }
      this.azurePushStream = null;
    }

    if (this.iflytekWs) {
      this.iflytekWs.removeAllListeners();
      if (this.iflytekWs.readyState === WebSocket.OPEN) this.iflytekWs.close();
      this.iflytekWs = null;
    }
    if (this.tencentWs) {
      this.tencentWs.removeAllListeners();
      if (this.tencentWs.readyState === WebSocket.OPEN) this.tencentWs.close();
      this.tencentWs = null;
    }
  }

  // ============================================================
  // Azure Speech SDK (streaming via PushAudioInputStream)
  // ============================================================

  private connectAzure(): Promise<void> {
    return new Promise((resolve, reject) => {
      const key = process.env.AZURE_SPEECH_KEY ?? "";
      const region = process.env.AZURE_SPEECH_REGION ?? "eastasia";

      if (!key) {
        reject(new Error("AZURE_SPEECH_KEY not set"));
        return;
      }

      try {
        const speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
        speechConfig.speechRecognitionLanguage = "en-US";

        // Create push stream for real-time audio input
        const format = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
        this.azurePushStream = sdk.AudioInputStream.createPushStream(format);
        const audioConfig = sdk.AudioConfig.fromStreamInput(this.azurePushStream);

        // Configure pronunciation assessment
        const pronConfig = new sdk.PronunciationAssessmentConfig(
          this.referenceText,
          sdk.PronunciationAssessmentGradingSystem.HundredMark,
          sdk.PronunciationAssessmentGranularity.Phoneme,
          true, // enableMiscue
        );
        pronConfig.enableProsodyAssessment = true;

        const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
        pronConfig.applyTo(recognizer);
        this.azureRecognizer = recognizer;

        // Use recognizeOnceAsync — it will wait for audio from the push stream
        recognizer.recognizeOnceAsync(
          (result) => {
            if (result.reason === sdk.ResultReason.RecognizedSpeech) {
              this.emitAzureResult(result);
            } else {
              console.error("[speech-stream] Azure recognition failed:", result.reason, result.errorDetails);
              this.clientSocket.emit("session:error", {
                code: "AZURE_RECOGNITION_FAILED",
                message: result.errorDetails || `Recognition reason: ${result.reason}`,
              });
            }
            recognizer.close();
          },
          (err) => {
            console.error("[speech-stream] Azure error:", err);
            recognizer.close();
          },
        );

        console.log("[speech-stream] Azure SDK connected (push stream ready)");
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  private emitAzureResult(result: sdk.SpeechRecognitionResult): void {
    const pronResult = sdk.PronunciationAssessmentResult.fromResult(result);

    const words: SpeechWordResult[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const detailWords = (pronResult as any).detailResult?.Words ?? [];
    for (const w of detailWords) {
      const errorType = (w.PronunciationAssessment?.ErrorType ?? "None").toLowerCase();
      // Skip Insertion words — they don't map to any reference text word
      // and would cause index misalignment in the frontend word grid
      if (errorType === "insertion") continue;
      words.push({
        word: w.Word ?? "",
        accuracyScore: w.PronunciationAssessment?.AccuracyScore ?? 0,
        errorType,
      });
    }

    // Get raw JSON for debugging
    let raw: unknown = undefined;
    try {
      const jsonStr = result.properties.getProperty(
        sdk.PropertyId.SpeechServiceResponse_JsonResult,
      );
      if (jsonStr) raw = JSON.parse(jsonStr);
    } catch { /* ignore */ }

    const payload: SpeechIntermediatePayload = {
      provider: "azure",
      type: "final",
      overallScore: pronResult.pronunciationScore ?? 0,
      accuracyScore: pronResult.accuracyScore ?? 0,
      fluencyScore: pronResult.fluencyScore ?? 0,
      completenessScore: pronResult.completenessScore ?? 0,
      words,
      durationMs: Date.now() - this.startTime,
      raw,
    };

    this.clientSocket.emit("speech:result", payload);
    console.log(`[speech-stream] Azure result: overall=${payload.overallScore} accuracy=${payload.accuracyScore}`);
  }

  // ============================================================
  // iFlytek Suntone
  // ============================================================

  private iflytekLastResult: string | null = null;
  private iflytekGotFinal = false;

  private connectIflytek(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = this.buildIflytekUrl();
      const ws = new WebSocket(url);
      this.iflytekWs = ws;

      ws.on("open", () => {
        console.log("[speech-stream] iFlytek connected");
        resolve();
      });

      ws.on("message", (msg: Buffer) => {
        try {
          const resp = JSON.parse(msg.toString());
          if (resp.header?.code !== 0) {
            console.error("[speech-stream] iFlytek error:", resp.header?.message);
            return;
          }

          const status = resp.header?.status;
          if (resp.payload?.result?.text) {
            const decoded = Buffer.from(resp.payload.result.text, "base64").toString("utf-8");
            this.iflytekLastResult = decoded;
            const isFinal = status === 2;
            if (isFinal) this.iflytekGotFinal = true;
            this.emitIflytekResult(decoded, isFinal);
          }
        } catch { /* ignore */ }
      });

      ws.on("error", (err) => {
        console.error("[speech-stream] iFlytek ws error:", err.message);
        reject(err);
      });

      ws.on("close", () => {
        console.log("[speech-stream] iFlytek disconnected");
        if (!this.iflytekGotFinal && this.iflytekLastResult) {
          this.emitIflytekResult(this.iflytekLastResult, true);
        }
      });
    });
  }

  private sendIflytekChunk(audioBuffer: Buffer, isLast: boolean): void {
    const chunkSize = 1024;

    for (let i = 0; i < audioBuffer.length; i += chunkSize) {
      const chunk = audioBuffer.subarray(i, i + chunkSize);
      const isFirst = !this.iflytekFirstSent;
      const isEnd = isLast && i + chunkSize >= audioBuffer.length;

      let status = 1;
      if (isFirst) { status = 0; this.iflytekFirstSent = true; }
      if (isEnd) status = 2;

      const frame: Record<string, unknown> = {
        header: { app_id: process.env.IFLYTEK_APP_ID, status },
        payload: {
          data: {
            encoding: "raw",
            sample_rate: 16000,
            channels: 1,
            bit_depth: 16,
            status,
            seq: this.iflytekSeq++,
            audio: chunk.toString("base64"),
            frame_size: chunk.length,
          },
        },
      };

      if (isFirst) {
        frame.parameter = {
          st: {
            lang: "en",
            core: "sent",
            refText: this.referenceText,
            scale: 100,
            realtime_feedback: 1,
            result: { encoding: "utf8", compress: "raw", format: "plain" },
          },
        };
      }

      this.iflytekWs?.send(JSON.stringify(frame));
    }
  }

  private emitIflytekResult(resultText: string, isFinal: boolean): void {
    try {
      const parsed = JSON.parse(resultText);
      const r = parsed.result ?? parsed;

      const words: SpeechWordResult[] = (r.words ?? []).map((w: any) => ({
        word: w.word ?? "",
        accuracyScore: w.scores?.pronunciation ?? w.scores?.overall ?? 0,
        errorType: "none",
      }));

      const payload: SpeechIntermediatePayload = {
        provider: "iflytek",
        type: isFinal ? "final" : "intermediate",
        overallScore: r.overall ?? 0,
        accuracyScore: r.pronunciation ?? 0,
        fluencyScore: r.fluency ?? 0,
        completenessScore: r.integrity ?? 0,
        words,
        durationMs: Date.now() - this.startTime,
        raw: parsed,
      };

      this.clientSocket.emit("speech:result", payload);
    } catch { /* ignore parse errors */ }
  }

  private buildIflytekUrl(): string {
    const host = "cn-east-1.ws-api.xf-yun.com";
    const path = "/v1/private/s8e098720";
    const date = new Date().toUTCString();
    const apiKey = process.env.IFLYTEK_API_KEY ?? "";
    const apiSecret = process.env.IFLYTEK_API_SECRET ?? "";

    const signOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
    const signature = createHmac("sha256", apiSecret).update(signOrigin).digest("base64");
    const authOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    const authorization = Buffer.from(authOrigin).toString("base64");

    const params = new URLSearchParams({ authorization, date, host });
    return `wss://${host}${path}?${params.toString()}`;
  }

  // ============================================================
  // Tencent SOE
  // ============================================================

  private connectTencent(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = this.buildTencentUrl();
      const ws = new WebSocket(url);
      this.tencentWs = ws;

      ws.on("open", () => {
        console.log("[speech-stream] Tencent connected");
        resolve();
      });

      ws.on("message", (msg: Buffer) => {
        try {
          const resp = JSON.parse(msg.toString());
          if (resp.code !== 0) {
            console.error("[speech-stream] Tencent error:", resp.message);
            return;
          }

          const isFinal = resp.final === 1;
          if (resp.result) {
            this.emitTencentResult(resp.result, isFinal);
          }
        } catch { /* ignore */ }
      });

      ws.on("error", (err) => {
        console.error("[speech-stream] Tencent ws error:", err.message);
        reject(err);
      });

      ws.on("close", () => {
        console.log("[speech-stream] Tencent disconnected");
      });
    });
  }

  private emitTencentResult(result: any, isFinal: boolean): void {
    const r = typeof result === "string" ? JSON.parse(result) : result;

    const words: SpeechWordResult[] = (r.Words ?? []).map((w: any) => ({
      word: w.Word ?? "",
      accuracyScore: w.PronAccuracy ?? 0,
      errorType: matchTagToError(w.MatchTag ?? 0),
    }));

    const payload: SpeechIntermediatePayload = {
      provider: "tencent",
      type: isFinal ? "final" : "intermediate",
      overallScore: r.SuggestedScore ?? 0,
      accuracyScore: r.PronAccuracy ?? 0,
      fluencyScore: (r.PronFluency ?? 0) * 100,
      completenessScore: (r.PronCompletion ?? 0) * 100,
      words,
      durationMs: Date.now() - this.startTime,
      raw: r,
    };

    this.clientSocket.emit("speech:result", payload);
  }

  private buildTencentUrl(): string {
    const secretId = process.env.TENCENT_SECRET_ID ?? "";
    const secretKey = process.env.TENCENT_SECRET_KEY ?? "";
    const appId = process.env.TENCENT_SOE_APPID ?? "";
    const timestamp = Math.floor(Date.now() / 1000);
    const expired = timestamp + 600;
    const nonce = Math.floor(Math.random() * 1000000000);
    const voiceId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const params: Record<string, string> = {
      eval_mode: "1",
      expired: expired.toString(),
      nonce: nonce.toString(),
      rec_mode: "0",
      ref_text: this.referenceText,
      score_coeff: "1.0",
      secretid: secretId,
      sentence_info_enabled: "1",
      server_engine_type: "16k_en",
      timestamp: timestamp.toString(),
      voice_format: "0",
      voice_id: voiceId,
    };

    const sortedKeys = Object.keys(params).sort();
    const queryString = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
    const signOrigin = `soe.cloud.tencent.com/soe/api/${appId}?${queryString}`;
    const signature = createHmac("sha1", secretKey).update(signOrigin).digest("base64");

    return `wss://soe.cloud.tencent.com/soe/api/${appId}?${queryString}&signature=${encodeURIComponent(signature)}`;
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
