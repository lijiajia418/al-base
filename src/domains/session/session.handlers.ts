import type { IHandlerRegistry, CoreDeps } from "@/lib/ws/registry/types";
import { randomUUID } from "crypto";

/**
 * Registers session lifecycle handlers (join / leave).
 */
export function registerSessionHandlers(
  registry: IHandlerRegistry,
  deps: CoreDeps,
): void {
  const { sessionManager } = deps;

  // payload: SessionJoinPayload  — auto-inferred from "session:join"
  // ack: (res: AckResponse) => void  — auto-inferred
  registry.on("session:join", (socket, payload, ack) => {
    const sessionId = payload.sessionId || randomUUID();

    // If session already exists with a different socket, remove the old one
    if (sessionManager.has(sessionId)) {
      sessionManager.remove(sessionId);
    }

    // Register in session manager
    sessionManager.add(sessionId, {
      socketId: socket.id,
      userId: payload.userId ?? socket.data.userId,
      connectedAt: new Date(),
      metadata: {},
    });

    // Store session info on socket data
    socket.data.sessionId = sessionId;
    socket.data.joinedAt = new Date();

    // Join Socket.IO room for targeted push
    socket.join(`session:${sessionId}`);

    // Notify client
    socket.emit("session:joined", {
      sessionId,
      connectedAt: new Date().toISOString(),
    });

    // Ack callback
    ack({ ok: true, sessionId });

    console.log(`[ws] session ${sessionId} joined (socket: ${socket.id})`);
  });

  // No parameters — auto-inferred from "session:leave"
  registry.on("session:leave", (socket) => {
    const entry = sessionManager.removeBySocketId(socket.id);
    if (entry) {
      socket.leave(`session:${entry.sessionId}`);
      console.log(`[ws] session ${entry.sessionId} left`);
    }
  });
}
