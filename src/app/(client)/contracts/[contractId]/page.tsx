import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { getContractForOrganisation } from "@/data/contracts";
import { clientActionRequired } from "@/domain/contracts";
import { formatDate, formatMoney } from "@/lib/format";
import { sessionUser } from "@/lib/session";

export default async function ContractPage({
  params,
}: PageProps<"/contracts/[contractId]">) {
  const user = await sessionUser();

  if (!user || user.role !== "client" || !user.organisationId) redirect("/");

  const { contractId } = await params;
  const contract = await getContractForOrganisation(
    user.organisationId,
    contractId,
  );

  if (!contract) notFound();

  const action = clientActionRequired(contract.status);

  return (
    <div className="space-y-10">
      <Link
        href="/contracts"
        className="text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        &larr; All contracts
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {formatDate(contract.startDate)} to {formatDate(contract.endDate)}
          </h1>
          <p className="mt-2 font-mono text-sm text-muted-foreground">
            {contract.id} &middot; version {contract.version}
          </p>
        </div>
        <StatusBadge status={contract.status} />
      </div>

      {action && (
        <p className="rounded-lg border border-warning/30 bg-warning-surface px-4 py-3.5 text-sm">
          <span className="font-medium">{action}.</span> Nothing changes on this
          contract until you respond and Island Media Co updates it.
        </p>
      )}

      <section>
        <h2 className="font-semibold">What is included</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-2 font-medium">Product</th>
              <th className="py-2 font-medium">Allocation</th>
              <th className="py-2 text-right font-medium">Quantity</th>
              <th className="py-2 text-right font-medium">Rate</th>
              <th className="py-2 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {contract.items.map((item) => (
              <tr key={item.id} className="border-b last:border-0">
                <td className="py-3 font-mono text-xs">{item.productId}</td>
                <td className="py-3 font-mono text-xs">
                  {item.assetId ?? item.capacityPoolId ?? "Not yet allocated"}
                </td>
                <td className="py-3 text-right">{item.quantity}</td>
                <td className="py-3 text-right">
                  {item.unitRate === null
                    ? "Price on request"
                    : `${formatMoney(item.unitRate)} per ${item.rateUnit}`}
                </td>
                <td className="py-3 text-right font-medium">
                  {formatMoney(item.lineTotal)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-3 font-medium" colSpan={4}>
                Total
              </td>
              <td className="pt-3 text-right text-lg font-semibold">
                {formatMoney(contract.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {contract.campaign && (
        <section>
          <h2 className="font-semibold">Campaign</h2>
          <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border bg-card px-5 py-4 shadow-xs">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{contract.campaign.name}</p>
              <p className="text-sm text-muted-foreground">
                Stage: {contract.campaign.currentStage.replace(/_/g, " ")}
              </p>
            </div>
            <StatusBadge status={contract.campaign.status} />
          </div>
        </section>
      )}

      <section>
        <h2 className="font-semibold">Service timeline</h2>
        {contract.serviceEvents.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing yet. Updates appear here as work progresses.
          </p>
        ) : (
          <ol className="mt-3 space-y-4 border-l pl-6">
            {contract.serviceEvents.map((event) => (
              <li key={event.id} className="relative">
                <span className="absolute top-1.5 -left-6.75 size-2.5 rounded-full bg-primary" />
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

      {contract.clientRequests.length > 0 && (
        <section>
          <h2 className="font-semibold">Your requests</h2>
          <ul className="mt-3 divide-y rounded-lg border bg-card shadow-xs">
            {contract.clientRequests.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center gap-4 px-5 py-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{request.summary}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {formatDate(request.createdAt.slice(0, 10))}
                  </p>
                </div>
                <StatusBadge status={request.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {contract.proofRecords.length > 0 && (
        <section>
          <h2 className="font-semibold">Proof of completion</h2>
          <ul className="mt-3 divide-y rounded-lg border bg-card shadow-xs">
            {contract.proofRecords.map((proof) => (
              <li key={proof.id} className="px-5 py-4">
                <p className="font-medium">{proof.fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {proof.completionNote}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
