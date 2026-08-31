"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const JOB_TYPES = [
  "survey",
  "production",
  "installation",
  "maintenance",
  "removal",
] as const;

const FIELD_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export const WorkOrderForm = ({
  campaignId,
  contractId,
  assetOptions,
  fitters,
  defaultDate,
}: {
  campaignId: string;
  contractId: string;
  assetOptions: { id: string; name: string }[];
  fitters: { id: string; name: string }[];
  defaultDate: string;
}) => {
  const router = useRouter();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [values, setValues] = useState({
    type: "installation",
    assetId: assetOptions.at(0)?.id ?? "",
    assignedUserId: fitters.at(0)?.id ?? "",
    date: defaultDate,
    startTime: "09:00",
    endTime: "11:00",
    locationLabel: "",
    instructions: "",
    internalNotes: "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (name: string, value: string) =>
    setValues((current) => ({ ...current, [name]: value }));

  const submit = async () => {
    setPending(true);
    setError(null);

    const response = await fetch("/api/management/work-orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        campaignId,
        contractId,
        type: values.type,
        assignedUserId: values.assignedUserId,
        assetId: values.assetId,
        scheduledStart: `${values.date}T${values.startTime}:00.000Z`,
        scheduledEnd: `${values.date}T${values.endTime}:00.000Z`,
        locationLabel: values.locationLabel,
        instructions: values.instructions,
        internalNotes: values.internalNotes || null,
      }),
    }).catch(() => null);

    setPending(false);

    if (response?.ok) {
      const workOrder = await response.json();
      setIdempotencyKey(crypto.randomUUID());
      router.push(`/manage/work-orders/${workOrder.id}`);
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
      <h2 className="font-semibold">Create field work</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The job appears in the assigned fitter's app straight away.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="type">
            Job type
          </label>
          <select
            id="type"
            value={values.type}
            onChange={(event) => set("type", event.target.value)}
            className={FIELD_CLASS}
          >
            {JOB_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="assignedUserId">
            Fitter
          </label>
          <select
            id="assignedUserId"
            value={values.assignedUserId}
            onChange={(event) => set("assignedUserId", event.target.value)}
            className={FIELD_CLASS}
          >
            {fitters.map((fitter) => (
              <option key={fitter.id} value={fitter.id}>
                {fitter.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="assetId">
            Asset
          </label>
          <select
            id="assetId"
            value={values.assetId}
            onChange={(event) => set("assetId", event.target.value)}
            className={FIELD_CLASS}
          >
            {assetOptions.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="date">
            Date
          </label>
          <Input
            id="date"
            type="date"
            value={values.date}
            onChange={(event) => set("date", event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="startTime">
            Start
          </label>
          <Input
            id="startTime"
            type="time"
            value={values.startTime}
            onChange={(event) => set("startTime", event.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="endTime">
            End
          </label>
          <Input
            id="endTime"
            type="time"
            value={values.endTime}
            onChange={(event) => set("endTime", event.target.value)}
          />
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <label className="text-sm font-medium" htmlFor="locationLabel">
            Location
          </label>
          <Input
            id="locationLabel"
            value={values.locationLabel}
            onChange={(event) => set("locationLabel", event.target.value)}
            placeholder="Where the fitter should go"
          />
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <label className="text-sm font-medium" htmlFor="instructions">
            Instructions
          </label>
          <textarea
            id="instructions"
            rows={2}
            value={values.instructions}
            onChange={(event) => set("instructions", event.target.value)}
            className="w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>

        <div className="grid gap-2 sm:col-span-2">
          <label className="text-sm font-medium" htmlFor="internalNotes">
            Internal notes
          </label>
          <textarea
            id="internalNotes"
            rows={2}
            value={values.internalNotes}
            onChange={(event) => set("internalNotes", event.target.value)}
            placeholder="Seen by the assigned fitter and management only. Never by the client."
            className="w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      </div>

      <Button className="mt-5" disabled={pending} onClick={submit}>
        {pending ? "Creating" : "Create job"}
      </Button>

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive-surface px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
};
