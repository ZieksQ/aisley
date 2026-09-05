---
feature: dashboard
title: Logistics Dashboard
system: AISLEY
type: Feature Specification
version: 1.1
status: Draft — pending operational shipment-state contract
role: Logistics
scope: Logistics Web Application and Laravel API
source_coverage: Logistics.md, requirements.md, workspace.md, schema.md
---

# Logistics Dashboard

## WHAT

- **Purpose:** Give the approved Logistics account a secure, hub-scoped operational view of Seller-confirmed parcels that require Logistics attention.
- **Primary actor:** An authenticated active `LOGISTICS` account using the React/TypeScript Logistics web application.
- **Frontend route:** `/dashboard`, after the Logistics Auth session is restored.
- **API endpoint:** `GET /api/v1/logistics/dashboard`.
- **Current status:** The protected Logistics authentication and `/dashboard` SPA scaffold are implemented. The operational queue is not implemented yet; the current schema has the Logistics role, organization, sole-hub, and Courier-affiliation foundation but no shipment, parcel, waybill, scan, or delivery-task tables.
- **MVP organization scope:** Each Logistics organization has exactly one operational hub/sorting center and one operating Logistics account. The Dashboard has no hub selector, sub-hub view, or multi-hub branch.
- **Core lifecycle:**

```text
Seller processes/packs Order
→ committed `ready_for_pickup` handoff
→ Logistics Dashboard queue
→ receive / waybill / sort / transfer / dispatch
→ Deploy Rider
→ external Courier mobile application
```

- **Status naming:** Persisted/API values use lowercase `snake_case`; PHP enum cases use PascalCase; UI labels are human-readable. The current Order enum contains `ready_for_pickup`. Source-only labels such as `READY_FOR_PICKUP` and `AT_SORTING_CENTER` are not persisted; the future shipment/task contract uses explicit values such as `received_at_hub` and `sorted_at_hub`.
- **Dashboard responsibility:** Read, aggregate, filter, search, refresh, show freshness, and navigate to owning Logistics features. It does not own parcel/order mutations.
- **Feature boundaries:** Seller Prepare Orders owns the handoff; Waybill, Update Status, Deploy Rider, Chat, Fleet, Zone, and Capacity features own their records and mutations.
- **Non-goals:** Seller processing, parcel scanning/status mutation, waybill generation, rider assignment or routing, Courier UI, multi-hub/sub-hub management, fleet/zone editing, full capacity monitoring, billing, and financial reporting.

## MUST

### Authentication and scope

- Require `auth:sanctum` plus the Logistics-active role/status middleware defined by Logistics Auth.
- Resolve the exact authenticated `user_id → Logistics organization → sole hub` relationship on the server. Never authorize from email, a client-supplied `organization_id`, `hub_id`, or Seller ID.
- A Customer, Seller, Admin, Courier, pending, rejected, suspended, or deactivated account cannot read Dashboard data, even when it shares an email with Logistics.
- If subscription status gates operational access, enforce that policy server-side and return a stable subscription-required state; Dashboard must not invent billing rules.
- All queue queries, counts, caches, events, and links must remain inside the authenticated organization’s sole-hub scope.

### Queue inclusion and state authority

- Include only Orders whose Seller-side processing has committed the Logistics handoff, beginning with canonical `ready_for_pickup` (`READY_FOR_PICKUP`).
- Include later Logistics-actionable states such as sorting-center receipt only after their shipment/state values and ownership relation are approved; do not invent or accept arbitrary status strings.
- Resolve inclusion from authoritative Order/shipment records and the organization’s hub relation, not from browser-provided flags or address text.
- Exclude carts, unconfirmed or unpacked Seller Orders, cancelled/rejected/payment-invalid records, completed history, and records outside the organization’s authorized hub.
- Read current status and server timestamps; do not let Dashboard reads or filters mutate Orders, inventory, assignments, or status history.

### Queue records and privacy

- Each bounded row may contain the stable Order ID/reference, current status, status-updated time, Seller/Shop summary, pickup-area summary, destination-area summary, waybill reference when available, and assigned/unassigned Courier state.
- Show only operationally necessary Buyer/Seller data. Do not return full profiles, payment credentials, password/session data, or private registration evidence.
- Render Seller names, Buyer labels, addresses, and other user-controlled text safely; do not execute HTML or arbitrary markup.
- Any row action carries only a stable resource reference. The destination feature must re-authorize the Order/parcel instead of trusting Dashboard navigation.

### Summary, filters, and pagination

- Summary counts use the exact same organization, hub, status, and assignment inclusion rules as the queue.
- An authoritative zero is `0`; failed or unavailable counts are represented as unavailable/error, never as zero or an empty queue.
- Support bounded server-side status filtering, assignment filtering when assignment data exists, and search over configured Order/reference/waybill/Seller fields.
- Use deterministic server-side ordering and cursor/page pagination with a configured maximum. Never load every actionable parcel into the browser or calculate totals in React.
- Preserve valid filter/search/pagination state on refresh and return the normalized query/freshness metadata used by the response.

### API contract

- `GET /api/v1/logistics/dashboard` accepts only validated `status`, `assignment`, `search`, `cursor`, and bounded `limit` parameters.
- Return one safe DTO containing `hub`, `summary`, `orders`, and server-generated `freshness` metadata.
- `hub` identifies only the authenticated organization’s sole operational hub. `summary` contains status/assignment counts; `orders` contains bounded rows and pagination links/cursor.
- Return machine statuses from the approved Order/shipment contract and human-readable labels separately; do not persist source-only uppercase labels without an approved enum mapping.
- Whole-request authentication, scope, or validation failures fail normally (`401`, `403`, or `422`); optional section failures must be explicit and retryable.
- Dashboard GET requests are read-only and use private/no-store responses when data is organization-specific.

### Refresh, realtime, and reliability

- Support polling or an approved private WebSocket/broadcast channel; the initial MVP may use polling.
- Backend/database state remains authoritative. Realtime signals trigger a refetch or reconcile one affected row; they never create authoritative state in the browser.
- Scope any private channel to the Logistics organization/sole hub and authorize it server-side. No third-party provider is required for the basic queue.
- On disconnect, failed polling, or missed events, show stale/error state and refetch when connectivity returns. Never silently convert a failure to an empty queue.
- Repeated refreshes, realtime events, and out-of-order responses must not duplicate rows or overwrite newer data with stale data.

### Feature handoffs

- `Dashboard → Waybill` may view/generate the selected parcel’s label; Waybill owns generation, printing, and identifiers.
- `Dashboard → Update Status` may open the selected parcel’s allowed transition; Update Status owns validation, scanning/manual fallback, history, and mutation.
- `Dashboard → Deploy Rider` may open the selected dispatchable task; Deploy Rider owns Courier eligibility, distance/routing, assignment, and idempotency.
- `Dashboard → Chat`, Fleet, Zone, or Capacity views may deep-link to the owning feature without copying its records or state.
- After a linked mutation commits, refetch the authoritative Dashboard payload. Assignment is not physical pickup, and a status display must not imply otherwise.

### UX and acceptance

- Provide loading/skeleton, loaded, empty, filtered-empty, partial, stale, unauthorized, whole-page error, and retry states without blocking the application shell.
- Use responsive semantic table/list patterns, keyboard-accessible controls, visible focus, readable status text, and non-color-only indicators.
- [x] Only an approved active Logistics account can fetch the Dashboard.
- [x] Every returned count, row, identifier, cache entry, and event belongs to the account’s organization and sole hub.
- [x] Seller-confirmed `ready_for_pickup` Orders appear; pre-handoff, invalid, cancelled, completed, and out-of-scope Orders do not.
- [x] Source-only future statuses are not accepted until the approved shipment/state contract exists.
- [x] Counts match their queue filters, and failures are distinguishable from authoritative zero/empty results.
- [x] Search, filters, sorting, and pagination are bounded, deterministic, server-authoritative, and IDOR-safe.
- [x] Refresh/realtime/reconnect does not duplicate rows or lose committed state.
- [x] Linked Waybill, Update Status, Deploy Rider, Chat, Fleet, Zone, and Capacity actions re-authorize in their owning feature.
- [x] Buyer/Seller PII, payment secrets, private evidence, and raw storage paths are absent from Dashboard DTOs.

## HOW

- Add a Logistics-namespaced `DashboardController`, request, resource, query/service, scope policy, and versioned route after the Logistics Auth and organization/hub schema exist.
- Build `src/logistics` with the shared credentialed API client, protected layout, summary cards, validated filters/search, bounded queue, deep links, and accessible state components. Reuse `@aisley/ui` where compatible.
- Start with the Seller Prepare Orders `ready_for_pickup` handoff and existing `orders`/`order_status_events`; add sorting/transfer/dispatch states only with additive shipment/state migrations and cross-feature tests.
- Aggregate counts and rows in scoped database queries, avoid N+1 Seller/Courier joins, and add indexes only after the organization/hub ownership columns are approved.
- Use a versioned status adapter so UI labels can evolve without changing historical Order events. Keep API DTOs free of provider credentials and private storage paths.
- Test role/status denial, exact organization/hub isolation, Seller handoff inclusion, invalid-state exclusion, count consistency, search/pagination, IDOR, PII minimization, stale/reconnect behavior, duplicate-event handling, and linked-feature authorization on SQLite and PostgreSQL.
- Roll out authentication/scope and the read-only queue first; enable realtime and later Logistics states only after their source events, shipment schema, and transition rules are implemented.
- **Open decisions:** exact organization/hub-to-Order ownership relation; which deferred shipment/task milestones become current-state fields versus scan/event records; subscription gating; default sort/page size; date filters and aging display; polling interval versus broadcast driver/SLO; cache policy; visible destination/contact fields; and which summary previews are MVP. `AT_SORTING_CENTER` is source shorthand, not an approved canonical value.

### References

- Project: `docs/requirements.md`, `docs/workspace.md`, `docs/architecture.md`, `docs/schema.md`, `docs/domains/Logistics.md`, and `docs/features/logistics/auth/spec.md`.
- Dependent contracts: Seller Prepare Orders, Waybill, Update Status, Deploy Rider, Chat/Messaging, Vehicle Fleet, Zone/Territory Mapping, and Flexible Availability & Capacity Monitoring.
- [Laravel 13 Sanctum SPA authentication](https://laravel.com/framework/docs/13.x/sanctum#spa-authentication)
- [Laravel 13 broadcasting](https://laravel.com/framework/docs/broadcasting)
