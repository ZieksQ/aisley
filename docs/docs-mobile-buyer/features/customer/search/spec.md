---
feature: search
role: Customer
platform: Flutter / Dart
phase: 2
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Products and Shops search

Backend: Separate public Product/Shop search endpoints and ranked result modes implemented.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Query → Products/Shops mode → current page → owning detail; mode/query change resets page.

- Product search matches Product name, Shop name or Product Category name and returns Product cards. Shop search matches Shop name only and returns unique Shop summaries. Keep result types/totals separate.
- Trim q (1–100), page 1–10000, limit 8–50 (default 20); blank local query shows a prompt without an HTTP search. Literal wildcard escaping, visibility and ranking remain server-owned.
- Mode chooses an endpoint, not a Product API type filter. Preserve query/mode/page through browser Back/navigation and retry, reject malformed state and obsolete responses; distinguish no-query/no-match/validation/throttle/offline/service failure. No semantic/autocomplete/SKU search or purchase/recency mutation.

## Existing API

- `GET /api/v1/customer/products/search`
- `GET /api/v1/customer/search/shops`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Mode/query/reset/back/pagination preserve the selected collection and typed results.
- [ ] Wildcard/visibility/bounds and error recovery match server behavior without false empty success.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G19 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/search/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
