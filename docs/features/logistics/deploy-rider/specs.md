---
feature: logistics-deploy-rider
title: Deploy Rider
system: AISLEY
type: Feature Specification
version: 1.1
status: Deferred — operational Shipment/Delivery Task schema and endpoints unavailable
role: Logistics
scope: Logistics API and Logistics web dispatch workflow
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Logistics.md, docs/domains/Courier.md, docs/features/shared/shipment-fulfillment/spec.md
---

# Deploy Rider

## WHAT

- **Purpose:** Let an authorized Logistics account select and offer an eligible Courier for one operational task.
- **Current implementation:** No Deploy Rider API or operational UI is implemented. The Logistics dashboard is a scaffold; physical Shipment/Parcel/Delivery Task records remain deferred.
- **Core flow:** Seller confirms `ready_for_pickup` → selected Logistics creates/offers the first-mile task → Courier accepts or rejects → Logistics receives/sorts/dispatches → Logistics creates/offers the independent final-mile task → Courier accepts.
- **Task boundary:** Each future Delivery Task represents exactly one Order/Parcel for one leg. A pickup schedule may group Orders but never merges their tasks, waybills, snapshots, or history.
- **Non-goals:** Courier registration/approval, availability management, vehicle or zone CRUD, waybill generation, physical scans, pickup confirmation, proof of delivery, route navigation, billing, and multi-hub operations.

## MUST

### Authorization and tenant scope

- Require `auth:sanctum` and the active Logistics role/status on every endpoint.
- Resolve the authenticated user to its one Logistics organization and sole operational hub. Never trust client organization, hub, Seller, Order, task, or Courier ownership fields.
- The selected Seller Logistics organization is immutable. A Logistics account may dispatch only tasks addressed to its organization and sole hub.
- Recheck Courier affiliation, account status, and organization scope at commit time. Shared-email records or a guessed UUID do not grant access.

### Task readiness and assignment ownership

- First-mile offering is allowed only after Seller `ready_for_pickup` and one valid selected Logistics organization exist. Creation is at most one active task per Order/Parcel leg and is idempotent.
- Final-mile offering is allowed only after the parcel has reached the approved hub-dispatch boundary (`dispatched_from_hub`). Final-mile assignment is independent of first-mile assignment.
- Logistics creates and offers/assigns work. A Courier may accept only its own offer and cannot assign itself or another Courier.
- Offering or assigning a Courier never means the parcel was physically picked up and must not directly write `picked_up_from_seller`, `picked_up_from_hub`, or a generic Order `picked_up`.

### Status and leg boundary

- First-mile task states are `awaiting_seller_pickup` → `seller_pickup_assigned` → `seller_pickup_accepted` → `picked_up_from_seller`.
- Hub states are recorded by Logistics: `received_at_hub` → `sorted_at_hub` → `in_transfer` → `dispatched_from_hub`.
- Final-mile task states are `delivery_assigned` → `delivery_accepted` → `picked_up_from_hub` → `in_transit` → `out_for_delivery` → `delivered`.
- `assigned` and `picked_up` remain broad Order projections; Deploy Rider must not replace them with detailed task states or write them directly.
- A Courier's acceptance is a separate Courier-owned action. First-mile completion does not grant or require final-mile assignment.

### Candidate data and route context

- Candidate discovery is limited to active Couriers affiliated with this Logistics organization and eligible for the task. Availability, capacity, zone, and vehicle rules are consumed from their owning features rather than duplicated here.
- Pickup and destination come from immutable Seller/Customer snapshots and the task's authorized hub context; Deploy Rider cannot edit either address.
- The server may return provider-neutral `distance_km` and `estimated_duration_minutes` for candidate ranking and Courier task context. They are advisory, may be unavailable, and are never accepted from the client as authoritative values.
- No particular map or routing vendor is selected. Route suggestions must not decide eligibility, ownership, assignment, or status; missing/stale location is not zero distance.
- Do not expose unrestricted Courier GPS history, payment data, private evidence, raw storage paths, or unrelated Buyer/Seller PII.

### Rejection, re-offer, and staleness

- A Courier rejection records task-level `rejected`, preserves the offer history and reason/time, and leaves the Order unchanged.
- Logistics may offer the same task to another eligible Courier; re-offer must not create a new Order, waybill, or merged task and must not erase the prior rejection.
- An unfinished task may be displayed as informationally `stale`. It is not automatically cancelled or reassigned in the MVP.
- Concurrent or retried offer/re-offer requests must return the committed projection or a conflict, never duplicate active offers or overwrite history.

### Planned API contract (unavailable)

- `GET /api/v1/logistics/deploy-rider/tasks/{task}/candidates` — **planned and unavailable**. Auth: active Logistics; returns a bounded list of eligible Couriers with safe identity, availability, location freshness, optional vehicle/zone result, and provider-neutral distance/ETA.
- `POST /api/v1/logistics/deploy-rider/tasks/{task}/offers` — **planned and unavailable**. Auth: active Logistics; request contains `courier_id`, `expected_task_revision`, and an idempotency key. It creates an offer or re-offers the same task after rejection.
- A successful offer response contains the task reference, leg, offer/assignment state, Courier reference, server-calculated distance/ETA when available, and immutable event identifiers. It does not claim physical pickup.
- Errors distinguish `401`, `403`, `404`, `409` stale/concurrent state, `422` invalid task/Courier, `429`, and provider-unavailable context. Retrying the same idempotency key is safe; a changed payload conflicts.

### Failure and reliability rules

- No eligible Courier, invalid/stale location, or unavailable distance/ETA produces an explicit unavailable/empty result; it is never treated as zero distance or a forced assignment.
- If the task or Courier changes between candidate retrieval and offer, return the authoritative current projection with a conflict and require refresh.
- A rejected offer is not an Order rejection. Notification or realtime failure after an offer commits does not undo the offer; the Dashboard can refetch it.
- Route results may be short-lived and provider-neutral, but stale route data cannot override server eligibility or assignment checks.

### Open questions

- Confirm the GPS freshness threshold, candidate radius/limit, and whether ranking prefers distance or estimated duration.
- Confirm whether vehicle, zone, and capacity checks are hard or advisory, and whether automated dispatch is enabled in the MVP.

### Acceptance criteria

- [ ] Only the owning Logistics organization can list candidates or offer a task.
- [ ] First-mile offering requires `ready_for_pickup`; final-mile offering requires approved hub dispatch.
- [ ] Candidate eligibility is server-derived and revalidated at commit time.
- [ ] Distance/ETA fields are provider-neutral, advisory, and absent or explicitly unavailable when calculation fails.
- [ ] A rejected offer is visible to Logistics, leaves the Order unchanged, and permits re-offer of the same task.
- [ ] Informational `stale` does not automatically cancel or reassign unfinished work.
- [ ] First-mile and final-mile assignments remain independent and Courier acceptance is separate from Logistics offering.
- [ ] Retries/concurrency cannot duplicate active offers or overwrite append-only assignment history.
- [ ] Offering a Courier never records physical pickup or bypasses scan/evidence validation.
- [ ] DTOs and logs exclude secrets, raw storage paths, unrestricted location history, and unrelated PII.

## HOW

### Implementation boundary

- Do not implement this feature against the current scaffold's `summary: null` or against guessed status columns. Add the shared Shipment/Parcel/Delivery Task schema through new migrations only after the canonical documents and owning operational specs are reconciled.
- Use one transition/assignment service for readiness checks, sole-hub scope, eligibility, revision locking, idempotency, and append-only offer history. The Dashboard consumes its projection.
- Keep Courier acceptance in the Courier feature/API. A successful Logistics offer makes a task available to that external Flutter client; it does not mark acceptance.

### UI and reliability

- The Logistics UI must show candidate loading, empty/no-eligible, unavailable distance/ETA, stale candidate, rejection/re-offer, conflict, success, and retry states with text and keyboard-accessible controls.
- Refresh after a committed offer; communication or notification failure must not roll back the assignment decision.
- Keep route calculations and credentials behind a server adapter; do not make a map vendor a schema or state authority.

The dispatch confirmation must show the task/leg, pickup and destination summaries, selected Courier, availability, location freshness, and advisory distance/ETA. It must clearly state that the Courier still has to accept and that physical pickup is not yet recorded.

### Rollout boundary

- Keep Deploy Rider unavailable until additive operational migrations, transition ownership, and Courier acceptance endpoints are deployed together.
- A feature flag may expose candidate read-only previews first, but previews must use the same tenant predicates and must not create offers.
- Re-offer and stale behavior must be enabled atomically with task-history persistence so a rejected offer cannot disappear from the queue.
- Record rollout/API version in the Logistics client contract so external Courier clients can distinguish unavailable from implemented offers.

### Observability

- Record a correlation ID, Logistics actor, organization/hub, task, Courier, leg, decision (`offered`, `rejected`, `re-offered`, or conflict), and timestamp for each dispatch attempt.
- Metrics should distinguish candidate lookup, offer commit, rejection, re-offer, stale display, and unavailable distance/ETA without logging private GPS or evidence.

### Tests and references

- Test role/tenant/sole-hub isolation, readiness gates, independent legs, candidate bounds, stale/missing location, advisory metrics, rejection/re-offer, duplicate/concurrent offers, IDOR, privacy, and failure recovery on SQLite and PostgreSQL.
- Canonical references: `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, both role domains, and `docs/features/shared/shipment-fulfillment/spec.md`.
