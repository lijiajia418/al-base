import { generateOpenAPIDoc } from "@/lib/api/openapi";

export function GET() {
  const spec = JSON.stringify(generateOpenAPIDoc());

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>A-Level AI API Docs</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <script id="api-reference" data-url="/api/docs"></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
}
