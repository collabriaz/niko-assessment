import { z } from "zod";
import { applyStatusUpdate, getWorkOrderForFitter } from "@/data/work-orders";
import { fixtureClock } from "@/domain/fixtures";
import { FITTER_STATUSES } from "@/domain/work-orders";
import {
  conflict,
  forbidden,
  notFound,
  serviceUnavailable,
  validationError,
} from "@/lib/api-errors";
import { readIdempotencyKey } from "@/lib/idempotency";
import { currentFitter } from "@/lib/session";

const FITTER_ONLY = "Only the assigned fitter can use the field app.";
const UNKNOWN_JOB = "That job does not exist.";

const statusSchema = z.object({
  status: z.enum(FITTER_STATUSES),
  note: z.string().nullish(),
});

export async function POST(
  request: Request,
  context: RouteContext<"/api/mobile/work-orders/[workOrderId]/status">,
) {
  const fitter = await currentFitter(request);

  if (!fitter) return forbidden(FITTER_ONLY);

  const key = readIdempotencyKey(request);

  if (!key.success)
    return validationError(
      "An Idempotency-Key header of at least 8 characters is required.",
    );

  const parsed = statusSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success)
    return validationError(
      "That status update is not valid.",
      z.flattenError(parsed.error),
    );

  const { workOrderId } = await context.params;

  try {
    const result = await applyStatusUpdate({
      workOrderId,
      userId: fitter.id,
      status: parsed.data.status,
      note: parsed.data.note ?? null,
      idempotencyKey: key.data,
      now: fixtureClock,
    });

    if (result.status === "not_found") return notFound(UNKNOWN_JOB);

    if (result.status === "wrong_state")
      return conflict(
        "WORK_ORDER_STATE_CONFLICT",
        `This job is ${result.from} and cannot move to ${parsed.data.status}.`,
      );

    if (result.status === "missing")
      return validationError(
        `This update needs ${result.missing.join(" and ")}.`,
      );

    const workOrder = await getWorkOrderForFitter(workOrderId, fitter.id);

    if (!workOrder) return notFound(UNKNOWN_JOB);

    return Response.json(workOrder);
  } catch (error) {
    console.error(error);

    return serviceUnavailable();
  }
}
