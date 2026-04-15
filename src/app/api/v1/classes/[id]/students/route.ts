import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/auth-interceptor";
import { StudentService } from "@/domains/student/student-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const studentService = new StudentService();

export const GET = withAuth(async (req, auth) => {
  if (!["school_admin", "teacher"].includes(auth.activeRole)) {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "无权访问"), { status: 403 });
  }
  const segments = req.nextUrl.pathname.split("/");
  const classId = segments[segments.indexOf("classes") + 1];

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = parseInt(url.searchParams.get("pageSize") || "50");
  const groupName = url.searchParams.get("groupName") || undefined;
  const status = url.searchParams.get("status") || undefined;

  const result = await studentService.listStudents(classId, { groupName, status, page, pageSize });
  return Response.json(success(result));
});

export const POST = withAuth(async (req, auth, context?: { params: Promise<{ classId: string }> }) => {
  if (!["school_admin", "teacher"].includes(auth.activeRole)) {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "无权访问"), { status: 403 });
  }

  let classId: string;
  if (context?.params) {
    const params = await context.params;
    classId = params.classId;
  } else {
    const segments = req.nextUrl.pathname.split("/");
    classId = segments[segments.indexOf("classes") + 1];
  }

  const body = await req.json();
  const { phone, name, grade, targetScore, examDate, groupName } = body;

  if (!phone || !/^\d{11}$/.test(phone)) {
    return Response.json(error(ErrorCode.PHONE_FORMAT_ERROR, "手机号格式错误"), { status: 400 });
  }
  if (!name) {
    return Response.json(error(ErrorCode.INVALID_PARAMS, "姓名不能为空"), { status: 400 });
  }

  const result = await studentService.addStudent(classId, auth.schoolId, { phone, name, grade, targetScore, examDate, groupName });

  if (!result.success) {
    if (result.error === "ALREADY_IN_CLASS") {
      return Response.json(error(ErrorCode.ALREADY_IN_CLASS, "该学生已在此班级"), { status: 409 });
    }
    return Response.json(error(ErrorCode.INTERNAL_ERROR, "添加失败"), { status: 500 });
  }

  return Response.json(success(result));
});
