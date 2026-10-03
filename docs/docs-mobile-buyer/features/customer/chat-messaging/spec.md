---
feature: chat-messaging
role: Customer
platform: Flutter / Dart
phase: 4
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Shop messages

Backend: Shared Customer–Shop thread APIs, Seller replies and Shop unread-count implemented; retention/release gates remain.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Shop/Product/owned Order → first valid message → one reused Shop thread → reply/read/history.

- Use conversations and customer_shop; start shop_id/body with optional Product/Order context, server-derived Seller. Thread persists only on committed first message and is reused across contexts.
- Text ≤2000, UUID start/send key, server sequence/time/mine; read body uses sequence. Shop list/history envelopes are items/next_cursor, inbox adds unread_count. Context availability and send_allowed come from server.
- Poll visible online only, freeze uncertain body/context/key, and retain pending first-send through polling. Older cursor gaps remain reachable and monotonic read is separate from all other channels/notifications/tickets.
- Seller permission loss disables sends while scoped history remains readable. No attachments, typing/presence/edit/delete/Admin blanket transcript access/offline queue.

## Existing API

- `GET /api/v1/customer/conversations`
- `POST /api/v1/customer/conversations`
- `GET /api/v1/customer/conversations/unread-count`
- `GET /api/v1/customer/conversations/{conversation}`
- `GET /api/v1/customer/conversations/{conversation}/messages`
- `POST /api/v1/customer/conversations/{conversation}/messages`
- `POST /api/v1/customer/conversations/{conversation}/read`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Entry/context ownership reuses correct thread and never exposes another Shop or Customer.
- [ ] Lost first-send/send replay, sequence/read/cursor reconciliation and live Seller exchange work with read-only/offline/error states.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G16 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/chat-messaging/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
