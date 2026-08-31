import { existsSync } from "node:fs";
import { fixtures } from "../src/domain/fixtures";

const main = async () => {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");

  const { seedDatabase } = await import("../src/data/seed");
  const { prisma } = await import("../src/lib/prisma");

  await seedDatabase();
  await prisma.$disconnect();

  console.log(
    `Seeded fixture pack ${fixtures.schemaVersion} at clock ${fixtures.fixtureClock}: ` +
      `${fixtures.products.length} products, ${fixtures.assets.length} assets, ` +
      `${fixtures.bookingRequests.length} booking requests, ${fixtures.contracts.length} contracts, ` +
      `${fixtures.workOrders.length} work orders.`,
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
