import Link from "next/link";
import type { ReactNode } from "react";
import { sessionUser } from "@/lib/session";

const MANAGEMENT_LINKS = [
  { href: "/manage/dashboard", label: "Dashboard" },
  { href: "/manage/requests", label: "Requests" },
  { href: "/manage/contracts", label: "Contracts" },
  { href: "/manage/work-orders", label: "Field work" },
];

export default async function ManagementLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await sessionUser();

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-card/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <Link
            href="/"
            className="font-mono text-xs tracking-wide text-muted-foreground uppercase"
          >
            Island Media Co
          </Link>

          <nav className="flex items-center gap-4 text-sm">
            {MANAGEMENT_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4 text-sm">
            {user?.role === "manager" ? (
              <span className="text-muted-foreground">
                Signed in as{" "}
                <span className="font-medium text-foreground">{user.name}</span>
              </span>
            ) : (
              <span className="text-warning">Not signed in as a manager</span>
            )}
            <Link
              href="/"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Switch role
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
        {children}
      </div>
    </>
  );
}
