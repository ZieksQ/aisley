---
feature: notifications
role: Customer
platform: Flutter / Dart
phase: 4
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Inbox notifications and preference

Backend: Allow-listed own list/detail/read and in-app promotion preference implemented; unread-count/read-all/native push absent.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Account Notifications → all/read/unread page → allowed target → mark read; settings controls in-app promotions.

- List status all/read/unread, per_page 1–50/default 20 and Laravel data/links/meta pagination. Mark read is idempotent and never advances Order/chat/ticket state. No dedicated unread-count/read-all; page unread is not global total.
- Allowed records cover announcements, important Order decisions/outcomes, ongoing promos/campaigns, Q&A answered and Seller Review response; routine movement/first-mile schedules are filtered out.
- Map destinations to allow-listed native Product/Q&A/Review/Shop/Order/Notification routes; never treat arbitrary web path as external navigation authority. Preference is default-off boolean, independent of consent. Device registration/FCM/APNs/native push/background sync are deferred.

## Existing API

- `GET /api/v1/customer/account/notification-preferences`
- `PATCH /api/v1/customer/account/notification-preferences`
- `GET /api/v1/customer/notifications`
- `GET /api/v1/customer/notifications/{notification}`
- `POST /api/v1/customer/notifications/{notification}/read`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Own allow-listed notifications/filters/reads/destinations work without invented global badge.
- [ ] Promotion remains default off and neither consent nor read changes grant push/commerce actions.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G13 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `src/api/app/Http/Controllers/Customer/NotificationController.php; no dedicated canonical Customer notification spec`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
