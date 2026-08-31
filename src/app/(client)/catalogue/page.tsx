import Link from "next/link";
import { z } from "zod";
import { AvailabilityBadge } from "@/components/availability-badge";
import { CatalogueFilters } from "@/components/catalogue-filters";
import { RetryButton } from "@/components/retry-button";
import { listCatalogueFilters, listProducts } from "@/data/products";
import { defaultDateRange } from "@/domain/catalogue";
import { fixtureClock } from "@/domain/fixtures";
import { humanise } from "@/lib/format";

const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const querySchema = z
  .object({
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    mediaType: z.string().nullable(),
    locationId: z.string().nullable(),
    maxMonthlyBudget: z.union([z.literal(""), z.coerce.number().min(0)]),
  })
  .refine((query) => query.endDate > query.startDate, {
    message: "The end date must be after the start date.",
    path: ["endDate"],
  });

export default async function CataloguePage({
  searchParams,
}: PageProps<"/catalogue">) {
  const params = await searchParams;
  const defaults = defaultDateRange(fixtureClock);
  const values = {
    startDate: single(params.startDate) || defaults.startDate,
    endDate: single(params.endDate) || defaults.endDate,
    mediaType: single(params.mediaType) || null,
    locationId: single(params.locationId) || null,
    maxMonthlyBudget: single(params.maxMonthlyBudget) || "",
  };

  const options = await listCatalogueFilters();
  const parsed = querySchema.safeParse(values);

  const results = parsed.success
    ? await listProducts({
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        mediaType: parsed.data.mediaType ?? undefined,
        locationId: parsed.data.locationId ?? undefined,
        maxMonthlyBudget:
          parsed.data.maxMonthlyBudget === ""
            ? undefined
            : parsed.data.maxMonthlyBudget,
        now: fixtureClock,
      }).then(
        (items) => ({ ok: true, items }) as const,
        () => ({ ok: false, items: [] }) as const,
      )
    : null;

  const detailHref = (productId: string) =>
    `/catalogue/${productId}?startDate=${values.startDate}&endDate=${values.endDate}`;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Catalogue</h1>
        <p className="mt-2 text-muted-foreground">
          Availability is calculated for the dates you choose. Rates are
          indicative and quoted in the media owner&rsquo;s own units.
        </p>
      </div>

      <CatalogueFilters
        mediaTypes={options.mediaTypes}
        locations={options.locations}
        values={values}
      />

      {!parsed.success && (
        <p className="rounded-lg border border-destructive/30 bg-destructive-surface px-4 py-3 text-sm text-destructive">
          {z.flattenError(parsed.error).fieldErrors.endDate?.at(0) ??
            "Those dates are not valid."}
        </p>
      )}

      {results && !results.ok && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-destructive/30 bg-destructive-surface px-4 py-3 text-sm text-destructive">
          <span>
            The catalogue is temporarily unavailable. Nothing has been lost.
          </span>
          <RetryButton />
        </div>
      )}

      {results?.ok && results.items.length === 0 && (
        <p className="rounded-lg border border-dashed px-4 py-10 text-center text-muted-foreground">
          No products match these filters. Try a wider date range or a higher
          budget.
        </p>
      )}

      {results?.ok && results.items.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {results.items.length} products
          </p>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {results.items.map((product) => (
              <li key={product.id}>
                <Link
                  href={detailHref(product.id)}
                  className="flex h-full flex-col rounded-lg border bg-card p-5 shadow-xs transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold text-pretty">
                      {product.name}
                    </h2>
                    <AvailabilityBadge state={product.availability.state} />
                  </div>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {product.mediaOwnerName} &middot;{" "}
                    {humanise(product.mediaType)}
                  </p>

                  <p className="mt-4 font-medium">
                    {product.indicativeRate.label}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Minimum term {product.minimumTermDays} days
                  </p>

                  <p className="mt-4 flex-1 text-sm text-muted-foreground">
                    {product.availability.reason}
                  </p>

                  <p className="mt-4 text-xs text-muted-foreground">
                    {product.locationNames.join(", ")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
