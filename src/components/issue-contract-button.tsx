"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const IssueContractButton = ({ contractId }: { contractId: string }) => {
  const router = useRouter();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setPending(true);
    setError(null);

    const response = await fetch(
      `/api/management/contracts/${contractId}/issue`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
      },
    ).catch(() => null);

    setPending(false);

    if (response?.ok) {
      setIdempotencyKey(crypto.randomUUID());
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
    <div>
      <Button disabled={pending} onClick={send}>
        {pending ? "Issuing" : "Issue to client"}
      </Button>
      <p className="mt-2 text-sm text-muted-foreground">
        Issuing makes the contract visible in the client portal and asks them to
        accept or request changes.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive-surface px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};
