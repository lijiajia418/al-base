import { withAuth } from "@/lib/auth/auth-interceptor";
import { ClassService } from "@/domains/class/class-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const classService = new ClassService();

export const DELETE = withAuth(async (req, auth) => {
  if (auth.activeRole !== "school_admin") {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "仅管理员可操作"), { status: 403 });
  }
  const segments = req.nextUrl.pathname.split("/");
  const teacherId = segments.pop()!;
  segments.pop(); // "teachers"
  const classId = segments.pop()!;

  await classService.removeTeacher(classId, teacherId);
  return Response.json(success(null));
});
