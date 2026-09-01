"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const SignOutButton = () => {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    await fetch("/api/session/switch", { method: "DELETE" }).catch(() => null);
    setPending(false);
    router.refresh();
  };

  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={signOut}>
      {pending ? "Signing out" : "Sign out and browse as a visitor"}
    </Button>
  );
};
