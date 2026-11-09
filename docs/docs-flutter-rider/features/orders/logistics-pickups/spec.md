---
feature: seller-logistics-pickup-scheduling
title: Seller-to-Logistics Pickup Scheduling
system: AISLEY
type: Feature Specification
version: 2.2
status: Implemented (scheduling, schedule lifecycle, and bounded reconciliation)
roles: Seller, Logistics, Courier API
scope: Seller SPA, Logistics SPA, Courier API, Laravel API, scheduler
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Logistics.md, docs/domains/Courier.md, docs/features/shared/shipment-fulfillment/spec.md
---

# Seller-to-Logistics Pickup Scheduling

## Shared shipping revision — 2026-10-04

Seller enables providers for its Shop; Customer selects/freezes one per Order. Pickup uses that selection. Bulk requests must group matching providers. Legacy options/ranking below cannot override snapshot-backed Orders. Route/provider unavailability holds fulfillment; Courier task/COD/evidence contracts and client acceptance are unchanged.

## WHAT

- **Purpose:** Let a Seller hand prepared Orders to one selected Logistics organization, then let that organization assign an employed Courier and pickup schedule.
- **Actors:** Seller requests the checkout-selected provider; Logistics owns its Pickups dashboard and schedule; Courier receives the assigned first-mile task through the external mobile app.
- **Scope:** Seller SPA, Logistics SPA, Courier API, Laravel API, scheduler, database notifications, and Geoapify-backed distance ranking.
- **Current baseline:** Sellers can submit solo or bulk pickup requests with up to 50 Orders, and Logistics can combine eligible parcels from multiple Seller requests into one Courier schedule. Each created waybill has an explicit tracking ID, and the pickup transaction snapshots the Buyer postal code plus the selected Logistics hub's current sort-plan hint for later routing.
- **Target flow:**
  ```text
  Seller packs Orders → verifies checkout-selected Logistics → requests pickup
  → Orders become ready_for_pickup and waybills are created
  → selected Logistics sees the request in Pickups
  → Logistics combines one or more Seller handoffs (up to 30 parcels)
  → Logistics assigns one affiliated Courier and pickup window
  → Seller and Courier are notified
  → Courier explicitly accepts the first-mile task
  → accepted Courier verifies identifier and explicitly confirms Seller pickup
  → Logistics later records hub receipt
  ```
- One request belongs to one Shop and one Logistics organization; a Seller request may contain up to 50 Orders, while one pickup schedule may combine Orders from multiple Shops/requests addressed to that Logistics tenant and may contain at most 30 Orders for one Courier.
- Logistics must split a request over 30 Orders into multiple schedules; Orders, waybills, custody, status, and idempotency remain independent.
- Courier acceptance is required before physical handoff. Assignment creates an offered/assigned task; it does not mean `seller_pickup_accepted` or `picked_up_from_seller`.
- Courier may reject a wholly unaccepted first-mile schedule; its uncollected parcels return to Logistics scheduling with append-only decisions and no Order or Inventory change. Final-mile decisions retain their separate contract.
- Uncollected first-mile work has a 72-hour retry deadline from the scheduled start. The minute scheduler releases outstanding assigned/accepted parcels after that deadline; Logistics explicitly creates a new schedule.
- **Non-goals:** parcel weight/dimension capacity, route optimization across stops, automatic Courier assignment, fixed Courier shifts, hub receipt/sorting, final-mile assignment, delivery completion, or Courier web UI.

## MUST

### Seller pickup provider validation

- Require Sanctum, active approved Seller access, and a server-derived Shop for every option and pickup request.
- Seller may request only its own `seller_processing` Orders with valid payment, address snapshots, and Inventory reservations.
- The request accepts one server-validated `logistics_organization_id`; it never accepts Seller, Shop, hub, Courier, distance, availability, or status as authority.
- An eligible Logistics option has an active Logistics user, organization, sole hub with a valid address, and at least one active Courier with an approved affiliation to that organization.
- Normalize country, province, and city/municipality using the project's PSGC conventions; compare case-insensitively after trimming.
- Rank eligible options in this order:
  - exact country + province + city/municipality matches first;
  - within a tier, shortest Geoapify driving distance first when both endpoints have coordinates;
  - options without a distance last, ordered by business name and UUID.
- Preselect the sole exact match; if several exact matches exist, preselect the shortest returned distance; if no exact match exists, preselect the nearest ranked option.
- Display the recommendation reason, availability, and rounded one-decimal kilometre distance; label unavailable distance honestly.
- Snapshot-backed Orders require their checkout-selected provider; Seller may not substitute another. Recommendation/preselection above applies only to legacy Orders without pricing snapshots.
- Missing distance never permits provider substitution. For legacy Orders without snapshots, eligible options remain selectable without fabricated `0 km`.
- If no provider is eligible, do not advance Orders or create waybills; show a retryable unavailable state.
- Provider selection becomes immutable when the pickup request commits; reassignment needs an explicit future exception workflow.

### Request, queue, and tenant isolation

- Preserve the current maximum of 50 distinct Orders per Seller request; expose unscheduled counts clearly and never assign more than 30 of them to one schedule.
- In one locked transaction, revalidate Shop ownership, all Orders, chosen Logistics eligibility, reservation state, and a Seller-scoped idempotency key.
- Commit one request, its Order links, each `seller_processing → ready_for_pickup` event, and one waybill per Order atomically.
- During that same transaction, evaluate the Buyer postal code against the selected Logistics hub's current active sort plan and persist the immutable routing hint with the waybill. This hint is advisory history; hub scan-time routing rechecks the current plan and may fall back to the exception lane.
- Notify only the selected Logistics organization after commit; never broadcast a request to every Logistics account.
- Logistics Pickups is schedule-first: its primary list contains only schedules whose `logistics_organization_id` and hub match the authenticated account's server-derived organization and sole hub.
- Support bounded schedule pagination and allow-listed status/date/search filters with deterministic schedule ordering.
- The Logistics schedule list defaults to `scheduled`, lets the operator explicitly include completed/cancelled history, and supports allow-listed ascending or descending pickup-window ordering.
- Each schedule row shows schedule reference/ID, assigned Courier, linked Seller pickup-request IDs, status, pickup window, total parcel count, and remaining parcels still in `assigned` or `accepted` first-mile task states.
- **Create new schedule** opens the pending-parcel selector. It lists only unscheduled Orders for the tenant, groups them by Shop/pickup request, orders Shops by name and requests oldest-first, supports whole-request or individual parcel selection, and caps the selection at 30.
- Keep `orders.status = ready_for_pickup` when scheduled; scheduling is not physical custody and does not consume Inventory.

### Courier assignment and schedule

- Logistics may select 1–30 unscheduled Orders from its own pending requests and create one first-mile pickup schedule.
- All selected Orders must belong to the authenticated Logistics organization; a schedule may span multiple Seller Shops and requests when its single pickup window is operationally valid.
- Courier must have an active account and current approved affiliation to that same organization/hub; never trust a submitted foreign Courier ID.
- Schedule a single future `starts_at` in UTC and display it in Asia/Manila. New web scheduling has no end-date field. `ends_at` is nullable in API responses; legacy clients may still send a later end, but it never releases an unfinished Courier reservation. Pickup and active linehaul assignments mutually block new work until physical completion or explicit release of all uncollected pickup assignments.
- Lock selected Orders/request links and recheck schedule capacity and Courier conflicts before commit; return `409` for stale or competing assignment.
- Create a first-mile task per Order under one schedule; assignment does not imply `seller_pickup_accepted` or `picked_up_from_seller`.
- The assigned Courier must explicitly accept before physical pickup. First-mile acceptance does not imply Seller handoff or hub receipt.
- First-mile rejection uses the implemented Courier schedule decision endpoint below; Logistics creates a new schedule/task for released parcels while retaining their existing waybill and original assignment history.
- Informational `stale` remains a display outcome, separate from the implemented first-mile 72-hour release policy; neither writes an Order status.
- Retrying the same Logistics idempotency key returns the committed schedule; it must not duplicate tasks or notifications.
- Editing or cancelling a future schedule requires an expected revision, reason, append-only history, and fresh notifications; it cannot silently overwrite custody history.

### PickupSchedule lifecycle

- A new `PickupSchedule` starts as `scheduled`; `remaining_parcel_count` counts only its linked first-mile tasks in `assigned` or `accepted`, not Orders awaiting final delivery.
- Complete a still-`scheduled` schedule only when every retained task is `picked_up_from_seller` and every retained parcel has authoritative `received_at_hub_at` evidence. The last Logistics hub receipt completes the schedule atomically and frees its Courier for new work. One task still represents one Order; one schedule may group many Orders.
- A schedule remains `scheduled` while any task is `assigned` or `accepted`, or any collected parcel is awaiting hub receipt. Zero remaining means Seller collection is finished; it does not free the Courier. Missing or inconsistent membership cannot complete a schedule. Cancelled tasks with explicit `released_at` evidence remain historical members and are excluded from retained custody obligations; other cancelled tasks remain inconsistent.
- Completed schedules remain historical, cannot be revised/cancelled, and suppress pending reminders; claimed/retried reminder work must recheck eligibility. Legacy completed schedules with unreceived parcels still block Courier reuse through their task/custody evidence. Elapsed end dates never establish availability.
- Schedule completion means Seller collection and return to the Logistics hub are finished. It does not imply final-mile `delivered`, repeat Inventory fulfillment, or change final-mile assignments/statuses.
- `PickupScheduleLifecycleService` completes the parent in the final hub-receipt transaction, suppresses pending or claimed reminders, and exposes a bounded `pickups:reconcile-schedules` command for existing zero-remaining candidates. Reconciliation only completes schedules whose membership is complete and every retained task is already `picked_up_from_seller` and every retained parcel has hub receipt evidence; empty, missing, unexpectedly cancelled, or partial task sets are reported without replaying pickup or Inventory effects.

### Notifications and cron

- After schedule commit, queue database notifications to the Seller and assigned Courier with schedule reference, pickup date/window, safe location summary, Order count, and deep-link/API reference.
- Parcel release notifies the affected Sellers and owning Logistics after commit; the immutable decision/history retains the reason and released membership. Notification failure never restores an assignment or duplicates a release.
- Create durable reminder rows for one hour before `starts_at`; if scheduled inside one hour, the assignment notification is the only pre-pickup notice.
- Run a Laravel scheduled command every minute to claim due reminders, dispatch them after commit, and mark success/failure idempotently.
- Use `withoutOverlapping()` and `onOneServer()` in multi-instance production; the existing scheduler service remains the single cron entry point.
- Rescheduling supersedes unsent reminders and creates a new unique reminder; cancellation suppresses pending reminders and notifies both actors.
- Notification failure never rolls back request or schedule state; retry with backoff and expose failed/reminder-lag counts to logs/monitoring.

### Acceptance criteria

- [x] Exact PSGC matches are recommended before proximity results, and displayed kilometres come only from a successful authoritative calculation.
- [x] Checkout selection is validated at pickup and retained; only that Logistics tenant receives and sees the request.
- [x] A schedule can combine solo or bulk handoffs from multiple Sellers, contains no more than 30 Orders and one Courier, visibly leaves excess Orders unscheduled, and prevents concurrent assignment of an Order.
- [x] The Logistics Pickups page is schedule-first, and schedule creation presents pending parcels ordered by Shop and request creation time before Courier/window confirmation.
- [x] The schedule list defaults to scheduled work and supports ascending or descending pickup-window sorting.
- [x] Schedule creation uses one combined Philippine pickup date/time control and no end date; Courier selection shows account status and unfinished pickup/linehaul reservations, including expired legacy windows.
- [x] Logistics pickup scheduling uses one Flatpickr combined date/time control, while schedule filters, account birthday fields, and registration birthday fields use date-only Flatpickr controls; the mobile fallback is disabled.
- [x] Scheduling leaves the Order at `ready_for_pickup` and does not claim custody or alter Inventory.
- [x] Pickup-time waybill creation persists the explicit tracking ID and Buyer postal-code/sort-plan routing hint without giving Seller authority over hub lanes.
- [x] Partial pickup preserves `scheduled` and the exact assigned/accepted remaining count; the last successful hub receipt completes the parent schedule exactly once under concurrent/retried receipt.
- [x] Completed and fully received schedules remain readable history, free the Courier, reject revision/cancellation, and leave no active pending/retried reminders.
- [x] Existing zero-remaining `scheduled` rows reconcile safely only after confirming all linked tasks were picked up and their parcels received at the hub; no Inventory, pickup, or final-mile effects are replayed.
- [ ] Seller and Courier receive one assignment notification and at most one due reminder per schedule revision.
- [x] Provider, API, scheduler, and notification failures have truthful fallbacks without cross-tenant or duplicate effects.

## HOW

### Data and services

- Add migrations; never edit `2026_09_06_000005_create_seller_order_rejections_and_pickup_requests.php`.
- Extend pickup requests with an immutable non-null Logistics link for new rows and replace date-only planning with separate schedule records.
- Add UUID `pickup_schedules`, `pickup_schedule_orders`, first-mile tasks, revision/history, and notification-reminder/outbox records.
- `RequestSellerPickup` evaluates the Buyer postal snapshot through the selected Logistics hub's active sort plan and passes the result into waybill creation; it never assigns the live Shipment lane. The hint is immutable and scan-time automatic sorting remains authoritative.
- Store every status/type as a string and cast it to a PHP enum; add unique active-Order scheduling and `(organization_id, status, starts_at)` indexes.
- Implement `EligibleLogisticsQuery`, `LogisticsDistanceService`, `CreatePickupRequest`, `CreatePickupSchedule`, and `DispatchPickupReminders` services.
- Implement `PickupScheduleLifecycleService` for transactional completion and the bounded, rerunnable `pickups:reconcile-schedules` command for existing-data reconciliation.
- Call Geoapify Route Matrix server-side with one Seller source and bounded hub targets; keep the secret out of browser bundles, enforce timeout/circuit breaker, cache by coordinate pairs, and meter credits.
- The Route Matrix free plan currently provides 3,000 credits/day; a 1×N matrix costs N baseline credits. Treat free capacity as a launch allowance, not an uptime guarantee.
- Persist the distance value, unit, calculation time, coordinate fingerprints, mode, and provider status used for the recommendation; expire cached ranks when either address pin changes.
- Do not send names, phone numbers, street lines, Order contents, or account IDs to the matrix API; only longitude/latitude pairs are needed.
- Follow the existing `docs/maps-location-api.md`; include Geoapify and OpenStreetMap attribution wherever distance is shown.
- Sources: [Geoapify Route Matrix](https://apidocs.geoapify.com/docs/route-matrix/), [pricing](https://www.geoapify.com/pricing/), and [terms/attribution](https://www.geoapify.com/terms-and-conditions/).

### Interfaces and UI

- Seller: `GET /api/v1/seller/logistics-options`, `POST /api/v1/seller/orders/pickup-requests`.
- Logistics: `GET /api/v1/logistics/pickups`, `GET /pickups/{pickup}`, `GET /pickup-couriers` (optionally with `starts_at` and `exclude_schedule_id` (legacy `ends_at` remains accepted) for server-calculated availability), `GET /pickup-schedules`, `POST /pickup-schedules`, and revision/cancel endpoints.
- Courier API: read assigned first-mile tasks and acknowledge/accept under the existing mobile-only boundary.
- Add Seller checkout-selected provider states and packing handoff; add a schedule-first Logistics `/pickups` screen plus pickup-request detail with `@aisley/ui`, responsive tables/cards, keyboard controls, and loading/empty/error/conflict states. Schedule creation supports a cross-Seller selection capped at 30 parcels and summarizes parcel/Shop counts before assignment.
- API resources expose server-calculated capabilities; frontends never infer assignability, availability, distance validity, or tenant ownership.
- Keep list selections across a recoverable refetch only while each Order remains eligible; announce selection counts and validation errors to assistive technology.
- Show all schedule timestamps with an explicit timezone and provide a confirmation summary before the Logistics mutation. Pickup scheduling uses a single combined Flatpickr date/time widget with the mobile fallback disabled; the Courier picker shows contact information, account status and outstanding work. `starts_at` alone triggers the authoritative availability check.

### Verification and rollout

- Reconcile existing data in place with the bounded, rerunnable `pickups:reconcile-schedules` command: identify zero-remaining `scheduled` candidates, lock/recheck the schedule and complete task membership, require every linked task to be `picked_up_from_seller` and every linked parcel to have hub receipt evidence, then complete and suppress pending reminders atomically. Report inconsistent/empty/cancelled-task candidates without marking them complete; preserve historical references, confirmations, and Inventory movements. Fresh migration or reseeding is not the solution.
- Verify all-picked versus partial/cancelled/missing-task cases, repeat backfill runs, last-receipt/reminder races, fully received completion exclusion and edit/cancel rejection on SQLite/PostgreSQL before production rollout. Focused SQLite lifecycle coverage is implemented; PostgreSQL remains a release gate.
- Test role/status/Shop/organization IDOR, eligibility tiers, Geoapify success/timeout/quota fallback, deterministic ranks, and absent coordinates.
- Test 30-Order bounds, idempotency, request/schedule races, Courier affiliation, overlap checks, UTC conversion, revisions, cancellation, and no Inventory effect.
- Test explicit acceptance gating, task-level rejection/re-offer, preserved offer history, stale display, and notification failure without Order or custody mutation.
- Test after-commit tenant notifications, reminder uniqueness, scheduler overlap, retries, lag monitoring, and safe payloads on SQLite and PostgreSQL.
- Test Seller and Logistics responsive/accessibility flows; Courier work remains API-only.
- Record request/schedule IDs, tenant IDs, Courier ID, revision, idempotency outcome, Geoapify credit estimate, and notification result; exclude full addresses and QR payloads.
- Alert on overdue unassigned requests, due-reminder lag, repeated provider failures, and schedules starting without an active assigned Courier.
- Roll out schema/backfill → option ranking → checkout-selection validation/waybill creation → Logistics Pickups → scheduling/tasks → explicit Courier acceptance → rejection/re-offer history → notifications/reminders; physical scan/custody remains a later shared transition rollout.

### Saved-quote partner restriction (2026-09-24)

- Snapshot-backed Orders must match the checkout-selected provider. CHECKOUT_LOGISTICS_MISMATCH rejects substitution; unavailable provider or frozen route holds pickup and preserves Customer COD.
- If no organization can honor the snapshot, fulfillment enters a financial hold for resolution. The Customer shipping fee and COD remain unchanged.
- The selected partner fulfills against the immutable quote; pickup selection does not recalculate Customer pricing.

## Failed pickups, retry deadline and rejection — 2026-11-09

- The scheduled pickup is due by the end of its start date in Asia/Manila (`pickup_due_at`). There is no selectable end date. A failed attempt is explicitly reported; the passage of midnight does not invent an attempt.
- `retry_deadline_at = starts_at + 72 hours` gives three full days from the scheduled start, independent of acceptance time and legacy ends. Failed reports never extend this deadline.
- `POST /api/v1/courier/first-mile-tasks/{task}/failed-pickup` requires an accepted, uncollected task, the scheduled start to have arrived, JSON `{ "reason": "..." }` (nonblank, at most 500 characters) and a UUID `Idempotency-Key`. Failure 1 or 2 retains `accepted` so the Courier can retry physical pickup with the existing confirmation endpoint. Failure 3 releases that parcel immediately. Counts belong to an assignment; a new schedule starts at zero.
- `POST /api/v1/courier/pickup-schedules/{schedule}/reject` uses the same reason/header contract and rejects the entire offer only before any parcel has been accepted or collected. All assigned parcels immediately become eligible for a new Logistics schedule.
- Both actions return HTTP 200 `{data:{schedule_id,task_id,action,failed_pickup_count,available_for_scheduling,retry_deadline_at}}`. Rejection returns null task/count. Matching retries return the original acknowledgment without repeating effects; refetch current tasks afterward. Changed key payload returns `409 IDEMPOTENCY_KEY_REUSED`; invalid input/header is `422`, foreign resources `404`, incompatible states `409`. Existing Courier bearer, RBAC, approval, affiliation and policy gates apply.
- `pickups:expire-schedules --limit=200` runs every minute, with overlapping/single-server guards, to release assigned/accepted parcels at or after 72 hours. The scheduled start is authoritative even when no failure was reported or the offer was never accepted. Pickup acceptance/confirmation and new failure/rejection actions reject expired work immediately, including before the next sweep.
- Release marks old first-mile tasks `cancelled` with typed `release_reason` and `released_at`, retaining memberships, waybills and append-only decisions/history. Orders remain `ready_for_pickup`, stock stays reserved, and Seller requests regain pending/partially-scheduled status. Re-offer is an explicit new Logistics schedule using the existing waybill; only one active assignment may exist.
- A schedule with no retained assignments becomes `cancelled` and frees the Courier. Mixed schedules keep collected parcels until hub receipt; expiry never releases physical custody. Released members are excluded from regenerated routes, and receipt targets the current collected assignment. Existing shared first-mile projections are cleared on release and bind to the performing replacement Courier on pickup.
- Apply `2026_11_09_000002_add_pickup_attempt_decisions.php` before deploying API/scheduler code. External Flutter adoption and deployed PostgreSQL/concurrent-worker acceptance remain separate gates.
