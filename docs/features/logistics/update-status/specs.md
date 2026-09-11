---
feature: logistics-update-status
title: Update Status
system: AISLEY
type: Feature Specification
version: 1.1
status: Deferred — physical operational schema and endpoints unavailable
role: Logistics
scope: Logistics API and Logistics web recovery workflow
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Logistics.md, docs/domains/Courier.md, docs/features/shared/shipment-fulfillment/spec.md
---

# Update Status

## WHAT

- **Purpose:** Let an authorized Logistics account validate operational evidence and commit an allowed Shipment/Delivery Task transition when scan automation needs recovery.
- **Current implementation:** No physical Shipment/Parcel/Scan/Delivery Task tables or Update Status endpoint exists. The current waybill `resolve` action is an access event, not a physical scan or custody transition.
- **Authority:** Logistics validates and records the authoritative event. A Courier performs a physical scan/handoff and submits it; the shared transition service commits state only after validation.
- **Flow:** Courier submits QR/reference/evidence → Logistics validates → transition service commits detailed state and permitted Order projection → immutable history and after-commit notifications.
- **Non-goals:** free-form status editing, assignment, Courier acceptance, waybill generation, address changes, proof-of-delivery bypass, returns/refunds, partial fulfillment, payment changes, subscription gating, and map-provider integration.

## MUST

### Authorization and ownership

- Require `auth:sanctum` and active Logistics role/status on every Logistics endpoint; web mutations also require configured Sanctum CSRF protection.
- Resolve the authenticated user to its one Logistics organization and sole hub. A waybill, Order, Parcel, Courier, or QR value supplied by the client never bypasses scope checks.
- Only records whose immutable Seller-selected Logistics organization is the current organization may be looked up or changed.
- Derive actor, organization, hub, current status, allowed transition, recipient, and timestamps server-side. Never trust client role, status, actor, or notification fields.

### Canonical state contract

- Keep high-level `OrderStatus` separate from detailed physical task states. Existing `assigned` broadly represents hub receipt and `picked_up` broadly represents final-mile hub pickup.
- Detailed states use lowercase `snake_case`: `awaiting_seller_pickup`, `seller_pickup_assigned`, `seller_pickup_accepted`, `picked_up_from_seller`, `received_at_hub`, `sorted_at_hub`, `in_transfer`, `dispatched_from_hub`, `delivery_assigned`, `delivery_accepted`, `picked_up_from_hub`, `in_transit`, `out_for_delivery`, and `delivered`.
- Task-level `rejected` records an offered Courier's refusal without changing the Order; Logistics may re-offer the same task. Informational `stale` does not create an Order status and does not automatically cancel or reassign work.
- Only the shared transition service may commit a state. No individual scanner, manual screen, or client may add source-only uppercase values or skip a required state.

### Transition ownership

- Seller owns `ready_for_pickup`; Courier actions submit first-mile `picked_up_from_seller` or final-mile `picked_up_from_hub` evidence.
- Logistics owns validated hub milestones: `received_at_hub`, `sorted_at_hub`, `in_transfer`, and `dispatched_from_hub`, plus final-mile task offering.
- Customer-facing Order projections remain broad: `assigned` represents hub receipt and `picked_up` represents final-mile hub pickup. Detailed states belong to Shipment/Delivery Task records.
- First-mile and final-mile assignments are independent. Update Status must not infer a second leg, acceptance, or pickup from a generic Order value.

### Courier scan and evidence authority

- A Courier scans the Order's shared waybill QR/reference in the mobile app and submits the event/evidence to Logistics. The Courier does not directly write authoritative custody state.
- Logistics validates the parcel/waybill link, task leg, current state, sole-hub scope, Courier authorization, evidence requirements, and idempotency key before recording the event.
- The authoritative event preserves the performing Courier, recording Logistics account, event timestamp, location/context required by the transition, and safe QR/reference or evidence metadata. The QR/reference, Courier identity, and timestamp are the minimum handoff evidence.
- `waybill_access_events` remain view/download/resolve audit records. A scan or access event alone never advances custody; a validated event plus an allowed transition does.
- Evidence status is distinct from custody: `submitted`, `awaiting_validation`, `validated`, `rejected`, or `unavailable`. Private evidence is authorized and never returned as a raw storage path.

### Manual recovery and notifications

- Manual recovery is allowed only when the target record is resolved, the transition is backend-authorized, and an operational reason/evidence basis is supplied.
- The UI must present the authoritative current state and allowed next transitions; it must not show a generic enum dropdown.
- Successful transitions append immutable history and may update a permitted high-level Order projection. Reservation rules remain unchanged: pre-`picked_up_from_seller` cancellation/rejection releases once; post-pickup returns/refunds/partial fulfillment remain deferred.
- Create/queue Buyer/Seller notification events after the state transaction commits. Delivery failure retries separately and never rolls back the committed transition.

### Failure semantics

- Invalid or unauthorized references return no mutation and do not reveal another organization's record.
- Duplicate scans or manual retries return the original committed projection when the idempotency key and payload match.
- A stale expected revision returns `409` with the current safe state; it must not overwrite newer history.
- If evidence validation fails, record the rejection reason where permitted and keep custody unchanged. Manual recovery still requires an explicit valid basis.
- Notification, communication, or route-provider failure is handled separately from the committed state transition.

### Planned API contract (unavailable)

- `GET /api/v1/logistics/update-status/records/{reference}` — **planned and unavailable**. Auth: active Logistics. Resolves an authorized Order/Parcel/waybill and returns current detailed/high-level state, evidence status, allowed transitions, safe summary, and latest event time.
- `POST /api/v1/courier/tasks/{task}/scan-events` — **planned and unavailable; owning Courier pickup API**. Auth: approved Courier on its offered/accepted task; accepts the task leg, QR/reference value, evidence metadata, expected revision, and idempotency key. The backend routes the submission to the owning Logistics validation/recording service.
- `POST /api/v1/logistics/update-status/scan-events` — **planned and unavailable**. Auth: active Logistics recorder; validates or manually records the routed Courier event and preserves the performing Courier plus recording Logistics account.
- `POST /api/v1/logistics/update-status/transitions` — **planned and unavailable**. Auth: active Logistics; accepts an authorized target state, reference, expected revision, reason, and idempotency key for manual recovery.
- Responses return safe current projections, immutable event identifiers, evidence status, and any permitted Order projection. They never return secrets, private raw paths, or unrelated PII.
- Errors distinguish `401`, `403`, `404`, `409` stale/concurrent state, `422` invalid evidence/transition, `429`, and provider/notification delivery failure. Retrying an identical idempotency key returns the committed projection; changed details conflict.

The planned responses are safe for the Logistics dashboard and external Courier client: machine state plus human label, evidence status, event time, and opaque references. They omit payment credentials, private registration/POD bytes, raw storage paths, and unrelated Customer/Seller details.

### Open questions

- Confirm the configured manual-recovery reason values, evidence retention period, and exact transition-specific notification recipients/channels.
- Confirm whether Logistics may recover any exceptional transition; no rollback, delivery, return, refund, or partial-fulfillment rule is assumed here.

### Acceptance criteria

- [ ] Only the owning Logistics organization and sole hub can resolve or update a record.
- [ ] Unsupported, uppercase, skipped, or stale transitions are rejected without mutation.
- [ ] Courier-submitted scans/evidence are validated and recorded by Logistics with performing and recording actors preserved.
- [ ] A scan/access event alone does not advance custody; only the shared transition service commits state.
- [ ] Evidence status is visible separately from current custody/status.
- [ ] Task rejection leaves the Order unchanged, and informational staleness does not auto-cancel/reassign.
- [ ] History is append-only, idempotent, concurrency-safe, and includes event/evidence references.
- [ ] Notification failure cannot undo a committed state change.
- [ ] Manual recovery cannot fabricate pickup, delivery, proof, or another organization's record.
- [ ] DTOs and logs exclude secrets, raw storage paths, private evidence, and unrelated PII.

## HOW

### Implementation boundary

- Reconcile `docs/features/shared/shipment-fulfillment/spec.md` with `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, and owning role specs before implementation.
- Additive migrations must introduce Shipment/Parcel/Scan/Delivery Task/custody history and actor/evidence fields; never modify executed migrations or native PostgreSQL enum columns.
- Use one transition service for scan/manual validation, state machine rules, sole-hub ownership, row locking or revisions, idempotency, and append-only history. The Dashboard and Courier app consume its projections.
- Courier Pick Up Order owns mobile submission; Update Status owns Logistics-side validation and authoritative recording. Do not create a second competing state machine in either client.
- Keep physical scan submission available to the external Flutter Courier client only through an implemented, versioned API; this repository contains no Courier UI.

### Observability

- Record correlation ID, Logistics actor, performing Courier when applicable, organization/hub, task/leg, event source, evidence status, result, and timestamp.
- Metrics distinguish scan submitted, validation accepted/rejected, manual recovery, conflict, duplicate, and notification failure without logging private evidence or raw paths.

### UI, reliability, and tests

- Logistics UI states: lookup loading, invalid/not-found, unauthorized, evidence submitted/awaiting validation, validation failure, allowed-transition confirmation, conflict/current-state refresh, success, and retry.
- Test role/tenant/sole-hub isolation, QR/reference resolution, invalid evidence, duplicate scans, rejected/stale tasks, concurrency, immutable actor history, reservation boundary, notification failure, IDOR, privacy, SQLite, and PostgreSQL.
- No map provider is required for status mutation; route/distance context belongs to Deploy Rider and remains provider-neutral.

The web client may refresh after a conflict or validation failure, but it must never fabricate a new state locally. A successful response is the server's committed projection, not a promise that email or in-app delivery has completed.

### Rollout boundary

- Keep these endpoints unavailable until the shared operational migrations and transition service are deployed.
- Enable scan submission, Logistics validation, and manual recovery together so evidence cannot be accepted without history.

### References

- Canonical: `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Logistics.md`, `docs/domains/Courier.md`, and `docs/features/shared/shipment-fulfillment/spec.md`.
