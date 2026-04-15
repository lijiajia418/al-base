import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/auth-interceptor";
import { TeacherService } from "@/domains/teacher/teacher-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const teacherService = new TeacherService();

export const GET = withAuth(async (req, auth) => {
  if (auth.activeRole !== "school_admin") {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "仅管理员可访问"), { status: 403 });
  }

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
  const status = url.searchParams.get("status") || undefined;
  const keyword = url.searchParams.get("keyword") || undefined;

  const result = await teacherService.listTeachers(auth.schoolId, { status, keyword, page, pageSize });
  return Response.json(success(result));
});

export const POST = withAuth(async (req, auth) => {
  if (auth.activeRole !== "school_admin") {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "仅管理员可访问"), { status: 403 });
  }

  const body = await req.json();
  const { phone, name, title, subjects } = body;

  if (!phone || !/^\d{11}$/.test(phone)) {
    return Response.json(error(ErrorCode.PHONE_FORMAT_ERROR, "手机号格式错误"), { status: 400 });
  }
  if (!name) {
    return Response.json(error(ErrorCode.INVALID_PARAMS, "姓名不能为空"), { status: 400 });
  }

  const result = await teacherService.addTeacher(auth.schoolId, { phone, name, title, subjects });

  if (!result.success) {
    if (result.error === "ALREADY_TEACHER") {
      return Response.json(error(ErrorCode.PHONE_ALREADY_EXISTS, "该用户已是老师"), { status: 409 });
    }
    return Response.json(error(ErrorCode.INTERNAL_ERROR, "添加失败"), { status: 500 });
  }

  return Response.json(success(result));
});
