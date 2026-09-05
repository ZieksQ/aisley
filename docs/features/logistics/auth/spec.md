---
feature: logistics-auth
title: Logistics Authentication
system: AISLEY
type: Feature Specification
version: 1.1
status: Draft — pending Logistics schema and subscription decisions
role: Logistics
scope: Logistics Web Application and Laravel API
---

# Logistics Authentication

## WHAT

- **Purpose:** Let one authorized Logistics organization account register, obtain Admin approval, and securely use the Logistics dashboard.
- **Actors:** Logistics applicant, approved active Logistics account, and authorized Admin reviewer.
- **Boundary:** React/TypeScript in `src/logistics` owns forms, loading states, and route guards; Laravel owns identity, validation, approval gating, sessions, and authorization.
- **Registration fields:** Last name, first name, optional middle initial, sex, email, contact number, birth date, server-computed age, operational hub address, business name, government ID, and business/DTI permit.
- **MVP organization scope:** Each Logistics organization owns exactly one operational hub/sorting center. The registration field labelled **Operational hub/sorting-center address** represents that sole hub; no separate hub, sub-hub, or additional-hub address is collected.
- **MVP account scope:** One Logistics account operates the organization and its hub through the Logistics dashboard. Staff or dispatcher sub-accounts are deferred and must not be implied by this feature.
- **Canonical identity:** A persisted account resolved by normalized `email + logistics`; a same-email Customer, Seller, Admin, or Courier remains a separate account.
- **Current status:** Logistics authentication is planned, not implemented. Product and workflow documents define Logistics as a role, but the current schema still has four role values and no Logistics profile, organization, hub, or subscription tables.
- **Core lifecycle:**

```text
register → PENDING → Admin APPROVED → ACTIVE → sign in → Logistics Dashboard
                   ↘ REJECTED → no dashboard access
ACTIVE → SUSPENDED/DEACTIVATED → protected access denied
```

- **Owned flows:** Registration, login, session restoration, role/status gating, logout, and role-scoped password recovery.
- **API namespace:** `/api/v1/logistics/auth/*`.
- **Boundaries:** Admin Manage Account Registrations owns approval/rejection; Logistics operations own parcels, transfers, dispatch, and Courier assignment; Courier authentication and mobile work remain separate.
- **Non-goals:** Parcel operations, sorting/waybill workflows, multi-hub or sub-hub management, staff/sub-account management, Courier approval UI, subscription billing, social login, passkeys, MFA, or a Logistics mobile UI.

## MUST

### Role and organization prerequisites

- Treat Logistics as a planned fifth role in the shared user model. Before enabling this feature, approve additive migrations for the role, organization/profile, sole hub relationship, and subscription references.
- Store enum-like columns as strings in PostgreSQL migrations and use PHP enum casts in the API layer; do not use native PostgreSQL enum columns.
- The API derives `role = logistics`. Client-supplied role, status, reviewer, approval, organization, hub, or subscription fields are rejected.
- Normalize email before lookup and enforce uniqueness by `email + logistics`; never let a same-email account in another role inherit Logistics access.
- The approved organization relationship must enforce one Logistics account and exactly one operational hub in the MVP. Do not add staff credentials, sub-hub selectors, or second-hub creation to this feature.

### Registration

- Validate all personal fields, business name, email, password, and password confirmation server-side.
- Calculate age from `birth_date` on the server. The UI may display it, but the client cannot submit or make age authoritative.
- Label the address field **Operational hub/sorting-center address**. Use cascading Region → Province → City/Municipality → Barangay controls backed by the bundled Q2 2026 PSGC JSON data in `packages/psgc-address-data/data`.
- Keep street/building and other address details editable. The current Address schema's required fields and any Logistics-specific postal/contact mapping must be reconciled before implementation; country is server-owned as Philippines.
- Laravel owns submitted address names and validates hierarchy ownership. PSGC codes are lookup-only, provider identifiers are not persisted, and lookup failure must leave a complete manual fallback.
- Registration address lookup must use Aisley routes or the approved local data source only; it must not make a third-party request or require a provider token.
- Include government ID and business/DTI permit evidence. Requiredness follows the registration reference once its Logistics indicators are finalized.
- For image evidence, apply `docs/references/file-upload-requirements.md`: JPEG/JPG, PNG, or WebP, strictly under 10 MiB, decoded/signature-checked, privately stored, and never exposed by raw path. A PDF permit requires a separate approved policy.
- Persist the User, Logistics profile/organization, sole hub address, pending Registration Application, and evidence metadata transactionally. Store bytes on the configured private filesystem and remove orphaned blobs if persistence fails.
- Registration creates only a pending account/application. It must never authenticate or self-approve the applicant.
- Duplicate or concurrent submissions must not create multiple Logistics accounts, organizations, hubs, applications, or evidence records; return stable field-addressable errors.

### Approval and access gating

- Admin Manage Account Registrations is the authoritative approval boundary. Approval updates the existing application/account and does not create a duplicate.
- Approval transitions the application to `approved` and the account to `active`; rejection records the Admin reason and leaves dashboard access denied.
- Only `role = logistics` with `status = active` may establish or retain ordinary Logistics access.
- Pending, rejected, suspended, deactivated, wrong-role, or otherwise unauthorized accounts are denied server-side even with a correct password.
- Use stable state errors such as `ACCOUNT_PENDING_APPROVAL`, `ACCOUNT_REJECTED`, `ACCOUNT_SUSPENDED`, and `ACCOUNT_INACTIVE` without exposing unrelated accounts or private Admin notes.
- Extend the existing Admin registration API, permissions, audit, and notification flow to recognize Logistics; do not create a parallel review workflow.

### Stateful web authentication

- Use Sanctum stateful HttpOnly session cookies for the Logistics React dashboard; browser JavaScript must not store Bearer tokens.
- Initialize CSRF with `GET /sanctum/csrf-cookie`, then submit credentials to `POST /api/v1/logistics/auth/login`.
- Login resolves normalized email plus the Logistics role, verifies the framework hash, checks active status, authenticates the web guard, and regenerates the session.
- Unknown email, wrong password, and an email existing only under another role return one generic credential failure. Rate-limit by normalized email and IP and return `429` with `Retry-After` when exhausted.
- Successful login returns a minimal safe Logistics DTO and routes to `/dashboard` (or the final agreed route). Exclude hashes, session values, reset tokens, evidence, raw storage paths, and private review notes.

### API surface

- `POST /api/v1/logistics/auth/register` accepts the validated profile, sole-hub address, and multipart evidence and returns a safe pending-application summary; it never returns an authenticated session.
- `POST /api/v1/logistics/auth/login` returns the safe Logistics identity only after the account is approved and active.
- `GET /api/v1/logistics/auth/me` returns the current authenticated identity; `POST /api/v1/logistics/auth/logout` invalidates the server session.
- `POST /api/v1/logistics/auth/forgot-password` and `POST /api/v1/logistics/auth/reset-password` use the existing role-scoped, generic password-recovery contract.
- All responses use versioned routes, safe DTOs, field-addressable validation errors, and ownership-safe not-found/forbidden behavior.

### Session, recovery, and subscription boundaries

- Keep startup in `CHECKING` until `GET /api/v1/logistics/auth/me` resolves through `auth:sanctum` and Logistics-active middleware. Recheck role and status on every protected request.
- Logout invalidates the backend session and regenerates CSRF; clearing React state alone is insufficient. Invalid sessions redirect protected routes to `/login`.
- Forgot-password responses must not reveal account existence. Reset tokens are hashed, Logistics-scoped, expiring, single-use, rate-limited, and deleted after success; reset does not change approval status.
- Authentication proves identity and active status. Subscription plans, billing, renewal, the ₱10 per-order charge, and operational enforcement belong to a separate Subscription feature. Approval is not subscription.

### Acceptance criteria

- [ ] Valid registration creates one pending Logistics account, organization, sole hub address, application, and submitted evidence records with server-derived role and age.
- [ ] The sole-hub address, local PSGC lookup/fallback, evidence policy, and ownership/status fields are enforced without trusting client authority.
- [ ] Retries or concurrent requests cannot create duplicate organization accounts, hubs, applications, or evidence.
- [ ] Admin approval/rejection updates the existing records and sends the configured notification.
- [ ] Only an approved active Logistics account can establish a dashboard session; same-email accounts in other roles cannot authenticate into it.
- [ ] CSRF, session regeneration, HttpOnly cookies, generic credential errors, login throttling, `me`, logout, and role-isolated password recovery work as specified.
- [ ] Private registration evidence cannot be fetched without authorization or exposed through DTOs.

## HOW

- Add Logistics-namespaced Form Requests, controller, resource, middleware, notification/configuration, service, and routes beside the existing Customer, Seller, and Admin auth groups after the schema decisions.
- Reuse `users`, `registration_applications`, `documents`, `addresses`, Sanctum sessions, password-reset, private-storage, and Admin registration-review patterns; add only new migrations for approved Logistics entities.
- Build the future `src/logistics` React dashboard with one credentialed API client, auth provider, checking/guest/authenticated states, protected layout, and accessible registration/login/recovery forms. Courier remains external and mobile-only.
- Reuse `@aisley/psgc-address-data` and the existing Aisley address-option contract. Do not call a provider inside registration or its database transaction.
- Test rollback, duplicates, one-account/one-hub invariants, role isolation, age calculation, address validation/fallback, evidence validation/authorization, every account status, Admin handoff, CSRF, session fixation, logout, throttling, and reset-token isolation.
- Roll out only after the Logistics role/profile/organization/hub schema, Admin review integration, evidence requiredness/file types, private storage, stateful-domain settings, and subscription enforcement policy are approved.
- **Open decisions:** exact organization/profile/hub tables and duplicate-organization rule; mapping of required Address columns to the Logistics form; evidence requiredness and permit file types; email verification and remember-me policy; session revocation after reset; final dashboard route; subscription provider/enforcement; and notification wording.

### References

- Project: `docs/requirements.md`, `docs/workspace.md`, `docs/architecture.md`, `docs/schema.md`, `docs/domains/Logistics.md`, and `docs/references/user-registration-requirements.md`.
- Shared upload policy: `docs/references/file-upload-requirements.md`.
- [Laravel 13 Sanctum SPA authentication](https://laravel.com/framework/docs/13.x/sanctum#spa-authentication)
- [Laravel 13 authentication](https://laravel.com/framework/docs/13.x/authentication)
- [Laravel 13 password reset](https://laravel.com/framework/docs/13.x/passwords)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
