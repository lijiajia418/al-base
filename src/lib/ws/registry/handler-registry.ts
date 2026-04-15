import type {
  IHandlerRegistry,
  InternalHandlerFn,
  DisconnectHandlerFn,
} from "./types";
import type { ClientToServerEvents, TypedHandlerFn } from "../types";

export class HandlerRegistry implements IHandlerRegistry {
  private handlers = new Map<string, InternalHandlerFn[]>();
  private disconnectHandlers: DisconnectHandlerFn[] = [];

  on<K extends keyof ClientToServerEvents>(
    event: K,
    handler: TypedHandlerFn<K>,
  ): void {
    const existing = this.handlers.get(event) ?? [];
    // Safe cast: TypedHandlerFn<K> is a narrower type than InternalHandlerFn.
    // Type safety is enforced here at registration time by the generic constraint.
    existing.push(handler as InternalHandlerFn);
    this.handlers.set(event, existing);
  }

  onDisconnect(handler: DisconnectHandlerFn): void {
    this.disconnectHandlers.push(handler);
  }

  getHandlers(event: string): InternalHandlerFn[] {
    return this.handlers.get(event) ?? [];
  }

  getDisconnectHandlers(): DisconnectHandlerFn[] {
    return this.disconnectHandlers;
  }

  getRegisteredEvents(): string[] {
    return Array.from(this.handlers.keys());
  }
}
