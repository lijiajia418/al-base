import { withAuth } from "@/lib/auth/auth-interceptor";
import { ClassService } from "@/domains/class/class-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const classService = new ClassService();

export const POST = withAuth(async (req, auth) => {
  if (auth.activeRole !== "school_admin") {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "仅管理员可操作"), { status: 403 });
  }
  const segments = req.nextUrl.pathname.split("/");
  const classId = segments[segments.indexOf("classes") + 1];
  const body = await req.json();

  const result = await classService.assignTeacher(classId, body.teacherId, body.teacherRoleId);
  if (!result.success) {
    return Response.json(error(ErrorCode.ALREADY_IN_CLASS, "该老师已在此班级"), { status: 409 });
  }
  return Response.json(success(null));
});
