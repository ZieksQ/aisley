---
feature: logistics-auth
title: Logistics Authentication
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft — pending Logistics role/schema decision
role: Logistics
scope: Logistics Web Application and Laravel API
---

# Logistics Authentication

## WHAT

- **Purpose:** Let an authorized Logistics company representative register, obtain Admin approval, and securely use the Logistics dashboard.
- **Actors:** Logistics applicant, approved Logistics account, and authorized Admin reviewer.
- **Boundary:** React/TypeScript owns forms, loading states, and route guards; Laravel owns identity, validation, approval gating, sessions, and authorization.
- **Source registration fields:** Last name, first name, optional middle initial, sex, email, contact number, birth date, computed age, Philippine address, business name, government ID, and business/DTI permit.
- **Canonical identity:** a persisted account resolved by normalized `email + logistics` once the Logistics role is approved for the shared user model.
- **Current status:** Logistics authentication is planned, not implemented. The current schema supports four roles and has no Logistics role/profile/company tables; that role decision must be settled before implementation.
- **Core lifecycle:**

```text
register → PENDING → Admin APPROVED → ACTIVE → sign in → Logistics Dashboard
                   ↘ REJECTED → no dashboard access
ACTIVE → SUSPENDED/DEACTIVATED → protected access denied
```

- **Owned flows:** registration, login, session restoration, role/status gating, logout, and role-scoped password recovery.
- **Recommended API namespace:** `/api/v1/logistics/auth/*`.
- **Boundaries:** Admin Manage Account Registrations owns approval/rejection; Logistics operations own parcels, transfers, dispatch, and courier assignment; Courier authentication and mobile work remain separate.
- **Non-goals:** Logistics parcel operations, hub/sorting-center design, Courier approval UI, subscription billing, staff/sub-account design, social login, passkeys, MFA, or a Logistics mobile UI.

## MUST

### Identity and prerequisite decision

- Resolve the four-role versus five-role conflict before adding Logistics authentication or ownership relationships.
- If approved, add `logistics` as a string-backed role value with a PHP enum cast, a Logistics profile/organization relationship, and the required registration-application support. Do not use a database-native PostgreSQL enum.
- The API must derive the Logistics role. Client-supplied `role`, `status`, reviewer, approval, organization, or subscription fields are prohibited.
- Normalize email before lookup and enforce uniqueness by `email + logistics`; a same-email Customer, Seller, Admin, or Courier remains isolated.

### Registration

- Registration must validate the listed personal fields, business name, email, password, and password confirmation server-side.
- Age is calculated from `birth_date` on the server and may be displayed by the UI; it is never accepted or stored as authoritative client input.
- Address fields must follow the repository PSGC flow: Region → Province → City/Municipality → Barangay, with editable street/house details and a complete manual fallback. Use the existing address model rules, including any required postal/contact fields, after the source requirements are reconciled.
- Address lookup is assistive only. Laravel owns the submitted address; registration must not depend on a third-party geocoder or persist provider identifiers.
- The form must include government ID and business/DTI permit evidence. Whether each item is mandatory is still open because the registration reference does not mark them with required indicators.
- If evidence is uploaded as images, apply `docs/references/file-upload-requirements.md`: JPEG/JPG, PNG, or WebP, strictly under 10 MiB, decoded and signature-checked, privately stored, and never exposed by raw path. A PDF permit requires a separate approved document policy.
- Persist the account/profile, registration application, address, and evidence metadata transactionally. Store bytes on the configured private filesystem and clean up blobs if persistence fails.
- Create only a pending Logistics account/application. Registration must never authenticate or self-approve the applicant.
- Duplicate and concurrent submissions must produce one Logistics role-account/application and a stable field-addressable error.

### Approval and access gating

- Admin approval is the authoritative transition from `PENDING` to `APPROVED`; approval activates the existing account rather than creating a duplicate.
- Rejection records the Admin decision and reason, leaves the account unable to use the dashboard, and must not silently reactivate it.
- Only `role = logistics` and `status = active` may establish or retain ordinary Logistics access.
- Pending, rejected, suspended, deactivated, blocked, or wrong-role accounts must be denied server-side even when the password is correct.
- Use stable state errors such as `ACCOUNT_PENDING_APPROVAL`, `ACCOUNT_REJECTED`, `ACCOUNT_SUSPENDED`, and `ACCOUNT_INACTIVE` without exposing unrelated accounts or private Admin notes.
- Admin registration APIs and notifications must be extended to recognize Logistics before this feature is enabled; this spec does not create a parallel review workflow.

### Stateful web authentication

- The Logistics dashboard must use Sanctum stateful HttpOnly session cookies; browser JavaScript must not store Bearer tokens.
- Before credential-changing requests, initialize CSRF with `GET /sanctum/csrf-cookie`; submit credentials to `POST /api/v1/logistics/auth/login`.
- Login resolves normalized email plus the persisted Logistics role, verifies the framework hash, checks active status, authenticates the web guard, and regenerates the session.
- Unknown email, wrong password, and an email existing only under another role must use a generic credential failure.
- Rate-limit login by normalized email and IP; return `429` with `Retry-After` when exhausted.
- Successful login returns a minimal safe Logistics DTO and routes the dashboard to `/dashboard` (or the final agreed route).
- The DTO may include ID, display name, email when required, role, status, business name, and a separately defined subscription-state summary. It must exclude hashes, session values, reset tokens, evidence, raw storage paths, and private review notes.

### Session lifecycle and recovery

- App startup remains in `CHECKING` until `GET /api/v1/logistics/auth/me` resolves through `auth:sanctum` and Logistics-active middleware.
- `me` must recheck role and account status so a newly suspended/deactivated account cannot continue through an old cookie.
- `POST /api/v1/logistics/auth/logout` must invalidate the backend session and regenerate the CSRF token; clearing React state alone is not logout.
- Expired or invalid sessions clear client state and redirect protected dashboard routes to `/login`.
- Forgot-password responses must not reveal whether a Logistics account exists. Reset tokens are hashed, role-scoped to Logistics, expiring, single-use, rate-limited, and deleted after success.
- Password reset must not change approval status and must revoke applicable personal access tokens if a future Logistics client uses them.

### Subscription boundary

- Authentication proves identity and active account status; a future Logistics Subscription feature owns plans, billing, renewal, and the ₱10 per-order platform charge.
- If an active subscription is required for operations, expose its state and redirect to subscription setup after login; do not embed billing rules in authentication until the provider and enforcement policy are approved.

### Acceptance criteria

- [ ] Valid registration creates one pending Logistics account/application with server-derived role and age.
- [ ] Required personal, business, address, and approved evidence rules are enforced without trusting client ownership/status fields.
- [ ] Duplicate/retried registration cannot create duplicate accounts, applications, or stored evidence.
- [ ] Admin approval/rejection updates the existing application/account and sends the configured notification.
- [ ] Only an approved active Logistics account can establish a dashboard session.
- [ ] Same-email accounts under other roles cannot authenticate into Logistics.
- [ ] CSRF, session regeneration, HttpOnly cookies, generic credential errors, and login throttling are enforced.
- [ ] `me` rejects wrong-role, expired, suspended, rejected, and deactivated sessions.
- [ ] Logout invalidates the backend session; later protected requests fail.
- [ ] Password recovery is generic, role-isolated, expiring, single-use, and rate-limited.
- [ ] Private registration evidence cannot be fetched without authorization or exposed through DTOs.

## HOW

- Add Logistics-namespaced Form Requests, controller, resource, middleware, notification/configuration, and API routes beside the existing Customer, Seller, and Admin auth groups after the role decision.
- Reuse the existing `users`, `registration_applications`, `documents`, `addresses`, Sanctum `sessions`, and password-reset patterns; add only additive migrations for the approved Logistics profile/organization model.
- Keep shared identity and enum-like database columns string-backed with PHP enum casts. Scope future Courier ownership and Logistics resources through the approved organization relationship, not a client-supplied ID.
- Build the future `src/logistics` React dashboard with one credentialed API client, auth provider, checking/guest/authenticated states, protected route layout, status-specific errors, and accessible registration/login/recovery forms. Courier remains mobile-only.
- Reuse the bundled PSGC address data and existing address-option contract; do not call a provider inside the registration transaction.
- Use the configured private filesystem and the shared file-upload policy for evidence. Log only safe result categories, owner/application IDs, and request IDs—not passwords, tokens, cookies, or document contents.
- Test registration rollback/duplicates, role isolation, age calculation, address validation, evidence validation/authorization, every account status, Admin decision handoff, CSRF, session fixation, `me`, logout, throttling, and reset-token isolation.
- Roll out only after the role/schema decision, Admin Logistics review support, private storage, stateful-domain/CORS settings, and subscription gate policy are approved.
- **Open decisions:** one Logistics company account versus staff/sub-accounts; one versus multiple hubs; exact Logistics profile/organization tables; evidence requiredness and permit file type; email verification; session/remember-me policy; web-session revocation after reset; final dashboard route; subscription enforcement; and whether Logistics needs a future mobile client.

### References

- Project: `docs/requirements.md`, `docs/workspace.md`, `docs/architecture.md`, `docs/schema.md`, `docs/domains/Logistics.md`, and `docs/references/user-registration-requirements.md`.
- Shared upload policy: `docs/references/file-upload-requirements.md`.
- [Laravel 13 Sanctum SPA authentication](https://laravel.com/framework/docs/13.x/sanctum#spa-authentication)
- [Laravel 13 authentication](https://laravel.com/framework/docs/13.x/authentication)
- [Laravel 13 password reset](https://laravel.com/framework/docs/13.x/passwords)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
