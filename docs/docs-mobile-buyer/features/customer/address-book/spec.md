---
feature: address-book
role: Customer
platform: Flutter / Dart
phase: 2
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Address Book and defaults

Backend: Owned CRUD/defaults and checkout snapshots implemented; Dart assets/native pin integration pending.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Addresses → cascading/manual form → optional pin → save/default → owned shipping selection.

- Requests use snake_case recipient/contact/address/locality/postal/country/type and optional label/line2/pair/is_default; DTO fields are camelCase. Type is shipping,billing,both and overlapping defaults clear transactionally through create/update, with no separate default route.
- Use approved exported PSGC JSON, Region→Province→City/Municipality→Barangay and manual fallback; npm packages are not Dart dependencies. Preserve supplied NCR/independent-city hierarchy.
- Intentional Geoapify pin clears stale pairs when text changes and never decides deliverability. Native Leaflet adaptation/mobile credentials remain an approval gap; manual save stays usable. Confirm deletion. Address CRUD never reroutes a placed Order.

## Existing API

- `GET /api/v1/customer/addresses`
- `POST /api/v1/customer/addresses`
- `PATCH /api/v1/customer/addresses/{address}`
- `DELETE /api/v1/customer/addresses/{address}`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Cascade/manual/default/type/coordinate behavior works offline and across parent changes.
- [ ] Own CRUD and checkout selection preserve immutable Order snapshots; pin/GPS failure leaves text save usable.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G06, G07 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/address-book/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
