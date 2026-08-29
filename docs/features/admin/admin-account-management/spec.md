---
feature: admin-account-management
title: Admin Account Management
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Admin
scope: Admin Web Application
---

# Admin Account Management

## WHAT

- **Feature:** Admin Account Management for the AISLEY Admin web application.
- **Purpose:** Let the currently authenticated Admin manage their own account information, login credentials, preferences, and security settings without exposing another user's account-management controls.
- **Primary actor:** The currently authenticated AISLEY `ADMIN` role-account.
- **Source-defined scope:**
  - update Admin information
  - manage login credentials
  - manage personal identification details
  - manage system preferences
  - manage security settings such as Two-Factor Authentication (2FA)
  - require authentication middleware around the feature
- **Project boundary:**
  - Next.js/React owns the account-settings page, forms, loading/error/success states, and calls to Laravel.
  - Laravel owns authenticated identity, authorization, validation, sensitive-change verification, persistence, session effects, events, and audit records.
  - The frontend edits only the current Admin account; it does not select an arbitrary Admin ID.
- **Relationship to Admin Authentication:**
  - Admin Authentication establishes the authenticated `ADMIN` session.
  - Admin Account Management consumes that session.
  - Password changes belong to this feature.
  - 2FA configuration belongs to this feature, but the exact 2FA mechanism is not defined by current project sources.
  - Session behavior after password/security changes must follow the shared Admin Authentication policy once that policy is decided.
- **Relationship to Manage User Accounts:**
  - This feature manages the current Admin's own account only.
  - Managing Buyer, Seller, Courier, Logistics, or other Admin accounts belongs to **Manage User Accounts** or a future dedicated Admin-management feature.
- **Recommended UI grouping:**
  - Profile
  - Security
  - Preferences
- **Conceptual route:**

```text
/account
```

or the repository's established Admin settings route.

- **Non-goals:**
  - managing another user's profile
  - creating additional Admins
  - assigning Admin permissions
  - public Admin registration
  - account approval
  - forgot-password/recovery
  - choosing a new 2FA technology without repository/project approval
  - active-session/device management unless separately specified
  - login-history UI unless separately specified

## MUST

### Access control

- Every account-management read or mutation must require:
  - an authenticated session
  - persisted role = `ADMIN`
  - authorization for the current Admin account
- The API must derive the target Admin from the authenticated session.
- The client must not be allowed to submit another `user_id` / `admin_id` to edit another account through this feature.
- React route guards are convenience only; Laravel authorization is authoritative.
- Use project-standard response semantics:
  - `401` for unauthenticated
  - `403` for authenticated but forbidden
  - `422` for validation failures
  - `409` when an update conflicts with current persisted state and the project uses conflict handling

### Account overview

- The page must load the current Admin's editable account state from Laravel.
- Return only fields required by the account-settings UI.
- Never return:
  - password hash
  - plaintext password
  - session identifiers
  - CSRF secrets
  - 2FA secret material unless a specific enrollment flow requires a one-time authorized representation
  - recovery codes outside the authorized recovery-code management flow
- Sensitive profile/contact values must follow the project's masking/privacy rules.
- Loading, forbidden, validation-error, server-error, and success states must be explicit.

### Profile information

- The feature must allow the Admin to update the profile/personal-identification fields that the real AISLEY account schema marks as Admin-editable.
- Current sources do **not** define the exact editable field list.
- Do not invent additional profile columns solely for this feature.
- Server-side validation is required for every editable field.
- Client-side validation may improve UX but must not replace Laravel validation.
- Fields that are immutable or managed by deployment/system configuration must not be writable from the browser.
- The Admin role itself must not be editable through this self-service feature.
- Admin permissions must not be editable through this self-service feature.

### Login identity / email

- AISLEY authentication uses role-aware identity equivalent to:

```text
unique(email, role)
```

- If the Admin email is editable in the actual account schema:
  - treat the change as a sensitive account action
  - require recent re-authentication/current-password verification
  - validate the new email server-side
  - preserve the `email + ADMIN` uniqueness rule
  - reject collisions with another `ADMIN` role-account
  - do not allow the client to change the account role as part of the email update
- A same email used by a different role does not automatically violate the project's role-aware identity rule.
- Whether a changed Admin email must be verified before becoming the login identity is an **Open Question**; current project sources do not define it.
- If email is not editable in the repository, omit email editing rather than inventing it.

### Password change

- Password change is owned by this feature.
- Password change must require:
  - an authenticated Admin session
  - current-password verification or an equivalent recent re-authentication mechanism
  - new password
  - new-password confirmation
- Use Laravel/framework password hashing; never store plaintext passwords.
- New-password validation must use the project's password policy.
- If no project password rule exists yet, define one centrally rather than duplicating independent rules in React and Laravel.
- Laravel supports:
  - authenticated-user current-password validation
  - framework password-rule objects
  - compromised-password checks when selected by project policy
- The password mutation must not return the password or hash.
- A failed current-password check must not modify the account.
- A successful password change must be recorded as a security-sensitive account mutation in the appropriate audit/security trail.
- Session behavior after password change is an **Open Question** inherited from Admin Authentication:
  - keep current session only
  - revoke other sessions
  - revoke all sessions and require login
- Do not silently choose a session-revocation policy in implementation.

### Re-authentication for sensitive changes

- An active session alone is not sufficient proof for high-risk account changes.
- Require current credentials or the project's approved step-up authentication for sensitive actions, including at minimum:
  - password change
  - email/login-identity change, if supported
  - enabling 2FA
  - disabling 2FA
  - replacing/resetting 2FA factors
  - regenerating recovery codes
- Re-authentication must be performed and validated by Laravel.
- Do not implement sensitive-action confirmation using frontend-only flags.
- If the project already uses Laravel password-confirmation middleware/state, reuse it.
- Otherwise use dedicated current-password validation for each sensitive mutation until a shared confirmation mechanism is established.

### Two-Factor Authentication settings

- `Admin.md` places 2FA/security settings under Admin Account Management.
- This feature owns the Admin-facing 2FA configuration UI.
- Current project sources do not define:
  - TOTP vs SMS vs email OTP vs passkeys
  - enrollment flow
  - recovery flow
  - mandatory vs optional 2FA
  - recovery-code format
- Do not invent one of those mechanisms as a project requirement.
- Until the backend mechanism is selected, the spec requires only the integration boundary:
  - expose current 2FA status when supported
  - require re-authentication before 2FA changes
  - never expose stored 2FA secrets in normal profile responses
  - hand login challenge behavior back to Admin Authentication
- **Recommended if the repository already uses Laravel Fortify:**
  - reuse Fortify's TOTP-based 2FA rather than creating a custom cryptographic implementation
  - support enable, confirm, disable, and recovery-code management through Fortify's established backend behavior
  - require password confirmation before modifying 2FA
- If Fortify is not present, do not add it solely because this document mentions it without first comparing it to the repository's existing authentication stack.
- Because Admin is a privileged role, enabling MFA for Admins is strongly recommended by current security guidance, but whether it is mandatory is an **Open Question**.

### Preferences

- The source includes "system preferences" in Admin Account Management.
- Current project sources do not define the preference keys.
- The feature must only expose preferences that are defined elsewhere in the project/schema/configuration.
- Do not invent notification, theme, locale, timezone, dashboard, or accessibility preferences unless the project establishes them.
- Preference mutations must be validated and scoped to the current Admin.
- Preference changes that affect presentation may update the frontend immediately after the backend confirms persistence.

### Security settings

- The Security section may include only settings supported by the actual repository.
- At minimum, this feature must provide password management.
- 2FA settings should appear when the approved backend mechanism exists.
- Do not display security secrets in normal settings views.
- High-risk security changes must require re-authentication.
- Security-setting changes must be auditable without logging secret values.

### Audit trail

- The system-flow contract requires security-sensitive and administrative mutations to be recorded in the appropriate audit trail.
- Account-management mutations should record safe metadata such as:
  - acting Admin ID
  - action type
  - timestamp
  - changed field names or safe before/after metadata when policy permits
  - request/correlation ID when available
- Audit entries must not contain:
  - plaintext passwords
  - password hashes
  - current-password submissions
  - 2FA secrets
  - OTP codes
  - recovery codes
  - session identifiers
- Profile, credential, and security-setting persistence must not fail solely because an asynchronous notification fails.
- If audit recording is required synchronously by the project's audit design, follow that design instead of silently downgrading it.

### Concurrency and stale data

- Account mutations must target the authenticated Admin only.
- If multiple tabs/devices can edit the same account, stale updates must not silently overwrite security-sensitive data.
- Prefer narrow endpoints/forms per concern so profile, password, preferences, and 2FA changes do not overwrite unrelated fields.
- If the repository already uses optimistic concurrency/version fields, preserve that convention.
- Otherwise conflict handling for ordinary profile fields is an implementation choice; do not add complex versioning without need.

### Frontend behavior

- Recommended page sections:
  - Profile
  - Security
  - Preferences
- Each mutation must have:
  - idle state
  - submitting state
  - field validation errors
  - forbidden/reauth-required state when applicable
  - success feedback
  - server/network error state
- Disable duplicate submission while a mutation is in progress.
- After successful profile changes, refresh/update the shared current-Admin state so navigation/header information does not remain stale.
- After a credential/security change that invalidates the current session, follow Admin Authentication and return to `/login`.
- Do not optimistically display sensitive changes as successful before Laravel confirms them.

### Accessibility

- Forms must:
  - use semantic labels
  - support keyboard navigation
  - associate validation messages with fields
  - expose success/error messages accessibly
  - not communicate status using color alone
- Password fields must use appropriate autocomplete values.
- 2FA/recovery UI, if implemented, must remain keyboard accessible and not depend only on QR scanning where a manual setup value is required by the chosen provider.

### Acceptance criteria

- [ ] Guest users cannot open or mutate Admin account settings.
- [ ] Authenticated non-Admin roles cannot use Admin account-management APIs.
- [ ] The target account is derived from the authenticated Admin, not a submitted Admin ID.
- [ ] Current Admin account data loads without exposing password/session/security secrets.
- [ ] Only repository-defined editable profile fields can be changed.
- [ ] Role cannot be changed through self-service account management.
- [ ] Admin permissions cannot be changed through self-service account management.
- [ ] Profile validation is enforced by Laravel.
- [ ] Password change requires current-password/re-authentication verification.
- [ ] Wrong current password leaves the stored password unchanged.
- [ ] New password is stored using Laravel/framework hashing.
- [ ] New password confirmation is required.
- [ ] Password/hash values are never returned by the API.
- [ ] Password changes are recorded safely in the audit/security trail.
- [ ] Email change, if supported, requires re-authentication.
- [ ] Email change, if supported, preserves `email + ADMIN` uniqueness.
- [ ] A same-email account under a non-Admin role does not automatically block an Admin email under the role-aware identity model.
- [ ] 2FA secret material is not included in normal account DTOs.
- [ ] 2FA changes, when implemented, require re-authentication.
- [ ] Preferences expose only project-defined keys.
- [ ] Mutations cannot overwrite unrelated account/security fields.
- [ ] Successful updates refresh the frontend's current-Admin state.
- [ ] Session invalidation after a sensitive change follows the shared Admin Auth policy.
- [ ] Validation, forbidden, re-auth-required, success, and server-error states are represented in the UI.
- [ ] Audit/log output never contains passwords, 2FA codes/secrets, recovery codes, or session identifiers.

## HOW

### Project findings

- Available project material contains architecture/specification documents, not the Laravel/Next.js application source or package manifests.
- `Admin.md` defines Account Management as self-service updates to Admin information, login credentials, personal identification details, preferences, and 2FA/security settings.
- The Admin Authentication spec explicitly assigns password changes and 2FA configuration to Admin Account Management.
- The system-flow contract requires:
  - Next.js for UI/presentation
  - Laravel for validation, authorization, persistence, events, and security-sensitive behavior
  - Form Requests / Policies / Gates
  - API Resources or equivalent response conventions
  - audit trails for administrative/security-sensitive mutations
- Exact Eloquent fields, existing settings routes, auth packages, preference schema, and 2FA package are not available in the current workspace.

### Laravel API

- Prefer current-account endpoints instead of arbitrary Admin IDs.
- Conceptual API shape:

```http
GET   /api/admin/account
PATCH /api/admin/account/profile
PUT   /api/admin/account/password
PATCH /api/admin/account/preferences
GET   /api/admin/account/security
```

- Add 2FA-specific endpoints only when the repository's approved authentication package/mechanism defines them.
- If the project already standardizes on `/api/admin/me`, it may be extended/reused rather than duplicating account-read endpoints.
- Protect all endpoints with the configured Admin authentication and role/permission middleware.
- Use dedicated Form Requests per mutation concern.
- Use actions/services such as:
  - `UpdateAdminProfile`
  - `ChangeAdminPassword`
  - `UpdateAdminPreferences`
  - approved 2FA action/service when applicable
- Use API Resources/serializers to expose only safe account fields.
- Hash changed passwords using Laravel's hashing API.
- Use `current_password` validation or the established password-confirmation mechanism for sensitive changes.
- Keep controllers focused on request orchestration.
- Record successful security-sensitive/admin mutations through the project's audit mechanism.
- Dispatch any non-critical notifications only after successful persistence/commit.

### Next.js / React

- Add an Admin account-settings route using the repository's routing convention.
- Keep requests in the shared API client.
- Separate forms by concern so one save action does not submit every account field:
  - profile form
  - password form
  - preferences form
  - 2FA/security form when supported
- Fetch the current Admin from the account/current-user endpoint.
- Reuse shared authenticated Admin state where possible.
- On successful profile mutation:
  - update/refetch the shared current Admin
  - show success feedback
- On `401`/expired session:
  - hand control to Admin Authentication
  - return to login
- On `403`:
  - show forbidden state rather than treating it as logout
- On re-authentication requirement:
  - show the project's approved password-confirmation/step-up UI
  - retry the sensitive action only after Laravel confirms re-authentication

### Password implementation

- Validate:
  - current password
  - new password
  - confirmation
- Reuse a centralized Laravel password rule.
- Laravel's validation layer supports `current_password`.
- Laravel's Password rule can define minimum/maximum/character requirements and optional compromised-password checks.
- Do not duplicate the authoritative password rule in React; client hints may mirror it for UX only.
- After successful update:
  - emit safe audit/security metadata
  - apply the shared session-invalidation decision from Admin Authentication
  - never expose the new password again

### Email/login-identity implementation

- Implement only if the repository marks email as Admin-editable.
- Use a dedicated mutation rather than mixing it into unrelated profile changes.
- Require recent authentication.
- Validate uniqueness using the project's role-aware identity model.
- If the project adopts verified Admin emails:
  - use the established Laravel verification mechanism
  - decide whether the old email remains active until verification
- Do not invent email-verification behavior before that decision is made.

### 2FA implementation

- First inspect the real authentication stack.
- If Fortify/TOTP already exists:
  - reuse its backend 2FA lifecycle
  - integrate the Next.js UI with the configured endpoints
  - require password confirmation for security-setting changes
  - protect recovery codes as secrets
- If another MFA provider exists:
  - adapt to that provider rather than mixing mechanisms.
- If no 2FA backend exists:
  - keep the UI/integration point out of production until a mechanism and recovery policy are approved.
- Admin Authentication must be updated alongside 2FA enablement so login can enforce the configured second factor.

### Data model

- Reuse the shared Admin/user record and existing preference/security structures.
- Preserve:

```text
unique(email, role)
```

where that remains the project's account identity rule.

- Add migrations only for fields actually required by approved profile/preferences/security behavior.
- Do not create a second Admin profile table merely for organization unless the real schema warrants it.
- Never store raw passwords, TOTP codes, or recovery codes in ordinary profile/preference columns.

### Tests

- **Laravel feature tests:**
  - guest rejected
  - non-Admin rejected
  - current Admin can read safe account data
  - another account cannot be targeted by submitted ID
  - allowed profile fields update
  - disallowed/immutable fields rejected or ignored according to project convention
  - role cannot self-change
  - permissions cannot self-change
  - validation errors are field-addressable
  - password change requires current password
  - wrong current password fails without mutation
  - password confirmation mismatch fails
  - password is hashed after successful change
  - safe audit event/log produced
  - no password/security secret in response/log
  - email uniqueness by `email + ADMIN` if email editing exists
  - sensitive email/security changes require re-authentication
  - 2FA endpoints require re-authentication when implemented
  - preference keys are allow-listed
- **Frontend tests:**
  - account page loading/error/success states
  - profile fields render from API
  - validation errors render beside correct fields
  - duplicate submissions disabled
  - password form never re-displays submitted password after completion
  - shared Admin identity refreshes after profile update
  - `401` returns to login
  - `403` renders forbidden state
  - re-authentication challenge appears for sensitive actions
  - security/2FA UI only renders when supported
  - keyboard/accessibility behavior

### Recommended security behavior from research

- Require current credentials / step-up authentication for password, email, and MFA changes.
- Require or strongly encourage MFA for privileged Admin accounts.
- Prefer framework-provided password validation and MFA primitives over custom cryptography.
- Avoid forced periodic password rotation unless the project has a specific policy; prioritize strong passwords, compromise checks where appropriate, and MFA.
- Notify/alert on high-risk security-factor changes only if the project later defines a notification/security-event policy.

### Risks

- **Self-escalation:** allowing role/permission fields through the profile payload could let an Admin change authority outside the permission system.
- **Session hijack:** sensitive changes without current-password/step-up verification could let someone with an unattended or stolen session take over the Admin account.
- **2FA lockout:** enabling MFA without a recovery policy can permanently lock out privileged users.
- **Auth drift:** adding 2FA here without updating Admin Authentication would create settings that login does not enforce.
- **Role-aware email collision:** applying global email uniqueness instead of `email + role` would conflict with the current AISLEY identity model.
- **Secret leakage:** generic account DTOs, logs, or audit records must never serialize password or 2FA secret material.
- **Spec/code gap:** exact fields and packages cannot be finalized until the real Laravel/Next.js repository is inspected.

### Open questions

- Exact editable Admin profile/personal-identification fields.
- Whether Admin email is editable.
- Whether changed Admin email requires verification.
- Exact preference keys.
- Exact route/page name for Account Management.
- Exact current-account endpoint naming.
- Password policy.
- Session invalidation behavior after password change.
- Whether sensitive changes use per-request `current_password` or shared recent-password confirmation.
- Whether all Admins must use 2FA.
- Exact 2FA mechanism/provider.
- 2FA recovery procedure.
- Whether security-change notifications are required.
- Whether login/security events use System Audit Logs or a separate security log.
- Whether additional Admins can change all of their own profile fields or some are controlled by a higher-privileged Admin.
- Whether active-session/device management will be added later.

### Sources

- Project feature-spec rules: `SKILL.md`
- AISLEY implementation contract: `README.md`
- Admin feature model: `Admin.md`
- Admin Authentication spec: `admin/auth/spec.md`
- Laravel 12 validation/password APIs:
  - https://api.laravel.com/docs/12.x/Illuminate/Validation/Concerns/ValidatesAttributes.html
  - https://api.laravel.com/docs/12.x/Illuminate/Validation/Rules/Password.html
- Laravel authorization:
  - https://laravel.com/docs/12.x/authorization
- Laravel password-confirmation middleware API:
  - https://api.laravel.com/docs/12.x/Illuminate/Auth/Middleware.html
- Laravel Fortify 2FA reference:
  - https://laravel.com/docs/8.x/fortify#two-factor-authentication
- OWASP Authentication Cheat Sheet:
  - https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Multifactor Authentication Cheat Sheet:
  - https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html
