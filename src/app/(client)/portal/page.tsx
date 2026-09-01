import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { getClientSummary } from "@/data/client-summary";
import { formatDate, formatMoney } from "@/lib/format";
import { sessionUser } from "@/lib/session";

export default async function PortalPage() {
  const user = await sessionUser();

  if (!user || user.role !== "client" || !user.organisationId) redirect("/");

  const summary = await getClientSummary(user.organisationId);

  if (!summary) redirect("/");

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          {summary.organisation.name}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Account opened{" "}
          {formatDate(summary.organisation.createdAt.slice(0, 10))}
          {" · "}
          {summary.organisation.contractCount === 0
            ? "no contracts yet"
            : `${summary.organisation.contractCount} contract${summary.organisation.contractCount === 1 ? "" : "s"}`}
        </p>
      </div>

      {summary.attentionItems.length > 0 && (
        <section>
          <h2 className="font-semibold">Needs your attention</h2>
          <ul className="mt-3 space-y-3">
            {summary.attentionItems.map((item) => (
              <li
                key={`${item.type}-${item.contractId ?? "none"}`}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-warning/30 bg-warning-surface px-4 py-3.5"
              >
                <AlertCircle className="size-4 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </div>
                {item.contractId && (
                  <Link
                    href={`/contracts/${item.contractId}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    Open
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold">Contracts</h2>
          {summary.contracts.length > 0 && (
            <Link
              href="/contracts"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              View all
            </Link>
          )}
        </div>

        {summary.contracts.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed px-6 py-10 text-center">
            <p className="font-medium">No contracts yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Browse the catalogue, shortlist what fits, and send a non-binding
              request. Island Media Co will come back to you with a contract.
            </p>
            <Link
              href="/catalogue"
              className={buttonVariants({ className: "mt-5" })}
            >
              Browse the catalogue
            </Link>
          </div>
        ) : (
          <ul className="mt-3 divide-y rounded-lg border bg-card shadow-xs">
            {summary.contracts.map((contract) => (
              <li key={contract.id}>
                <Link
                  href={`/contracts/${contract.id}`}
                  className="flex flex-wrap items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {formatDate(contract.startDate)} to{" "}
                      {formatDate(contract.endDate)}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {contract.id}
                    </p>
                  </div>
                  <span className="font-medium">
                    {formatMoney(contract.total)}
                  </span>
                  <StatusBadge status={contract.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {summary.bookingRequests.length > 0 && (
        <section>
          <h2 className="font-semibold">Your requests</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A request is not a booking. Nothing is reserved until Island Media
            Co issues a contract and you accept it.
          </p>
          <ul className="mt-3 divide-y rounded-lg border bg-card shadow-xs">
            {summary.bookingRequests.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center gap-4 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{request.productName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(request.startDate)} to{" "}
                    {formatDate(request.endDate)}
                  </p>
                  {request.status === "information_required" && (
                    <p className="mt-1 text-sm text-warning">
                      Island Media Co has asked for more information and will
                      contact you.
                    </p>
                  )}
                </div>
                <StatusBadge status={request.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-semibold">Recent service activity</h2>
        {summary.recentServiceEvents.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing yet. Updates appear here once a campaign is under way.
          </p>
        ) : (
          <ol className="mt-3 space-y-4 border-l pl-6">
            {summary.recentServiceEvents.map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute top-1.5 -left-6 size-2.5 -translate-x-1/2 rounded-full bg-primary" />
                <p className="font-medium">{event.title}</p>
                <p className="text-sm text-muted-foreground">
                  {event.clientSummary}
                </p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {formatDate(event.at.slice(0, 10))}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
