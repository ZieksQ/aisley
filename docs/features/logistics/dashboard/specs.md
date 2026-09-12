---
feature: logistics-dashboard
title: Logistics Dashboard
system: AISLEY
type: Feature Specification
version: 1.5
status: Implemented hub scaffold and bounded operational queue; stale threshold/realtime deferred
role: Logistics
scope: Logistics React SPA and Laravel API
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Logistics.md, docs/features/shared/shipment-fulfillment/spec.md
---

# Logistics Dashboard

## WHAT

- **Purpose:** Give an approved active Logistics account a secure view of its organization and sole operational hub, then the parcels requiring action.
- **Current implementation:** `GET /api/v1/logistics/dashboard` remains the safe hub identity scaffold. `GET /api/v1/logistics/dashboard/queue` now returns a private, organization/sole-hub scoped Shipment queue with real summary counts, bounded pagination, filters, safe task/evidence projections, and authoritative freshness metadata. The protected `/dashboard` SPA renders the hub and real queue counts, while `/operations` provides lookup, transition, evidence-review, and final-mile offer controls.
- **MVP boundary:** One Logistics account operates one organization and exactly one hub/sorting center. Sub-hubs, hub selectors, multi-hub queues, and staff-account context are out of scope.
- **Queue boundary:** Only already-created shared Shipment records are listed. Queue reads never lazily create a Shipment or infer readiness; reference lookup remains the owning Update Status operation.
- **Ownership:** Dashboard reads and aggregates. Seller Prepare Orders owns readiness; Deploy Rider owns assignment; Update Status owns validated state recovery; Waybill owns document access; Courier UI is external Flutter/mobile-only.
- **Non-goals:** Seller processing, parcel mutation, waybill generation, scan validation, Courier assignment, route calculation, proof of delivery, billing, and financial reporting.

```text
active Logistics session
→ resolve organization + sole hub
→ read safe hub scaffold and bounded authoritative queue
→ open a record for Update Status / Deploy Rider actions
```

## MUST

### Authentication and scope

- Require `auth:sanctum` and `logistics.active` for the dashboard and every future data source.
- Derive `user → logistics_organization → sole hub` on the server. Reject client-supplied organization, hub, Seller, Order, Courier, or status authority.
- Customer, Seller, Admin, Courier, pending, rejected, suspended, and deactivated accounts receive no dashboard data.
- Scope every row, count, identifier, cache key, event, and private channel to the authenticated organization's sole hub. IDOR-safe not-found/forbidden behavior must not disclose another organization.
- Do not add a subscription gate until a separate Subscription policy exists.

### Current scaffold contract

- Return `hub.id`, `hub.name`, and safe barangay/city/municipality/province/region summary only.
- The base `/dashboard` scaffold continues to return `summary: null`, an empty `orders` list, and server `generated_at` with `freshness.state = scaffold`; authoritative queue data is obtained from `/dashboard/queue`.
- Use `Cache-Control: private, no-store`; one organization's hub projection must never be shared-cached.
- Distinguish unavailable, empty, zero, stale, partial, and failed sections. A null scaffold is not an authoritative zero.
- Reads and refreshes never mutate Orders, Inventory, assignments, evidence, hub state, or history.

### Queue and task projections

- Include a row only when the pickup request's immutable Seller-selected Logistics organization is this organization and preparation has committed `ready_for_pickup`. The current provider-less rows remain transitional and cannot be claimed by any tenant.
- Later rows may enter only through approved Shipment/Delivery Task ownership and transitions: first-mile `picked_up_from_seller`, hub `received_at_hub`/`sorted_at_hub`, `in_transfer`, `dispatched_from_hub`, and final-mile `delivery_assigned`/`picked_up_from_hub`.
- Keep high-level Order values lowercase `snake_case`: `ready_for_pickup`, `picked_up` (explicit first-mile Seller handoff projection), `assigned` (reserved for a later Logistics/final-mile assignment contract), `in_transit`, and `out_for_delivery`. Uppercase labels such as `READY_FOR_PICKUP` or `AT_SORTING_CENTER` are source/UI wording only.
- Do not accept or persist a future/source status until the shared operational schema and transition service approve it. Dashboard display must not turn a label into state.
- Exclude Cart rows, unaccepted/unpacked Orders, cancelled/rejected/payment-invalid records, completed history, and records outside the sole hub.

### Operational queue contract

- `GET /api/v1/logistics/dashboard/queue` is implemented and private. It accepts bounded `status`, `evidence_status`, `search`, `per_page` (1–25), and `page` filters; the server derives organization and sole-hub scope.
- A response contains `data` Shipment projections, `summary` counts, deterministic `meta` pagination, and `freshness.state = authoritative`. Missing records are an empty authoritative result, not fabricated work.
- Queue rows are active operational work; completed `delivered` history is excluded. Summary counts therefore describe the same active queue projection and do not turn archived delivery history into work.
- Errors distinguish unauthorized, forbidden/not-found, validation, rate-limit, timeout, and partial-source failure. Retrying a read is safe and cannot mutate operational state.
- Row status includes the machine value, revision, last activity, allowed next states, and task projections. Rejected offer history includes reason/time; the UI exposes last activity without inventing a stale deadline.
- Evidence fields expose only safe state and opaque references, never raw blob paths or private image bytes. `submitted`/`awaiting_validation` does not mean `validated` or physically received.
- Pagination is deterministic and bounded. Repeated requests with the same page, filters, and scope return the same committed projection or an explicit freshness change.

### Open questions

- Confirm the informational stale/aging threshold and polling/private-realtime transport. Until then, the queue exposes `last_activity_at` only and never auto-reassigns work.
- Evidence filtering currently means validation status (`submitted`, `awaiting_validation`, `validated`, or `rejected`); physical-event filtering remains deferred.

### DTO, refresh, and UI safety

- Rows contain opaque Order/Parcel/Waybill references, status/revision/last activity, task leg/status, safe Courier identity, pickup/destination areas, offer history, and evidence status/references. Deploy Rider candidate responses expose provider-neutral distance/ETA fields, explicitly unavailable when not calculated.
- Exclude payment credentials, private registration/POD evidence, raw storage paths, unrestricted Courier location history, and unrelated personal data.
- Polling or private realtime may trigger refetches only after an owning contract exists; authorize channels to the organization/hub.
- Out-of-order refreshes, retries, and communication failures must not duplicate rows or roll back a committed Logistics decision.
- Use responsive, keyboard-accessible controls, visible focus, readable text labels, and non-color-only state indicators.

### Acceptance criteria

- [x] An approved active Logistics account can access the protected hub scaffold.
- [x] The current response contains only the account's sole-hub summary and safe freshness metadata.
- [x] The scaffold truthfully returns null/empty data rather than fabricated queue counts.
- [x] Loading, refresh, unauthorized, and recoverable error states are available in the SPA.
- [x] Organization/sole-hub scoped queue rows, real counts, status/search/evidence filters, bounded pagination, authoritative freshness, and truthful empty/error states are implemented.
- [x] Rejected final-mile offers, evidence status, completion intents, and current allowed transitions are visible in the Hub operations UI; re-offer and transitions use their owning APIs.
- [ ] A configured stale threshold, private realtime transport, advanced ranking, date filters, and automatic reassignment remain deferred.

## HOW

### Current interfaces

- API route: `GET /api/v1/logistics/dashboard` in `src/api/routes/api.php`.
- API route: `GET /api/v1/logistics/dashboard/queue` in `src/api/routes/api.php`.
- Controller: `src/api/app/Http/Controllers/Logistics/DashboardController.php`.
- SPA: `src/logistics/src/pages/DashboardPage.tsx`, `src/logistics/src/pages/FulfillmentOperationsPage.tsx`, `LogisticsLayout.tsx`, `ProtectedRoute.tsx`, and `auth/AuthContext.tsx`.
- Current migrations provide Logistics identity, organization, sole hub, pickup requests, shared waybills, schedules, first-mile assignment/acceptance, and the additive Shipment/Parcel/DeliveryTask final-mile records.
- Queue reads are implemented by `FulfillmentTransitionService::logisticsQueue`; operational mutations remain owned by Update Status and Deploy Rider. The dashboard does not redefine transition or eligibility rules.
- Dashboard mutations are never a substitute for Deploy Rider or Update Status authorization.

### Deferred dashboard work

- Configure a concrete stale threshold and optional private realtime/polling transport.
- Add any future date filters, advanced ranking, and exception automation only through owning specs and server contracts.

### Observability and rollout

- Record generated time, correlation ID, query scope, source freshness, and section failures without logging private evidence or unrestricted location history.
- Enable operational sections only after their migrations and owning endpoints are deployed; the scaffold must remain truthful during partial rollout.

### Contract status

- This specification documents the scaffold and deployed queue projection; it does not authorize unsupported runtime routes or migrations by itself.
- Any new queue action must name its owning feature, API version, migration, and test coverage before the Dashboard links to it.

### User-facing states

- The page must distinguish hub loaded, queue unavailable, authoritative empty, filtered empty, stale/partial, unauthorized, and retryable failure.
- Rejected-task rows show why the offer is available for re-offer; stale rows show age and require an explicit Logistics action rather than automatic reassignment.
- Evidence status uses text and accessible labels so a Logistics operator can tell “awaiting validation” from “validated” without relying on color.

### Tests and references

- Test role/status/tenant isolation, sole-hub scope, row/count consistency, pagination, IDOR, DTO privacy, rejected/re-offer, stale, evidence states, retry ordering, and notification/realtime failure.
- Canonical references: `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Logistics.md`, and `docs/features/shared/shipment-fulfillment/spec.md`.
