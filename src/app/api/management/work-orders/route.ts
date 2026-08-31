import { z } from "zod";
import { createWorkOrder, getWorkOrderForManagement } from "@/data/work-orders";
import { fixtureClock } from "@/domain/fixtures";
import {
  conflict,
  forbidden,
  notFound,
  serviceUnavailable,
  validationError,
} from "@/lib/api-errors";
import { readIdempotencyKey } from "@/lib/idempotency";
import { currentManager } from "@/lib/session";

const MANAGER_ONLY = "Only a manager can use the management surface.";

const workOrderSchema = z
  .object({
    campaignId: z.string().min(1),
    contractId: z.string().min(1),
    type: z.enum([
      "survey",
      "production",
      "installation",
      "maintenance",
      "removal",
    ]),
    assignedUserId: z.string().min(1),
    assetId: z.string().min(1),
    scheduledStart: z.iso.datetime(),
    scheduledEnd: z.iso.datetime(),
    locationLabel: z.string().min(1),
    instructions: z.string().min(3),
    internalNotes: z.string().nullish(),
  })
  .refine((body) => body.scheduledEnd > body.scheduledStart, {
    message: "scheduledEnd must be after scheduledStart",
    path: ["scheduledEnd"],
  });

export async function POST(request: Request) {
  const manager = await currentManager(request);

  if (!manager) return forbidden(MANAGER_ONLY);

  const key = readIdempotencyKey(request);

  if (!key.success)
    return validationError(
      "An Idempotency-Key header of at least 8 characters is required.",
    );

  const parsed = workOrderSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success)
    return validationError(
      "That work order is not valid.",
      z.flattenError(parsed.error),
    );

  try {
    const result = await createWorkOrder({
      ...parsed.data,
      internalNotes: parsed.data.internalNotes ?? null,
      idempotencyKey: key.data,
      now: fixtureClock,
    });

    if (result.status === "unknown_campaign")
      return validationError("That campaign does not exist.");

    if (result.status === "contract_mismatch")
      return validationError("That campaign belongs to a different contract.");

    if (result.status === "campaign_not_accepted")
      return conflict(
        "CAMPAIGN_STATE_CONFLICT",
        "This campaign is still waiting for the client to accept the contract.",
      );

    if (result.status === "unknown_asset")
      return validationError("That asset does not exist.");

    if (result.status === "not_a_fitter")
      return validationError("Work orders can only be assigned to a fitter.");

    const workOrder = await getWorkOrderForManagement(result.workOrderId);

    if (!workOrder) return notFound("That work order does not exist.");

    return Response.json(workOrder, {
      status: result.status === "created" ? 201 : 200,
    });
  } catch (error) {
    console.error(error);

    return serviceUnavailable();
  }
}
