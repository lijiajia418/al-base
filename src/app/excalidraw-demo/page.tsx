"use client";

import dynamic from "next/dynamic";
import { useState, useCallback } from "react";
import "@excalidraw/excalidraw/index.css";

// Excalidraw must be loaded client-side only (uses window/canvas)
const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  { ssr: false, loading: () => <div className="p-8 text-gray-400">加载白板组件...</div> },
);

export default function ExcalidrawDemoPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [api, setApi] = useState<any>(null);
  const [mermaidInput, setMermaidInput] = useState(
    `graph TD
    A[用户打开App] --> B{已登录?}
    B -- 是 --> C[进入主页]
    B -- 否 --> D[登录页面]
    D --> E[输入账号密码]
    E --> F{验证通过?}
    F -- 是 --> C
    F -- 否 --> G[显示错误]
    G --> E`,
  );
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const handleMermaidRender = useCallback(async () => {
    if (!api || !mermaidInput.trim()) return;
    setLoading(true);
    setStatus("解析 Mermaid 语法...");

    try {
      const { parseMermaidToExcalidraw } = await import(
        "@excalidraw/mermaid-to-excalidraw"
      );
      const { convertToExcalidrawElements } = await import(
        "@excalidraw/excalidraw"
      );

      const { elements, files } = await parseMermaidToExcalidraw(
        mermaidInput.trim(),
      );

      const excalidrawElements = convertToExcalidrawElements(elements);

      api.updateScene({
        elements: excalidrawElements,
        files,
      });

      // Auto-fit view
      setTimeout(() => api.scrollToContent(), 100);
      setStatus(`渲染成功: ${excalidrawElements.length} 个元素`);
    } catch (err) {
      setStatus(`错误: ${err instanceof Error ? err.message : "解析失败"}`);
    } finally {
      setLoading(false);
    }
  }, [api, mermaidInput]);

  const handleClear = () => {
    api?.resetScene();
    setStatus("画布已清空");
  };

  const handleExport = () => {
    if (!api) return;
    const elements = api.getSceneElements();
    const json = JSON.stringify(elements, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "excalidraw-scene.json";
    a.click();
    URL.revokeObjectURL(url);
    setStatus("场景已导出为 JSON");
  };

  const presets = [
    {
      label: "用户登录流程",
      mermaid: `graph TD
    A[用户打开App] --> B{已登录?}
    B -- 是 --> C[进入主页]
    B -- 否 --> D[登录页面]
    D --> E[输入账号密码]
    E --> F{验证通过?}
    F -- 是 --> C
    F -- 否 --> G[显示错误]
    G --> E`,
    },
    {
      label: "WebSocket 架构",
      mermaid: `graph TB
    Client[浏览器客户端] -->|Socket.IO| Server[自定义服务器 server.ts]
    Server --> NextJS[Next.js App]
    Server --> WS[WebSocket Engine]
    WS --> MW[Middleware Chain]
    MW --> Auth[认证中间件]
    WS --> Registry[HandlerRegistry]
    Registry --> Session[Session Domain]
    Registry --> Messaging[Messaging Domain]
    Registry --> Device[Device Domain]
    WS --> SM[SessionManager]
    WS --> Push[PushService]
    Push --> SocketIO[Socket.IO 实时]
    Push --> APNs[APNs 推送]
    Push --> Store[离线存储]`,
    },
    {
      label: "学习路径",
      mermaid: `graph LR
    A[基础数学] --> B[代数入门]
    A --> C[几何入门]
    B --> D[一元方程]
    B --> E[不等式]
    C --> F[三角形]
    C --> G[圆]
    D --> H[二元方程组]
    E --> H
    F --> I[三角函数]
    G --> I
    H --> J[函数与图像]
    I --> J`,
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 16px",
          borderBottom: "1px solid #e5e7eb",
          background: "#fff",
          flexShrink: 0,
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Excalidraw Demo</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleClear} style={btnStyle}>
            清空画布
          </button>
          <button onClick={handleExport} style={btnStyle}>
            导出 JSON
          </button>
        </div>
      </div>

      {/* Body: left panel + canvas */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Left panel */}
        <div
          style={{
            width: 320,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid #e5e7eb",
            background: "#fff",
          }}
        >
          <div style={{ padding: 12, borderBottom: "1px solid #e5e7eb" }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 6px" }}>
              Mermaid → Excalidraw
            </h2>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 8px" }}>
              输入 Mermaid 语法，自动转为手绘风格图表
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {presets.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setMermaidInput(p.mermaid)}
                  style={{
                    padding: "4px 8px",
                    fontSize: 12,
                    background: "#eff6ff",
                    color: "#1d4ed8",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={mermaidInput}
            onChange={(e) => setMermaidInput(e.target.value)}
            placeholder="输入 Mermaid 语法..."
            style={{
              flex: 1,
              padding: 12,
              fontSize: 13,
              fontFamily: "monospace",
              border: "none",
              outline: "none",
              resize: "none",
            }}
          />

          <div style={{ padding: 12, borderTop: "1px solid #e5e7eb" }}>
            <button
              onClick={handleMermaidRender}
              disabled={loading || !api}
              style={{
                width: "100%",
                padding: "8px 16px",
                fontSize: 14,
                background: loading || !api ? "#93c5fd" : "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: loading || !api ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "渲染中..." : "渲染到画布"}
            </button>
            {status && (
              <p style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>{status}</p>
            )}
          </div>
        </div>

        {/* Right: Excalidraw canvas — needs position:relative + explicit dimensions */}
        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          <Excalidraw
            excalidrawAPI={setApi}
            initialData={{
              appState: {
                viewBackgroundColor: "#ffffff",
                currentItemFontFamily: 1,
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: 13,
  border: "1px solid #d1d5db",
  borderRadius: 4,
  background: "#fff",
  cursor: "pointer",
};
