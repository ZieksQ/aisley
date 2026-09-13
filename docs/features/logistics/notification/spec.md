---
feature: logistics-notification
title: Logistics Notifications
system: AISLEY
type: Feature Specification
version: 1.0
status: Implemented (focused verification complete; release gates pending)
implementation_status: Logistics inbox API, bell/inbox UI, after-commit delivery, deterministic deduplication, and all MVP producer hooks are implemented
role: Logistics
scope: Laravel API and Logistics React dashboard
---

# Logistics Notifications

## WHAT

- Provide a persistent in-app inbox, header bell, recent preview, and unread badge for the Logistics operator.
- Reuse the Seller/Customer list, detail, and mark-read pattern and Admin notification persistence principles.
- This is an in-app notification feature, not SMTP email, marketing campaigns, chat, or an operational audit ledger.
- Current `SellerPickupRequestedNotification` already stores `logistics-pickup.requested` in Laravel's database channel.
- Its legacy payload contains `pickup_request_id`, `shop_id`, `order_count`, and `status`; it has no presentation title or destination.
- Current Logistics routes have no notification list/detail/read API. The UI and endpoints below are planned, not callable yet.
- One Logistics account operates one organization and its sole hub; do not introduce staff accounts or sub-hub inboxes.
- Source features own business actions; notification screens only read alerts and update their read state.
- Exclude email/SMS/mobile push, WebSockets, arbitrary notification creation, bulk campaigns, delete/archive, and mark-unread in MVP.

```text
source action commits → durable notification work → recipient inbox
→ bell/list/detail → explicit mark-read → authorized owning feature
```

## MUST

### Authorization and scope

- Require `auth:sanctum`, `logistics.active`, and `policy.consent` on all proposed routes.
- Resolve the account, organization, and sole hub from authenticated server relationships.
- Query the current User's notifications with an allow-listed Logistics type; never accept recipient or tenant IDs as authority.
- Validate source organization/hub ownership before returning identifiers or destinations, including legacy pickup payloads.
- Deny other roles, inactive accounts, invalid organizations, foreign notification UUIDs, and cross-hub resource references.
- Return scoped `404` for inaccessible notification IDs without revealing their existence.
- Subscription billing/enforcement remains deferred; this feature must not introduce a subscription gate.

### MVP producers and dependencies

| Type                                    | Committed trigger and recipient                                     | Boundary                                                                 |
| --------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `logistics-pickup.requested`            | Seller pickup request; selected Logistics account                   | Existing producer; add safe projection and retry/deduplication hardening |
| `logistics-courier.application-pending` | New pending Courier affiliation; associated Logistics account       | Planned integration with Courier Auth and Logistics approval             |
| `logistics-task.offer-rejected`         | Final-mile offer rejected; task's owning Logistics account          | Planned integration; key by rejected offer, not Order                    |
| `logistics-evidence.submitted`          | New hub-pickup or delivery-proof evidence; owning Logistics account | Planned integration; key by evidence ID and purpose                      |
| `logistics-completion.requested`        | New Courier completion intent; owning Logistics account             | Planned integration; key by intent ID                                    |

- Do not emit an alert on list reads, QR resolution alone, duplicate retries, or uncommitted source actions.
- First-mile direct pickup remains its current contract; do not require Logistics review merely to create notifications.
- Stale-task timers, first-mile rejection, generic login/security alerts, and other producer types remain separate extensions.
- Re-offering the same task may later produce another rejection alert only for a new committed offer.
- Evidence and completion alerts may both exist: they represent distinct review steps, not duplicate events.
- Existing pickup, approval, and operations queues remain usable if notification delivery fails.

### Persistence, delivery, and history

- Reuse Laravel `notifications` and `User::notifications()`; do not create a second inbox table by default.
- Preserve existing rows and `read_at`; support legacy pickup payloads through a safe Resource adapter.
- Persist a durable source-event/recipient/type intent or equivalent recoverable event reference with the business transaction.
- Deliver notification work after commit; retry a failed delivery without rerunning pickup, approval, evidence, or fulfillment actions.
- Use database-enforced deduplication or a deterministic notification UUID for `(source event, recipient, type)`.
- Queue uniqueness alone is insufficient; concurrent workers must not create duplicate inbox entries.
- A rolled-back source transaction must not produce an inbox entry. External delivery failure cannot reverse a committed decision.
- Preserve event time separately from delivery attempts; reading never changes source history, custody, stock, assignment, or approval.
- Read-one is idempotent and preserves the first successful `read_at` under concurrent requests.
- Retain inbox history in MVP; deletion, retention cleanup, and archive policies are deferred.

### Safe presentation

- Return UUID `id`, stable `type`, plain-text `title`/`summary`, nullable `read_at`, UTC `created_at`, resource reference, and nullable internal `destination`.
- Use bounded summaries; omit addresses, phone numbers, QR tokens, evidence bytes, raw storage paths, reviewer notes, and payment/auth secrets.
- Construct destinations from known Logistics routes and validated resource IDs, never arbitrary payload URLs.
- Opening an alert does not approve an application, accept work, validate evidence, or change parcel status.
- Fetch authoritative details from the owning feature before any operational action; old alerts are not current-state authority.
- If a target is removed or no longer available, preserve the safe historical alert and show an unavailable destination.
- Unknown/unapproved types are excluded; malformed legacy payloads must not break the entire inbox or leak raw JSON.

## HOW

### API contract — implemented

| Method/path                                                | Request         | Success                                               |
| ---------------------------------------------------------- | --------------- | ----------------------------------------------------- | ---------------------------------- | ----------------------------------------------- |
| `GET /api/v1/logistics/notifications`                      | `status=all     | unread                                                | read`, `page>=1`, `per_page=1..50` | `200`, paginated `data`, Laravel `links`/`meta` |
| `GET /api/v1/logistics/notifications/unread-count`         | No body         | `200 {data: {unread_count: 3}}`                       |
| `GET /api/v1/logistics/notifications/{notification}`       | UUID, no body   | `200 {data: <notification>}`; no read mutation        |
| `POST /api/v1/logistics/notifications/{notification}/read` | Empty JSON body | `200 {data: <notification>}` with committed `read_at` |

- Register `unread-count` before the UUID route. Reject unsupported query/body fields with `422`.
- Default list is `status=all`, page 1, 20 rows, ordered by `created_at DESC, id DESC` like Seller/Customer.
- Unread count uses the identical recipient/type/tenant predicates, independent of current list filters or page size.
- Polling may observe newer counts than an earlier page; refetch after read success rather than assuming independent requests share a snapshot.
- Apply `Cache-Control: private, no-store` to all responses. Reads are safely retryable; read-one requires no client idempotency key.
- Handle `401`, role/account `403`, `403 POLICY_CONSENT_REQUIRED`, scoped `404`, validation `422`, throttling `429`, and retryable server/network failures.
- Use existing auth/error envelopes and `Retry-After` when supplied; never render failures as a successful empty list or zero badge.

```json
{
  "data": {
    "id": "notification-uuid",
    "type": "logistics-pickup.requested",
    "title": "New pickup request",
    "summary": "A Seller requested pickup for 2 Orders.",
    "read_at": null,
    "created_at": "2026-09-13T02:00:00Z",
    "resource_type": "pickup_request",
    "resource_id": "pickup-uuid",
    "destination": null
  }
}
```

### Logistics UI

- Add `/notifications` and notification detail navigation to the existing Logistics router and header layout.
- Bell preview requests five recent rows and unread count; the full page uses the same API with read/unread filters.
- Show loading, empty, filtered-empty, loaded, unavailable-target, permission, consent, timeout, offline, and retry states.
- Mark read only through an explicit action or after successful detail rendering; loading the bell/list never marks read.
- Disable duplicate read taps, reconcile server results, and retain unread state when a request fails.
- Refresh on opening/focus and every 30 seconds while visible and authenticated; stop polling on hidden tabs, logout, and authorization loss.
- Clear private cached state on account switch/logout. No persistent offline inbox or background mutation queue.
- Read `docs/design.md` before implementation; reuse compatible shared UI primitives, accessible buttons, focus behavior, text status, and restrained live announcements.

### Implementation and verification

- Add Logistics-specific Controller, ListNotificationsRequest, and Resource; reuse patterns without exposing Seller/Customer/Admin routes or payload types.
- Inspect current delivery infrastructure before adding durable intent storage; any required fields/indexes/tables use new additive migrations only.
- Add producer integration tests against pickup requests, Courier affiliation, final-mile offer rejection, evidence, and completion intent owners.
- Keep release-level checks open until the recorded verification gates are complete; this feature adds no email behavior or second inbox table.
- [x] Guest, wrong-role, inactive, cross-account, cross-organization, and forged-resource access fails closed.
- [x] Existing pickup notifications render safely and preserve read history; every planned producer reaches only its owning Logistics account.
- [x] List/count/detail share scope, stable ordering, bounded pagination, and private cache rules.
- [x] Concurrent-safe mark-read and deterministic delivery paths preserve first read time and one notification per event/recipient/type; focused API coverage exercises idempotent reads and delivery deduplication.
- [x] Rollback-safe after-commit delivery and queue retries cannot duplicate or undo operational decisions; PostgreSQL/concurrency verification remains a release gate.
- [x] Bell/list/detail implement loading, failures, consent recovery, stale links, explicit read state, polling visibility, and logout cleanup; browser automation remains a release gate.
- [ ] SQLite/PostgreSQL migration/API tests and Logistics type-check/build/UI tests pass with recorded results.

### References

- Shared authority: `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Logistics.md`.
- Existing feature references: `docs/features/admin/notification/spec.md`, `docs/features/seller/order-notification/spec.md`; use current code over their older speculative routes/status wording.
- Working patterns: `src/api/app/Http/Controllers/Seller/NotificationController.php`, `src/api/app/Http/Controllers/Customer/NotificationController.php`, `src/api/app/Http/Resources/Seller/SellerNotificationResource.php`.
- Producer owners: Logistics Courier Approval, Deploy Rider, Update Status, and `docs/features/orders/logistics-pickups/spec.md`; reuse their events, never duplicate their workflows.
- [Laravel after-commit queue behavior](https://laravel.com/docs/12.x/queues#jobs-and-database-transactions) supports deferred dispatch; durable application deduplication remains required.
