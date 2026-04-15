"use client";

import { useEffect, type ReactNode } from "react";
import { useSocketStore } from "@/stores/socket-store";

interface SocketProviderProps {
  children: ReactNode;
  sessionId?: string;
  userId?: string;
  /** Set to false to defer connection (default: true) */
  autoConnect?: boolean;
}

export function SocketProvider({
  children,
  sessionId,
  userId,
  autoConnect = true,
}: SocketProviderProps) {
  const connect = useSocketStore((s) => s.connect);
  const disconnect = useSocketStore((s) => s.disconnect);

  useEffect(() => {
    if (autoConnect) {
      connect(sessionId, userId);
    }

    return () => {
      disconnect();
    };
  }, [sessionId, userId, autoConnect, connect, disconnect]);

  return <>{children}</>;
}

export { useSocketStore } from "@/stores/socket-store";
