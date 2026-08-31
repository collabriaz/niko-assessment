# Technical assessment

## Connected advertising operations prototype

**Issued by:** Frameworks
**Candidate edition:** Fictional and sanitised
**Issue date:** 29 August 2026
**Delivery window:** 2 to 3 calendar days from receiving the assessment
**Confidentiality:** Private assessment. Do not publish or reuse without written permission.

## 1. Why we are running this assessment

Frameworks builds practical business applications and automation for Jersey companies. We are selecting a developer, or a small team with one clearly accountable lead, for longer-term product work.

This assessment represents a connected slice of a real type of project. The names, rates, assets, dates and organisations in the supplied data are fictional. Your submission is assessment evidence, not free production code.

We want to see how you connect three interfaces to one operating model:

1. a web interface for management of the advertising agency;
2. a mobile-first app for engineers and fitters;
3. a client portal for product discovery, contract management and service visibility.

A collection of disconnected screens will not meet the brief. Important changes must flow through the shared data and appear in the appropriate interface.

## 2. Fictional business context

Island Media Co sells out-of-home advertising on buses, transport-hub screens, doors, delivery vans and charging-station displays.

The agency manages enquiries, inventory, contracts, campaigns, creative readiness, fitting work and proof of completion. A small management team coordinates the work. Engineers and fitters need a simple mobile view of assigned jobs. Clients need a self-service account.

A client does not need an existing contract to create an account. A new client should be able to sign up, browse all available products and services, shortlist an option and submit a non-binding request.

Once a contract is issued, the client should manage it through the same login. They should see the contract state, campaign/service progress, actions requiring attention and verified proof when work is completed.

## 3. Roles

Four roles use the prototype: public visitor / prospective client, existing client, agency manager, and engineer/fitter. What each role can do is defined by the scenarios in section 4 and the interface requirements in section 5, not repeated here.

Use a simple prototype role/account switcher for the seeded manager, fitter and existing-client records. The new-client registration flow must work and persist. Real production authentication remains outside the build.

## 4. Mandatory connected scenarios

### Scenario A: prospective client signs up and discovers services

1. A visitor browses Island Media Co products.
2. They filter by requested dates, media type, location and maximum indicative monthly budget.
3. They open a product and understand price, minimum term, creative specification and calculated availability.
4. They create a client account and organisation without having a contract.
5. Their session and client account persist across reload.
6. They add a product to a shortlist and submit a non-binding booking request.

An account with no contracts must have a useful portal home and catalogue journey, not a broken or empty experience.

### Scenario B: management turns a request into a contract and campaign

1. The manager sees the new request in an attention-led dashboard.
2. They open it, review the client, requested dates, product and current availability.
3. They can request more information, decline or approve.
4. Approval must recheck availability and handle a conflict safely.
5. For an approvable request, the manager selects an asset or pool allocation and creates a draft contract.
6. They issue the contract to the client.
7. The client sees the issued contract in their portal.
8. The client can accept the prototype contract or request changes.
9. Contract acceptance creates or activates the connected campaign and booking state.

This is a prototype acceptance flow, not a legal electronic signature.

### Scenario C: management creates field work

1. The manager creates an installation or fitting work order for the campaign.
2. They set the job type, scheduled date, asset/location, instructions and assigned fitter.
3. The work order appears in the fitter's mobile app.
4. The manager can see the latest field status.

### Scenario D: fitter completes work and client sees service progress

1. The fitter opens the assigned job on a mobile-sized screen.
2. They can move it through sensible states such as `assigned`, `travelling`, `on_site`, `blocked` and `completed`.
3. A blocked update requires a reason.
4. Completion requires a note and at least one proof attachment or captured-image placeholder.
5. The update persists and creates a service-history event.
6. Management sees the completed job and proof.
7. The client sees an updated service timeline and proof in the contract/campaign view.

The proof may use local prototype storage, fixture-backed metadata or another clearly explained shortcut. Do not require a real object-storage account.

## 5. Interface requirements

### Management web interface

Provide a desktop-oriented management surface with:

- an attention-led home or dashboard;
- booking-request list and detail;
- client/account detail;
- product, asset and availability context;
- contract creation and issue action;
- campaign/booking visibility;
- work-order creation, assignment and status;
- service history and proof visibility.

You do not need to build unrestricted CRUD for every entity. The connected scenarios must work through a coherent management interface.

### Engineer and fitter mobile app

Provide a distinct mobile-first experience, suitable for a phone viewport, with:

- today's and upcoming assigned jobs;
- job detail, location/asset, contact-safe instructions and scheduled time;
- prominent progress actions;
- blocked reason;
- completion note and proof capture/upload;
- clear offline, retry or failed-upload treatment, even if the prototype only simulates it.

For this assessment, an installable PWA or clearly separated mobile web surface is acceptable. A native App Store or Play Store build is not required. Explain what you would choose for production and why.

### Client portal

Provide a client-facing account with:

- working fictional registration;
- a useful no-contract state;
- full product/service catalogue and date-based discovery;
- shortlist and non-binding request submission;
- contract list and detail;
- prototype contract acceptance or change request;
- campaign/service timeline;
- actions requiring client attention;
- proof supplied after field completion;
- change and cancellation requests that remain pending management review.

The client portal must never imply that a request, cancellation or change is approved before management changes the underlying state.

### Visual consistency

Pick one simple visual style for Island Media Co (a colour palette, one typeface, basic spacing/radius choices) and apply it consistently across all three interfaces. A logo or wordmark is a nice touch but not graded. This is not a design or branding assessment, so do not spend time on a full brand pack, app icon or illustration set for the six products. Do not use Frameworks brand assets or imitate a real client identity.

## 6. Business rules

### Date handling

- Use the supplied `fixtureClock` as the prototype's current time.
- Date ranges use half-open intervals: start is inclusive, end is exclusive.
- A request or contract must end after it starts.
- Compare calendar dates consistently and state your timezone assumption.

### Products, assets and capacity

- A product describes what is sold.
- A physical asset is the named vehicle, door, screen or location used to deliver it.
- A capacity pool represents shared capacity such as a digital advertising loop.
- Do not collapse product, physical asset, booking, contract and campaign into one record.

### Exclusive physical assets

A product using `exclusive_asset` allocation is available when at least one active physical asset has no overlapping:

- confirmed booking;
- active hold;
- confirmed outage.

### Capacity pools

A product using `capacity_pool` allocation is available when overlapping confirmed bookings and active holds use less than the pool capacity.

### Holds

- A hold blocks inventory only while `expiresAt` is later than `fixtureClock`.
- An expired hold does not block availability.
- The server must recheck this rule when approval or contract activation is attempted.

### Rates

- Display the supplied native rate label.
- Use `monthlyEquivalent` only for the budget filter.
- A null price means `Price on request`, not zero.
- Products without a comparable monthly equivalent must not silently appear as within budget.

### Client registration and access

- Registration creates a fictional user and client organisation.
- A client account may exist with zero contracts.
- Client-facing queries must be scoped to that organisation in the prototype model.
- The production note must explain real identity verification, tenant isolation and record-level authorisation.

### Contract lifecycle

Support at least:

- `draft`;
- `issued`;
- `change_requested`;
- `accepted`;
- `active`;
- `completed`;
- `cancelled`.

The prototype should preserve contract version, dates, items, total, status and event history. A client action must not silently rewrite an issued contract.

### Work-order lifecycle

Support at least:

- `draft`;
- `assigned`;
- `travelling`;
- `on_site`;
- `blocked`;
- `completed`.

A blocked job needs a reason. A completed job needs a completion note and proof record.

### Service visibility

Client-visible service events should be safe summaries of verified operational state. Do not expose private internal notes or unrelated client data.

### Requests and idempotency

- `Idempotency-Key` is required for booking-request submission and other material create actions where repetition could duplicate work.
- Repeating the same request with the same key returns the existing record.
- A new key creates a new request.
- Material state changes add history with actor, time, action and note/reason where applicable.

## 7. Supplied files

The candidate pack contains:

- `fixtures/island-media-fixtures.json`;
- `api/openapi.yaml`;
- `SUBMISSION_TEMPLATE.md`.

You may reshape the fixtures inside your application, but preserve their meaning and IDs. You may adapt endpoint naming if your implementation remains equivalent to the API contract and you explain the change.

Some records are intentionally inconvenient. They include overlapping bookings, an expired hold, an active hold, an outage, a capacity pool, a price-on-request product, stale verification, a client with no contract, issued and active contracts, a scheduled work order and different service-history states. These are not mistakes to delete.

## 8. Technical expectations

Required:

- Next.js, React and TypeScript;
- three clearly distinguishable interfaces or role-based surfaces;
- a consistent, candidate-chosen visual style (colours, type, spacing) applied across all three interfaces;
- responsive management and client web views;
- a mobile-first fitter experience;
- a clear client/server or API boundary;
- working prototype registration for a new client;
- important account, request, contract, work-order and status changes that persist across reload;
- deterministic fixture seeding;
- proportionate automated tests;
- loading, empty, validation, success, conflict, retry and service-error states;
- sensible component, domain and data boundaries;
- no secrets, credentials or production data;
- a deployed preview that does not require our card details or a chargeable account.

A lightweight local database, durable server store or another simple persistence approach is acceptable. Explain the prototype shortcut and the production alternative.

We are not prescribing a styling library, ORM, hosting provider, mobile framework or test framework. Choose tools you understand and can explain.

## 9. Required automated checks

Include automated tests covering at least:

1. overlapping exclusive-asset bookings;
2. expired versus active holds;
3. capacity-pool availability;
4. duplicate booking-request submission with the same idempotency key;
5. a client account with no contracts can still use the catalogue;
6. contract issue and client acceptance or change-request behaviour;
7. blocked work order requires a reason;
8. completed work order requires proof and updates service history;
9. client organisation A cannot retrieve organisation B's contract through the prototype API model;
10. one important connected UI journey.

You may use focused unit/integration tests instead of one large end-to-end suite. The checks must run from documented commands.

## 10. Required deliverables

Submit all of the following:

1. **Private source repository** shared with Frameworks reviewers.
2. **Deployed preview** with seeded fictional data and clear role/account switching.
3. **README** with setup, commands, architecture summary, assumptions, deliberate exclusions and known limitations.
4. **Automated tests** with a documented command and passing output.
5. **Short walkthrough video**, target 5 to 8 minutes, covering all three interfaces and one connected scenario.
6. **Productionisation note**, roughly 1 to 2 pages.
7. **Completed `SUBMISSION_TEMPLATE.md`**, including your AI prompts or agent instructions, the one AI-generated mistake you caught and corrected, and your active-vs-unattended time record.
8. **A consistent visual style** (colours, type, spacing) applied across all three interfaces.

### Productionisation note

Cover:

- production architecture and component responsibilities, including PWA vs. native for mobile, idempotency, audit, webhooks/reconciliation, and error monitoring/background jobs;
- core data model and source-of-truth boundaries, including external CRM, ledger, file-storage and media-scheduling boundaries;
- real client signup, identity verification and recovery;
- manager, client and fitter roles, with tenant, record and field-level permissions;
- contract versioning and the electronic-signature boundary;
- proof files, malware scanning, signed access, and offline/retry behaviour for field staff;
- environments, CI/CD, migrations, backups, rollback, secrets and dependency controls;
- approximate operating cost, maintenance approach and what you would validate before production development.

Tool names without purpose or trade-offs do not help us assess the design.

## 11. Deliberate exclusions

Do not spend assessment time on:

- production-grade authentication or identity verification;
- real electronic signature;
- payment processing;
- live email, SMS or push notifications;
- real accounting, CRM, production or media-scheduling integrations;
- third-party media-owner onboarding;
- App Store or Play Store deployment;
- full offline synchronisation;
- AI media planning or chatbots;
- programmatic advertising;
- production security certification;
- a full map product;
- a full brand or illustration system.

A role switcher for seeded roles, fictional registration, prototype contract acceptance, local proof handling and a mock API are correct shortcuts here.

## 12. A few things worth noticing

These are prompts, not extra feature requirements:

- What does management need to see first when opening the system?
- What should a new client with no contract see after signing up?
- What information is safe for the client, and what remains internal?
- What happens if a fitter has weak signal or repeats an upload?
- What keeps three interfaces inexpensive to maintain six months later?

If every required scenario works, one small improvement that reduces operator effort, helps a fitter complete work or increases client trust can strengthen the submission. Explain why you chose it. A useful control or thoughtful simplification is worth more than unfinished feature breadth.

## 13. Evaluation

| Area | Weight |
|---|---:|
| Core connected scenarios and business rules | 35 |
| Product judgement across all three interfaces | 15 |
| Engineering quality | 15 |
| Production architecture, security and maintainability | 15 |
| Useful initiative and constructive challenge | 10 |
| Communication and delivery discipline | 5 |
| AI-tool use and verification | 5 |
| Total | 100 |

Useful initiative scores only after the mandatory scenarios work. We do not reward feature count, gratuitous AI or unnecessary infrastructure.

A serious security, ownership, integrity or communication failure can override the weighted score.

## 14. Live finalist review

Selected candidates will join a 50-minute review. Be ready to:

- run the application and tests;
- demonstrate the connected client, management and fitter journey;
- explain the product, asset, contract, campaign and work-order model;
- show one trade-off or weakness you would address next;
- trace one state change through API, persistence, history and each relevant interface;
- make one small bounded change;
- explain the AI-generated error you corrected.

We may ask about any submitted code. A polished submission that the accountable candidate cannot explain will not progress.

## 15. Timeline and communication

- Delivery window: **2 to 3 calendar days** from receiving the assessment.
- Prioritisation and honest limitations are part of the assessment.
- Tell us early if an ambiguity or blocker would materially change the result.
- Send all questions and clarification requests through this Upwork chat.
- Undisclosed contributors or materially misleading time reporting are integrity failures.

## 16. Ownership, confidentiality and portfolio use

- Keep the repository private.
- Do not include real client, personal or production data.
- Do not use production credentials or systems.
- Frameworks may use the submission for candidate evaluation. Any production reuse or ownership transfer requires a separate written agreement.
- Disclose any pre-existing generic tools or libraries included in the submission.
- Do not publish screenshots, code, video or the brief in a portfolio without written Frameworks approval.
- If several people contribute, name each person and state exactly what they did.

## 17. Before you start

Reply in Upwork confirming:

1. the accountable delivery lead;
2. any other contributor;
3. acceptance of the 2 to 3 calendar-day delivery window;
4. that you will create a private repository and invite `@niko-frameworks` as a collaborator;
5. your intended web, mobile/PWA and deployment approach;
6. that you understand the confidentiality and portfolio restrictions.

Build one connected operating model. Make the required scenarios work. Prove the hand-offs.
