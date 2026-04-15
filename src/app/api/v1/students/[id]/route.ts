import { withAuth } from "@/lib/auth/auth-interceptor";
import { StudentService } from "@/domains/student/student-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const studentService = new StudentService();

export const GET = withAuth(async (req, auth) => {
  if (!["school_admin", "teacher", "student"].includes(auth.activeRole)) {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "无权访问"), { status: 403 });
  }

  const id = req.nextUrl.pathname.split("/").pop()!;

  // student 只能看自己
  if (auth.activeRole === "student" && id !== auth.userId) {
    return Response.json(error(ErrorCode.RESOURCE_NOT_ACCESSIBLE, "只能查看自己的信息"), { status: 403 });
  }

  const student = await studentService.getStudent(id);
  if (!student) {
    return Response.json(error(ErrorCode.USER_NOT_FOUND, "学生不存在"), { status: 404 });
  }

  return Response.json(success(student));
});
