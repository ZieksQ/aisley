---
feature: wishlist
role: Customer
platform: Flutter / Dart
phase: 2
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Wishlist

Backend: Owned cursor/status list and idempotent PUT/DELETE implemented; alerts/guest merge deferred.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Visible card/detail → Save → Account Wishlist → remove or Product/Cart handoff.

- PUT/DELETE Product UUID derives owner and is idempotent; bounded product_ids status only describes this Customer. Current list hides unavailable/restricted Products safely.
- Wishlist never reserves stock or guarantees prices. Variant Products open Detail before Cart; simple-product Cart handoff reuses current validation.
- Guest save needs sign-in and deliberate retry; no guest merge/shared list/folders. Accessible saved/pending state, optimistic rollback and session cleanup apply. General notifications now exist but restock/price-drop alert evaluation/delivery remains deferred.

## Existing API

- `GET /api/v1/customer/wishlist`
- `GET /api/v1/customer/wishlist/status`
- `PUT /api/v1/customer/wishlist/{product}`
- `DELETE /api/v1/customer/wishlist/{product}`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Idempotent saves/removes and cursor/status remain private and accurately reconciled.
- [ ] Visibility/Cart/variant handoff and guest retry preserve safe intent without inventory reservation.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G14, G19 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/wishlist/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
