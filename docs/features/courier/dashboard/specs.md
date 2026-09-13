---
feature: courier-dashboard
title: Courier Dashboard
system: AISLEY
type: Feature Specification
version: 2.3
status: Implemented scaffold; operational task sections deferred
implementation_status: read-only API scaffold implemented; operational sections unavailable
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
- **Current status:** `GET /api/v1/courier/dashboard` is an implemented protected scaffold. It returns no operational records and still marks its sections unavailable. Separate first-/final-mile task APIs and fulfillment records now exist; dashboard aggregation is the missing integration. No Courier UI belongs in this Laravel repository.
- **Future scope:** Using the existing shared Shipment/Parcel/Delivery Task schema, a future dashboard revision may aggregate server-authorized task summaries and link to stateful Courier features. Rejected offers and informationally stale unfinished tasks are visible states, not Order cancellations.
- **Mobile boundary:** Flutter owns screens, secure token storage, refresh behavior, and accessibility. Laravel owns identity, authorization, tenant scope, task eligibility, status, and data freshness.
- **MVP relationship:** A Courier operates only within one approved Logistics organization and its sole operational hub. First-mile Seller pickup and final-mile hub delivery are independent task legs.
- **Non-goals:** Accepting tasks, creating assignments, scanning, pickup confirmation, transit updates, delivery completion, proof upload, route optimization, chat persistence, incidents, earnings, or hub management.

```text
approved Courier session
→ dashboard scaffold returns unavailable operational sections
→ Flutter shows unavailable sections and navigation to implemented task features
→ tap navigates to an owning feature
→ owning API performs the state mutation
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
- Accept Delivery Requests owns task acceptance and the `seller_pickup_accepted` or `delivery_accepted` transition.
- Pick Up Order owns parcel verification and `picked_up_from_seller` or `picked_up_from_hub` confirmation.
- Deliver Order owns final-mile transit context; Complete Delivery owns completion and `delivered`.
- Proof of Delivery, Incident Reporting, Chat, Delivery History, and Profit Dashboard own their own reads/writes and authorization.

### Current versus future content

- Laravel implements Auth/account APIs, first-mile tasks and route manifests, and final-mile tasks, QR evidence, movement, completion, and history. External Flutter implementation is not verified here.
- Do not fabricate dashboard rows. Navigate to `GET /api/v1/courier/first-mile-tasks` or `GET /api/v1/courier/final-mile-tasks` using their owning specs; those APIs are independent of this scaffold.
- Future available work may include a first-mile pickup at a Seller and a final-mile pickup at the Logistics organization's sole hub.
- Future active work may include an accepted first-mile or final-mile task, but the server must identify its task leg explicitly.
- Both legs support explicit acceptance. Final-mile rejection/re-offer is implemented and leaves the Order unchanged; first-mile has no Courier rejection endpoint. Never apply one leg's endpoint to the other.
- An unfinished task may be presented as informationally `stale`; staleness does not cancel or automatically reassign it in the MVP.
- `delivery_assigned` is an offer/assignment, not acceptance; `picked_up_from_hub` is not implied by either value.
- Generic Order statuses such as `assigned` and `picked_up` must not be presented as physical Courier actions without a detailed task response.
- Existing detailed task states use lowercase `snake_case`: `seller_pickup_assigned`, `seller_pickup_accepted`, `picked_up_from_seller`, `delivery_assigned`, `delivery_accepted`, and `picked_up_from_hub`.
- First-mile completion never automatically grants final-mile assignment. Logistics may select the same or a different eligible Courier for the second leg.

### Future card and list contract

- Each item must have a stable opaque task or allocation identifier supplied by the API; Flutter must not synthesize identity from a display label.
- A card may show task leg, current server status plus human label, safe Order/Parcel/waybill reference, pickup context, destination area, item/package summary, delivery instructions, assignment/evidence state, and relevant timestamps when authorized.
- For an offered or accepted task, the API may include authorized operational Order, parcel, waybill, pickup, destination, item, and delivery-instruction data plus provider-neutral `distance_km` and `estimated_duration_minutes`. These values are advisory and may be explicitly unavailable.
- Seller pickup cards must identify the Seller origin without exposing unrelated Seller profile data.
- Hub pickup cards must identify the organization's sole hub without implying a selectable sub-hub.
- Destination data must be minimized to what the Courier needs for the authorized task; exact address disclosure requires the owning feature's contract.
- Payment credentials, private registration evidence, reviewer notes, raw storage paths, and unrestricted location history are never dashboard fields.
- Lists must be bounded, server-paginated or cursor-based, deterministically ordered by an approved rule, and safe for mobile memory.
- Counts must use the same predicates as returned rows; `null`, failed, stale, zero, and empty states must remain distinguishable.

### Notifications and freshness

- No separate Courier notification endpoint or push-provider contract is implemented today. The dashboard only reports the notification section as unavailable; Flutter must not call a guessed route.
- Rejected offers remain visible in the owning task history or queue projection with safe reason/time; re-offering the same task must not duplicate the Order, waybill, or task.
- Email/SMS delivery is not required to render an in-app dashboard allocation. Provider failure cannot reverse a committed task decision.
- The selected future dashboard policy below uses foreground polling; realtime remains deferred. It does not add fields or notification routes to the existing scaffold.
- Reconnect must perform an authoritative refetch. Out-of-order responses cannot replace newer state with stale data.
- A failed section must not be rendered as a valid empty queue; show partial, stale, or retryable state explicitly.

### Flutter behavior and privacy

- The app loads the authenticated session from secure storage, then calls only documented endpoints with `Authorization: Bearer <token>`.
- Treat `401` as signed out, `403` as blocked/invalid affiliation, `429` as retry-after, timeout/offline as recoverable, and `5xx` as a server error rather than an empty list.
- Provide loading, empty, filtered-empty, unavailable/scaffold, stale, partial-failure, forbidden, retry, and success states.
- Provide pull-to-refresh or an equivalent explicit refresh without creating mutations.
- Use visible focus, semantic labels, readable status text, touch targets, and non-color-only state indicators.
- Cache only data allowed by the future API contract; private task data must not be shared across accounts or shown after logout.
- Offline storage may display bounded stale summaries only; it cannot accept, assign, scan, or complete work without server revalidation.
- Do not require a map, routing, push, or storage vendor for the basic dashboard. Provider choices belong to separate approved contracts.

### Acceptance criteria

- [x] The repository exposes only a read-only Courier dashboard scaffold and builds no Courier web UI.
- [x] The specification identifies the dashboard as read-only and separates each mutation-owning Courier feature.
- [x] One-organization/one-hub scope and independent first-/final-mile assignments are explicit.
- [x] Implemented task APIs are distinguished from the dashboard's unavailable aggregation; no external Flutter completion is claimed.
- [x] The protected dashboard scaffold returns bounded empty data, explicit unavailable section reasons, freshness metadata, and private cache headers.
- [x] The scaffold's guest, wrong-role, pending-account, privacy, and no-operational-data behavior is covered by API tests.
- [x] An operational API returns bounded, tenant-scoped notifications, available tasks, and active-task summaries.
- [x] Offered task rows identify first-mile or final-mile leg, expose only authorized operational Order data, and include provider-neutral distance/ETA when available.
- [x] Rejected offers remain visible with safe reason/time; Logistics can re-offer the same task without changing the Order or duplicating task/waybill history.
- [x] Unfinished work can display informational `stale` with freshness metadata and is never automatically cancelled or reassigned.
- [x] Flutter consumes live operational DTOs, cursors, and task-state responses.
- [x] Duplicate events, stale responses, retries, reconnection, and partial operational failures are covered by tests.

## HOW

### Endpoint status and implementation boundary

- **Implemented scaffold:** `GET /api/v1/courier/dashboard` requires `auth:sanctum` and `courier.active`, accepts no query fields, performs no mutations, and returns an empty `data` array with `notifications`, `available_tasks`, and `active_tasks` sections marked `unavailable` with reason `OPERATIONAL_SCHEMA_DEFERRED`.
- The response includes `meta.next_cursor = null`, server `generated_at`, and `freshness.state = scaffold`. It sends `Cache-Control: private, no-store` and never queries or fabricates Orders, tasks, assignments, notifications, or hub activity.
- Guests receive `401`; wrong-role, pending, rejected, suspended, deactivated, or invalid-affiliation requests are denied by `courier.active` with the existing Courier auth error contract.
- Logistics dashboard and hub-operation APIs are Logistics-owned, not Courier data sources; Flutter must never call them to validate evidence or advance hub custody.
- Future operational sections or routes must use `/api/v1/courier/...`, remain protected by the same middleware, and state whether they are implemented, scaffold-only, planned, or unavailable.
- The future operational contract must document method/path, request query fields, prohibited fields, response DTO/nullability, stable errors, pagination/cursors, ordering, cache headers, retry/idempotency, and related tests.
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
{
  "data": [],
  "meta": { "next_cursor": null, "generated_at": "server-time" },
  "sections": {
    "notifications": {
      "state": "unavailable",
      "reason": "OPERATIONAL_SCHEMA_DEFERRED"
    },
    "available_tasks": {
      "state": "unavailable",
      "reason": "OPERATIONAL_SCHEMA_DEFERRED"
    },
    "active_tasks": {
      "state": "unavailable",
      "reason": "OPERATIONAL_SCHEMA_DEFERRED"
    }
  },
  "freshness": {
    "state": "scaffold",
    "reason": "OPERATIONAL_SCHEMA_DEFERRED",
    "generated_at": "server-time"
  }
}
```

- `OPERATIONAL_SCHEMA_DEFERRED` is a legacy reason literal still returned by this controller, not evidence that tables/routes are absent. Preserve wire compatibility; changing that reason requires a backend change.

### Flutter screen contract

- The initial screen checks secure-token presence and calls the documented endpoint; a token alone never unlocks operational data.
- Render an unavailable/scaffold state for the unavailable sections, with no fake tasks or action buttons that imply a working operational backend.
- Render independent section states so a notification failure does not hide a successful active-task section or become a false empty queue.
- Keep task cards read-only on the Dashboard; tap targets navigate to the owning feature and pass only the server identifier.
- Preserve the last authorized snapshot only for the documented cache window and clear it on logout, account denial, or affiliation invalidation.
- Announce refresh, stale data, retry, and authorization changes accessibly; do not rely on color alone.
- Use the server's human-readable label for display but retain the machine status for routing and test assertions.
- Never infer a first-mile or final-mile leg from an `assigned` or `picked_up` OrderStatus alone.

### Refresh and event semantics

- A manual refresh starts a new request with the current cursor/filter state and cancels or ignores obsolete responses.
- A private realtime event, if approved, is only a refetch hint unless it contains a versioned authoritative payload.
- Deduplicate by the server task/event identifier and compare server timestamps or revisions before replacing a row.
- If an item is no longer returned, mark it removed or refresh the owning feature; do not let a stale tap mutate it.
- A reconnect performs a full authoritative refetch before allowing any task action from the Dashboard.
- Do not run an unbounded background timer, retain private data after logout, or retry a mutation from a read refresh.

### Required future data flow

- Seller confirms `ready_for_pickup`; selected Logistics creates and offers the first-mile task. The dashboard reads that offer only after the shared task record exists.
- A first-mile Courier accepts through Accept Delivery Requests, then Pick Up Order confirms `picked_up_from_seller`.
- Logistics receives/sorts/dispatches the parcel at its sole hub and creates a separate final-mile assignment.
- Final-mile pickup submits evidence with HTTP 202; only Logistics validation establishes `picked_up_from_hub`. Deliver Order owns movement, and completion intent likewise waits for Logistics finalization.
- Dashboard refreshes after mutation responses or authorized events; it never predicts a transition from a tap or local timer.
- Every read query must use organization/hub/Courier predicates and indexes appropriate to status, assignment, and activity timestamps.

### Backend and Flutter implementation notes

- The fulfillment migration supplies physical records. Dashboard notification persistence/read state and aggregation still need implementation; production PostgreSQL verification remains a separate release gate.
- Store enum-like status columns as strings and cast them to PHP enums. Keep detailed physical states out of `orders.status` unless a versioned migration approves otherwise.
- Use transactional state changes, row locks or compare-and-update guards, idempotency keys, and append-only history for task events.
- Resources must return safe opaque identifiers and authorized summaries, never Eloquent models, SQL assumptions, raw blob paths, or secrets.
- Flutter models should map snake-case JSON explicitly and tolerate nullable future fields without inventing defaults that change authority.
- Record the backend commit/API version in the Flutter project's copied contract and update it whenever the server DTO or status contract changes.

### Testing and rollout gate

- API tests must cover missing/invalid tokens, wrong roles, pending/rejected/suspended accounts, invalid affiliations, cross-organization IDs, sole-hub scope, and IDOR attempts.
- API tests must prove row/count predicate parity, bounded pagination, deterministic ordering, safe DTOs, cache isolation, and failure distinction between zero and unavailable.
- Operational tests must cover first-/final-mile leg separation, accepted versus assigned states, stale revisions, concurrent reads, duplicate events, and post-commit notification failure.
- Flutter tests must cover parsing fixtures, loading/empty/stale/partial/offline/forbidden states, cursor pagination, refresh races, duplicate-event deduplication, logout cache clearing, and accessibility semantics.
- Mocks may support deterministic widget tests but cannot replace contract verification against Laravel once the endpoint exists.
- Do not mark the operational sections implementation-ready until the shared schema, endpoint contract, Flutter copy, API-version record, and `PROGRESS.md` entry are updated.

### Selected target policies — not evidence of implementation

- [x] Use a read-only `GET /api/v1/courier/dashboard` endpoint with independent `notifications`, `available_tasks`, `active_tasks`, and `freshness` sections. Full lists may use separate cursor-paginated endpoints.
- [x] Use cursor pagination with a maximum of 20 records per request. Available tasks use deterministic oldest-first ordering; active tasks and notifications use newest-update-first ordering.
- [x] Persist notifications per Courier with unread/read state. Marking a notification read is idempotent and cannot change task state.
- [x] Mark a Dashboard section stale after 60 seconds without a successful refresh.
- [x] A Courier may receive multiple offers but may have only one accepted active task at a time.
- [x] First-mile and final-mile assignments remain independent; completing one does not grant the other.
- [x] Before acceptance, show only the task leg, pickup/destination area, package summary, and server-provided approximate distance.
- [x] Reveal exact street address and contact details only after the Courier accepts the task.
- [x] Use foreground polling every 30 seconds and manual refresh for the MVP.
- [x] Defer WebSockets and background push notifications.
- [x] Route calculation does not belong to the Dashboard. Route/distance details belong to Deliver Order and must use a separately approved provider-neutral contract. Mapbox is not required.
- [x] API responses are private and use `Cache-Control: private, no-store`.
- [x] The future dashboard may permit an encrypted read-only snapshot for up to 15 minutes; this does not authorize persistent caching of current task/map DTOs. Follow each owning API's no-store policy.
- [x] The server is authoritative for task expiration. Flutter must not invent expiration or remove a task without an API response.
- [x] Offline mode may display stale summaries, but accepting, scanning, picking up, or completing a task always requires an online server request.
- [ ] Long-term task and notification retention is deferred to the platform retention policy.

### Handoff checklist

- Copy this spec to the Flutter project only as a contract reference; do not copy unavailable routes as working API calls.
- Record the backend commit/API version beside every generated Flutter fixture.
- Recheck all endpoint, status, ownership, and privacy wording when the shared operational schema is revised.
- Keep Dashboard acceptance checks separate from Accept, Pickup, Deliver, and Complete feature checks.
- Append the implementation or contract change to the repository and Flutter progress logs.

**References:** `docs/features/courier/rules.md`, `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Courier.md`, `docs/domains/Logistics.md`, `docs/features/courier/accept-delivery-requests/specs.md`, `docs/features/courier/pick-up-order/specs.md`, `docs/features/courier/delivery-order/specs.md`, and `docs/features/courier/complete-delivery/specs.md`.
