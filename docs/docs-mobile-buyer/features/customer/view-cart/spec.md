---
feature: view-cart
role: Customer
platform: Flutter / Dart
phase: 3
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Cart configuration

Backend: Cart routes/tables/service/Resources/tests implemented despite stale Draft spec claiming no API.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Valid Product configuration → Add → owned lines → quantity/variation/remove → selected checkout.

- Send product_id,variant_id,quantity only. Same configuration increments/merges, different variants stay separate; valid required variant belongs to Product. PATCH quantity/variant atomically validates/merges or preserves original line on failure.
- Cart never reserves Inventory. Display current server prices/ordered choices/availability, preserve unavailable intent and exclude ineligible selected checkout. itemCount is quantity total, distinctItemCount line total; numeric subtotals are display only.
- No guest Cart/merge. Disable duplicate taps; additive POST has no durable UUID replay contract, so uncertain adds need refetch/explanation rather than automatic incrementing again.

## Existing API

- `GET /api/v1/customer/cart`
- `POST /api/v1/customer/cart/items`
- `PATCH /api/v1/customer/cart/items/{item}`
- `DELETE /api/v1/customer/cart/items/{item}`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Variant upsert/substitution/separate-line and stock/visibility conflicts return current Cart.
- [ ] Owned reads/badges and uncertain/duplicate/session/consent failures do not double-add or reserve stock.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G08 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/view-cart/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
