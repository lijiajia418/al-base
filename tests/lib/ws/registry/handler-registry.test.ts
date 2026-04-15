import { describe, it, expect, vi, beforeEach } from "vitest";
import { HandlerRegistry } from "@/lib/ws/registry/handler-registry";
import type { TypedSocket } from "@/lib/ws/types";
import type { SessionEntry } from "@/lib/ws/session/types";

describe("HandlerRegistry", () => {
  let registry: HandlerRegistry;

  beforeEach(() => {
    registry = new HandlerRegistry();
  });

  describe("on + getHandlers", () => {
    it("returns the registered handler for an event", () => {
      const handler = vi.fn();
      registry.on("session:join", handler);

      const handlers = registry.getHandlers("session:join");
      expect(handlers).toHaveLength(1);
      expect(handlers[0]).toBe(handler);
    });
  });

  describe("multiple handlers for the same event", () => {
    it("returns handlers in registration order", () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      const h3 = vi.fn();

      registry.on("session:join", h1);
      registry.on("session:join", h2);
      registry.on("session:join", h3);

      const handlers = registry.getHandlers("session:join");
      expect(handlers).toHaveLength(3);
      expect(handlers[0]).toBe(h1);
      expect(handlers[1]).toBe(h2);
      expect(handlers[2]).toBe(h3);
    });
  });

  describe("event isolation", () => {
    it("handlers for event A do not appear in event B", () => {
      const joinHandler = vi.fn();
      const directHandler = vi.fn();

      registry.on("session:join", joinHandler);
      registry.on("message:direct", directHandler);

      expect(registry.getHandlers("session:join")).toEqual([joinHandler]);
      expect(registry.getHandlers("message:direct")).toEqual([directHandler]);
    });
  });

  describe("getRegisteredEvents", () => {
    it("returns all registered event names", () => {
      registry.on("session:join", vi.fn());
      registry.on("session:leave", vi.fn());
      registry.on("message:direct", vi.fn());

      const events = registry.getRegisteredEvents();
      expect(events).toContain("session:join");
      expect(events).toContain("session:leave");
      expect(events).toContain("message:direct");
      expect(events).toHaveLength(3);
    });
  });

  describe("unregistered event", () => {
    it("getHandlers returns empty array for unregistered event", () => {
      expect(registry.getHandlers("session:join")).toEqual([]);
    });
  });

  describe("onDisconnect", () => {
    it("registers and retrieves disconnect handlers", () => {
      const handler = vi.fn();
      registry.onDisconnect(handler);

      const handlers = registry.getDisconnectHandlers();
      expect(handlers).toHaveLength(1);
      expect(handlers[0]).toBe(handler);
    });
  });

  describe("multiple disconnect handlers", () => {
    it("returns handlers in registration order", () => {
      const h1 = vi.fn();
      const h2 = vi.fn();

      registry.onDisconnect(h1);
      registry.onDisconnect(h2);

      const handlers = registry.getDisconnectHandlers();
      expect(handlers).toHaveLength(2);
      expect(handlers[0]).toBe(h1);
      expect(handlers[1]).toBe(h2);
    });
  });
});
