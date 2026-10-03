---
feature: customer-homepage
role: Customer
platform: Flutter / Dart
phase: 2
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Homepage and discovery

Backend: Public aggregation, optional personalization and cursor discovery implemented; shortcut/error/cache gaps remain.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Home sections → Products/Shops search or detail → bounded discovery load more.

- Render eligible server-selected ads/categories/deals/top/history/feed; omit empty optional rails and unavailable destinations. Category cards use Products keyword search by Category name, not an exact global category filter.
- Card numeric prices/compact availability never authorize purchase. Purchase rails use purchasable visibility; recency may show visible out-of-stock Products. Cart badge comes from Cart API, not the Home viewer.cartItemCount placeholder.
- Public Home is credential-free; authenticated Home is private. Clear viewer/history/feed immediately on account change, ignore old responses, deduplicate Product IDs, respect opaque cursor/end/client cap and preserve items on page errors. Impressions never record recency.
- Bazaar/MoneyFest, voucher wallet and absent shortcut result pages remain deferred.

## Existing API

- `GET /api/v1/customer/home`
- `GET /api/v1/customer/home/recommendations`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Public/private Home snapshots remain account-isolated through logout/late paging.
- [ ] Cursor loading/end/errors and category/Product/Shop navigation are truthful and accessible.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G10, G19 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/customer-homepage/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
