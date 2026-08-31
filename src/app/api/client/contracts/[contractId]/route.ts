import { getContractForOrganisation } from "@/data/contracts";
import { forbidden, notFound } from "@/lib/api-errors";
import { currentUser } from "@/lib/session";

export async function GET(
  request: Request,
  context: RouteContext<"/api/client/contracts/[contractId]">,
) {
  const user = await currentUser(request);

  if (!user || user.role !== "client" || !user.organisationId)
    return forbidden();

  const { contractId } = await context.params;
  const contract = await getContractForOrganisation(
    user.organisationId,
    contractId,
  );

  if (!contract) return notFound("That contract does not exist.");

  return Response.json(contract);
}
