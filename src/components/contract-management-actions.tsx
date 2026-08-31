"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type ManagementContractAction,
  managementActionAllowed,
} from "@/domain/contracts";

const LABEL: Record<ManagementContractAction, string> = {
  re_issue: "Re-issue to the client",
  cancel: "Cancel contract",
  complete: "Mark complete",
};

const PENDING: Record<ManagementContractAction, string> = {
  re_issue: "Re-issuing",
  cancel: "Cancelling",
  complete: "Completing",
};

const ORDER = ["re_issue", "complete", "cancel"] as const;

export const ContractManagementActions = ({
  contractId,
  status,
}: {
  contractId: string;
  status: string;
}) => {
  const router = useRouter();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<ManagementContractAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const available = ORDER.filter((action) =>
    managementActionAllowed(status, action),
  );

  if (available.length === 0) return null;

  const send = async (action: ManagementContractAction) => {
    setPending(action);
    setError(null);

    const response = await fetch(
      `/api/management/contracts/${contractId}/actions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ action, note: note.trim() || null }),
      },
    ).catch(() => null);

    setPending(null);

    if (response?.ok) {
      setIdempotencyKey(crypto.randomUUID());
      setNote("");
      router.refresh();
      return;
    }

    const body = await response?.json().catch(() => null);

    setError(body?.message ?? "That did not send. Nothing has been changed.");
  };

  return (
    <section className="rounded-lg border bg-card p-5 shadow-xs">
      <h2 className="font-semibold">Move this contract on</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Re-issuing raises the version and puts the contract back in front of the
        client. Cancelling releases the booked inventory.
      </p>

      <div className="mt-4 grid gap-2">
        <label className="text-sm font-medium" htmlFor="managementNote">
          Note
        </label>
        <textarea
          id="managementNote"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Recorded on the contract history and the client's request."
          className="w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {available.map((action) => (
          <Button
            key={action}
            variant={action === "cancel" ? "destructive" : "default"}
            disabled={pending !== null}
            onClick={() => send(action)}
          >
            {pending === action ? PENDING[action] : LABEL[action]}
          </Button>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive-surface px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
};
