---
feature: account-management
role: Customer
platform: Flutter / Dart
phase: 2
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Profile, password, photo and preference

Backend: Owned account/profile/password/private-photo and promotional preference APIs implemented.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Account → independent profile/photo/password form → confirmed change → refresh navigation; settings shows promotional preference.

- Read private allow-listed account DTO; PATCH profile uses permitted names/contact/sex/birth_date. Email/role/status/approval are read-only; no client owner ID.
- Password PATCH requires current_password and confirmed replacement; current bearer survives and other tokens are revoked. Email/MFA/device-list/delete/export remain deferred.
- Photo multipart uses photo and authenticated bytes/private reread/remove; refetch uncertain replacement before another upload. Promotion PATCH uses promotional_in_app_opted_in boolean, default off and separate from consent. Clear private forms/media on identity loss.

## Existing API

- `GET /api/v1/customer/account`
- `GET /api/v1/customer/account/notification-preferences`
- `PATCH /api/v1/customer/account/notification-preferences`
- `PATCH /api/v1/customer/account/password`
- `PATCH /api/v1/customer/account/profile`
- `POST /api/v1/customer/account/profile-photo`
- `GET /api/v1/customer/account/profile-photo`
- `DELETE /api/v1/customer/account/profile-photo`

Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Own profile fields/password token effects and denied inputs match current API.
- [ ] Android/browser authenticated avatar upload/read/remove and explicit default-off preference handle errors and cleanup.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G05, G15, G18 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/account-management/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
