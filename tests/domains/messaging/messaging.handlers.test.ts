import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerMessagingHandlers } from "@/domains/messaging/messaging.handlers";
import { HandlerRegistry } from "@/lib/ws/registry/handler-registry";
import { SessionManager } from "@/lib/ws/session/session-manager";
import { PushService } from "@/lib/push/push-service";
import { DeviceRegistry } from "@/lib/push/device-registry";
import type { InternalHandlerFn } from "@/lib/ws/registry/types";

function createMockSocket(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? "socket-sender",
    data: {} as Record<string, unknown>,
    emit: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    handshake: { auth: {} },
    ...overrides,
  } as any;
}

function createMockIO() {
  const emitFn = vi.fn();
  return {
    to: vi.fn().mockReturnValue({ emit: emitFn }),
    _emitFn: emitFn,
  } as any;
}

describe("messaging handlers", () => {
  let registry: HandlerRegistry;
  let sessionManager: SessionManager;
  let io: ReturnType<typeof createMockIO>;
  let pushService: PushService;
  let directHandler: InternalHandlerFn;

  beforeEach(() => {
    registry = new HandlerRegistry();
    sessionManager = new SessionManager();
    io = createMockIO();

    pushService = new PushService({
      io,
      sessionManager,
      deviceRegistry: new DeviceRegistry(),
    });

    registerMessagingHandlers(registry, { io, sessionManager, pushService });
    directHandler = registry.getHandlers("message:direct")[0];
  });

  it("registers a handler for message:direct", () => {
    expect(registry.getHandlers("message:direct")).toHaveLength(1);
  });

  describe("normal relay", () => {
    it("relays message to target when both sender and target are in session", async () => {
      sessionManager.add("sender-session", {
        socketId: "socket-sender",
        connectedAt: new Date(),
        metadata: {},
      });
      sessionManager.add("target-session", {
        socketId: "socket-target",
        connectedAt: new Date(),
        metadata: {},
      });

      const socket = createMockSocket({ id: "socket-sender" });

      await directHandler(socket, {
        targetSessionId: "target-session",
        content: "hello",
        type: "text",
      });

      expect(io.to).toHaveBeenCalledWith("session:target-session");
      expect(io._emitFn).toHaveBeenCalledWith("message:receive", {
        fromSessionId: "sender-session",
        content: "hello",
        type: "text",
        metadata: undefined,
      });
    });
  });

  describe("sender not in session", () => {
    it("emits session:error with NOT_IN_SESSION", async () => {
      const socket = createMockSocket({ id: "socket-no-session" });

      await directHandler(socket, {
        targetSessionId: "target-session",
        content: "hello",
        type: "text",
      });

      expect(socket.emit).toHaveBeenCalledWith("session:error", {
        code: "NOT_IN_SESSION",
        message: "You must join a session before sending messages",
      });
      expect(io.to).not.toHaveBeenCalled();
    });
  });

  describe("invalid payload", () => {
    it("emits session:error with INVALID_PAYLOAD when targetSessionId missing", async () => {
      sessionManager.add("sender-session", {
        socketId: "socket-sender",
        connectedAt: new Date(),
        metadata: {},
      });
      const socket = createMockSocket({ id: "socket-sender" });

      await directHandler(socket, {
        targetSessionId: "",
        content: "hello",
        type: "text",
      });

      expect(socket.emit).toHaveBeenCalledWith("session:error", {
        code: "INVALID_PAYLOAD",
        message: "targetSessionId and content are required",
      });
    });

    it("emits session:error with INVALID_PAYLOAD when content missing", async () => {
      sessionManager.add("sender-session", {
        socketId: "socket-sender",
        connectedAt: new Date(),
        metadata: {},
      });
      const socket = createMockSocket({ id: "socket-sender" });

      await directHandler(socket, {
        targetSessionId: "target-session",
        content: "",
        type: "text",
      });

      expect(socket.emit).toHaveBeenCalledWith("session:error", {
        code: "INVALID_PAYLOAD",
        message: "targetSessionId and content are required",
      });
    });
  });

  describe("target offline", () => {
    it("emits TARGET_OFFLINE when target not connected and no push token", async () => {
      sessionManager.add("sender-session", {
        socketId: "socket-sender",
        connectedAt: new Date(),
        metadata: {},
      });
      const socket = createMockSocket({ id: "socket-sender" });

      await directHandler(socket, {
        targetSessionId: "nonexistent",
        content: "hello",
        type: "text",
      });

      expect(socket.emit).toHaveBeenCalledWith("session:error", {
        code: "TARGET_OFFLINE",
        message: "Session nonexistent is offline. Message stored for later delivery.",
      });
    });
  });

  describe("metadata passthrough", () => {
    it("includes metadata in relayed message", async () => {
      sessionManager.add("sender-session", {
        socketId: "socket-sender",
        connectedAt: new Date(),
        metadata: {},
      });
      sessionManager.add("target-session", {
        socketId: "socket-target",
        connectedAt: new Date(),
        metadata: {},
      });
      const socket = createMockSocket({ id: "socket-sender" });

      await directHandler(socket, {
        targetSessionId: "target-session",
        content: "hello",
        type: "text",
        metadata: { custom: "data", nested: { a: 1 } },
      });

      expect(io._emitFn).toHaveBeenCalledWith("message:receive", {
        fromSessionId: "sender-session",
        content: "hello",
        type: "text",
        metadata: { custom: "data", nested: { a: 1 } },
      });
    });
  });
});
