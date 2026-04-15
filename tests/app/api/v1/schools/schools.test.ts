import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { schools } from "@/db/schema/schools";
import { eq } from "drizzle-orm";
import { TokenService } from "@/domains/auth/token-service";
import { GET } from "@/app/api/v1/schools/current/route";
import { NextRequest } from "next/server";

describe("GET /api/v1/schools/current", () => {
  const tokenService = new TokenService();
  const testSchoolId = "00000000-0000-0000-0000-c00000000021";
  let validToken: string;

  beforeAll(async () => {
    await db.insert(schools).values({ id: testSchoolId, name: "School API 测试校", code: "SCH-API-001", settings: { test: true } }).onConflictDoNothing();
    const [admin] = await db.insert(users).values({
      phone: "13900210001", name: "测试管理员", schoolId: testSchoolId, roles: ["school_admin"], status: "active",
    }).returning();
    validToken = await tokenService.createSession({
      userId: admin.id, phone: "13900210001", roles: ["school_admin"], schoolId: testSchoolId, activeRole: "school_admin",
    });
  });

  afterAll(async () => {
    await redis.del(`session:${validToken}`);
    await db.delete(users).where(eq(users.schoolId, testSchoolId));
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await redis.quit();
  });

  it("should return school info for school_admin", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/schools/current", {
      headers: { Authorization: `Bearer ${validToken}` },
    });

    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.code).toBe(0);
    expect(body.data.name).toBe("School API 测试校");
    expect(body.data.settings).toEqual({ test: true });
  });
});
