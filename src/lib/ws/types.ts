import type { Server, Socket } from "socket.io";

// ============================================================
// Payload Types
// ============================================================

export interface SessionJoinPayload {
  sessionId?: string;
  userId?: string;
}

export interface SessionJoinedPayload {
  sessionId: string;
  connectedAt: string;
}

export interface DeviceRegisterPayload {
  platform: "ios" | "android" | "web";
  pushToken?: string;
}

export interface DirectMessagePayload {
  targetSessionId: string;
  content: string;
  type: "text" | "system";
  metadata?: Record<string, unknown>;
}

export interface MessageReceivedPayload {
  fromSessionId: string;
  content: string;
  type: "text" | "system";
  metadata?: Record<string, unknown>;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

export interface AckResponse {
  ok: boolean;
  sessionId?: string;
  error?: string;
}

// ============================================================
// Socket.IO Typed Event Maps
// ============================================================

export interface ClientToServerEvents {
  "session:join": (
    payload: SessionJoinPayload,
    ack: (res: AckResponse) => void,
  ) => void;
  "session:leave": () => void;
  "device:register": (
    payload: DeviceRegisterPayload,
    ack: (res: AckResponse) => void,
  ) => void;
  "message:direct": (payload: DirectMessagePayload) => void;
  "speech:start": (payload: SpeechStartPayload) => void;
  "speech:audio": (payload: SpeechAudioPayload) => void;
  "speech:end": () => void;
}

export interface SpeechStartPayload {
  referenceText: string;
  providers: ("azure" | "iflytek" | "tencent")[];
}

export interface SpeechAudioPayload {
  /** Base64-encoded PCM chunk (16kHz, 16bit, mono) */
  audioBase64: string;
}

export interface SpeechWordResult {
  word: string;
  accuracyScore: number;
  errorType: string;
}

export interface SpeechIntermediatePayload {
  provider: "azure" | "iflytek" | "tencent";
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

export interface ServerToClientEvents {
  "session:joined": (payload: SessionJoinedPayload) => void;
  "session:error": (payload: ErrorPayload) => void;
  "message:receive": (payload: MessageReceivedPayload) => void;
  "speech:result": (payload: SpeechIntermediatePayload) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  sessionId: string;
  userId?: string;
  joinedAt: Date;
}

// ============================================================
// Typed Server & Socket Aliases
// ============================================================

export type TypedServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// ============================================================
// Handler Type Utilities
// ============================================================

/**
 * Extract the parameter types of a specific client-to-server event.
 *
 * Example:
 *   EventParams<"session:join"> = [SessionJoinPayload, (res: AckResponse) => void]
 *   EventParams<"session:leave"> = []
 *   EventParams<"message:direct"> = [DirectMessagePayload]
 */
export type EventParams<K extends keyof ClientToServerEvents> =
  Parameters<ClientToServerEvents[K]>;

/**
 * A fully-typed handler function for a specific event.
 * The handler receives (socket, ...eventParams) with all types auto-inferred.
 *
 * Example:
 *   TypedHandlerFn<"session:join">
 *     = (socket: TypedSocket, payload: SessionJoinPayload, ack: (res: AckResponse) => void) => ...
 *
 *   TypedHandlerFn<"session:leave">
 *     = (socket: TypedSocket) => ...
 *
 *   TypedHandlerFn<"message:direct">
 *     = (socket: TypedSocket, payload: DirectMessagePayload) => ...
 */
export type TypedHandlerFn<K extends keyof ClientToServerEvents> = (
  socket: TypedSocket,
  ...args: EventParams<K>
) => void | Promise<void>;
