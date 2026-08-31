import { getManagementDashboard } from "@/data/dashboard";
import { fixtureClock } from "@/domain/fixtures";
import { forbidden } from "@/lib/api-errors";
import { currentManager } from "@/lib/session";

export async function GET(request: Request) {
  const manager = await currentManager(request);

  if (!manager)
    return forbidden("Only a manager can use the management surface.");

  return Response.json(await getManagementDashboard(fixtureClock));
}
