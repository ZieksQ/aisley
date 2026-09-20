---
role: Courier / Rider
feature: courier-notification
title: Courier Notifications
system: AISLEY
type: Feature Specification
version: 1.1
status: Laravel Courier inbox API implemented; external Flutter inbox remains pending
implementation_status: Scoped list, detail, unread-count, and mark-read routes plus pickup/final-mile producers implemented; Flutter client not implemented in this repository
canonical: true
scope: Laravel Courier API and external Flutter mobile application
backend_contract_commit: feature/courier-notifications
backend_contract_version: courier-notifications-v1
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Courier.md, docs/features/courier/dashboard/specs.md
---

# Courier Notifications

## WHAT

- Give an approved Courier a private, persistent in-app inbox for work alerts and a readable unread count in the external Flutter app.
- The inbox reports committed events; it does not offer, accept, reject, pick up, validate, or deliver a task itself.
- Laravel writes database notifications to the scheduled Courier for pickup-schedule assignment, revision, cancellation, and due reminder, and now delivers committed final-mile-offer alerts.
- The protected `/api/v1/courier/notifications` list, count, detail, and mark-read routes are implemented in Laravel. The Flutter notification screen is external to this repository; the Courier dashboard notification section remains an unavailable aggregate scaffold.
- The inbox exposes existing pickup-schedule alerts and committed final-mile-offer alerts with deterministic recipient/type/source identity.
- Final-mile offers remain visible through the owning task API even when an alert is delayed or unavailable.
- Non-goals: SMTP, background push, SMS, chat, campaigns, generic Courier login alerts, notification-driven task mutations, or a Courier web UI.

```text
Logistics action commits → durable recipient alert → Courier inbox/count
→ explicit read action → authorized task/schedule fetch → owning action
```

## MUST

### Access and ownership

- All endpoints require `auth:sanctum`, `courier.active`, and `policy.consent`; Flutter sends its existing bearer token.
- Resolve recipient from the authenticated User, not a query/body `courier_id`, `user_id`, organization, hub, or email.
- The current Courier account, approved affiliation, active Logistics organization, and valid sole hub are required on every read and read-state write.
- A foreign notification UUID, same-email record of another role, or another organization's task returns a scoped `404` or access denial without existence disclosure.
- Query only an allow-list of Courier notification types; Seller, Customer, Admin, and Logistics notifications remain invisible even if stored against the same User.
- Revalidate every task/schedule destination against the Courier and current organization/hub before returning a navigable link.
- Historical alerts with a removed or no-longer-authorized source remain readable only as redacted generic history with `destination: null`; never leak old task details.
- A notification is not proof that a task is still offered, that evidence passed review, or that custody changed.

### Initial sources and lifecycle

| Type | Source event and availability | Destination rule |
| --- | --- | --- |
| `pickup-schedule.assigned` | Existing schedule assignment producer | Current first-mile schedule/task list only if authorized |
| `pickup-schedule.revised` | Existing committed schedule revision producer | Current schedule/task list only if authorized |
| `pickup-schedule.cancelled` | Existing committed cancellation producer | Historical summary; current task state must be refetched |
| `pickup-schedule.reminder` | Existing due-reminder command and producer | Current schedule/task list only if still authorized |
| `courier-task.final-mile-offered` | Committed new or re-offered task offer to this Courier | Final-mile task detail only while currently accessible |

- Existing schedule rows are projected safely by the Courier inbox service; legacy payloads are not trusted as public DTOs.
- The final-mile producer runs only for a committed offer/re-offer to the recipient and keys uniqueness to that offer, recipient, and type.
- A rejection or re-offer to a different Courier must not keep an old offer actionable; the historical alert can remain with a null or unavailable destination.
- Do not generate another first-mile assignment alert beside `pickup-schedule.assigned` for the same schedule revision.
- A revised schedule may create one new alert for the new revision; reminder work is at most once for that revision and is suppressed after completion/cancellation.
- Source rollback creates no alert. Duplicate command runs, queue retries, or API retries cannot create duplicate new-format alerts.
- New Courier evidence-review, completion, incident, and approval alerts require their owning source-event contracts before being added to this allow-list.
- Pending/rejected applicants cannot access this inbox; approval/rejection communication remains owned by Courier Auth and Logistics approval.

### Persistence and read state

- Reuse Laravel's existing UUID `notifications` table and the authenticated User's notification relationship; do not create a second inbox table.
- Preserve existing schedule rows and `read_at`; do not rewrite historical payloads during rollout.
- New producers record a durable source-event/recipient/type intent or deterministic UUID in the source transaction, then deliver after commit.
- Queue uniqueness alone is insufficient: database-level identity or an equivalent locked insert must prevent duplicate rows under concurrent workers.
- Delivery failure is tracked and retried separately; it cannot roll back an offer, schedule edit, task state, or Inventory effect.
- Mark-read is explicit, idempotent, and keeps the first successful server `read_at` under concurrent requests.
- Listing, detail, count, and marking read never change an Order, Shipment, Delivery Task, assignment, proof, schedule, or custody event.
- Inbox deletion, mark-unread, bulk-read, retention cleanup, and cross-device push synchronization are deferred.

### Safe DTO and navigation

- Return opaque UUID `id`, stable `type`, bounded plain-text `title` and `summary`, nullable `read_at`, UTC `created_at`, `resource_type`, nullable `resource_id`, and nullable internal `destination`.
- Do not return raw notification JSON, raw storage paths, QR/tracking payloads, private evidence, exact Buyer address/contact, payment data, reviewer notes, or unrestricted location history.
- Build destinations from an allow-listed Flutter route key or approved app path and authorized resource ID; never trust stored external URLs.
- Return `destination: null` if the linked task/schedule is missing, no longer offered to this Courier, or belongs to another organization/hub.
- Opening a notification does not mark it read automatically and never performs a task action; the destination fetches current data from its owning API.
- Unknown types are excluded. An allow-listed legacy row with malformed data becomes a safe generic alert with no destination; list and count use the same allow-list.
- A successful empty list and zero count must be distinguished from unavailable, timeout, authorization, and partial-delivery states.

### Acceptance criteria

- [x] The shared database-notification table and Courier inbox endpoints are implemented; the focused Courier notification suite covers authentication, affiliation, scope, projection, cursor, and read-state behavior.
- [x] Guest, wrong-role, pending, and revoked-affiliation access fails closed; organization/hub scope is revalidated for every inbox route.
- [x] Existing schedule assignment/revision/cancellation/reminder rows project through an allow-list without leaking Seller or Buyer details; malformed/legacy rows are redacted.
- [x] A committed final-mile offer creates one recipient alert after commit; source rollback cannot create an alert, and deterministic identity prevents duplicate delivery on retries.
- [x] List, detail, unread count, and mark-read agree on recipient/type scope and bounded ordering; a foreign UUID returns a scoped `404`.
- [x] Mark-read is locked and idempotent, preserving the first `read_at`; delivery is decoupled from the committed source transaction.
- [ ] Full re-offer/rejection history and worker-concurrency coverage require the remaining integration cases before this backend contract is considered complete.
- [ ] Flutter shows honest loading, empty, read/unread, stale, forbidden, offline, retry, and unavailable-destination states.
- [ ] SQLite/PostgreSQL, API privacy/IDOR/concurrency, and Flutter contract/widget tests pass before the feature is marked implemented.

## HOW

### Implemented backend API contract — Flutter adoption pending

| Method and path | Request | Success |
| --- | --- | --- |
| `GET /api/v1/courier/notifications` | `status=all|unread|read`, `limit=1..20`, optional opaque `cursor` | `200` list `data` plus `meta.next_cursor` and `generated_at` |
| `GET /api/v1/courier/notifications/unread-count` | No query/body | `200 {data:{unread_count:int}}` |
| `GET /api/v1/courier/notifications/{notification}` | UUID path; no query/body | `200 {data:<notification>}`; read state unchanged |
| `POST /api/v1/courier/notifications/{notification}/read` | Empty JSON body; no Idempotency-Key required | `200 {data:<notification>}` with persisted `read_at` |

- These four routes are implemented under the protected Courier API. Flutter may adopt them only after copying this versioned contract and adding its own client/widget coverage; no Flutter screen is included here.
- Register `unread-count` before the UUID detail route. Reject unsupported query/body fields and malformed cursors with `422`.
- Default list: `status=all`, `limit=20`, ordered by `created_at DESC, id DESC`; the opaque cursor preserves that stable pair and current recipient/type scope.
- `meta.next_cursor` is null at the end. A cursor from another account, filter, or altered scope is invalid rather than a path to foreign rows.
- Count uses the same recipient/type/authorization predicates as list; independent requests may see different committed snapshots, so Flutter refetches after mark-read.
- List/detail/count responses use `Cache-Control: private, no-store`; safe GET retries are allowed. Mark-read retries return the same record and first read time.
- Apply bounded request throttling; honor server `Retry-After` when present. No notification read requires a client mutation idempotency key.

```json
{
  "data": [{
    "id": "00000000-0000-4000-8000-000000000001",
    "type": "pickup-schedule.assigned",
    "title": "Pickup scheduled",
    "summary": "A pickup window was assigned.",
    "read_at": null,
    "created_at": "2026-09-20T02:00:00Z",
    "resource_type": "pickup_schedule",
    "resource_id": "00000000-0000-4000-8000-000000000002",
    "destination": "/pickup-schedules/00000000-0000-4000-8000-000000000002"
  }],
  "meta": {"next_cursor": null, "generated_at": "2026-09-20T02:00:01Z"}
}
```

- Example values describe the implemented Courier DTO; they are not a fixture.
- Stable errors: `401` unauthenticated; `403` inactive/invalid affiliation or `POLICY_CONSENT_REQUIRED`; scoped `404 NOTIFICATION_NOT_FOUND`; `422 INVALID_NOTIFICATION_QUERY`; `429` throttled; `5xx` retryable.
- For `401`, clear the secure session according to Auth; for consent-required `403`, retain the session and open the existing consent flow.
- Do not convert `403`, `404`, timeout, offline, or failed count reads into a valid empty list or zero badge.
- The response envelope follows existing Courier JSON Resource conventions. Cursor encoding is signed and bound to the authenticated Courier and filter scope; exact error responses are covered by the Laravel tests.

### Per-endpoint request and response rules

- **List:** GET with no JSON body; `status` defaults to `all`, `limit` defaults to 20, and `cursor` is only accepted with its original filter and Courier scope.
- **List:** each item uses the exact DTO keys shown above; `meta.generated_at` is a server UTC timestamp, not a claim that the task projection is current.
- **Count:** GET with no query/body; returns a non-negative integer for the same allowed types, regardless of the current list page or status filter.
- **Detail:** GET by UUID; returns the same safe projection as list even when its destination is no longer available; it never changes `read_at`.
- **Read:** POST with `Content-Type: application/json` and `{}`; unknown fields such as `read_at`, `status`, or `courier_id` fail validation.
- **Read:** the response is the refreshed detail DTO; repeated identical calls return the same first `read_at` and do not create another notification.
- All endpoints reject cross-account IDs before projection. A UUID belonging to another role or recipient must not produce a different public error from an unknown UUID.
- The API does not expose a raw `data` payload parameter, notification creation route, or mark-all route to Flutter.

| Condition | Planned API result | Flutter response |
| --- | --- | --- |
| Signed out or revoked token | `401` | Clear secure session and return to sign-in |
| Pending/inactive Courier or invalid affiliation | `403` | Block inbox and show account/affiliation state |
| Required policy acceptance | `403 POLICY_CONSENT_REQUIRED` | Keep session; open policy consent |
| Foreign or unknown notification UUID | Scoped `404` | Safe unavailable detail, no existence hint |
| Invalid filter, cursor, UUID, or body field | `422` or route-safe `404` | Show validation/retry guidance; do not mutate local read state |
| Throttle, timeout, offline, or server failure | `429`/network/`5xx` | Keep last in-memory view labeled stale; retry safely |

### Destination and event boundaries

- The API returns an internal destination only after an owning-task/schedule authorization check at read time; Flutter treats it as a navigation hint, never as task authority.
- The proposed `/pickup-schedules/{id}` Flutter destination is a new client route to implement, not an existing Laravel API endpoint; it must resolve through the current Courier task/schedule APIs.
- A final-mile alert may point to a proposed Flutter task-detail route only while the current task API still offers that task to this Courier.
- If task acceptance, rejection, reassignment, or delivery occurs between inbox read and navigation, show the owning API's newer state rather than the old alert copy.
- Schedule cancellation keeps the alert in history but must not leave an active pickup button or a pending reminder.
- Do not use Order `assigned` or generic `picked_up` labels to infer a notification producer; source events are task/schedule records with explicit legs.

### Backend implementation

- Courier-owned list request validation, controller, safe resource/projector, and notification service are implemented under the existing Courier namespace.
- The current `notifications` table and `User::notifications()` are reused; types are allow-listed and mark-read is locked inside a transaction.
- `PickupScheduleNotification`-compatible rows are adapted into bounded safe summaries, checking current schedule ownership/affiliation before building a destination.
- Final-mile offer production is dispatched after the owning fulfillment/dispatch transaction and uses deterministic identity once per offer/recipient/type.
- Keep first-mile schedule assignment/reminder ownership in Pickup Schedule Service and its due-reminder command; do not create a second scheduler.
- If existing schedule rows cannot be uniquely deduplicated, preserve them without claiming historical exactly-once delivery; enforce uniqueness for newly emitted alerts.
- Add recipient/type/read/time indexes only if existing indexes do not support the scoped query; use a new migration, never edit the executed notifications migration.
- Emit metrics/logs for delivery retries, skipped invalid recipients, projection failures, and cursor validation without logging payloads or personal data.

### Flutter implementation

- Add an Inbox entry and unread badge without replacing the current task screens or treating dashboard scaffold sections as live notifications.
- Foreground refresh may poll every 30 seconds while authenticated and visible; stop on background, logout, invalid affiliation, or consent gate.
- Manual refresh and app resume fetch authoritative count/list; ignore older responses after a newer refresh or account change.
- Keep only bounded in-memory items. The dashboard's possible 15-minute encrypted snapshot does not authorize persistent notification or task caches here.
- Show unread/read labels with text and semantics, not color alone; support large text, 44-pixel touch targets, screen-reader order, light/dark themes, and safe notification previews.
- A tap opens detail/current target when available; use a visible explicit mark-read action. A stale or removed target leaves the historical alert readable.
- Offline mode may show an explicitly stale in-memory list but cannot mark read or change tasks; reconcile on reconnect.
- Background push, OS notification permission, device-token registration, WebSockets, and deep links from external push remain out of scope.

### Verification and handoff

- Test Courier/role/status/affiliation/sole-hub scope, same-email separation, foreign UUID IDOR, malformed legacy payloads, and redacted destinations.
- Test schedule assigned/revised/cancelled/reminder visibility and suppression after completion; do not duplicate the existing source workflow.
- Test final-mile offer rollback, re-offer, retry, worker concurrency, event/recipient/type uniqueness, and notification-delivery failure after business commit; the current focused run covers the committed offer path and deterministic delivery, while the remaining re-offer/concurrency cases are release gates.
- Test ordering/cursor stability, filtered count, first-read timestamp, concurrent read requests, `401/403/404/422/429`, timeout, and private cache headers.
- Test Flutter JSON parsing, consent/session recovery, polling lifecycle, response races, stale target, read retry, accessibility, and logout cleanup.
- Run focused Laravel SQLite and PostgreSQL suites plus Flutter analyzer/tests; record actual results instead of checking criteria from design alone.
- Keep the Courier Dashboard aggregate's legacy `OPERATIONAL_SCHEMA_DEFERRED` literal; its notification subsection remains scaffold-only even though the separate inbox API is live.
- Copy this spec to the Flutter project only with the implemented API commit/version and update both progress logs when client adoption occurs.

**References:** `docs/features/courier/rules.md`, `docs/features/courier/dashboard/specs.md`, `docs/features/logistics/notification/spec.md`, `docs/features/orders/logistics-pickups/spec.md`, `docs/schema.md`, and [Laravel database notifications and after-commit delivery](https://laravel.com/docs/12.x/notifications).
