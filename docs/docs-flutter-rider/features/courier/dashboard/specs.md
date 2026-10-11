---
feature: courier-dashboard
title: Courier Dashboard
system: AISLEY
type: Feature Specification
version: 2.8
status: Versioned operational dashboard and Flutter adoption implemented locally; live/device acceptance open
implementation_status: Protected v2 aggregate with bounded sections; legacy v1 scaffold retained
flutter_status: Versioned aggregate parsing/cards, scoped freshness and legacy preview fallback implemented; live acceptance unverified
canonical: false
role: Courier / Rider
scope: External Flutter mobile client and Laravel read-only dashboard
backend_contract_commit: 61f302c plus feature/courier-dashboard-chat-images
backend_contract_version: courier-dashboard-v2; default courier-dashboard-scaffold-v1 retained
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domain/Courier.md, docs/domain/Logistics.md, docs/features/shared/shipment-fulfillment/spec.md
---

# Courier Dashboard

Client source and synthetic tests are verified alongside the API for this feature; deployed/live authenticated responses and installed-device behavior remain unverified. Earlier imported evidence remains historical.

## WHAT

- **Purpose:** Provide the external Flutter Courier app with one read-oriented view of new allocations, available pickup/delivery requests, and the Courier's active work.
- **Current aggregate:** `GET /api/v1/courier/dashboard?version=2` returns real bounded notification, available-task and active-task sections. Omitted version or `version=1` retains the legacy unavailable scaffold for installed clients.
- **Flutter adoption:** Request v2, validate its contract and render read-only cards; retain strict legacy scaffold parsing and separate task-list previews only when the backend responds with the scaffold.
- **Separate owning workflows:** The versioned aggregate replaces client previews when available. Normal 1–15-parcel batch acceptance, COD intent, support tickets, and Logistics/Seller/Buyer chat are locally implemented but still require live acceptance; batch route display remains unadopted. A dashboard link proves none of those flows end-to-end.
- **Mobile boundary:** Flutter owns screens, secure token storage, refresh behavior, and accessibility. Laravel owns identity, authorization, tenant scope, task eligibility, status, and data freshness.
- **MVP relationship:** A Courier operates only within one approved Logistics organization and its sole operational hub. First-mile Seller pickup and final-mile hub delivery are independent task legs.
- **Non-goals:** Accepting tasks, creating assignments, scanning, pickup confirmation, transit updates, delivery completion, proof upload, route optimization, chat persistence, incidents, earnings, or hub management.

```text
approved Courier session
→ v2 aggregate returns authorized available/active/notification previews
→ failed sections retain permitted earlier rows marked stale; legacy scaffold uses separate previews
→ tap opens owning screen, which refetches before any explicit action
→ only the owning API may perform a mutation
```

## MUST

### Authority, access, and tenant scope

- The dashboard endpoint uses `auth:sanctum`, `courier.active`, and `policy.consent`; handle `403 POLICY_CONSENT_REQUIRED` without discarding a valid bearer token.
- The server must recheck `courier` role, active account, approved affiliation, active Logistics owner, and valid sole hub on every request.
- Resolve `user → Courier affiliation → Logistics organization → sole hub` server-side. Never accept client `courier_id`, `organization_id`, `hub_id`, role, status, or assignment as authority.
- Every row, count, notification, cursor, cache key, and event must belong to the authenticated Courier and its authorized Logistics organization/hub.
- Cross-role, cross-organization, stale, missing, or unknown IDs must fail closed without confirming another tenant's existence.
- Subscription checks are not part of the MVP; an approved active Logistics relationship is sufficient until a Subscription policy exists.

### Dashboard ownership boundary

- The Flutter Dashboard owns presentation, per-section freshness/retry and navigation; Laravel v2 supplies the authoritative bounded snapshot. The legacy response remains a compatibility scaffold.
- Opening a card must not accept an offer, assign a Courier, scan a parcel, change a task state, or mark an Order delivered.
- Accept Delivery Requests owns first-mile task acceptance and normal atomic final-mile dispatch-batch acceptance; individual final-mile acceptance is exceptional recovery, not the normal batch action.
- Pick Up Order owns first-mile identifier verification and explicit Seller pickup. Final-mile hub handoff uses the accepted task and revision without an identifier; Logistics validation, not evidence submission, establishes `picked_up_from_hub`.
- Deliver Order owns final-mile transit context; Proof of Delivery owns private photo evidence; Complete Delivery owns the photo-linked intent, while Logistics validates before `delivered`.
- Delivery History owns completed-task reads. Flutter Dashboard links to its task-chat inbox; Logistics/Seller/Buyer messaging is locally implemented in its owning task screens, while live cross-role behavior remains unverified. Incident Reporting and Profit Dashboard remain drafts.

### Current versus future content

- Laravel implements Auth/account, first-mile tasks and manifests, final-mile tasks and 1–15-parcel batches, task-bound hub handoff, advisory batch route, private photo POD, movement, completion, history, notification and task-chat inboxes, and assigned Linehaul trip reads. Each client adoption is separate from dashboard aggregation.
- Do not fabricate rows from the legacy scaffold. V2 cards use only validated section data; fallback previews use owning task APIs. Every owning screen refetches before actions.
- Linked task screens read `GET /api/v1/courier/first-mile-tasks` or `GET /api/v1/courier/final-mile-tasks`; Flutter adopts the separately documented batch list/detail/accept contract through the Courier work menu and offered-task handoff.
- The partial preview may show first-mile `assigned` as offered and `accepted` as active; final-mile `delivery_assigned` is an offer and `delivery_accepted` or later authorized task states are active. Unknown status/leg stays unclassified, never actionable.
- Final-mile offers are normally one dispatch schedule; a task-list row is not a separate normal acceptance button or a fabricated batch summary.
- First-mile acceptance remains per task; normal final-mile acceptance is one atomic schedule action. Exceptional final-mile task rejection/re-offer leaves the Order unchanged; first-mile has no Courier rejection endpoint. Never loop per-task accepts to imitate a batch.
- An unfinished task may be presented as informationally `stale`; staleness does not cancel or automatically reassign it in the MVP.
- `delivery_assigned` is an offer/assignment, not acceptance; `picked_up_from_hub` is not implied by either value.
- Generic Order statuses such as `assigned` and `picked_up` must not be presented as physical Courier actions without a detailed task response.
- First-mile API compatibility states are `assigned`, `accepted`, and `picked_up_from_seller`; shared fulfillment may use `seller_pickup_assigned` and `seller_pickup_accepted`. Final-mile task states include `delivery_assigned`, `delivery_accepted`, `picked_up_from_hub`, `in_transit`, `out_for_delivery`, and `delivered`. Do not substitute one endpoint's wire values for another's.
- First-mile completion never automatically grants final-mile assignment. Logistics may select the same or a different eligible Courier for the second leg.

### Aggregate and legacy preview contracts

- Each source renders at most five read-only previews, as reported in the imported Flutter progress; a partial page is not a complete queue. Each preview row must retain the server's opaque task ID, explicit leg, and machine status. Do not synthesize identity or group separate parcel tasks into a fictitious batch.
- Show only fields returned for that task's current authorization: safe Order/waybill reference, Seller or sole-hub origin, destination area, package summary, and server-provided distance/ETA when present. Do not reveal exact address/contact before the owning endpoint permits it.
- Never copy private evidence, raw storage paths, payment credentials, reviewer notes, or unnecessary Buyer/Seller PII into dashboard state. Parcel merchandise price is not a COD payable-total declaration.
- First-mile list uses its own `data[]` plus pagination `meta`; a preview of one page is not the entire queue. Final-mile task list has `data[]` but no pagination metadata; cap visible rows without inventing a total.
- An unavailable, failed, stale, or empty source must retain its own state. Do not invent totals or derive aggregate sections from client task-list filters.
- The [v2 contract](aggregate-api.md) defines stable task/leg IDs, five-row sections, deterministic ordering, has_more, freshness, safe fields and navigation. No total or aggregate cursor is exposed.

### Notifications and freshness

- The separate Courier notification API is implemented at `/api/v1/courier/notifications`, `/unread-count`, `/{notification}`, and `/{notification}/read`, with bounded cursor reads and explicit mark-read. Flutter already uses it for the inbox and unread badge; v2 projects the same safe notifications without marking them read; v1 reports unavailable. An informational Linehaul alert does not authorize a trip action or an invented destination screen.
- Rejected offers remain visible in the owning task history or queue projection with safe reason/time; re-offering the same task must not duplicate the Order, waybill, or task.
- Email/SMS delivery is not required to render an in-app dashboard allocation. Provider failure cannot reverse a committed task decision.
- The implemented inbox polls in the foreground; partial task previews use explicit refresh and app-resume refetch, not the inbox timer. V2 also uses explicit refresh/resume/reconnect rather than a new polling timer; timestamps describe request-time reads.
- Reconnect must perform an authoritative refetch. Out-of-order responses cannot replace newer state with stale data.
- A failed section must not be rendered as a valid empty queue; show partial, stale, or retryable state explicitly.

### Flutter behavior and privacy

- The app loads the authenticated session from secure storage, then calls only documented endpoints with `Authorization: Bearer <token>`.
- Treat `401` as signed out, `403` as blocked/invalid affiliation, `429` as retry-after, timeout/offline as recoverable, and `5xx` as a server error rather than an empty list.
- Provide independent loading, empty, unavailable/scaffold, stale, partial-failure, forbidden, retry, and success states for v2 sections, legacy scaffold and fallback sources.
- Provide pull-to-refresh or an equivalent explicit refresh without creating mutations.
- Use visible focus, semantic labels, readable status text, touch targets, and non-color-only state indicators.
- Keep scaffold, inbox, and preview data bounded in memory; do not persist private task data without its owning API's approved cache contract. Clear all account-scoped state on logout or affiliation loss.
- Offline storage may display bounded stale summaries only; it cannot accept, assign, scan, or complete work without server revalidation.
- Do not require a map, routing, push, or storage vendor for the basic dashboard. Provider choices belong to separate approved contracts.

### Acceptance criteria

- [x] The repository exposes a read-only v2 dashboard and legacy scaffold; Courier remains mobile-only.
- [x] The specification identifies the dashboard as read-only and separates each mutation-owning Courier feature.
- [x] One-organization/one-hub scope and independent first-/final-mile assignments are explicit.
- [x] Flutter validates v2 cards and legacy unavailable responses and links to mutation-owning work screens.
- [x] The protected dashboard scaffold returns bounded empty data, explicit unavailable section reasons, freshness metadata, and private cache headers.
- [x] The scaffold's guest, wrong-role, pending-account, privacy, and no-operational-data behavior is covered by API tests.
- [x] A bounded, tenant-scoped Courier notification API returns safe inbox DTOs, unread counts, detail, and idempotent read state.
- [x] Flutter consumes the separate inbox API and shows its unread badge without interpreting the scaffold notification section as live.
- [x] Flutter dashboard links to the task-chat inbox; its locally implemented Logistics/Seller/Buyer messaging is not a dashboard chat aggregate; live exchange remains unverified.
- [x] The current Flutter handoff records partial task-bound hub pickup/photo POD adoption; installed-device and end-to-end Logistics validation remain unverified.
- [x] Flutter shows read-only first-/final-mile previews from their separate authorized list APIs, each with source labels, independent states, and safe navigation/refetch.
- [x] Imported Flutter progress reports preview tests covering page-limited first-mile reads, unpaginated final-mile reads, unknown-status handling, partial failure, logout clearing, and no action or fabricated count.
- [x] Flutter locally adopts the documented empty-body, state-idempotent final-mile batch action and reconciliation; live acceptance remains open. Do not reactivate normal per-task acceptance or loop task calls.
- [x] V2 returns safe available/active summaries with explicit request timestamps, per-section states and has_more without invented totals.
- [x] Partial preview rows identify their explicit leg/status and show only authorized list fields; distance/ETA is displayed only if the source DTO includes it.
- [x] Rejected offers remain visible with safe reason/time; Logistics can re-offer the same task from the dedicated Dispatch page without changing the Order or duplicating task/waybill history.
- [x] Earlier permitted rows can display informational `stale` with freshness metadata and is never automatically cancelled or reassigned.
- [x] Flutter requests and validates v2, renders its sections, suppresses duplicate legacy previews and routes offered final-mile tasks to batch acceptance.
- [x] Synthetic Flutter tests cover v2 bounds/statuses/duplicates, partial stale retention and legacy fallback; deployed transport and installed-device acceptance remain open.

## HOW

### Endpoint status and implementation boundary

- **Legacy v1:** `GET /api/v1/courier/dashboard` requires bearer `auth:sanctum`, `courier.active`, and the current policy-consent gate; it accepts only the optional version selector and no body/owner fields, performs no mutations, and returns `200` with empty `data` and `notifications`, `available_tasks`, and `active_tasks` sections marked `unavailable` with reason `OPERATIONAL_SCHEMA_DEFERRED`.
- The response includes `meta.next_cursor = null`, server `generated_at`, and `freshness.state = scaffold`. It sends `Cache-Control: private, no-store` and never queries or fabricates Orders, tasks, assignments, notifications, or hub activity.
- The scaffold has no pagination or ordering of operational rows. Its GET is safe to retry; no Idempotency-Key is sent. Do not treat `next_cursor = null` as proof that an operational queue is empty.
- Guests receive `401`; wrong-role, pending, rejected, suspended, deactivated, or invalid-affiliation requests are denied by `courier.active`; `POLICY_CONSENT_REQUIRED` preserves the valid session and requires policy acceptance.
- Map `429` to bounded `Retry-After`, timeout/offline/5xx to retryable failure, and a missing/invalid DTO to a contract error rather than an empty queue. Do not expose raw server bodies in the UI.
- Logistics dashboard and hub-operation APIs are Logistics-owned, not Courier data sources; Flutter must never call them to validate evidence or advance hub custody.
- Future operational sections or routes must use `/api/v1/courier/...`, remain protected by the same middleware, and state whether they are implemented, scaffold-only, planned, or unavailable.
- The implemented [v2 contract](aggregate-api.md) documents selection, DTOs, safe projections, bounds/order, has_more, freshness, errors, private caching and tests.
- Separate notification, available-task, and active-task routes are acceptable only if each has an explicit ownership and consistency contract; one aggregate route is also acceptable if sections distinguish failure from zero.

### Legacy fallback source contracts

- **Default v1:** `GET /api/v1/courier/dashboard` retains the unavailable scaffold; `?version=2` supplies the implemented bounded aggregate. Neither supplies unread counts.
- **Implemented:** `GET /api/v1/courier/first-mile-tasks` accepts optional `per_page` 1–50 and `pickup_schedule_id`; `200` returns `data[]` and pagination `meta` with `current_page`, `last_page`, and `total`. Its assigned/accepted rows are ordered by creation time then ID; preview only a bounded subset of the returned page.
- **Implemented:** `GET /api/v1/courier/final-mile-tasks` accepts no task-owner selectors and returns `200 {"data":[...]}` without cursor or total; cap only the rendered rows, not the server's assignment or batch semantics.
- **Implemented:** `GET /api/v1/courier/notifications/unread-count` returns `200 {"data":{"unread_count":0}}`; keep this badge separate from scaffold `sections.notifications` and the chat unread count.
- The Task messages entry opens the existing chat inbox; it does not query chat history or promise an unread badge from the dashboard. Logistics/Seller/Buyer sends remain task-scoped within the owning chat feature; live acceptance remains open.
- These reads require the current bearer session, active approved Courier affiliation, sole-hub scope, and policy consent; no client owner, role, hub, status, or cross-account cache key is sent. GETs use no Idempotency-Key, are safe to retry, and remain private/no-store.
- Handle `401`, consent/account `403`, `422` invalid filters, `429` Retry-After, timeout/offline/5xx, and malformed envelopes per source; a failed read is never an empty list. The task lists have no shared cursor/order contract.
- V2 uses its separate strict parser and [synthetic example](aggregate-example.json); the following response remains the legacy compatibility example.

```json
{"data":[],"meta":{"next_cursor":null,"generated_at":"server-time"},"sections":{"notifications":{"state":"unavailable","reason":"OPERATIONAL_SCHEMA_DEFERRED"},"available_tasks":{"state":"unavailable","reason":"OPERATIONAL_SCHEMA_DEFERRED"},"active_tasks":{"state":"unavailable","reason":"OPERATIONAL_SCHEMA_DEFERRED"}},"freshness":{"state":"scaffold","reason":"OPERATIONAL_SCHEMA_DEFERRED","generated_at":"server-time"}}
```

- `OPERATIONAL_SCHEMA_DEFERRED` is a legacy reason literal still returned by this controller, not evidence that tables/routes are absent. Preserve wire compatibility; changing that reason requires a backend change.

### Flutter screen contract

- The initial screen restores an approved session and requests version=2 through `lib/features/dashboard/data/dashboard_repository.dart`; a token alone never unlocks operational data.
- Render v2 sections as cards; render legacy `sections.*` as unavailable with distinct fallback task-list previews. A task preview is not a dashboard aggregate result or an enabled mutation button. The imported October 3 Flutter log records grouping of the three confirmed unavailable summaries into one plain-language notice, retaining independent preview/loading/error states and last-successful-refresh context.
- Render the independent unread badge from `lib/features/notification/`; recent aggregate rows do not establish an unread count. A notification failure must not hide dashboard navigation or become a false empty queue.
- Show separate first-mile and final-mile loading/empty/failure states; one source's failure cannot erase another's successful preview. Offered final-mile rows must not expose a normal per-task Accept action.
- Keep preview taps read-only: open the owning work screen and refetch its current task list/detail. Pass a task ID only when a verified in-app target route accepts it; the existing navigation may open the list instead.
- Keep only bounded current-session dashboard/preview snapshots in memory; clear them on logout, account denial, or affiliation invalidation. No persisted task snapshot is currently authorized.
- Announce refresh, stale data, retry, and authorization changes accessibly; do not rely on color alone.
- Use human-readable labels for display but retain endpoint-specific machine statuses for routing and test assertions; do not invent labels as API values.
- Never infer a first-mile or final-mile leg from an `assigned` or `picked_up` OrderStatus alone.

### Refresh and event semantics

- Manual refresh/app resume refetches each enabled read source independently; v2/legacy aggregate has no cursor, first-mile uses its own page contract, and final-mile has no cursor. Ignore obsolete responses after a newer request or account switch.
- A private realtime event, if approved, is only a refetch hint unless it contains a versioned authoritative payload.
- Deduplicate by the server task/event identifier and compare server timestamps or revisions before replacing a row.
- If an item is no longer returned, mark it removed or refresh the owning feature; do not let a stale tap mutate it.
- A reconnect performs fresh reads before preview taps lead to owning features; the Dashboard itself never enables task mutations.
- Do not run an unbounded background timer, retain private data after logout, or retry a mutation from a read refresh.

### Work-state context for partial previews

- Seller confirms `ready_for_pickup`; selected Logistics creates and offers the first-mile task. The partial preview reads it only from the authorized first-mile list.
- A first-mile Courier accepts through Accept Delivery Requests, then Pick Up Order confirms `picked_up_from_seller`.
- Logistics receives and sorts the parcel at its sole hub, then one dispatch schedule creates 1–15 separate final-mile offers for one Courier; a task-list preview cannot claim schedule-wide acceptance.
- Normal final-mile acceptance is an atomic schedule action; each parcel retains its own task and evidence. The contract and local Flutter batch adoption/tests are recorded; live authenticated acceptance remains unverified. Read-only dashboard navigation is unaffected.
- Final-mile pickup submits evidence with HTTP 202; only Logistics validation establishes `picked_up_from_hub`. Deliver Order owns movement, and completion intent likewise waits for Logistics finalization.
- Final-mile hub handoff sends task revision without QR/reference; delivery proof uses private photo POD, not the first-mile scanner. Dashboard cards must not replay either mutation.
- Dashboard refreshes independent task previews after returning from an owning feature; it never predicts a transition from a tap or local timer.
- Every read query must use organization/hub/Courier predicates and indexes appropriate to status, assignment, and activity timestamps.

### Backend and Flutter implementation notes

- The fulfillment migrations supply physical records and batch offers. Dedicated notification persistence/read state is implemented separately; v2 dashboard aggregation is implemented locally; deployed PostgreSQL and authenticated release verification remain open.
- Store enum-like status columns as strings and cast them to PHP enums. Keep detailed physical states out of `orders.status` unless a versioned migration approves otherwise.
- Use transactional state changes, row locks or compare-and-update guards, idempotency keys, and append-only history for task events.
- Resources must return safe opaque identifiers and authorized summaries, never Eloquent models, SQL assumptions, raw blob paths, or secrets.
- Keep strict v1 and v2 parsers separate; aggregate validation lives in dashboard_response.dart. Existing preview models/controllers remain a legacy fallback and do not reinterpret v2 as task-list DTOs.
- Record the backend commit/API version in the Flutter project's copied contract and update it whenever the server DTO or status contract changes.

### Testing and rollout gate

- API tests must cover missing/invalid tokens, wrong roles, pending/rejected/suspended accounts, invalid affiliations, cross-organization IDs, sole-hub scope, and IDOR attempts.
- API tests must prove row/count predicate parity, bounded pagination, deterministic ordering, safe DTOs, cache isolation, and failure distinction between zero and unavailable.
- Operational tests must cover first-/final-mile leg separation, accepted versus assigned states, stale revisions, concurrent reads, duplicate events, and post-commit notification failure.
- Flutter tests must cover strict scaffold parsing, source-labelled preview rows, first-/final-mile response shapes, loading/empty/offline/forbidden/partial states, refresh races, no dashboard mutation, logout clearing, and accessibility. Inbox cursors belong to Notifications; v2 aggregate tests are separate.
- Mocks may support deterministic widget tests but cannot replace contract verification against Laravel once the endpoint exists.
- Partial Flutter previews may be implemented against existing task APIs after their contract tests pass; do not mark scaffold aggregate sections ready without the versioned DTO, API tests and Flutter adoption.

### Current aggregate policies and remaining acceptance

- [x] `GET /api/v1/courier/dashboard` is a private, no-store read scaffold with unavailable aggregate sections; its `OPERATIONAL_SCHEMA_DEFERRED` reason is a compatibility literal, not a claim that task tables are absent.
- [x] The separate inbox owns bounded cursor pagination, unread/read state, and foreground 30-second polling; mark-read never changes task state.
- [x] First-mile and final-mile assignments are independent; normal final-mile dispatch may offer and atomically accept 1–15 separate tasks in one schedule. No one-active-task rule is established here.
- [x] Task expiration and custody are server-authoritative; offline data never authorizes acceptance, scanning, pickup, or completion.
- [x] Route calculation belongs to the owning delivery/route API, not the dashboard; no map, route provider, or geometry is inferred from scaffold data.
- [x] [V2](aggregate-api.md) defines row types, five-row bounds/order, has_more, partial failure and navigation; batch offers open the existing batch screen.
- [x] Use entry/manual/resume/reconnect/return refresh; no new aggregate polling. Inbox polling remains independent.
- [ ] Approve any encrypted read-only task snapshot lifetime separately; existing private no-store task APIs do not grant a 15-minute persistent cache.
- [ ] Define long-term task and notification retention in the platform retention policy.

### Handoff checklist

- Keep Flutter copies aligned with v2 and legacy contracts; replace duplicate previews only for validated operational snapshots.
- Verify the v2 fixture and Laravel/Courier tests before rollout; deployed/live and installed-device gates require separate acceptance.
- Record the backend commit/API version beside every generated Flutter fixture.
- Recheck all endpoint, status, ownership, and privacy wording when the shared operational schema is revised.
- Keep Dashboard acceptance checks separate from Accept, Pickup, Deliver, and Complete feature checks.
- Append material changes to the owning project’s progress log. Record this repository’s documentation reconciliation separately from Flutter runtime implementation or live acceptance.

**References:** `docs/features/courier/rules.md`, `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domain/Courier.md`, `docs/domain/Logistics.md`, `docs/features/courier/notification/specs.md`, `docs/features/courier/chat-messaging/specs.md`, `docs/features/courier/accept-delivery-requests/specs.md`, `docs/features/courier/pick-up-order/specs.md`, `docs/features/courier/delivery-order/specs.md`, and `docs/features/courier/complete-delivery/specs.md`.

Local evidence: [dashboard and image checks](../../../references/dashboard-chat-images-verification.md).
