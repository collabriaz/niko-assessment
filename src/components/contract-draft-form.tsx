"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AssetOption = {
  id: string;
  name: string;
  availability: { state: string; reason: string };
};

const AVAILABILITY_NOTE: Record<string, string> = {
  available: "free",
  confirmation_required: "confirm with owner",
  unavailable: "not available",
};

export const ContractDraftForm = ({
  bookingRequestId,
  organisationId,
  productId,
  startDate,
  endDate,
  assetOptions,
  capacityPoolId,
  suggestedUnitRate,
  rateUnit,
}: {
  bookingRequestId: string;
  organisationId: string;
  productId: string;
  startDate: string;
  endDate: string;
  assetOptions: AssetOption[];
  capacityPoolId: string | null;
  suggestedUnitRate: number | null;
  rateUnit: string | null;
}) => {
  const router = useRouter();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [values, setValues] = useState({
    startDate,
    endDate,
    assetId: assetOptions.at(0)?.id ?? "",
    quantity: "1",
    unitRate: suggestedUnitRate === null ? "" : String(suggestedUnitRate),
    lineTotal: "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (name: string, value: string) =>
    setValues((current) => ({ ...current, [name]: value }));

  const submit = async () => {
    const lineTotal = Number(values.lineTotal);

    if (!Number.isFinite(lineTotal) || lineTotal <= 0) {
      setError("Enter the agreed line total for this contract.");
      return;
    }

    setPending(true);
    setError(null);

    const response = await fetch("/api/management/contracts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        organisationId,
        bookingRequestId,
        startDate: values.startDate,
        endDate: values.endDate,
        items: [
          {
            productId,
            assetId: capacityPoolId ? null : values.assetId || null,
            capacityPoolId,
            quantity: Number(values.quantity),
            unitRate: values.unitRate === "" ? null : Number(values.unitRate),
            rateUnit,
            lineTotal,
          },
        ],
        total: lineTotal,
      }),
    }).catch(() => null);

    setPending(false);

    if (response?.ok) {
      const contract = await response.json();
      setIdempotencyKey(crypto.randomUUID());
      router.push(`/manage/contracts/${contract.id}`);
      return;
    }

    const body = await response?.json().catch(() => null);

    setError(
      body?.message ??
        "Could not reach Island Media Co. Nothing has been changed.",
    );
  };

  return (
    <section className="rounded-lg border bg-card p-5 shadow-xs">
      <h2 className="font-semibold">Draft a contract</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The draft is not visible to the client until you issue it.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="startDate">
            Start date
          </label>
          <Input
            id="startDate"
            type="date"
            value={values.startDate}
            onChange={(event) => set("startDate", event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="endDate">
            End date
          </label>
          <Input
            id="endDate"
            type="date"
            value={values.endDate}
            onChange={(event) => set("endDate", event.target.value)}
          />
        </div>

        {capacityPoolId ? (
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="quantity">
              Pool units
            </label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={values.quantity}
              onChange={(event) => set("quantity", event.target.value)}
            />
          </div>
        ) : (
          <div className="grid gap-2 sm:col-span-2">
            <label className="text-sm font-medium" htmlFor="assetId">
              Allocated asset
            </label>
            <select
              id="assetId"
              value={values.assetId}
              onChange={(event) => set("assetId", event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {assetOptions.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name} -{" "}
                  {AVAILABILITY_NOTE[asset.availability.state] ??
                    asset.availability.state}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="unitRate">
            Unit rate {rateUnit ? `per ${rateUnit}` : ""}
          </label>
          <Input
            id="unitRate"
            type="number"
            min="0"
            placeholder="Price on request"
            value={values.unitRate}
            onChange={(event) => set("unitRate", event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="lineTotal">
            Agreed total for the term
          </label>
          <Input
            id="lineTotal"
            type="number"
            min="0"
            value={values.lineTotal}
            onChange={(event) => set("lineTotal", event.target.value)}
          />
        </div>
      </div>

      <Button className="mt-5" disabled={pending} onClick={submit}>
        {pending ? "Creating" : "Create draft"}
      </Button>

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive-surface px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
};
