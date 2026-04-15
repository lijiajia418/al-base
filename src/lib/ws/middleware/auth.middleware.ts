import type { TypedSocket } from "../types";

/**
 * Authentication middleware (MVP stub).
 *
 * In production, validate JWT or session token from `socket.handshake.auth`.
 * For MVP, it accepts all connections and optionally extracts userId.
 */
export function authMiddleware(
  socket: TypedSocket,
  next: (err?: Error) => void,
): void {
  const { userId } = socket.handshake.auth as { userId?: string };

  if (userId) {
    socket.data.userId = userId;
  }

  next();
}
