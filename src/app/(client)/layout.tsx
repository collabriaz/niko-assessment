import Link from "next/link";
import type { ReactNode } from "react";
import { sessionUser } from "@/lib/session";

const CLIENT_LINKS = [
  { href: "/portal", label: "Overview" },
  { href: "/catalogue", label: "Catalogue" },
  { href: "/shortlist", label: "Shortlist" },
  { href: "/contracts", label: "Contracts" },
] as const;

export default async function ClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await sessionUser();
  const signedIn = user?.role === "client";
  const links = signedIn
    ? CLIENT_LINKS
    : CLIENT_LINKS.filter((link) => link.href === "/catalogue");

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-card/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-6 py-3">
          <Link
            href="/"
            className="font-mono text-xs tracking-wide text-muted-foreground uppercase"
          >
            Island Media Co
          </Link>

          <nav className="flex items-center gap-4 text-sm">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto text-sm">
            {signedIn ? (
              <span className="text-muted-foreground">
                Signed in as{" "}
                <span className="font-medium text-foreground">{user.name}</span>
              </span>
            ) : (
              <Link
                href="/register"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Create an account
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {children}
      </div>
    </>
  );
}
