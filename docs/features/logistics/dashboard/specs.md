---
feature: logistics-dashboard
title: Logistics Dashboard
system: AISLEY
type: Feature Specification
version: 1.2
status: Implemented scaffold; operational queue deferred
role: Logistics
scope: Logistics React SPA and Laravel API
source_coverage: Logistics.md, requirements.md, workspace.md, schema.md
---

# Logistics Dashboard

## WHAT

- **Purpose:** Give an approved active Logistics account one secure view of its organization's sole operational hub and, later, the parcels requiring its attention.
- **Current implementation:** `GET /api/v1/logistics/dashboard` returns the authenticated hub's safe identity/address, `summary: null`, `orders: []`, and freshness state `scaffold`. The protected `/dashboard` SPA page renders that hub, an operational-queue placeholder, refresh, loading, and recoverable error states.
- **MVP scope:** one Logistics account → one organization → exactly one hub/sorting center. There is no hub selector, sub-hub, second-hub branch, or staff-account context.
- **Future queue:** once the shared Shipment/Parcel/Waybill/Scan/Delivery Task schema exists, the dashboard will surface Seller-ready handoffs for this selected organization, then hub receipt, sorting, transfer, dispatch, and assignment work.
- **Ownership:** Dashboard reads and aggregates. Seller Prepare Orders owns `ready_for_pickup`; Waybill, Update Status, Deploy Rider, Chat, Fleet, Zone, and Capacity features own their records and mutations. Courier UI is external/mobile-only.
- **Subscription:** subscription billing and enforcement are deferred; an approved active Logistics account is not blocked by an unimplemented subscription status.
- **Non-goals:** Seller processing, parcel/status mutation, waybill generation, scanning, Courier assignment/routing, Courier UI, multi-hub management, billing, and financial reporting.

```text
active Logistics session
→ resolve organization + sole hub
→ read hub scaffold (current)
→ future: Seller `ready_for_pickup` queue
→ future: receive/waybill/sort/transfer/dispatch/rider actions
```

## MUST

### Authentication and tenant scope

- Require `auth:sanctum` and `logistics.active` for the endpoint and every future Dashboard data source.
- Resolve `user → logistics_organization → sole hub` server-side. Never trust a client `organization_id`, `hub_id`, Seller ID, email, address text, or status flag.
- Customer, Seller, Admin, Courier, pending, rejected, suspended, and deactivated accounts receive no Dashboard data, including when an email is shared with a Logistics account.
- All rows, counts, links, events, cache keys, and private channels must be scoped to the authenticated organization's sole hub. IDOR-safe not-found/forbidden behavior must not disclose another organization's records.
- Do not add subscription checks or a `subscription_required` state until a Subscription feature is approved; current access is governed by active account/status and an existing sole hub.

### Current scaffold contract

- `GET /api/v1/logistics/dashboard` is read-only and returns:
  - `hub`: the sole hub `id`, `name`, and safe barangay/city/municipality/province/region summary;
  - `summary`: `null` until authoritative queue records exist;
  - `orders`: an empty list until the queue contract exists; and
  - `freshness`: server `generated_at` plus `state = scaffold`.
- Return `Cache-Control: private, no-store`. Do not cache one organization's hub response for another account.
- A null/unavailable section is not an authoritative zero. Future counts must distinguish `0`, empty, stale, and failed states.
- Reads and refreshes never mutate Orders, Inventory, assignments, hub state, or status history.

### Future queue inclusion and canonical statuses

- Include a row only when its selected Customer Logistics organization is this organization and Seller preparation has committed `ready_for_pickup`. The current Order schema does not yet persist that provider selection, so no operational queue may be fabricated today.
- Later rows may enter only through approved Shipment/Delivery Task ownership and transitions: first-mile `picked_up_from_seller`, hub `received_at_hub`/`sorted_at_hub`, `in_transfer`, `dispatched_from_hub`, and final-mile `delivery_assigned`/`picked_up_from_hub`.
- Keep high-level Order values lowercase `snake_case`: `ready_for_pickup`, `assigned` (hub receipt/acceptance), `picked_up` (final-mile hub pickup), `in_transit`, and `out_for_delivery`. Uppercase labels such as `READY_FOR_PICKUP` or `AT_SORTING_CENTER` are source/UI wording only.
- Do not accept or persist a future/source status until the shared operational schema and transition service approve it. Dashboard display must not turn a label into state.
- Exclude Cart rows, unaccepted/unpacked Orders, cancelled/rejected/payment-invalid records, completed history, and records outside the sole hub.

### Future summary, filters, and rows

- Counts must use the exact same organization, hub, status, and assignment predicates as the queue rows. A filter cannot alter authoritative state.
- Use bounded server-side status/assignment filters, configured search fields, deterministic sorting, and bounded pagination. Never load the whole operational queue or calculate counts in React.
- A future row may include opaque Order/Parcel/Waybill references, current machine status plus human label, safe Shop/Seller summary, pickup/destination area, status time, and assigned/unassigned Courier state when that record exists.
- Do not expose full Customer/Seller profiles, payment credentials, private registration evidence, raw storage paths, unrestricted Courier location history, or unrelated Order IDs.
- Every deep link must re-authorize in its owning feature; Dashboard navigation is not permission.

### Refresh, reliability, and UI

- Current SPA supports loading, hub scaffold, refresh, and recoverable API error/try-again states. Future queue UI must add authoritative empty, filtered-empty, stale/partial, unauthorized, and retry states without hiding the app shell.
- Polling or a private broadcast may trigger refetches after the queue exists. Scope channels to the organization/sole hub and authorize subscriptions server-side; browser signals never create state.
- Out-of-order refreshes, retries, and duplicate events must not duplicate rows or overwrite newer data with stale payloads. A notification/realtime failure cannot undo a committed operational decision.
- Use responsive, keyboard-accessible list/table controls, visible focus, readable status labels, and non-color-only indicators.
- [x] An approved active Logistics account can access the protected hub scaffold.
- [x] The response contains only the account's sole-hub summary and safe freshness metadata; no other tenant's data is returned.
- [x] Current `summary: null`/empty queue and `freshness.state = scaffold` are truthful rather than fabricated counts.
- [x] Refresh, loading, unauthorized, and recoverable error states are available in the SPA.
- [ ] Seller-ready queue, counts/filters/search/pagination, shipment milestones, waybill/scan/task actions, and live operational updates are implemented.

## HOW

### Current code and interfaces

- API route: `GET /api/v1/logistics/dashboard` in `src/api/routes/api.php`, protected by `auth:sanctum` and `logistics.active`.
- Current controller: `src/api/app/Http/Controllers/Logistics/DashboardController.php`; it loads `logisticsOrganization.hub.address` through the authenticated User and returns a private no-store scaffold response.
- Current SPA: `src/logistics/src/pages/DashboardPage.tsx`, `LogisticsLayout.tsx`, `ProtectedRoute.tsx`, and `auth/AuthContext.tsx`. The client uses credentialed requests and an explicit refresh button; it does not own queue authority.
- The current foundation migration is `2026_09_05_000001_create_logistics_foundation_tables.php`; Shipment, Parcel, Waybill, Scan, Delivery Task, assignment, proof-of-delivery, availability, and capacity records remain deferred.

### Future implementation sequence

- First reconcile `docs/order-logistics-flow-decisions.md`, `docs/workspace.md`, `docs/schema.md`, Seller Prepare Orders, and the Logistics/Courier operational specs. Do not implement Dashboard actions against guessed tables or statuses.
- Add additive migrations for the complete shared operational records, including the immutable Order/Parcel link, selected Logistics organization, sole hub, first-/final-mile tasks, and append-only events.
- Implement a scoped query/service and Resource that derives summary counts and rows from those records. Keep controller filters validated and use indexes matching organization/hub/status/activity predicates.
- Deep-link only to owning Waybill, Update Status, Deploy Rider, Chat, Fleet, Zone, or Capacity contracts. Logistics creates first-mile tasks after Seller `ready_for_pickup`; first-/final-mile Courier assignments remain independent.
- Test role/status/tenant isolation, sole-hub scope, provider selection, inclusion/exclusion, count consistency, pagination, IDOR, DTO privacy, stale/reconnect behavior, duplicate events, and linked-feature authorization on SQLite/PostgreSQL.

### Open decisions and references

- Still approve the exact organization-to-Order/fulfillment relation, queue aging/sort/page size, visible address/contact fields, map/location exposure, realtime driver/SLO, and subscription policy before operational rollout.
- Related contracts: `docs/features/logistics/auth/spec.md`, Seller Prepare Orders, Waybill, Update Status, Deploy Rider, Chat/Messaging, Vehicle Fleet, Zone/Territory Mapping, Flexible Availability/Capacity, `docs/domains/Logistics.md`, `docs/workspace.md`, and `docs/schema.md`.
