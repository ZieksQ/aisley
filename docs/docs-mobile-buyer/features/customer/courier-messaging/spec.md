---
feature: courier-messaging
role: Customer
platform: Flutter / Dart
phase: 4
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Delivery Courier messages

Backend: Accepted-final-mile counterpart APIs and private Customer Order-context read implemented; live/race release gates open.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Owned Order → private Order-context read → eligible first message → task-specific Courier thread → scoped read/reply/history.

- Order-context returns order_id,order_reference,send_allowed,conversation_id and creates no empty thread. Displayed Courier name/unaccepted offer alone grants no contact.
- Start courier-conversations with body/context_type:order/context_id and UUID key. Server resolves accepted final-mile task/offer, approved active affiliation/account/organization/custody and nonterminal Order. Never submit task/leg/recipient IDs or call Courier APIs.
- Reassignment/custody/terminal change disables sending while original participants keep scoped read-only history; new Courier gets another private thread. Operational data/meta/read last_read_sequence and frozen key/payload differ from Shop facade. Polling preserves pending first-send context and older gaps.

## Existing API

- `GET /api/v1/customer/courier-conversations`
- `POST /api/v1/customer/courier-conversations`
- `GET /api/v1/customer/courier-conversations/order-context/{order}`
- `GET /api/v1/customer/courier-conversations/{conversation}`
- `GET /api/v1/customer/courier-conversations/{conversation}/messages`
- `POST /api/v1/customer/courier-conversations/{conversation}/messages`
- `POST /api/v1/customer/courier-conversations/{conversation}/read`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Foreign/unaccepted/invalid custody deny contact and accepted stages allow only current server permission.
- [ ] Exact lost first-send/reply replay, read state and live Courier exchange handle reassignment/terminal/session/cursor recovery safely.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G16 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/chat-messaging/spec.md; docs/features/courier/chat-messaging/api-handoff.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
