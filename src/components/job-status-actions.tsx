"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  nextStatuses,
  statusBlockers,
  type WorkOrderStatus,
} from "@/domain/work-orders";
import { humanise } from "@/lib/format";

const ACTION_LABEL: Record<string, string> = {
  travelling: "On my way",
  on_site: "I am on site",
  blocked: "Report a blocker",
  completed: "Complete job",
};

export const JobStatusActions = ({
  workOrderId,
  status,
  proofCount,
}: {
  workOrderId: string;
  status: string;
  proofCount: number;
}) => {
  const router = useRouter();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<WorkOrderStatus | null>(null);
  const [failed, setFailed] = useState<WorkOrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);

    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const send = async (next: WorkOrderStatus) => {
    const missing = statusBlockers(next, note, proofCount);

    if (missing.length > 0) {
      setError(`This update needs ${missing.join(" and ")}.`);
      return;
    }

    setPending(next);
    setError(null);

    const response = await fetch(
      `/api/mobile/work-orders/${workOrderId}/status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ status: next, note: note.trim() || null }),
      },
    ).catch(() => null);

    setPending(null);

    if (response?.ok) {
      setIdempotencyKey(crypto.randomUUID());
      setNote("");
      setFailed(null);
      router.refresh();
      return;
    }

    const body = await response?.json().catch(() => null);

    setFailed(next);
    setError(
      body?.message ??
        "That did not send. Your job has not been changed. Try again when you have signal.",
    );
  };

  const options = nextStatuses(status);

  if (options.length === 0)
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        This job is finished. Nothing else to do here.
      </p>
    );

  const needsNote = options.some(
    (option) => statusBlockers(option, null, proofCount).length > 0,
  );

  return (
    <section className="space-y-4">
      {!online && (
        <p className="rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning">
          You are offline. Updates are not queued, so send this again once you
          have signal.
        </p>
      )}

      {needsNote && (
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="note">
            Note
          </label>
          <textarea
            id="note"
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Required to report a blocker or complete the job."
            className="w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      )}

      <div className="grid gap-3">
        {options.map((option) => (
          <Button
            key={option}
            size="lg"
            variant={option === "blocked" ? "outline" : "default"}
            disabled={pending !== null || !online}
            onClick={() => send(option)}
          >
            {pending === option
              ? "Sending"
              : failed === option
                ? `Try again - ${ACTION_LABEL[option] ?? humanise(option)}`
                : (ACTION_LABEL[option] ?? humanise(option))}
          </Button>
        ))}
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive-surface px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
};
