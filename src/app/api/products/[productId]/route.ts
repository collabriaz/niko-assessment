import { z } from "zod";
import { getProduct } from "@/data/products";
import { fixtureClock } from "@/domain/fixtures";
import { notFound, validationError } from "@/lib/api-errors";

const querySchema = z
  .object({ startDate: z.iso.date(), endDate: z.iso.date() })
  .refine((query) => query.endDate > query.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });

export async function GET(
  request: Request,
  context: RouteContext<"/api/products/[productId]">,
) {
  const { productId } = await context.params;
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );

  if (!parsed.success)
    return validationError(
      "The requested dates are not valid.",
      z.flattenError(parsed.error),
    );

  const product = await getProduct(productId, {
    ...parsed.data,
    now: fixtureClock,
  });

  if (!product) return notFound("That product does not exist.");

  return Response.json(product);
}
