import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { listContractsForManagement } from "@/data/contracts";
import { formatDate, formatMoney } from "@/lib/format";
import { sessionUser } from "@/lib/session";

export default async function ContractsPage() {
  const user = await sessionUser();

  if (user?.role !== "manager")
    return (
      <p className="rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
        Switch to the manager account to review contracts.
      </p>
    );

  const contracts = await listContractsForManagement();

  return (
    <main>
      <h1 className="text-2xl font-semibold tracking-tight">Contracts</h1>

      {contracts.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          No contract has been drafted yet. Approve a booking request to draft
          the first one.
        </p>
      ) : (
        <ul className="mt-8 grid gap-3">
          {contracts.map((contract) => (
            <li key={contract.id}>
              <Link
                href={`/manage/contracts/${contract.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card p-5 shadow-xs transition-colors hover:border-primary/40"
              >
                <div className="min-w-56 flex-1">
                  <p className="font-medium">{contract.organisationName}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {contract.id}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(contract.startDate)} to{" "}
                  {formatDate(contract.endDate)}
                </p>
                <StatusBadge status={contract.status} />
                <p className="font-medium">{formatMoney(contract.total)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
