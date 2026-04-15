import type { IHandlerRegistry, CoreDeps } from "@/lib/ws/registry/types";
import { StreamingSpeechSession } from "./streaming-session";

/** Active streaming sessions, keyed by socket.id */
const activeSessions = new Map<string, StreamingSpeechSession>();

export function registerSpeechHandlers(
  registry: IHandlerRegistry,
  deps: CoreDeps,
): void {
  // speech:start — client begins a new streaming assessment
  registry.on("speech:start", async (socket, payload) => {
    // Clean up any existing session for this socket
    const existing = activeSessions.get(socket.id);
    if (existing) {
      existing.destroy();
      activeSessions.delete(socket.id);
    }

    try {
      const session = new StreamingSpeechSession(
        socket,
        payload.referenceText,
        payload.providers,
      );

      await session.connect();
      activeSessions.set(socket.id, session);

      console.log(
        `[speech] streaming session started for socket ${socket.id}, providers: ${payload.providers.join(",")}`,
      );
    } catch (err) {
      socket.emit("session:error", {
        code: "SPEECH_CONNECT_FAILED",
        message: err instanceof Error ? err.message : "Failed to connect to providers",
      });
    }
  });

  // speech:audio — client sends an audio chunk
  registry.on("speech:audio", (socket, payload) => {
    const session = activeSessions.get(socket.id);
    if (session) {
      session.sendAudio(payload.audioBase64);
    }
  });

  // speech:end — client signals end of audio
  registry.on("speech:end", (socket) => {
    const session = activeSessions.get(socket.id);
    if (session) {
      session.endAudio();

      // Clean up after a delay to allow final results to arrive
      setTimeout(() => {
        session.destroy();
        activeSessions.delete(socket.id);
        console.log(`[speech] streaming session ended for socket ${socket.id}`);
      }, 10000);
    }
  });

  // Clean up on disconnect
  registry.onDisconnect((socket) => {
    const session = activeSessions.get(socket.id);
    if (session) {
      session.destroy();
      activeSessions.delete(socket.id);
    }
  });
}
