import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/auth-interceptor";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { schools } from "@/db/schema/schools";
import { teacherProfiles } from "@/db/schema/teacher-profiles";
import { studentProfiles } from "@/db/schema/student-profiles";
import { parentProfiles } from "@/db/schema/parent-profiles";
import { eq } from "drizzle-orm";
import { success } from "@/lib/api/response";

function maskPhone(phone: string): string {
  if (phone.length !== 11) return phone;
  return phone.slice(0, 3) + "****" + phone.slice(7);
}

export const GET = withAuth(async (req, auth) => {
  // 查询用户信息
  const [user] = await db.select().from(users).where(eq(users.id, auth.userId));
  if (!user) {
    return Response.json({ code: 40401, data: null, message: "用户不存在" }, { status: 404 });
  }

  // 查询学校信息
  const [school] = await db.select({ id: schools.id, name: schools.name }).from(schools).where(eq(schools.id, user.schoolId));

  // 查询当前角色的 profile
  let profile: Record<string, unknown> | null = null;
  if (auth.activeRole === "teacher") {
    const [tp] = await db.select().from(teacherProfiles).where(eq(teacherProfiles.userId, auth.userId));
    if (tp) profile = { title: tp.title, subjects: tp.subjects, employmentStatus: tp.employmentStatus };
  } else if (auth.activeRole === "student") {
    const [sp] = await db.select().from(studentProfiles).where(eq(studentProfiles.userId, auth.userId));
    if (sp) profile = { grade: sp.grade, targetScore: sp.targetScore, examDate: sp.examDate };
  } else if (auth.activeRole === "parent") {
    const [pp] = await db.select().from(parentProfiles).where(eq(parentProfiles.userId, auth.userId));
    if (pp) profile = { relationType: pp.relationType };
  }

  return Response.json(success({
    id: user.id,
    phone: maskPhone(user.phone),
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    roles: user.roles,
    activeRole: auth.activeRole,
    schoolId: user.schoolId,
    schoolName: school?.name || null,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    profile,
  }));
});
