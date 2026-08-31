import { Building2, HardHat, Store } from "lucide-react";
import Link from "next/link";
import { SwitchUserButton } from "@/components/switch-user-button";
import { listPrototypeUsers } from "@/data/users";
import { fixtureClock } from "@/domain/fixtures";

const SURFACES = {
  manager: {
    href: "/manage/requests",
    title: "Management",
    icon: Building2,
    blurb:
      "Attention-led dashboard, booking requests, contracts, work orders and service history.",
  },
  client: {
    href: "/portal",
    title: "Client portal",
    icon: Store,
    blurb:
      "Catalogue and date-based discovery, shortlist, contracts, and the service timeline.",
  },
  fitter: {
    href: "/jobs",
    title: "Fitter app",
    icon: HardHat,
    blurb:
      "Phone-first job list, progress updates, blocked reasons and proof of completion.",
  },
} as const;

const ORDER = ["manager", "client", "fitter"] as const;

export default async function Home() {
  const users = await listPrototypeUsers();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        Island Media Co
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance">
        Out-of-home advertising, run from one operating model.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground text-pretty">
        Three surfaces over the same data. Pick a seeded account to enter, or
        sign up as a new client with no contract.
      </p>

      <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-info-surface px-3 py-1.5 text-sm text-info">
        <span className="font-medium">Prototype clock</span>
        <span className="font-mono text-xs">
          {fixtureClock.toISOString().replace(".000Z", "Z")}
        </span>
      </p>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {ORDER.map((role) => {
          const surface = SURFACES[role];
          const Icon = surface.icon;
          const people = users.filter((user) => user.role === role);

          return (
            <section
              key={role}
              className="flex flex-col rounded-lg border bg-card p-5 shadow-xs"
            >
              <Icon className="size-5 text-primary" />
              <h2 className="mt-3 font-semibold">{surface.title}</h2>
              <p className="mt-1.5 flex-1 text-sm text-muted-foreground text-pretty">
                {surface.blurb}
              </p>

              <div className="mt-5 space-y-2">
                {people.map((user) => (
                  <SwitchUserButton
                    key={user.id}
                    userId={user.id}
                    href={surface.href}
                    label={user.name}
                    detail={user.organisation?.name ?? "Island Media Co staff"}
                  />
                ))}
              </div>

              {role === "client" && (
                <Link
                  href="/register"
                  className="mt-3 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  Sign up as a new client
                </Link>
              )}
            </section>
          );
        })}
      </div>

      <p className="mt-12 max-w-2xl text-sm text-muted-foreground">
        Accounts are a prototype seam, not authentication. Switching sets a
        cookie holding the selected user id. Production identity, tenant
        isolation and record-level authorisation are covered in the
        productionisation note.
      </p>
    </main>
  );
}
