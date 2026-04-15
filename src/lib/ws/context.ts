import type { TypedServer } from "./types";
import type { ISessionManager } from "./session/types";

/**
 * Storage key constants.
 * Using globalThis as the storage backend because Next.js bundles
 * API routes separately — module-level variables are not shared
 * between the custom server (server.ts) and API route bundles.
 *
 * The typed getter functions below remain the public API,
 * providing type safety and clear error messages.
 */
const IO_KEY = "__al_ws_io";
const SM_KEY = "__al_ws_sessionManager";

const store = globalThis as unknown as Record<string, unknown>;

/**
 * Called once in server.ts after createSocketServer().
 * Stores references so that API routes and other server-side code
 * can access io and sessionManager via typed getters.
 */
export function setWSContext(
  io: TypedServer,
  sessionManager: ISessionManager,
): void {
  store[IO_KEY] = io;
  store[SM_KEY] = sessionManager;
}

/**
 * Returns the Socket.IO server instance.
 * Throws if called before server.ts has initialized.
 *
 * @example
 *   import { getIO } from "@/lib/ws";
 *   const io = getIO();
 *   io.to(`session:${sessionId}`).emit("session:joined", { sessionId, connectedAt });
 */
export function getIO(): TypedServer {
  const io = store[IO_KEY] as TypedServer | undefined;
  if (!io) {
    throw new Error(
      "[ws] Socket.IO server not initialized. " +
        "Ensure server.ts has started before calling getIO().",
    );
  }
  return io;
}

/**
 * Returns the session manager instance.
 * Throws if called before server.ts has initialized.
 *
 * @example
 *   import { getSessionManager } from "@/lib/ws";
 *   const online = getSessionManager().list();
 */
export function getSessionManager(): ISessionManager {
  const sm = store[SM_KEY] as ISessionManager | undefined;
  if (!sm) {
    throw new Error(
      "[ws] SessionManager not initialized. " +
        "Ensure server.ts has started before calling getSessionManager().",
    );
  }
  return sm;
}
