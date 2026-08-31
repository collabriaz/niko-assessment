import { createProof } from "@/data/work-orders";
import { fixtureClock } from "@/domain/fixtures";
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
const MAX_PROOF_BYTES = 2_000_000;
const MINIMUM_NOTE_LENGTH = 3;

export async function POST(
  request: Request,
  context: RouteContext<"/api/mobile/work-orders/[workOrderId]/proof">,
) {
  const fitter = await currentFitter(request);

  if (!fitter) return forbidden(FITTER_ONLY);

  const key = readIdempotencyKey(request);

  if (!key.success)
    return validationError(
      "An Idempotency-Key header of at least 8 characters is required.",
    );

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const completionNote = form?.get("completionNote");

  if (!(file instanceof File) || typeof completionNote !== "string")
    return validationError("A proof file and a completion note are required.");

  if (completionNote.trim().length < MINIMUM_NOTE_LENGTH)
    return validationError("The completion note is too short.");

  if (!file.type.startsWith("image/"))
    return validationError("Proof must be an image.");

  if (file.size > MAX_PROOF_BYTES)
    return validationError("That image is larger than the 2 MB prototype cap.");

  const { workOrderId } = await context.params;

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

    const result = await createProof({
      workOrderId,
      userId: fitter.id,
      fileName: file.name,
      previewUrl: `data:${file.type};base64,${base64}`,
      completionNote: completionNote.trim(),
      idempotencyKey: key.data,
      now: fixtureClock,
    });

    if (result.status === "not_found") return notFound(UNKNOWN_JOB);

    if (result.status === "already_completed")
      return conflict(
        "WORK_ORDER_STATE_CONFLICT",
        "This job is already completed.",
      );

    return Response.json(
      { id: result.proofId, workOrderId, fileName: file.name },
      { status: result.status === "created" ? 201 : 200 },
    );
  } catch (error) {
    console.error(error);

    return serviceUnavailable();
  }
}
