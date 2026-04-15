import { Server as SocketServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  TypedServer,
  TypedSocket,
} from "./types";
import type { ISessionManager } from "./session/types";
import type { CoreDeps, HandlerRegistrar } from "./registry/types";
import { HandlerRegistry } from "./registry/handler-registry";
import { applyMiddleware, type SocketMiddleware } from "./middleware";

export interface CreateSocketServerOptions<D extends CoreDeps = CoreDeps> {
  httpServer: HTTPServer;
  sessionManager: ISessionManager;
  middlewares?: SocketMiddleware[];
  handlerRegistrars?: HandlerRegistrar<D>[];
  /**
   * Extra dependencies beyond core (io + sessionManager).
   * These are merged into the deps object passed to handler registrars.
   *
   * @example
   *   createSocketServer({
   *     // ...
   *     extraDeps: { db, llmClient },
   *   });
   */
  extraDeps?: Omit<D, keyof CoreDeps>;
  cors?: {
    origin: string | string[];
    credentials?: boolean;
  };
}

export function createSocketServer<D extends CoreDeps = CoreDeps>(
  options: CreateSocketServerOptions<D>,
): TypedServer {
  const {
    httpServer,
    sessionManager,
    middlewares = [],
    handlerRegistrars = [],
    extraDeps,
    cors = { origin: "*" },
  } = options;

  // 1. Create typed Socket.IO server
  const io: TypedServer = new SocketServer<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors,
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  // 2. Apply middleware chain
  applyMiddleware(io, middlewares);

  // 3. Build handler registry via domain registrars
  const registry = new HandlerRegistry();
  const deps = { io, sessionManager, ...extraDeps } as D;

  for (const registrar of handlerRegistrars) {
    registrar(registry, deps);
  }

  // 4. Wire connection handler
  io.on("connection", (socket: TypedSocket) => {
    const registeredEvents = registry.getRegisteredEvents();

    for (const event of registeredEvents) {
      const handlers = registry.getHandlers(event);

      // Type safety is enforced at registry.on() call site.
      // Here we do runtime dispatch — args are passed through directly.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (socket as any).on(event, async (...args: unknown[]) => {
        for (const handler of handlers) {
          try {
            await handler(socket, ...args);
          } catch (err) {
            console.error(`[ws] handler error on "${event}":`, err);
            socket.emit("session:error", {
              code: "HANDLER_ERROR",
              message:
                err instanceof Error ? err.message : "Unknown error",
            });
            break; // Stop executing remaining handlers on error
          }
        }
      });
    }

    // Disconnect: framework cleanup first, then pass entry to business handlers
    socket.on("disconnect", async (reason) => {
      const entry = sessionManager.removeBySocketId(socket.id);
      if (entry) {
        console.log(
          `[ws] session ${entry.sessionId} disconnected: ${reason}`,
        );
      }

      for (const handler of registry.getDisconnectHandlers()) {
        try {
          await handler(socket, reason, entry);
        } catch (err) {
          console.error("[ws] disconnect handler error:", err);
        }
      }
    });
  });

  return io;
}
