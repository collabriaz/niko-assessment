import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { getOrganisationForManagement } from "@/data/organisations";
import { formatDate, formatMoney } from "@/lib/format";
import { sessionUser } from "@/lib/session";

export default async function ClientDetailPage({
  params,
}: PageProps<"/manage/clients/[organisationId]">) {
  const user = await sessionUser();

  if (user?.role !== "manager")
    return (
      <p className="rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
        Switch to the manager account to review client accounts.
      </p>
    );

  const { organisationId } = await params;
  const organisation = await getOrganisationForManagement(organisationId);

  if (!organisation) notFound();

  return (
    <main className="space-y-8">
      <div>
        <Link
          href="/manage/requests"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Back to requests
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {organisation.name}
        </h1>
        <p className="mt-2 text-muted-foreground">
          Client since {formatDate(organisation.createdAt.slice(0, 10))} -{" "}
          {organisation.contractCount === 0
            ? "no contracts yet"
            : `${organisation.contractCount} contract${organisation.contractCount === 1 ? "" : "s"}`}
        </p>
      </div>

      <section className="rounded-lg border bg-card p-5 shadow-xs">
        <h2 className="font-semibold">People</h2>
        <ul className="mt-4 space-y-3">
          {organisation.users.map((person) => (
            <li key={person.id} className="text-sm">
              <p className="font-medium">{person.name}</p>
              <p className="text-muted-foreground">{person.email}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-xs">
        <h2 className="font-semibold">Contracts</h2>
        {organisation.contracts.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No contract has been issued to this client yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {organisation.contracts.map((contract) => (
              <li
                key={contract.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
              >
                <span className="font-mono">{contract.id}</span>
                <StatusBadge status={contract.status} />
                <span className="text-muted-foreground">
                  {formatDate(contract.startDate)} to{" "}
                  {formatDate(contract.endDate)}
                </span>
                <span className="ml-auto font-medium">
                  {formatMoney(contract.total)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-card p-5 shadow-xs">
        <h2 className="font-semibold">Booking requests</h2>
        {organisation.bookingRequests.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            This client has not sent a booking request yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {organisation.bookingRequests.map((request) => (
              <li key={request.id}>
                <Link
                  href={`/manage/requests/${request.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm underline-offset-4 hover:underline"
                >
                  <span className="font-medium">{request.productName}</span>
                  <StatusBadge status={request.status} />
                  <span className="text-muted-foreground">
                    {formatDate(request.startDate)} to{" "}
                    {formatDate(request.endDate)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
