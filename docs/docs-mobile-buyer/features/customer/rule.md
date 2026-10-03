---
title: Buyer Customer Feature-Specification Rules
system: AISLEY
type: Documentation Rules
role: Customer / Buyer
platform: External Laravel API plus standalone Flutter client
status: Active
---

# Purpose

This document governs new and revised Customer specifications under this bundle's `features/customer/`. It adapts the Courier specification rules for Buyer contracts and Flutter handoff. It grants no Courier permissions and imports no Courier completion claims.

After copying this bundle into a Flutter repository's `docs/`, this file is `docs/features/customer/rule.md`. Read it before the matching Customer spec, including authentication. Its relative links work both in place and after copying.

## Authority and scope

- Read [progress](../../PROGRESS.md) first; identify actual Buyer implementation and the recorded backend baseline.
- Use [requirements](../../requirements.md), [workflows](../../workspace.md), [architecture](../../architecture.md), the matching spec and shared contracts for intended Customer behavior.
- Use current Laravel routes, validation, Resources, services, models and tests as implementation evidence. Locate upstream sources through [provenance](../../references/source-provenance.md); Laravel source is not included in the copied Flutter bundle.
- Reconcile conflicting intent/implementation explicitly. Record missing or contradictory behavior in [integration gaps](../../references/integration-gaps.md) before enabling affected actions.
- Flutter notes cannot change server ownership, permissions, fields, approval authority, prices or transitions.
- `customer` is the persisted role and token ability. Buyer consumes Customer and permitted shared/public APIs; Seller/Admin/Logistics/Courier endpoint permissions remain separate.
- These rules govern documentation/client handoff. They do not authorize backend changes, dependencies, migrations, seeds or a Flutter scaffold.

## Before adding or revising a spec

- Read the existing spec completely. Preserve its feature path and `spec.md` or `specs.md` filename unless a rename is requested.
- Read [agent instructions](../../AGENTS.md), shared requirements/workflows and exact prerequisite specs.
- Read [Buyer design](../../design-buyer.md) for presentation; web layouts, Tailwind and React packages are upstream context.
- Read [authentication](../../api/authentication.md), [endpoints](../../api/endpoints.md), [DTOs](../../api/contracts.md) and [field index](../../api/field-index.md) for consumed APIs.
- Read [registration requirements](../../references/user-registration-requirements.md) for approval/registration and both [upload policy](../../references/file-upload-requirements.md) and [Flutter transport](../../flutter-file-uploads.md) for uploads.
- Read [addresses/maps](../../maps-location-api.md) for PSGC/location and [messaging](../../api/messaging.md) for communication channels.
- When backend source is available, inspect exact routes, controllers, Requests, Resources, services and tests. Use targeted `rg`; distinguish inspected test sources from tests actually run.
- Identify implemented, scaffold-only, planned and unavailable behavior, dependencies and gaps before proposing requests. Reuse verified endpoints instead of duplicating them.

## Preserve the document and implementation boundary

- Preserve useful requirements, acceptance criteria, sources and open decisions. Replace stale wording with grounded current behavior or an explicit target.
- Preserve role names, methods/prefixes, approval authority and status meaning. Courier affiliation, hub, vehicle, scan, POD and cash rules cannot become Buyer permissions.
- Record backend availability separately from `flutter_status`. Every existing Buyer Flutter feature stays pending until actual implementation evidence changes its status.
- Include the backend commit/API version and spec revision. Preserve earlier provenance; record a new baseline when revalidating a material contract.
- Distinguish contract maturity from code completion. Reviewed requirements, mocks, routes and backend/storefront tests do not certify mobile implementation.
- Mark criteria complete only from specific implementation/verification evidence. Leave device, browser, live integration and unresolved gates unchecked.

## Required spec structure

New or revised Customer specs must answer these questions in order:

1. **WHAT** — purpose, actors, scope, non-goals, backend availability and Flutter implementation boundary.
2. **MUST** — authentication, approval/consent, ownership, validation, business states, privacy, errors, retries and testable acceptance criteria.
3. **HOW** — exact API contract, typed data flow, client responsibilities, dependencies, verification, rollout and unresolved decisions.

Use `## WHAT`, `## MUST` and `## HOW` headings. Include a lifecycle/request flow when state changes matter. Name the actor permitted to request or approve each transition and what Buyer may display, submit, retry or leave unavailable.

Separate implemented behavior, approved targets and unresolved gaps. Write requirements demonstrable through a contract, implementation or test.

## Required endpoint contract

For every consumed endpoint document:

- Exact HTTP method and `/api/v1/...` path, availability and adopted backend version.
- Public/authenticated access, Customer role/status/approval, consent exceptions and server-derived ownership.
- Content type, required/optional fields, prohibited authority fields and a minimal request example.
- Response status/envelope, typed fields, nullability, JSON-to-Dart casing and a minimal response example.
- Validation field errors, stable codes, unauthorized/forbidden/not-found, conflict and throttling behavior.
- Required revisions/keys, replay support, uncertain-response reconciliation, pagination/cursors and ordering.
- Public/private cache behavior, invalidation and private media authorization.
- Controller/Request/Resource/service references and inspected or executed test evidence.

Shared guides may supply reusable definitions; keep feature methods, fields, gates and examples explicit enough to implement without opening Laravel for basic request details.

Label future routes conceptual and unavailable. Optional public personalization does not establish a private-read guarantee; a response field alone cannot grant permission.

## Customer authentication and consent

- Login sends `device_name` for Customer-scoped Sanctum bearer tokens on Android and local web. Storefront cookie/CSRF authentication is a separate contract.
- Login returns the token once, sent as `Authorization: Bearer`. `/me` is identity, not an applicant approval-polling API.
- Model checking-session, signed-out, submitting, active, pending/rejected/suspended/inactive denial, consent-required, storage failure, offline and timeout using documented results.
- Registration supports profile/credentials and returns pending/no token. Address/ID evidence, applicant polling and self-approval are unavailable; do not copy Courier registration fields.
- Active access is server-derived and Admin-approved. Token abilities do not imply extra middleware beyond implemented stored-role/status checks.
- Resolve `/me` and consent before protected navigation. Read current Terms/Privacy and require explicit acceptance; stale versions require renewed review.
- `POLICY_CONSENT_REQUIRED` preserves valid identity and blocks protected work. Never accept automatically or replay a blocked write.
- Logout, account password change and reset have different revocation effects; use the exact [authentication contract](../../api/authentication.md).
- Reset mail targets the trusted storefront. Native reset links, refresh-token endpoints and device/session registries remain unavailable unless implemented separately.

## Server-owned shopping and communication rules

- Laravel owns visibility, stock, prices, shipping serviceability/quotes, vouchers, totals, placement and transitions. Client calculations never authorize placement.
- Buy Now leaves Cart unchanged. Cart increments, quotes and placement have different retry contracts; document each instead of assigning universal idempotency.
- Keep quote/revision/key and payload consistent for supported replay. Stale/conflicting intent requires reviewed refresh; uncertain responses are not proof of failure.
- Address Book edits cannot alter placed snapshots. Order cancellation/correction follows owned capabilities, timing and concurrency rules.
- Reviews require server-verified delivered purchase. Q&A and photo retries use their actual contracts.
- Shop, Logistics and Courier conversation identities/envelopes remain separate. Server participants, eligibility and read-only transitions determine contact rights.
- Buyer may send permitted messages; it cannot accept tasks, scan parcels, submit POD, collect cash, choose hubs or approve accounts.
- Support permits documented requester create/reply/read. Admin assignment/status powers, linked records and attachments must not be invented.
- Inbox notifications are separate from native push. Bazaar/MoneyFest, online payments, returns/refunds and live Courier GPS remain deferred unless contracts change.

## Flutter handoff and platform rules

- Align screens, typed models, repositories and state ownership with [architecture](../../architecture.md). Spec length does not change Dart source modularity.
- Document Android secure storage, reviewed browser boundaries, restoration/write/delete failure and account cleanup. Provide no plaintext fallback.
- Buyer uses `http://localhost:8766`, separate from Courier `8765`. Document exact-origin CORS/method/header requirements through the backend owner; keep stateful cookies separate from token testing.
- Use native/web conditional adapters: selected browser files use bytes/streams; OS paths stay native. Specify multipart/nested keys, type/size limits, cancellation and partial/uncertain upload outcomes.
- Private media requires authenticated delivery and account-scoped cleanup. Never construct storage URLs or put tokens in URLs.
- Export approved PSGC JSON with revision/manifest into Dart assets. Preserve Region → Province → City/Municipality → Barangay cascading and fallback; Flutter cannot import workspace JavaScript data/selectors.
- Apply Geoapify/map requirements, attribution, approved key boundaries and explicit GPS permission. Native rendering remains a dependency decision; failed optional pins preserve manual address saving.
- Specify loading, empty, unavailable, forbidden, stale, partial, retry, success and offline states without fake records/success.
- Apply light-only [Buyer design](../../design-buyer.md), 48×48 logical-pixel targets, labels/text scaling, keyboard focus/insets and predictable Android/browser back/cancel.

## Privacy and reliability

- Keep passwords, tokens, reset links, raw storage paths, evidence bytes and unnecessary PII out of DTOs, logs, screenshots, analytics and ordinary storage.
- Separate public/guest caches from private/account caches. Guest recency contains bounded public ID/time hints; merge only after verified authentication.
- Clear private drafts, quotes, uploads/previews, transcripts, history, read markers and pending keys on logout, identity switch or account loss. Ignore obsolete asynchronous responses.
- Handle resource denial locally when identity stays valid. Consent gating differs from session loss; neither may expose another account's data.
- Do not queue offline writes or blindly repeat uncertain actions. Follow the owning endpoint's replay/reconciliation contract.
- Separate provider/email/notification failure from committed decisions. Foreground polling does not promise background push or realtime delivery.

## Testing and review gate

- Plan contract tests for roles/ownership, approval/consent, prohibited fields, nullable DTOs, validation/errors, replay/conflicts and cleanup.
- Cover storage failure/restoration, revocation, password effects, stale policies and account switching for auth-dependent changes.
- Cover Android/browser uploads, private media, checkout response loss/retry, channel read-only changes and accessibility for affected flows.
- Run relevant configured Flutter formatting/analyzer/tests/builds for implementation changes. Backend tests require the authorized backend task/environment; source inspection is not an executed passing test.
- Mocks cannot replace installed-Android, local-browser and live-Laravel acceptance. Follow [verification](../../verification.md); leave remaining gates open.
- Check revised length, WHAT/MUST/HOW, portable links, exact examples, baseline metadata, permissions and copies.
- Append dated evidence to destination progress. In this monorepo also append app-wide progress; preserve histories and the 150-line archive rule.

## Spec length rule and skill precedence

- Every new or revised Customer spec under `features/customer/`, including `customer-auth/spec.md`, must contain **200–230 physical lines inclusive** after formatting.
- This local rule overrides the `feature-spec` skill's 120–160-line preference and instruction to prefer fewer lines for simple features for these Customer specs. Read this rule before invoking the skill; follow its other compatible instructions.
- Count frontmatter, headings, blank lines, code blocks, tables and checklists. Verify using `wc -l` on a newline-terminated file.
- Use meaningful examples, state/error behavior, privacy, acceptance and handoff details. Do not pad, duplicate prose or compress lines to evade the requirement.
- If necessary, split genuinely independent contracts and link them; each resulting Customer feature spec follows the range. Obtain authorization before unrelated restructuring.
- The range excludes this rule, `AGENTS.md`, reference/API guides, shared-policy specs and Dart code. Dart modularity remains governed by agent instructions.
- Existing short specs remain baselines until individually revised. They are not certified implementation-ready by adding this rule; no bulk rewrite is required.
- Correct an out-of-range revision before calling it ready. Valid length alone cannot establish complete contracts or mobile acceptance.

## Final checklist before handoff

Use these unchecked review gates for each new or revised Customer spec:

- [ ] Current contract/source evidence and backend version are identified.
- [ ] Backend availability, pending Flutter work and dependencies are explicit.
- [ ] WHAT/MUST/HOW preserve Customer authority, consent, ownership and non-goals.
- [ ] Endpoints provide exact methods, fields, DTOs, errors and retry behavior.
- [ ] Android/web storage, uploads, privacy and cleanup are documented.
- [ ] Accessibility, loading/errors/back/keyboard and acceptance are specified.
- [ ] The revised Customer spec contains 200–230 physical lines without filler.
- [ ] Links, copies, actual verification and dated progress are checked.
