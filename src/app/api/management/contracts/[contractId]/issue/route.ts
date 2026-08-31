import { getContractForManagement, issueContract } from "@/data/contracts";
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
const UNKNOWN_CONTRACT = "That contract does not exist.";

export async function POST(
  request: Request,
  context: RouteContext<"/api/management/contracts/[contractId]/issue">,
) {
  const manager = await currentManager(request);

  if (!manager) return forbidden(MANAGER_ONLY);

  const key = readIdempotencyKey(request);

  if (!key.success)
    return validationError(
      "An Idempotency-Key header of at least 8 characters is required.",
    );

  const { contractId } = await context.params;

  try {
    const result = await issueContract({
      contractId,
      idempotencyKey: key.data,
      now: fixtureClock,
    });

    if (result.status === "not_found") return notFound(UNKNOWN_CONTRACT);

    if (result.status === "wrong_state")
      return conflict(
        "CONTRACT_STATE_CONFLICT",
        `This contract is ${result.contractStatus} and can no longer be issued.`,
      );

    const contract = await getContractForManagement(contractId);

    if (!contract) return notFound(UNKNOWN_CONTRACT);

    return Response.json(contract);
  } catch (error) {
    console.error(error);

    return serviceUnavailable();
  }
}
