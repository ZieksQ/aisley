---
feature: browse-shop
role: Customer
platform: Flutter / Dart
phase: 2
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Shop directory and storefront

Backend: Directory/detail, category filtering and optional Shop-scoped q search implemented.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Shops directory → visible Shop → its Product category/keyword page → Product Detail.

- Directory shop_category is an active Shop business-category slug. Shop Product category options come only from that Shop’s visible active Product categories.
- Shop Product q is optional, trimmed ≤100 and Product-name-only; accepted fields q,category,page,limit. Combine category/keyword with ownership/visibility, retain newest-publication order and independent category options.
- Filter/clear changes reset page and preserve the other filter. Visible empty Shop is valid, unavailable Shop is 404. No global search then client filtering, Shop ratings/following/vouchers/arbitrary sort/quick-add. Chat uses its own channel.

## Existing API

- `GET /api/v1/customer/shops`
- `GET /api/v1/customer/shops/{slug}`
- `GET /api/v1/customer/shops/{slug}/products`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Scoped keyword/category/directory and back/pagination keep intended state.
- [ ] Manipulated input cannot widen visibility or expose another Shop; empty/unavailable/error remain distinct.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G19 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/browse-shop/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
