---
feature: customer-auth
title: Customer / Buyer Authentication
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Buyer
scope: Customer / Buyer Web Application
---

# Customer / Buyer Authentication

## WHAT
- **Purpose:** Establish the authenticated `BUYER` identity used by the AISLEY customer/storefront web application and connect public Buyer registration to the Admin approval workflow.
- **Canonical role:** `BUYER`.
- **User-facing term:** Customer may be used in UI copy, but authorization, database role checks, API scopes, and feature directories use Buyer.
- **Primary actors:** unauthenticated Customer/Buyer registering or logging in; approved authenticated `BUYER`.
- **Source-backed responsibilities:**
  - Customer/Buyer accounts use a public registration and Admin approval flow.
  - AISLEY identity is role-aware, equivalent to `unique(email, role)`.
  - web applications use the project's configured Laravel web-auth transport.
  - protected Buyer features require authenticated/authorized Buyer access.
- **Buyer source limitation:** `Buyer.md` defines Buyer features but does not define registration fields, login transport, password recovery, email verification, or exact approval-gating behavior.
- **Existing architecture evidence:** the current AISLEY Auth source records a project-wide split where web clients use stateful Laravel session cookies and mobile clients use personal access tokens.
- **Recommended Customer web flow:**

```text
REGISTER
Customer submits registration
→ Laravel validates
→ create BUYER registration/account in pending state
→ Admin reviews through Manage Account Registrations
→ APPROVED or REJECTED

LOGIN
GET /sanctum/csrf-cookie
→ POST /login
→ resolve email + BUYER
→ verify password
→ account approved/usable?
   no  → deny normal Buyer access
   yes → regenerate session
       → HttpOnly session cookie
       → Customer Homepage
```

- **Feature boundaries:**
  - Customer Auth owns registration entry, login, session restoration, role enforcement, approval/access gating, and logout.
  - Admin Manage Account Registrations owns approval/rejection decisions.
  - Buyer Account Management owns profile changes, password changes, 2FA settings, and notification preferences.
  - Buyer Address Book owns saved shipping/billing addresses unless registration explicitly requires an initial address.
  - Global Ban/shared security middleware may independently block access.
- **Recommended web routes:** `/register`, `/login`.
- **Recommended post-login route:** Customer Homepage route selected by the storefront router.
- **Non-goals:** Admin approval decisions, Buyer profile editing, password change, 2FA configuration, social login, SSO, passkeys, password recovery unless separately specified, inventing registration fields, or mobile Flutter token authentication unless explicitly added.

## MUST
### Canonical Buyer identity
- Authentication must resolve the persisted `BUYER` role-account.
- AISLEY role-aware identity is:
```text
email + role
```
- Equivalent uniqueness concept:
```text
unique(email, role)
```
- A same-email `SELLER`, `COURIER`, `LOGISTICS`, or `ADMIN` account must not satisfy Buyer authentication.
- The frontend must not be trusted to prove `role = BUYER`, `is_buyer`, or permissions.
- Laravel determines the expected role from the Customer/Buyer authentication context.
- Protected Buyer APIs require persisted `role = BUYER`.

### Registration boundary
- Public Buyer registration is required by the existing AISLEY account-approval architecture.
- Registration must create or submit a Buyer-specific account/application that can enter Admin review.
- Exact registration fields are **not defined by the available Buyer source**.
- Do not invent mandatory fields in this spec.
- Registration fields must come from the implemented registration requirements/schema.
- Registration must:
  - validate supplied fields server-side
  - normalize email
  - create only a `BUYER` role-account/application
  - hash passwords before persistence
  - never accept a privileged role from the client
  - prevent conflicting duplicate `email + BUYER` registration
  - preserve the registration state required by Admin review
- Multi-record registration mutations must be transactional.
- Duplicate form submission must not create duplicate Buyer applications/accounts.

### Registration uploads
- The available Buyer model does not define specific registration documents.
- If the implemented Buyer registration flow requires uploaded credentials/documents:
  - upload through Laravel-authorized storage
  - validate type/size
  - malware scan according to project rules
  - store asset references, not server paths
  - keep documents private
- Do not make an ID upload mandatory from this spec unless the registration requirements explicitly require it.

### Registration state
- Admin Manage Account Registrations establishes a lifecycle equivalent to:
```text
PENDING
APPROVED
REJECTED
```
- Customer Auth must respect authoritative registration/account state.
- Registration submission enters the pending/reviewable state expected by Admin.
- The browser cannot submit `APPROVED` or otherwise self-approve.
- Admin remains the source of approval/rejection.

### Approval gating
- A valid password alone must not bypass required Admin approval.
- A pending/rejected Buyer must not receive ordinary approved-Buyer access.
- Exact pending/rejected login UX is an Open Question.
- Credential verification and account-state checks remain server-side.
- Do not expose internal Admin reasons or security notes.
- Whether a pending Buyer may access a limited application-status page/session is Open.
- Approval must activate the existing account/application rather than create a duplicate.

### Rejected registration
- `REJECTED` must not be treated as normal authenticated Buyer access.
- Whether rejected applicants may edit/resubmit, create a new application, or appeal/contact support is Open.
- Authentication must not silently convert `REJECTED` to active.

### Web authentication transport
- Current project auth source establishes:
  - web → stateful HttpOnly Laravel session
  - Flutter/mobile → personal access token
- Customer/Buyer storefront web should reuse the project web mechanism.
- For a first-party SPA using Laravel Sanctum:
  - initialize CSRF through `/sanctum/csrf-cookie`
  - login through the configured Laravel `/login`
  - use Laravel cookie-based session authentication
  - send cookies/CSRF through the shared API client
- Do not store Customer web Bearer tokens in `localStorage`, `sessionStorage`, or IndexedDB.
- If the repository establishes a different web mechanism, repository behavior wins.

### CSRF
- Stateful web login must initialize and respect CSRF protection.
- Conceptual sequence:
```http
GET /sanctum/csrf-cookie
POST /login
```
- Subsequent state-changing requests use project CSRF/session protections.
- Do not bypass CSRF because frontend/API are separate applications.

### Login request
- Minimum conceptual credentials:
```json
{
  "email": "buyer@example.com",
  "password": "..."
}
```
- Do not require trusted `role: BUYER` input.
- Backend knows the Customer app expects `BUYER`.
- Exact endpoint/response shape follows repository conventions.

### Login validation
- Laravel must:
  1. validate email/password
  2. normalize email
  3. resolve `email + BUYER`
  4. verify password using framework mechanisms
  5. check registration/account eligibility
  6. create/regenerate the session only when access is allowed
- Never compare plaintext passwords manually.

### Generic login errors
- Invalid-login responses must avoid user/role enumeration.
- Do not reveal whether the email exists under another role or expose internal security state.
- Recommended ordinary failure:
```text
Invalid email or password.
```
- Approval-state messaging may differ only if product policy intentionally exposes the applicant's own registration state.

### Session fixation protection
- Regenerate the authenticated session after successful login.
- Do not continue using a pre-authentication session identifier unchanged after login.

### Successful login
- On successful Buyer login:
```text
valid BUYER credentials
+ approved/usable account
→ authenticated Laravel session
→ secure session cookie
→ restore Buyer identity
→ Customer Homepage
```
- Frontend must not need to read the HttpOnly session cookie.
- Login success must not expose password, hash, session ID, or tokens.

### Current Buyer/session restoration
- On Customer app startup:
```text
CHECKING
→ request current authenticated user
→ persisted BUYER + usable account?
   yes → AUTHENTICATED
   no  → UNAUTHENTICATED / restricted state
```
- Conceptual endpoint:
```http
GET /api/buyer/me
```
or a shared current-user endpoint.
- Safe response may include ID, display name, email when needed, role, and safe account/approval state.
- Never include security secrets.
- Protected Customer content must not flash before auth state resolves.

### Protected Buyer routes
- Protected Buyer features require backend authentication and role ownership.
- Examples: cart/checkout, orders, wishlist, account management, address book, reviews, chat.
- Public discovery/search/homepage sections may remain guest-accessible if their own specs allow it.
- Authentication does not imply ownership of every Buyer record.
- Laravel must scope Buyer-owned records by authenticated Buyer ID.

### Authentication vs authorization
- Authentication answers who the account is, whether it is `BUYER`, and whether it may authenticate.
- Authorization answers whether that Buyer owns/accesses a cart/order/address/review/etc.
- Authentication middleware is not a replacement for Buyer ownership Policies/query scoping.

### Account lifecycle integration
- Buyer access must respect Admin Manage User Accounts status and applicable Global Ban rules.
- A suspended/deactivated Buyer must not retain normal protected access indefinitely through an old session.
- Exact revocation strategy is Open:
  - invalidate active sessions immediately, or
  - enforce account-state middleware on protected requests
- Backend denial must become effective promptly.
- Removing a Global Ban does not reactivate a separately suspended account.

### Logout
- Conceptual endpoint:
```http
POST /logout
```
- Logout must invalidate the backend session, regenerate CSRF/session state as appropriate, and clear frontend auth state.
- Frontend-only state clearing is not valid logout.
- Previous authenticated session must not access protected Buyer APIs after logout.

### Session expiry
- Expired/invalid sessions are unauthenticated.
- Frontend clears stale local auth state.
- Sanctum SPA failures may surface as `401` or `419` depending on context.
- Session lifetime, idle timeout, remember-me, and concurrent-session policy are Open.

### Password security
- Registration passwords use Laravel configured hashing.
- Password hashes never appear in JSON.
- Exact password policy is not defined by current sources.
- Buyer Account Management owns password changes.
- Forgot-password/reset is not source-defined and not required here.

### Rate limiting
- Login and registration should have tighter rate limits than normal browsing.
- Reuse Laravel rate limiting.
- Recommended defense-in-depth:
  - per-account/email attempt control
  - per-IP attempt control
- Exact thresholds are Open.
- Throttled requests use project-standard `429`.

### Email verification
- Current Buyer sources do not define email verification.
- Do not require `MustVerifyEmail` or verification links unless another requirement establishes them.
- Admin approval and email verification are different concepts.

### 2FA
- Buyer Account Management mentions 2FA as a possible security setting.
- It does not define a concrete login challenge.
- Do not invent TOTP, SMS OTP, email OTP, or passkeys.
- If 2FA is later configured:
```text
password valid
→ account eligible
→ 2FA enabled?
   no  → session
   yes → configured challenge
         → session only after success
```

### Global Ban integration
- Shared Global Ban middleware may block user/IP access.
- Customer Auth should respect applicable block rules.
- Do not duplicate Global Ban matching inside Auth.
- Exact blocked-login message follows security/privacy policy.

### Security logging
- Never intentionally log plaintext passwords, password hashes, session values, CSRF secrets, access tokens, OTPs, or 2FA secrets.
- Safe technical logging may include request/correlation ID, endpoint, result category, resolved Buyer ID after success, and timestamp.
- Exact login/logout/failed-login security logging policy is Open.

### Frontend states
- Registration: idle, validating, submitting, submitted/pending review, validation failure, duplicate/conflict, server failure.
- Login: idle, requesting CSRF, submitting, success, invalid credentials, restricted/pending state when exposed, server error.
- App bootstrap: checking, authenticated, unauthenticated.
- Logout: submitting, success, failure.
- Disable duplicate registration/login submission while active.

### Accessibility
- Registration/login forms require semantic labels.
- Use appropriate email/password autocomplete hints.
- Errors must be associated with fields and announced accessibly.
- Keyboard navigation must work.
- Status/errors must not rely on color alone.
- Password visibility controls need accessible labels.

### Acceptance criteria
- [ ] Public Customer registration creates only a `BUYER` application/account.
- [ ] Registration cannot self-assign `APPROVED`.
- [ ] Registration password is hashed.
- [ ] Duplicate submission does not create duplicate Buyer accounts/applications.
- [ ] Same email remains role-isolated according to `unique(email, role)`.
- [ ] Same-email Seller/Admin/etc. credentials do not authenticate as Buyer.
- [ ] Buyer web initializes CSRF before stateful login where Sanctum SPA auth is configured.
- [ ] Correct approved Buyer credentials establish a session.
- [ ] Wrong password/unknown Buyer do not establish a session.
- [ ] Pending/rejected Buyer cannot obtain ordinary approved-Buyer access.
- [ ] Session is regenerated on successful authentication.
- [ ] Customer web does not require JS-readable Bearer-token storage.
- [ ] Current-user endpoint returns only safe Buyer identity.
- [ ] Protected Buyer APIs reject guests and wrong-role accounts.
- [ ] Buyer-owned records remain scoped to authenticated Buyer ID.
- [ ] Suspended/deactivated/blocked state is enforced server-side.
- [ ] Logout invalidates backend session.
- [ ] Expired session becomes unauthenticated.
- [ ] Auth errors do not disclose same-email accounts under other roles.
- [ ] Auth secrets are absent from DTOs/logs.
- [ ] UI handles registration pending, login error, auth checking, and logout states.

## HOW
### Project findings
- `Buyer.md` establishes Buyer as the canonical customer role and requires authentication/security middleware for Buyer Account Management, but does not define Buyer Auth itself.
- `README.md` requires protected role requests to be authenticated/authorized and scopes Buyer-owned data by `buyer_id`.
- Existing AISLEY Auth source establishes role-aware identity using `unique(email, role)` and says Customer/Seller/Logistics accounts use registration and approval flows.
- That same source records the project-wide web/mobile split: web uses stateful HttpOnly sessions; Flutter/mobile uses personal access tokens.
- Exact Buyer registration fields, email verification, recovery, account-status schema, and session lifetime are not defined by current Buyer sources.

### Laravel registration action
- Suggested action: `RegisterBuyer`.
- Conceptual endpoint:
```http
POST /register
```
or a Buyer-scoped equivalent.
- Laravel should validate registration input, force `BUYER` role server-side, check role-aware uniqueness, hash password, persist the pending application/account, and dispatch any required acknowledgement after commit.
- Do not authenticate normal Buyer access before approval.

### Laravel login action
- For the established first-party web/Sanctum pattern:
```http
GET  /sanctum/csrf-cookie
POST /login
GET  /api/buyer/me
POST /logout
```
- Laravel Sanctum SPA authentication uses Laravel cookie-based session services rather than API tokens for first-party SPAs.
- Its documented flow initializes `/sanctum/csrf-cookie`, then posts credentials to `/login`.
- Storefront/API deployment must satisfy Sanctum stateful-domain/CORS/cookie constraints.

### Credential resolution
- Prefer a Buyer-specific login action/service that resolves normalized email + persisted `BUYER`.
- Do not accept a trusted role selector.
- After password verification, enforce approval eligibility, account lifecycle status, and Global Ban rules.
- Regenerate session after successful login.
- Laravel standard session login guidance regenerates the session and invalidates it on logout.

### Next.js / React
- Build registration page, login page, auth provider/store (`CHECKING | AUTHENTICATED | UNAUTHENTICATED`), protected Buyer layout, logout action, and pending-review screen when product policy requires it.
- Use the shared Laravel API client with credentials/CSRF support.
- Do not create a Next.js API route that reimplements Laravel auth/business rules.
- Public Customer Homepage/Search/Browse behavior remains owned by those specs.

### Rate limiting/security
- Apply Laravel rate limiting around registration/login.
- Use generic credential errors to reduce account enumeration.
- Use layered throttling for brute-force/credential-stuffing defense.
- Regenerate session IDs after authentication.

### Tests
- **Laravel:** Buyer registration; forced BUYER role; role-aware duplicates; password hashing; pending state; invalid registration; same-email role isolation; approved login; pending/rejected denial; wrong password/role; session regeneration; safe current-user; protected ownership; suspended/deactivated/block enforcement; logout; rate limiting.
- **Frontend:** registration states; login/CSRF flow; generic errors; pending-review state; redirect to Customer Homepage; auth-checking flash prevention; session expiry; logout; wrong-role denial; accessibility.

### Research-backed recommendations
- Reuse the project's first-party web session model rather than inventing a Buyer-only token scheme.
- For Sanctum SPA auth, use stateful cookie authentication and CSRF initialization rather than JS-managed API tokens.
- Regenerate the session after successful authentication.
- Use generic credential errors and throttling.
- Keep Admin approval as a separate authoritative transition rather than allowing registration/login to self-activate Buyer accounts.

### Risks
- **Role confusion:** email-only lookup could authenticate Seller/Admin into Customer.
- **Approval bypass:** pending accounts could gain access if eligibility is checked only in frontend.
- **Duplicate onboarding:** retries may create duplicate applications.
- **Session fixation:** failing to regenerate session weakens security.
- **Cross-domain misconfiguration:** Sanctum cookie/CORS failures can break storefront login.
- **Account enumeration:** detailed errors may reveal Buyer existence/state.
- **Source gap:** inventing registration fields/email verification/recovery would exceed current source.
- **Stale access:** suspended/deactivated Buyers may remain active if state is checked only at login.

### Open questions
- Exact Customer registration fields/documents.
- Whether registration creates the `users` row immediately or a separate application record first.
- Exact approval/account-status schema.
- Pending/rejected login UX and limited status-session behavior.
- Rejected-customer resubmission/appeal behavior.
- Exact Customer Homepage route.
- Email verification requirement.
- Forgot-password/password-reset flow.
- Session lifetime, idle timeout, remember-me, concurrent-session policy.
- Login/registration rate limits.
- Buyer 2FA mechanism/login challenge.
- Suspension/deactivation session invalidation.
- Whether Customer mobile auth exists.
- Storefront/API domain layout and Sanctum cookie/CORS settings.
- Registration acknowledgement/approval email behavior and provider.

### Sources
- Project rules: `SKILL.md`
- AISLEY architecture contract: `README.md`
- Buyer feature model: `Buyer.md`
- Existing AISLEY Admin Authentication source/spec for shared identity/auth architecture
- Laravel Sanctum SPA Authentication: https://laravel.com/docs/12.x/sanctum
- Laravel basic authentication/session guidance: https://laravel.com/learn/getting-started-with-laravel/basic-authentication-loginlogout
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- OWASP Bot Management / Anti-Automation: https://cheatsheetseries.owasp.org/cheatsheets/Bot_Management_and_Anti-Automation_Cheat_Sheet.html
