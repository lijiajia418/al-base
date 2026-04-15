import { withAuth } from "@/lib/auth/auth-interceptor";
import { StudentService } from "@/domains/student/student-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const studentService = new StudentService();

export const PUT = withAuth(async (req, auth) => {
  if (!["school_admin", "teacher"].includes(auth.activeRole)) {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "无权访问"), { status: 403 });
  }
  const segments = req.nextUrl.pathname.split("/");
  const studentId = segments.pop()!;
  segments.pop(); // "students"
  const classId = segments.pop()!;

  const body = await req.json();
  await studentService.updateClassStudent(classId, studentId, body);
  return Response.json(success(null));
});
