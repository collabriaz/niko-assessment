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

## Prompts worth quoting

`CLAUDE.md` at the repo root is the standing instruction set the agent worked under, and is
the honest answer to "agent instructions" rather than any single prompt.

Two directions that changed the work materially:

- Asked for the deliberate traps in the fixtures before any code was written, which produced
  the probe queries the test suite is built around.
- "Never add useless comments" after reviewing the first pass, which tightened the comment
  rule in `CLAUDE.md` and removed three comments that only restated test names.

## Open assumptions to carry into the README

- Verification older than 30 days makes a product `confirmation_required`. The brief lists
  stale verification as a deliberate record but never defines a threshold. 30 days sits in a
  wide gap in the data: the oldest fresh record is 10 days, the newest stale one is 105.
- Timezone assumption is Europe/Jersey. Dates are compared as `YYYY-MM-DD` strings so no
  local `Date` conversion can shift a day.
