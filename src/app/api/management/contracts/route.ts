import { z } from "zod";
import {
  createDraftContract,
  getContractForManagement,
} from "@/data/contracts";
import { contractTotal } from "@/domain/contracts";
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

const itemSchema = z.object({
  productId: z.string().min(1),
  assetId: z.string().min(1).nullish(),
  capacityPoolId: z.string().min(1).nullish(),
  quantity: z.int().min(1),
  unitRate: z.number().min(0).nullish(),
  rateUnit: z.string().min(1).nullish(),
  lineTotal: z.number().min(0),
});

const contractSchema = z
  .object({
    organisationId: z.string().min(1),
    bookingRequestId: z.string().min(1),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    items: z.array(itemSchema).min(1),
    total: z.number().min(0),
  })
  .refine((body) => body.endDate > body.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  })
  .refine(
    (body) =>
      body.total === contractTotal(body.items.map((item) => item.lineTotal)),
    {
      message: "total must equal the sum of the line totals",
      path: ["total"],
    },
  );

export async function POST(request: Request) {
  const manager = await currentManager(request);

  if (!manager) return forbidden(MANAGER_ONLY);

  const key = readIdempotencyKey(request);

  if (!key.success)
    return validationError(
      "An Idempotency-Key header of at least 8 characters is required.",
    );

  const parsed = contractSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success)
    return validationError(
      "That contract is not valid.",
      z.flattenError(parsed.error),
    );

  try {
    const result = await createDraftContract({
      organisationId: parsed.data.organisationId,
      bookingRequestId: parsed.data.bookingRequestId,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      items: parsed.data.items.map((item) => ({
        productId: item.productId,
        assetId: item.assetId ?? null,
        capacityPoolId: item.capacityPoolId ?? null,
        quantity: item.quantity,
        unitRate: item.unitRate ?? null,
        rateUnit: item.rateUnit ?? null,
        lineTotal: item.lineTotal,
      })),
      idempotencyKey: key.data,
      now: fixtureClock,
    });

    if (result.status === "unknown_request")
      return validationError("That booking request does not exist.");

    if (result.status === "organisation_mismatch")
      return validationError(
        "That booking request belongs to a different organisation.",
      );

    if (result.status === "not_approved")
      return conflict(
        "REQUEST_STATE_CONFLICT",
        `This request is ${result.requestStatus} and cannot be drafted into a contract.`,
      );

    if (result.status === "already_drafted")
      return conflict(
        "CONTRACT_STATE_CONFLICT",
        "This request already has a contract.",
      );

    if (result.status === "product_mismatch")
      return validationError(
        "Every contract item must use the product that was requested.",
      );

    if (result.status === "asset_mismatch")
      return validationError(
        "That asset does not belong to the requested product.",
      );

    const contract = await getContractForManagement(result.contractId);

    if (!contract) return notFound("That contract does not exist.");

    return Response.json(contract, {
      status: result.status === "created" ? 201 : 200,
    });
  } catch (error) {
    console.error(error);

    return serviceUnavailable();
  }
}
