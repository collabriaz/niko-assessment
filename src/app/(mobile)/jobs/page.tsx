import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { listWorkOrdersForFitter } from "@/data/work-orders";
import { fixtureClock } from "@/domain/fixtures";
import { humanise } from "@/lib/format";
import { sessionUser } from "@/lib/session";

const time = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const day = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export default async function JobsPage() {
  const user = await sessionUser();

  if (user?.role !== "fitter")
    return (
      <p className="rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
        Switch to the fitter account to see assigned jobs.
      </p>
    );

  const jobs = await listWorkOrdersForFitter(user.id);
  const today = fixtureClock.toISOString().slice(0, 10);

  const groups = [
    {
      label: "Today",
      empty: "Nothing scheduled for today.",
      jobs: jobs.filter(
        (job) =>
          job.status !== "completed" &&
          job.scheduledStart.slice(0, 10) === today,
      ),
    },
    {
      label: "Upcoming",
      empty: "Nothing else booked in.",
      jobs: jobs.filter(
        (job) =>
          job.status !== "completed" && job.scheduledStart.slice(0, 10) > today,
      ),
    },
    {
      label: "Done",
      empty: "No completed jobs yet.",
      jobs: jobs.filter((job) => job.status === "completed"),
    },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold tracking-tight">Your jobs</h1>

      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="text-sm font-medium text-muted-foreground">
            {group.label}
          </h2>

          {group.jobs.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              {group.empty}
            </p>
          ) : (
            <ul className="mt-3 grid gap-3">
              {group.jobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="block rounded-lg border bg-card p-4 shadow-xs active:border-primary"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-medium">{humanise(job.type)}</p>
                      <StatusBadge status={job.status} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {job.locationLabel}
                    </p>
                    <p className="mt-2 text-sm font-medium">
                      {day.format(new Date(job.scheduledStart))} at{" "}
                      {time.format(new Date(job.scheduledStart))}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
