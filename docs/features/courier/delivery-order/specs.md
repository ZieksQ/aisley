---
role: Courier / Rider
feature: courier-delivery-order
title: Deliver Order
system: AISLEY
type: Feature Specification
version: 1.2
status: Implemented final-mile task, movement, and delivery-context API; route/location extensions deferred
implementation_status: Final-mile task reads, acceptance, hub pickup evidence, movement transitions, and delivery-context read are implemented; location/route metrics remain unavailable
canonical: true
scope: External Flutter mobile client and Laravel Courier API
backend_contract_commit: 5596fab
backend_contract_version: courier-delivery-v1-final-mile-task
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Courier.md, docs/domains/Logistics.md, docs/features/shared/shipment-fulfillment/spec.md
---

# Deliver Order

## WHAT

- **Purpose:** Help an accepted final-mile Courier task travel from the sole Logistics hub to the authoritative Customer destination.
- **Actor boundary:** Courier views task and route context in Flutter. Aisley validates task ownership and state; Logistics remains assignment/state authority; Complete Delivery owns finalization.
- **Current implementation:** The API creates a final-mile task when Logistics dispatches a Shipment from its sole hub, supports Courier-scoped task listing/detail/accept/reject, QR hub-pickup evidence submission, `in_transit`/`out_for_delivery` movement, and an accepted-task delivery-context read with the immutable destination address/contact and hub context. Route/ETA and location APIs remain deferred and return no fabricated metrics.
- **Flow:** Logistics dispatches → final-mile task is offered → Courier accepts → Courier picks up from hub → `in_transit` → `out_for_delivery` → proof/Complete Delivery.
- **Task boundary:** One Delivery Task represents one Order/Parcel and one leg. First-mile and final-mile assignments are independent and may use the same or a different Courier.
- **Non-goals:** assignment, acceptance, pickup, scan/evidence recording, proof storage, completion, route-provider credentials, returns/refunds, multi-stop batching, or Courier web UI.

```text
accepted final-mile task
→ read destination and route context
→ travel while server state is authoritative
→ hand off to Proof of Delivery / Complete Delivery
```

## MUST

### Authentication and task scope

- Require `auth:sanctum` and `courier.active`; Flutter sends `Authorization: Bearer <token>`.
- Derive Courier, accepted final-mile task, Order/Parcel, selected Logistics organization, and sole hub server-side.
- Reject foreign task IDs, inactive accounts, revoked affiliations, reassigned tasks, and guessed `courier_id`/organization/hub fields without tenant disclosure.
- The task must be in `delivery_accepted` or a later server-authorized transit state before delivery context is returned.
- The Customer checkout destination snapshot is authoritative. Courier cannot edit or replace it in this feature.

### Canonical status and ownership

- Final-mile sequence is `delivery_assigned` → `delivery_accepted` → `picked_up_from_hub` → `in_transit` → `out_for_delivery` → `delivered`.
- `delivery_assigned` is an offer, not acceptance; `picked_up_from_hub` is physical possession and is committed by Pick Up Order after Logistics validation.
- This feature reads transit context and may submit permitted location updates; it must not directly write custody or `OrderStatus`.
- `delivered` is owned by Complete Delivery after Proof of Delivery requirements are satisfied.
- First-mile completion does not grant final-mile assignment. Logistics may assign the same or another eligible Courier through a separate task.
- Generic Order `assigned`, `picked_up`, and `in_transit` values are broad projections; use detailed task state from the server response.

### Provider-neutral route, distance, and ETA

- The API may provide `distance_km` and `estimated_duration_minutes` for the authorized task, plus an optional route representation or external-navigation handoff.
- These values are server-calculated, provider-neutral, advisory, timestamped, and may be absent or explicitly unavailable.
- Missing/stale coordinates, routing timeout, quota exhaustion, or provider failure must return an honest unavailable state, never zero distance or a fabricated ETA.
- Route metrics cannot decide assignment, eligibility, custody, delivery completion, or destination authority.
- No map, routing vendor, SDK, API key, or graphical route is required by this feature. A backend adapter may be selected later without changing the Courier contract.
- If a map is rendered in Flutter, it is a presentation layer over the server-authorized destination/route data and must not become a state authority.

### Destination and operational data

- An accepted-task response may include the operational Order, parcel, waybill, pickup hub, destination address, item/package summary, delivery instructions, and contact fields needed for delivery.
- Before final-mile acceptance, Dashboard rules limit data to safe destination area and package summary; exact street/contact disclosure occurs only after acceptance and only when authorized.
- Redact payment credentials, private registration/POD evidence, raw storage paths, unrelated Customer/Seller data, and unrestricted Courier GPS history.
- Do not transmit names, phone numbers, or street lines to a route provider when coordinates alone suffice.

### Location and tracking

- Location updates are optional operational context and remain scoped to the active task and Logistics organization.
- The server records location timestamps/precision and may mark a location stale; Flutter must not invent freshness or infer arrival from GPS alone.
- Foreground updates may support route refresh. Background tracking, frequency, retention, consent, and Buyer-facing live maps require a separate approved policy.
- GPS loss must not automatically cancel, reassign, complete, or alter the task; show the last safe state and request retry/reconnect.
- Never expose unrestricted historical traces to the Courier, Buyer, Seller, or unrelated Logistics organization.

### Reliability and handoffs

- Route reads are safe to retry. Location mutations, if enabled, require an idempotency key and expected task revision; duplicate retries return the committed projection.
- A stale revision or Logistics reassignment returns `409` with the latest safe state and blocks local delivery actions until refreshed.
- Offline mode may show a bounded encrypted snapshot, but route/location writes and completion require online revalidation in the MVP.
- Communication, route-provider, or notification failure cannot roll back a committed Logistics decision or pickup state.
- Handoff to Proof of Delivery occurs only at the destination; this feature does not accept evidence or mark `delivered`.

## HOW

### Implemented endpoint contract and deferred extensions

- `GET /api/v1/courier/final-mile-tasks` — implemented; active final-mile tasks offered to or accepted by the authenticated Courier.
- `GET /api/v1/courier/final-mile-tasks/{task}` — implemented; Courier-scoped task detail, including an unaccepted offer for review.
- `GET /api/v1/courier/tasks/{task}/delivery` — implemented; returns the immutable destination address/contact and pickup-hub context only after the Courier accepts the offer.
- `POST /api/v1/courier/final-mile-tasks/{task}/accept` — implemented; accepts the current Logistics offer.
- `POST /api/v1/courier/final-mile-tasks/{task}/reject` — implemented; records a reason and leaves the task available for Logistics re-offer.
- `POST /api/v1/courier/final-mile-tasks/{task}/pickup` — implemented companion action owned by `docs/features/courier/pick-up-order/specs.md`; use its exact request, pending-evidence response, and retry contract. Deliver Order starts movement only after Logistics records `picked_up_from_hub`.
- `POST /api/v1/courier/final-mile-tasks/{task}/status` — implemented; advances only `picked_up_from_hub → in_transit → out_for_delivery` with a task revision.
- `GET /api/v1/courier/tasks/{task}/route` — planned/unavailable; same scope; returns provider-neutral route summary, `distance_km`, `estimated_duration_minutes`, calculation time, freshness, and an optional render/navigation payload.
- `POST /api/v1/courier/tasks/{task}/location` — planned/unavailable; JSON `{ "latitude": number, "longitude": number, "captured_at": timestamp, "expected_revision": number, "idempotency_key": string }`; no client status/owner fields.
- Responses contain opaque task/Order references, machine state plus human label, destination summary, route freshness, and allowed next action. Raw provider credentials/paths are never returned.
- `401` signs out; `403` means inactive/unauthorized task; `404` hides foreign task existence; `409` means stale/reassigned state; `422` means invalid coordinates; `429`, timeout, offline, and provider failure are explicit retryable states.
- Task and location responses are private, `Cache-Control: private, no-store`, and never shared across Courier accounts.

### Route payload contract

- `distance_km` is a non-negative decimal with an explicit unit; `estimated_duration_minutes` is a non-negative integer or `null` when unavailable.
- `calculated_at` and a freshness state accompany every metric. A stale metric may be displayed as advisory but cannot be treated as a current guarantee.
- `route_status` is one of server-approved values such as `available`, `unavailable`, or `stale`; Flutter must preserve unknown future values as an unavailable presentation.
- Optional route geometry or navigation links are opaque presentation data. They cannot contain credentials, hidden waypoints, unrelated user locations, or authorization claims.
- A route response is scoped to the accepted task and its immutable pickup/destination snapshots. It cannot be requested for a guessed coordinate pair outside that task.
- Repeated route reads are safe and may use short-lived server caching keyed by task/revision and coordinate fingerprints; private data is never shared-cached.

### Location submission contract

- If location updates are enabled, latitude and longitude are validated for range, precision, timestamp skew, and task scope; client status and destination fields are ignored.
- The server may reject locations that are too old, too frequent, outside the active task window, or associated with a changed revision.
- A successful location response returns the server timestamp, accepted precision, current safe task revision, and any refreshed advisory route metrics.
- Location writes do not mark arrival, pickup, transit, out-for-delivery, or delivery complete. Those transitions belong to the owning features.
- Rate limits and consent must be explicit before background collection. The app must stop sending after logout, task removal, or affiliation loss.

```json
{
  "latitude": 14.5995,
  "longitude": 120.9842,
  "captured_at": "client-time",
  "expected_revision": 4,
  "idempotency_key": "location-attempt-uuid"
}
```

### Error and recovery details

- A route provider timeout returns `route_status: unavailable` or a typed error; it never returns zero distance or a guessed duration.
- A stale location response returns `409` with the latest safe task projection. Flutter must refresh before sending another update.
- A `422` response identifies invalid latitude, longitude, timestamp, or idempotency fields without echoing sensitive coordinates unnecessarily.
- A `429` response includes retry-after; the client must not busy-loop or increase collection frequency after throttling.
- Offline route display may use the last bounded snapshot with a visible timestamp; no offline location write is authoritative.

### Flutter handoff and navigation

- The active screen shows the accepted task, destination, current state, distance/ETA freshness, route availability, and a clear next action.
- A map is optional. Textual address/area, distance, ETA, and external-navigation action must remain usable without map tiles.
- Returning from external navigation triggers a fresh task/route read rather than trusting a background callback.
- Permission denial, GPS disabled, route unavailable, stale metrics, reassignment, and destination reached are distinct accessible states.
- The app never displays a local arrival calculation as a server transition and never enables Complete Delivery solely because a route ended.

```json
{
  "data": {
    "task_id": "task-uuid",
    "state": "in_transit",
    "destination": { "city_municipality": "Example", "province": "Example" },
    "distance_km": 7.4,
    "estimated_duration_minutes": 25,
    "route_status": "available",
    "calculated_at": "server-time"
  }
}
```

### Backend implementation boundary

- Additive migrations introduce final-mile Delivery Task, assignment, custody, evidence, and revision records. Location and route-cache records remain deferred until their owning policy is approved.
- Use one transition/location service for task ownership, state checks, idempotency, rate limits, and append-only event history.
- Deploy Rider owns assignment; Pick Up Order and Logistics Update Status own hub pickup validation/recording; Proof of Delivery and Complete Delivery own drop-off.
- Route adapters must hide provider credentials and normalize results to the provider-neutral fields above. They cannot write task state.
- Store enum-like statuses as strings with PHP enum casts; keep detailed physical milestones out of `orders.status`.

### Flutter states and UX

- States include session check, loading, accepted, route available, route unavailable, stale metrics, GPS permission denied, offline, conflict/reassigned, retry, destination reached, and handoff to proof.
- Show textual distance/ETA with calculation time and an explicit “unavailable” label when missing; never show `0 km` as fallback.
- Allow external navigation only from an authorized task response. Returning from navigation must refetch the task.
- Use accessible map alternatives, semantic labels, large touch targets, and non-color-only route/state indicators.
- Clear private snapshots and location queues on logout, account denial, affiliation revocation, or task removal.

### Tests, observability, and rollout

- Test role/affiliation/sole-hub/task isolation, first-/final-mile independence, destination immutability, route fallback, stale/missing coordinates, provider failure, and privacy.
- Test location validation, idempotency, concurrent reassignment, stale revisions, offline replay rejection, and no direct custody/completion mutation.
- Flutter tests cover parsing nullable metrics, route unavailable/timeout, secure storage, permission denial, offline/refresh races, and accessibility.
- Log task/leg, Courier, organization/hub, metric freshness, provider adapter result, revision, and timestamp without raw GPS history or destination PII.
- Verify destination snapshots cannot be replaced through route or location payloads.
- Verify missing metrics remain `null`/unavailable and never become `0` or a fabricated ETA.
- Verify route cache keys include task scope and revision and cannot leak across organizations.
- Verify communication failure never changes a committed task state.
- Keep route/location capabilities explicitly unavailable until their backend contracts are live. Record the implemented task/movement contract separately from the deferred `courier-delivery-v1` route/location extensions in Flutter progress.
- Roll out task reads before location writes and route rendering; each capability remains explicitly unavailable until its backend contract is live.
- Reconcile a lost response with a GET before allowing another location or navigation action.
- Do not use a client-generated ETA, route, or coordinate to populate an authoritative Order or Delivery Task field.

### Open decisions

- Select the routing adapter and define coordinate precision, freshness threshold, route-cache lifetime, and provider quota fallback.
- Decide whether foreground/background location is collected, its retention, and whether Buyer/Logistics receive live updates.
- Decide whether external navigation links or a Flutter map renderer are required; neither is assumed for the API contract.

### Acceptance criteria

- [x] Only an accepted final-mile task can return delivery context; location updates remain unavailable until separately implemented.
- [x] `distance_km` and `estimated_duration_minutes` are provider-neutral, advisory, timestamped, and explicitly unavailable on failure.
- [x] Destination comes from the immutable checkout snapshot and cannot be changed by the Courier.
- [x] Route/location capabilities cannot fabricate progress or mutate custody; stale revisions and reassignment are rejected by the implemented task transitions.
- [x] First-mile and final-mile assignments remain independent and `delivered` remains owned by Complete Delivery.
- [x] Flutter handles loading, unavailable, stale, offline, conflict, retry, and accessible text/map fallback states.

**References:** `docs/features/courier/rules.md`, `docs/features/shared/shipment-fulfillment/spec.md`, `docs/features/courier/dashboard/specs.md`, `docs/features/courier/accept-delivery-requests/specs.md`, `docs/features/courier/pick-up-order/specs.md`, `docs/features/courier/proof-of-delivery/specs.md`, and `docs/features/courier/complete-delivery/specs.md`.
