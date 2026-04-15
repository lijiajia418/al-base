import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import { TokenService } from "@/domains/auth/token-service";
import { withAuth, type AuthContext } from "@/lib/auth/auth-interceptor";
import { NextRequest } from "next/server";

describe("AuthInterceptor", () => {
  const tokenService = new TokenService();
  let validToken: string;

  beforeAll(async () => {
    validToken = await tokenService.createSession({
      userId: "u-test-001",
      phone: "13800001234",
      roles: ["teacher"],
      schoolId: "s-test-001",
      activeRole: "teacher",
    });
  });

  afterAll(async () => {
    await redis.del(`session:${validToken}`);
    await redis.quit();
  });

  it("should inject auth context for request with valid token", async () => {
    let capturedAuth: AuthContext | null = null;

    // 模拟 handler
    const handler = withAuth(async (req, auth) => {
      capturedAuth = auth;
      return Response.json({ ok: true });
    });

    // 模拟 Request
    const req = new NextRequest("http://localhost:3000/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${validToken}` },
    });

    const res = await handler(req);
    expect(res.status).toBe(200);

    expect(capturedAuth).not.toBeNull();
    expect(capturedAuth!.userId).toBe("u-test-001");
    expect(capturedAuth!.roles).toEqual(["teacher"]);
    expect(capturedAuth!.schoolId).toBe("s-test-001");
    expect(capturedAuth!.activeRole).toBe("teacher");
  });

  it("should return 401 for request without token", async () => {
    const handler = withAuth(async () => {
      return Response.json({ ok: true });
    });

    const req = new NextRequest("http://localhost:3000/api/v1/classes");

    const res = await handler(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.code).toBe(40101);
  });

  it("should return 401 for request with invalid token", async () => {
    const handler = withAuth(async () => {
      return Response.json({ ok: true });
    });

    const req = new NextRequest("http://localhost:3000/api/v1/classes", {
      headers: { Authorization: "Bearer invalid-token-xxx" },
    });

    const res = await handler(req);
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.code).toBe(40102);
  });
});
