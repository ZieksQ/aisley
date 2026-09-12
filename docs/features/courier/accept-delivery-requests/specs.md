---
role: Courier / Rider
feature: courier-accept-delivery-requests
title: Accept Delivery Requests
system: AISLEY
type: Feature Specification
version: 1.2
status: First-mile and final-mile offer acceptance/rejection implemented
implementation_status: First-mile listing/acceptance and final-mile listing, accept, reject, and Logistics re-offer are implemented
canonical: true
scope: External Flutter mobile client and Laravel Courier API
backend_contract_commit: 5596fab
backend_contract_version: courier-first-and-final-mile-accept-v1
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Courier.md, docs/domains/Logistics.md, docs/features/shared/shipment-fulfillment/spec.md
---

# Accept Delivery Requests

## WHAT

- **Purpose:** Let a Courier review a Logistics-offered task and explicitly accept responsibility for one Order/Parcel leg.
- **Actor:** The Courier uses the external Flutter application. This repository provides Laravel API endpoints only; no Courier web UI is built here.
- **Current implementation:** `GET /api/v1/courier/first-mile-tasks` and `POST /api/v1/courier/first-mile-tasks/{task}/accept` remain available for first-mile tasks. Final-mile task listing/detail, accept, reject, and Logistics re-offer are implemented on the shared Shipment/DeliveryTask records; physical pickup and delivery remain separate evidence/transition actions.
- **Flow:** Seller confirms `ready_for_pickup` → Logistics creates/offers one first-mile task → Courier reviews → Courier accepts or rejects → accepted Courier proceeds to Pick Up Order.
- **Task boundary:** One deployed Delivery Task represents exactly one Order/Parcel for one leg. First-mile and final-mile assignments are independent; first-mile completion never grants the final-mile task.
- **Non-goals:** Logistics assignment authority, vehicle/zone CRUD, route optimization, QR scanning, physical pickup, hub processing, delivery, proof of delivery, returns, refunds, earnings, and chat.

```text
Logistics offer
→ Courier review
→ explicit accept or reject
→ accepted task / task-level rejected
→ Pick Up Order or Logistics re-offer
```

## MUST

### Authentication and ownership

- Require `auth:sanctum` and `courier.active`; Flutter sends `Authorization: Bearer <token>`.
- Resolve the Courier from the bearer token. Never accept `courier_id`, role, organization, hub, task status, or assignment as client authority.
- The account must be active, affiliated with the selected Logistics organization, and associated with its sole operational hub.
- A same-email Customer, Seller, Logistics, or another Courier account cannot inherit access. Unknown or foreign task IDs fail closed.
- The task and its Order/Parcel must belong to the authenticated Courier's authorized Logistics organization/hub at commit time.

### Assignment and state authority

- Logistics creates and offers/assigns the task. Courier acceptance confirms responsibility; it does not create a task or grant assignment authority.
- Acceptance is required before physical handoff. An offer/assignment is not `seller_pickup_accepted`, `picked_up_from_seller`, `delivery_accepted`, or `picked_up_from_hub`.
- First-mile states are `awaiting_seller_pickup` → `seller_pickup_assigned` → `seller_pickup_accepted` → `picked_up_from_seller`.
- Final-mile states are a separate leg: `delivery_assigned` → `delivery_accepted` → `picked_up_from_hub` → transit and delivery states.
- Generic Order `assigned` and `picked_up` values are broad projections, not acceptance actions. This feature must not write them directly.
- The shared transition service is authoritative for state, actor, timestamp, task revision, and append-only history.

### Review data and privacy

- Before acceptance, return the task leg, safe pickup context, destination area, package/item summary, schedule, and server-provided approximate `distance_km` when available.
- After acceptance, the owning task contract may reveal the exact street address and operational contact details required for pickup; do not expose more than necessary.
- An authorized task projection may include provider-neutral `distance_km` and `estimated_duration_minutes`. They are advisory, server-calculated, and may be absent or explicitly unavailable.
- Route metrics never decide eligibility, ownership, acceptance, or status. No specific routing vendor is required by this feature.
- Exclude payment credentials, private registration/POD evidence, raw storage paths, unrestricted GPS history, and unrelated Customer/Seller data.
- Package dimensions, vehicle compatibility, zone, capacity, and online availability are read from their owning Logistics features; do not duplicate their rules here.

### Rejection, re-offer, and staleness

- A deliberate Courier rejection records task-level `rejected`, the authenticated Courier, safe reason, and server time; it leaves the Order unchanged.
- Logistics may re-offer the same task to another eligible Courier. Re-offer preserves the prior offer/rejection history and cannot create another Order, waybill, or merged task.
- A rejection is not an Order-level `rejected` transition and does not release inventory by itself.
- An unfinished offer may be displayed as informationally `stale`; staleness does not automatically cancel or reassign it in the MVP.
- A Courier may not accept a task after it has been rejected, withdrawn, reassigned, or otherwise made unavailable; the API returns the current safe projection.

### Accept action and reliability

- Opening, scrolling, resolving, or viewing a task never accepts it. Flutter must require an explicit confirmation action.
- At commit, revalidate task availability, Courier affiliation/status, sole-hub scope, current revision, and any hard eligibility supplied by owning features.
- Accept under a transaction with row locking or an equivalent compare-and-update guard. The authenticated Courier is the only actor recorded.
- Retrying an already successful accept returns the same accepted projection. A changed request or stale revision returns a conflict and never overwrites history.
- Notification, push, or communication failure after acceptance or rejection does not roll back the committed task decision.
- Offline acceptance is not allowed in the MVP; cached task data is reference-only and requires online revalidation.

### Final-mile rejection contract

- `POST /api/v1/courier/final-mile-tasks/{task}/reject` is implemented. It requires an approved Courier offer, a reason, and an idempotency key; the rejected offer remains in history and the same task may be re-offered by Logistics.
- A successful response contains the same task reference, `status: rejected`, rejection actor/time, preserved offer history, and a safe next-action hint. It does not change the Order or waybill.

## HOW

### Endpoint contract

- **Implemented** `GET /api/v1/courier/first-mile-tasks` — `auth:sanctum,courier.active`; optional `pickup_schedule_id` UUID and `per_page` 1–50; returns only the authenticated Courier's assigned/accepted first-mile tasks, ordered by `created_at,id`.
- Its response contains `data[]` task ID, machine `status`, Order/waybill references, safe pickup details, destination area, and UTC schedule; `meta` contains `current_page`, `last_page`, and `total`. It is private Courier data and must not be shared-cached.
- **Implemented** `POST /api/v1/courier/first-mile-tasks/{task}/accept` — same auth and server-derived scope; no client `courier_id` or status field; an empty JSON body is accepted; the response returns the committed task projection.
- Accept is idempotent for the same Courier and returns `409` when the task is no longer acceptable. `401`, `403`, `404`, `409`, `422`, `429`, timeout, and server errors map to explicit Flutter states; a failed request never implies success.
- `GET /api/v1/courier/final-mile-tasks`, `GET /api/v1/courier/final-mile-tasks/{task}`, and `POST /api/v1/courier/final-mile-tasks/{task}/accept` are implemented for active final-mile work. Logistics owns `GET .../deploy-rider/tasks/{task}/candidates` and `POST .../offers`; those routes append offers for the same final-mile task.

### Response and error details

- The list response uses `data`, `meta`, and server-generated timestamps; absent operational sections are unavailable, never fabricated as an empty task.
- A task projection contains only opaque `id`, machine `status`, `order.reference`, `waybill.reference`, pickup summary, destination area, and UTC schedule fields authorized for the Courier.
- `GET` accepts no client ownership fields. Invalid `pickup_schedule_id` or `per_page` values return `422` field errors; the server still derives the Courier and organization.
- A successful accept returns `data.id`, `data.status = accepted`, `data.order`, `data.waybill`, and the current task projection. It does not return a physical pickup timestamp.
- `401` means signed out; `403` means wrong role, inactive account, revoked affiliation, or foreign organization; `404` hides an unknown task; `409` means stale/unavailable state.
- `422` means malformed input or an invalid task action; `429` includes retry guidance; timeout/5xx are retryable reads or uncertain mutations and must be reconciled with a fresh GET.
- Responses are private and use `Cache-Control: private, no-store` for task data; Flutter must clear cached projections after logout or authorization loss.

```json
{
  "data": [
    {
      "id": "task-uuid",
      "status": "assigned",
      "order": { "id": "order-uuid", "reference": "ORD-123" },
      "waybill": { "reference": "WB-123" },
      "destination_area": {
        "city_municipality": "Example",
        "province": "Example"
      },
      "schedule": {
        "starts_at": "server-time",
        "ends_at": "server-time",
        "timezone": "UTC"
      }
    }
  ],
  "meta": { "current_page": 1, "last_page": 1, "total": 1 }
}
```

### Review and action states

- The review screen must show the task leg, pickup origin, destination area, package/item summary, schedule, and advisory distance/ETA when supplied.
- Before acceptance, exact street address and contact details remain hidden unless the owning task contract authorizes them; after acceptance, reveal only operationally necessary values.
- The primary action is an explicit **Accept delivery** confirmation. Opening, scrolling, or resolving a waybill never accepts a task.
- The rejection action is shown only when a future rejection endpoint is implemented. It requires a deliberate confirmation and an approved reason; it never appears to call a conceptual route.
- On rejection, show `rejected`, reason, time, and “Logistics may offer this task again”; do not show the Order as rejected or cancelled.
- A re-offered task returns as a new offer event for the same task ID. Preserve prior rejection history and display the current offer only when the server authorizes it.
- An informational `stale` badge shows last server time and offers refresh; it never starts an automatic reassignment timer.

### Assignment and eligibility details

- Logistics owns candidate selection and task offering. Courier acceptance only confirms responsibility for the offered leg.
- Revalidate active account, approved affiliation, sole-hub relationship, task revision, and task leg at the accept/reject commit.
- Vehicle, zone, capacity, availability, and GPS freshness rules belong to their owning Logistics contracts. Missing advisory metrics are not an eligibility failure unless that owner says so.
- First-mile acceptance leads to Pick Up Order; final-mile acceptance is a separate endpoint and task leg after hub dispatch.
- A Courier may not accept two conflicting offers if the approved active-task limit is reached; return an authoritative conflict rather than silently dropping one.

### History, notifications, and retention

- Persist accepted/rejected/re-offered decisions as append-only task events with task, leg, Courier, Logistics organization, revision, reason, and server timestamp.
- The Order, waybill, and inventory reservation are unchanged by acceptance or task rejection; physical pickup is recorded only by the later shared transition.
- Queue assignment and decision notifications after commit. Delivery failure cannot undo acceptance, rejection, or re-offer and must be retried separately.
- Do not duplicate every acceptance event into an unrelated Admin audit ledger unless a shared audit contract is approved.
- Retain task/offer history according to the future Logistics operational retention policy; do not invent expiration or automatic reassignment.

### Flutter contract tests

- Parse nullable destination, route, and availability fields without converting missing values into zero or a false status.
- Verify secure-token loading, logout invalidation, `401`/`403` mapping, `409` refresh, `422` field errors, throttling, timeout, and offline recovery.
- Verify explicit acceptance confirmation, disabled duplicate taps, success navigation to Pick Up Order, and stale/rejected/re-offer copy.
- Verify task IDs and machine statuses are preserved across pagination and refresh; never synthesize identity from labels.
- Verify screen-reader labels, focus order, large touch targets, text alternatives to route/map context, and non-color-only status feedback.

### Handoff and rollout

- The available-task card may deep-link to this feature with only the opaque task ID; the server reloads the authoritative projection before accepting.
- After a successful accept, refresh Dashboard and remove the task from the available list; the next action is Pick Up Order, not transit.
- After a rejected offer, return to the Dashboard or wait for a server re-offer; do not locally create a replacement task.
- Keep the current first-mile accept endpoint available while the additive final-mile task/history migration is rolled out; final-mile reject/re-offer calls require that migration and the authenticated Courier/Logistics scopes.
- The Flutter copy must record `backend_contract_commit: 5596fab` and `backend_contract_version: courier-first-mile-accept-v1` beside its generated models.
- Push or realtime delivery is only a refresh hint; the API response remains authoritative.

### Backend implementation boundary

- Current models persist legacy first-mile assignment/acceptance plus shared Shipment/Parcel/DeliveryTask offer, rejection, evidence, and physical-transition records for final-mile work. Advanced expiry, availability, and location policies remain deferred.
- Use one shared assignment/transition service for tenant checks, revision locking, idempotency, actor history, and task-level exception states. Do not create a second state machine in Flutter.
- Logistics remains the creator and re-offerer; Pick Up Order owns QR/evidence submission and Logistics validates/records physical pickup.
- Any future final-mile acceptance must use the same Courier authorization rules but a separate task leg and owning endpoint.

### Flutter handoff

- Store the token only in OS secure storage and clear task snapshots on logout, denial, suspension, or invalid affiliation.
- Map `401` to signed out, `403` to blocked/invalid affiliation, `404` to unavailable task, `409` to refresh/current state, `422` to validation, `429` to retry-after, and timeout/offline to retryable connectivity.
- Screen states include checking session, loading, review, confirm, accepted, rejected, re-offer available, stale, unavailable, conflict, offline, and retryable failure.
- Show machine states as human labels and retain the task leg. Do not infer physical pickup, final-mile assignment, or Order status locally.
- Use accessible text, semantic labels, large touch targets, and non-color-only acceptance/rejection feedback. Route text remains usable without a map.

### Tests, observability, and rollout

- Test role/status/affiliation/sole-hub isolation, IDOR, safe pre/post-acceptance fields, task-leg separation, eligibility revalidation, stale revisions, duplicate accepts, rejection/re-offer history, and notification failure.
- Test Flutter parsing, secure-token failure, loading/empty/stale/forbidden/offline/conflict states, disabled duplicate taps, and accessibility semantics.
- Log correlation ID, task, Courier, Logistics organization/hub, leg, decision, revision, and timestamp; never log bearer tokens, private evidence, raw paths, or unrestricted GPS.
- Keep only advanced expiry/availability policies unavailable. The deployed final-mile accept/reject/re-offer contract uses the shared transition service; record its API revision separately from the legacy `courier-first-mile-accept-v1` contract in Flutter progress.

### Open decisions

- Approve the bounded rejection reason vocabulary and whether a short note is retained.
- Confirm hard versus advisory availability, vehicle, zone, and capacity checks at acceptance.
- Confirm long-term task/offer-history retention; no automatic expiration or reassignment is assumed.

### Acceptance criteria

- [x] Authenticated Courier can list and explicitly accept its own assigned first-mile task through the implemented API.
- [x] Acceptance is separate from physical pickup and does not directly write custody or generic Order status.
- [x] Courier can reject a final-mile offer with preserved reason/time and Logistics can re-offer the same task without changing the Order.
- [x] Stale unfinished offers are visible as informational state without automatic cancellation or reassignment.
- [x] Provider-neutral distance/ETA is advisory, server-derived, privacy-safe, and explicitly unavailable on calculation failure.
- [x] Concurrent/retried final-mile accepts, rejects, and re-offers cannot duplicate assignments or overwrite append-only history.

**References:** `docs/features/courier/rules.md`, `docs/features/shared/shipment-fulfillment/spec.md`, `docs/features/orders/logistics-pickups/spec.md`, `docs/features/orders/waybill/spec.md`, `docs/features/courier/dashboard/specs.md`, and `docs/features/courier/pick-up-order/specs.md`.
