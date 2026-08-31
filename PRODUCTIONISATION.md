# Productionisation note

What would change to take this prototype into production for a real agency of roughly ten
staff and a few hundred client organisations. Every choice below names the reason and what it
costs, because the alternative is a list of tool names.

## Architecture

**Keep the single Next.js application.** Three surfaces over one operating model is the point
of the product, and the boundary that carries the design is already internal: `src/domain/` is
pure functions with the clock injected, `src/data/` is the only place organisation scoping
lives, and route handlers stay thin. Splitting into services would add network failure modes
between parts that always deploy together, for a system whose peak concurrency is a dozen
people. The cost is that a bad deploy takes all three surfaces down at once, which preview
deployments per pull request and instant rollback make survivable.

**Background work needs a real runner.** The prototype computes verification staleness at read
time, which is cheap and correct. Production also needs hold expiry sweeps, nightly
reconciliation against media owners, and proof post-processing. Scheduled functions are enough
for the sweeps. Anything that must not be silently lost, particularly reconciliation, belongs
on a queue with retries and a dead-letter path, because a cron job that fails at 03:00 and logs
nothing is indistinguishable from one that worked.

**Idempotency needs two things the prototype does not have.** Today a key is stored with the
created record and checked inside the write transaction, which is the important half: a fitter
tapping complete twice on weak signal produces one proof record. Production should also store
the response body, so a retry returns the identical payload rather than a freshly derived one,
and store a hash of the request body, so reusing a key with different content answers 409
instead of returning a record the caller did not ask for. Keys need a TTL, or the table grows
forever.

**Audit must leave the record.** The prototype keeps a `history` array on each entity plus
client-visible service events. That is legible but it can be overwritten by any update and
cannot be queried across entities. Production wants an append-only audit table with actor,
action, entity, before and after, request id and timestamp, written in the same transaction as
the change. It costs a write per mutation and needs a retention policy.

**Reconciliation is a queue, not an overwrite.** Media owners are the source of truth for
whether an asset exists and whether it is out of service. Take webhooks where an owner offers
them and a nightly pull-and-diff where they do not, but surface differences as a reconciliation
queue a human clears. Automatically overwriting availability under a confirmed booking is worse
than a day of staleness, which is exactly why the model already carries `verifiedAt` and a
`confirmation_required` state rather than a boolean.

**Mobile stays a PWA.** The fitters are a small set of known internal users, the job is a form
plus a camera capture, and `<input capture>` already covers the photo. Shipping through app
stores would add review cycles to a tool that changes weekly, for no capability this workflow
needs. Native becomes correct if reliable background upload, dependable push, or high-volume
scanning is required. The honest trade-off is iOS: background sync is unreliable there, which
is the single biggest constraint on offline behaviour below.

## Data model and source-of-truth boundaries

Keep product, physical asset, capacity pool, booking, contract, campaign and work order as
distinct records. Collapsing any pair of them is the mistake that makes the system unable to
answer "what is actually on that bus" later.

The boundaries that matter are the ones we do not own:

- **Media owner systems** own asset existence, outages and true availability. We hold a cached
  projection with a verification timestamp, and never present cached availability as a
  commitment.
- **CRM** owns the client relationship and contact details. The application mirrors
  organisations and users keyed by an external id. Make CRM authoritative for contacts and the
  application authoritative for contract state, because two-way ownership of the same field is
  how duplicate customer records happen.
- **Accounting ledger** owns invoices, tax and balances. The application emits a
  contract-accepted event and never computes VAT or holds a balance.
- **Object storage** owns proof binaries. The database holds metadata and a key.
- **Media scheduling and playout** owns what actually appears on a digital screen. Our capacity
  pool is a commercial abstraction over it and has to reconcile with it, or we will sell a slot
  that the loop cannot carry.

Money should move to integer minor units with an explicit currency. The prototype stores
decimals and formats at the edges, which is safe here, but integers remove the question
permanently.

## Identity, signup and recovery

The `X-Prototype-User-Id` header and the cookie holding a user id are a prototype seam and are
documented as such. They are not weak authentication, they are no authentication.

Use a managed identity provider. The risk in this area is credential storage, session
handling, and reset flows, none of which is differentiating work for an advertising agency. The
cost is per-user pricing and coupling to that vendor's session model, which is acceptable
because the application already treats identity as an input rather than a concern.

Client signup stays self-serve, but trust is staged. Email verification activates an account;
that account can browse, shortlist and submit non-binding requests, which is exactly the
zero-contract state the brief asks for. Business verification, against the Jersey registry or a
VAT number, gates the point where a contract can be issued, because a contract is a commercial
commitment and a request is not. Recovery is a short-lived single-use email token, rate
limited. Staff accounts get MFA, because a manager can see every organisation. Support
impersonation is time-boxed, audited, and visibly flagged in the interface while active.

## Permissions: tenant, record and field

The prototype enforces all three at one layer. Production should keep that layer and add a
second underneath it.

- **Tenant.** Every client-facing query is filtered by organisation inside `src/data/`, never
  per route. Production adds Postgres row-level security so a missed filter fails closed rather
  than leaking. The cost is a per-request session variable and more care with connection
  pooling.
- **Record.** A fitter sees only work orders assigned to them, which the prototype already
  enforces by returning 404 rather than 403, so the existence of another fitter's job is not
  disclosed.
- **Field.** `internalNotes` reaches managers and the assigned fitter only; clients see
  `serviceEvent.clientSummary` rather than the record behind it. This is enforced by explicit
  per-surface response mappers rather than by serialising entities. Keep that. It is the only
  approach that fails safe when someone adds a column, and the one leak found during this build
  came from spreading whole database rows into a response.

## Contract versioning and the signature boundary

A contract is immutable once issued. The prototype takes the first step: management responds
to a change request by re-issuing, which increments `version`, records the note on both the
contract and the client's request, and puts it back in front of the client. It still edits
nothing, so revising terms is an offline conversation. Production makes a change request
produce version n+1 as a new row sharing a contract group id, with the edited items on the new
version and the issued one left untouched, so it is always possible to show precisely what the
client accepted and when.

Acceptance in the prototype is a button, and it is labelled as a prototype acceptance rather
than a signature. In production the application owns the document and the state machine, and a
signature provider owns the signing ceremony and its evidence trail. The integration is a
webhook: the provider reports an envelope as completed and we transition to accepted. A click
in our own interface must never be recorded as a signature. That webhook needs the same
idempotency treatment as every other write, since providers retry.

## Proof files and field conditions

Proof is currently base64 in the database with a size cap, which is a deliberate shortcut to
avoid requiring an object-storage account. In production, rows carrying megabytes ruin backup
size and query performance, so proof moves to object storage.

Upload directly from the device with a short-lived presigned URL, with the server recording
only metadata; content type and size still need server-side validation afterwards, because the
client can claim anything. Land uploads in a quarantine bucket, scan them, and promote on
clean, since clients view these files. Serve them through short-expiry signed URLs, never
public objects, and log access.

Offline is the part to be honest about. The prototype detects that it is offline, refuses to
pretend an update was sent, and makes retry safe through idempotency keys. It does not queue.
Production adds a client-side outbox in IndexedDB replayed on reconnect, each entry carrying
the key it was created with, and a user interface that distinguishes queued, sent and confirmed
rather than implying success. The genuinely hard case is a job completed offline after
management cancelled it. The rule should be that the server state wins and the fitter's
submission is preserved as a record for a human to resolve, because silently discarding field
work is how field staff stop trusting the tool.

## Environments, delivery and data safety

Three environments: a preview deployment per pull request, staging with anonymised data, and
production. Continuous integration runs the same gate as local development, typecheck, lint and
the full suite, against an ephemeral database branch so integration tests hit real Postgres
without a shared fixture race.

Migrations move from `prisma db push` to reviewed migration files. Push is right for a
prototype and wrong for production, because it infers destructive changes rather than stating
them. Anything destructive follows expand and contract, so a rollback does not lose data. That
matters because deploy rollback is instant and database rollback is not.

Backups use point-in-time recovery, and the restore gets tested, since an untested backup is a
guess. Secrets live in platform environment variables with separate credentials per
environment, and rotate when staff change. Dependencies keep a committed lockfile with
automated update pull requests and a build that fails on high-severity advisories, batched
weekly so the noise stays manageable.

## Cost, maintenance and what to validate first

For this scale, expect application hosting, a managed Postgres instance, object storage,
error monitoring and identity to land in the region of £150 to £350 per month, plus per-envelope
signature charges. That is an order of magnitude rather than a quote; the variables that move it
are proof storage volume and monthly active client accounts.

What keeps three interfaces cheap six months later is already in place: business rules live in
pure functions with the clock injected, so a rule can be changed and tested without touching a
component or a query; each surface has its own response mapper, so a new column does not leak
by default; one token file styles all three; and the brief's ten checks act as a regression net
that runs in seconds for the domain half.

Before committing to production development, five things are worth validating, in order:

1. **Whether media owners can supply a feed at all.** The entire availability model assumes
   reconciliation is possible. If outages arrive by phone call and spreadsheet, this is a
   different product with a data-entry surface at its centre.
2. **Real rate-card complexity.** Six clean products with one rate each is a fixture. Seasonal
   pricing, packages and negotiated rates would change the contract model materially.
3. **Whether clients will self-serve at all,** or whether acceptance stays a relationship
   conversation and the portal's real job is visibility rather than transaction.
4. **Actual connectivity on fitter routes,** which decides how much offline machinery is
   justified and whether iOS background limitations are a real constraint or a theoretical one.
5. **Proof volume and retention expectations,** which drive storage cost and whether clients
   expect access to proof years after a campaign ends.
