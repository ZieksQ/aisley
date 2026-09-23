---
feature: logistics-notification
title: Logistics Notifications
system: AISLEY
type: Feature Specification
version: 1.4
status: Inbox, vehicle-update producer, and vehicle destination UI implemented
implementation_status: Notification list/detail/read/count API, bell/inbox UI, vehicle-update delivery, backend destination projection, and read-only vehicle detail React route implemented
role: Logistics
scope: Laravel API and Logistics React dashboard
---

# Logistics Notifications

## Linehaul receiving discrepancy producer — 2026-09-23

`logistics-linehaul.receiving-discrepancies` is emitted after unloading closes with a documented missing, damaged, or unexpected parcel record. The sending hub's Logistics account receives the trip ID and safe summary, deduplicated by trip/closure. Cargo returns notify the return sender, not automatically the truck owner. The destination is `/linehaul-dispatch` only while the recipient owns the trip's sending hub. Receipt retries and late shortage resolution do not repeat the closure notification. Receiver decisions and text reasons remain in scoped receiving records and action history; there is no Courier approval or claims/refunds workflow.

## Linehaul return producer — 2026-09-23

`logistics-linehaul.return-scheduled` is emitted after the receiving Logistics organization commits a visiting truck's return. The owner receives only the trip reference and safe summary; the projected destination is `/dispatch` only while the trip belongs to that owner's organization/home hub. Delivery is after commit and deduplicated by trip revision. See `docs/features/logistics/company-truck-linehaul-dispatch/spec.md`.

## WHAT

- Provide a persistent in-app inbox, header bell, recent preview, and unread badge for the Logistics operator.
- Reuse the Seller/Customer list, detail, and mark-read pattern and Admin notification persistence principles.
- This is an in-app notification feature, not SMTP email, marketing campaigns, chat, or an operational audit ledger.
- Existing Logistics inbox APIs and UI project legacy pickup notifications into safe title, summary, and destination fields.
- Courier vehicle edits create `logistics-courier.vehicle-updated` notifications. The backend projects an authorized `/couriers/{courierId}/vehicle` destination, and the Logistics React app opens its protected, read-only current vehicle page.
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
| `logistics-pickup.requested`            | Seller pickup request; selected Logistics account                   | Implemented; safe projection and deduplication |
| `logistics-courier.application-pending` | New pending Courier affiliation; associated Logistics account       | Implemented |
| `logistics-task.offer-rejected`         | Final-mile offer rejected; task's owning Logistics account          | Implemented; deduplicate by offer |
| `logistics-evidence.submitted`          | New hub-pickup or delivery-proof evidence; owning Logistics account | Implemented; deduplicate by evidence/purpose |
| `logistics-completion.requested`        | New Courier completion intent; owning Logistics account             | Implemented; deduplicate by intent |
| `logistics-courier.vehicle-updated`      | Committed vehicle field or independent OR/CR replacement; associated Logistics account | Implemented; deduplicate by vehicle revision/recipient; informational, no approval action |
| `logistics-linehaul.return-scheduled`     | Visiting truck return committed by the receiving Logistics organization; owning Logistics account | Implemented; deduplicate by trip revision; no acceptance action |

- Do not emit an alert on list reads, QR resolution alone, duplicate retries, or uncommitted source actions.
- First-mile direct pickup remains its current contract; do not require Logistics review merely to create notifications.
- Stale-task timers, first-mile rejection, generic login/security alerts, and other producer types remain separate extensions.
- Re-offering the same task may later produce another rejection alert only for a new committed offer.
- Evidence and completion alerts may both exist: they represent distinct review steps, not duplicate events.
- Existing pickup, approval, and operations queues remain usable if notification delivery fails.
- Vehicle-change notifications contain Courier/vehicle references, changed field names and time only; no evidence, full plates, or private old/new values. Retried delivery never reruns the edit, no-op saves do not notify, and failure cannot reset approval or undo saved information.
- The backend validates current Courier affiliation within this Logistics organization and sole hub before returning `destination: /couriers/{courierId}/vehicle`. A missing/foreign affiliation yields a null destination; the vehicle endpoint independently reauthorizes on navigation.

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

| Method/path | Request | Success |
| --- | --- | --- |
| `GET /api/v1/logistics/notifications` | `status=all\|unread\|read`, `page>=1`, `per_page=1..50` | `200`, paginated `data`, Laravel `links`/`meta` |
| `GET /api/v1/logistics/notifications/unread-count` | No body | `200 {data: {unread_count: 3}}` |
| `GET /api/v1/logistics/notifications/{notification}` | UUID, no body | `200 {data: <notification>}`; no read mutation |
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

- Existing bell, `/notifications`, and `/notifications/:notificationId` remain the entry point. A vehicle alert opens its notification detail, whose destination link navigates to the protected `/couriers/:courierId/vehicle` page.
- The Logistics **Vehicles** sidebar list is another path to current vehicle details; it does not depend on an alert or change notification read state.
- Label that action **Open Courier vehicle** for this alert type. The vehicle page must fetch the current scoped Logistics vehicle API; do not render OR/CR from notification payload or imply the alert contains a historical vehicle snapshot.
- If the backend supplies no destination, the notification remains readable and shows an unavailable target. Direct URL refresh and browser back navigation use the protected Logistics route.
- A vehicle `404`, lost affiliation, or unavailable document leaves the alert readable and shows a safe unavailable/retry state on the destination. Opening a record does not automatically mark the alert read or reapprove the Courier.
- Bell preview requests five recent rows and unread count; the full page uses the same API with read/unread filters.
- Show loading, empty, filtered-empty, loaded, unavailable-target, permission, consent, timeout, offline, and retry states.
- Mark read only through an explicit action or after successful detail rendering; loading the bell/list never marks read.
- Disable duplicate read taps, reconcile server results, and retain unread state when a request fails.
- Refresh on opening/focus and every 30 seconds while visible and authenticated; stop polling on hidden tabs, logout, and authorization loss.
- Clear private cached state on account switch/logout. No persistent offline inbox or background mutation queue.
- Read `docs/design.md` before implementation; reuse compatible shared UI primitives, accessible buttons, focus behavior, text status, and restrained live announcements.

### Implementation and verification

- Reuse the implemented Logistics notification service, controller, resource, and route projection. The vehicle destination page belongs to `docs/features/logistics/vehicle-fleet-management/specs.md`.
- Test that vehicle notifications supply only a scoped internal destination, and that navigation resolves the current read-only vehicle page without leaking a foreign Courier or private document.
- Keep release-level checks open until the recorded verification gates are complete; this feature adds no email behavior or second inbox table.
- [x] Guest, wrong-role, inactive, cross-account, cross-organization, and forged-resource access fails closed.
- [x] Existing pickup notifications render safely and preserve read history; implemented producers reach only their owning Logistics account.
- [x] List/count/detail share scope, stable ordering, bounded pagination, and private cache rules.
- [x] Concurrent-safe mark-read and deterministic delivery paths preserve first read time and one notification per event/recipient/type; focused API coverage exercises idempotent reads and delivery deduplication.
- [x] Rollback-safe after-commit delivery and queue retries cannot duplicate or undo operational decisions; PostgreSQL/concurrency verification remains a release gate.
- [x] Bell/list/detail implement loading, failures, consent recovery, stale links, explicit read state, polling visibility, and logout cleanup; browser automation remains a release gate.
- [ ] SQLite/PostgreSQL migration/API tests and Logistics type-check/build/UI tests pass with recorded results.
- [x] Vehicle/OR/CR edits notify only the associated Logistics account once per changed revision without reapproval; backend projects a scoped vehicle destination.
- [x] The Logistics notification detail opens the read-only Courier vehicle page; missing/foreign vehicles and documents show truthful unavailable states, and opening the page does not mark the notification read. Browser interaction automation remains a separate verification gate.

### Hub-routing API integration (2026-09-18)

For routed Shipments, final-mile evidence and completion producers resolve the recipient and resource destination through current custody organization/hub. Origin provider fields remain immutable; they no longer authorize another hub's final-mile task or proof. Historical notifications preserve their safe text while unavailable/foreign task destinations return no operational context. Transfer events remain custody history and do not add an unapproved notification type.

### References

- Shared authority: `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Logistics.md`.
- Existing feature references: `docs/features/admin/notification/spec.md`, `docs/features/seller/order-notification/spec.md`; use current code over their older speculative routes/status wording.
- Working patterns: `src/api/app/Http/Controllers/Seller/NotificationController.php`, `src/api/app/Http/Controllers/Customer/NotificationController.php`, `src/api/app/Http/Resources/Seller/SellerNotificationResource.php`.
- Producer owners: Logistics Courier Approval, Deploy Rider, Update Status, and `docs/features/orders/logistics-pickups/spec.md`; reuse their events, never duplicate their workflows.
- [Laravel after-commit queue behavior](https://laravel.com/docs/12.x/queues#jobs-and-database-transactions) supports deferred dispatch; durable application deduplication remains required.
