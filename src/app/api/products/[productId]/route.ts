import { z } from "zod";
import { getProduct } from "@/data/products";
import { fixtureClock } from "@/domain/fixtures";

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
    return Response.json(
      {
        code: "VALIDATION_ERROR",
        message: "The requested dates are not valid.",
        details: z.flattenError(parsed.error),
      },
      { status: 422 },
    );

  const product = await getProduct(productId, {
    ...parsed.data,
    now: fixtureClock,
  });

  if (!product)
    return Response.json(
      {
        code: "NOT_FOUND",
        message: "That product does not exist.",
        details: null,
      },
      { status: 404 },
    );

  return Response.json(product);
}
