# AI and development log

Working notes kept while building. Feeds these sections of `SUBMISSION_TEMPLATE.md`:
Active time, AI and development tools, Representative prompts, and AI-generated mistake.

Kept as work happens rather than reconstructed at the end. Section 15 of the brief treats
misleading time reporting as an integrity failure.

## Time record

Delivery started: 2026-08-31, 13:15
Delivery submitted:

| Date       | Session       | Active | Unattended agent | What                                                                                                  |
| ---------- | ------------- | ------ | ---------------- | ----------------------------------------------------------------------------------------------------- |
| 2026-08-31 | 13:15 - 14:45 | 1h 30m | 0                | Read the brief, mapped the fixture traps, chose the stack, wrote the availability engine and its tests |
| 2026-08-31 | 19:45 - 20:55 | 1h 10m | 0                | Audited the build against the brief, settled minimum term as advisory, corrected the contract-item schema against the OpenAPI, wrote the shared fixture seed, then the org-scoped reads, per-asset availability and the catalogue endpoints |

Active means at the keyboard reading, directing, reviewing or writing. Unattended means the
agent was running while I was not watching.

## Tools

| Tool               | Contribution                                                                                   | How the output was verified                                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code (Opus) | Fixture analysis, `src/domain/` availability engine, its test suite, `CLAUDE.md` project rules | `pnpm test` (12/12). Every expected value in the suite was traced back to the specific fixture records before the suite was run |

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
