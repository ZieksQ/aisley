---
feature: logistics-messaging
role: Customer
platform: Flutter / Dart
phase: 4
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Logistics delivery messages

Backend: Separate owned active-Order/current-handler text/history/send/read APIs implemented.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Active owned Order → Order-context first message → current Logistics thread → scoped reply/history/read.

- Use logistics-conversations and kind customer_logistics; first message body/context_type:order/context_id plus UUID key. API resolves current organization/hub from Shipment or compatible waybill, never Buyer recipient choice.
- Payment-wait/placed/preprocessing/terminal and in-transfer/invalid-handler states cannot start/send; API eligibility is authoritative. Ended context retains original participant read-only history; replacement handler never inherits private text.
- Use operational data/meta, send body only, read last_read_sequence; channel owns its cursor/unread/pending key. Bounded foreground polling/frozen uncertain sends; no attachments/provider picker/task mutations/offline queue.

## Existing API

- `GET /api/v1/customer/logistics-conversations`
- `POST /api/v1/customer/logistics-conversations`
- `GET /api/v1/customer/logistics-conversations/{conversation}`
- `GET /api/v1/customer/logistics-conversations/{conversation}/messages`
- `POST /api/v1/customer/logistics-conversations/{conversation}/messages`
- `POST /api/v1/customer/logistics-conversations/{conversation}/read`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Owned current-handler/custody/terminal eligibility and changed relationship follow server responses.
- [ ] Same-key replies/read/history and live Logistics exchange stay isolated through offline/read-only/cursor recovery.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G16 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/logistics/chat-messaging/specs.md; docs/features/customer/chat-messaging/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
