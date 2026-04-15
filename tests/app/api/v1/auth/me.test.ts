import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { schools } from "@/db/schema/schools";
import { eq } from "drizzle-orm";
import { TokenService } from "@/domains/auth/token-service";
import { GET } from "@/app/api/v1/auth/me/route";
import { NextRequest } from "next/server";

describe("GET /api/v1/auth/me", () => {
  const tokenService = new TokenService();
  const testSchoolId = "00000000-0000-0000-0000-000000000088";
  let testUserId: string;
  let validToken: string;

  beforeAll(async () => {
    // 创建测试学校
    await db.insert(schools).values({
      id: testSchoolId,
      name: "Me测试学校",
      code: "ME-TEST",
    }).onConflictDoNothing();

    // 创建测试用户
    const [user] = await db.insert(users).values({
      phone: "13800005555",
      name: "测试老师",
      schoolId: testSchoolId,
      roles: ["teacher"],
      status: "active",
    }).returning();
    testUserId = user.id;

    // 创建 session
    validToken = await tokenService.createSession({
      userId: testUserId,
      phone: "13800005555",
      roles: ["teacher"],
      schoolId: testSchoolId,
      activeRole: "teacher",
    });
  });

  afterAll(async () => {
    await redis.del(`session:${validToken}`);
    await db.delete(users).where(eq(users.id, testUserId));
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await redis.quit();
  });

  it("should return current user info with profile", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${validToken}` },
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.id).toBe(testUserId);
    expect(body.data.name).toBe("测试老师");
    expect(body.data.roles).toEqual(["teacher"]);
    expect(body.data.activeRole).toBe("teacher");
    // 手机号应脱敏
    expect(body.data.phone).toContain("****");
  });
});
