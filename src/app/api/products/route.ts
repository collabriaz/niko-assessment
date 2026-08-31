import { z } from "zod";
import { listProducts } from "@/data/products";
import { fixtureClock } from "@/domain/fixtures";
import { serviceUnavailable, validationError } from "@/lib/api-errors";

const querySchema = z
  .object({
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    mediaType: z.string().optional(),
    locationId: z.string().optional(),
    maxMonthlyBudget: z.coerce.number().min(0).optional(),
  })
  .refine((query) => query.endDate > query.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });

export async function GET(request: Request) {
  const params = Object.fromEntries(
    [...new URL(request.url).searchParams].filter(([, value]) => value !== ""),
  );
  const parsed = querySchema.safeParse(params);

  if (!parsed.success)
    return validationError(
      "The catalogue query is not valid.",
      z.flattenError(parsed.error),
    );

  try {
    const items = await listProducts({ ...parsed.data, now: fixtureClock });

    return Response.json({
      query: {
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        mediaType: parsed.data.mediaType ?? null,
        locationId: parsed.data.locationId ?? null,
        maxMonthlyBudget: parsed.data.maxMonthlyBudget ?? null,
      },
      items,
    });
  } catch (error) {
    console.error(error);

    return serviceUnavailable();
  }
}
