import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { listWorkOrdersForManagement } from "@/data/work-orders";
import { humanise } from "@/lib/format";
import { sessionUser } from "@/lib/session";

const scheduled = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export default async function WorkOrdersPage() {
  const user = await sessionUser();

  if (user?.role !== "manager")
    return (
      <p className="rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
        Switch to the manager account to review field work.
      </p>
    );

  const workOrders = await listWorkOrdersForManagement();

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Field work</h1>
      <p className="mt-2 text-muted-foreground">
        Create a job from an active campaign on its contract page.
      </p>

      {workOrders.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No job has been created yet.
        </p>
      ) : (
        <ul className="mt-8 grid gap-3">
          {workOrders.map((workOrder) => (
            <li key={workOrder.id}>
              <Link
                href={`/manage/work-orders/${workOrder.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card p-5 shadow-xs transition-colors hover:border-primary/40"
              >
                <div className="min-w-56 flex-1">
                  <p className="font-medium">
                    {humanise(workOrder.type)} - {workOrder.locationLabel}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {workOrder.organisationName} -{" "}
                    {workOrder.assignedUserName ?? "unassigned"}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {scheduled.format(new Date(workOrder.scheduledStart))}
                </p>
                <StatusBadge status={workOrder.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
