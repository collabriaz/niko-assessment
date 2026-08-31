import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { listBookingRequestsForManagement } from "@/data/booking-requests";
import { formatDate } from "@/lib/format";
import { sessionUser } from "@/lib/session";

export default async function RequestsPage() {
  const user = await sessionUser();

  if (user?.role !== "manager")
    return (
      <p className="rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
        Switch to the manager account to review booking requests.
      </p>
    );

  const requests = await listBookingRequestsForManagement();
  const raised = requests.filter((request) => request.attentionReason);

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">
        Booking requests
      </h1>
      <p className="mt-2 text-muted-foreground">
        {raised.length === 0
          ? "Nothing is waiting on you."
          : `${raised.length} of ${requests.length} need a decision from you.`}
      </p>

      {requests.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No client has sent a booking request yet.
        </p>
      ) : (
        <ul className="mt-8 grid gap-3">
          {requests.map((request) => (
            <li key={request.id}>
              <Link
                href={`/manage/requests/${request.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card p-5 shadow-xs transition-colors hover:border-primary/40"
              >
                <div className="min-w-56 flex-1">
                  <p className="font-medium">{request.organisationName}</p>
                  <p className="text-sm text-muted-foreground">
                    {request.productName}
                  </p>
                </div>

                <p className="text-sm text-muted-foreground">
                  {formatDate(request.startDate)} to{" "}
                  {formatDate(request.endDate)}
                </p>

                <StatusBadge status={request.status} />

                {request.attentionReason && (
                  <p className="w-full text-sm text-warning">
                    {request.attentionReason}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
