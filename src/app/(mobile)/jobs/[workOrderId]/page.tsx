import Link from "next/link";
import { notFound } from "next/navigation";
import { JobStatusActions } from "@/components/job-status-actions";
import { ProofCapture } from "@/components/proof-capture";
import { StatusBadge } from "@/components/status-badge";
import { getWorkOrderForFitter } from "@/data/work-orders";
import { humanise } from "@/lib/format";
import { sessionUser } from "@/lib/session";

const when = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export default async function JobDetailPage({
  params,
}: PageProps<"/jobs/[workOrderId]">) {
  const user = await sessionUser();

  if (user?.role !== "fitter")
    return (
      <p className="rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
        Switch to the fitter account to see assigned jobs.
      </p>
    );

  const { workOrderId } = await params;
  const job = await getWorkOrderForFitter(workOrderId, user.id);

  if (!job) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/jobs"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Back to jobs
        </Link>
        <div className="mt-3 flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            {humanise(job.type)}
          </h1>
          <StatusBadge status={job.status} />
        </div>
        <p className="mt-1 text-muted-foreground">{job.campaignName}</p>
      </div>

      <section className="space-y-4 rounded-lg border bg-card p-4 shadow-xs">
        <div>
          <p className="text-sm text-muted-foreground">When</p>
          <p className="mt-0.5 font-medium">
            {when.format(new Date(job.scheduledStart))}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Where</p>
          <p className="mt-0.5 font-medium">{job.locationLabel}</p>
          <p className="text-sm text-muted-foreground">{job.assetName}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Instructions</p>
          <p className="mt-0.5">{job.instructions}</p>
        </div>
        {job.internalNotes && (
          <div>
            <p className="text-sm text-muted-foreground">
              For you and the office only
            </p>
            <p className="mt-0.5 rounded-lg bg-muted px-3 py-2 text-sm">
              {job.internalNotes}
            </p>
          </div>
        )}
        {job.blockedReason && (
          <div>
            <p className="text-sm text-muted-foreground">You reported</p>
            <p className="mt-0.5 text-warning">{job.blockedReason}</p>
          </div>
        )}
      </section>

      {job.status !== "completed" && <ProofCapture workOrderId={job.id} />}

      {job.proofRecordIds.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {job.proofRecordIds.length} photo
          {job.proofRecordIds.length === 1 ? "" : "s"} attached.
        </p>
      )}

      <JobStatusActions
        workOrderId={job.id}
        status={job.status}
        proofCount={job.proofRecordIds.length}
      />
    </div>
  );
}
