---
feature: view-product
role: Customer
platform: Flutter / Dart
phase: 2
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Product Detail and configuration

Backend: Product Detail Resource, media/valid variants and current purchase handoffs implemented; canonical checklist retains historical foundation wording.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Visible Product → gallery/description → complete valid variant + quantity → Cart or Buy Now.

- Use immutable Product UUID, safe visibility-gated media, meaningful fallback/alt text and approved sanitized Markdown/GFM description. Raw HTML/arbitrary external image paths must not execute; descriptions and plain-text user content have distinct renderers.
- Use ordered optionGroups/values and server-listed variant optionValueIds, not a Cartesian product. Selected price/media/stock may inherit permitted base fields; disable impossible/out-of-stock/incomplete combinations and bound quantity.
- Guests can inspect; protected purchase/save/message requires sign-in then intentional retry. Detail never reserves inventory. Q&A/reviews/Wishlist/recency/chat retain their owning contracts; successful canonical detail load alone records recency.

## Existing API

- `GET /api/v1/products/{id}`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Gallery/options/quantity and safe description links are keyboard/TalkBack usable and reflect valid combinations.
- [ ] Hidden Products reveal no media; protected handoffs revalidate and never mutate on impression.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G08 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/view-product/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
