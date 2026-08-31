import { listWorkOrdersForFitter } from "@/data/work-orders";
import { forbidden } from "@/lib/api-errors";
import { currentFitter } from "@/lib/session";

const FITTER_ONLY = "Only the assigned fitter can use the field app.";

export async function GET(request: Request) {
  const fitter = await currentFitter(request);

  if (!fitter) return forbidden(FITTER_ONLY);

  const status = new URL(request.url).searchParams.get("status");
  const items = await listWorkOrdersForFitter(fitter.id, status ?? undefined);

  return Response.json({ items });
}
