"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const MAX_PROOF_BYTES = 2_000_000;

export const ProofCapture = ({ workOrderId }: { workOrderId: string }) => {
  const router = useRouter();
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID(),
  );
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const submit = async () => {
    if (!file) {
      setError("Take or choose a photo of the finished work.");
      return;
    }

    if (file.size > MAX_PROOF_BYTES) {
      setError("That image is larger than the 2 MB prototype cap.");
      return;
    }

    setPending(true);
    setError(null);

    const form = new FormData();
    form.set("file", file);
    form.set("completionNote", note);

    const response = await fetch(
      `/api/mobile/work-orders/${workOrderId}/proof`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: form,
      },
    ).catch(() => null);

    setPending(false);

    if (response?.ok) {
      setIdempotencyKey(crypto.randomUUID());
      setFile(null);
      setNote("");
      setFailed(false);
      router.refresh();
      return;
    }

    const body = await response?.json().catch(() => null);

    setFailed(true);
    setError(
      body?.message ??
        "The upload did not go through. Nothing was saved. Try again when you have signal.",
    );
  };

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4 shadow-xs">
      <div>
        <h2 className="font-semibold">Proof of completion</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A photo and a note are needed before this job can be completed.
        </p>
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="proof">
          Photo
        </label>
        <input
          id="proof"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-sm shadow-xs file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-sm"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="completionNote">
          What you did
        </label>
        <textarea
          id="completionNote"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          className="w-full rounded-md border border-input bg-transparent px-2.5 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <Button
        size="lg"
        className="w-full"
        variant="outline"
        disabled={pending}
        onClick={submit}
      >
        {pending ? "Uploading" : failed ? "Try the upload again" : "Add proof"}
      </Button>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive-surface px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  );
};
