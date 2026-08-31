import { z } from "zod";
import { listBookingRequestsForManagement } from "@/data/booking-requests";
import { forbidden, validationError } from "@/lib/api-errors";
import { currentManager } from "@/lib/session";

const MANAGER_ONLY = "Only a manager can use the management surface.";

const statusSchema = z
  .enum(["submitted", "information_required", "approved", "declined"])
  .nullish();

export async function GET(request: Request) {
  const manager = await currentManager(request);

  if (!manager) return forbidden(MANAGER_ONLY);

  const status = statusSchema.safeParse(
    new URL(request.url).searchParams.get("status"),
  );

  if (!status.success)
    return validationError("That booking-request status does not exist.");

  const items = await listBookingRequestsForManagement(
    status.data ?? undefined,
  );

  return Response.json({ items });
}
