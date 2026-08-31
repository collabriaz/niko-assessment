import { z } from "zod";
import { addToShortlist, listShortlist } from "@/data/shortlist";
import { fixtureClock } from "@/domain/fixtures";
import { forbidden, validationError } from "@/lib/api-errors";
import { currentClient } from "@/lib/session";

const addSchema = z
  .object({
    productId: z.string().min(1),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  })
  .refine((item) => item.endDate > item.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });

export async function GET(request: Request) {
  const client = await currentClient(request);

  if (!client) return forbidden();

  return Response.json({
    items: await listShortlist(client.organisationId, fixtureClock),
  });
}

export async function POST(request: Request) {
  const client = await currentClient(request);

  if (!client) return forbidden();

  const parsed = addSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success)
    return validationError(
      "The shortlist entry is not valid.",
      z.flattenError(parsed.error),
    );

  await addToShortlist(
    client.organisationId,
    parsed.data.productId,
    parsed.data.startDate,
    parsed.data.endDate,
  );

  return Response.json({
    items: await listShortlist(client.organisationId, fixtureClock),
  });
}
