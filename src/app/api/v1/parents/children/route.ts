import { withAuth } from "@/lib/auth/auth-interceptor";
import { ParentService } from "@/domains/parent/parent-service";
import { success, error, ErrorCode } from "@/lib/api/response";

const parentService = new ParentService();

export const GET = withAuth(async (req, auth) => {
  if (auth.activeRole !== "parent") {
    return Response.json(error(ErrorCode.ROLE_NOT_ALLOWED, "仅家长可访问"), { status: 403 });
  }
  const children = await parentService.listChildren(auth.userId);
  return Response.json(success(children));
});
