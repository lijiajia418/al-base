import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth/auth-interceptor";
import { ClassService } from "@/domains/class/class-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const classService = new ClassService();

export const GET = withAuth(async (req, auth) => {
  if (!["school_admin", "teacher"].includes(auth.activeRole)) {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "无权访问"), { status: 403 });
  }
  const id = req.nextUrl.pathname.split("/").pop()!;
  const cls = await classService.getClass(id);
  if (!cls) return Response.json(error(ErrorCode.CLASS_NOT_FOUND, "班级不存在"), { status: 404 });
  return Response.json(success(cls));
});

export const PUT = withAuth(async (req, auth) => {
  if (!["school_admin", "teacher"].includes(auth.activeRole)) {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "无权访问"), { status: 403 });
  }
  const id = req.nextUrl.pathname.split("/").pop()!;
  const body = await req.json();
  const updated = await classService.updateClass(id, body);
  return Response.json(success(updated));
});
