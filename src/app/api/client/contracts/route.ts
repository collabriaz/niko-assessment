import { listContractsForOrganisation } from "@/data/contracts";
import { forbidden } from "@/lib/api-errors";
import { currentUser } from "@/lib/session";

export async function GET(request: Request) {
  const user = await currentUser(request);

  if (!user || user.role !== "client" || !user.organisationId)
    return forbidden();

  return Response.json({
    items: await listContractsForOrganisation(user.organisationId),
  });
}
