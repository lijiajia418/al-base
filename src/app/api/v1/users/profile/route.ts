import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/auth-interceptor";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { eq } from "drizzle-orm";
import { success, error, ErrorCode } from "@/lib/api/response";

export const PUT = withAuth(async (req, auth) => {
  const body = await req.json();
  const { name, email } = body;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, auth.userId))
    .returning({ id: users.id, name: users.name, email: users.email });

  if (!updated) {
    return Response.json(error(ErrorCode.USER_NOT_FOUND, "用户不存在"), { status: 404 });
  }

  return Response.json(success(updated));
});
