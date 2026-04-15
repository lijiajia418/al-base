import { withAuth } from "@/lib/auth/auth-interceptor";
import { AuthService } from "@/domains/auth/auth-service";
import { success } from "@/lib/api/response";

const authService = new AuthService();

export const POST = withAuth(async (req, auth) => {
  const token = req.headers.get("authorization")!.replace("Bearer ", "");
  await authService.logout(token);
  return Response.json(success(null));
});
