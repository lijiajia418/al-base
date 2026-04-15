import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import { TokenService } from "@/domains/auth/token-service";
import { POST } from "@/app/api/v1/auth/switch-role/route";
import { NextRequest } from "next/server";

describe("POST /api/v1/auth/switch-role", () => {
  const tokenService = new TokenService();
  let validToken: string;

  beforeAll(async () => {
    validToken = await tokenService.createSession({
      userId: "u-switch-test",
      phone: "13800006666",
      roles: ["teacher", "parent"],
      schoolId: "s-001",
      activeRole: "teacher",
    });
  });

  afterAll(async () => {
    await redis.del(`session:${validToken}`);
    await redis.quit();
  });

  it("should switch from teacher to parent and update activeRole", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/switch-role", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role: "parent" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.activeRole).toBe("parent");

    // 验证 session 中 activeRole 已更新
    const session = await tokenService.getSession(validToken);
    expect(session!.activeRole).toBe("parent");
  });
});
