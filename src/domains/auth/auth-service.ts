import { db } from "@/db";
import { users } from "@/db/schema/users";
import { eq } from "drizzle-orm";
import { SmsService } from "./sms-service";
import { TokenService } from "./token-service";

interface LoginResult {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    phone: string;
    name: string;
    roles: string[];
    schoolId: string;
    status: string;
  };
  isNewUser?: boolean;
  error?: string;
}

export class AuthService {
  private smsService = new SmsService();
  private tokenService = new TokenService();

  async login(phone: string, code: string, defaultSchoolId?: string): Promise<LoginResult> {
    // 1. 校验验证码
    const verifyResult = await this.smsService.verifyCode(phone, code);
    if (!verifyResult.success) {
      return { success: false, error: verifyResult.error };
    }

    // 2. 查找或创建用户
    let isNewUser = false;
    let user = await db
      .select()
      .from(users)
      .where(eq(users.phone, phone))
      .then((rows) => rows[0] ?? null);

    if (!user) {
      // 新用户：自动注册
      isNewUser = true;
      const [created] = await db
        .insert(users)
        .values({
          phone,
          name: phone, // 临时用手机号作为名字，后续可修改
          schoolId: defaultSchoolId || "00000000-0000-0000-0000-000000000000",
          roles: [],
          status: "active",
        })
        .returning();
      user = created;
    } else {
      // 已有用户：更新登录时间，激活 pending 用户
      const updates: Record<string, unknown> = {
        lastLoginAt: new Date(),
      };
      if (user.status === "pending_activation") {
        updates.status = "active";
      }
      if (user.status === "suspended") {
        return { success: false, error: "ACCOUNT_SUSPENDED" };
      }
      await db.update(users).set(updates).where(eq(users.id, user.id));
    }

    // 3. 创建 session
    const token = await this.tokenService.createSession({
      userId: user.id,
      phone: user.phone,
      roles: user.roles ?? [],
      schoolId: user.schoolId,
      activeRole: (user.roles ?? [])[0] || "",
    });

    return {
      success: true,
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        roles: user.roles ?? [],
        schoolId: user.schoolId,
        status: user.status ?? "active",
      },
      isNewUser,
    };
  }

  async logout(token: string): Promise<void> {
    await this.tokenService.deleteSession(token);
  }

  async switchRole(token: string, role: string): Promise<{ success: boolean; error?: string }> {
    const session = await this.tokenService.getSession(token);
    if (!session) {
      return { success: false, error: "TOKEN_EXPIRED" };
    }

    if (!session.roles.includes(role)) {
      return { success: false, error: "ROLE_NOT_ASSIGNED" };
    }

    await this.tokenService.updateSession(token, { activeRole: role });
    return { success: true };
  }
}
