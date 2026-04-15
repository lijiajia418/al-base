import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  MessageReceivedPayload,
} from "@/lib/ws/types";

type TypedClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface SocketState {
  socket: TypedClientSocket | null;
  sessionId: string | null;
  connected: boolean;
  messages: MessageReceivedPayload[];

  connect: (sessionId?: string, userId?: string) => void;
  disconnect: () => void;
  sendDirect: (
    targetSessionId: string,
    content: string,
    type?: "text" | "system",
  ) => void;
  clearMessages: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  sessionId: null,
  connected: false,
  messages: [],

  connect: (sessionId?: string, userId?: string) => {
    // Always clean up existing socket first to prevent orphaned instances.
    // This covers: reconnecting sockets, Strict Mode double-mount,
    // and rapid navigation between pages.
    const existing = get().socket;
    if (existing) {
      existing.removeAllListeners();
      existing.disconnect();
    }

    const socket: TypedClientSocket = io({
      auth: { userId },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on("connect", () => {
      set({ connected: true });

      // Join session after connection (or reconnection)
      socket.emit("session:join", { sessionId, userId }, (res) => {
        if (res.ok && res.sessionId) {
          set({ sessionId: res.sessionId });
        }
      });
    });

    socket.on("disconnect", () => {
      set({ connected: false });
    });

    socket.on("message:receive", (payload) => {
      set((state) => ({
        messages: [...state.messages, payload],
      }));
    });

    socket.on("session:error", (error) => {
      console.error("[ws] server error:", error);
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
      set({ socket: null, sessionId: null, connected: false });
    }
  },

  sendDirect: (
    targetSessionId: string,
    content: string,
    type: "text" | "system" = "text",
  ) => {
    const { socket } = get();
    if (!socket?.connected) {
      console.warn("[ws] cannot send: not connected");
      return;
    }
    socket.emit("message:direct", { targetSessionId, content, type });
  },

  clearMessages: () => {
    set({ messages: [] });
  },
}));
