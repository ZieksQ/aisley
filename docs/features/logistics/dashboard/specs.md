---
feature: logistics-dashboard
title: Logistics Dashboard
system: AISLEY
type: Feature Specification
version: 1.4
status: Implemented scaffold; operational queue deferred
role: Logistics
scope: Logistics React SPA and Laravel API
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Logistics.md, docs/features/shared/shipment-fulfillment/spec.md
---

# Logistics Dashboard

## WHAT

- **Purpose:** Give an approved active Logistics account a secure view of its organization and sole operational hub, then the parcels requiring action.
- **Current implementation:** `GET /api/v1/logistics/dashboard` returns the authenticated hub's safe identity/address, `summary: null`, `orders: []`, and `freshness.state = scaffold`. The protected `/dashboard` SPA renders that scaffold with refresh, loading, and recoverable error states.
- **MVP boundary:** One Logistics account operates one organization and exactly one hub/sorting center. Sub-hubs, hub selectors, multi-hub queues, and staff-account context are out of scope.
- **Future queue:** Seller `ready_for_pickup` handoffs, hub work, and first-/final-mile task work become visible only after the shared operational schema and owning APIs exist.
- **Ownership:** Dashboard reads and aggregates. Seller Prepare Orders owns readiness; Deploy Rider owns assignment; Update Status owns validated state recovery; Waybill owns document access; Courier UI is external Flutter/mobile-only.
- **Non-goals:** Seller processing, parcel mutation, waybill generation, scan validation, Courier assignment, route calculation, proof of delivery, billing, and financial reporting.

```text
active Logistics session
→ resolve organization + sole hub
→ read scaffold (current)
→ future: scoped operational queue and task summaries
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
- Return `summary: null`, an empty `orders` list, and server `generated_at` with `freshness.state = scaffold` until authoritative queue records exist.
- Use `Cache-Control: private, no-store`; one organization's hub projection must never be shared-cached.
- Distinguish unavailable, empty, zero, stale, partial, and failed sections. A null scaffold is not an authoritative zero.
- Reads and refreshes never mutate Orders, Inventory, assignments, evidence, hub state, or history.

### Queue and task projections

- Include a row only when the pickup request's immutable Seller-selected Logistics organization is this organization and preparation has committed `ready_for_pickup`. The current provider-less rows remain transitional and cannot be claimed by any tenant.
- Later rows may enter only through approved Shipment/Delivery Task ownership and transitions: first-mile `picked_up_from_seller`, hub `received_at_hub`/`sorted_at_hub`, `in_transfer`, `dispatched_from_hub`, and final-mile `delivery_assigned`/`picked_up_from_hub`.
- Keep high-level Order values lowercase `snake_case`: `ready_for_pickup`, `picked_up` (explicit first-mile Seller handoff projection), `assigned` (reserved for a later Logistics/final-mile assignment contract), `in_transit`, and `out_for_delivery`. Uppercase labels such as `READY_FOR_PICKUP` or `AT_SORTING_CENTER` are source/UI wording only.
- Do not accept or persist a future/source status until the shared operational schema and transition service approve it. Dashboard display must not turn a label into state.
- Exclude Cart rows, unaccepted/unpacked Orders, cancelled/rejected/payment-invalid records, completed history, and records outside the sole hub.

### Planned queue contract (unavailable)

- `GET /api/v1/logistics/dashboard/queue` is planned and unavailable until the shared operational schema and owning queue contract are implemented.
- Query parameters, when approved, are limited to bounded status, assignment, evidence, date, search, and cursor/page filters; the server derives organization and hub scope.
- A response contains `summary`, `rows`, `pagination`, `freshness`, and per-section error state. It never treats missing operational tables as zero work.
- Errors distinguish unauthorized, forbidden/not-found, validation, rate-limit, timeout, and partial-source failure. Retrying a read is safe and cannot mutate operational state.
- Row status includes both the machine value and human label, plus `status_at`; task exceptions include rejection time/reason and stale freshness without changing the Order status.
- Evidence fields expose only safe state and references, never raw blob paths or private image bytes. `submitted` does not mean `validated` or physically received.
- Pagination is deterministic and bounded. Repeated requests with the same cursor and scope return the same committed projection or an explicit freshness change.

### Open questions

- Confirm queue page size/cursor, aging threshold, visible contact fields, and polling/private-realtime transport when the operational queue is implemented.
- Confirm whether evidence filtering includes only validation state or also physical-event type; do not infer either choice from the scaffold.

### DTO, refresh, and UI safety

- Future rows may contain opaque Order/Parcel/Waybill references, status and status time, safe Shop/Seller summary, pickup/destination area, schedule, Courier assignment state, and provider-neutral `distance_km`/`estimated_duration_minutes` when authorized.
- Exclude payment credentials, private registration/POD evidence, raw storage paths, unrestricted Courier location history, and unrelated personal data.
- Polling or private realtime may trigger refetches only after an owning contract exists; authorize channels to the organization/hub.
- Out-of-order refreshes, retries, and communication failures must not duplicate rows or roll back a committed Logistics decision.
- Use responsive, keyboard-accessible controls, visible focus, readable text labels, and non-color-only state indicators.

### Acceptance criteria

- [x] An approved active Logistics account can access the protected hub scaffold.
- [x] The current response contains only the account's sole-hub summary and safe freshness metadata.
- [x] The scaffold truthfully returns null/empty data rather than fabricated queue counts.
- [x] Loading, refresh, unauthorized, and recoverable error states are available in the SPA.
- [ ] Seller-ready queue rows, rejected-task visibility/re-offer, stale display, evidence state, counts, filters, pagination, and operational updates are implemented.

## HOW

### Current interfaces

- API route: `GET /api/v1/logistics/dashboard` in `src/api/routes/api.php`.
- Controller: `src/api/app/Http/Controllers/Logistics/DashboardController.php`.
- SPA: `src/logistics/src/pages/DashboardPage.tsx`, `LogisticsLayout.tsx`, `ProtectedRoute.tsx`, and `auth/AuthContext.tsx`.
- Current migrations provide Logistics identity, organization, sole hub, pickup requests, shared waybills, schedules, and first-mile assignment/acceptance. Physical Shipment/Parcel/Scan/Delivery Task and final-mile records remain deferred.
- No queue, evidence, rejection, re-offer, or stale-mutation route currently exists; these remain unavailable rather than implied by the scaffold.
- Dashboard mutations are never a substitute for Deploy Rider or Update Status authorization.

### Future implementation

- Reconcile the shared Shipment/Fulfillment guide with `docs/schema.md` and each owning feature before adding queue actions.
- Add additive migrations for the physical records and append-only event history. The Dashboard must consume, not redefine, transition rules.
- Add an organization/hub-scoped query/resource with consistent predicates for summary and rows. Label planned endpoints unavailable until implemented.
- Link rejected-task re-offer to Deploy Rider and evidence validation to Update Status; deep links must re-authorize in those features.

### Observability and rollout

- Record generated time, correlation ID, query scope, source freshness, and section failures without logging private evidence or unrestricted location history.
- Enable operational sections only after their migrations and owning endpoints are deployed; the scaffold must remain truthful during partial rollout.

### Contract status

- This specification documents the current scaffold and the future queue projection; it does not authorize runtime routes or migrations by itself.
- Any new queue action must name its owning feature, API version, migration, and test coverage before the Dashboard links to it.

### User-facing states

- The page must distinguish hub loaded, queue unavailable, authoritative empty, filtered empty, stale/partial, unauthorized, and retryable failure.
- Rejected-task rows show why the offer is available for re-offer; stale rows show age and require an explicit Logistics action rather than automatic reassignment.
- Evidence status uses text and accessible labels so a Logistics operator can tell “awaiting validation” from “validated” without relying on color.

### Tests and references

- Test role/status/tenant isolation, sole-hub scope, row/count consistency, pagination, IDOR, DTO privacy, rejected/re-offer, stale, evidence states, retry ordering, and notification/realtime failure.
- Canonical references: `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Logistics.md`, and `docs/features/shared/shipment-fulfillment/spec.md`.
