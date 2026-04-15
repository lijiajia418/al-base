import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/auth-interceptor";
import { TeacherService } from "@/domains/teacher/teacher-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const teacherService = new TeacherService();

export const GET = withAuth(async (req, auth) => {
  if (auth.activeRole !== "school_admin") {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "仅管理员可访问"), { status: 403 });
  }

  const id = req.nextUrl.pathname.split("/").pop()!;
  const teacher = await teacherService.getTeacher(id);

  if (!teacher) {
    return Response.json(error(ErrorCode.USER_NOT_FOUND, "老师不存在"), { status: 404 });
  }

  return Response.json(success(teacher));
});

export const PUT = withAuth(async (req, auth) => {
  if (auth.activeRole !== "school_admin") {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "仅管理员可访问"), { status: 403 });
  }

  const id = req.nextUrl.pathname.split("/").pop()!;
  const body = await req.json();

  await teacherService.updateTeacher(id, body);
  return Response.json(success(null));
});
