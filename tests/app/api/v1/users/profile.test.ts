import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { schools } from "@/db/schema/schools";
import { eq } from "drizzle-orm";
import { TokenService } from "@/domains/auth/token-service";
import { PUT } from "@/app/api/v1/users/profile/route";
import { NextRequest } from "next/server";

describe("PUT /api/v1/users/profile", () => {
  const tokenService = new TokenService();
  const testSchoolId = "00000000-0000-0000-0000-c00000000020";
  let testUserId: string;
  let validToken: string;

  beforeAll(async () => {
    await db.insert(schools).values({ id: testSchoolId, name: "Profile测试校", code: "PRF-TEST" }).onConflictDoNothing();
    const [user] = await db.insert(users).values({
      phone: "13900200001", name: "旧名字", schoolId: testSchoolId, roles: ["teacher"], status: "active",
    }).returning();
    testUserId = user.id;
    validToken = await tokenService.createSession({
      userId: testUserId, phone: "13900200001", roles: ["teacher"], schoolId: testSchoolId, activeRole: "teacher",
    });
  });

  afterAll(async () => {
    await redis.del(`session:${validToken}`);
    await db.delete(users).where(eq(users.id, testUserId));
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await redis.quit();
  });

  it("should update name and return updated data", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/users/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${validToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "新名字" }),
    });

    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.name).toBe("新名字");
  });
});
