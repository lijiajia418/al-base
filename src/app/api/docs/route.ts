import { generateOpenAPIDoc } from "@/lib/api/openapi";

export function GET() {
  return Response.json(generateOpenAPIDoc());
}
