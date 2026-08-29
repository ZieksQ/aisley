---
feature: seller-auth
title: Seller Authentication
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Authentication

## WHAT

- **Purpose:** Let a merchant register for a Seller account, pass Admin approval, and establish a secure Seller-only web session.
- **Primary actors:** Seller applicant, approved Seller, and the existing authorized Admin reviewer.
- **Application boundary:** React/Vite owns auth forms and route state; Laravel owns identity, validation, approval gating, sessions, and authorization.
- **Canonical identity:** a persisted `users` record with `role = seller`, resolved by normalized `email + role`.
- **Existing foundation:** `users`, `seller_profiles`, `registration_applications`, optional documents, database sessions, and Admin Seller approval already exist.
- **Current gap:** no Seller auth controller, routes, requests, resource, active-role middleware, feature tests, or frontend auth shell exists.
- **Core lifecycle:**

```text
register → PENDING → Admin APPROVED → ACTIVE → sign in → Seller Dashboard
                   ↘ REJECTED → no dashboard access
```

- **Owned flows:** registration, login, session restoration, approval/status denial, logout, forgot password, and password reset.
- **Frontend routes:** `/register`, `/login`, `/forgot-password`, `/reset-password`, and protected `/dashboard`.
- **API namespace:** `/api/v1/seller/auth/*`.
- **Boundaries:** Admin registration management owns approval/rejection; Seller Account Management owns signed-in profile and password changes.
- **Non-goals:** Admin review UI, shop/catalog management, social login, MFA, mobile tokens, staff sub-accounts, or changing Seller account status.
- **Open scope:** Seller documents and the timing of one-shop creation are not defined by current requirements and must not be invented here.

## MUST

### Identity and registration

- Seller lookup and uniqueness must use normalized `email + seller`; a same-email Customer/Admin/Courier must remain isolated.
- The API must derive `role = seller`; client-supplied `role`, `status`, reviewer, or approval fields are prohibited.
- Registration must validate and persist the existing Seller profile fields: first name, optional middle name, last name, contact number, sex, and birth date.
- Registration must accept email, password, and password confirmation using the project-wide password policy.
- Laravel must create the User, SellerProfile, and pending RegistrationApplication in one database transaction.
- New records must use UUIDs, `UserStatus::Pending`, `ApplicationStatus::Pending`, and `UserRole::Seller`.
- Passwords must use the configured Eloquent/Laravel hash mechanism and never appear in responses, logs, or audit payloads.
- Duplicate and concurrent submissions must produce one Seller role-account/application and a stable field-addressable error.
- Existing Admin registration management must be able to review the resulting application without a parallel approval model.
- Seller-specific documents may be uploaded only after the required checklist, limits, and registration UX are decided.
- Registration must not create a fabricated default shop; shop creation timing remains an open product decision.

### Approval and account gating

- Only `role = seller` plus `status = active` may establish or retain ordinary Seller dashboard access.
- `pending`, `rejected`, `suspended`, and `deactivated` accounts must be denied even when the password is correct.
- Use stable response codes such as `ACCOUNT_PENDING_APPROVAL`, `ACCOUNT_REJECTED`, `ACCOUNT_SUSPENDED`, and `ACCOUNT_INACTIVE`.
- Inactive responses may explain the applicant's own state but must not expose Admin-only notes or unrelated accounts.
- Approval must activate the existing User/Application atomically; it must not create a second Seller account.
- Every protected Seller API must apply `auth:sanctum` and Seller-active role/status middleware.
- Frontend guards improve navigation only; direct API requests remain protected by Laravel.
- Seller-owned resources must be scoped from the authenticated Seller and must never trust a submitted `seller_id` or `shop_id`.

### Stateful web login

- The first-party Seller SPA must use Sanctum cookie/session authentication, not a Bearer token in browser storage.
- The client must request `/sanctum/csrf-cookie` before submitting credentials and send cookies plus the XSRF header.
- Login accepts normalized email, password, and optional remember preference; it must not accept a trusted role.
- Laravel must resolve the Seller role-account, verify the hash, check active status, authenticate with the web guard, and regenerate the session.
- Unknown Seller email, wrong password, and an email existing only under another role must share a generic credential error.
- Rate-limit login by normalized email and IP; return `429` with `Retry-After` when exhausted.
- Successful login returns a safe Seller DTO and redirects the SPA to `/dashboard`.
- The DTO may contain Seller ID, safe profile name/email, role, account status, and safe shop summary when one exists.
- The DTO must exclude hashes, session IDs, remember tokens, registration evidence, and private review metadata.
- Seller port `5174` and production Seller origin must be included in Sanctum stateful-domain and credentialed CORS configuration.
- Production Seller and API hosts must share the same top-level domain required by Sanctum SPA authentication.

### Session lifecycle and recovery

- App startup must remain in a checking state until `GET /api/v1/seller/auth/me` resolves.
- Protected Seller content must not flash before session restoration finishes.
- `me` must reject a non-Seller or newly inactive Seller even if a valid session cookie is present.
- Expired or invalid sessions must clear client auth state and redirect protected navigation to `/login`.
- `POST /api/v1/seller/auth/logout` must log out the web guard, invalidate the session, and regenerate the CSRF token.
- Frontend-only state clearing is not logout; the old session must fail on later protected requests.
- Forgot-password responses must not reveal whether an active Seller account exists.
- Reset tokens must be stored and queried with `role = seller` so a Customer reset cannot reset a Seller password sharing the email.
- Reset tokens must be hashed, expiring, single-use, rate-limited, and deleted after a successful reset.
- A successful reset must rotate the remember token and revoke applicable existing personal access tokens.
- Whether all database web sessions are revoked after reset is an open decision and must be applied consistently across roles.
- Handle `401` unauthenticated, `403` inactive/forbidden, `419` CSRF/session expiry, `422` validation, and `429` throttling consistently.

### User experience and acceptance

- Forms must provide labels, keyboard access, visible focus, field errors, submit-progress state, and non-color-only status feedback.
- Registration success must show the pending-approval state and direct the applicant to email/status guidance, not the dashboard.
- Login links to registration and password recovery; approval/rejection screens link back to login or support where appropriate.
- [ ] Seller registration creates one pending User/Profile/Application transactionally.
- [ ] Same-email accounts remain isolated by role across registration, login, and password reset.
- [ ] Pending, rejected, suspended, and deactivated Sellers cannot access protected APIs.
- [ ] Approved active Seller can sign in, restore a session, reach `/dashboard`, and log out.
- [ ] CSRF, session regeneration, credentialed CORS, throttling, and generic credential failures are covered.
- [ ] Seller data and routes cannot be accessed with Customer, Admin, or Courier authentication.

## HOW

- Add Seller-namespaced `AuthController`, Form Requests, `SellerUserResource`, notification, config, and `EnsureActiveSeller` middleware.
- Register middleware in `bootstrap/app.php`; add `/api/v1/seller/auth` routes beside existing Customer/Admin auth groups.
- Mirror proven Customer transaction, status-code, reset-token, and race-handling patterns without cross-importing Customer classes.
- Reuse the Admin `RegistrationReviewService` and `RegistrationDecisionNotification`, which already support `UserRole::Seller`.
- Keep enum-like database values as strings with PHP enum casts; no schema migration is currently required for the base auth flow.
- Add Seller origin `localhost:5174`/`127.0.0.1:5174` to `.env.example`, Sanctum defaults, and CORS defaults.
- Add the project-declared React Router dependency to `src/seller` and replace the static dashboard entry with public/protected route layouts.
- Implement one credentialed API client, auth context/store, session bootstrap, protected-route boundary, and status-specific error mapping.
- Reuse `@aisley/ui` form primitives where compatible and follow `docs/design.md` dashboard accessibility/dark-mode rules.
- API feature tests must cover registration rollback/duplicates, role isolation, every account status, throttle, session fixation, `me`, logout, and reset-token role isolation.
- Run the API suite on SQLite and PostgreSQL; run Seller lint, TypeScript/build, and focused browser/session checks from port `5174`.
- Log safe operational result categories and request IDs; never log submitted passwords, cookies, CSRF values, or reset tokens.
- Roll out only after Seller origins and cookie domains are configured in each environment and the initial shop-onboarding decision is recorded.
- **Open questions:** shop creation during registration vs post-approval onboarding; required Seller documents; email verification; remember-me policy; full web-session revocation after reset.
- **References:** [Laravel 13 Sanctum SPA authentication](https://laravel.com/framework/docs/13.x/sanctum#spa-authentication), [Laravel 13 authentication](https://laravel.com/framework/docs/13.x/authentication), and [Laravel 13 password reset](https://laravel.com/framework/docs/13.x/passwords).
