import { getContractForOrganisation } from "@/data/contracts";
import { forbidden, notFound } from "@/lib/api-errors";
import { currentClient } from "@/lib/session";

export async function GET(
  request: Request,
  context: RouteContext<"/api/client/contracts/[contractId]">,
) {
  const client = await currentClient(request);

  if (!client) return forbidden();

  const { contractId } = await context.params;
  const contract = await getContractForOrganisation(
    client.organisationId,
    contractId,
  );

  if (!contract) return notFound("That contract does not exist.");

  return Response.json(contract);
}
