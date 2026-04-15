import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/auth-interceptor";
import { SchoolService } from "@/domains/school/school-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const schoolService = new SchoolService();

export const GET = withAuth(async (req, auth) => {
  if (auth.activeRole !== "school_admin") {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "仅管理员可访问"), { status: 403 });
  }

  const stats = await schoolService.getStats(auth.schoolId);
  return Response.json(success(stats));
});
