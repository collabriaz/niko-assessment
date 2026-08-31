# AI and development log

Working notes kept while building. Feeds these sections of `SUBMISSION_TEMPLATE.md`:
Active time, AI and development tools, Representative prompts, and AI-generated mistake.

Kept as work happens rather than reconstructed at the end. Section 15 of the brief treats
misleading time reporting as an integrity failure.

## Time record

Delivery started: 2026-08-31, 09:15
Delivery submitted:

| Date       | Session       | Active | Unattended agent | What                                                                                                  |
| ---------- | ------------- | ------ | ---------------- | ----------------------------------------------------------------------------------------------------- |
| 2026-08-31 | 09:15 - 10:45 | 1h 30m | 0                | Read the brief, mapped the fixture traps, chose the stack, wrote the availability engine and its tests |
| 2026-08-31 | 15:45 - 16:55 | 1h 10m | 0                | Audited the build against the brief, settled minimum term as advisory, corrected the contract-item schema against the OpenAPI, wrote the shared fixture seed, then the org-scoped reads, per-asset availability and the catalogue endpoints |
| 2026-08-31 | 18:30 - 19:50 | 1h 20m | 0                | Built the HTTP smoke suite, chose and contrast-verified the Island Media palette, added the surface switcher, then the shortlist, booking-request submission and client portal summary |
| 2026-08-31 | 20:15 - 21:05 | 50m | 0 | Audited the build and the plan against the brief, then built the management booking-request inbox, detail and decision: domain state machine, org-wide reads, `GET`/`PATCH` endpoints, the manager shell, the client/account detail page, and 36 new tests |
| 2026-08-31 | 21:05 - 21:25 | 20m | 0 | Added the attention-led management dashboard: counts, attention items, upcoming field work, and the work-order read mapper that omits internal notes |
| 2026-08-31 | 21:25 - 22:05 | 40m | 0 | Contract draft and issue: money reconciliation in the domain, both endpoints with idempotency, campaign creation at issue, the draft form and contract pages, and the connected request-to-acceptance test |
| 2026-08-31 | 22:05 - 23:00 | 55m | 0 | Scenarios C and D: work-order state machine, creation and management field-work pages, the four mobile endpoints, the fitter app, the client-response leak fix, and required checks 7 and 8 |
| 2026-08-31 | 22:35 - 23:30 | 55m | 0 | Audited the whole build against the brief, then closed Scenario A6: the shortlist page and button, the booking-request form, the portal request list, and the connected shortlist-to-inbox test. Caught a shared-fixture race in the new test and a hook timeout it exposed, corrections 11 and 12 |

All times are Europe/London, the same offset as the Europe/Jersey assumption the
application states. The development machine runs at UTC+5, so entries are converted.

Active means at the keyboard reading, directing, reviewing or writing. Unattended means the
agent was running while I was not watching.

## Tools

| Tool               | Contribution                                                                                   | How the output was verified                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code (Opus) | Fixture analysis, the `src/domain/` availability engine, the Prisma schema and seed, the org-scoped data layer, every route handler so far, the design tokens, and the test suite | Three layers, because each catches what the others cannot. `pnpm test` (65/65) runs pure domain probes plus integration tests against Postgres. A shell smoke suite then exercises every route over real HTTP, because an in-process test calls the handler function and never touches Next's router, body parsing or dynamic segments. Colour tokens were verified with an oklch to sRGB converter rather than by eye. Every expected value was traced to a specific fixture record before the assertion was written |

## Corrections

### 1. Wrong expected values in two availability tests

- **What the tool generated:** two assertions written from intuition rather than the data.
  `product-bus-rear` over `2027-02-20 -> 2027-02-25` was asserted `unavailable`, and
  `2027-03-06 -> 2027-03-10` was asserted to leave 2 assets free.
- **Why it was wrong:** `outage-001` on `asset-bus-103-rear` ends on `2027-02-20`, and
  intervals are half-open, so bus 103 is free from that date. In the second window
  `hold-003` runs `2027-03-05 -> 2027-03-15` and expires after the fixture clock, so it
  still blocks bus 103 and only one asset is free.
- **Why it mattered:** both errors would have encoded the exact bugs the tests exist to
  catch. A green suite asserting the wrong boundary behaviour is worse than no suite.
- **How it was noticed:** each expected value was traced back against the fixture records
  before the suite was run for the first time.
- **What changed:** corrected both to 1 free asset, and reframed the first as an explicit
  boundary test named for the behaviour it proves.
- **What check proved the correction:** `pnpm test`, 12 passing, including the two probes
  that fail under a closed-interval comparison and the probe that fails if the expired
  `hold-002` is counted.

### 2. A minimum-term rule the supplied data disproves

- **What the tool proposed:** enforcing each product's `minimumTermDays` as hard validation,
  offering a 422 at request submission or a 422 at contract creation as the two options.
- **Why it was wrong:** every request and contract term was computed against its product's
  minimum before any validation was written. Both seeded booking requests are already under
  it, and so is a seeded issued contract. `request-002` is 89 days against
  `product-hub-door`'s 90-day minimum and a manager approved it anyway; `contract-001` was
  drafted and issued on those same dates and is the record Scenario B.7 and B.8 run on.
  `contract-002` is 181 days against a 180-day minimum, one day the other way. That 89/90 and
  181/180 pairing is a planted boundary, the same shape as the half-open interval traps.
- **Why it mattered:** either gate would have made `pnpm db:seed` load data that the API then
  rejects, and a contract-creation gate would have blocked the client-acceptance scenario
  outright. Section 7 says the inconvenient records are not mistakes to delete.
- **What changed:** minimum term is disclosure, not validation. It is displayed on product
  detail per section 4 A.3 and surfaced to the manager through the OpenAPI's existing
  `BookingRequestSummary.attentionReason`. Hard validation stays limited to the one date rule
  section 6 actually states, `endDate > startDate`, plus the availability recheck at approval.
- **What check proved the correction:** the term computation across all requests and
  contracts, and the seed loading `contract-001` in its issued state unchanged.

### 3. A budget blocker that the arithmetic disproves

- **What the tool generated:** earlier fixture analysis recorded `request-001` as unapprovable
  on three grounds, one of them "budget GBP 1,100 vs GBP 950 monthly".
- **Why it was wrong:** GBP 1,100 covers a 30-day term at GBP 950. The budget is adequate.
- **How it was noticed:** recomputed while settling the minimum-term question.
- **What changed:** `request-001` has exactly one genuine blocker, inventory. All three
  bus-rear assets are taken across 2027-02-12 to 2027-02-18 by two confirmed bookings and a
  confirmed outage. That is why approving it must answer 409 `INVENTORY_CONFLICT` and not a
  budget error.

### 4. A generated Biome config that would have rewritten the reviewer's pack

- **What the tool generated:** a `biome.json` whose `files.includes` excluded `node_modules`,
  `.next`, `dist` and `build`, but not `assessment_files/`. The repo's preferred lint command
  is `pnpm check:fix`, which is `biome check --write --unsafe`.
- **Why it was unsafe:** `assessment_files/` is the reviewer's pack and must stay byte-for-byte
  as issued. Biome had already decided to reformat
  `assessment_files/fixtures/island-media-fixtures.json`, collapsing every `locationIds` array
  onto one line. The first `pnpm check:fix` would have silently rewritten the supplied fixture
  file. Nothing about the diff would have looked alarming in review.
- **How it was noticed:** reading the output of the read-only `pnpm lint` before running the
  writing command, rather than reaching for `check:fix` to clear the errors.
- **What changed:** `!assessment_files` added to `files.includes`, in the folder form Biome's
  own `useBiomeIgnoreFolder` rule asks for.
- **What check proved the correction:** `pnpm lint` now reports `Checked 19 files` with the
  fixture pack absent from the list, where it previously reported 20 and named the file, and
  `git status --porcelain assessment_files/` is empty.

### 5. A Prisma row passed straight into the domain, dropping a field

- **What the tool generated:** `src/data/products.ts` passed the Prisma `Product` row directly
  as the availability calculation's `product` input.
- **Why it was wrong:** `Product` has no `capacityPoolId` column. The foreign key lives on
  `CapacityPool.productId`, so the field arrived as `undefined`, the pool lookup missed, and
  every capacity-pool product reported "No active capacity pool is configured". The domain's
  input type declares that field optional, so the compiler had no reason to object.
- **How it was noticed:** the integration probe for `pool-hub-screen` over 2027-02-01 to
  2027-02-20 returned `unavailable` where the same query against the fixture file returned
  `available` with 3 of 4 used. The first hypothesis was a timezone shift in the `@db.Date`
  conversion; a probe disproved that before anything was changed.
- **What changed:** the call site now builds the domain input explicitly, taking the pool id
  from the included relation.
- **What check proved the correction:** `pnpm test`, 33 passing, including the pool probe
  running against Postgres rather than the fixture file.

### 6. Design tokens that were outside the sRGB gamut

- **What the tool generated:** an oklch palette for Island Media Co chosen for how the numbers
  read rather than measured, including `oklch(0.515 0.14 243)` as the primary.
- **Why it was wrong:** several of those colours do not exist in sRGB at that lightness. A
  browser silently clips them, so the rendered colour would not have been the one the file
  claimed, and the contrast I believed I had would have been fiction.
- **How it was noticed:** rather than eyeballing the palette, an oklch to sRGB converter was
  written to check gamut and compute every foreground/background contrast ratio. Four tokens
  came back out of gamut and two badge pairs sat under 4.5:1.
- **What changed:** a binary search now fixes each colour to the largest chroma that fits at
  its lightness, and the badge tints were lightened. The worst pair is 4.95:1, so every
  combination clears WCAG AA for normal text.
- **What check proved the correction:** the converter output, and independently, the compiled
  stylesheet Tailwind emits. Its hex fallbacks (`#e8f5ff`, `#e3faeb`, `#fff3e1`, `#fff0ee`)
  match the converter's predictions exactly, having been derived from the oklch source by a
  different route.

### 7. A smoke script that reported a failure the application did not have

- **What the tool generated:** a curl step that built its JSON body with escaped double quotes
  inside a command substitution. The payload split on the spaces in "Smoke Test Co", so curl
  sent a truncated body plus stray arguments.
- **Why it mattered:** it reported `422` for a repeated idempotency key where `200` was
  expected, which looks exactly like broken idempotency. The tempting next move is to go and
  "fix" working code.
- **How it was noticed:** the same behaviour already had a passing integration test asserting
  200, the same user id and exactly one organisation created. Two sources disagreeing meant
  one of them was lying, and the malformed step was the only one in the script quoting its
  payload that way.
- **What changed:** the payload moved into a quoted variable. The step now also prints both
  user ids and an explicit `same user: YES/NO` rather than a bare status code, so a future
  failure is unambiguous.
- **What check proved the correction:** the rerun returned `200`, the identical user id, and
  `same user: YES`.

### 8. A decision transaction that did seven seconds of work inside a five-second limit

- **What the tool generated:** `applyManagementDecision` wrapped the whole decision in one
  interactive transaction, and both the opening `findUnique` and the closing `update` used the
  full management include: every asset with its bookings, holds and outages, the capacity pool,
  the organisation and its contract count.
- **Why it mattered:** Prisma's interactive transactions default to a 5000 ms limit. Over a
  remote Neon connection the two deep includes took about 7300 ms, so every successful decision
  rolled back and the route returned `503`. Approvals and declines were simply impossible, and
  the `try/catch` around the transaction hid the cause behind a generic service error.
- **How it was noticed:** six integration tests failed together with `503` where `200` was
  expected. The stderr carried `P2028 ... timeout ... 5000 ms, however 7374 ms passed`, which
  names the cause precisely rather than leaving it to guesswork.
- **What changed:** the transaction now holds only what has to be atomic, which is reading the
  request's status and inventory, running the recheck and writing the new status and history.
  The response is reassembled by a plain read after the transaction commits, which is the shape
  the client contract-action route already used. Raising the timeout was rejected: it would
  have hidden a transaction holding locks far longer than the work needs, and the same shape
  would have reached production.
- **What check proved the correction:** the six failures went green and the full suite reports
  120 passing. The same decision path that returned `503` now returns `200` with the manager
  history entry attached.

### 9. Test probes that quietly broke another file's fixture invariant

- **What the tool generated:** the contract draft and issue probes created their booking
  requests as `user-client-silverline`, so every probe attached a contract to `org-silverline`.
- **Why it mattered:** `org-silverline` is the fixture's deliberate no-contract organisation.
  Two other assertions rest on that: `src/data/contracts.test.ts` expects an empty contract list
  for it, and the management request-detail test expects `contractCount` to be `0`. Vitest runs
  files in parallel, so the suite passed or failed depending on which file won the race.
- **How it was noticed:** one run reported 144 of 145 passing and the next reported 145 of 145
  with no code change in between. A suite that disagrees with itself is a defect in its own
  right, so the run was repeated rather than accepted.
- **What changed:** each probe file now registers its own throwaway organisation and client in
  `beforeAll` through the real `registerClient` path, and deletes both in `afterAll`. The
  shared fixture organisations are left read-only. Loosening the two assertions was rejected:
  they guard the brief's requirement that a client with no contracts still works, which is
  required check 5's territory.
- **What check proved the correction:** the full suite was run twice back to back and reported
  145 of 145 both times.

### 10. Whole database rows spread into a client-facing response

- **What the tool generated:** `getContractForOrganisation` ended its proof and client-request
  mappers with `...proof` and `...request` rather than naming fields.
- **Why it mattered:** the spread sent the client `ProofRecord.createdByUserId`, which names the
  staff member who did the work, and `ClientRequest.history`, which is where management's own
  decision notes will land as soon as management can answer a change request. Section 6 draws
  the line at safe summaries of verified state, and a spread answers that question with
  "whatever columns happen to exist", including ones added later.
- **How it was noticed:** planning the fitter surface meant proof records would reach the client
  view for the first time, so the client mappers were read before writing to them rather than
  after. The neighbouring `toWorkOrder` already names its fields to keep `internalNotes` out,
  so the inconsistency was visible once the two were compared.
- **What changed:** both mappers now list their fields explicitly. `createdByUserId` and the
  client-request history no longer leave the data layer.
- **What check proved the correction:** the completion test serialises the whole client contract
  response and asserts it contains neither `createdByUserId` nor the work order's internal note.

## Prompts worth quoting

`CLAUDE.md` at the repo root is the standing instruction set the agent worked under, and is
the honest answer to "agent instructions" rather than any single prompt.

Two directions that changed the work materially:

- Asked for the deliberate traps in the fixtures before any code was written, which produced
  the probe queries the test suite is built around.
- "Never add useless comments" after reviewing the first pass, which tightened the comment
  rule in `CLAUDE.md` and removed three comments that only restated test names.
- "Match the requirements, dont introduce anything new", which cut two features I had proposed
  that the brief never asks for: a submit-time minimum-term warning on the request form, and
  pre-filling draft contract dates to the minimum term. It also reduced three proposed schema
  changes to two, by holding prototype proof in the OpenAPI's existing `previewUrl` as a
  capped base64 data URI rather than adding columns. Section 13 does not reward feature
  count, so pruning against the brief is worth more than the features were.

### 11. A journey test that wrote to a shared fixture organisation

- **What the tool generated:** the shortlist-to-inbox journey test shortlisted a product as
  `user-client-silverline`, writing a `ShortlistItem` onto `org-silverline`.
- **Why it was wrong:** `src/app/api/client/shortlist/route.test.ts` asserts that Silverline's
  shortlist is exactly `["product-bus-rear"]` and then exactly `[]`. Vitest runs files in
  parallel, so the journey's row appeared inside another file's assertions. This is the same
  defect as correction 9, on a different table.
- **How it was noticed:** `pnpm test` failed on `expected [ { ... } ] to deeply equal []`.
- **What changed:** the first fix loosened both of the other file's assertions, which is the
  remedy correction 9 had already considered and rejected. It was reverted. The journey test
  now registers its own throwaway organisation and client in `beforeAll` through the real
  `registerClient` path and deletes them in `afterAll`, leaving the fixture organisations
  read-only. A freshly registered client is also the more faithful subject: section 4 A.4 is
  about an account created with no contract.
- **What check proved the correction:** the full suite run three times back to back, 179 of
  179 each time, with the other file's original assertions restored.

### 12. A hook timeout the config never set

- **What surfaced:** adding that `beforeAll` pushed
  `src/app/api/client/contracts/[contractId]/actions/route.test.ts` over `Hook timed out in
  10000ms`, skipping its 12 tests. One run failed, the next passed.
- **Why it happened:** the integration project sets `testTimeout: 30_000` for remote Neon
  latency but never set `hookTimeout`, which defaults to 10 seconds. That file's `beforeAll`
  is six sequential writes and its `afterAll` is nine more, so it sat just under the default
  until one more parallel file was added.
- **What changed:** `hookTimeout: 30_000` on the integration project, matching the test
  timeout that was already there for the same reason. The hooks were not made to do less
  work, because the work is real setup, and the assertions were not touched.
- **What check proved the correction:** three consecutive full runs at 179 of 179. A single
  green run was not accepted as evidence, because the failure was intermittent.

### 13. Probe data that displaced fixture data, twice in one change

- **What the tool generated:** tests for the new management contract actions. The cancel probe
  created a confirmed booking on the fixture asset `asset-bus-101-rear` over 2027-08-01 to
  2027-09-01, and it added a twenty-first parallel test file.
- **Why it was wrong, first:** the client contract-actions probes accept contracts on that same
  asset over those same dates. The new booking made their acceptance a genuine inventory
  conflict, so three of their tests failed with 409 instead of 200. Correction 11 was about a
  shared fixture organisation; this is the same defect through shared fixture inventory.
- **Why it was wrong, second:** the added parallelism surfaced a latent flake in the dashboard
  test. Probe work orders were scheduled at 2027-01-15T13:00, earlier than the seeded
  `work-order-001` at 2027-01-16T08:30, and the dashboard lists only five upcoming jobs. Once
  enough probes existed at once, the fixture job was pushed out of the list it is asserted to
  be in.
- **How it was noticed:** `pnpm test` failed with four failures across two files that the
  change did not touch, then a rerun failed with a different single failure. Disagreeing runs
  were treated as the defect rather than retried until green.
- **What changed:** the cancel probe moved to 2029, where nothing else asserts availability.
  Creating a new asset was rejected as the fix, because adding an asset to a product changes
  the per-product free-asset counts that the availability probes assert. The probe work orders
  moved to 2027-01-20 so they sit after the seeded job rather than ahead of it. No product
  behaviour was changed to suit a test: the five-job dashboard limit stayed as it is.
- **What check proved the correction:** the full suite run three times back to back, 188 of 188
  each time, then `pnpm build`.

## Open assumptions to carry into the README

- Verification older than 30 days makes a product `confirmation_required`. The brief lists
  stale verification as a deliberate record but never defines a threshold. 30 days sits in a
  wide gap in the data: the oldest fresh record is 10 days, the newest stale one is 105.
- Timezone assumption is Europe/Jersey. Dates are compared as `YYYY-MM-DD` strings so no
  local `Date` conversion can shift a day.
- Minimum term is advisory, not enforced. Evidence is `request-002` and `contract-001` at 89
  days against a 90-day minimum. See correction 2.
- `ContractItem` carries `capacityPoolId` and nullable `unitRate` / `rateUnit` so that a
  capacity-pool allocation (section 4 B.5) and a price-on-request product can both be
  contracted. Both fields are in the OpenAPI `ContractItem`; the first schema pass omitted them.
- `contractCount` and `proofRecordIds` are returned by the API but derived at the data layer,
  never stored, so they cannot drift from the records they count.
