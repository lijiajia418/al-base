import { describe, it, expect, vi } from "vitest";
import { authMiddleware } from "@/lib/ws/middleware/auth.middleware";

function createMockSocket(auth: Record<string, unknown> = {}) {
  return {
    handshake: { auth },
    data: {} as Record<string, unknown>,
  } as any;
}

describe("authMiddleware", () => {
  it("sets socket.data.userId when userId is provided in handshake auth", () => {
    const socket = createMockSocket({ userId: "user-42" });
    const next = vi.fn();

    authMiddleware(socket, next);

    expect(socket.data.userId).toBe("user-42");
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("does not set socket.data.userId when no userId in handshake auth", () => {
    const socket = createMockSocket({});
    const next = vi.fn();

    authMiddleware(socket, next);

    expect(socket.data.userId).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it("never calls next with an error (MVP stub accepts all connections)", () => {
    const socket = createMockSocket({});
    const next = vi.fn();

    authMiddleware(socket, next);

    // next should be called with no arguments (no error)
    expect(next).toHaveBeenCalledWith();
  });
});
