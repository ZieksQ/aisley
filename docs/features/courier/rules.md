---
title: Courier Feature-Specification Rules
system: AISLEY
type: Documentation Rules
role: Courier / Rider
platform: Laravel API plus external Flutter mobile client
status: Active
---

# Purpose

This file governs how Courier feature specifications are added, updated, or revised.
Courier UI is implemented in the separate Flutter project; this repository documents and implements the Laravel API consumed by that app.
The rules keep the backend contract, the copied Flutter documentation, and the external client aligned.

## Authority and scope

- Treat the implemented API, migrations, models, tests, and current `docs/PROGRESS.md` as evidence of what exists.
- Treat `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, and `docs/domains/Courier.md` as shared canonical context.
- Treat `docs/domains/Logistics.md` as canonical whenever a Courier feature uses affiliation, hub, assignment, or Logistics authority.
- Treat the matching file under `docs/features/courier/` as the feature contract after it is reviewed and marked implementation-ready.
- Treat `docs/order-logistics-flow-decisions.md` as historical rationale only; it cannot authorize an endpoint or migration.
- A copied spec in the Flutter project must retain the same behavior and endpoint contract as this source document.
- A Flutter copy may add client implementation notes, but it must not change server authority, permissions, fields, or state transitions.
- Do not make a Courier web page, React component, or browser-cookie client in `src/`.
- Courier screens, secure token storage, mobile networking, and mobile accessibility belong in the external Flutter project.

## Before adding or revising a spec

- Read `docs/PROGRESS.md` first and identify the latest implemented Courier/API work.
- Read the current feature spec completely before replacing, shortening, or expanding it.
- Read the Courier domain and the Logistics domain for role boundaries and approval ownership.
- Read the Courier sections of `docs/requirements.md`, `docs/workspace.md`, and `docs/schema.md`.
- Read `docs/architecture.md` for backend/API boundaries and the external mobile-app boundary.
- Read `docs/references/user-registration-requirements.md` for registration or approval work.
- Read `docs/references/file-upload-requirements.md` for evidence, image, proof, or other upload work.
- Read `docs/design.md` only for shared web design context; do not copy React layout rules into Flutter requirements.
- Inspect `src/api/routes/api.php`, the relevant controller, Form Request, resource, service, model, migration, and tests.
- Use `rg --files` and targeted `rg` searches to find existing names, routes, enums, and relationship constraints.
- Record whether the feature is implemented, scaffolded, partially implemented, deferred, or absent.
- Identify every dependency and write down whether it is implemented, planned, or blocking.
- Check for an existing endpoint before proposing a new one; do not duplicate an existing route under a different name.
- Check whether the current schema can represent the feature before specifying new fields or tables.

## Preserve the existing document safely

- Keep the existing feature path and filename unless a rename is explicitly requested.
- Preserve useful requirements, acceptance criteria, open decisions, and source references from the old spec.
- Remove stale behavior only when the replacement is stated and grounded in current code or canonical docs.
- Do not silently change role names, ownership, approval authority, endpoint prefixes, or status meaning.
- Do not describe a feature as implemented because a UI mock, seed record, or draft route exists.
- Use `status`, `implementation_status`, and `canonical` metadata to distinguish contract maturity from code completion.
- Mark a spec `canonical: true` only when it is the reviewed source contract for that feature.
- Mark an unimplemented or conceptual spec `canonical: false` and state that it cannot be used to invent API behavior.
- Increment the spec version when the contract, endpoint, field, permission, or state behavior changes materially.
- Add `backend_contract_commit` or an equivalent API-version field when the spec is consumed by Flutter.

## Required spec structure

Every Courier feature spec must answer these questions in this order:

1. **WHAT** — purpose, actors, scope, non-goals, and current implementation boundary.
2. **MUST** — authorization, ownership, validation, state rules, privacy, errors, retries, and acceptance criteria.
3. **HOW** — API contract, data flow, affected backend/client components, testing, rollout, and observability.

Include a short lifecycle or request-flow diagram when the feature has meaningful state changes.
State which actions belong to Logistics, Courier, Seller, Customer, or Admin.
State which actions the Flutter client may display, request, retry, or never perform.
Keep non-goals explicit so a future author does not expand the feature by assumption.
Use testable requirements and acceptance checkboxes; avoid vague goals such as “handle securely.”
Separate current behavior, approved future behavior, and unresolved decisions under distinct headings.

## Required endpoint contract

Every spec that a Flutter client could consume must include an endpoint table or equivalent list.
For each endpoint document:

- HTTP method and exact `/api/v1/courier/...` path.
- Whether the endpoint is implemented, scaffold-only, planned, or unavailable.
- Required authentication middleware and required Courier role/status/affiliation checks.
- Allowed actor and server-derived ownership scope.
- Request content type, required fields, optional fields, prohibited fields, and example payload.
- Response status codes, response envelope/DTO shape, nullable fields, and a minimal example response.
- Stable error code, field-error, authorization, conflict, throttling, and not-found behavior.
- Idempotency-key requirements, retry safety, pagination/cursor rules, and ordering guarantees.
- Cache/no-store behavior and whether the response contains private or public data.
- Related migration/model/service and the test coverage that proves the contract.

Do not list an endpoint as usable merely because it appears in a draft.
Use a clearly labeled “conceptual” block for future routes, and repeat that the route is not available to Flutter.
Do not leave the client to infer request names, status values, ownership, or error semantics.

## Backend and data rules

- Use the `/api/v1` prefix for all new API routes.
- Keep UUID identifiers and server-derived ownership; never accept a client-selected `courier_id`, `hub_id`, `organization_id`, role, ability, reviewer, or status as authority.
- Enforce Courier access with Sanctum, the persisted `courier` role, active account status, approved affiliation, active Logistics organization, and valid sole hub.
- Keep the MVP boundary of one Courier affiliation and one operational hub per Logistics organization.
- Keep first-mile and final-mile assignments independent; completing one leg never grants the other.
- Use lowercase `snake_case` persisted/API values and human-readable UI labels; do not introduce uppercase source labels as new values.
- Store enum-like database columns as strings and cast them to PHP enums; never add native PostgreSQL enum columns.
- Never modify an executed migration; specify an additive migration when schema change is approved.
- Use transactional writes, row locks or compare-and-update guards, stable idempotency keys, and append-only history for state changes.
- Keep Seller labels and Logistics waybills as separate linked artifacts when the feature concerns shipment documents.
- Do not put detailed physical shipment milestones directly in `orders.status` without an approved shared migration.
- Do not invent Shipment, Parcel, Scan, Delivery Task, assignment, or proof records while the shared operational schema is deferred.

## External Flutter handoff

- Write the spec so a Flutter author can implement the client without opening Laravel source code for basic request details.
- Include the backend API version or commit used to validate every endpoint.
- Include Dart-friendly field names or an explicit JSON-to-Dart mapping when the API uses different naming conventions.
- Identify multipart fields and nested keys exactly; document file MIME, size, progress, cancellation, and retry behavior.
- Describe auth states such as checking session, signed out, pending approval, authenticated, rejected, suspended, invalid affiliation, and recoverable network failure.
- State that tokens are returned once at login, stored only in OS secure storage, and sent as `Authorization: Bearer`.
- State that `/me` is an identity endpoint, not a pending-approval status endpoint, unless the backend explicitly provides that behavior.
- Provide example `401`, `403`, `409`, `422`, `429`, timeout, and offline handling where relevant.
- Describe loading, empty, forbidden, unavailable, retry, success, and stale-data UI states without fabricating data.
- Explain which fields are safe to show to a Courier and which Buyer/Seller/address/evidence fields must be redacted.
- Identify whether the client may cache a response, for how long, and how it must invalidate stale authorization or task data.
- State whether a mutation is safe to retry and how the client should handle an uncertain response.
- Do not require Flutter to reproduce Eloquent models, SQL, PostgreSQL behavior, or backend authorization decisions.
- Do not require a map package, routing vendor, push provider, or storage vendor unless the API contract explicitly requires it.

## Status and dependency rules

- Name the exact prerequisite feature when the Courier spec depends on Seller readiness, Logistics assignment, or the shared shipment schema.
- Use the canonical detailed physical states only after the shared Shipment/Delivery Task contract is approved.
- Do not map a generic `assigned` or `picked_up` OrderStatus to a physical Courier action without an explicit server response.
- Document both task legs when a feature can serve first mile, final mile, or both.
- State the actor allowed to create, offer, accept, confirm, cancel, or reverse each transition.
- State what happens when a prerequisite is missing: unavailable response, scaffold, or a documented contract gap.
- Keep notification/email delivery post-commit; provider failure must not reverse a committed business decision.
- Keep route optimization provider-neutral until a separate Logistics/map contract is approved.
- Registration currently uses PSGC/manual address fields and does not require Courier coordinates or map pins.
- If a future feature requires location, read the current maps/location policy and specify consent, precision, retention, and fallback.

## Privacy and security requirements

- Never expose passwords, bearer tokens, token hashes, private evidence bytes, raw storage paths, or private reviewer notes.
- Serve private evidence and proof through authorized, no-store endpoints or approved signed delivery; never expose predictable blob paths.
- Minimize Buyer and Seller data to the fields needed for the active task and authorized Courier action.
- Keep all tasks, assignments, scans, incidents, messages, caches, and events scoped to the authenticated Courier and Logistics organization.
- Reject cross-role same-email confusion and cross-organization identifiers without revealing whether another record exists.
- Define rate limits, request correlation, audit events, and redaction rules for every sensitive mutation.
- Document notification and external-provider failures separately from the committed state.
- Never let offline data bypass approval, status, ownership, or server revalidation.

## Testing and review gate

- Add API tests for role isolation, account status, affiliation status, sole-hub scope, ownership, prohibited fields, and IDOR attempts.
- Add tests for valid transitions, invalid transitions, stale revisions, concurrent requests, duplicate retries, and idempotency.
- Add tests for every documented validation and error code, including upload type/size/signature checks when applicable.
- Add DTO privacy tests proving that secrets, raw paths, private evidence, and unnecessary PII are absent.
- Add Flutter contract tests or fixtures for JSON parsing, multipart names, auth-state mapping, token storage failures, and server errors.
- Mocks may support deterministic unit/widget tests, but they cannot replace API contract verification against the Laravel backend.
- Run the relevant Laravel tests and Flutter analyzer/test commands before marking a spec implementation-ready.
- Verify the spec line count, links, endpoint examples, and backend commit metadata before review.
- Ask whether every acceptance criterion can be demonstrated by an API or UI test; unresolved criteria remain open.
- Update the copied spec in the Flutter project when a backend contract changes.
- Record the adopted backend commit/API version in the Flutter project's own progress log.
- Append a dated implementation or documentation entry to the repository `docs/PROGRESS.md`.

## Spec length rule

- Each Courier feature spec must be between **200 and 230 physical lines**, inclusive, after formatting.
- This range applies to Courier feature-spec files, not to this rules document itself.
- Count blank lines, headings, code blocks, frontmatter, and checklist lines in that total.
- Reach the range with endpoint examples, state/error tables, acceptance criteria, tests, and Flutter handoff details—not filler or repeated prose.
- If a feature cannot be explained within 200–230 lines, split genuinely separate contracts into separate feature specs and link them.
- If a revision falls outside the range, correct the structure before calling the spec ready for implementation.

## Final checklist before handoff

- [x] Current code and migrations were inspected.
- [x] Current behavior is separated from deferred behavior.
- [x] Canonical role, ownership, approval, hub, and status rules are explicit.
- [x] Every usable endpoint has method, path, auth, request, response, errors, and retry semantics.
- [x] Conceptual endpoints are labeled unavailable and cannot be copied as working API calls.
- [x] Flutter screen states, secure storage, privacy, accessibility, and offline boundaries are documented.
- [x] Dependencies and blocking schema/policy decisions are named.
- [x] The feature spec is 200–230 physical lines.
- [x] Tests, backend commit/API version, copied-document sync, and `PROGRESS.md` updates are planned.
