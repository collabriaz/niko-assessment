import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityBadge } from "@/components/availability-badge";
import { ShortlistButton } from "@/components/shortlist-button";
import { getProduct } from "@/data/products";
import { isShortlisted } from "@/data/shortlist";
import { defaultDateRange } from "@/domain/catalogue";
import { fixtureClock } from "@/domain/fixtures";
import { formatDate, humanise } from "@/lib/format";
import { sessionUser } from "@/lib/session";

const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const creativeSpecEntries = (spec: unknown) =>
  spec && typeof spec === "object" && !Array.isArray(spec)
    ? Object.entries(spec as Record<string, unknown>)
    : [];

export default async function ProductPage({
  params,
  searchParams,
}: PageProps<"/catalogue/[productId]">) {
  const { productId } = await params;
  const query = await searchParams;
  const defaults = defaultDateRange(fixtureClock);
  const startDate = single(query.startDate) || defaults.startDate;
  const endDate = single(query.endDate) || defaults.endDate;

  const product = await getProduct(productId, {
    startDate,
    endDate,
    now: fixtureClock,
  });

  if (!product) notFound();

  const spec = creativeSpecEntries(product.creativeSpec);
  const user = await sessionUser();
  const organisationId = user?.role === "client" ? user.organisationId : null;
  const shortlisted = organisationId
    ? await isShortlisted(organisationId, product.id)
    : false;

  return (
    <div className="space-y-8">
      <Link
        href={`/catalogue?startDate=${startDate}&endDate=${endDate}`}
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        &larr; Back to the catalogue
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {product.name}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {product.mediaOwnerName} &middot; {humanise(product.mediaType)}{" "}
            &middot; {product.locationNames.join(", ")}
          </p>
        </div>
        <AvailabilityBadge state={product.availability.state} />
      </div>

      <p className="max-w-2xl text-pretty">{product.description}</p>

      <dl className="grid gap-4 rounded-lg border bg-card p-5 shadow-xs sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted-foreground">Indicative rate</dt>
          <dd className="mt-1 font-medium">{product.indicativeRate.label}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Minimum term</dt>
          <dd className="mt-1 font-medium">{product.minimumTermDays} days</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Requested dates</dt>
          <dd className="mt-1 font-medium">
            {formatDate(startDate)} to {formatDate(endDate)}
          </dd>
        </div>
      </dl>

      {organisationId ? (
        <div>
          <ShortlistButton
            productId={product.id}
            startDate={startDate}
            endDate={endDate}
            shortlisted={shortlisted}
          />
          <p className="mt-2 text-sm text-muted-foreground">
            {shortlisted ? (
              <>
                Saved for these dates. Send a non-binding request from your{" "}
                <Link
                  href="/shortlist"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  shortlist
                </Link>
                .
              </>
            ) : (
              "Shortlisting saves these dates so you can request them later."
            )}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link
            href="/register"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create an account
          </Link>{" "}
          to shortlist these dates and send a non-binding request. No contract
          is needed.
        </p>
      )}

      <section>
        <h2 className="font-semibold">Availability</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {product.availability.reason}
        </p>

        {product.assetOptions.length > 0 ? (
          <ul className="mt-4 divide-y rounded-lg border bg-card shadow-xs">
            {product.assetOptions.map((asset) => (
              <li
                key={asset.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <div>
                  <p className="font-medium">{asset.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {asset.availability.reason}
                  </p>
                </div>
                <AvailabilityBadge state={asset.availability.state} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
            This product is sold from a shared capacity pool rather than named
            physical assets.
            {product.availability.totalCapacity !== null &&
              ` ${product.availability.availableCapacity} of ${product.availability.totalCapacity} slots are free for these dates.`}
          </p>
        )}
      </section>

      {spec.length > 0 && (
        <section>
          <h2 className="font-semibold">Creative specification</h2>
          <dl className="mt-4 grid gap-x-8 gap-y-3 rounded-lg border bg-card p-5 shadow-xs sm:grid-cols-2">
            {spec.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">{humanise(key)}</dt>
                <dd className="text-right font-medium">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
