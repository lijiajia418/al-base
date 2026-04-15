import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/auth-interceptor";
import { SchoolService } from "@/domains/school/school-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const schoolService = new SchoolService();

export const GET = withAuth(async (req, auth) => {
  if (auth.activeRole !== "school_admin") {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "仅管理员可访问"), { status: 403 });
  }

  const school = await schoolService.getSchool(auth.schoolId);
  if (!school) {
    return Response.json(error(ErrorCode.USER_NOT_FOUND, "学校不存在"), { status: 404 });
  }

  return Response.json(success(school));
});

export const PUT = withAuth(async (req, auth) => {
  if (auth.activeRole !== "school_admin") {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "仅管理员可访问"), { status: 403 });
  }

  const body = await req.json();
  const updated = await schoolService.updateSchool(auth.schoolId, body);

  return Response.json(success(updated));
});
