import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { getWorkOrderForManagement } from "@/data/work-orders";
import { historyEntrySchema } from "@/domain/schemas";
import { formatDate, humanise } from "@/lib/format";
import { sessionUser } from "@/lib/session";

const scheduled = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export default async function WorkOrderDetailPage({
  params,
}: PageProps<"/manage/work-orders/[workOrderId]">) {
  const user = await sessionUser();

  if (user?.role !== "manager")
    return (
      <p className="rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
        Switch to the manager account to review field work.
      </p>
    );

  const { workOrderId } = await params;
  const workOrder = await getWorkOrderForManagement(workOrderId);

  if (!workOrder) notFound();

  const history = historyEntrySchema.array().parse(workOrder.history);

  return (
    <main className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-8">
        <div>
          <Link
            href="/manage/work-orders"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Back to field work
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {humanise(workOrder.type)} - {workOrder.locationLabel}
            </h1>
            <StatusBadge status={workOrder.status} />
          </div>
          <p className="mt-2 text-muted-foreground">
            {workOrder.campaignName} for{" "}
            <Link
              href={`/manage/clients/${workOrder.organisationId}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {workOrder.organisationName}
            </Link>
          </p>
        </div>

        <section className="rounded-lg border bg-card p-5 shadow-xs">
          <h2 className="font-semibold">The job</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Scheduled</dt>
              <dd className="mt-1 font-medium">
                {scheduled.format(new Date(workOrder.scheduledStart))}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Asset</dt>
              <dd className="mt-1 font-medium">{workOrder.assetName}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Fitter</dt>
              <dd className="mt-1 font-medium">
                {workOrder.assignedUserName ?? "Unassigned"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted-foreground">Instructions</dt>
              <dd className="mt-1">{workOrder.instructions}</dd>
            </div>
            {workOrder.internalNotes && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted-foreground">
                  Internal notes
                </dt>
                <dd className="mt-1 rounded-lg bg-muted px-3 py-2 text-sm">
                  {workOrder.internalNotes}
                </dd>
              </div>
            )}
            {workOrder.blockedReason && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted-foreground">
                  Blocked because
                </dt>
                <dd className="mt-1 text-warning">{workOrder.blockedReason}</dd>
              </div>
            )}
            {workOrder.completionNote && (
              <div className="sm:col-span-2">
                <dt className="text-sm text-muted-foreground">
                  Completion note
                </dt>
                <dd className="mt-1">{workOrder.completionNote}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="rounded-lg border bg-card p-5 shadow-xs">
          <h2 className="font-semibold">Proof</h2>
          {workOrder.proofRecords.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No proof has been captured yet.
            </p>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {workOrder.proofRecords.map((proof) => (
                <li key={proof.id} className="rounded-lg border p-3">
                  {proof.previewUrl && (
                    // biome-ignore lint/performance/noImgElement: proof is a base64 data URI held in the prototype database, not a served asset
                    <img
                      src={proof.previewUrl}
                      alt={proof.fileName}
                      className="mb-3 w-full rounded-md"
                    />
                  )}
                  <p className="text-sm font-medium">{proof.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {proof.completionNote}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="space-y-8">
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

        <section className="rounded-lg border bg-card p-5 shadow-xs">
          <h2 className="font-semibold">Service history</h2>
          {workOrder.serviceEvents.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing recorded yet.
            </p>
          ) : (
            <ol className="mt-4 space-y-3">
              {workOrder.serviceEvents.map((event) => (
                <li key={event.id} className="text-sm">
                  <p className="font-medium">{event.title}</p>
                  <p className="text-muted-foreground">
                    {event.clientVisible
                      ? `Client sees: ${event.clientSummary}`
                      : "Internal only"}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}
