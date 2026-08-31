import Link from "next/link";
import type { ReactNode } from "react";
import { sessionUser } from "@/lib/session";

export default async function MobileLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await sessionUser();

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-card/90 px-5 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="font-mono text-xs tracking-wide text-muted-foreground uppercase"
          >
            Island Media Co
          </Link>
          <span className="text-sm font-medium">
            {user?.role === "fitter" ? user.name : "Not a fitter"}
          </span>
        </div>
      </header>

      <main className="flex-1 px-5 py-6">{children}</main>
    </div>
  );
}
