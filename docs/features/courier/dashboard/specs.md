---
feature: courier-dashboard
title: Courier Dashboard
system: AISLEY
type: Feature Specification
version: 2.6
status: Implemented scaffold; operational task aggregation deferred
implementation_status: Protected dashboard scaffold and separate Courier notification/task APIs implemented; aggregate operational sections unavailable
flutter_status: Scaffold, navigation, and inbox implemented; final-mile handoff/photo POD partially adopted; batch offers and aggregate cards not adopted
canonical: true
role: Courier / Rider
scope: External Flutter mobile client and Laravel read API scaffold
backend_contract_commit: d1abeee73d0141e1fd7dda4bea0ee3fead370378
backend_contract_version: courier-dashboard-scaffold-v1
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Courier.md, docs/domains/Logistics.md, docs/features/shared/shipment-fulfillment/spec.md
---

# Courier Dashboard

## WHAT

- **Purpose:** Provide the external Flutter Courier app with one read-oriented view of new allocations, available pickup/delivery requests, and the Courier's active work.
- **Current status:** `GET /api/v1/courier/dashboard` is an implemented protected scaffold. Its notification, available-task, and active-task aggregate sections remain unavailable, despite implemented separate task and inbox APIs. The Flutter dashboard renders the scaffold, an inbox badge, and links to owning screens; it does not have live operational cards.
- **Client adoption:** Flutter has partially adopted task-bound final-mile hub pickup and photo POD, but normal 1–15-parcel batch acceptance lacks a complete copied DTO/retry contract and is disabled. Do not treat a linked screen or the development Courier mockup as proof that its current flow works end-to-end.
- **Future scope:** A versioned dashboard revision may aggregate server-authorized task or batch summaries. Rejected offers and informationally stale unfinished tasks are not Order cancellations. No Courier UI belongs in the Laravel repository.
- **Mobile boundary:** Flutter owns screens, secure token storage, refresh behavior, and accessibility. Laravel owns identity, authorization, tenant scope, task eligibility, status, and data freshness.
- **MVP relationship:** A Courier operates only within one approved Logistics organization and its sole operational hub. First-mile Seller pickup and final-mile hub delivery are independent task legs.
- **Non-goals:** Accepting tasks, creating assignments, scanning, pickup confirmation, transit updates, delivery completion, proof upload, route optimization, chat persistence, incidents, earnings, or hub management.

```text
approved Courier session
→ dashboard scaffold returns unavailable aggregate sections
→ Flutter shows honest unavailable cards, separate inbox badge, and feature links
→ owning feature refetches its authorized task or batch
→ only the owning API may perform an explicit mutation
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

- The Dashboard owns read aggregation, safe cards, freshness indicators, refresh/reconnect states, and navigation to owning features.
- Opening a card must not accept an offer, assign a Courier, scan a parcel, change a task state, or mark an Order delivered.
- Accept Delivery Requests owns first-mile task acceptance and normal atomic final-mile dispatch-batch acceptance; individual final-mile acceptance is exceptional recovery, not the normal batch action.
- Pick Up Order owns first-mile identifier verification and explicit Seller pickup. Final-mile hub handoff uses the accepted task and revision without an identifier; Logistics validation, not evidence submission, establishes `picked_up_from_hub`.
- Deliver Order owns final-mile transit context; Proof of Delivery owns private photo evidence; Complete Delivery owns the photo-linked intent, while Logistics validates before `delivered`.
- Delivery History owns completed-task reads; Courier task-chat APIs exist but Flutter chat and dashboard integration are unverified. Incident Reporting and Profit Dashboard remain drafts and cannot supply dashboard data or actions.

### Current versus future content

- Laravel implements Auth/account, first-mile tasks and manifests, final-mile tasks and 1–15-parcel batches, task-bound hub handoff, advisory batch route, private photo POD, movement, completion, history, notification and task-chat inboxes, and assigned Linehaul trip reads. Each client adoption is separate from dashboard aggregation.
- Do not fabricate dashboard rows from the scaffold. Navigate to the owning first-mile or final-mile feature; those screens use their own implemented APIs and must refetch before showing actionable task state.
- Linked task screens read `GET /api/v1/courier/first-mile-tasks` or `GET /api/v1/courier/final-mile-tasks`; the batch list/detail routes exist but their copied DTO is not sufficient for current Flutter adoption.
- Future available work may include a first-mile pickup at a Seller and a final-mile pickup at the Logistics organization's sole hub.
- Future active work may include an accepted first-mile or final-mile task, but the server must identify its task leg explicitly.
- First-mile acceptance remains per task; normal final-mile acceptance is one atomic schedule action. Exceptional final-mile task rejection/re-offer leaves the Order unchanged; first-mile has no Courier rejection endpoint. Never loop per-task accepts to imitate a batch.
- An unfinished task may be presented as informationally `stale`; staleness does not cancel or automatically reassign it in the MVP.
- `delivery_assigned` is an offer/assignment, not acceptance; `picked_up_from_hub` is not implied by either value.
- Generic Order statuses such as `assigned` and `picked_up` must not be presented as physical Courier actions without a detailed task response.
- First-mile API compatibility states are `assigned`, `accepted`, and `picked_up_from_seller`; shared fulfillment may use `seller_pickup_assigned` and `seller_pickup_accepted`. Final-mile task states include `delivery_assigned`, `delivery_accepted`, `picked_up_from_hub`, `in_transit`, `out_for_delivery`, and `delivered`. Do not substitute one endpoint's wire values for another's.
- First-mile completion never automatically grants final-mile assignment. Logistics may select the same or a different eligible Courier for the second leg.

### Future card and list contract

- Each future item must have a stable opaque task or schedule identifier supplied by its approved API; Flutter must not synthesize identity from a display label or aggregate unrelated parcel tasks into one task.
- A card may show task leg, current server status plus human label, safe Order/Parcel/waybill reference, pickup context, destination area, item/package summary, delivery instructions, assignment/evidence state, and relevant timestamps when authorized.
- For an offered or accepted task, the API may include authorized operational Order, parcel, waybill, pickup, destination, item, and delivery-instruction data plus provider-neutral `distance_km` and `estimated_duration_minutes`. These values are advisory and may be explicitly unavailable.
- Seller pickup cards must identify the Seller origin without exposing unrelated Seller profile data.
- Hub pickup cards must identify the organization's sole hub without implying a selectable sub-hub.
- Destination data must be minimized to what the Courier needs for the authorized task; exact address disclosure requires the owning feature's contract.
- Payment credentials, private registration evidence, reviewer notes, raw storage paths, and unrestricted location history are never dashboard fields.
- Future lists must be bounded and ordered by an approved endpoint contract; do not assume that first-mile pagination, inbox cursors, and final-mile batch listing share one shape.
- Counts must use the same predicates as returned rows; `null`, failed, stale, zero, and empty states must remain distinguishable.

### Notifications and freshness

- The separate Courier notification API is implemented at `/api/v1/courier/notifications`, `/unread-count`, `/{notification}`, and `/{notification}/read`, with bounded cursor reads and explicit mark-read. Flutter already uses it for the inbox and unread badge; the dashboard aggregate's notification section still reports unavailable. An informational Linehaul alert does not authorize a trip action or an invented destination screen.
- Rejected offers remain visible in the owning task history or queue projection with safe reason/time; re-offering the same task must not duplicate the Order, waybill, or task.
- Email/SMS delivery is not required to render an in-app dashboard allocation. Provider failure cannot reverse a committed task decision.
- The implemented inbox polls in the foreground; this does not establish polling, cursors, or freshness thresholds for future dashboard task aggregation. Realtime remains deferred.
- Reconnect must perform an authoritative refetch. Out-of-order responses cannot replace newer state with stale data.
- A failed section must not be rendered as a valid empty queue; show partial, stale, or retryable state explicitly.

### Flutter behavior and privacy

- The app loads the authenticated session from secure storage, then calls only documented endpoints with `Authorization: Bearer <token>`.
- Treat `401` as signed out, `403` as blocked/invalid affiliation, `429` as retry-after, timeout/offline as recoverable, and `5xx` as a server error rather than an empty list.
- Provide loading, empty, filtered-empty, unavailable/scaffold, stale, partial-failure, forbidden, retry, and success states.
- Provide pull-to-refresh or an equivalent explicit refresh without creating mutations.
- Use visible focus, semantic labels, readable status text, touch targets, and non-color-only state indicators.
- Keep the current scaffold and inbox data in their existing bounded client state. Do not persist private future task data without its own approved cache contract; clear account-scoped data on logout or affiliation loss.
- Offline storage may display bounded stale summaries only; it cannot accept, assign, scan, or complete work without server revalidation.
- Do not require a map, routing, push, or storage vendor for the basic dashboard. Provider choices belong to separate approved contracts.

### Acceptance criteria

- [x] The repository exposes only a read-only Courier dashboard scaffold and builds no Courier web UI.
- [x] The specification identifies the dashboard as read-only and separates each mutation-owning Courier feature.
- [x] One-organization/one-hub scope and independent first-/final-mile assignments are explicit.
- [x] Implemented task APIs are distinguished from unavailable dashboard aggregation; Flutter links to owning screens without creating operational dashboard cards.
- [x] The protected dashboard scaffold returns bounded empty data, explicit unavailable section reasons, freshness metadata, and private cache headers.
- [x] The scaffold's guest, wrong-role, pending-account, privacy, and no-operational-data behavior is covered by API tests.
- [x] A bounded, tenant-scoped Courier notification API returns safe inbox DTOs, unread counts, detail, and idempotent read state.
- [x] Flutter consumes the separate inbox API and shows its unread badge without interpreting the scaffold notification section as live.
- [x] The current Flutter handoff records partial task-bound hub pickup/photo POD adoption; installed-device and end-to-end Logistics validation remain unverified.
- [ ] Adopt the documented atomic final-mile batch action only after its authorized request/response, pagination/order, and retry details are verified; do not reactivate normal per-task acceptance meanwhile.
- [ ] An operational dashboard API returns available-task and active-task summaries alongside notifications.
- [ ] Offered task rows identify first-mile or final-mile leg, expose only authorized operational Order data, and include provider-neutral distance/ETA when available.
- [x] Rejected offers remain visible with safe reason/time; Logistics can re-offer the same task from the dedicated Dispatch page without changing the Order or duplicating task/waybill history.
- [ ] Unfinished work can display informational `stale` with freshness metadata and is never automatically cancelled or reassigned.
- [ ] Flutter consumes a versioned operational dashboard DTO after Laravel implements it; current task screens and inbox are not that DTO.
- [ ] Duplicate events, stale responses, retries, reconnection, and partial operational failures are covered by tests.

## HOW

### Endpoint status and implementation boundary

- **Implemented scaffold:** `GET /api/v1/courier/dashboard` requires bearer `auth:sanctum`, `courier.active`, and the current policy-consent gate; it accepts no query or body fields, performs no mutations, and returns `200` with empty `data` and `notifications`, `available_tasks`, and `active_tasks` sections marked `unavailable` with reason `OPERATIONAL_SCHEMA_DEFERRED`.
- The response includes `meta.next_cursor = null`, server `generated_at`, and `freshness.state = scaffold`. It sends `Cache-Control: private, no-store` and never queries or fabricates Orders, tasks, assignments, notifications, or hub activity.
- The scaffold has no pagination or ordering of operational rows. Its GET is safe to retry; no Idempotency-Key is sent. Do not treat `next_cursor = null` as proof that an operational queue is empty.
- Guests receive `401`; wrong-role, pending, rejected, suspended, deactivated, or invalid-affiliation requests are denied by `courier.active`; `POLICY_CONSENT_REQUIRED` preserves the valid session and requires policy acceptance.
- Map `429` to bounded `Retry-After`, timeout/offline/5xx to retryable failure, and a missing/invalid DTO to a contract error rather than an empty queue. Do not expose raw server bodies in the UI.
- Logistics dashboard and hub-operation APIs are Logistics-owned, not Courier data sources; Flutter must never call them to validate evidence or advance hub custody.
- Future operational sections or routes must use `/api/v1/courier/...`, remain protected by the same middleware, and state whether they are implemented, scaffold-only, planned, or unavailable.
- The future operational contract must document method/path, request query fields, prohibited fields, response DTO/nullability, stable errors, pagination/cursors, ordering, cache headers, retry/idempotency, and related tests before Flutter enables aggregate cards.
- Separate notification, available-task, and active-task routes are acceptable only if each has an explicit ownership and consistency contract; one aggregate route is also acceptable if sections distinguish failure from zero.

### Future operational endpoint contract template

- Identify each endpoint as `implemented`, `scaffold-only`, `planned`, or `unavailable`; a draft route is never callable by Flutter.
- State the exact HTTP method and path under `/api/v1/courier/`, including whether a route is a list, detail, or aggregate read.
- State required query fields, optional filters, maximum page size, cursor format, deterministic ordering, and invalid-query errors.
- State that Courier identity, organization, hub, assignment, and status are derived from the bearer token and server records.
- List every response section and nullable field; distinguish omitted, `null`, empty array, zero count, stale, and failed sections.
- Define `Cache-Control`, private/no-store behavior, ETag or freshness metadata, and logout/session invalidation effects.
- Define `401`, `403`, `404`, `409`, `422`, `429`, timeout, offline, and server-error mapping for the Flutter state model.
- Define whether a refresh is safe to retry and how the client handles an uncertain response or a changed cursor.
- Include the migration, model, query/service, resource, policy, and tests that establish the endpoint's authority.
- Include a minimal JSON fixture only after the backend shape is approved; fixtures must not be mistaken for a live route.

```json
{"data":[],"meta":{"next_cursor":null,"generated_at":"server-time"},"sections":{"notifications":{"state":"unavailable","reason":"OPERATIONAL_SCHEMA_DEFERRED"},"available_tasks":{"state":"unavailable","reason":"OPERATIONAL_SCHEMA_DEFERRED"},"active_tasks":{"state":"unavailable","reason":"OPERATIONAL_SCHEMA_DEFERRED"}},"freshness":{"state":"scaffold","reason":"OPERATIONAL_SCHEMA_DEFERRED","generated_at":"server-time"}}
```

- `OPERATIONAL_SCHEMA_DEFERRED` is a legacy reason literal still returned by this controller, not evidence that tables/routes are absent. Preserve wire compatibility; changing that reason requires a backend change.

### Flutter screen contract

- The initial screen restores an approved session and calls the scaffold endpoint through `lib/features/dashboard/data/dashboard_repository.dart`; a token alone never unlocks operational data.
- Render an unavailable/scaffold state for the unavailable sections, with no fake tasks or action buttons that imply a working operational backend.
- Render the independent inbox badge from `lib/features/notification/`, not from scaffold `sections.notifications`. A notification failure must not hide dashboard navigation or become a false empty queue.
- Keep task cards read-only on the Dashboard; tap targets navigate to the owning feature and pass only the server identifier.
- Keep only the current session's bounded scaffold snapshot in memory; clear it on logout, account denial, or affiliation invalidation. No 15-minute persisted task snapshot is currently authorized.
- Announce refresh, stale data, retry, and authorization changes accessibly; do not rely on color alone.
- Use human-readable labels for display but retain endpoint-specific machine statuses for routing and test assertions; do not invent labels as API values.
- Never infer a first-mile or final-mile leg from an `assigned` or `picked_up` OrderStatus alone.

### Refresh and event semantics

- A manual scaffold refresh uses no cursor/filter; future list refresh follows its own endpoint contract. Ignore obsolete responses after a newer request or account switch.
- A private realtime event, if approved, is only a refetch hint unless it contains a versioned authoritative payload.
- Deduplicate by the server task/event identifier and compare server timestamps or revisions before replacing a row.
- If an item is no longer returned, mark it removed or refresh the owning feature; do not let a stale tap mutate it.
- A reconnect performs a full authoritative refetch before allowing any task action from the Dashboard.
- Do not run an unbounded background timer, retain private data after logout, or retry a mutation from a read refresh.

### Required future data flow

- Seller confirms `ready_for_pickup`; selected Logistics creates and offers the first-mile task. The dashboard reads that offer only after the shared task record exists.
- A first-mile Courier accepts through Accept Delivery Requests, then Pick Up Order confirms `picked_up_from_seller`.
- Logistics receives and sorts the parcel at its sole hub, then one dispatch schedule creates 1–15 separate final-mile offers for one Courier.
- Normal final-mile acceptance is an atomic schedule action; each parcel retains its own task and evidence. The incomplete copied batch DTO blocks current Flutter normal acceptance, not the scaffold's read-only navigation.
- Final-mile pickup submits evidence with HTTP 202; only Logistics validation establishes `picked_up_from_hub`. Deliver Order owns movement, and completion intent likewise waits for Logistics finalization.
- Final-mile hub handoff sends task revision without QR/reference; delivery proof uses private photo POD, not the first-mile scanner. Dashboard cards must not replay either mutation.
- Dashboard refreshes after mutation responses or authorized events; it never predicts a transition from a tap or local timer.
- Every read query must use organization/hub/Courier predicates and indexes appropriate to status, assignment, and activity timestamps.

### Backend and Flutter implementation notes

- The fulfillment migrations supply physical records and batch offers. Dedicated notification persistence/read state is implemented separately; dashboard task aggregation and production PostgreSQL verification remain separate release gates.
- Store enum-like status columns as strings and cast them to PHP enums. Keep detailed physical states out of `orders.status` unless a versioned migration approves otherwise.
- Use transactional state changes, row locks or compare-and-update guards, idempotency keys, and append-only history for task events.
- Resources must return safe opaque identifiers and authorized summaries, never Eloquent models, SQL assumptions, raw blob paths, or secrets.
- Flutter dashboard models currently parse `sections`, `freshness`, and `meta.generated_at` in `lib/features/dashboard/domain/dashboard_models.dart`. Future task/batch DTOs need separate explicit models; nullable fields cannot be defaulted into authority.
- Record the backend commit/API version in the Flutter project's copied contract and update it whenever the server DTO or status contract changes.

### Testing and rollout gate

- API tests must cover missing/invalid tokens, wrong roles, pending/rejected/suspended accounts, invalid affiliations, cross-organization IDs, sole-hub scope, and IDOR attempts.
- API tests must prove row/count predicate parity, bounded pagination, deterministic ordering, safe DTOs, cache isolation, and failure distinction between zero and unavailable.
- Operational tests must cover first-/final-mile leg separation, accepted versus assigned states, stale revisions, concurrent reads, duplicate events, and post-commit notification failure.
- Flutter tests must cover scaffold parsing, loading/unavailable/offline/forbidden states, refresh races, logout clearing, and accessibility. Future aggregate tests add approved cursor/order, partial/stale, and deduplication cases; inbox cursor tests belong to Notifications.
- Mocks may support deterministic widget tests but cannot replace contract verification against Laravel once the endpoint exists.
- Do not mark the operational sections implementation-ready until Laravel aggregate DTO/API tests, Flutter copy, API-version record, and `PROGRESS.md` entry are updated and the client is tested against that contract.

### Current policies and open aggregate decisions

- [x] `GET /api/v1/courier/dashboard` is a private, no-store read scaffold with unavailable aggregate sections; its `OPERATIONAL_SCHEMA_DEFERRED` reason is a compatibility literal, not a claim that task tables are absent.
- [x] The separate inbox owns bounded cursor pagination, unread/read state, and foreground 30-second polling; mark-read never changes task state.
- [x] First-mile and final-mile assignments are independent; normal final-mile dispatch may offer and atomically accept 1–15 separate tasks in one schedule. No one-active-task rule is established here.
- [x] Task expiration and custody are server-authoritative; offline data never authorizes acceptance, scanning, pickup, or completion.
- [x] Route calculation belongs to the owning delivery/route API, not the dashboard; no map, route provider, or geometry is inferred from scaffold data.
- [ ] Define future aggregate row/batch DTOs, pagination/order, counts, freshness threshold, partial failures, and navigation targets in Laravel before enabling live dashboard cards.
- [ ] Decide whether aggregate reads need polling beyond manual refresh; the inbox's interval is not a dashboard-task freshness guarantee.
- [ ] Approve any encrypted read-only task snapshot lifetime separately; existing private no-store task APIs do not grant a 15-minute persistent cache.
- [ ] Define long-term task and notification retention in the platform retention policy.

### Handoff checklist

- Keep the Flutter copy aligned with the backend scaffold contract; the aggregate remains unavailable while the separate inbox and task APIs are live.
- Before implementing aggregate cards, verify the current Laravel implementation and versioned DTOs; the copied snapshot and development mockup alone are insufficient.
- Record the backend commit/API version beside every generated Flutter fixture.
- Recheck all endpoint, status, ownership, and privacy wording when the shared operational schema is revised.
- Keep Dashboard acceptance checks separate from Accept, Pickup, Deliver, and Complete feature checks.
- Append material Flutter contract/documentation changes to this project's progress log; record a backend progress change only when Laravel itself changes.

**References:** `docs/features/courier/rules.md`, `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Courier.md`, `docs/domains/Logistics.md`, `docs/features/courier/notification/specs.md`, `docs/features/courier/chat-messaging/specs.md`, `docs/features/courier/accept-delivery-requests/specs.md`, `docs/features/courier/pick-up-order/specs.md`, `docs/features/courier/delivery-order/specs.md`, and `docs/features/courier/complete-delivery/specs.md`.
