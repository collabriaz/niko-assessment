import { getWorkOrderForFitter } from "@/data/work-orders";
import { forbidden, notFound } from "@/lib/api-errors";
import { currentFitter } from "@/lib/session";

const FITTER_ONLY = "Only the assigned fitter can use the field app.";
const UNKNOWN_JOB = "That job does not exist.";

export async function GET(
  request: Request,
  context: RouteContext<"/api/mobile/work-orders/[workOrderId]">,
) {
  const fitter = await currentFitter(request);

  if (!fitter) return forbidden(FITTER_ONLY);

  const { workOrderId } = await context.params;
  const workOrder = await getWorkOrderForFitter(workOrderId, fitter.id);

  if (!workOrder) return notFound(UNKNOWN_JOB);

  return Response.json(workOrder);
}
