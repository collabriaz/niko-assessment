import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const resolve = {
  alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
};

export default defineConfig({
  test: {
    passWithNoTests: false,
    projects: [
      {
        resolve,
        test: { name: "unit", include: ["src/domain/**/*.test.ts"] },
      },
      {
        resolve,
        test: {
          name: "integration",
          include: ["src/data/**/*.test.ts", "src/app/**/*.test.ts"],
          setupFiles: ["./vitest.setup.integration.ts"],
          globalSetup: ["./vitest.global-setup.integration.ts"],
          testTimeout: 30_000,
        },
      },
    ],
  },
});
