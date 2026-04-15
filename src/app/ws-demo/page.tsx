"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSocketStore } from "@/stores/socket-store";

export default function WsDemoPage() {
  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold mb-6">WebSocket Demo</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConnectionPanel />
        <MessagingPanel />
      </div>
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ServerPushPanel />
        <OnlineSessionsPanel />
      </div>
    </main>
  );
}

/** Panel 1: Connection status and session management */
function ConnectionPanel() {
  const { connected, sessionId, connect, disconnect } = useSocketStore();
  const [inputUserId, setInputUserId] = useState("");

  const handleConnect = () => {
    connect(undefined, inputUserId || undefined);
  };

  return (
    <section className="bg-white rounded-lg shadow p-5">
      <h2 className="text-lg font-semibold mb-3">1. 连接管理</h2>

      <div className="flex items-center gap-2 mb-4">
        <span
          className={`w-3 h-3 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}
        />
        <span className="text-sm">
          {connected ? "已连接" : "未连接"}
        </span>
      </div>

      {sessionId && (
        <div className="mb-4 p-3 bg-blue-50 rounded text-sm break-all">
          <span className="font-medium">Session ID: </span>
          <code>{sessionId}</code>
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="User ID (可选)"
          value={inputUserId}
          onChange={(e) => setInputUserId(e.target.value)}
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        {!connected ? (
          <button
            onClick={handleConnect}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            连接
          </button>
        ) : (
          <button
            onClick={disconnect}
            className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            断开
          </button>
        )}
      </div>
    </section>
  );
}

/** Panel 2: Direct messaging between sessions */
function MessagingPanel() {
  const { connected, messages, sendDirect, clearMessages } = useSocketStore();
  const [targetId, setTargetId] = useState("");
  const [msgContent, setMsgContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!targetId.trim() || !msgContent.trim()) return;
    sendDirect(targetId.trim(), msgContent.trim());
    setMsgContent("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <section className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">2. 用户间通信</h2>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            清空消息
          </button>
        )}
      </div>

      {/* Message list */}
      <div className="h-48 overflow-y-auto border rounded p-3 mb-3 bg-gray-50 text-sm">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-center mt-16">暂无消息</p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="mb-2">
              <span className="text-blue-600 font-mono text-xs">
                {msg.fromSessionId === "server" ? "[服务端]" : `[${msg.fromSessionId.slice(0, 8)}...]`}
              </span>
              <span className="ml-2">{msg.content}</span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Send form */}
      <div className="space-y-2">
        <input
          type="text"
          placeholder="目标 Session ID"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="消息内容"
            value={msgContent}
            onChange={(e) => setMsgContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 border rounded px-3 py-2 text-sm"
            disabled={!connected}
          />
          <button
            onClick={handleSend}
            disabled={!connected || !targetId.trim() || !msgContent.trim()}
            className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            发送
          </button>
        </div>
      </div>
    </section>
  );
}

/** Panel 3: Server push test via API */
function ServerPushPanel() {
  const { sessionId } = useSocketStore();
  const [pushTarget, setPushTarget] = useState("");
  const [pushContent, setPushContent] = useState("");
  const [pushResult, setPushResult] = useState("");

  // Auto-fill own sessionId as target
  useEffect(() => {
    if (sessionId && !pushTarget) {
      setPushTarget(sessionId);
    }
  }, [sessionId, pushTarget]);

  const handlePush = async () => {
    if (!pushTarget.trim() || !pushContent.trim()) return;
    setPushResult("发送中...");

    try {
      const res = await fetch("/api/ws/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: pushTarget.trim(),
          content: pushContent.trim(),
        }),
      });
      const data = await res.json();
      setPushResult(
        res.ok
          ? `推送成功: ${JSON.stringify(data)}`
          : `推送失败: ${data.error}`,
      );
    } catch (err) {
      setPushResult(`请求失败: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  };

  return (
    <section className="bg-white rounded-lg shadow p-5">
      <h2 className="text-lg font-semibold mb-3">3. 后端推送测试</h2>
      <p className="text-xs text-gray-500 mb-3">
        通过 POST /api/ws/push 模拟后端主动向指定 session 推送消息
      </p>

      <div className="space-y-2">
        <input
          type="text"
          placeholder="目标 Session ID"
          value={pushTarget}
          onChange={(e) => setPushTarget(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="推送内容"
            value={pushContent}
            onChange={(e) => setPushContent(e.target.value)}
            className="flex-1 border rounded px-3 py-2 text-sm"
          />
          <button
            onClick={handlePush}
            disabled={!pushTarget.trim() || !pushContent.trim()}
            className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-50"
          >
            推送
          </button>
        </div>
        {pushResult && (
          <div className="text-xs p-2 bg-gray-100 rounded break-all">
            {pushResult}
          </div>
        )}
      </div>
    </section>
  );
}

/** Panel 4: Online sessions list (polling) */
function OnlineSessionsPanel() {
  const [sessions, setSessions] = useState<
    Array<{ sessionId: string; userId?: string; connectedAt: string }>
  >([]);
  const [online, setOnline] = useState(0);
  const [error, setError] = useState("");

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/ws/status");
      const data = await res.json();
      setSessions(data.sessions || []);
      setOnline(data.online || 0);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    }
  }, []);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 3000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  return (
    <section className="bg-white rounded-lg shadow p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">4. 在线 Session</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">在线: {online}</span>
          <button
            onClick={fetchSessions}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            刷新
          </button>
        </div>
      </div>

      {error && (
        <div className="text-xs text-red-500 mb-2">{error}</div>
      )}

      <div className="h-48 overflow-y-auto border rounded bg-gray-50 text-sm">
        {sessions.length === 0 ? (
          <p className="text-gray-400 text-center mt-16">无在线 session</p>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="text-left px-3 py-1.5 text-xs font-medium text-gray-600">
                  Session ID
                </th>
                <th className="text-left px-3 py-1.5 text-xs font-medium text-gray-600">
                  User
                </th>
                <th className="text-left px-3 py-1.5 text-xs font-medium text-gray-600">
                  连接时间
                </th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.sessionId} className="border-t">
                  <td className="px-3 py-1.5 font-mono text-xs break-all">
                    {s.sessionId.slice(0, 8)}...
                  </td>
                  <td className="px-3 py-1.5 text-xs">
                    {s.userId || "-"}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-gray-500">
                    {new Date(s.connectedAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
