import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import { TokenService } from "@/domains/auth/token-service";
import { POST } from "@/app/api/v1/auth/logout/route";

describe("POST /api/v1/auth/logout", () => {
  const tokenService = new TokenService();
  let validToken: string;

  beforeAll(async () => {
    validToken = await tokenService.createSession({
      userId: "u-logout-test",
      phone: "13800004444",
      roles: ["teacher"],
      schoolId: "s-001",
      activeRole: "teacher",
    });
  });

  afterAll(async () => {
    await redis.quit();
  });

  it("should invalidate token after logout", async () => {
    const req = new Request("http://localhost:3000/api/v1/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${validToken}` },
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.code).toBe(0);

    // token 已失效
    const session = await tokenService.getSession(validToken);
    expect(session).toBeNull();
  });
});
