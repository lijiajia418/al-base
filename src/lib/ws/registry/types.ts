import type {
  TypedSocket,
  TypedServer,
  TypedHandlerFn,
  ClientToServerEvents,
} from "../types";
import type { ISessionManager, SessionEntry } from "../session/types";

/**
 * Loosely-typed handler used only for internal storage and framework wiring.
 * Type safety is enforced at registration time (IHandlerRegistry.on),
 * not at dispatch time.
 */
export type InternalHandlerFn = (
  socket: TypedSocket,
  ...args: unknown[]
) => void | Promise<void>;

/**
 * Handler for socket disconnect events.
 *
 * Receives:
 *   - socket: the disconnected socket (socket.data still accessible)
 *   - reason: Socket.IO disconnect reason string
 *   - entry:  the SessionEntry that was just removed from SessionManager,
 *             or undefined if the socket never joined a session.
 *             Provides access to sessionId, userId, connectedAt, metadata.
 */
export type DisconnectHandlerFn = (
  socket: TypedSocket,
  reason: string,
  entry: SessionEntry | undefined,
) => void | Promise<void>;

export interface IHandlerRegistry {
  /**
   * Register a handler for a client-to-server event.
   * Parameter types are auto-inferred from ClientToServerEvents[K].
   */
  on<K extends keyof ClientToServerEvents>(
    event: K,
    handler: TypedHandlerFn<K>,
  ): void;

  /**
   * Register a handler for socket disconnect.
   * Called after the framework cleans up SessionManager.
   *
   * @example
   *   registry.onDisconnect((socket, reason) => {
   *     // Notify peers, persist state, clean up resources...
   *   });
   */
  onDisconnect(handler: DisconnectHandlerFn): void;

  /** @internal Framework use only */
  getHandlers(event: string): InternalHandlerFn[];
  /** @internal Framework use only */
  getDisconnectHandlers(): DisconnectHandlerFn[];
  /** @internal Framework use only */
  getRegisteredEvents(): string[];
}

// ============================================================
// Dependency Injection (Generic Deps Chain)
// ============================================================

/**
 * Core dependencies that the framework always provides.
 * Domain handlers that only need io + sessionManager use this directly.
 */
export interface CoreDeps {
  io: TypedServer;
  sessionManager: ISessionManager;
}

/**
 * A function that registers domain-specific event handlers.
 *
 * Generic over D (deps type) for extensibility:
 *
 *   - Handlers that only need core infra use the default:
 *       const register: HandlerRegistrar = (registry, deps) => { ... }
 *
 *   - Handlers that need extra deps (db, llm, etc.) declare it:
 *       interface AppDeps extends CoreDeps { db: DrizzleDB }
 *       const register: HandlerRegistrar<AppDeps> = (registry, deps) => {
 *         deps.db  // ✅ typed
 *       }
 *
 * Adding a new dependency:
 *   1. Define AppDeps extends CoreDeps in your application code
 *   2. Pass extraDeps in createSocketServer()
 *   3. Handlers that need it declare HandlerRegistrar<AppDeps>
 *   — No changes to lib/ws/ core files.
 */
export type HandlerRegistrar<D extends CoreDeps = CoreDeps> = (
  registry: IHandlerRegistry,
  deps: D,
) => void;
