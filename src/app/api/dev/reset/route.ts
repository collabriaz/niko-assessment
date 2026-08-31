import { seedDatabase } from "@/data/seed";
import { serviceUnavailable } from "@/lib/api-errors";

export async function POST() {
  try {
    await seedDatabase();

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);

    return serviceUnavailable();
  }
}
