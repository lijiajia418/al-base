import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/auth-interceptor";
import { ClassService } from "@/domains/class/class-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const classService = new ClassService();

export const GET = withAuth(async (req, auth) => {
  if (!["school_admin", "teacher"].includes(auth.activeRole)) {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "无权访问"), { status: 403 });
  }

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = parseInt(url.searchParams.get("pageSize") || "20");
  const status = url.searchParams.get("status") || undefined;
  const grade = url.searchParams.get("grade") || undefined;

  const teacherId = auth.activeRole === "teacher" ? auth.userId : undefined;
  const result = await classService.listClasses(auth.schoolId, { grade, status, teacherId, page, pageSize });
  return Response.json(success(result));
});

export const POST = withAuth(async (req, auth) => {
  if (!["school_admin", "teacher"].includes(auth.activeRole)) {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "无权访问"), { status: 403 });
  }

  const body = await req.json();
  const { name, grade, academicYear, stage, primaryTeacherId } = body;

  if (!name) {
    return Response.json(error(ErrorCode.INVALID_PARAMS, "班级名称不能为空"), { status: 400 });
  }

  const cls = await classService.createClass(auth.schoolId, auth.userId, {
    name, grade, academicYear, stage, primaryTeacherId,
  });

  return Response.json(success(cls));
});
