---
feature: support-tickets
role: Customer
platform: Flutter / Dart
phase: 4
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Admin support tickets

Backend: Own-ticket APIs and Admin triage/status lifecycle implemented; linked records/attachments/notification fanout deferred.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Account Support → subject/category/description → ticket → Admin reply/status → revision-checked Customer reply/read.

- Create subject 1–150/category general|account|order|delivery/body 1–2000 with UUID key; UI description maps to body. No linked Order/context fields or arbitrary Admin chat.
- Own requester User plus customer-role scope; no pending/inactive exception. Replies need body/expected_revision/UUID key and reopen waiting_for_requester/resolved. Buyer cannot claim/assign/set status.
- List is items/next_cursor; detail data/events/next_cursor; read last_read_sequence ≥0, bounded to known history. Unread is independent of chat/notifications. Freeze uncertain draft/key/revision, poll foreground and refresh conflict before deliberate new action.

## Existing API

- `GET /api/v1/customer/support-tickets`
- `POST /api/v1/customer/support-tickets`
- `GET /api/v1/customer/support-tickets/{ticket}`
- `POST /api/v1/customer/support-tickets/{ticket}/read`
- `POST /api/v1/customer/support-tickets/{ticket}/replies`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Own ticket and field/role/foreign denials expose no unrelated cases.
- [ ] Same-key create/reply, stale revision/reopen, read/history and offline/conflict preserve one intended event.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G17 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/support-tickets/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
