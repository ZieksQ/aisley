---
feature: Admin Authentication
system: AISLEY
type: Feature Specification
version: 2.1
status: Draft
scope: Admin Web Application
source_coverage: app.md, Admin.md, current AISLEY Admin architecture
---

# Admin Authentication Specification

## 1. Purpose

Admin Authentication protects the AISLEY Admin web application and establishes the authenticated Admin session used by all Admin features.

The source defines the web mechanism as:

```text
React / Next.js
→ GET /sanctum/csrf-cookie
→ POST /login
→ Laravel authenticated session
→ encrypted HttpOnly session cookie
→ browser sends the cookie automatically
```

AISLEY also defines role-aware identity:

```text
all roles live in the same users table
unique(email, role)
```

The initial Admin is created from `.env` credentials. This specification defines the requirements and boundaries; sequence-heavy behavior stays in `flow.md`.

## 2. Source Requirements

From `app.md`:

- Admin is a web application on its own domain.
- React/Next.js web apps use stateful `HttpOnly` session cookies.
- The web app fetches `/sanctum/csrf-cookie` before sending credentials to `/login`.
- Laravel attaches an encrypted session cookie.
- The browser automatically sends the cookie on future requests.
- The rationale is protection against XSS token theft.
- Account identity is constrained by `unique(email, role)`.
- The initial Admin is created from `.env` email/password.
- Additional Admins may later be added with custom permissions.

From `Admin.md`:

- Dashboard is the Admin's primary post-login entry point.
- Admin Account Management is heavily gated by authentication middleware.
- Admin features depend on authenticated/authorized Admin access.

## 3. Responsibilities

Admin Auth owns:

- initial Admin authentication bootstrap dependency
- Admin login
- CSRF initialization
- role-aware Admin identity resolution
- password verification
- stateful session creation
- session restoration/current-Admin resolution
- protected Admin route authentication
- Admin-role enforcement
- authorization handoff
- Dashboard redirect
- logout/session invalidation

Admin Auth does not own:

- public Admin registration
- creating additional Admins
- assigning custom permissions
- Admin profile editing
- password changes
- 2FA configuration
- Account Approval
- forgot-password/recovery unless separately specified
- SSO, social login, passkeys
- active-session/device management

## 4. Primary Actor

The actor is an AISLEY `ADMIN` role-account using the Admin web application.

A valid Buyer, Seller, Logistics, or Courier account must not gain Admin access merely because it uses the same email or a valid password.

## 5. Role-Aware Identity

AISLEY identity is:

```text
unique(email, role)
```

Example:

```text
person@example.com + BUYER
person@example.com + SELLER
person@example.com + ADMIN
```

Admin authentication must resolve:

```text
email + role = ADMIN
```

not email alone.

Critical invariant:

```text
Valid credentials authenticate
the specific ADMIN account,
not every account sharing the email.
```

The role must come from the persisted account, not a client-provided `role` field.

## 6. Initial Admin Bootstrap

`app.md` defines:

```text
initial admin created
(use .env for email and password)
```

Bootstrap should:

- read configured Admin email/password
- search by `email + ADMIN`
- create the account only when missing
- hash the password before persistence
- be idempotent
- avoid duplicate Admin records
- ignore same-email accounts under other roles

The Admin UI must never expose or edit deployment secrets.

Whether `.env` credentials re-sync an existing Admin later is an Open Decision.

## 7. Login Page

Recommended route:

```text
/login
```

Minimum form:

- email
- password
- login action

No public Admin registration is required.

If a valid Admin session already exists, `/login` should redirect to `/dashboard`.

## 8. CSRF Initialization

Before stateful web login:

```http
GET /sanctum/csrf-cookie
```

This establishes CSRF state for Laravel Sanctum.

The frontend must use the configured stateful web-auth mechanism rather than bypassing CSRF.

## 9. Login Request

Conceptual request:

```http
POST /login
```

```json
{
  "email": "admin@example.com",
  "password": "..."
}
```

Do not trust client-provided:

```text
role
permissions
is_admin
```

as authentication/authorization proof.

## 10. Credential Validation

The backend must:

1. validate request fields
2. normalize email according to project conventions
3. resolve the account using `email + ADMIN`
4. verify the password using framework mechanisms
5. reject invalid credentials safely
6. create a session only after successful verification

If no matching Admin exists, authentication fails.

If the password is invalid, authentication fails.

Recommended user-facing error:

```text
Invalid email or password.
```

Do not reveal whether the same email exists under another role.

## 11. Successful Login

On valid credentials:

```text
Laravel creates authenticated session
→ encrypted HttpOnly session cookie
→ browser stores/sends cookie automatically
→ Admin identity can be restored
→ redirect /dashboard
```

The frontend must not need to access the cookie directly.

## 12. Browser Storage Rule

Admin web authentication must not replace the source-defined session model with JavaScript-readable Bearer tokens stored in:

```text
localStorage
sessionStorage
IndexedDB
```

## 13. Web vs Mobile Auth

`app.md` defines two mechanisms:

```text
WEB
stateful HttpOnly session cookies

FLUTTER MOBILE
personal access token
Authorization: Bearer <token>
flutter_secure_storage
```

Admin Auth uses the web mechanism.

Courier/mobile Bearer-token behavior is out of scope for this Admin Auth feature.

## 14. Session Restoration

When the Admin application loads:

```text
auth state = checking
→ request current authenticated Admin
→ valid ADMIN session?
   yes → authenticated app
   no  → login
```

Protected content should not render while authentication is unresolved.

## 15. Current Admin Endpoint

Conceptual:

```http
GET /api/admin/me
```

or an equivalent shared current-user endpoint.

Safe response may include:

- id
- name
- email
- role
- effective permissions if needed

Never include:

- password hash
- session cookie/value
- tokens
- 2FA secret
- recovery codes

## 16. Frontend Auth State

Recommended states:

```text
CHECKING
AUTHENTICATED
UNAUTHENTICATED
```

Optional:

```text
ERROR
```

Do not render protected feature content until the session has been resolved as authenticated.

## 17. Protected Admin Routes

Every protected Admin feature requires:

```text
authenticated session
role = ADMIN
```

Protected features include:

- Dashboard
- Account Approval
- Manage User Accounts
- Seller Compliance
- Complaints & Disputes
- Reports Overview
- Admin Notifications
- System Audit Logs
- Platform Settings
- Admin Account Management
- Admin Chat / Messaging
- Global Ban / Blocklist
- Push Notification Management

Frontend guards are convenience only. Backend middleware/policies are authoritative.

## 18. Authentication vs Authorization

Authentication:

```text
Who is the current account?
Is it ADMIN?
```

Authorization:

```text
Which Admin feature/action may this Admin use?
```

`app.md` states additional Admins can have custom permissions. Therefore a valid Admin session does not automatically grant full platform authority.

## 19. Permission Handoff

After authentication:

```text
authenticated ADMIN
→ authorization middleware/policy
→ feature permission
→ requested Admin action
```

Admin Auth establishes identity; the authorization system determines access.

## 20. Dashboard Handoff

Successful login should normally enter:

```text
/dashboard
```

Dashboard remains responsible for its own data and permissions.

## 21. Session Expiration

If the session expires:

```text
protected request
→ unauthenticated response
→ clear frontend auth state
→ redirect /login
```

Protected actions must not remain usable after session expiration.

## 22. Invalid Session

Invalid, expired, or unusable session cookies must be treated as unauthenticated.

The frontend must not keep a stale local "logged in" state as authoritative.

## 23. Session Lifetime

The source does not define:

- idle timeout
- absolute session lifetime
- remember-me
- concurrent sessions
- session-device limits

These are Open Decisions.

## 24. Password Changes

Admin Auth verifies the current password during login.

Changing the Admin password belongs to:

```text
Admin Account Management
```

After a password change, Admin Auth follows the shared session-invalidation policy.

## 25. Two-Factor Authentication

`Admin.md` mentions 2FA under Admin Account Management, but does not define a concrete login challenge.

The base Auth implementation must not invent TOTP, SMS OTP, email OTP, or passkey behavior.

Future generic insertion:

```text
password valid
→ 2FA enabled?
   no  → session
   yes → configured second-factor challenge
         → session only after success
```

Exact 2FA behavior remains Open.

## 26. Forgot Password / Recovery

The current sources do not define:

- forgot password
- Admin password reset
- recovery email
- emergency recovery

These are not required for the current MVP unless separately specified.

## 27. Admin Account Creation Boundary

Customer/Seller/Logistics accounts use registration and approval flows.

Admin accounts do not use that public registration flow.

Current source:

```text
initial Admin from .env
→ create partners
→ add Admins with custom permissions
```

Do not expose unrestricted `/admin/register` by default.

## 28. Logout

Recommended:

```http
POST /logout
```

Logout must invalidate the backend session.

After success:

```text
clear frontend authenticated state
→ redirect /login
```

Frontend-only state clearing is not valid logout.

## 29. Logout Security

Logout is a state-changing request and should follow the configured web CSRF/session protections.

After logout, the old session must not access protected Admin endpoints.

## 30. Error Handling

Required error categories:

- invalid credentials
- unauthenticated
- forbidden
- session expired
- server error

Conceptually:

```text
401 = unauthenticated
403 = authenticated but not authorized
```

Exact Laravel response shapes follow project conventions.

## 31. Error Privacy

Authentication errors must not expose:

- whether an email exists under another role
- password hashes
- session identifiers
- database errors
- internal security policy details

## 32. Security Logging

Never intentionally log:

```text
plaintext password
password hash
session cookie
CSRF secret
Bearer token
2FA secret
OTP
```

Safe technical fields may include:

- request ID
- route
- result category
- resolved Admin ID after successful authentication
- timestamp

subject to security/privacy policy.

## 33. Login Audit Boundary

System Audit Logs are primarily for administrative actions.

The current sources do not define whether:

- successful Admin login
- logout
- failed login

must be written to the immutable Admin Audit Log.

These may instead belong to security/auth logs. Final policy is Open.

## 34. Admin Notifications Boundary

Normal login errors do not create Admin Notifications.

Suspicious-login alerts are not currently source-defined.

## 35. Global Ban / Blocklist Integration

Global Ban may block user/IP access through shared middleware.

Admin Auth should respect applicable shared security middleware.

Whether Admin accounts themselves can be globally banned or whether Admin-domain IP bans apply is an Open Decision in the security model.

## 36. Cookie Security

Cookie/session settings should follow Laravel/Sanctum production security configuration.

Deployment-specific settings include:

- `Secure`
- `SameSite`
- cookie/session domain
- expiration
- stateful domains

Exact values depend on the Admin deployment domains and are not defined in the source.

## 37. Multiple Web Domains

AISLEY uses different domains for Admin, Storefront, Seller, and Logistics.

Sanctum/CORS/stateful-domain configuration must allow the intended Admin frontend while preserving role/application boundaries.

Exact domain names are Open.

## 38. API Surface

Conceptual endpoints:

```http
GET  /sanctum/csrf-cookie
POST /login
GET  /api/admin/me
POST /logout
```

Repository conventions may use a different current-user endpoint.

## 39. Login DTO

Conceptual:

```json
{
  "email": "admin@example.com",
  "password": "..."
}
```

The backend determines the expected role.

## 40. Current Admin DTO

Conceptual:

```json
{
  "id": "admin-user-id",
  "name": "Admin Name",
  "email": "admin@example.com",
  "role": "ADMIN",
  "permissions": []
}
```

Only include data needed by the Admin shell and authorization UI.

## 41. Login Response

Because authentication is cookie-based, the framework manages the session cookie.

The API may:

- return safe Admin data immediately, or
- return success and let the frontend fetch `/api/admin/me`

Exact response design is Open.

## 42. Login UI States

Recommended:

```text
idle
requesting CSRF
submitting
success
invalid credentials
server error
```

Disable duplicate submission while a login attempt is active.

## 43. Redirect Rules

Default successful redirect:

```text
/dashboard
```

If a future `returnTo` flow is added, allow only validated internal Admin destinations to prevent open redirects.

## 44. Accessibility

The login UI should:

- provide semantic labels
- support keyboard navigation
- use appropriate password/email autocomplete
- expose errors accessibly
- not rely on color alone
- move focus appropriately after validation/auth errors

## 45. Responsive Behavior

Admin login must remain usable on smaller screens even though Admin is a web application.

## 46. Performance

Authentication should use indexed role-aware lookup.

The current-user endpoint should return only safe fields needed by the Admin app, not unrelated platform aggregates.

## 47. Security Requirements

Admin Auth must:

- use the source-defined stateful Sanctum session architecture
- initialize CSRF
- use HttpOnly cookies
- resolve `email + ADMIN`
- verify passwords with framework mechanisms
- reject non-Admin role accounts
- protect backend routes
- separate authentication from authorization
- invalidate sessions on logout
- avoid web Bearer-token storage
- redact auth secrets
- use safe generic login errors
- hand off to custom permission checks

## 48. MVP Scope

### Required

- initial Admin bootstrap from `.env`
- role-aware bootstrap lookup
- password hashing
- Admin login page
- `/sanctum/csrf-cookie`
- `/login`
- `email + ADMIN` identity resolution
- password verification
- stateful Laravel session
- encrypted HttpOnly session cookie
- session restoration/current Admin lookup
- Admin-role middleware
- feature authorization handoff
- Dashboard redirect
- session-expiration handling
- `/logout`
- server-side session invalidation
- safe authentication errors
- secure logging
- accessible/responsive login basics

### Recommended

- login rate limiting
- brute-force mitigation
- explicit auth-checking state
- safe internal return-to routing
- current-Admin endpoint
- hardened production cookie settings

### Not Required

- public Admin registration
- forgot password
- recovery
- specific 2FA method
- SSO
- social login
- passkeys
- remember me
- active-session UI
- login history
- device management
- CAPTCHA

## 49. Acceptance Criteria

### AC-01 — Bootstrap

If the configured initial Admin does not exist, the system can create the `ADMIN` account.

### AC-02 — Bootstrap Idempotency

Repeated bootstrap execution does not create duplicate Admin accounts.

### AC-03 — Bootstrap Role Isolation

A same-email Buyer/Seller/etc. account does not satisfy the Admin bootstrap lookup.

### AC-04 — Password Storage

Bootstrap/login passwords are never stored in plaintext.

### AC-05 — CSRF

The Admin web client initializes the configured Sanctum CSRF state before login.

### AC-06 — Valid Admin Login

Valid credentials for `email + ADMIN` create an authenticated session.

### AC-07 — Wrong Password

An invalid password does not create a session.

### AC-08 — Unknown Admin

An email without an `ADMIN` role-account does not authenticate.

### AC-09 — Same Email Non-Admin

Valid credentials for a same-email non-Admin role cannot enter the Admin application.

### AC-10 — HttpOnly Session

Successful Admin login uses the configured stateful HttpOnly session cookie.

### AC-11 — No Web Bearer Storage

Admin web auth does not depend on storing a Bearer token in browser JavaScript storage.

### AC-12 — Session Restore

A valid existing Admin session restores authenticated state after reload.

### AC-13 — Invalid Session

An expired/invalid session is treated as unauthenticated.

### AC-14 — Protected Backend

Unauthenticated requests cannot access protected Admin APIs.

### AC-15 — Admin Role

Authenticated non-Admin roles cannot access the Admin app.

### AC-16 — Permission Handoff

A valid Admin session still respects custom feature permissions.

### AC-17 — Dashboard Redirect

Successful login can enter `/dashboard`.

### AC-18 — Existing Session

A valid Admin session visiting `/login` is redirected to the Admin application.

### AC-19 — Session Expiration

Expired sessions cause protected requests to fail and frontend auth state to clear.

### AC-20 — Logout

Logout invalidates the backend session.

### AC-21 — Logout UI

After logout, the frontend clears auth state and returns to login.

### AC-22 — No Frontend-Only Logout

Clearing local React state without invalidating the backend session is insufficient.

### AC-23 — Generic Error

Login failure does not reveal role-account existence details.

### AC-24 — Secret Safety

Auth APIs do not expose passwords, hashes, session values, or security secrets.

### AC-25 — Safe Logs

Logs do not intentionally contain auth secrets.

### AC-26 — Web/Mobile Separation

Admin web uses cookie authentication rather than the Flutter Bearer-token mechanism.

### AC-27 — Direct API Protection

Direct API calls cannot bypass Admin authentication/role middleware.

### AC-28 — No Public Registration

MVP exposes no unrestricted public Admin registration flow.

## 50. Backend Tests

Test:

- bootstrap creates initial ADMIN
- bootstrap is idempotent
- same-email non-Admin does not satisfy bootstrap
- bootstrap password is hashed
- valid Admin login succeeds
- wrong password fails
- unknown Admin fails
- same-email Seller/Buyer credentials fail for Admin
- role is resolved server-side
- successful login establishes stateful session
- current Admin endpoint returns safe identity
- current Admin endpoint rejects guest
- protected route rejects guest
- protected route rejects non-Admin
- custom permission remains enforced
- expired session returns unauthenticated
- logout invalidates session
- old session cannot access protected route after logout
- passwords/cookies/tokens are absent from logs/DTOs
- direct API calls cannot bypass middleware
- Admin web does not use the Flutter Bearer-token flow

## 51. Frontend Tests

Test:

- login page renders
- form labels are accessible
- CSRF initialization occurs
- submitting state renders
- valid login redirects to Dashboard
- invalid credentials show safe error
- same-email non-Admin cannot enter
- valid existing session skips login
- auth checking prevents protected-content flash
- expired session redirects to login
- logout returns to login
- unauthenticated users cannot render protected pages
- forbidden and unauthenticated states differ
- responsive layout works
- keyboard navigation works

## 52. Open Decisions

The current sources do not define:

1. exact bootstrap implementation
2. `.env` re-sync behavior
3. exact login response shape
4. exact current-user endpoint name
5. session lifetime
6. idle timeout
7. absolute timeout
8. remember-me behavior
9. concurrent-session policy
10. session revocation
11. password-change session invalidation
12. exact password policy
13. login rate limit
14. brute-force lockout
15. CAPTCHA
16. suspicious-login detection
17. login/logout Audit Log policy
18. failed-login security logging
19. exact cookie `SameSite`/domain configuration
20. exact Admin domain
21. Sanctum stateful-domain/CORS deployment configuration
22. 2FA mechanism
23. 2FA login challenge
24. 2FA recovery
25. forgot-password support
26. password-reset flow
27. email verification for additional Admins
28. post-login return-to behavior
29. Admin Global Ban behavior
30. Admin IP-block behavior
31. active-session UI
32. login history
33. device/session naming
34. security notification emails
35. SSO/passkeys
36. emergency Admin recovery procedure

## 53. Final Definition

AISLEY Admin Authentication is:

```text
a role-aware,
stateful,
Sanctum-based web authentication layer
for ADMIN accounts

using:
    GET /sanctum/csrf-cookie
    POST /login
    encrypted HttpOnly session cookies
    backend authentication middleware
    role = ADMIN enforcement
    authorization handoff
    POST /logout
```

Central identity rule:

```text
Authenticate the specific ADMIN role-account,
not every AISLEY account sharing the email.
```

Central web-security rule:

```text
Admin web authentication uses
stateful HttpOnly session cookies,
not JavaScript-managed Bearer tokens.
```
