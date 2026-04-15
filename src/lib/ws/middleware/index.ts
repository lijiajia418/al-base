import type { TypedServer, TypedSocket } from "../types";

export type SocketMiddleware = (
  socket: TypedSocket,
  next: (err?: Error) => void,
) => void;

export function applyMiddleware(
  io: TypedServer,
  middlewares: SocketMiddleware[],
): void {
  for (const mw of middlewares) {
    io.use(mw);
  }
}

export { authMiddleware } from "./auth.middleware";
