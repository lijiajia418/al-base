import { withAuth } from "@/lib/auth/auth-interceptor";
import { ParentService } from "@/domains/parent/parent-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const parentService = new ParentService();

export const POST = withAuth(async (req, auth, context?: { params: Promise<{ studentId: string }> }) => {
  if (!["school_admin", "teacher"].includes(auth.activeRole)) {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "无权访问"), { status: 403 });
  }

  let studentId: string;
  if (context?.params) {
    studentId = (await context.params).studentId;
  } else {
    const segments = req.nextUrl.pathname.split("/");
    studentId = segments[segments.indexOf("students") + 1];
  }

  const body = await req.json();
  const { phone, name, relationType } = body;

  if (!phone || !/^\d{11}$/.test(phone)) {
    return Response.json(error(ErrorCode.PHONE_FORMAT_ERROR, "手机号格式错误"), { status: 400 });
  }
  if (!relationType) {
    return Response.json(error(ErrorCode.INVALID_PARAMS, "关系类型不能为空"), { status: 400 });
  }

  const result = await parentService.addParent(studentId, auth.schoolId, { phone, name, relationType });

  if (!result.success) {
    const errMap: Record<string, { code: number; status: number; msg: string }> = {
      SAME_PHONE: { code: ErrorCode.PHONE_FORMAT_ERROR, status: 400, msg: "家长手机号不能与学生相同" },
      ALREADY_BOUND: { code: ErrorCode.ALREADY_BOUND, status: 409, msg: "该家长已绑定此学生" },
      STUDENT_NOT_FOUND: { code: ErrorCode.USER_NOT_FOUND, status: 404, msg: "学生不存在" },
    };
    const e = errMap[result.error!] || { code: ErrorCode.INTERNAL_ERROR, status: 500, msg: "添加失败" };
    return Response.json(error(e.code, e.msg), { status: e.status });
  }

  return Response.json(success(result));
});

export const GET = withAuth(async (req, auth) => {
  if (!["school_admin", "teacher"].includes(auth.activeRole)) {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "无权访问"), { status: 403 });
  }
  const segments = req.nextUrl.pathname.split("/");
  const studentId = segments[segments.indexOf("students") + 1];

  const parents = await parentService.listParents(studentId);
  return Response.json(success(parents));
});
