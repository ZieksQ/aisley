---
model: Courier
type: Domain Context
purpose: Shared Courier workflow and implementation context
version: 1.1
status: Revised — aligned with the MVP first-mile/final-mile flow
---

# Courier Model Context

## Overview

Courier (rider) is Aisley's delivery operator. Courier operations are exposed through Laravel API endpoints and consumed by an external Flutter/mobile application. This repository must not build a Courier web dashboard or other Courier UI under `src/`.

The Courier works under one selected Logistics organization. The organization operates exactly one hub/sorting center in the MVP, and the Courier's hub affiliation is derived by the server. Courier access is therefore both account-scoped and Logistics-relationship-scoped.

## Registration, affiliation, and access boundary

- Registration collects the required personal fields, Philippine address, vehicle type, plate number, OR/CR, and ID/driver's-license evidence from `docs/references/user-registration-requirements.md`.
- Age is calculated from `birth_date` by the API; a client-supplied age is never authoritative.
- Address selectors use the bundled PSGC Region → Province → City/Municipality → Barangay flow with manual street/house details and a complete manual fallback.
- The applicant selects an eligible active Logistics organization. The API derives that organization's sole hub; the client cannot submit or select a hub/sub-hub ID.
- The selected Logistics organization is the sole Courier affiliation reviewer and approver for the MVP. Admin account suspension, restoration, and deactivation remain separate lifecycle actions; Admin does not approve a pending Courier affiliation.
- A pending, rejected, or revoked affiliation cannot issue a token or access Courier operations. Protected access also requires an active Courier account, an active Logistics organization, and a valid current hub.

The implemented authentication foundation includes the `courier` role, `CourierProfile`, one initial `Vehicle`, `CourierLogisticsAffiliation`, registration applications, private registration documents, addresses, Sanctum bearer-token login/logout, current-Courier identity, password-recovery entry point, and Logistics approval endpoints. Courier operational shipment and delivery data remain deferred until their shared contract exists.

## Courier lifecycle and status contract

Persisted and API status values use lowercase `snake_case`. PHP enum case names may use `PascalCase`, and UI labels are human-readable. Legacy/source terms such as `ACCEPTED`, `IN_TRANSIT`, `COMPLETED`, or `DELIVERED` are not canonical persisted values.

### Registration and affiliation lifecycle

```text
select active Logistics organization
→ submit pending Courier account and affiliation
→ Logistics review
   ↘ rejected/revoked → no Courier access
   ↘ approved + active → mobile sign in
active → suspended/deactivated or affiliation revoked → API access denied
```

Account status (`users.status`) and affiliation status (`courier_logistics_affiliations.status`) are separate facts. A Courier is operational only when both are valid.

### Delivery task lifecycle

The existing high-level `OrderStatus` remains the Customer-facing order contract:

```text
pending_payment
→ placed
→ seller_processing
→ ready_for_pickup
→ assigned
→ picked_up
→ in_transit
→ out_for_delivery
→ delivered
```

Courier actions must use the detailed Shipment/Delivery Task contract rather than treating a generic order status as proof of a physical handoff:

```text
awaiting_seller_pickup
→ seller_pickup_assigned
→ seller_pickup_accepted
→ picked_up_from_seller
→ received_at_hub
→ sorted_at_hub
→ in_transfer
→ dispatched_from_hub
→ delivery_assigned
→ delivery_accepted
→ picked_up_from_hub
→ in_transit
→ out_for_delivery
→ delivered
```

Courier-owned task transitions are:

- **First mile:** `seller_pickup_assigned` → `seller_pickup_accepted` → `picked_up_from_seller`.
- **Final mile:** `delivery_assigned` → `delivery_accepted` → `picked_up_from_hub` → `in_transit` → `out_for_delivery` → `delivered`.

`received_at_hub`, `sorted_at_hub`, `in_transfer`, and `dispatched_from_hub` are Logistics-side milestones. The same Courier may perform both legs, but each leg still requires its own task, assignment, actor, timestamp, location, and scan/event history.

## Physical delivery flow

```text
Seller prepares the Order and confirms `ready_for_pickup`
→ first-mile Courier receives and accepts a Seller pickup task
→ Courier verifies and scans the parcel at the Seller
→ Courier confirms `picked_up_from_seller`
→ Courier transfers the parcel to the Logistics organization's sole hub
→ Logistics receives, sorts, transfers, and dispatches it
→ Logistics assigns a final-mile Courier (`delivery_assigned`)
→ final-mile Courier accepts (`delivery_accepted`)
→ Courier verifies and scans the parcel at the hub
→ Courier confirms `picked_up_from_hub`
→ Courier travels and delivers (`in_transit` → `out_for_delivery`)
→ Courier submits the required proof and completes delivery (`delivered`)
```

The Courier does not assign itself, change Logistics hub state, or complete a task belonging to another Courier. Scans and manual actions are validated by the API and appended to immutable task history.

## Courier capabilities and boundaries

### 1. Dashboard

- **Purpose:** Show delivery notifications, available first-mile pickup requests, available final-mile delivery requests, and the Courier's active jobs.
- **Owns:** Mobile read/aggregation, freshness indicators, task-detail navigation, and retry/empty/offline states.
- **Does not own:** Assignment authority, parcel state transitions, or a second source of truth for task data. Each row is scoped to the authenticated Courier and its approved Logistics relationship.

### 2. Accept Delivery Requests

- **Purpose:** Let the Courier review task type, pickup and destination details, route/distance context, and package requirements before accepting an eligible task.
- **Owns:** Server-side revalidation at commit time, assignment to the authenticated Courier, and the `seller_pickup_accepted` or `delivery_accepted` transition.
- **Rules:** A client cannot choose another `courier_id`, accept an unavailable task, or accept a task outside its Logistics organization/hub. Concurrent or retried accepts are idempotent and cannot double-assign a task.

### 3. Pick Up Order

- **Purpose:** Record physical possession after the Courier reaches the correct origin: the Seller for first mile or the Logistics hub for final mile.
- **Owns:** Parcel/waybill verification, camera or barcode scanning, handoff evidence, and the explicit `picked_up_from_seller` or `picked_up_from_hub` transition.
- **Rules:** A generic `picked_up` OrderStatus is not proof of either physical handoff. Pickup cannot be confirmed for an unaccepted task, an incorrect parcel, or an unauthorized origin.

### 4. Deliver Order

- **Purpose:** Support final-mile transit to the Buyer with destination details and navigation context.
- **Owns:** The active delivery view, route context, and optional current-location updates while the task is assigned to the Courier.
- **Rules:** A mapping provider may supply distance or route suggestions (the shared contract currently names Mapbox Matrix/Optimization), but Aisley remains authoritative for task eligibility and state. Location collection is minimized and access-controlled.

### 5. Complete Delivery

- **Purpose:** Finalize a successful Buyer handoff after delivery requirements are satisfied.
- **Owns:** Completion eligibility checks, the final `delivered` task transition, the corresponding high-level Order projection, immutable completion history, and post-commit notification events.
- **Rules:** Completion is transactional and idempotent. It cannot bypass required proof, finalize another Courier's task, or be rolled back because a notification provider failed.

### 6. Proof of Delivery (e-POD)

- **Purpose:** Capture basic evidence that the parcel was handed over or placed at the approved destination.
- **Owns:** Mobile capture of the approved evidence type, validation, secure storage, and linkage to the authorized Delivery Task/Order.
- **Rules:** Image evidence follows `docs/references/file-upload-requirements.md`: JPEG/JPG, PNG, or WebP, strictly under 10 MiB, with signature/MIME/decode validation. Evidence is private, delivered only through authorization, and never returned as a raw storage path. Signature or QR evidence needs an explicit contract before it becomes required.

### 7. Incident Reporting

- **Purpose:** Report breakdowns, accidents, inaccessible addresses, damaged parcels, or other delivery blockers to Logistics.
- **Owns:** A task-scoped incident record, safe description/evidence, severity, and notification handoff to the owning Logistics organization.
- **Rules:** Creating an incident does not silently mutate the Order or invent a new route. Logistics or an approved transition policy decides reassignment, pause, return, or recovery.

### 8. Chat/Messaging

- **Purpose:** Communicate with the relevant Buyer, Seller, or Logistics operator for an active task.
- **Owns:** Authorized task-linked threads, message delivery/read state, and operational access expiry.
- **Rules:** Conversations are temporary and participant-scoped. Phone numbers, private registration evidence, payment secrets, and unrelated users are not exposed.

### 9. Account Management

- **Purpose:** Maintain the authenticated Courier's personal profile, security credentials, and current vehicle information.
- **Owns:** Allow-listed self-service changes, password/session controls, and vehicle detail updates when permitted.
- **Rules:** Every mutation uses the authenticated `user_id`; email alone, another role's record, arbitrary profile IDs, or a client-selected affiliation cannot authorize an update. License, vehicle, payout, or other sensitive changes may require Logistics review before becoming operational.

### 10. Delivery History

- **Purpose:** Provide a read-only archive of the authenticated Courier's completed delivery tasks.
- **Owns:** Bounded pagination, filters, detail navigation, and historical task summaries.
- **Rules:** History is Courier-scoped and uses the canonical `delivered` state or the approved completion state of the task contract. It does not expose another Courier's routes, Buyer private data, or raw evidence paths.

### 11. Profit Dashboard

- **Purpose:** Show earnings derived from the Courier's completed delivery work.
- **Owns:** Read-only period totals and bounded delivery-linked summaries once an authoritative earnings ledger exists.
- **Rules:** It must not infer payable earnings from Order totals or expose another Courier's financial data. The earnings ledger and payout policy are deferred.

### 12. Performance Metrics

- **Purpose:** Summarize personal completion rate, ratings, timing, and other approved quality measures.
- **Owns:** Derived, read-only metrics from authoritative completed tasks and eligible reviews.
- **Rules:** Metrics never rewrite task history or automatically impose incentives, suspension, or penalties without a separately approved policy.

### 13. Offline Mode

- **Purpose:** Keep essential task details and queued scans usable in temporary mobile dead zones.
- **Owns:** The external Flutter app's bounded encrypted local cache and retry queue.
- **Rules:** Offline events carry idempotency keys and are revalidated on replay. The server remains authoritative; stale, conflicting, or unauthorized events are rejected or reconciled explicitly. No Courier web/offline UI belongs in this repository.

### 14. Digital Tipping and Feedback

- **Purpose:** Display Buyer tips or Courier feedback when those platform contracts exist.
- **Owns:** Read-only presentation of authorized tip/review records.
- **Rules:** Payment settlement, tip eligibility, and review moderation are separate features. Courier access cannot edit a Buyer review or manufacture a tip.

### 15. SOS/Emergency Button

- **Purpose:** Send a high-priority safety alert to the owning Logistics organization during an incident.
- **Owns:** Authenticated alert creation, active task context, severity, and the least location information needed for response.
- **Rules:** Last-known coordinates are protected and retained only under an approved policy. The feature does not promise direct local-authority integration or expose a Courier's unrestricted location history.

### 16. Earnings and Goal Tracker

- **Purpose:** Let a Courier view progress toward optional personal earning goals.
- **Owns:** Goal preferences and read-only progress presentation after the earnings contract exists.
- **Rules:** Goals do not alter assignment, payout, Order status, or Logistics capacity. This remains separate from authoritative earnings settlement.

## Operational invariants

- Every protected endpoint rechecks Sanctum authentication, `courier` role, active account status, approved affiliation, active Logistics organization, and valid sole hub.
- Every task, assignment, parcel, waybill, scan, incident, conversation, cache entry, and event is resolved server-side to the authenticated Courier and its authorized Logistics organization/hub.
- `delivery_assigned` is not `delivery_accepted`; neither means `picked_up_from_hub`. First-mile and final-mile pickup states remain distinct.
- State transitions are validated against the current task state, transactional, idempotent, and append immutable history. Notification, mapping, upload, or synchronization failure must not undo a committed decision.
- A Courier can read only its own operational data and the minimum authorized Buyer/Seller/Logistics details needed for the active task. Payment credentials, private registration/POD evidence, raw storage paths, and unrestricted location history are excluded from normal DTOs.

## Current and deferred data boundary

Implemented foundation:

- `users` Courier role and `CourierProfile` with server-derived age.
- One initial `Vehicle` per registration, with string-backed `VehicleType` and `VehicleStatus` casts.
- One current `CourierLogisticsAffiliation` linking the Courier to the selected organization and derived sole hub, with Logistics reviewer, decision, reason, and timestamp.
- Registration applications, private evidence documents, addresses, Sanctum tokens, Courier auth endpoints, and Logistics approval endpoints.

Deferred until the shared shipment contract exists:

- Shipment/parcel records, waybills, scan events, delivery tasks, first-mile/final-mile assignments, proof-of-delivery records, incidents, Courier availability/capacity, earnings, tips, metrics, and offline synchronization.

Future status-like database columns must be stored as strings and cast to PHP enums. Future operational records must preserve the one-Logistics-organization/one-hub boundary and must not place detailed physical milestones directly in `orders.status` without an approved migration.

## Shared contracts

- `docs/requirements.md` — Courier responsibilities and registration boundary.
- `docs/workspace.md` — external mobile boundary, approval flow, physical delivery flow, and canonical status vocabulary.
- `docs/schema.md` — implemented Courier foundation and deferred operational entities.
- `docs/references/user-registration-requirements.md` — Courier registration fields and approval note.
- `docs/references/file-upload-requirements.md` — evidence and proof upload policy.
- `docs/features/courier/*/specs.md` — feature-specific implementation contracts.
