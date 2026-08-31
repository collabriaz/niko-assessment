import Link from "next/link";
import { redirect } from "next/navigation";
import { AvailabilityBadge } from "@/components/availability-badge";
import { BookingRequestForm } from "@/components/booking-request-form";
import { ShortlistButton } from "@/components/shortlist-button";
import { buttonVariants } from "@/components/ui/button";
import { listShortlist } from "@/data/shortlist";
import { fixtureClock } from "@/domain/fixtures";
import { formatDate, humanise } from "@/lib/format";
import { sessionUser } from "@/lib/session";

export default async function ShortlistPage() {
  const user = await sessionUser();

  if (!user || user.role !== "client" || !user.organisationId) redirect("/");

  const items = await listShortlist(user.organisationId, fixtureClock);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Shortlist</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Availability is recalculated every time you open this page, so a saved
          option can change. Sending a request is free and non-binding.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="font-medium">Nothing shortlisted yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Browse the catalogue for your dates and save the options worth
            asking about.
          </p>
          <Link
            href="/catalogue"
            className={buttonVariants({ className: "mt-5" })}
          >
            Browse the catalogue
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border bg-card p-5 shadow-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/catalogue/${item.product.id}?startDate=${item.startDate}&endDate=${item.endDate}`}
                    className="font-semibold underline-offset-4 hover:underline"
                  >
                    {item.product.name}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.product.mediaOwnerName} &middot;{" "}
                    {humanise(item.product.mediaType)} &middot;{" "}
                    {item.product.indicativeRate.label}
                  </p>
                  <p className="mt-3 font-medium">
                    {formatDate(item.startDate)} to {formatDate(item.endDate)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {item.product.availability.reason}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-3">
                  <AvailabilityBadge state={item.product.availability.state} />
                  <ShortlistButton
                    productId={item.product.id}
                    startDate={item.startDate}
                    endDate={item.endDate}
                    shortlisted
                    size="sm"
                  />
                </div>
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-primary underline-offset-4 hover:underline">
                  Request these dates
                </summary>
                <BookingRequestForm
                  productId={item.product.id}
                  startDate={item.startDate}
                  endDate={item.endDate}
                  minimumTermDays={item.product.minimumTermDays}
                />
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
