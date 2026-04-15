"use client";

import { useState, useRef, useCallback } from "react";

type ProviderName = "azure" | "iflytek" | "tencent";

interface WordScore {
  word: string;
  accuracyScore: number;
  errorType: string;
}

interface AssessmentResult {
  provider: ProviderName;
  overallScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  words: WordScore[];
  durationMs: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any;
}

interface AssessmentError {
  provider: ProviderName;
  error: string;
}

const PROVIDER_LABELS: Record<ProviderName, string> = {
  azure: "Microsoft Azure",
  iflytek: "科大讯飞",
  tencent: "腾讯云",
};

const SAMPLE_SENTENCES = [
  "The sheep on the ship will sit in the seat.",
  "I think three thousand things are free to think about.",
  "The girl from around the world really ruled the rural area.",
  "We were very wary of the vest from the west.",
  "She asked him what happened and handed it to the next person.",
  "I want to record a new record and present the present.",
  "The characteristics of successful entrepreneurship are particularly interesting.",
  "A couple of us went to the store for a bottle of water at the end of the day.",
  "She laughed at the joke, smiled at the crowd, and waited for the bus.",
  "I've always thought that the author's daughter brought thorough work to the theater.",
];

export default function SpeechDemoPage() {
  const [referenceText, setReferenceText] = useState(SAMPLE_SENTENCES[0]);
  const [recording, setRecording] = useState(false);
  const [assessing, setAssessing] = useState(false);
  const [activeTab, setActiveTab] = useState<ProviderName>("azure");
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [errors, setErrors] = useState<AssessmentError[]>([]);
  const [statusMsg, setStatusMsg] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [countdown, setCountdown] = useState(0);

  const startRecording = useCallback(async () => {
    try {
      // Acquire mic first — hardware activation happens here
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
      });

      setResults([]);
      setErrors([]);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }

      // Countdown to let mic fully warm up before user starts speaking
      setCountdown(3);
      await sleep(1000);
      setCountdown(2);
      await sleep(1000);
      setCountdown(1);
      await sleep(1000);
      setCountdown(0);

      // Now start recording — mic is fully ready
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
        await processAudio(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);
      setRecording(true);
      setStatusMsg("正在录音... 请开始朗读");
    } catch (err) {
      setStatusMsg(`麦克风权限错误: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    setStatusMsg("录音结束，正在评测...");
  }, []);

  const processAudio = async (webmBlob: Blob) => {
    setAssessing(true);

    try {
      // Convert WebM to PCM 16-bit 16kHz mono
      const pcmBase64 = await convertToPCM16k(webmBlob);

      const res = await fetch("/api/speech/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceText,
          audioBase64: pcmBase64,
          providers: ["azure", "iflytek", "tencent"],
        }),
      });

      const data = await res.json();

      if (data.results) setResults(data.results);
      if (data.errors) setErrors(data.errors);

      setStatusMsg(
        `评测完成: ${data.results?.length ?? 0} 家成功, ${data.errors?.length ?? 0} 家失败`,
      );

      // Auto-switch to first successful result tab
      if (data.results?.length > 0) {
        setActiveTab(data.results[0].provider);
      }
    } catch (err) {
      setStatusMsg(`评测请求失败: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setAssessing(false);
    }
  };

  /** Convert WebM audio blob to PCM 16-bit 16kHz mono, return base64 */
  const convertToPCM16k = async (blob: Blob): Promise<string> => {
    const arrayBuffer = await blob.arrayBuffer();
    const ctx = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = ctx;

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0); // mono

    // Float32 → Int16
    const pcm = new Int16Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    ctx.close();

    // Int16Array → base64
    const bytes = new Uint8Array(pcm.buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const activeResult = results.find((r) => r.provider === activeTab);
  const activeError = errors.find((e) => e.provider === activeTab);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
        英语口语评测
      </h1>

      {/* Reference text */}
      <section style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          朗读文本 (Reference Text)
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {SAMPLE_SENTENCES.map((s, i) => (
            <button
              key={i}
              onClick={() => setReferenceText(s)}
              style={{
                padding: "4px 10px",
                fontSize: 12,
                background: referenceText === s ? "#2563eb" : "#eff6ff",
                color: referenceText === s ? "#fff" : "#1d4ed8",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              句子 {i + 1}
            </button>
          ))}
        </div>
        <div
          style={{
            padding: 16,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            fontSize: 18,
            lineHeight: 1.6,
            letterSpacing: 0.5,
          }}
        >
          {referenceText}
        </div>
      </section>

      {/* Recording controls */}
      <section style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
        {countdown > 0 ? (
          <div style={{
            padding: "10px 24px",
            fontSize: 20,
            fontWeight: 700,
            color: "#dc2626",
            background: "#fef2f2",
            borderRadius: 8,
            minWidth: 140,
            textAlign: "center",
          }}>
            {countdown}... 准备朗读
          </div>
        ) : !recording ? (
          <button
            onClick={startRecording}
            disabled={assessing || countdown > 0}
            style={{
              padding: "10px 24px",
              fontSize: 15,
              background: assessing ? "#94a3b8" : "#dc2626",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: assessing ? "not-allowed" : "pointer",
            }}
          >
            {assessing ? "评测中..." : "开始录音"}
          </button>
        ) : (
          <button
            onClick={stopRecording}
            style={{
              padding: "10px 24px",
              fontSize: 15,
              background: "#16a34a",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              animation: "pulse 1.5s infinite",
            }}
          >
            停止录音
          </button>
        )}
        {recording && (
          <span style={{ color: "#dc2626", fontSize: 14 }}>
            ● 录音中...
          </span>
        )}
        {statusMsg && !recording && (
          <span style={{ fontSize: 13, color: "#6b7280" }}>{statusMsg}</span>
        )}
      </section>

      {/* Audio playback */}
      {audioUrl && (
        <section style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>录音回放:</span>
            <audio controls src={audioUrl} style={{ height: 36 }} />
          </div>
        </section>
      )}

      {/* Results: 3 Tabs */}
      {(results.length > 0 || errors.length > 0) && (
        <section>
          {/* Tab buttons */}
          <div style={{ display: "flex", borderBottom: "2px solid #e5e7eb", marginBottom: 16 }}>
            {(["azure", "iflytek", "tencent"] as ProviderName[]).map((p) => {
              const hasResult = results.some((r) => r.provider === p);
              const hasError = errors.some((e) => e.provider === p);
              return (
                <button
                  key={p}
                  onClick={() => setActiveTab(p)}
                  style={{
                    padding: "10px 20px",
                    fontSize: 14,
                    fontWeight: activeTab === p ? 600 : 400,
                    background: "none",
                    border: "none",
                    borderBottom: activeTab === p ? "2px solid #2563eb" : "2px solid transparent",
                    color: activeTab === p ? "#2563eb" : "#6b7280",
                    cursor: "pointer",
                    marginBottom: -2,
                  }}
                >
                  {PROVIDER_LABELS[p]}
                  {hasResult && " ✓"}
                  {hasError && !hasResult && " ✗"}
                </button>
              );
            })}
          </div>

          {/* Active tab content */}
          {activeResult && <ResultPanel result={activeResult} />}
          {activeError && !activeResult && (
            <div style={{ padding: 16, background: "#fef2f2", borderRadius: 8, color: "#dc2626" }}>
              <strong>{PROVIDER_LABELS[activeError.provider]} 评测失败：</strong>
              <p style={{ marginTop: 4 }}>{activeError.error}</p>
            </div>
          )}
          {!activeResult && !activeError && (
            <p style={{ color: "#9ca3af", padding: 16 }}>该服务商未参与本次评测</p>
          )}
        </section>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

/** Score display component for one provider */
function ResultPanel({ result }: { result: AssessmentResult }) {
  return (
    <div>
      {/* Score overview */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <ScoreCard label="综合评分" score={result.overallScore} primary />
        <ScoreCard label="准确度" score={result.accuracyScore} />
        <ScoreCard label="流利度" score={result.fluencyScore} />
        <ScoreCard label="完整度" score={result.completenessScore} />
      </div>

      {/* Meta */}
      <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>
        评测耗时: {result.durationMs}ms | 服务商: {PROVIDER_LABELS[result.provider]}
      </p>

      {/* Word-level breakdown */}
      {result.words.length > 0 && (
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>单词级评分</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {result.words.map((w, i) => (
              <WordBadge key={i} word={w} />
            ))}
          </div>
        </div>
      )}

      {/* Raw JSON response */}
      {result.raw && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>API 原始响应</h3>
          <pre
            style={{
              padding: 12,
              background: "#1e293b",
              color: "#e2e8f0",
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.5,
              overflow: "auto",
              maxHeight: 400,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {JSON.stringify(result.raw, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function ScoreCard({
  label,
  score,
  primary,
}: {
  label: string;
  score: number;
  primary?: boolean;
}) {
  const color =
    score >= 80 ? "#16a34a" : score >= 60 ? "#ca8a04" : "#dc2626";

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 8,
        background: primary ? "#f0f9ff" : "#f8fafc",
        border: `1px solid ${primary ? "#bae6fd" : "#e2e8f0"}`,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{Math.round(score)}</div>
      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function WordBadge({ word }: { word: WordScore }) {
  const bgColor =
    word.errorType !== "none"
      ? "#fef2f2"
      : word.accuracyScore >= 80
        ? "#f0fdf4"
        : word.accuracyScore >= 60
          ? "#fefce8"
          : "#fef2f2";
  const textColor =
    word.errorType !== "none"
      ? "#dc2626"
      : word.accuracyScore >= 80
        ? "#16a34a"
        : word.accuracyScore >= 60
          ? "#ca8a04"
          : "#dc2626";

  return (
    <span
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 6,
        background: bgColor,
        border: `1px solid ${textColor}22`,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 500 }}>{word.word}</span>
      <span style={{ fontSize: 11, color: textColor, fontWeight: 600 }}>
        {word.errorType !== "none" ? word.errorType : Math.round(word.accuracyScore)}
      </span>
    </span>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
