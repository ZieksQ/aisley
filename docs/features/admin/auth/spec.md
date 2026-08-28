---
feature: Admin Authentication
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Admin Web Application
---

# Admin Authentication Specification

## 1. Purpose

This document defines the authentication requirements for the **AISLEY Admin web application**.

The specification is intentionally limited to Admin authentication, session handling, Admin identity boundaries, initial Admin bootstrap, authorization entry points, and the authenticated transition into the Admin dashboard.

It is based on the project source documents:

- `app.md`
- `Admin.md`
- `Buyer.md`
- `Seller.md`
- `Logistics.md`
- `Courier.md`

Where the source documents do not define a behavior, this specification identifies it as an open decision or future extension rather than silently inventing a requirement.

---

## 2. System Context

AISLEY is a vertically integrated multi-vendor e-commerce platform with five primary account roles:

- Admin
- Buyer / Customer
- Seller
- Logistics
- Courier / Rider

All roles live in the same users system.

The system-level account identity constraint is:

```text
unique(email, role)
```

The same email address may therefore be reused across different roles, but it must not be duplicated within the same role.

Example:

```text
alex@example.com + ADMIN      -> valid
alex@example.com + SELLER     -> valid
alex@example.com + BUYER      -> valid

alex@example.com + ADMIN
alex@example.com + ADMIN      -> invalid duplicate
```

This rule is critical for Admin authentication because login must resolve an **Admin identity**, not merely the first user record matching an email address.

---

## 3. Application Context

AISLEY exposes different applications for different operational roles.

Web applications include:

- Admin
- Storefront
- Seller
- Logistics

Mobile applications include:

- Courier / Rider
- Storefront

The Admin application is therefore a **web application** and must use the web authentication mechanism defined by AISLEY:

- Laravel backend
- Laravel Sanctum
- stateful authentication
- encrypted `HttpOnly` session cookies
- CSRF protection
- React / Next.js Admin frontend

The Admin application must not use the mobile Bearer-token authentication model.

---

## 4. Goals

Admin authentication must provide the following capabilities:

1. Bootstrap the initial Admin account from environment configuration.
2. Allow an Admin to sign in using Admin credentials.
3. Ensure an email belonging to another role cannot authenticate into the Admin application.
4. Establish a stateful Laravel session using Sanctum-compatible cookie authentication.
5. Restore the authenticated Admin identity on subsequent requests.
6. Protect Admin-only pages and backend endpoints.
7. Allow the Admin to sign out and invalidate the session.
8. Redirect authenticated Admins to the Admin dashboard.
9. Provide an authorization foundation for additional Admin accounts with custom permissions.
10. Keep sensitive authentication data inaccessible to frontend JavaScript.

---

## 5. Non-Goals

This specification does not define the complete implementation of:

- public Admin registration
- Buyer authentication
- Seller authentication
- Logistics authentication
- Courier token authentication
- Buyer/Seller/Logistics approval workflows
- Admin permission-management UI
- the final custom-permission matrix
- password reset / forgot-password flow
- email verification for Admin accounts
- Two-Factor Authentication implementation
- Admin dashboard business features
- platform-wide user management
- account registration approvals
- audit-log UI
- global blocklist behavior

Some of these features interact with Admin authentication but are specified elsewhere or are not sufficiently defined by the current source documents.

---

## 6. Admin Account Lifecycle

### 6.1 Initial Admin

AISLEY defines the first Admin account as a system-bootstrap account created using environment configuration.

The intended lifecycle is:

```text
environment configuration
        ↓
initial Admin created
        ↓
initial Admin signs in
        ↓
initial Admin can create partners / additional Admins
        ↓
additional Admins receive custom permissions
```

The first Admin must not require public registration or approval.

### 6.2 Environment Configuration

The environment must provide credentials for the initial Admin.

The source documents specify environment-based email and password but do not define exact variable names.

Recommended names:

```env
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

If the repository already defines equivalent names, the existing convention should be used instead.

Requirements:

- real credentials must never be committed to source control
- `.env.example` may contain empty placeholders
- the password must be hashed before database persistence
- the plaintext password must never be stored in the database
- the plaintext password must never be written to application logs

### 6.3 Bootstrap Behavior

Initial Admin creation should be idempotent.

Conceptually:

```text
find user where:
    email = configured ADMIN_EMAIL
    role  = ADMIN

if not found:
    create Admin using configured credentials

if found:
    do not create a duplicate
```

Because AISLEY permits the same email across roles, bootstrap lookup must include the Admin role.

The bootstrap process must not accidentally treat an existing Buyer, Seller, Logistics, or Courier with the same email as the initial Admin.

### 6.4 Additional Admins

The system-level workflow states that the initial Admin can later add Admins with custom permissions.

Therefore, authentication must be designed so that it is not permanently coupled to a single environment-created account.

The initial Admin is only the bootstrap mechanism.

Future Admin accounts must authenticate through the same Admin authentication flow.

The exact permission model is not defined by the current source documents and is outside this specification.

---

## 7. Role Boundary

### 7.1 Required Role

Only a user whose role is Admin may enter the Admin application.

Conceptually:

```text
user.role == ADMIN
```

The implementation must use the role representation already established by the codebase.

### 7.2 Same Email Across Roles

Authentication must explicitly resolve the Admin-role account.

Given:

```text
users

email               role
--------------------------------
person@example.com  BUYER
person@example.com  SELLER
person@example.com  ADMIN
```

an Admin login request for `person@example.com` must authenticate against:

```text
email = person@example.com
role  = ADMIN
```

It must not:

- authenticate the Buyer record
- authenticate the Seller record
- select an arbitrary matching user
- rely on email uniqueness alone

### 7.3 Non-Admin Credentials

Valid credentials for another AISLEY role must not grant access to the Admin domain.

Examples:

```text
valid Buyer email + Buyer password       -> Admin access denied
valid Seller email + Seller password     -> Admin access denied
valid Logistics credentials              -> Admin access denied
valid Courier credentials                -> Admin access denied
```

The backend is the security boundary.

Frontend route protection is required for user experience but must not be the only authorization check.

---

## 8. Authentication Mechanism

### 8.1 Web Authentication Model

The Admin web application must use Laravel Sanctum's stateful web authentication model.

Required characteristics:

- session-based
- cookie-backed
- `HttpOnly`
- CSRF-protected
- browser-managed
- no manually persisted auth token

### 8.2 Prohibited Token Storage

The Admin frontend must not store authentication secrets in:

```text
localStorage
sessionStorage
IndexedDB
client-readable authentication cookies
```

The Laravel session cookie must be managed by the browser.

### 8.3 Expected Login Sequence

The source architecture defines the following web flow:

```text
Admin opens login page
        ↓
GET /sanctum/csrf-cookie
        ↓
Laravel issues CSRF cookie
        ↓
POST /login with email + password
        ↓
backend resolves ADMIN account
        ↓
credentials verified
        ↓
Laravel session established
        ↓
encrypted HttpOnly session cookie returned
        ↓
browser stores session cookie
        ↓
frontend resolves authenticated Admin
        ↓
redirect to Admin dashboard
```

---

## 9. Login Requirements

### 9.1 Login Interface

The Admin login interface requires:

- Email
- Password
- Sign in action

No public Admin registration entry point should be presented.

### 9.2 Credentials

Login payload:

```text
email
password
```

The login request does not need a role field from the browser if the endpoint itself is Admin-scoped.

The backend must enforce the Admin role regardless of any client-supplied value.

### 9.3 Credential Resolution

The backend must conceptually perform Admin-scoped credential resolution:

```text
lookup:
    email = submitted email
    role  = ADMIN

then:
    verify submitted password against stored password hash
```

The client must not be trusted to decide which role is being authenticated.

### 9.4 Successful Login

On successful authentication:

1. the credentials are accepted
2. an authenticated Laravel session is established
3. the session is associated with the Admin user
4. the frontend can retrieve the authenticated Admin identity
5. the Admin is redirected to the Admin dashboard

The Admin dashboard is the primary entry point described by the Admin feature document.

### 9.5 Failed Login

A login must fail when:

- the Admin-role account does not exist
- the password is incorrect
- the matching email belongs only to another role
- the request cannot establish a valid web session
- backend authorization determines the identity is not an Admin

The failure response should not unnecessarily reveal whether the email exists in the system.

Recommended user-facing message:

```text
Invalid email or password.
```

The exact wording is a UI decision.

---

## 10. CSRF Requirements

Before submitting login credentials, the Admin frontend must initialize CSRF protection through:

```http
GET /sanctum/csrf-cookie
```

The subsequent login request must include the cookies and CSRF data expected by Laravel Sanctum.

All state-changing authenticated web requests must remain compatible with Laravel's CSRF protection.

CSRF protection must not be disabled merely to simplify frontend integration.

---

## 11. Session Requirements

### 11.1 Session Creation

A successful login must establish a normal Laravel authenticated session.

The browser must automatically send the session cookie on subsequent Admin requests.

### 11.2 Session Restoration

When the Admin application loads, it needs a way to determine whether the browser already has a valid Admin session.

The source documents do not define the exact current-user endpoint.

The backend should expose or reuse an authenticated identity endpoint equivalent to:

```http
GET /api/user
```

or:

```http
GET /api/admin/me
```

The exact route should follow the repository's existing API convention.

### 11.3 Safe Admin Identity Response

The frontend only needs safe identity information required to render the authenticated Admin experience.

Example:

```json
{
  "id": 1,
  "name": "Admin Name",
  "email": "admin@example.com",
  "role": "ADMIN"
}
```

If permission data already exists in the repository, it may also be exposed through a safe authorization representation.

Sensitive fields must not be returned.

Examples of fields that must not be exposed:

- password hash
- remember token
- internal authentication secrets
- raw session identifiers

### 11.4 Expired or Missing Session

If no valid authenticated Admin session exists:

```text
protected Admin request
        ↓
authentication fails
        ↓
frontend becomes unauthenticated
        ↓
redirect to /login
```

Protected Admin content must not remain accessible after session expiration.

---

## 12. Logout Requirements

The Admin application must provide logout.

The source documents do not define the exact logout endpoint, but the stateful web authentication model requires session termination.

Recommended contract:

```http
POST /logout
```

On logout:

1. the server invalidates the authenticated session
2. the browser can no longer use that session for protected Admin requests
3. the frontend clears in-memory Admin identity state
4. the Admin is redirected to `/login`

Authentication information must not be simulated as logged out only on the frontend while leaving the server session valid.

---

## 13. Protected Admin Access

### 13.1 Protected Frontend Routes

At minimum, the Admin dashboard must require authentication.

Conceptually:

```text
/dashboard
    ↓
resolve session
    ↓
authenticated ADMIN?
    ├─ yes -> render dashboard
    └─ no  -> redirect /login
```

### 13.2 Login Route Behavior

If an already authenticated Admin opens `/login`:

```text
/login
    ↓
valid Admin session
    ↓
redirect /dashboard
```

### 13.3 Backend Protection

Every Admin-only backend endpoint must enforce:

1. authenticated session
2. Admin role
3. permission check when a future endpoint requires a custom Admin permission

Frontend checks alone are insufficient.

---

## 14. Authenticated Destination

The Admin feature document defines the Dashboard as the Admin's primary entry point and centralized command interface.

Therefore:

```text
successful Admin login
        ↓
/dashboard
```

This authentication specification only requires the transition into the dashboard.

Dashboard KPIs, notifications, reports, registration approvals, compliance tools, disputes, messaging, and other Admin modules are outside this authentication specification.

---

## 15. Frontend Auth State

The frontend should maintain one centralized representation of Admin authentication state.

Conceptual states:

```text
checking
authenticated
unauthenticated
error
```

Optional implementation shape:

```ts
type AdminAuthState =
  | { status: "checking"; admin: null }
  | { status: "authenticated"; admin: AdminIdentity }
  | { status: "unauthenticated"; admin: null }
  | { status: "error"; admin: null };
```

The exact React abstraction is implementation-dependent.

The important requirement is that authentication logic must not be duplicated independently across pages.

---

## 16. Loading Behavior

The frontend must distinguish between:

```text
"we have not checked the session yet"
```

and:

```text
"the user is definitely unauthenticated"
```

Protected Admin UI must not briefly render before the session check completes.

Recommended behavior:

```text
app starts
    ↓
auth status = checking
    ↓
resolve current session
    ├─ Admin found -> authenticated
    └─ no Admin    -> unauthenticated
```

---

## 17. Error Handling

The Admin frontend should handle at least:

- invalid credentials
- CSRF initialization failure
- unavailable backend
- expired session
- unauthorized / non-Admin identity
- logout failure

Authentication errors must not expose:

- password values
- password hashes
- stack traces
- database details
- session identifiers
- internal security configuration

---

## 18. Authorization Foundation

AISLEY's Admin lifecycle includes additional Admins with custom permissions.

Authentication answers:

```text
Who is this Admin?
```

Authorization will answer:

```text
What is this Admin allowed to do?
```

The auth implementation must preserve this separation.

Conceptually:

```text
authenticated Admin
        ↓
Admin role accepted
        ↓
permission evaluation
        ↓
requested Admin capability
```

The exact permission names, roles, groups, partner model, inheritance rules, and permission-management interface are not defined in the current source documents.

They must not be invented in this specification.

---

## 19. Relationship to Admin Account Management

`Admin.md` defines Admin Account Management as including updates to:

- Admin information
- login credentials
- preferences
- security settings
- potentially Two-Factor Authentication

For the current authentication scope:

- authentication must not prevent future password changes
- session handling should be compatible with future security settings
- 2FA is acknowledged as a future extension

The source documents do not provide enough detail to specify a complete 2FA flow.

---

## 20. Relationship to Audit Logs

`Admin.md` defines System Audit Logs as an immutable, timestamped ledger of administrative actions.

Authentication is security-sensitive and should be compatible with future audit logging.

The source does not explicitly define which authentication events must be logged.

A future audit/security specification should decide whether to record events such as:

- successful login
- logout
- failed login
- password change
- permission change
- additional Admin creation

No detailed auth-event logging contract is mandated here because the source documents do not define one.

---

## 21. Account Status Considerations

The Admin feature set defines status management for other user accounts and describes registration states such as:

```text
PENDING
APPROVED
REJECTED
```

The general system auth flow applies approval before sign-in to:

- Customer / Buyer
- Seller
- Logistics

Courier approval is performed by Logistics.

The current source documents do **not** state that the initial Admin or additional Admins go through the same approval workflow.

Therefore, Admin authentication must not automatically require `APPROVED` unless a separate Admin-account status rule is later defined.

---

## 22. Email / Notification Considerations

The system uses Brevo for sending emails.

The general auth flow references approval-related email before sign-in for:

- Customer / Buyer
- Seller
- Logistics

No equivalent Admin verification-email requirement is defined.

Therefore, Admin login must not depend on an invented email-verification flow.

Future flows such as:

- Admin invitation
- password reset
- suspicious-login alerts
- 2FA codes

may use the existing email infrastructure, but they require separate specifications.

---

## 23. Recommended API Contract

The source explicitly defines the Sanctum CSRF and login flow but does not fully define all Admin auth route names.

The following is a recommended contract, subject to existing repository conventions:

### Initialize CSRF

```http
GET /sanctum/csrf-cookie
```

Purpose:

```text
initialize Laravel Sanctum CSRF protection
```

### Admin Login

```http
POST /login
```

Request:

```json
{
  "email": "admin@example.com",
  "password": "********"
}
```

Server behavior:

```text
resolve user by email + ADMIN role
verify password
establish session
return success
```

### Current Admin

```http
GET /api/user
```

or repository-equivalent Admin identity endpoint.

Server behavior:

```text
require authenticated session
require ADMIN role
return safe Admin identity
```

### Logout

```http
POST /logout
```

Server behavior:

```text
require/resolve current session
invalidate session
return success
```

Exact route naming beyond `/sanctum/csrf-cookie` and `/login` should follow the codebase.

---

## 24. Security Requirements

The Admin authentication implementation must satisfy the following:

### Required

- use stateful Laravel web sessions
- use `HttpOnly` session cookies
- use CSRF protection
- identify Admin accounts by both email and role
- enforce Admin access on the backend
- hash stored passwords
- keep plaintext passwords out of source control
- keep plaintext passwords out of logs
- prevent other AISLEY roles from entering the Admin application
- prevent protected Admin content from rendering before auth resolution
- invalidate server-side authentication on logout
- return only safe identity data to the frontend

### Prohibited

- storing Admin auth tokens in `localStorage`
- storing Admin auth tokens in `sessionStorage`
- using Courier/mobile personal access tokens for Admin web authentication
- trusting a frontend-provided role without server enforcement
- authenticating solely by email when duplicate emails across roles are permitted
- exposing password hashes or session identifiers
- implementing public Admin signup

---

## 25. Functional Acceptance Criteria

### AC-01 — Initial Admin Bootstrap

Given valid Admin credentials exist in environment configuration, when the system bootstrap process runs and no Admin with that email exists, an Admin account is created with the Admin role and a hashed password.

### AC-02 — Bootstrap Role Scope

Given a Buyer, Seller, Logistics, or Courier exists with the same email as the configured initial Admin, the system still treats the Admin identity as a separate `(email, ADMIN)` account.

### AC-03 — Bootstrap Idempotency

Given the initial Admin already exists, rerunning the bootstrap process does not create a duplicate Admin account.

### AC-04 — CSRF Initialization

Given the Admin is on the login page, when login is attempted, the web application initializes Sanctum CSRF protection before submitting credentials.

### AC-05 — Valid Admin Login

Given valid credentials for an Admin account, when login succeeds, the server establishes a stateful session and the frontend redirects the Admin to `/dashboard`.

### AC-06 — Invalid Password

Given an Admin email and incorrect password, when login is attempted, access is denied and no authenticated Admin session is established.

### AC-07 — Cross-Role Isolation

Given valid credentials for a Buyer, Seller, Logistics user, or Courier, when those credentials are submitted to the Admin login flow, Admin access is denied.

### AC-08 — Duplicate Email Across Roles

Given the same email exists for both Admin and another role, when the Admin password is submitted, the Admin record is the identity used for Admin authentication.

### AC-09 — Session Restoration

Given a browser already holds a valid Admin session, when the Admin application is reopened, the frontend can resolve the authenticated Admin without requiring credentials again while the session remains valid.

### AC-10 — Protected Dashboard

Given no valid Admin session exists, when `/dashboard` is opened, protected Admin content is not shown and the user is directed to `/login`.

### AC-11 — Authenticated Login Redirect

Given a valid Admin session already exists, when `/login` is opened, the Admin is directed to `/dashboard`.

### AC-12 — Backend Role Enforcement

Given an authenticated session belongs to a non-Admin AISLEY role, when an Admin-only backend endpoint is requested, access is denied.

### AC-13 — Logout

Given an authenticated Admin session, when logout is performed, the server invalidates the session and subsequent protected requests no longer authenticate.

### AC-14 — No Client Token Persistence

Given an Admin successfully logs in, no bearer token or session identifier is intentionally persisted by application code in localStorage or sessionStorage.

### AC-15 — Safe Identity Payload

Given the frontend requests the authenticated Admin identity, the response contains only frontend-safe identity/authorization data and does not contain password or session secrets.

---

## 26. Suggested Test Coverage

### Backend

Test:

- initial Admin is created from environment configuration
- initial Admin password is stored hashed
- bootstrap is idempotent
- same email can coexist across different roles
- duplicate `(email, ADMIN)` is rejected
- valid Admin credentials authenticate
- invalid Admin password is rejected
- valid non-Admin credentials cannot enter the Admin context
- Admin session can access protected Admin endpoint
- guest cannot access protected Admin endpoint
- authenticated non-Admin cannot access Admin endpoint
- logout invalidates Admin authentication

### Frontend

Test where project infrastructure permits:

- login form submits email and password
- CSRF initialization occurs before login
- successful login redirects to dashboard
- invalid credentials display a safe error
- protected content does not flash before session resolution
- unauthenticated dashboard access redirects to login
- existing Admin session bypasses login
- logout returns to login
- auth credentials are not stored in browser storage by application code

---

## 27. Open Decisions

The following are not sufficiently defined by the current source documents:

1. Exact environment variable names for the initial Admin.
2. Exact backend route for retrieving the current authenticated Admin.
3. Exact logout route if the repository does not already use `/logout`.
4. Exact session lifetime and idle timeout.
5. Whether Admin sessions support "remember me".
6. Password complexity requirements.
7. Forgot-password / password-reset flow.
8. Admin email verification.
9. Admin invitation flow for additional Admin accounts.
10. Exact custom-permission data model.
11. Whether Admin accounts can be suspended/deactivated and how that affects active sessions.
12. Exact Two-Factor Authentication behavior.
13. Authentication-event audit logging requirements.
14. Concurrent-session policy.
15. Session invalidation behavior after password or permission changes.

These decisions should be specified before their corresponding features are implemented.

---

## 28. Source-Derived Auth Summary

The authoritative Admin authentication model from the current AISLEY documents can be summarized as:

```text
AISLEY users share one user system
        ↓
identity uniqueness = (email, role)
        ↓
Admin is a dedicated web role/domain
        ↓
first Admin comes from .env email + password
        ↓
Admin web app uses Laravel Sanctum
        ↓
GET /sanctum/csrf-cookie
        ↓
POST /login
        ↓
authenticate the ADMIN-role identity
        ↓
Laravel encrypted HttpOnly session cookie
        ↓
authenticated Admin enters Dashboard
        ↓
initial Admin may later add Admins
with custom permissions
```

This role-aware, stateful session model is the foundation for all future Admin features.
