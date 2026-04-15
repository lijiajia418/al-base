import { describe, it, expect, beforeEach, vi } from "vitest";

// We need to re-import fresh module state for each test
// because context.ts uses module-level variables.

describe("ws context", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("getIO throws before initialization", async () => {
    const { getIO } = await import("@/lib/ws/context");
    expect(() => getIO()).toThrow("Socket.IO server not initialized");
  });

  it("getSessionManager throws before initialization", async () => {
    const { getSessionManager } = await import("@/lib/ws/context");
    expect(() => getSessionManager()).toThrow(
      "SessionManager not initialized",
    );
  });

  it("getIO returns the io instance after setWSContext", async () => {
    const { setWSContext, getIO } = await import("@/lib/ws/context");
    const fakeIO = { fake: "io" } as any;
    const fakeSM = { fake: "sm" } as any;

    setWSContext(fakeIO, fakeSM);
    expect(getIO()).toBe(fakeIO);
  });

  it("getSessionManager returns the session manager after setWSContext", async () => {
    const { setWSContext, getSessionManager } = await import(
      "@/lib/ws/context"
    );
    const fakeIO = { fake: "io" } as any;
    const fakeSM = { fake: "sm" } as any;

    setWSContext(fakeIO, fakeSM);
    expect(getSessionManager()).toBe(fakeSM);
  });
});
