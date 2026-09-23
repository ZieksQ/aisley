---
feature: push-notification-bar
title: Admin Outbound Notification Campaigns
system: AISLEY
type: Feature Specification
version: 2.0
status: First-release in-app Customer campaigns implemented; PostgreSQL/browser verification pending
role: Admin
scope: Admin React dashboard, Laravel API, Customer in-app inbox
---

# Admin Push Notification Bar

## WHAT

- Let an authorized Admin compose and review an outbound message, choose an approved audience, confirm a send, and inspect delivery results.
- **First release:** persisted, in-app Customer campaign notifications. The historical feature name does not mean browser/mobile push is already available.
- **Current foundation:** Laravel database notifications, Customer inbox/read APIs, a default-off Customer Account promotional preference, and Admin campaign draft/preview/send/history APIs and UI exist. Platform Settings announcements remain separate. No device-token, FCM, or SMS implementation exists.
- **Boundary:** Admin Notifications is the Admin's inbound inbox; Platform Settings owns persistent announcements; source features own transactional alerts such as low stock, registration review, and delivery. This feature owns only Admin-authored campaigns.
- Publishing an announcement must not also create a campaign. A campaign must not silently republish an announcement or duplicate its existing Customer notification.
- Browser/mobile push, SMS, arbitrary segments, scheduled sends, images, and analytics beyond persisted/failed counts are later phases requiring explicit contracts and provider setup.
- The first release is a campaign-composer feature, not a replacement for the Customer notification center. Its final read/dismiss behavior remains owned by the existing Customer Notifications contract.

## MUST

### Authority and eligibility

- Admin campaign reads require active `admin` role and a new dedicated `notification-campaigns.view` permission; create/send requires `notification-campaigns.manage`. Neither `notifications.view` nor `platform-settings.manage` grants this authority implicitly.
- Laravel derives the actor and recipients. The client cannot submit User IDs, device tokens, provider credentials, or a custom SQL/filter expression.
- The first audience is **active Customers who explicitly opted in to in-app promotional messages** through Customer Account settings. Registration, policy acceptance, and an enabled inbox are not marketing consent.
- `customer_profiles.promotional_in_app_opted_in` defaults to false; the owner-only Customer Account preference endpoint records the explicit toggle and opt-in time. Recheck status and preference when each recipient is persisted.
- Inactive, suspended, deactivated, or opted-out accounts are excluded. Admin, Seller, Logistics, and Courier audiences remain unavailable until role-specific eligibility and inbox contracts are approved.
- A permission or audience error fails closed at the API boundary; hiding a React control is not sufficient authorization.

### Campaign lifecycle

- Persist a UUID campaign with title, plain-text body, allow-listed audience key, optional internal destination, creator, timestamps, revision, status, and recipient/result counts.
- Use lowercase `snake_case` statuses: `draft → preparing → queued → sending → completed | partially_failed | failed`. Status is server-owned; queue acceptance is not delivery completion.
- A Draft may be edited with a revision check. Sending requires a fresh preview and explicit confirmation showing title, body, audience and estimated eligible count.
- A preview response includes the audience label, estimated eligible count, calculation time, and whether dispatch is currently allowed; it is not a recipient export or reservation.
- Preview is advisory. At send confirmation, freeze an audience cutoff and criteria, then persist the exact eligible recipient snapshot before any delivery; a retry cannot expand the audience.
- During `preparing`, the UI must show that recipient selection is not finished. No recipient notification may be sent from an incomplete snapshot.
- Reject an empty eligible audience. Once queued, content and snapshot are immutable. Correct an erroneous send with a new campaign, not a silent rewrite.
- Duplicate or retried send requests return the same campaign result using an idempotency key plus a locked state transition; they never fan out twice.
- The authoritative success count means a unique in-app notification was persisted, not that a person read it. Record skipped/ineligible and failed counts separately.
- Failed recipient delivery may be retried without recreating the campaign or changing its frozen audience. Partial failure remains visible in history.
- Record create/edit/send actions in the Admin audit outbox with actor, campaign, audience, revision and time, but not full recipient lists, secrets, or message bodies.
- History remains available after a campaign finishes or fails; no destructive delete or silent reset of the counters is part of the first release.

### API and retry behavior

- Use `401` for missing/invalid authentication, `403` for wrong role or permission, and scoped `404` for unknown campaigns.
- Use `422` for invalid text, audience, destination or zero eligible recipients; use `409` for stale revision or a conflicting state transition.
- `POST /send` must return the existing campaign projection for an exact idempotent retry. Reusing the key with different content must fail, not dispatch a second campaign.
- A timeout after send is an uncertain result, not evidence of failure. The Admin client refetches by campaign ID before showing another send control.
- A queue or worker outage leaves an observable queued/failed campaign for retry; it must not roll back an unrelated announcement, policy, Order, or operational event.
- Emit safe operational logs for campaign ID, state changes, batch count and error category; never log message bodies or recipient details.

### Message and recipient safety

- Validate bounded title/body length and render as plain text; no HTML, script, arbitrary Markdown, attachment, or raw external URL in the first release.
- Destination is optional and generated from an allow-listed internal resource type/ID, such as a visible Product or Shop. Laravel validates it at send time; the Customer client re-authorizes/rechecks visibility on open.
- The campaign notification uses the existing Customer inbox/read contract and a campaign-specific type and safe DTO. Update its destination allow-list instead of trusting payload paths.
- Store only the campaign ID, safe title/summary, approved destination descriptor, and created time in each Customer notification; full recipient metadata stays server-side.
- Give each campaign/Customer pair one deterministic notification identity; database uniqueness prevents duplicate inbox rows across worker retries.
- Campaign preview/history show aggregate counts and safe message metadata only, never recipient PII, raw device tokens, phone lists, or private Order/evidence data.
- Do not use this composer for critical transactional events. Those remain source-owned and must not depend on an Admin campaign being sent.

### Admin and Customer experience

- Admin React provides a dedicated, permission-gated campaign page rather than replacing the existing notification bell or announcement editor.
- Show Draft, preview, confirmation, queued/processing, completed, partial failure, empty audience, stale revision, 401/403, validation, timeout, and retry states.
- Disable duplicate submission, but after an uncertain timeout refetch the campaign by its stable ID/idempotency result instead of creating another send.
- Use labeled controls, keyboard-operable confirmation, visible focus, non-color-only status, and a responsive light/dark dashboard layout.
- Customer notifications appear in the existing inbox/bell, persist across refresh, and use the existing owner-only read state. No browser permission prompt is needed for in-app delivery.
- A Customer whose Product/Shop destination later becomes unavailable still sees the message, but opening it shows the destination feature's safe unavailable state.

### Acceptance criteria

- [ ] A guest, non-Admin, or Admin without the dedicated permission cannot list, create, edit, preview, or send campaigns.
- [ ] A promotional send has zero recipients until an explicit Customer opt-in contract exists; status and opt-out changes are honored.
- [ ] Preview uses allow-listed server audience rules and does not disclose recipient lists.
- [ ] One confirmed send freezes content/audience, queues after commit, and persists at most one notification per eligible Customer despite retries or concurrency.
- [ ] Empty audience, stale Draft revision, repeat send, provider/worker failure, and partial delivery return truthful states without duplicate fan-out.
- [ ] Customer inbox and destination reads remain owner-scoped and visibility-checked; Admin campaign DTOs contain no raw paths, secrets, phone numbers, or device tokens.
- [ ] Announcement publication, Admin inbound notifications, and source-owned operational alerts keep their existing behavior and do not generate duplicate campaign messages.
- [ ] API, queue, permission, preference, deduplication, history, and accessible React states have focused tests; PostgreSQL migration/retry checks pass before release.
- [ ] A failed notification job cannot mark its recipient delivered; counters reconcile to the persisted recipient records after retry.

## HOW

- Add additive campaign and campaign-recipient migrations; keep enum-like database fields as strings with PHP enum casts. Do not alter the existing `notifications` migration.
- Use an indexed unique `(campaign_id, user_id)` recipient key, immutable send snapshot, per-recipient result, and deterministic notification UUID; store no full User export in a JSON campaign field.
- Suggested campaign fields: `id`, `title`, `body`, `audience_key`, `destination_type/id`, `status`, `revision`, `created_by_admin_id`, `confirmed_at`, `completed_at`, and result counters.
- Suggested recipient fields: `campaign_id`, `user_id`, `notification_id`, `status`, `attempt_count`, `last_error_category`, and server timestamps. Do not persist phone numbers or device tokens here.
- Index campaign history by creation time/status and recipient work by campaign/status; keep the recipient table private and separate from Laravel's existing `notifications` table.
- Completed/terminal campaign recipient rows are pruned 90 days after the final `completed_at` time by a scheduled bounded command. Aggregate campaign history and Customer inbox notifications remain; no recipient export is retained in campaign JSON.
- Add declared Admin permissions through the established permission seeder and use `auth:sanctum`, active-role/status, permission middleware, Form Requests, Resources, and a focused campaign service.
- Implemented routes under `/api/v1/admin/notification-campaigns`:
  - `GET /` and `GET /{campaign}`: paginated history and safe detail.
  - `POST /` and `PATCH /{campaign}`: create/update Draft with validation and revision.
  - `POST /{campaign}/preview`: estimated eligible count; no persisted recipient list.
  - `POST /{campaign}/send`: explicit confirmation, revision and `Idempotency-Key`; return queued campaign ID/status.
- Use a transaction/row lock to freeze the campaign and snapshot, then dispatch bounded Laravel jobs after commit. Workers recheck recipient eligibility, persist a unique Customer database notification, and update result counters idempotently.
- If the audience is too large for one transaction, add a server-owned `preparing` stage: freeze the eligibility cutoff/criteria first, build the snapshot in bounded idempotent chunks, and do not deliver until snapshot completion. Do not silently change the audience between chunks.
- Reuse the existing Customer notification list/detail/read APIs. Extend the Customer resource's type/destination mapping only for approved campaign destinations; never accept a client-provided arbitrary link.
- Keep campaign status/count endpoints private and `no-store`. Limit page size and send size; rate-limit send and bound worker chunks. Retain retryable failure categories without leaking provider or recipient data.
- Reconcile campaign counters from recipient outcomes after worker retries so a crash between notification insert and counter update cannot create false totals.
- Test on SQLite and PostgreSQL, including two concurrent send requests, worker retries, opt-out between preview and send, opt-out after snapshot, and failure after campaign commit.
- In React, reuse existing API client and dashboard components. Poll campaign status on its detail page; database state, not a browser timer or optimistic counter, decides completion.
- Use the established Admin light/dark design system and responsive form patterns; do not add a Courier web screen or send directly from browser code.
- Release in two gates: (1) Admin Draft/preview/history plus Customer marketing preference; (2) enable send only after permission, eligibility, queue and recipient-deduplication tests pass. Do not expose a working Send control before gate 2.

### Later delivery channels and open decisions

- External push needs an approved provider, authenticated per-device registration/removal, user/browser permission, secure server credentials, platform clients, opt-out rules, and provider-error handling. FCM is a candidate, **not** an AISLEY dependency or selected provider. See [Firebase's Flutter](https://firebase.google.com/docs/cloud-messaging/flutter/get-started) and [Web](https://firebase.google.com/docs/cloud-messaging/web/get-started) setup.
- SMS needs a separate verified-phone, consent/opt-out, provider and cost contract. It is not enabled by this in-app release.
- **Decided:** Customer Account settings owns the default-off promotional in-app preference. Retain per-recipient campaign rows for 90 days after completion and aggregate campaign history thereafter. Terms acceptance does not imply promotional consent.
- Confirm whether future segments (inactive Customers, top-performing Sellers), scheduling, and linked announcements are required. Each needs an approved definition and duplicate-delivery rule.
- Laravel's [queued job after-commit behavior](https://laravel.com/docs/12.x/queues#jobs-and-database-transactions) supports the proposed dispatch boundary; external-provider acceptance must never be reported as a user read.
