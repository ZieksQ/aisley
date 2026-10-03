---
feature: customer-auth
role: Customer
platform: Flutter / Dart
phase: 1
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Customer authentication

Backend: Auth/approval-aware registration, login and recovery implemented; address/ID registration and native reset links deferred.

Flutter: **pending**, including models, repository, controller, screens and target acceptance.

## Flow and behavior

Profile/credentials → pending/no credential → Admin decision outside app → device-token login → /me → consent.

- Register only supported profile/credential keys; no applicant status polling or imported Courier evidence keys. Login sends device_name and securely stores the returned Customer-scoped token on Android and local web.
- Distinguish credentials-first INVALID_CREDENTIALS from pending/rejected/suspended/inactive denial, throttling and network/storage failure. No identity may self-approve.
- Forgot-password is generic; reset mail targets the configured storefront. Native reset handling needs an approved link contract. Reset revokes all personal access tokens; current-token logout does not revoke every device.

## Existing API



Methods/gates/envelopes: [inventory](../../../api/endpoints.md), [DTOs](../../../api/contracts.md) and [messaging](../../../api/messaging.md). Private feature calls require Sanctum, active/Admin-approved Customer and required consent; auth and consent entry points retain their documented exceptions. Public reads remain public. API ownership/capabilities are authoritative.

## Future Flutter acceptance

- [ ] Active login/denied roles, token restoration/storage failure and pending/no-token registration match server results.
- [ ] Duplicate registration, generic recovery, reset and logout clear secrets and show truthful outcomes.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported permission/retry states and cleanup after identity loss.

Release/deferred boundaries: G01, G02, G03, G05, G18 in [integration gaps](../../../references/integration-gaps.md). Apply [design](../../../design-buyer.md), [architecture](../../../architecture.md) and [verification](../../../verification.md).

## Provenance

Upstream intent/evidence: `docs/features/customer/customer-auth/spec.md`. Resolve source paths against the monorepo baseline, not this copied repository. See [source provenance](../../../references/source-provenance.md) for Requests, Resources, services and inspected test sources. Existing source tests were not rerun for this bundle.
