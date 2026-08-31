import Link from "next/link";
import { notFound } from "next/navigation";
import { AvailabilityBadge } from "@/components/availability-badge";
import { RequestDecision } from "@/components/request-decision";
import { StatusBadge } from "@/components/status-badge";
import { getBookingRequestForManagement } from "@/data/booking-requests";
import { decisionAllowed } from "@/domain/booking-requests";
import { fixtureClock } from "@/domain/fixtures";
import { historyEntrySchema } from "@/domain/schemas";
import { formatDate, formatMoney, humanise } from "@/lib/format";
import { sessionUser } from "@/lib/session";

export default async function RequestDetailPage({
  params,
}: PageProps<"/manage/requests/[requestId]">) {
  const user = await sessionUser();

  if (user?.role !== "manager")
    return (
      <p className="rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
        Switch to the manager account to review booking requests.
      </p>
    );

  const { requestId } = await params;
  const request = await getBookingRequestForManagement(requestId, fixtureClock);

  if (!request) notFound();

  const history = historyEntrySchema.array().parse(request.history);

  return (
    <main className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-8">
        <div>
          <Link
            href="/manage/requests"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Back to requests
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {request.product.name}
            </h1>
            <StatusBadge status={request.status} />
          </div>
          <p className="mt-2 text-muted-foreground">
            Requested by{" "}
            <Link
              href={`/manage/clients/${request.organisation.id}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {request.organisation.name}
            </Link>{" "}
            on {formatDate(request.createdAt.slice(0, 10))}
          </p>
          {request.attentionReason && (
            <p className="mt-3 rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
              {request.attentionReason}
            </p>
          )}
        </div>

        <section className="rounded-lg border bg-card p-5 shadow-xs">
          <h2 className="font-semibold">What was asked for</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Dates</dt>
              <dd className="mt-1 font-medium">
                {formatDate(request.startDate)} to {formatDate(request.endDate)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">
                Indicative budget
              </dt>
              <dd className="mt-1 font-medium">
                {request.budget === null
                  ? "Not stated"
                  : formatMoney(request.budget)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Minimum term</dt>
              <dd className="mt-1 font-medium">
                {request.product.minimumTermDays} days
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Rate</dt>
              <dd className="mt-1 font-medium">
                {request.product.indicativeRate.label}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Objective</dt>
              <dd className="mt-1">{request.objective}</dd>
            </div>
            {request.notes && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted-foreground">Client notes</dt>
                <dd className="mt-1">{request.notes}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-lg border bg-card p-5 shadow-xs">
          <h2 className="font-semibold">History</h2>
          <ol className="mt-4 space-y-4">
            {history.map((entry) => (
              <li key={`${entry.at}-${entry.action}`} className="text-sm">
                <p className="font-medium">
                  {humanise(entry.action)}{" "}
                  <span className="font-normal text-muted-foreground">
                    by {entry.actor}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  {formatDate(entry.at.slice(0, 10))}
                  {entry.note ? ` - ${entry.note}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="space-y-8">
        <section className="rounded-lg border bg-card p-5 shadow-xs">
          <h2 className="font-semibold">Availability now</h2>
          <AvailabilityBadge
            state={request.currentAvailability.state}
            className="mt-3"
          />
          <p className="mt-3 text-sm text-muted-foreground">
            {request.currentAvailability.reason}
          </p>
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Checked {request.currentAvailability.calculatedAt}
          </p>
        </section>

        {decisionAllowed(request.status) ? (
          <RequestDecision requestId={request.id} />
        ) : (
          <section className="rounded-lg border bg-card p-5 shadow-xs">
            <h2 className="font-semibold">Decided</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This request is {humanise(request.status).toLowerCase()} and can
              no longer be decided.
            </p>
            {request.draftContractId && (
              <p className="mt-3 text-sm">
                Draft contract{" "}
                <span className="font-mono">{request.draftContractId}</span>
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
