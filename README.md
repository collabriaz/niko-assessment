# Island Media Co

A connected operating model for an out-of-home advertising agency, with three surfaces over
one set of data: a management web interface, a client portal, and a mobile-first fitter app.

Built as a technical assessment. The names, rates, assets, dates and organisations are
fictional and come from the supplied fixture pack.

Deployed preview: <https://niko-assessment.vercel.app>

The preview runs the seeded fixture pack. Pick any account from the landing page to enter a
surface; no password is involved.

## Setup

Requires Node 20 or newer, pnpm, and a Postgres database. The prototype was developed against
Neon.

```bash
pnpm install
cp .env.example .env.local     # then set DATABASE_URL
pnpm db:reset                  # push the schema and load the fixtures
pnpm dev
```

`DATABASE_URL` is the only environment variable. No secrets are committed and `.env*` is
ignored.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Development server on port 3000 |
| `pnpm build` | Production build |
| `pnpm test` | The full suite, unit and integration |
| `pnpm test:unit` | Domain tests only, no database needed |
| `pnpm typecheck` | Prisma generate, Next typegen, then `tsc --noEmit` |
| `pnpm lint` | Biome |
| `pnpm verify` | Typecheck, then tests, then build |
| `pnpm db:seed` | Load the fixtures |
| `pnpm db:reset` | Drop, re-push and re-seed |

`POST /api/dev/reset` re-seeds a running deployment without a shell.

## Signing in

Authentication is faked. The landing page lists every seeded account and switching sets a
cookie holding the chosen user id; API routes also accept an `X-Prototype-User-Id` header.

| Account | Role | Why it is interesting |
| --- | --- | --- |
| Morgan Reed | Manager | Sees every organisation |
| Casey Morgan | Fitter | Has the seeded scheduled job |
| Avery Stone | Client, Silverline Fitness | No contracts, one open request |
| Jordan Ellis | Client, Lighthouse Learning | An issued contract awaiting a response |
| Taylor Quinn | Client, Oak Legal | An active contract and a pending change request |

New client registration works and persists. A registered account starts with no contract and
can use the catalogue, shortlist and request flow immediately.

## The three surfaces

| Surface | Routes | For |
| --- | --- | --- |
| Management | `/manage/dashboard`, `/manage/requests`, `/manage/contracts`, `/manage/work-orders`, `/manage/clients/[id]` | Desktop, attention led |
| Client portal | `/portal`, `/catalogue`, `/shortlist`, `/contracts`, `/register` | Responsive web |
| Fitter app | `/jobs`, `/jobs/[id]` | Phone viewport |

All three share one design token file in `src/app/globals.css`.

## Architecture

```
src/
  app/(management)/   desktop management surface
  app/(client)/       client portal
  app/(mobile)/       fitter app
  app/api/**/route.ts the HTTP surface
  domain/             pure TypeScript, no I/O
  data/               Prisma access, the only place org scoping lives
  components/         shared UI
prisma/               schema, seed
```

The boundary that matters is internal rather than network. `src/domain/` imports nothing from
Next, React or Prisma, does no I/O, and takes the clock as a `now: Date` argument. Availability,
the contract rules and the work-order state machine live there, which is why those tests run in
milliseconds against the fixture file and need no database.

**Reads** go from Server Components through `src/data/` directly. **Writes** always go through
a route handler, which is where `Idempotency-Key`, role checks and the 403, 409, 422 and 503
responses live. Client components post and then call `router.refresh()`, so the server is the
only thing that decides what is true. There is no optimistic UI anywhere.

Route handlers stay thin: parse, authorise, delegate, map errors to status codes. No business
logic in a handler, no HTTP objects in the domain layer, no organisation scoping outside
`src/data/`.

### Rules that shaped the code

- The clock is the fixture clock, `2027-01-15T09:00:00Z`. Business logic never calls
  `Date.now()`.
- Date ranges are half-open, `[startDate, endDate)`. Overlap is `aStart < bEnd && bStart < aEnd`.
  A booking that ends on the day a query starts does not block it.
- Holds block by timestamp, not status. `hold-002` is `status: "active"` and already expired,
  so it blocks nothing.
- Pool capacity is strictly `used < capacity`. Four of four is unavailable.
- `monthlyEquivalent` is used only by the budget filter. Each product displays its own native
  rate label, and a null price renders as "Price on request" and never passes a budget filter.
- A client action never rewrites an issued contract. `request_changes` records a request and
  moves the status; items, dates and totals are untouched.
- Field-level visibility is real even though auth is not. `workOrder.internalNotes` reaches
  managers and the assigned fitter only, and clients see `serviceEvent.clientSummary` rather
  than the record behind it.

## Tests

```bash
pnpm test        # 179 tests, 20 files
pnpm test:unit   # domain only, no database
```

Unit tests cover `src/domain/`. Integration tests call route handlers and data functions
against a real Postgres database, because organisation scoping and idempotency are only
meaningful against the real query.

The brief's ten required checks:

| # | Check | Where |
| --- | --- | --- |
| 1 | Overlapping exclusive bookings | `src/domain/availability.test.ts` |
| 2 | Expired versus active holds | `src/domain/availability.test.ts` |
| 3 | Capacity-pool availability | `src/domain/availability.test.ts` |
| 4 | Duplicate idempotency key | `src/app/api/booking-requests/route.test.ts` |
| 5 | No-contract client uses the catalogue | `src/app/api/auth/register/route.test.ts` |
| 6 | Contract issue, accept and change request | `.../contracts/[contractId]/issue/route.test.ts`, `.../client/contracts/[contractId]/actions/route.test.ts` |
| 7 | Blocked needs a reason | `.../mobile/work-orders/[workOrderId]/status/route.test.ts` |
| 8 | Completion needs proof and writes service history | `.../mobile/work-orders/[workOrderId]/status/route.test.ts` |
| 9 | Organisation A cannot read organisation B's contract | `.../client/contracts/[contractId]/route.test.ts`, `src/data/contracts.test.ts` |
| 10 | One connected journey | `src/app/api/booking-requests/route.test.ts`, plus the manual walkthrough below |

Two availability probes discriminate correct logic from the usual bugs. `product-hub-screen`
over 2027-02-01 to 2027-02-20 is 3 of 4 used and available; a closed interval or a counted
expired hold both give 4 of 4. `product-bus-rear` over 2027-03-01 to 2027-03-05 leaves 2 free
assets; a closed interval gives 0.

### The connected journey, by hand

Check 10 is an API-level test rather than a browser test, so the user interface itself is
verified by walking it. No browser automation is installed, and this is stated rather than
claimed as automated coverage.

1. Sign in as Avery Stone, who has no contracts.
2. In the catalogue, set 2027-03-01 to 2027-03-05, open Bus rear panel, add it to the
   shortlist. Two of its three assets are free for those dates.
3. On the shortlist, open "Request these dates" and send the request.
4. The portal home shows it as submitted, and says nothing is reserved.
5. Switch to Morgan Reed. The dashboard raises it, and the detail page recalculates
   availability at the manager's read rather than replaying what the client saw.
6. Approve it, allocating one of the free assets, then draft a contract and issue it.
7. Switch back to Avery Stone and accept. The campaign activates and the inventory is booked.
8. As Morgan Reed, create an installation work order for the campaign.
9. Switch to Casey Morgan on a phone viewport, move the job through to completion with a note
   and a photo.
10. The client's contract page now shows the service event and the proof.

## Assumptions

- **Timezone is Europe/Jersey.** Calendar dates are compared as `YYYY-MM-DD` strings so no
  local conversion can shift a day. Timestamps are stored and rendered in UTC.
- **Stale verification is older than 30 days**, which makes a product `confirmation_required`
  rather than unavailable. The brief supplies stale records but no threshold. Thirty days sits
  in a wide gap in the data: the oldest fresh record is 10 days old, the newest stale one 105.
- **Minimum term is advisory, not enforced.** The supplied data disproves a hard rule.
  `request-002` is 89 days against a 90-day minimum and was approved, and `contract-001` was
  issued on those dates. It is disclosed to the client on the request form and surfaced to
  management on the request, but it never blocks.
- **A booking request needs no `Idempotency-Key` to be shortlisted.** The shortlist is an
  upsert on a unique organisation and product pair, so repetition cannot duplicate work. Keys
  are required where they matter: registration, booking requests, contract create and issue,
  work-order create, status updates and proof upload.
- **Money is GBP** and stored as decimal. `contractCount` and `proofRecordIds` are derived at
  the data layer rather than stored, so they cannot drift.

## Prototype shortcuts

| Shortcut | Production alternative |
| --- | --- |
| `X-Prototype-User-Id` and a cookie holding a user id | A real identity provider, sessions, and record-level authorisation. This is a prototype seam and is never presented as security |
| Proof images held as capped base64 in the database | Object storage with signed, expiring URLs, malware scanning, and background upload with retry |
| Contract acceptance is a button | A real electronic signature boundary, with versioned documents and an audit trail |
| A single Postgres database, seeded from the fixture file | Migrations, backups, environments and a reconciliation path against the media owners' own systems |
| `POST /api/dev/reset` | Does not exist in production |

These are covered in full in [PRODUCTIONISATION.md](PRODUCTIONISATION.md).

## Deliberate exclusions

Excluded because the brief excludes them: production authentication, real electronic
signature, payments, email, SMS or push notifications, accounting, CRM or media-scheduling
integrations, App Store or Play Store builds, full offline synchronisation, AI planning,
programmatic advertising, maps, and a brand or illustration system.

Also not built, as a judgement call: unrestricted CRUD for every entity. The management
surface covers the connected scenarios rather than every table.

## Known limitations

- **Management cannot yet respond to a change request.** A client can request changes or
  cancellation and the contract moves to `change_requested`, but there is no management action
  to revise, re-issue or cancel it, so the request stays pending. The dashboard raises it and
  the client is told nothing has changed, which is correct, but the loop does not close.
- **A client cannot reply to a request for information.** Management can set a booking request
  to `information_required` and the client sees that status, but supplying the answer needs an
  endpoint that does not exist. The fixture's `request-002` shows the intended shape.
- **Contract `completed` and `cancelled` are modelled but unreachable.** Nothing transitions
  into either state.
- **`POST /api/dev/reset` is unauthenticated.** Convenient for a reviewer, wrong for a public
  deployment.
- **The client sees proof metadata, not the image.** Management renders the captured photo;
  the client contract page lists the file name and completion note only.
- **Contract line items show product and asset ids** rather than names on both the client and
  management contract pages.
- **A capacity-pool contract cannot have field work raised against it.** A work order requires
  an `assetId`, which the OpenAPI makes mandatory, and a pool allocation has no named asset.
  The walkthrough above therefore uses an exclusive-asset product.
- **Offline behaviour is signalled, not solved.** The fitter app detects that it is offline,
  refuses to pretend an update was sent, and makes retry safe through idempotency keys. It does
  not queue work, which full offline synchronisation would require and the brief excludes.
