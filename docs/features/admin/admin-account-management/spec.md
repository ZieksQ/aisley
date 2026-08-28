---
feature: Admin Account Management
system: AISLEY
type: Feature Specification
version: 2.1
status: Draft
scope: Admin Web Application / Authenticated Admin Self-Service
source_coverage: Admin.md, app.md, existing Admin architecture
---

# Admin Account Management Specification

## 1. Purpose

Admin Account Management is the self-service settings area for the currently authenticated AISLEY Admin. It covers the Admin's own profile, login credentials, supported preferences, and security settings such as Two-Factor Authentication (2FA).

`Admin.md` defines the feature as:

```text
Update Admin information. Basically account settings.
A self-service portal for the administrator's own profile.
It permits updating:
- login credentials
- personal identification details
- system preferences
- security settings
- Two-Factor Authentication
Standard profile management,
heavily gated by authentication middleware.
```

This file defines requirements, boundaries, APIs, security rules, acceptance criteria, tests, and open decisions. Step-by-step sequences are kept in `flow.md`.

---

## 2. Source Constraints

From `app.md`:

```text
all roles live in the same users table
unique(email, role)
```

Admin web authentication uses:

```text
Laravel Sanctum
stateful HttpOnly session cookies
CSRF protection
```

The initial Admin is created from:

```text
.env email + password
```

and the system later supports adding Admins with custom permissions.

These facts create four important rules:

1. Admin Account Management is self-service for the current Admin.
2. It must never update another role-account that happens to share the same email.
3. It must never allow an Admin to modify their own role or permissions.
4. It must operate through the existing authenticated Sanctum session.

---

## 3. Feature Ownership

This feature owns:

- current Admin profile view
- supported profile edits
- login credential changes
- password changes
- supported Admin preferences
- security settings
- 2FA configuration when implemented
  This feature does not own:
- creating other Admins
- partner creation
- assigning custom Admin permissions
- editing another Admin
- suspending another Admin
- deleting another Admin
- Buyer/Seller/Logistics/Courier account management
- password recovery
- SSO
- active session/device management
- IP allowlisting
- arbitrary infrastructure settings

---

## 4. Primary Actor

The normal actor is:

```text
the currently authenticated Admin
```

The backend must derive the target account from the authenticated session.

A self-service request must never use a client-supplied:

```text
admin_id
user_id
email
```

as the authoritative target.

Conceptually:

```text
target_admin_id = authenticated_admin.id
```

---

## 5. Identity and Cross-Role Safety

AISLEY allows:

```text
alex@example.com + ADMIN
alex@example.com + SELLER
alex@example.com + BUYER
```

as separate accounts.

Therefore:

- changing the Admin profile affects only the `ADMIN` account
- changing the Admin password affects only the `ADMIN` account
- changing the Admin email, if supported, affects only the `ADMIN` account
- preferences belong to the Admin account
- 2FA belongs to the Admin account
- authorization must use account ID/session identity, not email equality
  A same-email account under another role must never inherit Admin profile/security changes.

---

## 6. Information Architecture

Recommended route:

```text
/settings/account
```

or:

```text
/account
```

Recommended sections:

```text
Profile
Login & Security
Preferences
```

The exact route follows repository conventions.

---

## 7. Profile Requirements

The Profile section displays and updates supported Admin profile fields.

The source says:

```text
personal identification details
```

but does not define exact fields. The implementation must therefore use the real Admin/user schema instead of inventing mandatory fields.

Possible fields, only if they exist in the repository:

- name
- display name
- email
- avatar/profile image
- other existing Admin profile attributes
  Read-only fields should include, where present:
- user/account ID
- role
- account status
- permissions
- created date
- system ownership metadata
  The profile form must use an explicit allowlist. It must not mass-assign arbitrary user columns.

Forbidden self-service fields include:

```text
role
permissions
is_super_admin
account status
password hash
2FA secret
created_by
audit metadata
```

---

## 8. Email Changes

The source says login credentials may be updated, but it does not explicitly state that the Admin email itself is editable.

Therefore:

```text
Admin email editing = Open Decision
```

If implemented:

- validate the new email
- preserve `unique(email, ADMIN)`
- do not modify same-email accounts under other roles
- apply the selected security verification policy
- audit the change safely
- apply the selected session invalidation policy
  Possible extra controls, still Open Decisions:
- current password confirmation
- fresh authentication
- 2FA confirmation
- verification of the new email
- notification to the previous email

---

## 9. Password Change

Password change is part of login credential management.

The backend must:

1. authenticate the current Admin
2. perform any required security re-verification
3. validate the new password using the shared authentication policy
4. hash the password using framework conventions
5. persist only the hash
6. apply the chosen session policy
7. create a safe Audit Log event
   Never:

- store plaintext passwords
- return password hashes
- log current/new passwords
- place password hashes in Audit Logs
  The source does not define password length, complexity, reuse, expiration, breach checking, or history. Those belong to the shared authentication policy.

---

## 10. Session Behavior After Credential Changes

The source does not define whether changing password/email should:

```text
keep the current session
invalidate other sessions
invalidate all sessions
require a new login
```

This is an Admin Auth security decision.

Account Management must call the shared session policy rather than inventing behavior locally.

---

## 11. Bootstrap Admin Boundary

`app.md` states:

```text
initial admin created
(use .env for email and password)
```

Recommended interpretation:

```text
.env
    bootstraps the initial Admin
database user record
    becomes the normal ongoing Admin account
```

The Account Management UI must not edit `.env` or deployment secrets.

Whether bootstrap logic runs once or re-syncs later remains an Open Decision.

---

## 12. Preferences

`Admin.md` permits:

```text
system preferences
```

but does not define exact preference types.

The implementation should support only typed, known settings actually used by the Admin application.

Possible future examples:

- dashboard display preferences
- timezone
- locale
- table density
- notification preferences
- theme
  These are examples, not source requirements.

Do not expose:

```text
raw JSON editor
arbitrary key/value editor
```

A preference must never affect:

```text
role
permissions
account status
authorization
```

---

## 13. Security Settings

The Security section should expose only safe security state.

Examples:

```text
2FA enabled
2FA disabled
```

It must never expose:

- password hash
- session cookie
- access token
- CSRF secret
- 2FA secret
- OTP code
- recovery-code plaintext

---

## 14. Two-Factor Authentication

2FA is explicitly mentioned in `Admin.md`, but its mechanism is undefined.

Possible implementations include:

- TOTP authenticator
- email OTP
- SMS OTP
- passkey/security key
  No specific mechanism is required until the project chooses one.

At minimum, if 2FA is implemented, the feature should support:

```text
start setup
verify setup
enable 2FA
disable 2FA
show safe enabled/disabled status
```

2FA must not be marked enabled merely because setup was started.

The security mechanism must be verified first.

---

## 15. 2FA Secret Protection

Never expose or audit:

```text
2FA secret
OTP
recovery-code plaintext
```

If recovery codes exist, they must follow the selected security library's secure storage and display rules.

The exact recovery flow is Open.

---

## 16. Relationship to Admin Auth

Account Management configures credentials and security state.

Admin Auth enforces authentication.

```text
Account Management
    password / 2FA configuration
        ↓
Admin Auth
    login/session/2FA enforcement
```

Account Management does not replace the Admin Auth login/session flow.

---

## 17. Authentication Requirement

Every Account Management page and API requires:

```text
authenticated user
role = ADMIN
```

This is directly supported by `Admin.md`, which says the feature must be heavily gated by authentication middleware.

Frontend route protection alone is insufficient.

Backend authentication is authoritative.

---

## 18. Authorization Rules

Self-service Account Management must never allow:

```text
self-role change
self-permission escalation
self-super-admin escalation
other-Admin editing
```

Critical invariant:

```text
The Admin can update their own profile/security settings,
but cannot use Account Management to increase authority.
```

---

## 19. Self-Delete and Self-Deactivation

The source does not say Admins can delete or deactivate themselves.

These are not MVP requirements.

They require separate governance because an Admin could otherwise lock the platform out of administrative access.

---

## 20. Sanctum and CSRF

Admin web applications use stateful `HttpOnly` session cookies.

State-changing Account Management requests must:

- require the current authenticated session
- use CSRF protection
- derive identity from the session
- avoid storing web auth tokens in localStorage/sessionStorage

---

## 21. Session Expiration

If the session expires while the Admin is editing Account Settings:

```text
save request
    ↓
backend returns unauthenticated
    ↓
frontend clears authenticated state
    ↓
no false success
    ↓
redirect/login recovery
```

---

## 22. Fresh Authentication

Fresh authentication is recommended for high-risk actions such as:

- changing password
- changing email
- enabling 2FA
- disabling 2FA
- regenerating recovery codes
  The source does not mandate the exact mechanism or timeout.

---

## 23. Recommended API Surface

Conceptual endpoints:

```http
GET    /api/admin/account
PATCH  /api/admin/account/profile
POST   /api/admin/account/password
PATCH  /api/admin/account/preferences
GET    /api/admin/account/security
POST   /api/admin/account/two-factor/setup
POST   /api/admin/account/two-factor/confirm
DELETE /api/admin/account/two-factor
```

Only implement routes supported by the selected security architecture.

---

## 24. GET /api/admin/account

Returns safe current-Admin data such as:

```text
id
name
email
role
supported profile fields
supported preferences
safe security status
```

It must not return secrets.

---

## 25. PATCH /api/admin/account/profile

Backend responsibilities:

```text
authenticate Admin
derive target Admin from session
allowlist fields
validate values
preserve unique(email, ADMIN) if email is editable
persist
audit consequential changes
return safe updated profile
```

---

## 26. POST /api/admin/account/password

Backend responsibilities:

```text
authenticate
perform required security verification
validate new password
hash
persist
apply shared session policy
emit ADMIN_PASSWORD_CHANGED
```

Never include credentials in the Audit payload.

---

## 27. PATCH /api/admin/account/preferences

Backend responsibilities:

```text
authenticate
accept supported preference keys only
validate types/values
persist
return updated preferences
```

Unknown keys must not mutate arbitrary account columns.

---

## 28. 2FA API

Exact endpoints depend on the chosen 2FA implementation.

The minimum lifecycle is:

```text
setup
verification
enabled
disable
```

The detailed sequence belongs in `flow.md`.

---

## 29. Data Model

The Admin remains a record in the shared users table.

Do not create a separate duplicate login identity solely for this feature.

Role remains:

```text
ADMIN
```

and is read-only in self-service.

Preferences may use:

- typed columns
- a dedicated preferences table
- validated application-owned JSON
  The exact storage model is Open.

2FA storage must follow the chosen framework/security library.

---

## 30. Audit Logs Integration

Security-sensitive changes must use the shared System Audit Logs feature.

Recommended actions:

```text
ADMIN_PROFILE_UPDATED
ADMIN_EMAIL_CHANGED
ADMIN_PASSWORD_CHANGED
ADMIN_2FA_ENABLED
ADMIN_2FA_DISABLED
ADMIN_SECURITY_SETTING_CHANGED
```

Exact event names follow the central Audit taxonomy.

Audit data may include:

- actor Admin ID
- action
- safe changed field names
- safe before/after values where permitted
- timestamp
  Never include:
- password
- password hash
- OTP
- 2FA secret
- recovery-code plaintext
- session cookie
- access token

---

## 31. Cross-Feature Boundaries

### Admin Auth

Owns:

```text
login
session creation
session restoration
logout
2FA enforcement during login
```

### Admin Account Management

Owns:

```text
self profile
credential changes
preferences
security configuration
```

### Manage User Accounts

Owns:

```text
Buyer
Seller
Logistics
Courier
```

not Admin self-service.

### Admin Governance

`app.md` mentions:

```text
add admins with custom permissions
```

This is separate from self-service Account Management.

### Platform Settings

Owns global:

```text
announcements
Terms
Privacy
internal rules
```

not personal Admin preferences.

### Global Ban / Blocklist

Security blocks cannot be removed through Account Management.

---

## 32. Frontend Requirements

Recommended Account Settings layout:

```text
Profile
--------------------
Name
Email (if editable)
[Save]
Login & Security
--------------------
Password
2FA status
[Change Password]
[Configure 2FA]
Preferences
--------------------
Only supported preference controls
[Save]
```

Separate forms are recommended so a password/security action cannot accidentally update profile/preferences.

---

## 33. UI States

Profile:

```text
loading
loaded
dirty
saving
saved
validation error
server error
session expired
```

Password:

```text
idle
submitting
success
verification error
validation error
session expired
```

2FA:

```text
disabled
enrolling
verifying
enabled
disabling
error
```

Preferences:

```text
loading
saving
saved
validation error
```

---

## 34. Validation

All validation is server-side authoritative.

Frontend validation only improves UX.

Profile validation uses the actual schema.

If email is editable:

```text
valid email
unique(email, ADMIN)
```

Password validation uses shared auth rules.

Preferences use a strict allowlist of known keys and value types.

---

## 35. Mass Assignment Protection

A malicious request containing fields such as:

```text
role
permissions
is_super_admin
status
password_hash
two_factor_secret
```

must not change them.

The endpoint should reject or ignore forbidden fields according to backend convention.

---

## 36. Sensitive Logging

Application logs must not intentionally contain:

```text
plaintext passwords
password hashes
OTP codes
2FA secrets
recovery codes
session cookies
Bearer tokens
```

Use IDs/action names for diagnostics instead.

---

## 37. Error Handling

Use safe user-facing errors such as:

```text
Unable to update profile.
This email is already used by another Admin account.
The security verification failed.
The verification code is invalid or expired.
Your session has expired.
```

Do not expose:

- stack traces
- SQL errors
- password hashes
- provider secrets

---

## 38. Concurrency

Two tabs may edit the same Admin account.

Recommended:

```text
updated_at
version column
optimistic conflict detection
```

for profile/preferences.

Exact mechanism is Open.

---

## 39. Idempotency

Repeated submission of the same profile/preferences should be harmless.

2FA setup/disable must validate current security state so retries do not create inconsistent enrollment.

---

## 40. Accessibility

The UI should:

- use semantic labels
- support keyboard navigation
- associate validation errors with inputs
- expose success/failure messages to assistive technologies
- show 2FA status with text, not color alone
- use accessible confirmation dialogs

---

## 41. Responsive Behavior

Account Settings must remain usable on smaller screens.

Forms should stack, long email values should wrap, and security controls must remain accessible.

---

## 42. Performance

This is a low-volume self-service feature.

Prioritize:

```text
security
correctness
clear state
```

over aggressive caching.

Do not cache one Admin's profile in a way that can leak into another Admin session.

---

## 43. MVP Scope

### Required

- authenticated Account Settings page
- current Admin profile view
- supported profile updates
- role read-only
- self-target-only backend
- password change
- shared password hashing/policy
- typed preference architecture
- security settings section
- 2FA configuration if selected for MVP
- CSRF protection
- `(email, role)` isolation
- no cross-role updates
- no self-permission escalation
- no self-role change
- secret redaction
- Audit Log integration for security-sensitive changes
- loading/saving/error states

### Recommended

- fresh authentication for sensitive changes
- dedicated email-change flow if email is editable
- optimistic concurrency protection
- explicit confirmation before disabling 2FA

### Not Required

- manage other Admins
- assign custom permissions
- self-delete
- self-deactivation
- SSO
- passkeys
- hardware security keys
- active-session list
- login history
- device management
- IP allowlisting
- arbitrary settings editor

---

## 44. Acceptance Criteria

### AC-01 — Authenticated Access

An authenticated Admin can open Account Settings.

### AC-02 — Guest Denied

An unauthenticated request cannot access Account Management APIs.

### AC-03 — Non-Admin Denied

An authenticated non-Admin role cannot access Admin Account Management.

### AC-04 — Self Target

Admin A can update only Admin A through self-service.

### AC-05 — Client Target Injection

Supplying Admin B's ID in Admin A's request does not retarget the mutation.

### AC-06 — Role Read-Only

Self-service cannot change the `ADMIN` role.

### AC-07 — Permissions Read-Only

Self-service cannot grant or revoke Admin permissions.

### AC-08 — Profile Update

Valid allowlisted profile fields can be saved.

### AC-09 — Cross-Role Isolation

Updating an Admin account does not update same-email Seller/Buyer/etc. accounts.

### AC-10 — Email Uniqueness

If email editing is supported, `(email, ADMIN)` uniqueness is enforced.

### AC-11 — Password Change

A valid new password can be saved after required security verification.

### AC-12 — Password Safety

The password is hashed and is never returned/logged in plaintext.

### AC-13 — Password Audit

A successful password change creates a safe Audit event without credential data.

### AC-14 — 2FA Status

If implemented, 2FA status can be displayed without exposing the secret.

### AC-15 — 2FA Verification

2FA is not enabled until setup verification succeeds.

### AC-16 — 2FA Audit

2FA enable/disable events are audited without secret/OTP/recovery values.

### AC-17 — Preferences

Supported typed preferences can be updated.

### AC-18 — Unknown Preferences

Unknown preference keys cannot mutate arbitrary account fields.

### AC-19 — Preferences Do Not Change Authorization

Preference changes do not grant permissions or change role/status.

### AC-20 — CSRF

State-changing web requests require the configured Sanctum CSRF protections.

### AC-21 — Expired Session

An expired session causes the mutation to fail and the frontend must not show false success.

### AC-22 — Secret Response Safety

Account APIs do not return passwords, hashes, tokens, session IDs, or 2FA secrets.

### AC-23 — No Self Delete

Self-delete is not exposed as an MVP capability.

### AC-24 — No Self Deactivate

Self-deactivation is not exposed as an MVP capability.

### AC-25 — No Other Admin Management

This feature cannot edit another Admin or their permissions.

### AC-26 — Bootstrap Separation

Self-service does not rewrite `.env` credentials.

### AC-27 — Audit Identity

Historical Audit Logs remain linked to the same Admin account after profile changes.

### AC-28 — Safe Logging

Technical logs do not intentionally persist passwords, OTPs, 2FA secrets, recovery codes, or tokens.

---

## 45. Backend Tests

Test:

- guest denied
- Buyer denied
- Seller denied
- Logistics denied
- Courier denied
- Admin can load own account
- Admin A cannot update Admin B
- injected user ID ignored/rejected
- role cannot change
- permissions cannot change
- profile allowlist works
- same-email role account remains unchanged
- Admin email uniqueness enforced if editable
- password is hashed
- plaintext password never stored
- password/hash not returned
- password/hash not audited
- CSRF required
- expired session denied
- 2FA secret never returned
- 2FA not enabled before verification
- safe 2FA audit events
- unsupported preferences rejected
- preferences cannot change permissions
- `.env` is not changed by self-service

---

## 46. Frontend Tests

Test:

- page loads
- current Admin profile renders
- role is read-only
- permissions are not editable
- profile loading/success/error states
- password inputs are secure
- password is not redisplayed
- 2FA status renders safely
- 2FA setup appears only if supported
- preferences render only supported options
- expired session is handled
- narrow viewport remains usable
- keyboard navigation works
- errors are accessible

---

## 47. Open Decisions

The current sources do not define:

1. exact Admin profile fields
2. whether Admin email is editable
3. whether email change requires verification
4. whether email change requires current password
5. whether email change requires 2FA
6. exact password policy
7. whether current password is required for password change
8. whether fresh authentication is required
9. password-change session invalidation
10. email-change session invalidation
11. exact 2FA mechanism
12. TOTP vs email/SMS OTP
13. recovery-code support
14. 2FA recovery/reset
15. exact Admin preferences
16. timezone/locale preferences
17. notification preferences
18. avatar support
19. active-session management
20. login history
21. exact endpoint names
22. optimistic-locking mechanism
23. audit granularity for normal profile changes
24. audit behavior for cosmetic preferences
25. initial Admin recovery rules
26. `.env` bootstrap re-sync behavior
27. other-Admin management rules
28. custom-permission administration rules
29. second-Admin approval for security changes
30. self-deactivation policy
31. self-delete policy

---

## 48. Final Definition

AISLEY Admin Account Management is:

```text
an authenticated,
Admin-only,
self-service account settings feature
covering:
    own profile
    login credentials
    password
    supported preferences
    security settings
    2FA when implemented
while enforcing:
    self-target-only updates
    role = ADMIN
    unique(email, role)
    CSRF
    no self-permission escalation
    no self-role mutation
    no secret exposure
    Audit Log coverage for sensitive changes
```

The central rule is:

```text
An Admin may manage their own profile and security,
but may not use Account Management
to change their authority or another Admin account.
```
