import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Excalidraw is an ESM package with CSS — Next.js needs to transpile it
  transpilePackages: [
    "@excalidraw/excalidraw",
    "@excalidraw/mermaid-to-excalidraw",
  ],
  // Keep 'ws' as a native Node.js module — don't let Next.js bundle it
  // (bundling breaks its native addon: bufferUtil.mask)
  serverExternalPackages: ["ws"],
  // CI 构建时忽略 ESLint 错误（已有的存量代码 + any 类型）
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
