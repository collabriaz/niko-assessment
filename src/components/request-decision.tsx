"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  decisionNeedsNote,
  type ManagementDecision,
} from "@/domain/booking-requests";

const PENDING_LABEL: Record<ManagementDecision, string> = {
  approve: "Approving",
  request_information: "Sending",
  decline: "Declining",
};

const ACTION_LABEL: Record<ManagementDecision, string> = {
  approve: "Approve",
  request_information: "Ask for information",
  decline: "Decline",
};

export const RequestDecision = ({ requestId }: { requestId: string }) => {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<ManagementDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (action: ManagementDecision) => {
    if (decisionNeedsNote(action) && note.trim().length < 3) {
      setError("Give the client a reason before sending this decision.");
      return;
    }

    setPending(action);
    setError(null);

    const response = await fetch(
      `/api/management/booking-requests/${requestId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note.trim() || null }),
      },
    ).catch(() => null);

    setPending(null);

    if (response?.ok) {
      setNote("");
      router.refresh();
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
      <h2 className="font-semibold">Decide this request</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Approving rechecks the inventory for these dates before anything is
        recorded. A decision is written to the request history with your name
        against it.
      </p>

      <div className="mt-5 grid gap-2">
        <label className="text-sm font-medium" htmlFor="note">
          Note to the client
        </label>
        <textarea
          id="note"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Required when asking for information or declining."
          className="w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Button disabled={pending !== null} onClick={() => send("approve")}>
          {pending === "approve" ? PENDING_LABEL.approve : ACTION_LABEL.approve}
        </Button>
        <Button
          variant="outline"
          disabled={pending !== null}
          onClick={() => send("request_information")}
        >
          {pending === "request_information"
            ? PENDING_LABEL.request_information
            : ACTION_LABEL.request_information}
        </Button>
        <Button
          variant="ghost"
          disabled={pending !== null}
          onClick={() => send("decline")}
        >
          {pending === "decline" ? PENDING_LABEL.decline : ACTION_LABEL.decline}
        </Button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive-surface px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
};
