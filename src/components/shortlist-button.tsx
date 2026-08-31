"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  productId: string;
  startDate: string;
  endDate: string;
  shortlisted: boolean;
  size?: "default" | "sm";
};

export const ShortlistButton = ({
  productId,
  startDate,
  endDate,
  shortlisted,
  size = "default",
}: Props) => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setPending(true);
    setError(null);

    const response = await (shortlisted
      ? fetch(`/api/client/shortlist/${productId}`, { method: "DELETE" })
      : fetch("/api/client/shortlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, startDate, endDate }),
        })
    ).catch(() => null);

    setPending(false);

    if (response?.ok) {
      router.refresh();
      return;
    }

    const body = await response?.json().catch(() => null);

    setError(
      body?.message ?? "That did not save. Your shortlist is unchanged.",
    );
  };

  return (
    <div className="space-y-2">
      <Button
        size={size}
        variant={shortlisted ? "outline" : "default"}
        disabled={pending}
        onClick={send}
      >
        {pending
          ? "Saving"
          : shortlisted
            ? "Remove from shortlist"
            : "Add to shortlist"}
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
};
