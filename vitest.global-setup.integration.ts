import { existsSync } from "node:fs";

export default async () => {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");

  const { seedDatabase } = await import("./src/data/seed");
  const { prisma } = await import("./src/lib/prisma");

  await seedDatabase();
  await prisma.$disconnect();
};
