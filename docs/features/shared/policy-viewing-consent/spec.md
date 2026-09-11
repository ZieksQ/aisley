---
feature: policy-viewing-consent
title: Platform Policy Viewing and Version-Specific Consent
system: AISLEY
type: Feature Specification
version: 1.4
status: Phase 3 implemented — one shared public Terms/Privacy policy with authenticated consent status/acceptance, role-owned consent screens, and protected-access enforcement
roles: Guest, Customer, Seller, Admin, Logistics, Courier
scope: Laravel API, Customer storefront, role dashboards, and external Courier Flutter client
canonical: true
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/*, Admin Manage Platform Settings, role auth specs
---

# Platform Policy Viewing and Version-Specific Consent

## WHAT

- **Purpose:** Let people read one platform-wide Terms of Service and one platform-wide Privacy Policy, inspect their published history, and let authenticated account holders record explicit acceptance of the shared versions.
- **Ownership:** Admin Manage Platform Settings authors, versions, publishes, and preserves policy content. This feature consumes those published records and owns user-facing reads, acceptance status, and integration contracts; it does not edit policy text.
- **Current baseline:** Laravel exposes public current/history reads for Terms and Privacy, private status/acceptance routes for authenticated account roles, and a protected-action gate for all role APIs. The webapp provides current/history/exact-version and Customer consent pages, and Seller/Admin/Logistics dashboards provide role-owned consent pages plus public links. `policy_acceptances` stores immutable user/version/timestamp rows. Authenticated users may sign in and reach their role-owned consent screen, but protected feature APIs and dashboard routes remain unavailable until the required versions are accepted.
- **Audience:** Guests may read the same public Terms and Privacy. Every account role—Customer, Seller, Admin, Logistics, and Courier—uses the same current version for each policy; there are no role-specific or tenant-specific variants in the MVP. Internal Platform Rules remain Admin-only and are not part of the shared user policy set.
- **Product rule:** Each shared policy has one stable policy identity and one integer version stream. Ordinary views show the same current published version to every audience; history is a separate view.
- **Non-goals:** Admin policy authoring, legal advice, automatic acceptance, editing published rows, Internal Rules publication, subscription consent, marketing preferences, email/push delivery, or a Courier web UI.

```text
public current policy/history read
→ every audience reads the same shared Terms/Privacy version
→ the shared consent matrix marks initial acceptance required for all five account roles
→ authenticated client checks consent status
→ client explicitly accepts the exact current version
→ server stores immutable acceptance and the owning role UI or Courier Flutter client presents the action
→ protected API/dashboard access returns POLICY_CONSENT_REQUIRED until all required versions are accepted
```

## MUST

### Published policy catalogue

- Use the existing `PlatformPolicyType` allow-list: `terms_of_service`, `privacy_policy`, and `internal_rules`.
- Maintain exactly one platform-wide `platform_policies` identity and version stream for `terms_of_service` and exactly one for `privacy_policy`. The current version is the same for every Customer, Seller, Admin, Logistics, Courier, and guest public read.
- Do not create role-specific, organization-specific, regional, or tenant-specific Terms/Privacy versions in the MVP. A future variant requires an explicit policy/schema decision and an additive contract.
- Public routes may expose only Terms and Privacy. A public Internal Rules request returns the same not-found behavior as an unknown public policy type.
- Return only a current `published` version from the ordinary policy read. Never fall back to a Draft, Superseded version, or unpublished policy.
- The current response contains policy type/label and a safe version projection: ID, version, title, content, status, change summary, re-consent flag, and publication time.
- A history response lists only `published` and `superseded` versions. It must not expose Drafts, Admin identities, revision counters, internal notes, or audit data.
- An exact history read returns the selected published/superseded content and metadata. It never changes the current pointer or creates consent.
- Preserve the exact stored policy content when rendering. Treat content as plain text or approved sanitized Markdown; never execute arbitrary HTML, scripts, or client components.
- Public policy responses may be cached briefly by policy type. Consent status and acceptance responses are user-specific and must be `private, no-store` or equivalent.

### Consent matrix and acceptance

- The consent matrix applies to the two shared Terms/Privacy identities. The current implementation requires initial acceptance from Customer, Seller, Admin, Logistics, and Courier accounts, but it does not create role-specific policy content or version streams.
- A current version marked `requires_reconsent` is required again for every role that has not accepted that exact version. A current version without that flag is covered by a prior acceptance.
- Status, acceptance, and protected-action enforcement are implemented. Login, session restoration, logout, and the consent status/acceptance routes remain available so an authenticated user can reach and complete consent.
- `requires_reconsent` describes a specific published successor. It does not by itself decide whether initial acceptance is mandatory or which role must accept it.
- Publication does not block registration, sign-in, or session restoration. After authentication, protected API actions and dashboard route entry are blocked until the user accepts every required current version from the role-owned consent screen.
- The server derives the accepting User from the authenticated session. The client may not submit `user_id`, role, policy identity, acceptance time, or an approval decision.
- Accept only the authorized current `published` version selected by the server. Draft and Superseded versions are read-only and cannot be accepted through the normal endpoint.
- Store one immutable `policy_acceptances` row containing the User, exact `platform_policy_version_id`, and server `accepted_at`. The unique User/version constraint makes a retry idempotent.
- A publication never auto-accepts users and never rewrites, deletes, or backdates an existing acceptance. A later version creates a separate acceptance row when required.
- All authenticated account roles are evaluated against the same current shared policy versions. Guests can read public policies but cannot create a `policy_acceptances` row without an identified User.
- If registration must be blocked before a User exists, the owning registration spec must define a separate applicant acceptance record; do not misuse `policy_acceptances.user_id`.
- Acceptance succeeds only after the database commit. A notification, cache, or client refresh failure cannot undo the committed record.
- A consent-status projection compares each required current version with that User's exact acceptance. It returns no private data for another User and is never shared-cached.

### Enforcement and role integration

- The Customer, Seller, Admin, Logistics, and Courier authentication owners enforce the gate at protected-feature entry. Role differences affect only the route guard and UX; every role uses the same policy content and current version. Registration, sign-in, session restoration, logout, policy status, and policy acceptance remain available.
- A missing required acceptance is represented by `required: true` and `all_required_accepted: false` in the private status projection. Protected API routes return HTTP `403` with the stable machine-readable `POLICY_CONSENT_REQUIRED` code, required policy/version descriptors, and linkable read/status/accept paths; it must not look like invalid credentials.
- A gate must still permit the user to fetch and read the required policy and submit acceptance. Do not create a redirect loop that prevents consent.
- Authenticated acceptance requires the role/status/affiliation checks of the owning auth contract. A suspended, deactivated, wrong-role, or orphaned account cannot accept on behalf of another identity.
- Admin policy management remains separate from authoring/versioning. An Admin must still accept the current shared policies before using protected Platform Settings actions; publishing a successor does not silently accept it for any role.
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
- **Implemented status:** `GET /api/v1/policy-consent/status`; requires `auth:sanctum` plus the active account-role/Logistics-affiliation guard; returns the same shared current Terms/Privacy versions, each exact acceptance state, and `all_required_accepted` with `Cache-Control: private, no-store`.
- **Implemented acceptance:** `POST /api/v1/policy-consent/{type}/versions/{version}/accept`; `type` can target only a shared Terms/Privacy identity; requires the same active-role/affiliation guard but is exempt from the consent gate; body is `{ "confirmation": true }` only. The server derives User, policy, version, and timestamp and returns the canonical accepted version with `Cache-Control: private, no-store`.
- Acceptance returns the canonical policy/version and acceptance timestamp. A same-version retry returns the existing result; invalid confirmation is `422`, unauthenticated is `401`, unauthorized audience is `403`, stale/unavailable version is `409` or `404` per the owning auth contract, and throttling is `429` with `Retry-After`.
- Protected role APIs and feature actions use `auth:sanctum`, their existing role/status/affiliation middleware, and `policy.consent`. When consent is missing they return `403 POLICY_CONSENT_REQUIRED` with `data.required_policies`, each current version, `read_url`, `accept_url`, and `status_url`; the response is private and non-cacheable.
- Clients may call the implemented routes after authentication. A stale or unavailable version returns `409` with `POLICY_VERSION_STALE`; clients should refresh status/current content and let the user retry. Do not treat `requires_reconsent` as a separate endpoint.

### Client behavior

- Webapp and dashboards provide a visible Terms/Privacy link to the same platform-wide documents, latest-version page, separate history list, exact historical page, loading, empty, not-found, offline/error, retry, and safe-rendering states. Public policy pages remain available without authentication. Authenticated Customer, Seller, Admin, and Logistics route guards check consent before rendering protected screens and route missing consent to the role-owned consent screen.
- Public pages use semantic headings, keyboard-accessible history links, visible focus, readable contrast, stable URLs, and SSR/metadata where the host app's design contract allows it.
- A consent prompt shows the complete current policy, exact version, change summary when available, an unchecked explicit confirmation, and a link to history. No optimistic success is shown before the API response.
- Customer uses `/account/policy-consent`; Seller, Admin, and Logistics use their own dashboard `/policy-consent` route. Each screen calls the same authenticated API and links to the webapp's canonical public history. Courier has no web UI and consumes the same contract from Flutter.
- Preserve a user's location and non-secret form state across a recoverable read/acceptance error, but never store tokens or trusted consent in browser storage.
- Flutter implements the same shared Terms/Privacy content and loading, success, validation, unauthorized, forbidden, conflict, rate-limit, timeout, and offline states using secure token handling; no Flutter code is added under this repository.

### Acceptance criteria

- [x] Public current Terms/Privacy reads return only the current published version and reject Internal Rules.
- [x] Public history lists and exact-version reads exclude Drafts and preserve published/superseded content.
- [x] The existing schema records immutable exact User/version/timestamp acceptance rows with a uniqueness guard.
- [x] One platform-wide Terms of Service and one platform-wide Privacy Policy are shared by every account role; no role-specific or tenant-specific public variants are exposed.
- [x] The consent matrix requires initial acceptance for Customer, Seller, Admin, Logistics, and Courier and requires flagged re-consent for the exact current version.
- [x] A consent-status endpoint returns the same shared current versions plus server-derived required/accepted state without shared caching.
- [x] Acceptance validates an explicit confirmation, authorizes a shared current published version, is idempotent, and never accepts on behalf of another User.
- [x] Customer, Seller, Admin, Logistics, and Courier protected-action owners enforce a shared-policy gate without preventing login, session restoration, policy viewing, or acceptance; Courier receives the same API contract for its external Flutter client.
- [x] Webapp exposes accessible latest/history/exact-version pages and a Customer consent screen; Seller, Admin, and Logistics dashboards expose role-owned consent screens plus Terms/Privacy links to the webapp. Courier remains an external Flutter client.
- [x] Backend tests cover public visibility, cache headers, history filtering, exact-version reads, Internal Rules exclusion, protected-action denial, machine-readable gate details, and post-acceptance access.

## HOW

- Reuse `PlatformPolicy`, `PlatformPolicyVersion`, `PolicyAcceptance`, `PlatformContentController`, existing public resources, and the current policy cache keys. Do not duplicate Admin CRUD or introduce a second policy table.
- Phase 1 implementation adds cache-control headers to the public reads, server-rendered webapp routes under `/policies/{type}`, `/policies/{type}/history`, and `/policies/{type}/history/{version}`, plus dashboard links configured with `VITE_STOREFRONT_URL`.
- Use the shared `PolicyConsentService`, `AcceptPolicyRequest`, `PolicyConsentController`, `policy.actor`, and `policy.consent` middleware. Keep role-specific screens and route guards in their owning namespaces, while resolving every role against the same shared policy versions.
- Use a transaction with a unique User/version guard for acceptance; use row locks or an equivalent conflict check when resolving the current version. Add a migration only for an approved missing field; existing acceptance storage is sufficient for post-registration consent.
- Keep public current/history reads cacheable by policy type and keep status/acceptance responses private. Invalidate current-policy cache after Admin publication commits.
- Development bootstrap data lives in `src/api/database/seeders/data/platform-policies.json` and is loaded by `PlatformPolicySeeder`. It creates the published generic fixture versions listed for each allow-listed policy only when that policy has no existing versions, marks earlier fixture versions superseded, points each policy at its latest version, and preserves existing policy content and acceptance history on reruns. The fixture seeder is skipped in production.
- Add integration tests for role authorization and idempotent acceptance, then UI tests for latest/history/consent states. Add Flutter contract tests in the external project against the recorded backend API version.
- Roll out in three layers: public viewing, shared consent status/acceptance with role-owned screens, and protected-action enforcement. The API is authoritative; SPA route guards are a usability layer and cannot replace server checks. The external Courier Flutter client must consume the same `403 POLICY_CONSENT_REQUIRED` contract.

### Open questions

- **Resolved:** A published required version blocks protected API/dashboard access after authentication. Registration, login, session restoration, logout, policy status, and acceptance remain reachable so consent can be completed.
- Which authorized Admin audience, if any, may read or accept Internal Rules?
- **Resolved:** The shared policy middleware owns `POLICY_CONSENT_REQUIRED`; each role route group composes it after its existing Sanctum and active-role/affiliation middleware.
- Should policy change summaries trigger an in-app, email, or push notice, and what retention applies?
- The webapp owns public policy pages at `/policies/{type}` and its history routes; Seller, Admin, and Logistics dashboards link there. The Courier Flutter navigation entry point remains to be defined with the external client.

### References

- Project contracts: `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Admin.md`, `docs/domains/Buyer.md`, `docs/features/admin/manage-platform-settings/spec.md`, and the role auth specifications.
- Current implementation: `src/api/app/Http/Controllers/PlatformContentController.php`, `src/api/app/Http/Controllers/PolicyConsentController.php`, `src/api/app/Http/Middleware/Policy/EnsurePolicyConsent.php`, `src/api/app/Services/PolicyConsentService.php`, `src/api/routes/api.php`, policy resources/models, migration `2026_08_30_000126_create_platform_settings_tables.php`, and the shared policy feature tests.
- [Laravel Sanctum](https://laravel.com/docs/12.x/sanctum)
- [Laravel controller middleware](https://laravel.com/framework/docs/12.x/controllers)
- [Laravel database transactions](https://laravel.com/framework/docs/12.x/database)
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
