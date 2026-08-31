"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { shortTermWarning } from "@/domain/booking-requests";

type FieldErrors = Record<string, string[] | undefined>;

type Props = {
  productId: string;
  startDate: string;
  endDate: string;
  minimumTermDays: number;
};

export const BookingRequestForm = ({
  productId,
  startDate,
  endDate,
  minimumTermDays,
}: Props) => {
  const router = useRouter();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [values, setValues] = useState({
    startDate,
    endDate,
    budget: "",
    objective: "",
    notes: "",
  });
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const set = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setFieldErrors({});

    const response = await fetch("/api/booking-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        productId,
        startDate: values.startDate,
        endDate: values.endDate,
        budget: Number(values.budget),
        objective: values.objective,
        notes: values.notes.trim() || null,
      }),
    }).catch(() => null);

    setPending(false);

    if (response?.ok) {
      setIdempotencyKey(crypto.randomUUID());
      setValues({ ...values, budget: "", objective: "", notes: "" });
      setSent(true);
      router.refresh();
      return;
    }

    const body = await response?.json().catch(() => null);

    setFieldErrors(body?.details?.fieldErrors ?? {});
    setMessage(
      body?.message ??
        "That did not send. Nothing was submitted. Try again when you have a connection.",
    );
  };

  const shortfall = shortTermWarning(
    values.startDate,
    values.endDate,
    minimumTermDays,
  );

  return (
    <form className="mt-4 grid gap-4 border-t pt-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor={`start-${productId}`}>
            From
          </label>
          <Input
            id={`start-${productId}`}
            type="date"
            required
            aria-invalid={Boolean(fieldErrors.startDate)}
            value={values.startDate}
            onChange={(event) => set("startDate", event.target.value)}
          />
          {fieldErrors.startDate && (
            <p className="text-sm text-destructive">
              {fieldErrors.startDate.at(0)}
            </p>
          )}
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor={`end-${productId}`}>
            To
          </label>
          <Input
            id={`end-${productId}`}
            type="date"
            required
            aria-invalid={Boolean(fieldErrors.endDate)}
            value={values.endDate}
            onChange={(event) => set("endDate", event.target.value)}
          />
          {fieldErrors.endDate && (
            <p className="text-sm text-destructive">
              {fieldErrors.endDate.at(0)}
            </p>
          )}
        </div>
      </div>

      {shortfall && (
        <p className="text-sm text-warning">
          These dates are {shortfall}. You can still ask, and Island Media Co
          will tell you what they can do.
        </p>
      )}

      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor={`budget-${productId}`}>
          Indicative budget
        </label>
        <Input
          id={`budget-${productId}`}
          type="number"
          min={0}
          required
          inputMode="numeric"
          placeholder="GBP for the whole campaign"
          aria-invalid={Boolean(fieldErrors.budget)}
          value={values.budget}
          onChange={(event) => set("budget", event.target.value)}
        />
        {fieldErrors.budget && (
          <p className="text-sm text-destructive">{fieldErrors.budget.at(0)}</p>
        )}
      </div>

      <div className="grid gap-1.5">
        <label
          className="text-sm font-medium"
          htmlFor={`objective-${productId}`}
        >
          What should this campaign do?
        </label>
        <Input
          id={`objective-${productId}`}
          required
          aria-invalid={Boolean(fieldErrors.objective)}
          value={values.objective}
          onChange={(event) => set("objective", event.target.value)}
        />
        {fieldErrors.objective && (
          <p className="text-sm text-destructive">
            {fieldErrors.objective.at(0)}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <label className="text-sm font-medium" htmlFor={`notes-${productId}`}>
          Anything else (optional)
        </label>
        <textarea
          id={`notes-${productId}`}
          rows={2}
          value={values.notes}
          onChange={(event) => set("notes", event.target.value)}
          className="w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending" : "Send request"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Nothing is reserved until Island Media Co issues a contract.
        </p>
      </div>

      {sent && !message && (
        <p className="rounded-lg border border-success/30 bg-success-surface px-4 py-3 text-sm text-success">
          Request sent. Island Media Co will review it and come back to you. You
          can follow it on your portal home.
        </p>
      )}

      {message && (
        <p className="rounded-lg border border-destructive/30 bg-destructive-surface px-4 py-3 text-sm text-destructive">
          {message}
        </p>
      )}
    </form>
  );
};
