import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerSessionHandlers } from "@/domains/session/session.handlers";
import { HandlerRegistry } from "@/lib/ws/registry/handler-registry";
import { SessionManager } from "@/lib/ws/session/session-manager";
import type { CoreDeps } from "@/lib/ws/registry/types";

function createMockSocket(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? "socket-1",
    data: {} as Record<string, unknown>,
    emit: vi.fn(),
    join: vi.fn(),
    leave: vi.fn(),
    handshake: { auth: {} },
    ...overrides,
  } as any;
}

describe("session handlers", () => {
  let registry: HandlerRegistry;
  let sessionManager: SessionManager;
  let deps: CoreDeps;
  let joinHandlers: ReturnType<typeof registry.getHandlers>;
  let leaveHandlers: ReturnType<typeof registry.getHandlers>;

  beforeEach(() => {
    registry = new HandlerRegistry();
    sessionManager = new SessionManager();
    deps = { io: {} as any, sessionManager };

    registerSessionHandlers(registry, deps);

    joinHandlers = registry.getHandlers("session:join");
    leaveHandlers = registry.getHandlers("session:leave");
  });

  describe("session:join", () => {
    it("registers a handler for session:join", () => {
      expect(joinHandlers).toHaveLength(1);
    });

    it("uses provided sessionId", async () => {
      const socket = createMockSocket();
      const ack = vi.fn();

      await joinHandlers[0](socket, { sessionId: "my-session" }, ack);

      expect(ack).toHaveBeenCalledWith({ ok: true, sessionId: "my-session" });
      expect(sessionManager.has("my-session")).toBe(true);
    });

    it("generates UUID when no sessionId provided", async () => {
      const socket = createMockSocket();
      const ack = vi.fn();

      await joinHandlers[0](socket, {}, ack);

      expect(ack).toHaveBeenCalledOnce();
      const response = ack.mock.calls[0][0];
      expect(response.ok).toBe(true);
      expect(response.sessionId).toBeDefined();
      expect(response.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it("replaces existing session on same sessionId", async () => {
      const oldSocket = createMockSocket({ id: "sock-old" });
      const newSocket = createMockSocket({ id: "sock-new" });
      const ack1 = vi.fn();
      const ack2 = vi.fn();

      await joinHandlers[0](oldSocket, { sessionId: "s1" }, ack1);
      await joinHandlers[0](newSocket, { sessionId: "s1" }, ack2);

      const entry = sessionManager.get("s1");
      expect(entry?.socketId).toBe("sock-new");
      expect(sessionManager.size()).toBe(1);
    });

    it("writes sessionId and joinedAt to socket.data", async () => {
      const socket = createMockSocket();
      const ack = vi.fn();

      await joinHandlers[0](socket, { sessionId: "s1" }, ack);

      expect(socket.data.sessionId).toBe("s1");
      expect(socket.data.joinedAt).toBeInstanceOf(Date);
    });

    it("calls socket.join with room name", async () => {
      const socket = createMockSocket();
      const ack = vi.fn();

      await joinHandlers[0](socket, { sessionId: "s1" }, ack);

      expect(socket.join).toHaveBeenCalledWith("session:s1");
    });

    it("emits session:joined event", async () => {
      const socket = createMockSocket();
      const ack = vi.fn();

      await joinHandlers[0](socket, { sessionId: "s1" }, ack);

      expect(socket.emit).toHaveBeenCalledWith(
        "session:joined",
        expect.objectContaining({
          sessionId: "s1",
          connectedAt: expect.any(String),
        }),
      );
    });
  });

  describe("session:leave", () => {
    it("registers a handler for session:leave", () => {
      expect(leaveHandlers).toHaveLength(1);
    });

    it("removes session and calls socket.leave when session exists", async () => {
      const socket = createMockSocket({ id: "sock-1" });
      const ack = vi.fn();

      // First join
      await joinHandlers[0](socket, { sessionId: "s1" }, ack);
      expect(sessionManager.has("s1")).toBe(true);

      // Then leave
      await leaveHandlers[0](socket);

      expect(sessionManager.has("s1")).toBe(false);
      expect(socket.leave).toHaveBeenCalledWith("session:s1");
    });

    it("does not throw when socket has no session", async () => {
      const socket = createMockSocket({ id: "no-session-sock" });

      // Should not throw
      expect(() => leaveHandlers[0](socket)).not.toThrow();
    });
  });
});
