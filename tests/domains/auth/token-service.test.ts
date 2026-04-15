import { describe, it, expect, afterAll } from "vitest";
import { redis } from "@/lib/redis";
import { TokenService } from "@/domains/auth/token-service";

describe("TokenService", () => {
  const tokenService = new TokenService();

  const mockUser = {
    userId: "u-001",
    phone: "13800001234",
    roles: ["teacher"] as string[],
    schoolId: "s-001",
    activeRole: "teacher",
  };

  let createdToken: string;

  afterAll(async () => {
    if (createdToken) {
      await redis.del(`session:${createdToken}`);
    }
    await redis.quit();
  });

  it("should create session and read it back with correct data", async () => {
    // 创建 session
    createdToken = await tokenService.createSession(mockUser);
    expect(createdToken).toBeTruthy();
    expect(typeof createdToken).toBe("string");

    // 读取 session
    const session = await tokenService.getSession(createdToken);
    expect(session).not.toBeNull();
    expect(session!.userId).toBe("u-001");
    expect(session!.phone).toBe("13800001234");
    expect(session!.roles).toEqual(["teacher"]);
    expect(session!.schoolId).toBe("s-001");
    expect(session!.activeRole).toBe("teacher");

    // 删除 session
    await tokenService.deleteSession(createdToken);
    const deleted = await tokenService.getSession(createdToken);
    expect(deleted).toBeNull();
  });
});
