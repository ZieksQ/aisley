---
feature: product-review-ratings
role: Customer
platform: Flutter / Dart
phase: 4
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Verified reviews and ratings

Backend: Delivered own-item Review create/public list/photos and read-only official Seller response implemented; release/media concurrency checks incomplete.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Delivered owned Order Item → rating/body → canonical Review → independent photo uploads → public list/response.

- POST owned order-item Review with rating 1–5/body plain text ≤2000. Backend proves delivered purchase and one Review per Item. Identical content replay returns same Review; changed repeat conflicts, not editing. No UUID-header requirement for text create.
- Upload separate multipart image on own Review; current max 5, JPEG/PNG/WebP strictly under 10 MiB, review dimension caps per config. Partial image failure never undoes text. Image upload has no durable replay; reconcile uncertainty before another copy.
- Public photos/list recheck visibility and expose safe Verified Customer label/real aggregates/read-only published Seller response. No seeded counts as authored Reviews, Courier ratings, video, moderation/edit/delete API or private storage paths.

## Existing API

- `POST /api/v1/customer/order-items/{orderItem}/review`
- `POST /api/v1/customer/reviews/{review}/images`
- `GET /api/v1/products/{product}/reviews`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Delivered ownership/identical replay/changed repeat and real aggregates/response privacy match server.
- [ ] Android/browser photo boundaries, partial/uncertain recovery and public pagination stay safe and accessible.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G15, G14 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/product-review-ratings/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
