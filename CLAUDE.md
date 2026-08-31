@AGENTS.md

# CLAUDE.md

Guidance for Claude Code in this repository.

## What this is

A **Frameworks technical assessment**: one connected prototype for the fictional "Island
Media Co" out-of-home advertising agency, with three surfaces over a single operating model.

The brief is `assessment_files/ASSESSMENT.md` and it is **authoritative**. Where
`assessment_files/README.md` disagrees with it, the assessment wins. Never edit anything under
`assessment_files/` - it is the reviewer's pack and stays byte-for-byte as issued.

Delivery window is 2 to 3 calendar days. There is a 50-minute live review where the
accountable candidate runs the app, traces one state change end to end, and makes a small
bounded change on the spot. **Nothing goes in that cannot be explained live.**

## Non-negotiable rules from the brief

- **The fixture clock is `2027-01-15T09:00:00Z`.** Never call `Date.now()` or `new Date()`
  for business logic. The clock is injected as a `now: Date` argument everywhere.
- **Date intervals are half-open `[startDate, endDate)`.** Overlap is
  `aStart < bEnd && bStart < aEnd`. Never `<=`.
- **Holds expire by timestamp, not by status field.** `hold-002` is `status: "active"` and
  already expired. The rule is `expiresAt > now`.
- **Capacity is strictly `used < capacity`.** 4 of 4 is unavailable.
- Fixture records keep their **original IDs and meaning**. Inconvenient records are
  deliberate; do not clean, delete or renumber them.
- **Org scoping lives in the data layer**, never per-route. A client of org A must not reach
  org B's contract through any endpoint, list or detail.
- **No optimistic UI.** The portal must never imply a request, cancellation or change is
  approved before management changes the underlying state.
- A client action **must not silently rewrite an issued contract**. `request_changes` records
  a request and moves status to `change_requested`; items, dates and totals are untouched.
- Money is GBP. `monthlyEquivalent: null` renders as "Price on request", never 0, and never
  passes a budget filter. Display each product's native rate label; `monthlyEquivalent` is
  filter-only.
- Timezone assumption is Europe/Jersey and it is stated in the README.

## Stack

Next.js 16 + React 19 (App Router), TypeScript, Tailwind v4, Prisma + Neon Postgres,
Vitest, Biome. Deployed to Vercel.

**Next 16 is not the Next.js in your training data.** Read the relevant guide in
`node_modules/next/dist/docs/01-app/` before writing route handlers, `params`/`searchParams`
handling, or anything caching-related. Do not write these from memory.

## Structure

```
src/
  app/
    (management)/       desktop web - dashboard, requests, contracts, work orders
    (client)/           client portal - catalogue, shortlist, contracts, timeline
    (mobile)/           fitter app - phone-first shell, job list, job detail
    api/**/route.ts     the OpenAPI surface (20 endpoints, incl. /api/dev/reset)
  domain/               pure TypeScript. availability, contracts, work orders.
  data/                 Prisma access. the ONLY place org scoping lives.
  components/           shared UI + the three surface shells
prisma/                 schema.prisma, migrations, seed.ts (reads the fixtures)
assessment_files/       the reviewer's pack. read-only.
```

**The graded boundary is internal, not network.** `src/domain/` imports nothing from Next,
React or Prisma, does no I/O, and takes `now: Date` as an argument. That is what makes the
required tests run in milliseconds and what gets traced in the live review.

**Read path:** Server Components read through `src/data/` directly. **Write path:** every
mutation goes through `src/app/api/**/route.ts`, which is where `Idempotency-Key`, role
checks and the 403/409/422/503 responses live. Refresh with `router.refresh()`.
No TanStack Query - it has nothing to do here.

**Route handlers are thin:** parse, authorise, delegate to domain/data, map errors to status
codes. No business logic in a route handler, no HTTP objects in the domain layer.

## Auth

Faked per the brief: `X-Prototype-User-Id` header plus a role switcher. Roles are `manager`,
`fitter`, `client`. This is a prototype seam, not real auth - it is documented as such in the
README and the productionisation note, and it is never presented as security.

Field-level permissions are real even though auth is fake:
`workOrder.internalNotes` is visible to the assigned fitter and managers only, and clients see
`serviceEvent.clientSummary` where `clientVisible` is true, never the raw record.

## Idempotency

`Idempotency-Key` is required on register, booking-request, contract create/issue, work-order
create, status update and proof upload. Same key returns the existing record; a new key
creates. Store the key with the created record and check it inside the write transaction -
a fitter tapping "complete" twice on weak signal must produce one proof record, not two.

## Package management

Single app, no workspace. Run `pnpm` from the repo root.

**Never hand-edit `package.json` to add a dependency.** Use `pnpm add <pkg>` /
`pnpm add -D <pkg>` so versions resolve and the lockfile stays in sync.

## Commands

```bash
pnpm dev              # Next dev server
pnpm build            # production build
pnpm lint             # Biome check
pnpm check:fix        # Biome with unsafe fixes (preferred)
pnpm test             # Vitest
pnpm db:push          # apply schema to the database
pnpm db:seed          # load assessment_files/fixtures into the database
pnpm db:reset         # drop, re-push, re-seed
```

Keep this list and the README in sync with reality. `pnpm verify` is the umbrella gate:
typecheck, then tests, then build.

## Testing

Vitest. Tests sit next to source (`availability.test.ts`).

The brief's §9 requires ten checks and they are the priority over any other coverage:
overlapping exclusive bookings, expired vs active holds, capacity-pool availability,
duplicate idempotency key, a no-contract client using the catalogue, contract issue and
accept/change-request, blocked needs a reason, completion needs proof and writes service
history, org A cannot read org B's contract, and one connected UI journey.

Write the availability probes first, before any UI exists. Two of them discriminate correct
logic from the usual bugs:

- `pool-hub-screen`, 2027-02-01 to 2027-02-20 - correct is **3 of 4 used, available**.
  Closed intervals or a counted expired hold both give 4 of 4.
- `product-bus-rear`, 2027-03-01 to 2027-03-05 - correct is **2 free assets**.
  Closed intervals give 0.

## Simplicity First (MANDATORY)

The brief penalises this directly: "We do not reward feature count, gratuitous AI or
unnecessary infrastructure." Initiative only scores after the mandatory scenarios work.

- **Readability over cleverness** - straight-line logic beats nested abstractions
- **Explicit over abstract** - one function per purpose, not generic reusable utilities
- **Duplication over premature reuse** - promote only when logic appears in 3+ places
- **Working over "perfect architecture"** - no design patterns unless required

Prohibited: premature abstractions, generic utilities used fewer than 3 times, "helper" layers
that hide simple logic, design patterns nobody asked for, generics for hypothetical flexibility.

Also prohibited *because the brief excludes them*: real auth providers, payments,
notifications, maps, object storage, offline sync engines, Docker, and unrestricted CRUD for
every entity. Proof files are base64 in the database with a size cap.

**Decision rule:** if several implementations are possible, choose the one that is easiest to
read in 10 seconds and has the fewest moving parts.

## Coding rules

- **Laconic code** - concise expressions, no unnecessary intermediate variables
- **No comments.** See the section below. The default is zero.
- **No em dashes** in code, comments, docs or commit messages
- **`type` over `interface`** - consistent with `z.infer<>`
- **No `any`** - `unknown` for truly unknown values. If you touch a file with `any`, fix it.
- **Early returns** over `if/else` chains
- **No magic numbers or strings** - name them, or derive from the fixtures
- **Named exports only**, except where Next requires a default (pages, layouts, route handlers)
- **`as const` over `enum`** - derive union types via `typeof obj[keyof typeof obj]`
- **No `console.log`** in shipped code
- **Sorted Tailwind classes**

## Comments

**Never add a useless comment. The default is no comment at all.** Dense comment cover is the
clearest tell of AI-generated code, and this submission is read by a human who is judging
whether the candidate wrote it.

Delete on sight:

- anything that restates the code, the function name, or the test name
- section dividers, banner blocks, step-by-step narration (`// filter the assets`)
- JSDoc that repeats the signature
- `// TODO` left behind instead of doing the work or opening an issue
- a comment explaining a name that should have been better

A comment earns its place only when it records something the code physically cannot: a rule
taken from `assessment_files/ASSESSMENT.md`, a fixture record that behaves counterintuitively,
a boundary that looks like an off-by-one but is not, or a workaround with its reason.

If a comment feels needed, first try a better name, a named constant, or a smaller function.
Reach for the comment only when that fails. When in doubt, leave it out.

## TypeScript

- No `any`. No `as Type` unless a third-party type is genuinely wrong.
- No non-null assertions (`!`) - use `?.`, `??`, or an early return.
- Let TypeScript infer. Annotate at module boundaries only.
- Narrow errors in catch: errors are `unknown`, so `if (e instanceof Error)`. Never `catch (e: any)`.
- **Discriminated unions over optional fields** - availability results, work-order status and
  contract status are all state machines and are modelled as unions, not flags.

## Validation (Zod)

- Schemas live in `src/domain/schemas.ts` or beside the route that owns them, never inline in
  a component
- `z.uuid()` and `z.email()`, never `z.string().uuid()` / `.email()`
- Nullable DB fields use `.nullish()`, not `.optional()` - Prisma returns `null`
- `z.enum([...] as const)`, never a TypeScript `enum`
- Export the schema and its inferred type together
- Every route handler validates its body and returns 422 with the brief's error shape on failure

## Next.js / React

- **Server Components by default.** `'use client'` only for browser APIs, event handlers or hooks.
- Forms use React Hook Form + Zod. No manual validation.
- **No pass-through state** - if only one child needs data, that child fetches it.
- shadcn/Radix for UI primitives. Do not hand-build a dialog, select or toast.
- One design-token file shared by all three surfaces. §10.8 grades a consistent visual style;
  §5 and §11 say do **not** build a brand pack or illustration set.

## Feature execution protocol

**Step 1 - Understand.** Which surface, which endpoints, which tables, which fixture records
prove it, and which of the ten required checks it satisfies.

**Step 2 - Plan. Do not code yet.** Output files to create or change, the data flow from
request to response, the edge cases, and the fixture record used to demonstrate it. Wait for
confirmation.

**Step 3 - Implement incrementally.** Small steps, not the whole feature. Layer order:
`route handler -> domain -> data -> Prisma`.

**Step 4 - Manual test instructions.** After each step: the curl or click path, the expected
response, and the expected state change in the other two surfaces.

**Step 5 - Commit message** in the format below.

## AI-use log

§10.7 requires the real prompts, one AI-generated mistake caught and corrected with the check
that proved the fix, and an honest active-vs-unattended time split. Misleading time reporting
is an integrity failure that can override the whole score.

Append to `AI-LOG.md` as work happens - a corrected mistake, the check that proved it, and
rough active time. It cannot be reconstructed honestly at the end.

## Forbidden

- Never edit anything under `assessment_files/`
- Never run long-running commands (`pnpm dev`, `pnpm start`) - print the command for the user
- Never assume the Prisma schema - read `prisma/schema.prisma`
- Never mix layers: no DB calls in route handlers, no HTTP objects in the domain layer
- Never scope by org inside a route handler - it belongs in `src/data/`
- Never commit secrets. `.env*` stays ignored.
- Never change code outside the assigned task. Report the problem at the end instead.
- Never claim a check passed without running it

## Commit format

```
<type>: <subject>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

No AI attribution in commit messages.
