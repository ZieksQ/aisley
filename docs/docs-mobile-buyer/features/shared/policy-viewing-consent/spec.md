---
feature: policy-viewing-consent
role: Customer
platform: Flutter / Dart
phase: 1
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
---

# Policies and Customer consent

Backend: public current/history, actor-scoped status/acceptance and protected-action enforcement implemented. Flutter: **pending**.

Public Terms/Privacy read → active-token restoration → server status → explicit confirmation of required current version → refreshed status → protected navigation.

- One platform-wide Terms/Privacy version stream serves every role. Current views include only published versions; history published/superseded; Drafts and Internal Rules are excluded. Render plain text or approved safe Markdown, never arbitrary HTML.
- Status returns data.policies with required, exact accepted and current/accepted version descriptors plus all_required_accepted. Server decides initial/re-consent and Admin-controlled enforcement; required false may coexist with exact accepted false.
- Acceptance uses confirmation:true and current type/version route. Exact User/version uniqueness makes replay safe without a required UUID header. No owner/time fields or automatic/prechecked confirmation.
- POLICY_VERSION_STALE (409) reloads current content/status for renewed confirmation; reading history never creates acceptance.
- POLICY_CONSENT_REQUIRED retains auth, blocks private feature work and permits me/logout/status/accept. No redirect loop or automatic commerce replay. Marketing preference is separate.

Existing APIs:

- GET /api/v1/platform/policies/{type}
- GET /api/v1/platform/policies/{type}/history
- GET /api/v1/platform/policies/{type}/history/{version}
- GET /api/v1/policy-consent/status
- POST /api/v1/policy-consent/{type}/versions/{version}/accept

Public type is terms_of_service or privacy_policy. Status/accept require active authorized identity and are exempt from the consent gate.

Future Flutter acceptance:

- [ ] Guest current/history views and authenticated status remain distinct and safe.
- [ ] Required consent after restoration or mid-session publication blocks private work without losing identity/replaying writes.
- [ ] Explicit confirmation, exact replay, stale conflict, enforcement toggle, offline/throttle and account switching match Laravel.
- [ ] Android/browser keyboard/back/focus and readable policy/loading/error states are verified.

Read [authentication](../../../api/authentication.md), [DTOs](../../../api/contracts.md), [inventory](../../../api/endpoints.md), [verification](../../../verification.md), [design](../../../design-buyer.md) and [source provenance](../../../references/source-provenance.md).

Upstream intent: docs/features/shared/policy-viewing-consent/spec.md. Evidence: PolicyConsentController/Service, Policy middleware/Requests and src/api/tests/Feature/Shared/PolicyConsentTest.php. Existing tests were inspected, not rerun; no Flutter implementation occurred.
