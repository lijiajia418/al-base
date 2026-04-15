import { withAuth } from "@/lib/auth/auth-interceptor";
import { ParentService } from "@/domains/parent/parent-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const parentService = new ParentService();

export const PUT = withAuth(async (req, auth) => {
  if (!["school_admin", "teacher"].includes(auth.activeRole)) {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "无权访问"), { status: 403 });
  }
  const id = req.nextUrl.pathname.split("/").pop()!;
  const body = await req.json();
  await parentService.updateBinding(id, body.bindingStatus);
  return Response.json(success(null));
});
