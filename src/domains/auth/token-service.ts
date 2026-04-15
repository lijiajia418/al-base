import { randomUUID } from "crypto";
import { redis } from "@/lib/redis";

const SESSION_TTL = 604800;          // 7 天
const SESSION_REFRESH_THRESHOLD = 86400; // 剩余不到 1 天时续期

export interface SessionData {
  userId: string;
  phone: string;
  roles: string[];
  schoolId: string;
  activeRole: string;
  createdAt: string;
  lastActiveAt: string;
}

export class TokenService {
  async createSession(params: {
    userId: string;
    phone: string;
    roles: string[];
    schoolId: string;
    activeRole: string;
  }): Promise<string> {
    const token = randomUUID();
    const now = new Date().toISOString();

    const session: SessionData = {
      ...params,
      createdAt: now,
      lastActiveAt: now,
    };

    await redis.set(
      `session:${token}`,
      JSON.stringify(session),
      "EX",
      SESSION_TTL
    );

    return token;
  }

  async getSession(token: string): Promise<SessionData | null> {
    const data = await redis.get(`session:${token}`);
    if (!data) return null;

    let session: SessionData;
    try {
      session = JSON.parse(data);
    } catch {
      await redis.del(`session:${token}`);
      return null;
    }

    // 更新 lastActiveAt
    session.lastActiveAt = new Date().toISOString();
    await redis.set(`session:${token}`, JSON.stringify(session), "KEEPTTL");

    // 自动续期：剩余 TTL < 1 天时续到 7 天
    const ttl = await redis.ttl(`session:${token}`);
    if (ttl > 0 && ttl < SESSION_REFRESH_THRESHOLD) {
      await redis.expire(`session:${token}`, SESSION_TTL);
    }

    return session;
  }

  async deleteSession(token: string): Promise<void> {
    await redis.del(`session:${token}`);
  }

  async updateSession(
    token: string,
    updates: Partial<Pick<SessionData, "activeRole" | "roles">>
  ): Promise<SessionData | null> {
    const session = await this.getSession(token);
    if (!session) return null;

    const updated = { ...session, ...updates };
    await redis.set(`session:${token}`, JSON.stringify(updated), "KEEPTTL");

    return updated;
  }
}
