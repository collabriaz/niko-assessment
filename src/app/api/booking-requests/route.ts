import { z } from "zod";
import { createBookingRequest } from "@/data/booking-requests";
import { fixtureClock } from "@/domain/fixtures";
import {
  forbidden,
  serviceUnavailable,
  validationError,
} from "@/lib/api-errors";
import { readIdempotencyKey } from "@/lib/idempotency";
import { currentClient } from "@/lib/session";

const requestSchema = z
  .object({
    productId: z.string().min(1),
    requestedAssetId: z.string().nullish(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    budget: z.number().min(0),
    objective: z.string().min(5),
    notes: z.string().nullish(),
  })
  .refine((body) => body.endDate > body.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });

export async function POST(request: Request) {
  const client = await currentClient(request);

  if (!client) return forbidden();

  const key = readIdempotencyKey(request);

  if (!key.success)
    return validationError(
      "An Idempotency-Key header of at least 8 characters is required.",
    );

  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success)
    return validationError(
      "The booking request is not valid.",
      z.flattenError(parsed.error),
    );

  try {
    const result = await createBookingRequest({
      ...parsed.data,
      requestedAssetId: parsed.data.requestedAssetId ?? null,
      notes: parsed.data.notes ?? null,
      userId: client.user.id,
      idempotencyKey: key.data,
      now: fixtureClock,
    });

    if (result.status === "forbidden") return forbidden();

    if (result.status === "unknown_product")
      return validationError("That product does not exist.");

    if (result.status === "asset_mismatch")
      return validationError(
        "That asset does not belong to the requested product.",
      );

    return Response.json(result.request, {
      status: result.status === "created" ? 201 : 200,
    });
  } catch (error) {
    console.error(error);

    return serviceUnavailable();
  }
}
