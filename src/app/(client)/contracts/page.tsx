import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { listContractsForOrganisation } from "@/data/contracts";
import { clientActionRequired } from "@/domain/contracts";
import { formatDate, formatMoney } from "@/lib/format";
import { sessionUser } from "@/lib/session";

export default async function ContractsPage() {
  const user = await sessionUser();

  if (!user || user.role !== "client" || !user.organisationId) redirect("/");

  const contracts = await listContractsForOrganisation(user.organisationId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Contracts</h1>
        <p className="mt-2 text-muted-foreground">
          Every contract issued to your organisation, with the actions waiting
          on you.
        </p>
      </div>

      {contracts.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="font-medium">No contracts yet</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            A contract appears here once Island Media Co has reviewed a request
            and issued one to you.
          </p>
          <Link
            href="/catalogue"
            className={buttonVariants({ className: "mt-5" })}
          >
            Browse the catalogue
          </Link>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card shadow-xs">
          {contracts.map((contract) => {
            const action = clientActionRequired(contract.status);

            return (
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
                      {contract.id} &middot; version {contract.version}
                    </p>
                    {action && (
                      <p className="mt-1 text-sm text-warning">{action}</p>
                    )}
                  </div>
                  <span className="font-medium">
                    {formatMoney(contract.total)}
                  </span>
                  <StatusBadge status={contract.status} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
