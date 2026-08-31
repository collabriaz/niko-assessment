import { getClientSummary } from "@/data/client-summary";
import { forbidden, notFound } from "@/lib/api-errors";
import { currentClient } from "@/lib/session";

export async function GET(request: Request) {
  const client = await currentClient(request);

  if (!client) return forbidden();

  const summary = await getClientSummary(client.organisationId);

  if (!summary) return notFound("That organisation does not exist.");

  return Response.json(summary);
}
