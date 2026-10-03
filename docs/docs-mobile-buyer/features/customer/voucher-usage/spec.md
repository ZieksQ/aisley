---
feature: voucher-usage
role: Customer
platform: Flutter / Dart
phase: 3
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Checkout voucher usage

Backend: Existing quote candidate/eligibility/selection/savings/snapshot/redemption implemented; wallet/claim/authoring deferred.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Quote candidates → explicit UUID/target Shop → requote → reviewed savings → placement redeems.

- Selections vouchers:[{voucher_id,target_shop_id}] ≤20; code is display, not accepted code-entry. Candidates may be ineligible with reason. No automatic best selection/claim/wallet API.
- One App voucher per batch with explicit eligible Shop target; Shop voucher only its Shop. At most one discount and one shipping benefit per group; different-benefit stacking needs reciprocal permissions. Minimum spend uses full target-Shop merchandise before discounts.
- Server time/scopes/exclusions/capacity/customer limit and integer-cent calculation/caps decide saving. Selected zero-saving voucher still redeems; quote reserves nothing. Placement locks/rechecks/redempts atomically and snapshots terms; cancellation/rejection currently does not restore counters.
- Disclose removed/stale choices before another Place action and reject previous-account selections/results.

## Existing API

- `POST /api/v1/customer/checkout/place`
- `POST /api/v1/customer/checkout/quote`
- `GET /api/v1/customer/checkout/{batch}`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Targeting, stacking/reasons/zero-saving/current amount display are server-driven.
- [ ] Voucher-bearing replay/rollback/capacity conflicts and account switch do not double-consume or silently retarget.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G11, G14 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/voucher-usage/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
