import { defineConfig } from "vitest/config";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    // @ts-expect-error -- environmentMatchGlobs works at runtime but vitest 4.x types omit it
    environmentMatchGlobs: [["tests/**/*.test.tsx", "jsdom"]],
    coverage: {
      provider: "v8",
      include: [
        "src/domains/**",
        "src/lib/**",
        "src/app/api/**",
        "src/components/**",
        "src/app/**",
      ],
      reporter: ["text", "json-summary", "json"],
      reportsDirectory: "./coverage",
      reportOnFailure: true,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "next/font/google": path.resolve(
        __dirname,
        "./tests/__mocks__/next-font-google.ts",
      ),
    },
  },
});
