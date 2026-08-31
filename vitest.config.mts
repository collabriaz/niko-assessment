import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: false,
    projects: [
      { test: { name: "unit", include: ["src/domain/**/*.test.ts"] } },
      {
        test: {
          name: "integration",
          include: ["src/data/**/*.test.ts"],
          setupFiles: ["./vitest.setup.integration.ts"],
          // Neon is serverless and the first query pays a cold start.
          testTimeout: 30_000,
        },
      },
    ],
  },
});
