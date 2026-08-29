---
feature: admin-auth
title: Admin Auth
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Admin
scope: Admin Web Application
---

# Admin Authentication

## WHAT

- **Feature:** Admin Authentication for the AISLEY Admin web application.
- **Purpose:** Establish and maintain a secure authenticated `ADMIN` session before any protected Admin feature can be used.
- **Primary actor:** A user account whose persisted role is `ADMIN`.
- **Application boundary:**
  - Next.js + React owns the login UI, auth-loading state, redirects, and calls to the Laravel API.
  - Laravel is the source of truth for credentials, sessions, roles, permissions, and protected-route authorization.
  - Admin web authentication uses Laravel Sanctum's stateful SPA/session authentication.
- **Identity model:**
  - AISLEY accounts are role-aware.
  - Account identity is resolved using `email + role`.
  - Admin login must resolve `email + ADMIN`, not email alone.
  - A Buyer, Seller, Courier, or Logistics account sharing the same email must not authenticate as Admin.
  - The role is read from persisted server data; the client must not choose or prove its own role.
- **Admin bootstrap:**
  - The initial Admin is created from configured `.env` email/password credentials.
  - Bootstrap exists only to ensure the initial `ADMIN` account is available.
  - Admin deployment secrets are never exposed in the Admin UI.
- **Auth lifecycle:**

```text
Admin opens web app
→ resolve existing session
→ unauthenticated
   → /login
   → GET /sanctum/csrf-cookie
   → POST /login
   → resolve email + ADMIN
   → verify password
   → create Laravel session
   → browser receives HttpOnly session cookie
   → /dashboard

authenticated request
→ browser sends session cookie
→ Laravel authenticates account
→ enforce role = ADMIN
→ hand off to feature permission/authorization
→ allow protected action

logout
→ POST /logout
→ invalidate backend session
→ clear frontend auth state
→ /login
```

- **Owned by this feature:**
  - initial Admin bootstrap dependency
  - Admin login
  - CSRF initialization
  - role-aware identity resolution
  - password verification
  - session creation
  - current Admin/session restoration
  - authentication guard for Admin routes
  - `ADMIN` role enforcement
  - authorization handoff
  - post-login Dashboard redirect
  - session-expiration handling
  - logout and backend session invalidation
- **Non-goals:**
  - public Admin registration
  - creating additional Admin accounts
  - custom permission assignment
  - Admin profile editing
  - password-change UI
  - forgot-password/recovery
  - a concrete 2FA implementation
  - SSO/social login/passkeys
  - remember-me
  - active-session/device management
  - login-history UI

## MUST

### Authentication and identity

- The backend must authenticate the specific `ADMIN` role-account.
- Admin lookup must use the equivalent of:

```text
email = submitted email
AND
role = ADMIN
```

- The login request must not accept `role`, `permissions`, or `is_admin` as proof of Admin access.
- Valid credentials for a non-Admin role must not grant access to the Admin application.
- Unknown Admin email and wrong password must produce a generic credential failure.
- Authentication errors must not reveal whether the email exists under another role.
- Password verification must use Laravel/framework password-hashing mechanisms.
- Plaintext passwords must never be persisted.

### Initial Admin bootstrap

- Bootstrap must read the configured Admin email/password from deployment configuration.
- Bootstrap must search by `email + ADMIN`.
- Bootstrap must create the Admin only when the `ADMIN` role-account is missing.
- Bootstrap must hash the configured password before persistence.
- Bootstrap must be idempotent.
- A same-email non-Admin account must not satisfy the bootstrap lookup.
- Re-running bootstrap must not create duplicate Admin records.
- Existing Admin credentials must not automatically be overwritten from `.env` unless a later project decision explicitly requires re-sync behavior.

### Stateful web authentication

- Admin web auth must use the source-defined Sanctum stateful session flow.
- Before login, the frontend must initialize CSRF protection through:

```http
GET /sanctum/csrf-cookie
```

- Credentials are then submitted through the Laravel login endpoint:

```http
POST /login
```

- Successful login must create a Laravel authenticated session.
- The browser must rely on the server-issued session cookie for future authenticated requests.
- Admin web auth must not depend on JavaScript-managed Bearer tokens stored in:
  - `localStorage`
  - `sessionStorage`
  - IndexedDB
- The shared frontend API client must send the credentials/cookies and CSRF data required by the configured Laravel/Sanctum deployment.
- CSRF, CORS, session-domain, stateful-domain, `Secure`, and `SameSite` settings must be configured for the actual Admin/API deployment domains.

### Login request and result

- Minimum login input:
  - `email`
  - `password`
- Server validation must return project-standard field-addressable validation errors when input is malformed.
- Duplicate form submission must be disabled while login is in progress.
- Successful login must enter the Admin application at `/dashboard`.
- A valid existing Admin session visiting `/login` should be redirected to `/dashboard`.
- Recommended generic credential error:

```text
Invalid email or password.
```

### Session restoration

- On Admin application startup, frontend auth state must begin unresolved, e.g.:

```text
CHECKING
```

- The frontend must ask Laravel for the current authenticated identity before rendering protected Admin content.
- A current-Admin endpoint may be:

```http
GET /api/admin/me
```

- If repository conventions already define a shared current-user endpoint, use that instead of introducing a duplicate endpoint.
- The current Admin response may expose only fields needed by the Admin shell, such as:
  - id
  - name
  - email
  - role
  - effective permissions when required
- It must never expose:
  - password/password hash
  - session cookie/value
  - access tokens
  - 2FA secrets
  - recovery codes
- Protected Admin content must not flash before session resolution finishes.
- An invalid, expired, or unusable session must be treated as unauthenticated.
- Frontend "logged in" state must never override Laravel's session result.

### Protected Admin access

- Every protected Admin API must require:
  - authenticated session
  - persisted role = `ADMIN`
- Backend authorization is authoritative.
- Hiding a page, button, menu item, or React component is not sufficient authorization.
- Authentication and authorization must remain separate:

```text
authentication
→ identify current account and verify ADMIN role

authorization
→ verify this Admin may use the requested feature/action
```

- A valid Admin session must still respect custom permissions where the authorization system defines them.
- Direct API calls must not bypass Admin authentication or role middleware.
- Use project-standard semantics:
  - `401` for unauthenticated requests
  - `403` for authenticated requests lacking permission

### Session expiration

- When an authenticated request becomes unauthenticated because the session expired or became invalid:
  - protected data/actions must stop being usable
  - frontend auth state must become unauthenticated
  - the user must return to `/login`
- Session expiration must not be inferred only from stale client state.
- Exact idle timeout, absolute lifetime, concurrent-session policy, and remember-me behavior remain open decisions.

### Logout

- Logout must use a state-changing backend request, conceptually:

```http
POST /logout
```

- Logout must invalidate the Laravel/backend session.
- Frontend-only state clearing is not valid logout.
- After successful logout:
  - frontend authenticated state is cleared
  - user is redirected to `/login`
  - the old session can no longer access protected Admin APIs
- Logout must follow the configured CSRF/session protection rules.

### Security and privacy

- Auth responses and logs must not expose:
  - plaintext passwords
  - password hashes
  - session cookie values
  - CSRF secrets
  - Bearer tokens
  - 2FA secrets
  - OTP/recovery secrets
  - raw database/security errors
- Safe operational logging may include:
  - request ID
  - route
  - timestamp
  - result category
  - resolved Admin ID after successful authentication
- Whether login, failed login, and logout events belong in the immutable Admin Audit Log remains an open decision.
- Login rate limiting and brute-force mitigation should be enabled using the project's Laravel security conventions.
- Suspicious-login detection, CAPTCHA, and security notification emails are not required unless separately specified.

### UI requirements

- `/login` must provide:
  - email field
  - password field
  - login action
  - submitting/loading state
  - safe invalid-credential state
  - server-error state
- The page must:
  - use semantic labels
  - support keyboard navigation
  - use appropriate email/password autocomplete attributes
  - expose validation/authentication errors accessibly
  - not communicate errors using color alone
  - remain usable on smaller screens

### Acceptance criteria

- [ ] Initial Admin bootstrap creates an `ADMIN` account when missing.
- [ ] Re-running bootstrap does not create a duplicate Admin.
- [ ] Same-email non-Admin accounts do not satisfy Admin bootstrap.
- [ ] Bootstrap password is stored hashed.
- [ ] Frontend requests `/sanctum/csrf-cookie` before login.
- [ ] Valid `email + ADMIN` credentials create an authenticated session.
- [ ] Wrong password does not create a session.
- [ ] Email without an `ADMIN` role-account does not authenticate.
- [ ] Same-email Buyer/Seller/Courier/Logistics credentials cannot enter Admin.
- [ ] Successful login uses the configured stateful session cookie.
- [ ] Admin web auth does not require a Bearer token in JavaScript storage.
- [ ] Valid session survives page reload through session restoration.
- [ ] Invalid/expired session becomes unauthenticated.
- [ ] Guest requests cannot access protected Admin APIs.
- [ ] Authenticated non-Admin accounts cannot access protected Admin APIs.
- [ ] Valid Admin sessions still respect feature permissions.
- [ ] Successful login redirects to `/dashboard`.
- [ ] Existing valid Admin session does not remain on `/login`.
- [ ] Expired session clears protected frontend auth state and returns to login.
- [ ] Logout invalidates the backend session.
- [ ] Old session cannot access protected APIs after logout.
- [ ] Credential errors do not disclose role-account existence.
- [ ] Auth DTOs and logs do not expose secrets.
- [ ] No unrestricted public Admin registration is exposed.

## HOW

### Laravel API

- Use the Laravel authentication/session mechanism already configured for the project and Sanctum's stateful SPA mode.
- Configure Sanctum stateful API middleware and deployment domains according to the Laravel version and repository conventions.
- Keep business authority in Laravel; do not create a separate Next.js authentication implementation that bypasses Laravel.
- Provide or reuse:
  - CSRF cookie endpoint: `GET /sanctum/csrf-cookie`
  - Admin login endpoint: `POST /login`
  - current Admin endpoint: `GET /api/admin/me` or existing equivalent
  - logout endpoint: `POST /logout`
- Login orchestration should:
  1. validate `email` and `password`
  2. normalize the email according to project convention
  3. query the account using `email + ADMIN`
  4. verify the password
  5. reject failure with a generic credential error
  6. authenticate the resolved Admin through Laravel's session guard
  7. regenerate the session identifier after successful login
  8. return the project-standard success response
- Protect Admin routes with the configured Sanctum/session authentication middleware plus Admin-role middleware/policy.
- Apply feature-specific Gates/Policies after authentication.
- Return safe identity through an API Resource or equivalent project response convention.
- On logout:
  - log the user out through the configured guard
  - invalidate the session
  - regenerate the CSRF token according to Laravel session conventions
- Use Laravel rate limiting for login attempts if not already provided by the authentication stack.

### Bootstrap

- Implement initial Admin creation using the project's seeding/bootstrap convention.
- Read Admin email/password from server-side configuration only.
- Use a role-aware lookup equivalent to:

```text
where email = configured email
and role = ADMIN
```

- Hash the password using Laravel's password hashing API.
- Do not update an existing Admin password from `.env` unless re-sync is explicitly chosen later.

### Next.js / React

- Create or reuse the Admin login route at `/login`.
- Keep authentication requests in the shared API client.
- Configure the client to send credentials and XSRF information required by Sanctum.
- Login flow:

```text
submit
→ set submitting
→ initialize CSRF
→ POST credentials
→ fetch/resolve current Admin if needed
→ set authenticated
→ navigate /dashboard
```

- App startup flow:

```text
CHECKING
→ fetch current Admin
→ success + ADMIN
   → AUTHENTICATED
→ 401/invalid session
   → UNAUTHENTICATED
   → /login
```

- Use a shared auth provider/store only for presentation/session-resolution state.
- Never treat client-side role or permission values as authoritative.
- Centralize handling of unauthenticated responses so session expiration consistently returns the Admin to `/login`.
- Render `401` and `403` as different states:
  - `401`: session missing/expired → login
  - `403`: signed in but action is forbidden

### Data and schema

- Reuse the existing shared users/account schema where possible.
- Preserve the role-aware identity constraint:

```text
unique(email, role)
```

- Ensure the Admin login lookup can use an index supporting email/role lookup.
- Do not create a separate Admin credential store unless the repository architecture explicitly requires it.

### Testing

- **Laravel feature tests:**
  - bootstrap creates missing Admin
  - bootstrap is idempotent
  - same-email non-Admin does not satisfy bootstrap
  - password is hashed
  - valid Admin login succeeds
  - wrong password fails
  - unknown Admin fails
  - same-email non-Admin credentials fail for Admin
  - server resolves role instead of trusting client role
  - session is established and regenerated on successful login
  - current Admin endpoint returns safe fields
  - current Admin endpoint rejects guest
  - protected routes reject guest
  - protected routes reject non-Admin roles
  - feature permission checks still apply to Admin
  - logout invalidates session
  - old session fails after logout
  - auth secrets are absent from responses/logging paths under test
- **Frontend tests:**
  - login form renders and is accessible
  - CSRF initialization precedes login
  - duplicate submission is disabled while pending
  - valid login enters Dashboard
  - invalid credentials show generic error
  - valid existing session skips login
  - protected content does not flash during `CHECKING`
  - expired session returns to login
  - `401` and `403` produce different behavior
  - logout returns to login
  - responsive/keyboard behavior remains usable

### Open questions

- Exact bootstrap/seeder command or lifecycle hook.
- Whether `.env` credentials ever re-sync an existing Admin.
- Exact login success response shape.
- Whether `/api/admin/me` or a shared current-user endpoint is preferred.
- Exact session idle and absolute lifetime.
- Concurrent Admin session/revocation policy.
- Password-change session invalidation policy.
- Exact Admin password policy.
- Exact login rate-limit/lockout thresholds.
- Whether login/logout/failed-login events enter Admin Audit Logs or separate security logs.
- Exact Admin/API domains and resulting Sanctum/CORS/cookie configuration.
- Whether Admin accounts participate in Global Ban/IP block rules.
- Concrete 2FA behavior.
- Forgot-password/recovery behavior.
- Safe `returnTo` behavior after future deep-link login.
- Active-session/device management.
- Emergency Admin recovery procedure.

### Source alignment

- Project feature-spec rule: keep the feature concise, implementation-ready, below 500 lines, and organized as `WHAT`, `MUST`, and `HOW`.
- AISLEY system-flow contract: Next.js/React handles presentation; Laravel owns authentication, authorization, validation, persistence, and security-sensitive behavior.
- Admin model: Admin features require authenticated/authorized access, with Dashboard as the primary entry point.
- Supplied Admin Authentication draft: defines role-aware `email + ADMIN` identity, initial Admin bootstrap, Sanctum CSRF/session flow, current-session restoration, protected Admin access, and logout.
- Laravel Sanctum SPA authentication documentation: https://laravel.com/docs/sanctum#spa-authentication
