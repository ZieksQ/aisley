---
feature: order-modification-cancellation
role: Customer
platform: Flutter / Dart
phase: 3
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Order cancellation and address correction

Backend: Eligible placed COD mutations, locked reservations, new address snapshots and replay implemented; shipping-rate revalidation gap remains.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Owned eligible Order → confirm cancellation or select saved shipping row → locked action → refreshed state/history.

- Only server-eligible placed COD/pending-payment Orders with required records and no pickup/waybill/task may change. Seller processing closes the window; no invented grace timer.
- Cancel uses optional reason ≤500 and UUID key, releases only its reserved stock once and makes no refund/payment-reversal promise. Modification uses address_id, optional expected_revision and UUID key, validating own complete shipping row and creating new immutable version/history.
- The inspected service does not recalculate the saved shipping rate/coverage on address correction. Record G21 and coordinate material-location handling with backend owner; never derive a replacement fee or serviceability locally.
- On 409 refetch capabilities; freeze uncertain key/payload for exact replay. No quantity/variant/voucher/price/status changes. Address Book edits do not modify Order snapshots.

## Existing API

- `POST /api/v1/customer/orders/{order}/cancel`
- `PATCH /api/v1/customer/orders/{order}/modification`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Seller-processing race/stale revision/key replay yield one permissible outcome and release stock once.
- [ ] Correction preserves previous address versions and shows current capability/error/shipping-gap boundaries.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G21 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/order-modification-cancellation/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
