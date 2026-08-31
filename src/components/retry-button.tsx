"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export const RetryButton = () => {
  const router = useRouter();

  return (
    <Button variant="outline" size="sm" onClick={() => router.refresh()}>
      Try again
    </Button>
  );
};
