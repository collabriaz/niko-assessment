import { existsSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
