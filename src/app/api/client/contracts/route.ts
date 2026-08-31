import { listContractsForOrganisation } from "@/data/contracts";
import { forbidden } from "@/lib/api-errors";
import { currentClient } from "@/lib/session";

export async function GET(request: Request) {
  const client = await currentClient(request);

  if (!client) return forbidden();

  return Response.json({
    items: await listContractsForOrganisation(client.organisationId),
  });
}
