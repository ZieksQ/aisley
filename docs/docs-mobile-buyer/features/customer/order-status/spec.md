---
feature: order-status
role: Customer
platform: Flutter / Dart
phase: 3
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Owned Orders and tracking

Backend: Owned list/detail/timeline, status mapper, immutable facts and safe assigned-Courier projection implemented; live maps deferred.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Account Orders → All/status group → own detail/timeline → server-capable correction/contact/review.

- All is default; group allow-list comes from server enum. page 1–10000, per_page 1–50/default 15. Each Shop Order remains independent within one checkout.
- Render canonical status/group labels, item/voucher/financial/address snapshots, chronological tracking and action hints. Detailed Shipment/task custody is distinct from OrderStatus.
- Buyer cannot advance status, scan/submit proof/accept tasks/collect COD. map.available=false means no fabricated GPS/route/ETA. Tracking Courier name/contact does not enable chat: fetch Courier Order-context.
- Responses are private; focus/reconnect/filter paging must discard obsolete account responses. Routine movement/first-mile scheduling does not imply Buyer notifications.

## Existing API

- `GET /api/v1/customer/orders`
- `GET /api/v1/customer/orders/{order}`
- `GET /api/v1/customer/orders/{order}/tracking`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Foreign/role/account-state privacy and bounded group/list/timeline work.
- [ ] Server actions/maps/labels and independent Shop Orders remain truthful through refresh/error/late replies.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G09, G14 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/order-status/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
