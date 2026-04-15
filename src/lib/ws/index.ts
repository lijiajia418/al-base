// Core factory
export { createSocketServer } from "./server";
export type { CreateSocketServerOptions } from "./server";

// Context (typed singleton — replaces globalThis)
export { setWSContext, getIO, getSessionManager } from "./context";

// Types
export type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  TypedServer,
  TypedSocket,
  SessionJoinPayload,
  SessionJoinedPayload,
  DeviceRegisterPayload,
  DirectMessagePayload,
  MessageReceivedPayload,
  ErrorPayload,
  AckResponse,
  EventParams,
  TypedHandlerFn,
} from "./types";

// Session
export { SessionManager } from "./session/session-manager";
export type { ISessionManager, SessionEntry } from "./session/types";

// Registry
export { HandlerRegistry } from "./registry/handler-registry";
export type {
  IHandlerRegistry,
  CoreDeps,
  HandlerRegistrar,
  InternalHandlerFn,
  DisconnectHandlerFn,
} from "./registry/types";

// Middleware
export { applyMiddleware, authMiddleware } from "./middleware";
export type { SocketMiddleware } from "./middleware";
