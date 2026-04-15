import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { schools } from "@/db/schema/schools";
import { eq } from "drizzle-orm";

import { POST as sendCode } from "@/app/api/v1/auth/sms-code/route";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { GET as getMe } from "@/app/api/v1/auth/me/route";
import { POST as switchRole } from "@/app/api/v1/auth/switch-role/route";
import { POST as logout } from "@/app/api/v1/auth/logout/route";
import { NextRequest } from "next/server";

/**
 * E2E 认证闭环测试：
 * 发送验证码 → 登录 → 获取用户信息 → 切换角色 → 登出 → 登出后访问被拒
 */
describe("E2E: Auth Flow", () => {
  const testSchoolId = "00000000-0000-0000-0000-e2e000000001";
  const testPhone = "13800880001";
  let token: string;

  beforeAll(async () => {
    await db.insert(schools).values({
      id: testSchoolId, name: "E2E测试校", code: "E2E-AUTH-001",
    }).onConflictDoNothing();

    // 预创建一个多角色用户
    await db.insert(users).values({
      phone: testPhone, name: "E2E用户", schoolId: testSchoolId,
      roles: ["teacher", "parent"], status: "active",
    }).onConflictDoNothing();
  });

  afterAll(async () => {
    if (token) await redis.del(`session:${token}`);
    await redis.del(`sms:code:${testPhone}`);
    await redis.del(`sms:cooldown:${testPhone}`);
    await redis.del(`sms:limit:${testPhone}`);
    await db.delete(users).where(eq(users.schoolId, testSchoolId));
    await db.delete(schools).where(eq(schools.id, testSchoolId));
    await redis.quit();
  });

  it("should complete full auth lifecycle: send code → login → me → switch role → logout", async () => {
    // 1. 发送验证码
    const codeRes = await sendCode(new Request("http://localhost/api/v1/auth/sms-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: testPhone }),
    }));
    expect(codeRes.status).toBe(200);

    // 2. 获取实际验证码
    const stored = await redis.get(`sms:code:${testPhone}`);
    const { code } = JSON.parse(stored!);

    // 3. 登录
    const loginRes = await login(new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: testPhone, code }),
    }));
    const loginBody = await loginRes.json();
    expect(loginRes.status).toBe(200);
    expect(loginBody.data.token).toBeTruthy();
    expect(loginBody.data.isNewUser).toBe(false);
    token = loginBody.data.token;

    // 4. 获取用户信息
    const meRes = await getMe(new NextRequest("http://localhost/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    }));
    const meBody = await meRes.json();
    expect(meRes.status).toBe(200);
    expect(meBody.data.roles).toEqual(["teacher", "parent"]);
    expect(meBody.data.activeRole).toBe("teacher");

    // 5. 切换到 parent 角色
    const switchRes = await switchRole(new NextRequest("http://localhost/api/v1/auth/switch-role", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "parent" }),
    }));
    const switchBody = await switchRes.json();
    expect(switchRes.status).toBe(200);
    expect(switchBody.data.activeRole).toBe("parent");

    // 6. 登出
    const logoutRes = await logout(new NextRequest("http://localhost/api/v1/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }));
    expect(logoutRes.status).toBe(200);

    // 7. 登出后访问被拒
    const afterLogoutRes = await getMe(new NextRequest("http://localhost/api/v1/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    }));
    expect(afterLogoutRes.status).toBe(401);
  });
});
