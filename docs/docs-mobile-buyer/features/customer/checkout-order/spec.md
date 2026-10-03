---
feature: checkout-order
role: Customer
platform: Flutter / Dart
phase: 3
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# COD checkout and placement

Backend: Quote/place/batch, per-Shop Orders, shipping/vouchers/reservations/snapshots and UUID replay implemented.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Buy Now or selected Cart → saved shipping + COD → per-Shop quote → reviewed Place → atomic batch result.

- Choose exactly buy_now product_id/nullable-present variant_id/quantity or distinct owned cart_item_ids; add address_id,payment_method:cod and optional voucher UUID/target Shop selections. No computed price/total/shipping/provider/owner/status.
- Requote changed intent and display exact server serviceability/rate/shipping/savings/COD. Buyer never selects Logistics; Seller chooses downstream. One Shop creates one independent Order; all group Orders/snapshots/redemptions/reservations/selected Cart cleanup commit atomically.
- Place same intent plus quote_id and UUID key; COD starts placed/pending payment and reserves stock until authoritative first-mile fulfillment. Buy Now leaves Cart unchanged; commission does not increase COD.
- Freeze uncertain key/payload for exact replay. Fresh quote needs review and deliberate Place; process-death recovery and missing GET-by-key remain gaps. Do not show partial success.

## Existing API

- `POST /api/v1/customer/checkout/place`
- `POST /api/v1/customer/checkout/quote`
- `GET /api/v1/customer/checkout/{batch}`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Atomic one/multi-Shop placement and immutable current quote/totals/serviceability follow Laravel.
- [ ] Lost-response same-key replay creates one batch/reservation/redemption; stale inputs require reviewed recovery.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G09, G11, G12 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/checkout-order/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
