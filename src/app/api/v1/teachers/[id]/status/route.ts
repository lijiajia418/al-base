import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/auth-interceptor";
import { TeacherService } from "@/domains/teacher/teacher-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const teacherService = new TeacherService();

export const PUT = withAuth(async (req, auth) => {
  if (auth.activeRole !== "school_admin") {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "仅管理员可访问"), { status: 403 });
  }

  const segments = req.nextUrl.pathname.split("/");
  const id = segments[segments.length - 2]; // /teachers/[id]/status
  const body = await req.json();
  const { action } = body;

  if (!["suspend", "activate", "resign"].includes(action)) {
    return Response.json(error(ErrorCode.INVALID_PARAMS, "无效的操作"), { status: 400 });
  }

  await teacherService.updateTeacherStatus(id, action);
  return Response.json(success(null));
});
