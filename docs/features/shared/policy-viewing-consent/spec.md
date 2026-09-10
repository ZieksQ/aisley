---
feature: policy-viewing-consent
title: Platform Policy Viewing and Version-Specific Consent
system: AISLEY
type: Feature Specification
version: 1.0
status: Public policy API implemented; user UI and consent integration deferred
roles: Guest, Customer, Seller, Admin, Logistics, Courier
scope: Laravel API, Customer storefront, role dashboards, and external Courier Flutter client
canonical: true
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/*, Admin Manage Platform Settings, role auth specs
---

# Platform Policy Viewing and Version-Specific Consent

## WHAT

- **Purpose:** Let people read the current Terms of Service and Privacy Policy, inspect published history, and—after the policy matrix is approved—record explicit acceptance of the exact versions required for their role.
- **Ownership:** Admin Manage Platform Settings authors, versions, publishes, and preserves policy content. This feature consumes those published records and owns user-facing reads, acceptance status, and integration contracts; it does not edit policy text.
- **Current baseline:** Laravel already exposes public current/history reads for Terms and Privacy, and `policy_acceptances` stores immutable user/version/timestamp rows. Consent status, acceptance endpoints, visible non-Admin pages, and enforcement are not complete.
- **Audience:** Guests may read public Terms and Privacy. Authenticated Customer, Seller, Logistics, and Courier clients may read any policy allowed for their role. Internal Platform Rules remain non-public unless an explicit audience is approved.
- **Product rule:** A policy version is identified by its stable policy type and integer version. Ordinary views show only the current published version; history is a separate view.
- **Non-goals:** Admin policy authoring, legal advice, automatic acceptance, editing published rows, Internal Rules publication, subscription consent, marketing preferences, email/push delivery, or a Courier web UI.

```text
public current policy/history read
→ user reads exact published content
→ approved role policy matrix says acceptance is required
→ authenticated client checks consent status
→ client explicitly accepts the exact current version
→ server stores immutable acceptance and an approved auth flow applies any gate
```

## MUST

### Published policy catalogue

- Use the existing `PlatformPolicyType` allow-list: `terms_of_service`, `privacy_policy`, and `internal_rules`.
- Public routes may expose only Terms and Privacy. A public Internal Rules request returns the same not-found behavior as an unknown public policy type.
- Return only a current `published` version from the ordinary policy read. Never fall back to a Draft, Superseded version, or unpublished policy.
- The current response contains policy type/label and a safe version projection: ID, version, title, content, status, change summary, re-consent flag, and publication time.
- A history response lists only `published` and `superseded` versions. It must not expose Drafts, Admin identities, revision counters, internal notes, or audit data.
- An exact history read returns the selected published/superseded content and metadata. It never changes the current pointer or creates consent.
- Preserve the exact stored policy content when rendering. Treat content as plain text or approved sanitized Markdown; never execute arbitrary HTML, scripts, or client components.
- Public policy responses may be cached briefly by policy type. Consent status and acceptance responses are user-specific and must be `private, no-store` or equivalent.

### Consent matrix and acceptance

- Before enforcement is implemented, approve a matrix that names each policy type, audience, initial-acceptance rule, re-consent rule, and blocking point. This spec must not invent a global gate.
- `requires_reconsent` describes a specific published successor. It does not by itself decide whether initial acceptance is mandatory or which role must accept it.
- Until that matrix is approved, publication never blocks registration, sign-in, session restoration, or protected actions. Users can still read policies.
- The server derives the accepting User from the authenticated session. The client may not submit `user_id`, role, policy identity, acceptance time, or an approval decision.
- Accept only the authorized current `published` version selected by the server. Draft and Superseded versions are read-only and cannot be accepted through the normal endpoint.
- Store one immutable `policy_acceptances` row containing the User, exact `platform_policy_version_id`, and server `accepted_at`. The unique User/version constraint makes a retry idempotent.
- A publication never auto-accepts users and never rewrites, deletes, or backdates an existing acceptance. A later version creates a separate acceptance row when required.
- If registration must be blocked before a User exists, the owning registration spec must define a separate applicant acceptance record; do not misuse `policy_acceptances.user_id`.
- Acceptance succeeds only after the database commit. A notification, cache, or client refresh failure cannot undo the committed record.
- A consent-status projection compares each required current version with that User's exact acceptance. It returns no private data for another User and is never shared-cached.

### Enforcement and role integration

- The Customer, Seller, Logistics, and Courier authentication owners decide where their approved matrix is checked: registration completion, login/session restoration, protected-feature entry, or more than one.
- A missing required acceptance returns a stable machine-readable `POLICY_CONSENT_REQUIRED` result with the required policy/version list and a linkable read path; it must not look like invalid credentials.
- A gate must still permit the user to fetch and read the required policy and submit acceptance. Do not create a redirect loop that prevents consent.
- Authenticated acceptance requires the role/status/affiliation checks of the owning auth contract. A suspended, deactivated, wrong-role, or orphaned account cannot accept on behalf of another identity.
- Admin policy management remains separate. Admins may publish a version without this feature silently changing every role's login behavior.
- Courier integration is API-only in this repository. The external Flutter client receives the same documented contract and implements its own policy screens and retry states.

### Security, privacy, and concurrency

- Apply `auth:sanctum` and role authorization to personalized status/acceptance routes; public reads remain limited to allow-listed policy types.
- Do not expose Admin author IDs, reviewer notes, draft content, raw database paths, tokens, or unrelated user/profile data in policy DTOs.
- Validate type and version server-side, use route model lookup scoped to the policy identity, and fail closed for cross-policy or unavailable versions.
- Re-read and lock the current policy/version when accepting so a publication race returns a conflict or the newly required version; it must not accept a stale target silently.
- Concurrent or repeated acceptance requests for the same User/version return one canonical result and create no duplicate row, notification, or audit event.
- Sanitize content at the rendering boundary and add a Content Security Policy compatible with the host app where applicable. Never interpolate policy Markdown as trusted HTML without an approved sanitizer.
- Rate-limit public reads and acceptance attempts. Do not log policy content, credentials, bearer tokens, or sensitive profile data.

### API contract

- **Implemented public current read:** `GET /api/v1/platform/policies/{type}`; no authentication; `type` is `terms_of_service` or `privacy_policy`; `200` returns the current safe version, `404` means no public current version, and `429` is retryable.
- **Implemented public history list:** `GET /api/v1/platform/policies/{type}/history`; no authentication; `200` lists published/superseded safe summaries, excluding content and Drafts.
- **Implemented public history entry:** `GET /api/v1/platform/policies/{type}/history/{version}`; no authentication; `200` returns the exact historical content, `404` covers an unavailable type/version.
- **Conceptual until approved:** `GET /api/v1/policy-consent/status`; requires `auth:sanctum` plus the caller's role guard; returns required current versions, each exact acceptance state, and `all_required_accepted`.
- **Conceptual until approved:** `POST /api/v1/policy-consent/{type}/versions/{version}/accept`; requires the same guard; body is `{ "confirmation": true }` only. The server derives User, policy, version, and timestamp.
- Acceptance returns the canonical policy/version and acceptance timestamp. A same-version retry returns the existing result; invalid confirmation is `422`, unauthenticated is `401`, unauthorized audience is `403`, stale/unavailable version is `409` or `404` per the owning auth contract, and throttling is `429` with `Retry-After`.
- Clients must not call conceptual routes until an owning auth/registration spec marks them implemented. Do not guess route names or treat `requires_reconsent` as an available endpoint.

### Client behavior

- Webapp and dashboards provide a visible Terms/Privacy link, latest-version page, separate history list, exact historical page, loading, empty, not-found, offline, retry, and safe-rendering states.
- Public pages use semantic headings, keyboard-accessible history links, visible focus, readable contrast, stable URLs, and SSR/metadata where the host app's design contract allows it.
- A consent prompt shows the complete current policy, exact version, change summary when available, an unchecked explicit confirmation, and a link to history. No optimistic success is shown before the API response.
- Preserve a user's location and non-secret form state across a recoverable read/acceptance error, but never store tokens or trusted consent in browser storage.
- Flutter implements the same loading, success, validation, unauthorized, forbidden, conflict, rate-limit, timeout, and offline states using secure token handling; no Flutter code is added under this repository.

### Acceptance criteria

- [x] Public current Terms/Privacy reads return only the current published version and reject Internal Rules.
- [x] Public history lists and exact-version reads exclude Drafts and preserve published/superseded content.
- [x] The existing schema records immutable exact User/version/timestamp acceptance rows with a uniqueness guard.
- [x] A cross-role policy matrix names required policies, audiences, initial acceptance, re-consent, and blocking points.
- [x] A consent-status endpoint returns server-derived required versions and exact acceptance state without shared caching.
- [x] Acceptance validates an explicit confirmation, authorizes the current published version, is idempotent, and never accepts on behalf of another User.
- [x] Customer, Seller, Logistics, and Courier auth/session owners integrate the approved gate without preventing policy viewing or acceptance.
- [x] Webapp, dashboards, and the external Flutter client expose accessible latest/history/consent states and safe retry behavior.
- [x] Tests cover public visibility, XSS-safe rendering, stale publication races, duplicate acceptance, role isolation, no-store personalized responses, and gate recovery.

## HOW

- Reuse `PlatformPolicy`, `PlatformPolicyVersion`, `PolicyAcceptance`, `PlatformContentController`, existing public resources, and the current policy cache keys. Do not duplicate Admin CRUD or introduce a second policy table.
- Add a shared `PolicyConsentService`, status/acceptance resources, Form Request, and controller only after the matrix is approved. Keep role-specific middleware and auth integrations in their owning namespaces.
- Use a transaction with a unique User/version guard for acceptance; use row locks or an equivalent conflict check when resolving the current version. Add a migration only for an approved missing field; existing acceptance storage is sufficient for post-registration consent.
- Keep public current/history reads cacheable by policy type and keep status/acceptance responses private. Invalidate current-policy cache after Admin publication commits.
- Add integration tests for each role's authorization and gate, then UI tests for latest/history/consent states. Add Flutter contract tests in the external project against the recorded backend API version.
- Roll out in two phases: public viewing first; consent status/acceptance and auth enforcement only after the matrix, audience, status code, and owning integration points are signed off.

### Open questions

- Which of Terms, Privacy, and Internal Rules require initial acceptance for each role?
- Does a published `requires_reconsent` version block at registration, login/session restoration, protected-action entry, or multiple points?
- Are Terms and Privacy public for guests in every environment, and which roles may ever read Internal Rules?
- Which owning feature maintains the consent-status/acceptance endpoints and gate response status codes?
- Should policy change summaries trigger an in-app, email, or push notice, and what retention applies?
- Which webapp/dashboard routes and Flutter navigation entry point host policy pages?

### References

- Project contracts: `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Admin.md`, `docs/domains/Buyer.md`, `docs/features/admin/manage-platform-settings/spec.md`, and the role auth specifications.
- Current implementation: `src/api/app/Http/Controllers/PlatformContentController.php`, `src/api/routes/api.php`, policy resources/models, migration `2026_08_30_000126_create_platform_settings_tables.php`, and `PlatformSettingsTest`.
- [Laravel Sanctum](https://laravel.com/docs/12.x/sanctum)
- [Laravel controller middleware](https://laravel.com/framework/docs/12.x/controllers)
- [Laravel database transactions](https://laravel.com/framework/docs/12.x/database)
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
