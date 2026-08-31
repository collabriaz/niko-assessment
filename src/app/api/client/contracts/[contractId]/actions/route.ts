import { z } from "zod";
import { applyClientContractAction } from "@/data/contract-actions";
import { getContractForOrganisation } from "@/data/contracts";
import { CLIENT_ACTIONS } from "@/domain/contracts";
import { fixtureClock } from "@/domain/fixtures";
import {
  conflict,
  forbidden,
  notFound,
  validationError,
} from "@/lib/api-errors";
import { readIdempotencyKey } from "@/lib/idempotency";
import { currentClient } from "@/lib/session";

const actionSchema = z.object({
  action: z.enum(CLIENT_ACTIONS),
  note: z.string().nullish(),
});

export async function POST(
  request: Request,
  context: RouteContext<"/api/client/contracts/[contractId]/actions">,
) {
  const client = await currentClient(request);

  if (!client) return forbidden();

  const key = readIdempotencyKey(request);

  if (!key.success)
    return validationError(
      "An Idempotency-Key header of at least 8 characters is required.",
    );

  const parsed = actionSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success)
    return validationError(
      "That contract action is not valid.",
      z.flattenError(parsed.error),
    );

  const { contractId } = await context.params;
  const result = await applyClientContractAction({
    organisationId: client.organisationId,
    contractId,
    action: parsed.data.action,
    note: parsed.data.note ?? null,
    idempotencyKey: key.data,
    now: fixtureClock,
  });

  if (result.status === "not_found")
    return notFound("That contract does not exist.");

  if (result.status === "wrong_state")
    return conflict(
      "CONTRACT_STATE_CONFLICT",
      `This contract is ${result.contractStatus} and no longer accepts that action.`,
    );

  if (result.status === "inventory_conflict")
    return conflict("INVENTORY_CONFLICT", result.reason);

  const contract = await getContractForOrganisation(
    client.organisationId,
    contractId,
  );

  if (!contract) return notFound("That contract does not exist.");

  return Response.json(contract);
}
