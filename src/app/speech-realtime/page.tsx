"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { io, type Socket } from "socket.io-client";

type Provider = "azure" | "iflytek" | "tencent";

interface SpeechWordResult {
  word: string;
  accuracyScore: number;
  errorType: string;
}

interface SpeechResult {
  provider: Provider;
  type: "intermediate" | "final";
  overallScore: number;
  accuracyScore: number;
  fluencyScore: number;
  completenessScore: number;
  words: SpeechWordResult[];
  durationMs: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any;
}

const PROVIDER_LABELS: Record<Provider, string> = {
  azure: "Microsoft Azure",
  iflytek: "科大讯飞",
  tencent: "腾讯云",
};

const SAMPLE_SENTENCES = [
  // 1. 最小对立组：ship/sheep, sit/seat — 读错一个音素 API 能否精确扣分
  "The sheep on the ship will sit in the seat.",
  // 2. th 陷阱：three/free, think/sink — 中国学习者高频错误，API 能否区分
  "I think three thousand things are free to think about.",
  // 3. r/l 密集：world, girl, really — 单句内反复出现，测音素级稳定性
  "The girl from around the world really ruled the rural area.",
  // 4. v/w 混淆 + 元音陷阱：very/wary, vest/west — 常见替代错误
  "We were very wary of the vest from the west.",
  // 5. 连读吞音极端：asked him, went to, handed it — 自然语速下辅音几乎消失
  "She asked him what happened and handed it to the next person.",
  // 6. 重音位移改变词性：record/record, present/present — 同一词不同重音
  "I want to record a new record and present the present.",
  // 7. 长难词集中：particularly, entrepreneurship, characteristics — 考验音节识别
  "The characteristics of successful entrepreneurship are particularly interesting.",
  // 8. 弱读密集：a, of, to, the, for, at — 自然语速下几乎全部弱化
  "A couple of us went to the store for a bottle of water at the end of the day.",
  // 9. -ed 三种发音同句：laughed(/t/), smiled(/d/), waited(/ɪd/) — 音素级精准检测
  "She laughed at the joke, smiled at the crowd, and waited for the bus.",
  // 10. 综合压力测试：缩读+连读+弱读+长词+最小对立 全混合
  "I've always thought that the author's daughter brought thorough work to the theater.",
];

export default function SpeechRealtimePage() {
  const [referenceText, setReferenceText] = useState(SAMPLE_SENTENCES[0]);
  const [recording, setRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [connected, setConnected] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Per-provider realtime results (latest) + message history
  const [azureResult, setAzureResult] = useState<SpeechResult | null>(null);
  const [iflytekResult, setIflytekResult] = useState<SpeechResult | null>(null);
  const [tencentResult, setTencentResult] = useState<SpeechResult | null>(null);
  const [azureHistory, setAzureHistory] = useState<SpeechResult[]>([]);
  const [iflytekHistory, setIflytekHistory] = useState<SpeechResult[]>([]);
  const [tencentHistory, setTencentHistory] = useState<SpeechResult[]>([]);

  // Timestamps for response timeline
  const startTimeRef = useRef<number>(0);
  const [providerTimings, setProviderTimings] = useState<Record<Provider, { firstWordMs: number | null; finalMs: number | null }>>({
    azure: { firstWordMs: null, finalMs: null },
    iflytek: { firstWordMs: null, finalMs: null },
    tencent: { firstWordMs: null, finalMs: null },
  });

  const socketRef = useRef<Socket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Connect to our WebSocket server
  useEffect(() => {
    const socket = io({ reconnection: true });

    socket.on("connect", () => {
      setConnected(true);
      // Join session
      socket.emit("session:join", {}, () => {});
    });

    socket.on("disconnect", () => setConnected(false));

    // Receive realtime assessment results — update latest + append to history + record timing
    socket.on("speech:result", (payload: SpeechResult) => {
      const elapsed = startTimeRef.current > 0 ? Date.now() - startTimeRef.current : 0;

      setProviderTimings((prev) => {
        const cur = prev[payload.provider];
        return {
          ...prev,
          [payload.provider]: {
            firstWordMs: cur.firstWordMs ?? (payload.type === "intermediate" ? elapsed : cur.firstWordMs),
            finalMs: payload.type === "final" ? elapsed : cur.finalMs,
          },
        };
      });

      if (payload.provider === "azure") {
        setAzureResult(payload);
        setAzureHistory((prev) => [...prev, payload]);
      } else if (payload.provider === "iflytek") {
        setIflytekResult(payload);
        setIflytekHistory((prev) => [...prev, payload]);
      } else if (payload.provider === "tencent") {
        setTencentResult(payload);
        setTencentHistory((prev) => [...prev, payload]);
      }
    });

    socketRef.current = socket;

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!socketRef.current?.connected) {
      setStatusMsg("WebSocket 未连接");
      return;
    }

    // Reset results, history, and timings
    setAzureResult(null);
    setIflytekResult(null);
    setTencentResult(null);
    setAzureHistory([]);
    setIflytekHistory([]);
    setTencentHistory([]);
    setProviderTimings({
      azure: { firstWordMs: null, finalMs: null },
      iflytek: { firstWordMs: null, finalMs: null },
      tencent: { firstWordMs: null, finalMs: null },
    });
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      // Get mic
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
      });
      streamRef.current = stream;

      // Countdown
      setCountdown(3);
      await sleep(1000);
      setCountdown(2);
      await sleep(1000);
      setCountdown(1);
      await sleep(1000);
      setCountdown(0);

      // Tell server to start streaming assessment
      startTimeRef.current = Date.now();
      socketRef.current.emit("speech:start", {
        referenceText,
        providers: ["azure", "iflytek", "tencent"],
      });

      // Set up AudioContext to get raw PCM data
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);

      // ScriptProcessor to capture PCM chunks
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);
        // Float32 → Int16
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        // Send as base64 via WebSocket
        const bytes = new Uint8Array(int16.buffer);
        const base64 = btoa(String.fromCharCode(...bytes));
        socketRef.current?.emit("speech:audio", { audioBase64: base64 });
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      // Also record for playback (using MediaRecorder)
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioUrl(URL.createObjectURL(blob));
      };
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100);

      setRecording(true);
      setStatusMsg("正在录音并实时评测...");
    } catch (err) {
      setStatusMsg(`麦克风错误: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }, [referenceText, audioUrl]);

  const stopRecording = useCallback(() => {
    // Stop PCM streaming
    processorRef.current?.disconnect();
    audioCtxRef.current?.close();

    // Stop media recorder for playback
    mediaRecorderRef.current?.stop();

    // Stop mic
    streamRef.current?.getTracks().forEach((t) => t.stop());

    // Tell server audio is done
    socketRef.current?.emit("speech:end");

    setRecording(false);
    setStatusMsg("录音结束，等待最终结果...");
  }, []);

  const refWords = referenceText
    .replace(/[.,!?]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
        实时流式口语评测
      </h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
        边说边评测，单词逐个点亮
        <span style={{ marginLeft: 12, color: connected ? "#16a34a" : "#dc2626" }}>
          {connected ? "● 已连接" : "● 未连接"}
        </span>
      </p>

      {/* Reference text */}
      <section style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {SAMPLE_SENTENCES.map((s, i) => (
            <button
              key={i}
              onClick={() => { setReferenceText(s); setAzureResult(null); setIflytekResult(null); setTencentResult(null); setAzureHistory([]); setIflytekHistory([]); setTencentHistory([]); setProviderTimings({ azure: { firstWordMs: null, finalMs: null }, iflytek: { firstWordMs: null, finalMs: null }, tencent: { firstWordMs: null, finalMs: null } }); }}
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
        <div style={{
          padding: 16, background: "#f8fafc", border: "1px solid #e2e8f0",
          borderRadius: 8, fontSize: 18, lineHeight: 1.6, letterSpacing: 0.5,
        }}>
          {referenceText}
        </div>
      </section>

      {/* Controls */}
      <section style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
        {countdown > 0 ? (
          <div style={{
            padding: "10px 24px", fontSize: 20, fontWeight: 700,
            color: "#dc2626", background: "#fef2f2", borderRadius: 8,
            minWidth: 140, textAlign: "center",
          }}>
            {countdown}... 准备朗读
          </div>
        ) : !recording ? (
          <button
            onClick={startRecording}
            disabled={!connected}
            style={{
              padding: "10px 24px", fontSize: 15,
              background: !connected ? "#94a3b8" : "#dc2626",
              color: "#fff", border: "none", borderRadius: 8,
              cursor: !connected ? "not-allowed" : "pointer",
            }}
          >
            开始实时评测
          </button>
        ) : (
          <button
            onClick={stopRecording}
            style={{
              padding: "10px 24px", fontSize: 15,
              background: "#16a34a", color: "#fff", border: "none",
              borderRadius: 8, cursor: "pointer",
            }}
          >
            停止录音
          </button>
        )}
        {recording && <span style={{ color: "#dc2626", fontSize: 14, animation: "pulse 1.5s infinite" }}>● 录音评测中...</span>}
        {!recording && statusMsg && <span style={{ fontSize: 13, color: "#6b7280" }}>{statusMsg}</span>}
      </section>

      {/* Audio playback */}
      {audioUrl && (
        <section style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>录音回放:</span>
            <audio controls src={audioUrl} style={{ height: 36 }} />
          </div>
        </section>
      )}

      {/* Three-column realtime results */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <ProviderPanel
          provider="azure"
          result={azureResult}
          history={azureHistory}
          refWords={refWords}
          recording={recording}
          mode="batch"
        />
        <ProviderPanel
          provider="iflytek"
          result={iflytekResult}
          history={iflytekHistory}
          refWords={refWords}
          recording={recording}
          mode="realtime"
        />
        <ProviderPanel
          provider="tencent"
          result={tencentResult}
          history={tencentHistory}
          refWords={refWords}
          recording={recording}
          mode="realtime"
        />
      </div>

      {/* Response timeline */}
      <ResponseTimeline timings={providerTimings} />

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

function ProviderPanel({
  provider,
  result,
  history,
  refWords,
  recording,
  mode,
}: {
  provider: Provider;
  result: SpeechResult | null;
  history: SpeechResult[];
  refWords: string[];
  recording: boolean;
  mode: "realtime" | "batch";
}) {
  const isFinal = result?.type === "final";

  return (
    <div style={{
      border: "1px solid #e2e8f0",
      borderRadius: 12,
      padding: 16,
      background: isFinal ? "#fafffe" : "#fff",
      borderColor: isFinal ? "#86efac" : "#e2e8f0",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          {PROVIDER_LABELS[provider]}
          <span style={{
            fontSize: 10, padding: "2px 6px", borderRadius: 8, fontWeight: 500,
            background: mode === "realtime" ? "#dbeafe" : "#f1f5f9",
            color: mode === "realtime" ? "#2563eb" : "#6b7280",
          }}>
            {mode === "realtime" ? "实时评测" : "整句评测"}
          </span>
        </h3>
        {result && (
          <span style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 10,
            background: isFinal ? "#dcfce7" : "#fef3c7",
            color: isFinal ? "#16a34a" : "#ca8a04",
          }}>
            {isFinal ? "最终结果" : "评测中..."}
          </span>
        )}
      </div>

      {/* Scores */}
      {result ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
            <MiniScore label="综合" score={result.overallScore} />
            <MiniScore label="准确度" score={result.accuracyScore} />
            <MiniScore label="流利度" score={result.fluencyScore} />
            <MiniScore label="完整度" score={result.completenessScore} />
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>
            耗时 {result.durationMs}ms
          </div>
        </>
      ) : mode === "batch" && (recording || history.length > 0) && !result ? (
        <div style={{
          textAlign: "center", padding: "16px 8px", marginBottom: 12,
          background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0",
        }}>
          <div style={{
            fontSize: 22, fontWeight: 700, color: "#94a3b8", marginBottom: 6,
            animation: "pulse 1.5s infinite",
          }}>
            ···
          </div>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            {recording ? "录音结束后返回评测结果" : "评测中..."}
          </div>
        </div>
      ) : (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12,
        }}>
          <MiniScore label="综合" score={null} />
          <MiniScore label="准确度" score={null} />
          <MiniScore label="流利度" score={null} />
          <MiniScore label="完整度" score={null} />
        </div>
      )}

      {/* Word-by-word progress */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 6,
        animation: mode === "batch" && !result && recording ? "breathe 2s ease-in-out infinite" : undefined,
      }}>
        {refWords.map((word, i) => {
          // Match by index position (not by text) to handle duplicates and punctuation
          const matchedWord = result?.words?.[i];
          const evaluated = !!matchedWord;
          const score = matchedWord?.accuracyScore ?? 0;
          const errorType = matchedWord?.errorType ?? "none";

          let bg = "#f1f5f9";
          let fg = "#94a3b8";

          if (evaluated) {
            if (errorType !== "none") {
              bg = "#fef2f2"; fg = "#dc2626";
            } else if (score >= 80) {
              bg = "#f0fdf4"; fg = "#16a34a";
            } else if (score >= 60) {
              bg = "#fefce8"; fg = "#ca8a04";
            } else {
              bg = "#fef2f2"; fg = "#dc2626";
            }
          }

          const isActive = mode === "realtime" && recording && !evaluated && result &&
            i === (result.words?.length ?? 0);

          return (
            <span
              key={i}
              style={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "4px 8px",
                borderRadius: 6,
                background: bg,
                border: isActive ? "2px solid #3b82f6" : `1px solid ${fg}22`,
                transition: "all 0.3s ease",
                animation: isActive ? "pulse 1s infinite" : undefined,
                minWidth: 40,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: evaluated ? "#1e293b" : "#94a3b8" }}>
                {word}
              </span>
              <span style={{ fontSize: 10, color: fg, fontWeight: 600 }}>
                {evaluated
                  ? errorType !== "none"
                    ? errorType
                    : Math.round(score)
                  : "—"}
              </span>
            </span>
          );
        })}
      </div>

      {/* Raw JSON — Final result */}
      {(() => {
        const finalMsg = history.find((h) => h.type === "final");
        const intermediates = history.filter((h) => h.type === "intermediate");
        return (
          <>
            {finalMsg?.raw && (
              <details style={{ marginTop: 12 }} open>
                <summary style={{ fontSize: 12, color: "#16a34a", cursor: "pointer", fontWeight: 600 }}>
                  最终结果 JSON
                </summary>
                <pre style={jsonPreStyle}>
                  {JSON.stringify(finalMsg.raw, null, 2)}
                </pre>
              </details>
            )}
            {intermediates.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 12, color: "#6b7280", cursor: "pointer" }}>
                  中间消息流 ({intermediates.length} 条)
                </summary>
                <div style={{ maxHeight: 300, overflow: "auto", marginTop: 6 }}>
                  {intermediates.map((msg, idx) => (
                    <details key={idx} style={{ marginBottom: 4 }}>
                      <summary style={{ fontSize: 11, color: "#9ca3af", cursor: "pointer" }}>
                        #{idx + 1} — {msg.durationMs}ms — 综合:{Math.round(msg.overallScore)} 词数:{msg.words.length}
                      </summary>
                      <pre style={{ ...jsonPreStyle, maxHeight: 150 }}>
                        {JSON.stringify(msg.raw, null, 2)}
                      </pre>
                    </details>
                  ))}
                </div>
              </details>
            )}
          </>
        );
      })()}
    </div>
  );
}

const TIMELINE_PROVIDERS: { key: Provider; label: string; mode: "realtime" | "batch" }[] = [
  { key: "azure", label: "Azure", mode: "batch" },
  { key: "iflytek", label: "讯飞", mode: "realtime" },
  { key: "tencent", label: "腾讯", mode: "realtime" },
];

function ResponseTimeline({ timings }: { timings: Record<Provider, { firstWordMs: number | null; finalMs: number | null }> }) {
  const hasAnyData = TIMELINE_PROVIDERS.some((p) => timings[p.key].firstWordMs !== null || timings[p.key].finalMs !== null);
  if (!hasAnyData) return null;

  // Find max time for scaling the bar
  const allTimes = TIMELINE_PROVIDERS.flatMap((p) => [timings[p.key].firstWordMs, timings[p.key].finalMs]).filter((t): t is number => t !== null);
  const maxTime = Math.max(...allTimes, 1);

  return (
    <section style={{ marginTop: 20, padding: 16, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: "#374151" }}>响应时间轴</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {TIMELINE_PROVIDERS.map(({ key, label }) => {
          const t = timings[key];
          return (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 500, width: 40, textAlign: "right", color: "#6b7280" }}>{label}</span>
              <div style={{ flex: 1, height: 20, background: "#e2e8f0", borderRadius: 4, position: "relative", overflow: "hidden" }}>
                {t.finalMs != null ? (
                  <div style={{
                    position: "absolute", left: 0, top: 0, height: "100%",
                    width: `${(t.finalMs / maxTime) * 100}%`,
                    background: t.firstWordMs != null ? "linear-gradient(90deg, #3b82f6, #2563eb)" : "#94a3b8",
                    borderRadius: 4, transition: "width 0.5s ease",
                  }} />
                ) : null}
                {t.firstWordMs != null && (
                  <div style={{
                    position: "absolute", top: -2, height: 24, width: 2, background: "#16a34a",
                    left: `${(t.firstWordMs / maxTime) * 100}%`,
                  }} />
                )}
              </div>
              <span style={{ fontSize: 11, color: "#6b7280", width: 130, textAlign: "left" }}>
                {t.firstWordMs != null ? `首词 ${(t.firstWordMs / 1000).toFixed(1)}s` : ""}
                {t.firstWordMs != null && t.finalMs != null ? " · " : ""}
                {t.finalMs != null ? `最终 ${(t.finalMs / 1000).toFixed(1)}s` : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MiniScore({ label, score }: { label: string; score: number | null }) {
  const display = score !== null ? Math.round(score) : "—";
  const color =
    score === null ? "#94a3b8"
      : score >= 80 ? "#16a34a"
        : score >= 60 ? "#ca8a04"
          : "#dc2626";

  return (
    <div style={{
      textAlign: "center",
      padding: 8,
      background: "#f8fafc",
      borderRadius: 6,
      border: "1px solid #e2e8f0",
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{display}</div>
      <div style={{ fontSize: 10, color: "#6b7280" }}>{label}</div>
    </div>
  );
}

const jsonPreStyle: React.CSSProperties = {
  marginTop: 6,
  padding: 10,
  background: "#1e293b",
  color: "#e2e8f0",
  borderRadius: 6,
  fontSize: 11,
  lineHeight: 1.4,
  overflow: "auto",
  maxHeight: 300,
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
