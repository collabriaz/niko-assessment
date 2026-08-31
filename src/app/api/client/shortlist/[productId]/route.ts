import { removeFromShortlist } from "@/data/shortlist";
import { forbidden, notFound } from "@/lib/api-errors";
import { currentClient } from "@/lib/session";

export async function DELETE(
  request: Request,
  context: RouteContext<"/api/client/shortlist/[productId]">,
) {
  const client = await currentClient(request);

  if (!client) return forbidden();

  const { productId } = await context.params;
  const removed = await removeFromShortlist(client.organisationId, productId);

  if (!removed) return notFound("That product is not on your shortlist.");

  return new Response(null, { status: 204 });
}
