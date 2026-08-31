"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ClientAction } from "@/domain/contracts";

const PENDING_LABEL: Record<ClientAction, string> = {
  accept: "Accepting",
  request_changes: "Sending",
  request_cancellation: "Sending",
};

export const ContractActions = ({
  contractId,
  canAccept,
  canRequestChanges,
}: {
  contractId: string;
  canAccept: boolean;
  canRequestChanges: boolean;
}) => {
  const router = useRouter();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<ClientAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (action: ClientAction) => {
    setPending(action);
    setError(null);

    const response = await fetch(
      `/api/client/contracts/${contractId}/actions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ action, note: note.trim() || null }),
      },
    ).catch(() => null);

    if (response?.ok) {
      setIdempotencyKey(crypto.randomUUID());
      setNote("");
      setPending(null);
      router.refresh();
      return;
    }

    const body = await response?.json().catch(() => null);
    setPending(null);
    setError(
      body?.message ??
        "Could not reach Island Media Co. Nothing has been changed.",
    );
  };

  return (
    <section className="rounded-lg border bg-card p-5 shadow-xs">
      <h2 className="font-semibold">Respond to this contract</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {canAccept
          ? "Accepting confirms the inventory for your dates. A change or cancellation request is reviewed by Island Media Co before anything on the contract moves."
          : "Your change request is with Island Media Co. Nothing on this contract moves until they respond."}
      </p>

      {canAccept && (
        <Button
          className="mt-5"
          disabled={pending !== null}
          onClick={() => send("accept")}
        >
          {pending === "accept" ? PENDING_LABEL.accept : "Accept contract"}
        </Button>
      )}

      <div className="mt-6 grid gap-2">
        <label className="text-sm font-medium" htmlFor="note">
          Note to Island Media Co
        </label>
        <textarea
          id="note"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What would you like changed?"
          className="w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <div className="flex flex-wrap gap-3">
          {canRequestChanges && (
            <Button
              variant="outline"
              disabled={pending !== null}
              onClick={() => send("request_changes")}
            >
              {pending === "request_changes"
                ? PENDING_LABEL.request_changes
                : "Request changes"}
            </Button>
          )}
          <Button
            variant="ghost"
            disabled={pending !== null}
            onClick={() => send("request_cancellation")}
          >
            {pending === "request_cancellation"
              ? PENDING_LABEL.request_cancellation
              : "Request cancellation"}
          </Button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive-surface px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
};
