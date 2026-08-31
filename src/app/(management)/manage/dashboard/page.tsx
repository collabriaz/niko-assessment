import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { getManagementDashboard } from "@/data/dashboard";
import { fixtureClock } from "@/domain/fixtures";
import { humanise } from "@/lib/format";
import { sessionUser } from "@/lib/session";

const COUNT_LABEL = {
  requestsAwaitingDecision: "Requests to decide",
  clientRequestsPending: "Client requests to review",
  contractsAwaitingClient: "Contracts with the client",
  workOrdersBlocked: "Jobs blocked",
  workOrdersUpcoming: "Jobs scheduled",
} as const;

const scheduledLabel = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export default async function DashboardPage() {
  const user = await sessionUser();

  if (user?.role !== "manager")
    return (
      <p className="rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
        Switch to the manager account to open the dashboard.
      </p>
    );

  const { attentionItems, counts, upcomingWorkOrders } =
    await getManagementDashboard(fixtureClock);

  return (
    <main className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <p className="mt-2 text-muted-foreground">
          {attentionItems.length === 0
            ? "Nothing needs a decision from you."
            : `${attentionItems.length} thing${attentionItems.length === 1 ? "" : "s"} need a decision from you.`}
        </p>
      </div>

      <section>
        <h2 className="sr-only">Counts</h2>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(COUNT_LABEL).map(([key, label]) => (
            <div key={key} className="rounded-lg border bg-card p-5 shadow-xs">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="mt-2 text-3xl font-semibold tabular-nums">
                {counts[key as keyof typeof COUNT_LABEL]}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h2 className="font-semibold">Needs you</h2>
        {attentionItems.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            Nothing is waiting on management.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {attentionItems.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="block rounded-lg border bg-card p-5 shadow-xs transition-colors hover:border-primary/40"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-medium">{item.title}</p>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {humanise(item.kind)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {item.detail}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold">Field work</h2>
        {upcomingWorkOrders.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
            No job is scheduled.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {upcomingWorkOrders.map((workOrder) => (
              <li
                key={workOrder.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card p-5 shadow-xs"
              >
                <div className="min-w-56 flex-1">
                  <p className="font-medium">
                    {humanise(workOrder.type)} - {workOrder.locationLabel}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {scheduledLabel.format(new Date(workOrder.scheduledStart))}
                  </p>
                </div>
                <StatusBadge status={workOrder.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
