---
feature: customer-auth
title: Customer Authentication
system: AISLEY
type: Feature Specification
version: 1.2
status: Implemented foundation; registration requirements extensions deferred
role: Customer
scope: Customer storefront and Laravel API
---

# Customer Authentication

## WHAT

- **Purpose:** Register a Customer for Admin approval and provide role/status-gated sign-in, session restoration, logout, and password recovery.
- **Canonical identity:** `users.role = customer`; **Buyer** is the customer-facing storefront term and is not an alternate API/database role.
- **Current implementation:** Customer registration creates a pending User, CustomerProfile, and RegistrationApplication; web session and optional device-token login, `/me`, logout, password reset, throttling, middleware, resources, and storefront pages exist.
- Registration does not authenticate the applicant. Admin Manage Account Registrations remains the authority for approval/rejection; a valid password alone never activates access.
- **Reference gap:** `docs/references/user-registration-requirements.md` lists a Customer address and ID upload, but the current `RegisterRequest`/RegisterForm do not collect or persist them. Treat those fields as a required follow-up, not as already implemented. When approved, extend registration without weakening the shared file-upload policy.
- Customer Auth owns identity/session boundaries. Customer Account Management owns profile/photo/password changes after sign-in; Address Book owns reusable addresses; Customer Order Status and Checkout consume the active session.
- **Non-goals:** Admin review UI, Seller/Courier/Logistics authentication, social login, MFA, email verification policy, account deletion, profile-photo upload, or role switching.

```text
register profile + credentials
→ pending customer User/Application (no session)
→ Admin approves or rejects
→ active Customer may POST /login
→ web session or optional mobile token
→ GET /me / protected Customer APIs
→ logout or status change ends access
```

## MUST

### Canonical role and registration

- Force `UserRole::Customer` server-side. Prohibit client `role`, `status`, reviewer, approval, Customer ID, and ownership fields.
- Normalize email to lowercase/trimmed and enforce uniqueness within the Customer role. A same-email Seller/Admin/Courier account is a separate role record and must not authenticate here.
- Current registration fields are first/last name, optional middle name, contact number, sex, birth date, email, password, and confirmation. Validate Laravel's password rule and `birth_date < today`.
- Age is derived from the persisted birth date through the shared profile age accessor; never accept or persist a client-supplied age. The current registration form displays/submit birth date only; account resources may expose derived age.
- Create User (`pending`), CustomerProfile, and pending RegistrationApplication atomically. A duplicate retry must not create another Customer account/application.
- Return a pending-safe Customer DTO with `201`; do not issue a web session or token and do not expose password/hash/application notes.

### Registration address and evidence extension

- If the reference requirement is approved for Customer registration, use the existing Address contract: bundled PSGC Region → Province → City/Municipality → Barangay, manual street/postal fields, and optional confirmed coordinates. Do not use Mapbox; follow the Customer Address Book Geoapify/Leaflet pin flow.
- If an ID upload is added, submit it through an authenticated/authorized Laravel registration action using [`docs/references/file-upload-requirements.md`](../../../references/file-upload-requirements.md): JPEG/JPG/PNG/WebP, strictly under 10 MiB, server MIME/signature/decode checks, generated private storage key, and no raw path in DTOs.
- Evidence must attach to the Customer's pending RegistrationApplication, remain private, and be cleaned up if a transaction fails. Admin review decides verification; Customer Auth does not self-approve documents.
- Do not make address/evidence appear in the current API contract until the request fields, multipart handling, migrations/relations, review behavior, and tests are approved.

### Login and approval gating

- Resolve the Customer role-account by normalized email, verify the password with Laravel hashing, then enforce `status = active` before issuing credentials.
- Unknown email, wrong password, and another-role-only email return the same `422 INVALID_CREDENTIALS` shape. Do not disclose account existence or role.
- A valid password for `pending`, `rejected`, `suspended`, or another inactive state returns `403` with the stable account-state code and never issues a credential.
- Active web login uses the first-party Sanctum session: initialize CSRF, authenticate on the web guard, regenerate the session, and return a safe navigation DTO. If `device_name` is supplied, issue a scoped personal access token for the external mobile consumer instead of a web session.
- `/me` and logout require `auth:sanctum` plus `customer.active`; middleware verifies persisted role and status on every protected request. Logout invalidates the current web session or deletes the current personal access token.
- After the active Customer check, protected Customer APIs require current shared Terms of Service and Privacy Policy consent. `/me`, logout, policy status, and policy acceptance remain reachable so the Customer can complete consent.
- Forgot-password is generic and rate-limited. Reset tokens are hashed, Customer-role scoped, expiring, single-use, and revoke personal access tokens after a successful reset.

### Safety, privacy, and acceptance

- Customer resources derive ownership from the authenticated User. Private APIs must never accept a trusted role/Customer ID from the browser.
- Safe auth DTOs may include ID, display name, role, status, and approved avatar URL. They exclude email where the navigation contract does not need it, profile details, hashes, tokens, CSRF values, private evidence, and storage paths. `CustomerUserResource` currently carries a nullable legacy `profile_photo_path`; it must remain null/remove that field before any non-null photo is returned.
- Registration/admin notification delivery occurs after the database commit; a failed notification cannot undo the pending application.
- [x] Registration creates one pending Customer account/profile/application and no credential.
- [x] Client role/status injection and duplicate Customer email are rejected; same-email other roles remain isolated.
- [x] Active web and optional mobile login, `/me`, logout, approval-state errors, rate limits, and password reset are implemented and covered by API tests.
- [x] Protected Customer APIs fail closed for guests, wrong roles, and non-active accounts.
- [ ] Customer registration address and ID evidence from the shared reference are implemented and reviewed.
- [ ] Email verification, MFA, rejected-applicant resubmission, and complete session revocation policy are approved.

## HOW

### Current interfaces and implementation

- Public routes are `POST /api/v1/customer/auth/register`, `/login`, `/forgot-password`, and `/reset-password`.
- Active-session routes are `GET /api/v1/customer/auth/me` and `POST /api/v1/customer/auth/logout`, protected by `auth:sanctum` and `customer.active`.
- Laravel uses `Customer\AuthController`, `RegisterRequest`, `LoginRequest`, `ForgotPasswordRequest`, `ResetPasswordRequest`, `CustomerUserResource`, `CustomerNavigationResource`, and `EnsureActiveCustomer`.
- The current migration/model set uses UUID Users, CustomerProfiles, RegistrationApplications, role-scoped reset tokens, Sanctum tokens, and string-backed enum casts. Additive migrations are required for future evidence/address fields.
- The Webapp implements `/register`, `/login`, pending/rejected/forgot/reset screens, CSRF-aware API helpers, and the shared `AuthProvider`; it does not store a web bearer token in browser storage.

### Session and error contract

- `201` registration returns `Registration submitted for approval.` with pending Customer data.
- `200` web login returns a safe `customer` navigation object; mobile login additionally returns `token` only when `device_name` is requested.
- `403` account codes are `ACCOUNT_PENDING_APPROVAL`, `ACCOUNT_REJECTED`, `ACCOUNT_SUSPENDED`, or `ACCOUNT_INACTIVE`. `/me` returns `401` with no session and `403` for wrong role/status.
- Password-reset requests always acknowledge generically. Invalid, expired, reused, or cross-role tokens produce one `INVALID_RESET_TOKEN` validation error.
- Customer session restoration/navigation behavior is owned by `customer_verify_auth/spec.md`; it must call this API contract rather than duplicate login rules.

### Verification and deferred decisions

- API tests cover normalization, role-aware duplicates, hashing, pending/approval states, web/mobile credential paths, role/status middleware, CSRF/session invalidation, generic recovery, reset-token scope/expiry/single use, and notification failure.
- Frontend tests cover registration/login/recovery states, pending/rejected messages, generic errors, CSRF, protected redirects, and accessible form errors.
- Before adding registration address/evidence, agree on required fields, evidence types, Admin review semantics, age presentation, email acknowledgement, retention, and resubmission in the reference and schema docs.
- References: `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Buyer.md`, `docs/features/customer/address-book/spec.md`, `docs/features/customer/customer_verify_auth/spec.md`, and the two shared registration/file-upload references.
