import { seedDatabase } from "@/data/seed";
import { forbidden, serviceUnavailable } from "@/lib/api-errors";
import { currentManager } from "@/lib/session";

export async function POST(request: Request) {
  const manager = await currentManager(request);

  if (!manager)
    return forbidden("Only a manager can reset the fixture database.");

  try {
    await seedDatabase();

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);

    return serviceUnavailable();
  }
}
