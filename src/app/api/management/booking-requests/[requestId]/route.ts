import { z } from "zod";
import {
  applyManagementDecision,
  getBookingRequestForManagement,
} from "@/data/booking-requests";
import {
  decisionNeedsNote,
  MANAGEMENT_DECISIONS,
} from "@/domain/booking-requests";
import { fixtureClock } from "@/domain/fixtures";
import {
  conflict,
  forbidden,
  notFound,
  serviceUnavailable,
  validationError,
} from "@/lib/api-errors";
import { currentManager } from "@/lib/session";

const MANAGER_ONLY = "Only a manager can use the management surface.";
const UNKNOWN_REQUEST = "That booking request does not exist.";

const decisionSchema = z
  .object({
    action: z.enum(MANAGEMENT_DECISIONS),
    note: z.string().min(3).nullish(),
    selectedAssetId: z.string().min(1).nullish(),
  })
  .refine((body) => !decisionNeedsNote(body.action) || Boolean(body.note), {
    message: "A note is required when asking for information or declining.",
    path: ["note"],
  });

export async function GET(
  request: Request,
  context: RouteContext<"/api/management/booking-requests/[requestId]">,
) {
  const manager = await currentManager(request);

  if (!manager) return forbidden(MANAGER_ONLY);

  const { requestId } = await context.params;
  const detail = await getBookingRequestForManagement(requestId, fixtureClock);

  if (!detail) return notFound(UNKNOWN_REQUEST);

  return Response.json(detail);
}

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/management/booking-requests/[requestId]">,
) {
  const manager = await currentManager(request);

  if (!manager) return forbidden(MANAGER_ONLY);

  const parsed = decisionSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success)
    return validationError(
      "That decision is not valid.",
      z.flattenError(parsed.error),
    );

  const { requestId } = await context.params;

  try {
    const result = await applyManagementDecision({
      requestId,
      action: parsed.data.action,
      note: parsed.data.note ?? null,
      selectedAssetId: parsed.data.selectedAssetId ?? null,
      now: fixtureClock,
    });

    if (result.status === "not_found") return notFound(UNKNOWN_REQUEST);

    if (result.status === "already_decided")
      return conflict(
        "REQUEST_STATE_CONFLICT",
        "This request has already been decided.",
      );

    if (result.status === "asset_mismatch")
      return validationError(
        "That asset does not belong to the requested product.",
      );

    if (result.status === "inventory_conflict")
      return conflict("INVENTORY_CONFLICT", result.reason);

    const detail = await getBookingRequestForManagement(
      requestId,
      fixtureClock,
    );

    if (!detail) return notFound(UNKNOWN_REQUEST);

    return Response.json(detail);
  } catch (error) {
    console.error(error);

    return serviceUnavailable();
  }
}
