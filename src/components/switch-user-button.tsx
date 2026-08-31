"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  userId: string;
  href: string;
  label: string;
  detail: string;
};

export const SwitchUserButton = ({ userId, href, label, detail }: Props) => {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "pending" | "failed">("idle");

  const enter = async () => {
    setState("pending");

    const response = await fetch("/api/session/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => null);

    if (!response?.ok) {
      setState("failed");
      return;
    }

    router.push(href);
    router.refresh();
  };

  return (
    <div>
      <Button
        variant="outline"
        className="h-auto w-full justify-start gap-3 px-3 py-2.5 text-left"
        disabled={state === "pending"}
        onClick={enter}
      >
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{label}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">
            {detail}
          </span>
        </span>
      </Button>
      {state === "failed" && (
        <p className="mt-1.5 text-xs text-destructive">
          Could not switch user. Check the server is running, then try again.
        </p>
      )}
    </div>
  );
};
