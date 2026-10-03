---
feature: recently-viewed-items
role: Customer
platform: Flutter / Dart
phase: 2
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Recently Viewed

Backend: Owned record/merge/list/remove/clear and public Product resolver implemented.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Successful detail → guest ID/time hints or server record → current visible cards → best-effort login merge.

- Guest storage is at most 12 distinct productId/viewedAt hints, no DTO/price/account/token; use a platform adapter with blocked/corrupt/quota fallback. No recording from search/cards/Home impressions.
- Owned PUT uses server time and one User/Product row with current retention 50. Resolver takes productIds ≤12. Merge takes items with optional valid bounded viewedAt; malformed/duplicate request is validation, unavailable Products omitted.
- Merge once after confirmed auth without delaying login; clear hints on success, preserve them on failure for retry. Remove is idempotent, clear-all needs confirmation. Logout retains server history and never copies it into guest storage; old-account reads/rails clear.

## Existing API

- `POST /api/v1/customer/products/resolve`
- `GET /api/v1/customer/recently-viewed`
- `DELETE /api/v1/customer/recently-viewed`
- `POST /api/v1/customer/recently-viewed/merge`
- `PUT /api/v1/customer/recently-viewed/{product}`
- `DELETE /api/v1/customer/recently-viewed/{product}`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Record/revisit/retention and visible out-of-stock cards follow server rules.
- [ ] Guest storage/merge/failure and account-switch/clear/late paging cannot leak private history.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G19 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/recently-viewed-items/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
