# Submission template

## Candidate

- Name: Riaz Ali
- Upwork profile: https://upwork.com/freelancers/~01fba85c8647133431?mp_source=share
- Accountable delivery lead: Riaz Ali
- Other contributors and exact contribution: None. Sole contributor. Claude Code was used as a
  tool under the standing instructions in `CLAUDE.md`; every decision, review and correction is
  mine and is recorded in `AI-LOG.md`.

## Links

- Private repository: https://github.com/collabriaz/niko-assessment
- Confirm `@niko-frameworks` has access: Yes
- Deployed preview: <https://niko-assessment.vercel.app>
- Walkthrough video: <https://drive.google.com/file/d/1ZIyJa3Svf2SicGzW3VwpTWE3TR6C8AcK/view?usp=sharing>

## Prototype access

No passwords. The landing page lists every seeded account; selecting one sets a cookie holding
that user id. API routes also accept an `X-Prototype-User-Id` header.

- Management user or switcher option: Morgan Reed, on the landing page, then `/manage/dashboard`
- Fitter user or switcher option: Casey Morgan, then `/jobs` on a phone viewport
- Existing client user or switcher option: Jordan Ellis (an issued contract awaiting a
  response), Taylor Quinn (an active contract and a pending change request), Avery Stone (no
  contracts, one open request)
- New-client registration route: `/register`, linked from the landing page and the client shell

## Setup and checks

- Required runtime: Node 20 or newer, pnpm, and a Postgres database (developed against Neon)
- Install command: `pnpm install`
- Seed or reset command: `pnpm db:reset` locally, or `POST /api/dev/reset` as a manager against
  a running deployment
- Development command: `pnpm dev`
- Test command: `pnpm test` (188 tests, 21 files). `pnpm test:unit` runs the domain tests with
  no database
- Production build command: `pnpm build`. `pnpm verify` runs typecheck, tests and build together

## Active time

- Active working time: 7h 40m
- Unattended agent elapsed time: 0. The agent was never left running unwatched
- Delivery started: 2026-08-31, 09:15 (Europe/London)
- Delivery submitted: 2026-08-31, 23:45 (Europe/London)

The per-session breakdown is in `AI-LOG.md`, kept as the work happened rather than
reconstructed at the end. Times are Europe/London; the development machine runs at UTC+5 and
entries are converted.

## What works

### Scenario A: signup and product discovery

A visitor browses `/catalogue` with no account, filters by dates, media type, location and
maximum indicative monthly budget, and opens a product to see its native rate label, minimum
term, creative specification and availability calculated for the chosen dates. Registration at
`/register` creates a user and organisation with no contract, and the session survives reload
because it is a cookie, not client state. A signed-in client shortlists a product from its
detail page, and sends a non-binding request from `/shortlist`.

**Verify:** sign in as Avery Stone, who has no contracts. Catalogue, 2027-03-01 to 2027-03-05,
Bus rear panel, add to shortlist, then "Request these dates" on `/shortlist`. The portal home
lists it as submitted and states that nothing is reserved.

### Scenario B: management request to contract and campaign

`/manage/dashboard` is attention led: it counts what waits on management against what waits on
the client, and raises each open request. The request detail shows the client, dates, product
and availability recalculated at the manager's read rather than replayed from the client's.
Management can request information, decline or approve; approval rechecks availability and
answers 409 `INVENTORY_CONFLICT` rather than approving inventory that has gone. A draft
contract is then created and issued, which creates the connected campaign. The client sees the
issued contract, and can accept it or request changes. Acceptance activates the campaign and
books the inventory. A change request records the request and moves the status without touching
items, dates or totals; management responds by re-issuing, which raises the version, or by
cancelling, which releases the booked inventory.

**Verify:** `request-001` cannot be approved, because all three bus-rear assets are taken across
its dates by two confirmed bookings and a confirmed outage. `contract-001` is issued and waiting
on Jordan Ellis. `contract-002` is active with a pending change request from Taylor Quinn,
which `/manage/contracts/contract-002` now shows and can act on.

### Scenario C: management creates and assigns field work

A work order is created from the contract page once the campaign exists, with type, scheduled
window, asset, location, instructions, internal notes and an assigned fitter. It can only be
raised against a campaign the client has accepted, and only assigned to a user whose role is
fitter. It appears immediately in that fitter's app, and management sees the latest field
status on `/manage/work-orders` and on the dashboard.

**Verify:** `campaign-001` is awaiting acceptance and refuses a work order; `work-order-001` is
the seeded scheduled job assigned to Casey Morgan.

### Scenario D: fitter completion updates management and client service visibility

`/jobs` is phone first. A job moves through `assigned`, `travelling`, `on_site`, `blocked` and
`completed` against a state machine that rejects moves it does not allow. Blocking requires a
reason. Completion requires both a note and at least one proof attachment, and is the only
fitter status that produces a client-visible service event. Management then sees the completed
job, its history and the captured photo; the client sees the service event and the proof on the
contract page.

**Verify:** try to complete with no proof, then with a note but still no proof, then with both.
Tapping complete twice with the same key leaves one proof record and one history entry.

## Deliberate exclusions and known limitations

Excluded because section 11 excludes them: production authentication, real electronic
signature, payments, notifications, accounting, CRM or media-scheduling integrations, store
builds, full offline synchronisation, AI planning, programmatic advertising, maps, and a brand
system. Also not built, as a judgement call: unrestricted CRUD for every entity.

Incomplete, and why:

- **A client cannot reply to a request for information.** Management can set a booking request
  to `information_required` and the client sees that status, but supplying the answer needs an
  endpoint that does not exist. The fixture's `request-002` shows the intended shape.
- **Re-issuing does not edit the contract.** Management re-issues with a note, which raises the
  version and returns it to the client; items, dates and totals are unchanged, so revising
  terms is still an offline conversation.
- **The client sees proof metadata, not the image.** Management renders the captured photo; the
  client page lists the file name and completion note.
- **Contract line items show product and asset ids** rather than names.
- **A capacity-pool contract cannot have field work raised against it,** because a work order
  requires an `assetId` and a pool allocation has no named asset.
- **Management has no inventory browser.** Availability context reaches management through the
  request detail rather than a dedicated product and asset screen.
- **Required check 10 is an API-level connected journey, not a browser test.** No browser
  automation is installed. The interface itself is verified by the documented walkthrough in
  the README, and this is stated rather than claimed as automated coverage.

## Assumptions

- **Timezone is Europe/Jersey.** Calendar dates are compared as `YYYY-MM-DD` strings so no local
  conversion can shift a day.
- **Stale verification is older than 30 days,** which makes a product `confirmation_required`
  rather than unavailable. The brief supplies stale records but no threshold; 30 days sits in a
  wide gap in the data, where the oldest fresh record is 10 days old and the newest stale one
  105.
- **Minimum term is advisory, not enforced.** The supplied data disproves a hard rule:
  `request-002` is 89 days against a 90-day minimum and was approved, and `contract-001` was
  issued on those dates. It is disclosed to both the client and management, and never blocks.
- **The shortlist needs no idempotency key,** because it is an upsert on a unique organisation
  and product pair and repetition cannot duplicate work.
- **Money is GBP.** `monthlyEquivalent` is used only by the budget filter, and a null price
  renders as "Price on request" and never passes a budget filter.

## Shared data model

- **Users and client organisations.** A user has a role and belongs to at most one
  organisation. Staff have no organisation. Registration creates both a user and an
  organisation, and an organisation may hold zero contracts.
- **Products, physical assets and capacity pools.** A product is what is sold. A physical asset
  is the named vehicle, door or screen that delivers it, and belongs to one product. A capacity
  pool is shared capacity for a product sold by `capacity_pool` allocation. They are three
  tables, because collapsing them makes it impossible to answer what is actually on a given bus.
- **Requests, bookings, contracts and campaigns.** A booking request is a non-binding enquiry
  with its own status and history. A contract is the commercial record, with items, dates,
  total, version and history. A campaign is the delivery record created when a contract is
  issued and activated when the client accepts. A booking is the inventory commitment created
  at acceptance, and is what availability actually reads.
- **Work orders, service events and proof records.** A work order is one field job against a
  campaign and an asset. A service event is the timeline entry, carrying a `clientVisible` flag
  and a `clientSummary` that is the only text a client ever sees. A proof record belongs to a
  work order and holds the captured image and completion note.

## Contract behaviour

A contract is created as `draft` from an approved request, with its items reconciled
server-side: the stored total must equal the sum of the line totals. Line totals are not derived
from the unit rate, because both seeded contracts price a monthly rate across a whole term and a
derived check would reject them.

Issuing moves it to `issued`, stamps `issuedAt`, creates the campaign if it does not exist, and
writes a client-visible event. The client can then accept or request changes. Acceptance
rechecks availability, refuses with 409 if the inventory has gone, creates the confirmed
bookings, activates the campaign, and sets the status to `accepted`, or `active` when the start
date has already passed. A change request records a `ClientRequest`, appends history and moves
the status to `change_requested`, leaving items, dates and totals untouched.

Management then re-issues, which increments `version` and returns the contract to the client;
cancels, which releases the booked inventory so a cancelled campaign stops blocking the asset;
or completes an active contract. Every transition appends an actor, time, action and note to
the contract history and resolves any open client request.

## Mobile and field-work behaviour

A separate mobile-first web surface rather than a PWA shell or a native build. The fitters are a
small set of known internal users, the job is a form plus a camera capture, and `<input capture>`
already covers the photo, so store review cycles would buy nothing for a tool that changes
weekly.

Proof is held as capped base64 in the database, which avoids requiring an object-storage
account. Production moves it to object storage with a short-lived presigned upload direct from
the device, a quarantine bucket with malware scanning before promotion, and short-expiry signed
URLs for viewing.

Retry is honest rather than optimistic. The app detects that it is offline, disables the
progress actions, and says the update was not sent and nothing was changed. Every field write
carries an `Idempotency-Key` that is only regenerated after a success, so retrying is safe and
a fitter tapping complete twice on weak signal produces one proof record. It does not queue
work. Production would add a client-side outbox in IndexedDB replayed on reconnect, with the
interface distinguishing queued, sent and confirmed, and a rule for the genuinely hard case: a
job completed offline after management cancelled it, where the server state wins and the
fitter's submission is preserved for a human to resolve.

## Visual consistency

- Colour and typography choices: one token file at `src/app/globals.css` defines the palette in
  oklch, with a single blue primary and four semantic pairs (success, warning, destructive,
  info), each as a foreground and a surface. Type is the stack Next ships with, at one scale.
  Radius and spacing come from the same tokens.
- Where this style is applied across the three interfaces: every surface imports the same file.
  The management, client and fitter shells differ in layout and density, not in palette, type
  or radius. Status and availability badges are shared components, so a status looks the same
  wherever it appears.
- Third-party or generated asset sources and licences: no illustrations, logos or generated
  imagery. Icons are Lucide (ISC). UI primitives are shadcn patterns over Base UI (MIT).

## Access boundaries

Client scoping lives in `src/data/`, never in a route handler, so every client-facing query is
filtered by organisation in one place. A client requesting another organisation's contract gets
the same 404 as for a contract that does not exist, so the existence of the record is not
disclosed. A fitter sees only work orders assigned to them, also as a 404. Field-level rules are
enforced by explicit per-surface response mappers rather than by serialising entities:
`internalNotes` reaches managers and the assigned fitter only, and clients receive
`serviceEvent.clientSummary` rather than the record behind it.

The role switcher is a prototype seam and is documented as such. It is not weak authentication,
it is none. Production replaces it with a managed identity provider, keeps the data-layer
scoping and adds Postgres row-level security underneath so a missed filter fails closed, stages
trust so an unverified account can browse and request but not be issued a contract, and adds
MFA for staff because a manager can see every organisation. This is covered in full in
`PRODUCTIONISATION.md`.

## Persistence

Everything material is in Postgres and survives reload: accounts and organisations, shortlists,
booking requests and their history, contracts with version, items, totals and history,
campaigns, bookings, work orders, service events and proof records, plus the idempotency keys
that make retries safe. The session is a cookie holding a user id, so it also survives reload.
Nothing important lives in client state; forms hold their own fields, post to a route handler,
and the page is re-read from the server afterwards.

The prototype shortcut is that proof images are base64 columns and the database is seeded
deterministically from the fixture file. Production alternatives are in `PRODUCTIONISATION.md`:
object storage for proof, reviewed migrations instead of schema push, point-in-time recovery
with a tested restore, and expand-and-contract for anything destructive.

## Architecture and productionisation note

`PRODUCTIONISATION.md` in this repository. The architecture summary is in `README.md`.

## AI and development tools

| Tool | Contribution | How you verified the output |
|---|---|---|
| Claude Code (Opus) | Fixture analysis, the `src/domain/` availability engine, the Prisma schema and seed, the org-scoped data layer, the route handlers, the three surfaces, the design tokens and the test suite | Three layers, because each catches what the others cannot. `pnpm test` runs pure domain probes plus integration tests against Postgres. During development a throwaway shell script also exercised routes over real HTTP, because an in-process test calls the handler function and never touches Next's router, body parsing or dynamic segments; it is not committed. Colour tokens were checked with an oklch to sRGB converter rather than by eye. Every expected value was traced to a specific fixture record before the assertion was written. Thirteen corrections are recorded in `AI-LOG.md` |

## Representative prompts or agent instructions

`CLAUDE.md` at the repository root is the standing instruction set the agent worked under, and
is the honest answer here rather than any single prompt. It carries the fixture clock, the
half-open interval rule, the layering rules, the comment policy and the simplicity-first
section.

Three directions changed the work materially:

- Asking for the deliberate traps in the fixtures before any code was written, which produced
  the probe queries the test suite is built around.
- "Never add useless comments", after reviewing the first pass. This tightened the comment rule
  in `CLAUDE.md` and removed comments that only restated test names.
- "Match the requirements, don't introduce anything new", which cut two features that the brief
  never asks for: a submit-time minimum-term warning and pre-filled draft contract dates. It
  also reduced three proposed schema changes to two, by holding prototype proof in the
  OpenAPI's existing `previewUrl` as a capped base64 data URI rather than adding columns.
  Section 13 does not reward feature count, so pruning against the brief was worth more than
  the features.

## AI-generated mistake or unsafe assumption

`AI-LOG.md` records thirteen. The one that mattered most:

- **What the tool generated or assumed:** expected values for two availability tests written
  from intuition rather than from the data. `product-bus-rear` over 2027-02-20 to 2027-02-25
  was asserted `unavailable`, and 2027-03-06 to 2027-03-10 was asserted to leave two assets
  free.
- **Why it was wrong or unsafe:** `outage-001` on `asset-bus-103-rear` ends on 2027-02-20, and
  intervals are half-open, so that asset is free from that date. In the second window
  `hold-003` runs 2027-03-05 to 2027-03-15 and expires after the fixture clock, so it still
  blocks and only one asset is free. Both errors would have encoded the exact bugs the tests
  exist to catch. A green suite asserting the wrong boundary behaviour is worse than no suite.
- **How you noticed:** every expected value was traced back to the fixture records before the
  suite was run for the first time.
- **What you changed:** corrected both to one free asset, and reframed the first as an explicit
  boundary test named for the behaviour it proves.
- **What check proved the correction:** `pnpm test`, including the two probes that fail under a
  closed-interval comparison and the probe that fails if the expired `hold-002` is counted.
  `product-hub-screen` over 2027-02-01 to 2027-02-20 must read 3 of 4 used and available, and
  `product-bus-rear` over 2027-03-01 to 2027-03-05 must leave 2 free assets.

A second one is worth naming because it recurred: test probes writing onto shared fixture
records, first a contract on the deliberate no-contract organisation, then a shortlist row on
it, then a booking on a fixture asset over dates another file relies on. Each showed up as a
suite that disagreed with itself between runs. The rule that settled it is that probe files
register their own throwaway organisation and never write onto fixture records, and that
disagreeing runs are treated as the defect rather than retried until green. Corrections 9, 11
and 13.

## One useful improvement

Cancelling a contract releases its booked inventory. Nothing in the brief asks for it, and the
obvious implementation of a cancel action would just set a status. But a confirmed booking left
under a cancelled contract keeps the asset blocked forever, so the availability engine, which is
the core of the whole model, would quietly start lying. It helps management most: an asset
freed by a cancellation is immediately sellable again, with no manual cleanup and no wrong
answer given to the next client who asks for those dates. There is a test for it.

## What I would do next

1. **Close the information-required loop,** so a client can answer a manager's question on a
   booking request. It is the last place where one side of a conversation cannot reply, and the
   fixture data already shows the intended shape.
2. **Move proof to object storage** with presigned uploads, malware scanning and signed access.
   Base64 columns are the shortcut that would hurt first as real photographs arrive.
3. **Real contract versioning,** where a change request produces a new version row with edited
   items and the issued version is never mutated, together with the electronic-signature
   webhook boundary.
4. **Tenant isolation in the database** through row-level security, so a missed filter in the
   data layer fails closed rather than leaking, before any real client data exists.
5. **Validate that media owners can supply an availability feed at all.** The entire model
   assumes reconciliation is possible; if outages arrive by phone call, this is a different
   product and it is better to learn that before building the integration.
