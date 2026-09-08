---
feature: seller-logistics-pickup-scheduling
title: Seller-to-Logistics Pickup Scheduling
system: AISLEY
type: Feature Specification
version: 1.0
status: Implementation-ready draft
roles: Seller, Logistics, Courier API
scope: Seller SPA, Logistics SPA, Courier API, Laravel API, scheduler
---

# Seller-to-Logistics Pickup Scheduling

## WHAT

- **Purpose:** Let a Seller hand prepared Orders to one selected Logistics organization, then let that organization assign an employed Courier and pickup schedule.
- **Actors:** Seller selects the provider and requests pickup; Logistics owns its Pickups dashboard and schedule; Courier receives the assigned first-mile task through the external mobile app.
- **Scope:** Seller SPA, Logistics SPA, Courier API, Laravel API, scheduler, database notifications, and Geoapify-backed distance ranking.
- **Current baseline:** Seller can group up to 50 processing Orders into a provider-less request; Logistics currently has only a dashboard scaffold.
- **Target flow:**
  ```text
  Seller packs Orders → chooses Logistics → requests pickup
  → Orders become ready_for_pickup and waybills are created
  → selected Logistics sees the request in Pickups
  → Logistics assigns one affiliated Courier and pickup window
  → Seller and Courier are notified
  → Courier accepts and later confirms physical pickup
  ```
- One request belongs to one Shop and one Logistics organization; the existing Seller request may contain up to 50 Orders, but one pickup schedule may contain at most 30 Orders for one Courier.
- Logistics must split a request over 30 Orders into multiple schedules; Orders, waybills, custody, status, and idempotency remain independent.
- **Non-goals:** parcel weight/dimension capacity, route optimization across stops, automatic Courier assignment, fixed Courier shifts, hub receipt/sorting, final-mile assignment, delivery completion, or Courier web UI.

## MUST

### Seller provider selection

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
- Seller must confirm the preselection and may choose another eligible option before submitting.
- If Geoapify, coordinates, or quota are unavailable, list all eligible providers without a distance and require explicit Seller selection; never fabricate `0 km` or block packing.
- If no provider is eligible, do not advance Orders or create waybills; show a retryable unavailable state.
- Provider selection becomes immutable when the pickup request commits; reassignment needs an explicit future exception workflow.

### Request, queue, and tenant isolation

- Preserve the current maximum of 50 distinct Orders per Seller request; expose unscheduled counts clearly and never assign more than 30 of them to one schedule.
- In one locked transaction, revalidate Shop ownership, all Orders, chosen Logistics eligibility, reservation state, and a Seller-scoped idempotency key.
- Commit one request, its Order links, each `seller_processing → ready_for_pickup` event, and one waybill per Order atomically.
- Notify only the selected Logistics organization after commit; never broadcast a request to every Logistics account.
- Logistics Pickups lists only requests whose immutable `logistics_organization_id` matches the authenticated account's server-derived organization and sole hub.
- Support bounded pagination and allow-listed status/date/search filters with deterministic `created_at` and UUID ordering.
- Each row shows safe request, Shop/pickup area, Order count, readiness time, schedule state, and Courier assignment; detail exposes only operationally necessary snapshots.
- Keep `orders.status = ready_for_pickup` when scheduled; scheduling is not physical custody and does not consume Inventory.

### Courier assignment and schedule

- Logistics may select 1–30 unscheduled Orders from its own pending requests and create one first-mile pickup schedule.
- All selected Orders must belong to the authenticated Logistics organization; a schedule may span requests only when its single pickup window is operationally valid.
- Courier must have an active account and current approved affiliation to that same organization/hub; never trust a submitted foreign Courier ID.
- Store `starts_at` and `ends_at` in UTC, require `starts_at < ends_at`, reject past windows, and display in Asia/Manila unless the account later gains a timezone setting.
- Lock selected Orders/request links and recheck schedule capacity and Courier conflicts before commit; return `409` for stale or competing assignment.
- Create a first-mile task per Order under one schedule; assignment does not imply `seller_pickup_accepted` or `picked_up_from_seller`.
- Retrying the same Logistics idempotency key returns the committed schedule; it must not duplicate tasks or notifications.
- Editing or cancelling a future schedule requires an expected revision, reason, append-only history, and fresh notifications; it cannot silently overwrite custody history.
- Open question: whether Courier acceptance is mandatory or only an acknowledgement before the pickup window; retain the existing accepted state until that mobile policy is approved.

### Notifications and cron

- After schedule commit, queue database notifications to the Seller and assigned Courier with schedule reference, pickup date/window, safe location summary, Order count, and deep-link/API reference.
- Create durable reminder rows for one hour before `starts_at`; if scheduled inside one hour, the assignment notification is the only pre-pickup notice.
- Run a Laravel scheduled command every minute to claim due reminders, dispatch them after commit, and mark success/failure idempotently.
- Use `withoutOverlapping()` and `onOneServer()` in multi-instance production; the existing scheduler service remains the single cron entry point.
- Rescheduling supersedes unsent reminders and creates a new unique reminder; cancellation suppresses pending reminders and notifies both actors.
- Notification failure never rolls back request or schedule state; retry with backoff and expose failed/reminder-lag counts to logs/monitoring.

### Acceptance criteria

- [ ] Exact PSGC matches are recommended before proximity results, and displayed kilometres come only from a successful authoritative calculation.
- [ ] Seller selection is validated and frozen; only that Logistics tenant receives and sees the request.
- [ ] A schedule contains no more than 30 Orders and one Courier; a larger request is visibly split and concurrent assignments cannot overlap an Order.
- [ ] Scheduling leaves the Order at `ready_for_pickup` and does not claim custody or alter Inventory.
- [ ] Seller and Courier receive one assignment notification and at most one due reminder per schedule revision.
- [ ] Provider, API, scheduler, and notification failures have truthful fallbacks without cross-tenant or duplicate effects.

## HOW

### Data and services

- Add migrations; never edit `2026_09_06_000005_create_seller_order_rejections_and_pickup_requests.php`.
- Extend pickup requests with an immutable non-null Logistics link for new rows and replace date-only planning with separate schedule records.
- Add UUID `pickup_schedules`, `pickup_schedule_orders`, first-mile tasks, revision/history, and notification-reminder/outbox records.
- Store every status/type as a string and cast it to a PHP enum; add unique active-Order scheduling and `(organization_id, status, starts_at)` indexes.
- Implement `EligibleLogisticsQuery`, `LogisticsDistanceService`, `CreatePickupRequest`, `CreatePickupSchedule`, and `DispatchPickupReminders` services.
- Call Geoapify Route Matrix server-side with one Seller source and bounded hub targets; keep the secret out of browser bundles, enforce timeout/circuit breaker, cache by coordinate pairs, and meter credits.
- The Route Matrix free plan currently provides 3,000 credits/day; a 1×N matrix costs N baseline credits. Treat free capacity as a launch allowance, not an uptime guarantee.
- Persist the distance value, unit, calculation time, coordinate fingerprints, mode, and provider status used for the recommendation; expire cached ranks when either address pin changes.
- Do not send names, phone numbers, street lines, Order contents, or account IDs to the matrix API; only longitude/latitude pairs are needed.
- Restore and approve the missing `docs/maps-location-api.md` before implementation; include Geoapify and OpenStreetMap attribution wherever distance is shown.
- Sources: [Geoapify Route Matrix](https://apidocs.geoapify.com/docs/route-matrix/), [pricing](https://www.geoapify.com/pricing/), and [terms/attribution](https://www.geoapify.com/terms-and-conditions/).

### Interfaces and UI

- Seller: `GET /api/v1/seller/logistics-options`, `POST /api/v1/seller/orders/pickup-requests`.
- Logistics: `GET /api/v1/logistics/pickups`, `GET /pickups/{pickup}`, `POST /pickup-schedules`, and revision/cancel endpoints.
- Courier API: read assigned first-mile tasks and acknowledge/accept under the existing mobile-only boundary.
- Add Seller provider-selection states and packing handoff; add Logistics `/pickups` queue/detail/scheduling screens with `@aisley/ui`, responsive tables/cards, keyboard controls, and loading/empty/error/conflict states.
- API resources expose server-calculated capabilities; frontends never infer assignability, availability, distance validity, or tenant ownership.
- Keep list selections across a recoverable refetch only while each Order remains eligible; announce selection counts and validation errors to assistive technology.
- Show all schedule timestamps with an explicit timezone and provide a confirmation summary before the Logistics mutation.

### Verification and rollout

- Test role/status/Shop/organization IDOR, eligibility tiers, Geoapify success/timeout/quota fallback, deterministic ranks, and absent coordinates.
- Test 30-Order bounds, idempotency, request/schedule races, Courier affiliation, overlap checks, UTC conversion, revisions, cancellation, and no Inventory effect.
- Test after-commit tenant notifications, reminder uniqueness, scheduler overlap, retries, lag monitoring, and safe payloads on SQLite and PostgreSQL.
- Test Seller and Logistics responsive/accessibility flows; Courier work remains API-only.
- Record request/schedule IDs, tenant IDs, Courier ID, revision, idempotency outcome, Geoapify credit estimate, and notification result; exclude full addresses and QR payloads.
- Alert on overdue unassigned requests, due-reminder lag, repeated provider failures, and schedules starting without an active assigned Courier.
- Roll out schema/backfill → option ranking → Seller selection/waybill creation → Logistics Pickups → scheduling/tasks → notifications/reminders.
