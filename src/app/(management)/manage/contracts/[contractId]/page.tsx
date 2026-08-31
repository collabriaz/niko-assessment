import Link from "next/link";
import { notFound } from "next/navigation";
import { IssueContractButton } from "@/components/issue-contract-button";
import { StatusBadge } from "@/components/status-badge";
import { WorkOrderForm } from "@/components/work-order-form";
import { getContractForManagement } from "@/data/contracts";
import { listFitters } from "@/data/users";
import { contractIssuable } from "@/domain/contracts";
import { fixtureClock } from "@/domain/fixtures";
import { historyEntrySchema } from "@/domain/schemas";
import { formatDate, formatMoney, humanise } from "@/lib/format";
import { sessionUser } from "@/lib/session";

export default async function ContractDetailPage({
  params,
}: PageProps<"/manage/contracts/[contractId]">) {
  const user = await sessionUser();

  if (user?.role !== "manager")
    return (
      <p className="rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
        Switch to the manager account to review contracts.
      </p>
    );

  const { contractId } = await params;
  const contract = await getContractForManagement(contractId);

  if (!contract) notFound();

  const history = historyEntrySchema.array().parse(contract.history);
  const fitters = await listFitters();

  return (
    <main className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-8">
        <div>
          <Link
            href="/manage/contracts"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Back to contracts
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {contract.organisationName}
            </h1>
            <StatusBadge status={contract.status} />
          </div>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {contract.id} - version {contract.version}
          </p>
        </div>

        <section className="rounded-lg border bg-card p-5 shadow-xs">
          <h2 className="font-semibold">Terms</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted-foreground">Dates</dt>
              <dd className="mt-1 font-medium">
                {formatDate(contract.startDate)} to{" "}
                {formatDate(contract.endDate)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted-foreground">Total</dt>
              <dd className="mt-1 font-medium">
                {formatMoney(contract.total)}
              </dd>
            </div>
          </dl>

          <ul className="mt-5 space-y-3 border-t pt-5">
            {contract.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
              >
                <span className="font-medium">{item.productId}</span>
                <span className="text-muted-foreground">
                  {item.assetId ?? item.capacityPoolId ?? "unallocated"}
                </span>
                <span className="text-muted-foreground">
                  {item.quantity} x{" "}
                  {item.unitRate === null
                    ? "price on request"
                    : `${formatMoney(item.unitRate)}${item.rateUnit ? ` per ${item.rateUnit}` : ""}`}
                </span>
                <span className="ml-auto font-medium">
                  {formatMoney(item.lineTotal)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border bg-card p-5 shadow-xs">
          <h2 className="font-semibold">History</h2>
          <ol className="mt-4 space-y-4">
            {history.map((entry) => (
              <li key={`${entry.at}-${entry.action}`} className="text-sm">
                <p className="font-medium">
                  {humanise(entry.action)}{" "}
                  <span className="font-normal text-muted-foreground">
                    by {entry.actor}
                  </span>
                </p>
                <p className="text-muted-foreground">
                  {formatDate(entry.at.slice(0, 10))}
                  {entry.note ? ` - ${entry.note}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="space-y-8">
        <section className="rounded-lg border bg-card p-5 shadow-xs">
          <h2 className="font-semibold">
            {contractIssuable(contract.status) ? "Issue" : "Issued"}
          </h2>
          {contractIssuable(contract.status) ? (
            <div className="mt-4">
              <IssueContractButton contractId={contract.id} />
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              Issued{" "}
              {contract.issuedAt
                ? formatDate(contract.issuedAt.slice(0, 10))
                : ""}
              . The client decides what happens next.
            </p>
          )}
        </section>

        <section className="rounded-lg border bg-card p-5 shadow-xs">
          <h2 className="font-semibold">Campaign</h2>
          {contract.campaign ? (
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="mt-0.5 font-medium">{contract.campaign.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Stage</dt>
                <dd className="mt-0.5">
                  {humanise(contract.campaign.currentStage)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Booking</dt>
                <dd className="mt-0.5 font-mono text-xs">
                  {contract.campaign.bookingId
                    ? `${contract.campaign.bookingId} (${contract.campaign.bookingStatus})`
                    : "Not booked until the client accepts"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              A campaign is created when the contract is issued.
            </p>
          )}
        </section>

        {contract.campaign &&
          contract.campaign.status !== "awaiting_contract_acceptance" && (
            <WorkOrderForm
              campaignId={contract.campaign.id}
              contractId={contract.id}
              assetOptions={contract.assetOptions}
              fitters={fitters}
              defaultDate={fixtureClock.toISOString().slice(0, 10)}
            />
          )}
      </div>
    </main>
  );
}
