# Customer / Buyer Authentication Specification

**System:** Aisley  
**Domain:** Customer / Buyer  
**Artifact:** `spec.md`  
**Scope:** Registration, approval-gated access, sign in, sign out, session handling, password recovery, and auth-related frontend states  
**Status:** MVP implementation specification

---

## 1. Purpose

This specification defines authentication behavior for the Aisley **Customer / Buyer** domain across the customer-facing storefront.

The primary business rule is that a Buyer may register an account, but the account must be **approved by an Admin before the Buyer is allowed to sign in and access authenticated Buyer features**.

Guest customers remain allowed to browse products without signing in.

---

## 2. Source Basis

This specification is grounded primarily in:

- `app.md`
  - Customer/Buyer is a core platform role.
  - Guest customers can browse products without signing in.
  - Customer auth flow is `register -> admin approval -> email -> sign in`.
  - All roles share the same users table.
  - Email uniqueness is scoped by role/domain using `unique(email, role)`.
  - Web applications use Laravel Sanctum stateful session cookies.
  - Mobile applications use Sanctum personal access tokens.
  - Brevo is used for outbound email.
- `Admin.md`
  - Admins approve or disapprove account registrations.
  - Registration/account status is modeled with states such as `PENDING`, `APPROVED`, and `REJECTED`.
  - Status transitions should trigger notification email to the applicant.
- `Buyer.md`
  - Buyer Account Management includes profile information and secure authentication credentials.
  - Buyer-facing functionality must be protected by authentication middleware where appropriate.

### Derived implementation decisions

The source documents do not explicitly define password-reset UX, exact API payloads, error codes, or detailed registration fields. This specification defines sensible MVP behavior for those gaps while preserving the documented approval workflow.

---

## 3. Goals

The Buyer auth system must:

1. Allow a new Buyer to create an account.
2. Create newly registered Buyer accounts in a **pending approval** state.
3. Prevent pending or rejected Buyer accounts from entering authenticated Buyer areas.
4. Show a clear frontend message when a registered account is still waiting for approval.
5. Notify the Buyer by email when an Admin approves or rejects the registration.
6. Allow approved Buyers to sign in securely.
7. Allow guest users to continue browsing public storefront pages without authentication.
8. Maintain role-aware identity rules so the same email may exist for different roles while remaining unique within the Buyer role.
9. Support secure sign out and session invalidation.
10. Provide a basic password recovery flow for approved Buyer accounts.

---

## 4. Non-Goals

The following are outside this auth MVP unless separately specified:

- Social login / OAuth providers.
- Passkeys.
- Mandatory two-factor authentication.
- Seller, Logistics, Courier, or Admin registration flows.
- Buyer profile/account-settings implementation beyond auth-related identity fields.
- Admin account-review UI implementation, except for the contract required by Buyer auth.
- Full customer-service workflows for rejected or suspended accounts.

---

## 5. Actors

### 5.1 Guest Customer

A visitor who has not authenticated.

Can:

- Browse public product/shop pages.
- Search and inspect products.
- Open Sign In.
- Open Sign Up.

Cannot:

- Access Buyer-only account pages.
- Perform protected Buyer actions that require an authenticated account.

### 5.2 Pending Buyer

A Buyer who successfully registered but whose application has not yet been reviewed by an Admin.

Can:

- View the registration-complete / waiting-for-approval state.
- Attempt to sign in and receive the waiting-for-approval state.
- Return to the public storefront.

Cannot:

- Establish an authenticated Buyer session.
- Enter Buyer account pages.
- Use protected Buyer capabilities.

### 5.3 Approved Buyer

A Buyer whose registration was approved by an Admin.

Can:

- Sign in.
- Establish an authenticated Buyer session.
- Access Buyer-only features.
- Sign out.
- Use password recovery.

### 5.4 Rejected Buyer

A Buyer whose registration was rejected by an Admin.

Cannot establish a Buyer session. The frontend must show a rejection-specific state rather than treating the user as having invalid credentials.

### 5.5 Admin

Reviews Buyer registrations and changes account status to `APPROVED` or `REJECTED`.

---

## 6. Account Status Model

Minimum required registration statuses:

```text
PENDING
APPROVED
REJECTED
```

Recommended extensible account-state model:

```text
PENDING
APPROVED
REJECTED
SUSPENDED   // future/admin account-management compatibility
```

### State transitions

```text
REGISTER
   |
   v
PENDING
  /   \
 v     v
APPROVED  REJECTED
```

For MVP, a public Buyer registration must never directly create an `APPROVED` account.

---

## 7. Identity and Role Rules

All platform roles live in the shared users table.

Required database uniqueness rule:

```text
UNIQUE(email, role)
```

For this domain:

```text
role = BUYER
```

Implications:

- `buyer@example.com` may exist once as a Buyer and separately as another role such as Seller.
- A second Buyer registration using the same normalized email must be rejected.
- Auth lookup must include the Buyer role/domain and must not accidentally authenticate a Seller/Admin/Logistics identity into the Buyer storefront.

Email addresses should be normalized before uniqueness checks, at minimum by trimming whitespace and applying consistent case normalization.

---

## 8. Registration / Sign Up

### 8.1 Route

Suggested frontend route:

```text
/register
```

or

```text
/signup
```

Use one canonical route and redirect aliases if both are exposed.

### 8.2 Required MVP fields

Because the source files do not prescribe exact Buyer registration fields, use the minimum identity set below unless the broader user schema requires more:

- First name
- Last name
- Email address
- Password
- Password confirmation
- Acceptance of Terms / Privacy Policy, if required by the application

Do not require shipping address during account creation; Buyer addresses belong to the Address Book / checkout flow.

### 8.3 Registration validation

At minimum:

- First and last name are required.
- Email is required and must be syntactically valid.
- `(email, BUYER)` must be unique.
- Password is required.
- Password confirmation must match.
- Password must satisfy the backend password policy.
- Role must be assigned server-side as `BUYER`; the client must not be trusted to submit an arbitrary role.

### 8.4 Successful registration behavior

On successful registration:

1. Create the user with `role = BUYER`.
2. Set account/registration status to `PENDING`.
3. Do **not** create an authenticated Buyer session.
4. Place the registration into the Admin account-approval queue.
5. Return a response indicating successful registration and pending approval.
6. Route the frontend to the **Waiting for Approval** state.

### 8.5 Required frontend success state

Display a dedicated confirmation panel/page.

**Primary message:**

> **Waiting for approval**
>
> Your account has been registered successfully and is waiting for admin approval. We’ll email you once your account has been reviewed.

Recommended actions:

- `Back to store`
- `Go to sign in`

Do not show a dashboard link and do not behave as though the user is authenticated.

### 8.6 Duplicate Buyer email

If `(email, BUYER)` already exists, the registration must fail.

Suggested user-facing message:

> An account with this email already exists. Sign in instead or reset your password.

Do not reject the address merely because the same email exists under a different role.

---

## 9. Waiting for Approval UX

The **Waiting for Approval** state is mandatory.

It must be reachable in both of these cases:

### Case A — Immediately after registration

After a successful Buyer registration, show the waiting state instead of signing the Buyer in.

### Case B — Pending Buyer attempts to sign in

When valid Buyer credentials belong to an account with status `PENDING`, authentication must not establish a session. The UI must show the waiting state.

Required copy:

> **Waiting for approval**
>
> Your account is still waiting for admin approval. We’ll email you once your account has been reviewed.

Optional supporting text:

> You can continue browsing the store while you wait.

Recommended action:

- `Continue shopping`

### UX constraints

- Do not display the generic “Invalid email or password” error for a correctly authenticated pending account.
- Do not redirect a pending Buyer to a dashboard/account page.
- Do not persist authenticated Buyer state for pending users.
- The public storefront remains accessible.

---

## 10. Admin Approval Contract

The Buyer frontend does not perform approval itself, but its auth behavior depends on the Admin workflow.

### 10.1 Approval

When Admin changes a Buyer account from `PENDING` to `APPROVED`:

1. Persist the status change.
2. Send an approval email to the Buyer.
3. The Buyer may then sign in normally.

Suggested email meaning:

- The account has been approved.
- The Buyer can now sign in.
- Provide a link to the customer storefront Sign In page.

### 10.2 Rejection

When Admin changes a Buyer account from `PENDING` to `REJECTED`:

1. Persist the status change.
2. Send a rejection/status email to the Buyer.
3. Subsequent sign-in attempts must not establish a session.

Suggested frontend message:

> **Account not approved**
>
> Your account registration was not approved. Check your email for more information or contact support if you need assistance.

Do not expose internal review notes unless the Admin workflow explicitly marks them safe for the applicant.

### 10.3 Email provider

Per project architecture, outbound auth/status emails should use **Brevo**.

---

## 11. Sign In

### 11.1 Route

```text
/login
```

### 11.2 Fields

- Email
- Password

The Buyer role/domain must be implied by the Buyer application and enforced server-side.

### 11.3 Sign-in decision table

| Condition | Result |
|---|---|
| Buyer email does not exist | Generic credential error |
| Password is incorrect | Generic credential error |
| Status = `PENDING` | No session; show **Waiting for approval** |
| Status = `REJECTED` | No session; show rejected-account state |
| Status = `APPROVED` | Establish Buyer session and continue |
| Non-Buyer account has same email | Do not authenticate it into Buyer domain |

For ordinary invalid credentials, use a generic message such as:

> The email or password is incorrect.

This avoids revealing whether a Buyer account exists.

### 11.4 Approved Buyer redirect

After successful authentication:

- If a valid safe `returnTo` path exists, redirect there.
- Otherwise redirect to the customer storefront/home or Buyer account landing page defined by the frontend.

Never accept an arbitrary external redirect URL.

---

## 12. Web Authentication Mechanism

For the React / Next.js customer web application, use Laravel Sanctum stateful authentication with `HttpOnly` session cookies.

Required sequence:

```text
1. GET /sanctum/csrf-cookie
2. POST /login
3. Backend validates Buyer credentials + account status
4. On APPROVED only, Laravel establishes encrypted session cookie
5. Browser includes cookie automatically on authenticated requests
```

Requirements:

- Use CSRF protection.
- Do not store auth tokens in `localStorage`.
- Cookies should use appropriate secure production settings.
- Protected API routes must enforce authentication and Buyer role/domain authorization.

---

## 13. Mobile Authentication Mechanism

The customer storefront also has a mobile application according to `app.md`.

For Flutter, use Laravel Sanctum personal access tokens.

Approved Buyer flow:

```text
1. POST /login with email, password, and device_name
2. Backend validates Buyer credentials + APPROVED status
3. Backend creates personal access token
4. Flutter stores token in flutter_secure_storage
5. Future requests use Authorization: Bearer <token>
```

Pending or rejected accounts must not receive a personal access token.

---

## 14. Suggested API Contract

Exact endpoint naming may follow the backend's existing conventions. The behavioral contract is mandatory.

### 14.1 Register Buyer

```http
POST /api/buyer/register
```

Example request:

```json
{
  "first_name": "Aisley",
  "last_name": "Buyer",
  "email": "buyer@example.com",
  "password": "********",
  "password_confirmation": "********"
}
```

Example success response:

```json
{
  "message": "Registration submitted for approval.",
  "user": {
    "email": "buyer@example.com",
    "role": "BUYER",
    "status": "PENDING"
  }
}
```

The API must never accept a client-provided approval status.

### 14.2 Sign In

The project source specifies `/login` for Sanctum login. Keep that endpoint if already standardized.

Pending response should be machine-readable, for example:

```json
{
  "code": "ACCOUNT_PENDING_APPROVAL",
  "message": "Your account is waiting for admin approval."
}
```

Rejected response:

```json
{
  "code": "ACCOUNT_REJECTED",
  "message": "Your account registration was not approved."
}
```

The frontend should render UI based on `code`, not brittle matching of human-readable strings.

### 14.3 Current User

Suggested endpoint:

```http
GET /api/user
```

Return only the authenticated Buyer identity/profile fields required by the frontend.

The backend must verify both authenticated identity and Buyer role.

### 14.4 Sign Out

Suggested endpoint:

```http
POST /logout
```

Web:

- Invalidate server-side session.
- Rotate/invalidate session state as appropriate.
- Clear authenticated frontend state.

Mobile:

- Revoke the current device token.
- Remove the token from secure storage.

---

## 15. Password Recovery

Password recovery is not explicitly described in the source files, but it is included here as standard MVP auth completeness.

### 15.1 Forgot Password

Suggested route:

```text
/forgot-password
```

Input:

- Email address

User-facing response should remain generic regardless of account existence:

> If a Buyer account exists for that email, we’ll send password reset instructions.

### 15.2 Reset Password

Suggested route:

```text
/reset-password
```

Requirements:

- Time-limited, single-purpose reset token.
- New password + confirmation.
- Password policy validation.
- Token invalidation after successful reset.

Resetting the password must **not** change approval status. A `PENDING` Buyer remains pending and a `REJECTED` Buyer remains rejected.

---

## 16. Session and Route Guards

### Public routes

Examples:

```text
/
/search
/products/*
/shops/*
/login
/register
/forgot-password
/reset-password
```

These routes must remain usable by guests where appropriate.

### Protected Buyer routes

Examples:

```text
/account
/account/settings
/addresses
/wishlist
/orders
/messages
/checkout     // if checkout requires account authentication
```

A protected route must require:

```text
authenticated == true
AND role == BUYER
AND status == APPROVED
```

If an unauthenticated visitor opens a protected route:

- Redirect to Sign In.
- Preserve a safe internal return path where useful.

If a pending/rejected user somehow has stale credentials/session state, the backend remains authoritative and must deny protected access.

---

## 17. Frontend Screens and Components

Minimum auth UI:

### 17.1 Sign Up Page

Contains:

- Name fields
- Email
- Password
- Confirm password
- Submit button
- Link to Sign In
- Validation feedback

Primary CTA:

```text
Create account
```

### 17.2 Waiting for Approval Page / State

Required heading:

```text
Waiting for approval
```

Required message:

```text
Your account is still waiting for admin approval. We’ll email you once your account has been reviewed.
```

Recommended secondary copy:

```text
You can continue browsing the store while you wait.
```

CTA:

```text
Continue shopping
```

### 17.3 Sign In Page

Contains:

- Email
- Password
- Sign In button
- Forgot password link
- Link to Sign Up
- Inline/global error area

### 17.4 Rejected Account State

Heading:

```text
Account not approved
```

Message:

```text
Your account registration was not approved. Check your email for more information or contact support if you need assistance.
```

### 17.5 Auth Loading State

During session bootstrap or form submission:

- Disable duplicate submissions.
- Show a visible loading state.
- Do not flash protected Buyer content before auth status has been resolved.

---

## 18. Security Requirements

- Hash passwords using Laravel's configured secure password hashing mechanism.
- Never return password hashes or sensitive authentication secrets to the frontend.
- Never trust role, approval status, or user ID supplied by the client.
- Enforce Buyer role authorization server-side.
- Enforce account approval server-side; frontend guards are not sufficient.
- Rate-limit login and password-reset attempts.
- Use generic errors for invalid username/password combinations.
- Rotate/regenerate the web session after successful authentication to mitigate session fixation.
- Revoke/invalidate credentials on logout.
- Apply CSRF protection to stateful web authentication.
- Use HTTPS in production.
- Secure cookies appropriately in production (`HttpOnly`, `Secure`, suitable `SameSite`).
- Validate redirect targets to prevent open redirects.
- Audit approval status changes in the Admin domain if an audit mechanism is available.

---

## 19. Error / Status Codes

Recommended stable frontend-facing auth codes:

```text
VALIDATION_ERROR
INVALID_CREDENTIALS
ACCOUNT_PENDING_APPROVAL
ACCOUNT_REJECTED
ACCOUNT_SUSPENDED        // future compatibility
EMAIL_ALREADY_REGISTERED
UNAUTHENTICATED
FORBIDDEN_ROLE
RATE_LIMITED
```

The backend may choose HTTP status codes according to project conventions, but the semantic `code` should remain stable for frontend handling.

---

## 20. Email Events

Minimum account-approval emails required by the documented workflow:

| Event | Recipient | Purpose |
|---|---|---|
| Buyer approved | Buyer email | Inform Buyer that sign in is now available |
| Buyer rejected | Buyer email | Inform Buyer that registration was not approved |

Optional registration acknowledgement:

| Event | Recipient | Purpose |
|---|---|---|
| Registration submitted | Buyer email | Confirm application is pending review |

Emails should be delivered through Brevo.

---

## 21. End-to-End Flows

### 21.1 New Buyer Registration

```text
Guest
  -> Sign Up
  -> Submit valid Buyer registration
  -> User created with role=BUYER, status=PENDING
  -> No auth session/token issued
  -> Waiting for approval screen
  -> Admin reviews registration
  -> Admin approves
  -> Approval email sent
  -> Buyer opens Sign In
  -> Valid credentials
  -> Session/token issued
  -> Buyer enters authenticated experience
```

### 21.2 Pending Buyer Attempts Sign In

```text
Buyer enters valid email/password
  -> Credentials match BUYER account
  -> status=PENDING
  -> No session/token issued
  -> UI shows "Waiting for approval"
  -> Buyer may return to public storefront
```

### 21.3 Rejected Buyer Attempts Sign In

```text
Buyer enters valid email/password
  -> Credentials match BUYER account
  -> status=REJECTED
  -> No session/token issued
  -> UI shows "Account not approved"
```

### 21.4 Approved Buyer Sign In

```text
Buyer enters valid email/password
  -> Credentials match BUYER account
  -> status=APPROVED
  -> Web: create stateful session cookie
     OR
     Mobile: create personal access token
  -> Load Buyer identity
  -> Redirect to safe intended page or storefront/account landing
```

---

## 22. Acceptance Criteria

### Registration

- [ ] A guest can open the Buyer Sign Up page.
- [ ] A valid registration creates a user with `role = BUYER`.
- [ ] A valid registration creates the account with `status = PENDING`.
- [ ] Registration does not automatically authenticate the Buyer.
- [ ] Duplicate `(email, BUYER)` registration is rejected.
- [ ] The same email may still belong to a different role/domain.
- [ ] The role and approval status cannot be chosen or overridden by the client.
- [ ] Successful registration displays the waiting-for-approval UI.

### Waiting for approval

- [ ] The frontend displays the heading **“Waiting for approval”** for a pending Buyer.
- [ ] The frontend explains that Admin approval is still pending.
- [ ] The frontend states that the Buyer will be emailed after review.
- [ ] A pending Buyer is not redirected to an authenticated dashboard/account area.
- [ ] A pending Buyer cannot establish a web session or mobile access token.
- [ ] A pending Buyer can return to guest storefront browsing.

### Admin decision

- [ ] Admin can transition a Buyer registration from `PENDING` to `APPROVED` or `REJECTED` through the Admin domain.
- [ ] Approval triggers an email notification.
- [ ] Rejection triggers an email/status notification.
- [ ] Approval immediately makes the Buyer eligible to sign in.

### Sign in

- [ ] Only `APPROVED` Buyer accounts can establish authenticated Buyer access.
- [ ] Pending credentials result in `ACCOUNT_PENDING_APPROVAL` or equivalent stable state.
- [ ] Rejected credentials result in `ACCOUNT_REJECTED` or equivalent stable state.
- [ ] Invalid credentials use a generic credential error.
- [ ] A non-Buyer account cannot authenticate into the Buyer domain even when its email/password match.
- [ ] Successful web sign in uses Sanctum stateful cookie authentication.
- [ ] Successful mobile sign in uses a Sanctum personal access token stored securely on device.

### Session

- [ ] Protected Buyer endpoints require authentication, Buyer role, and approved status.
- [ ] Guest browsing remains available without authentication.
- [ ] Sign out invalidates the active session/token.
- [ ] Authenticated frontend state is cleared after sign out.

### Password recovery

- [ ] Buyer can request a password reset without account-enumeration leakage.
- [ ] Reset tokens expire and cannot be reused after success.
- [ ] Password reset does not alter approval status.

---

## 23. Suggested Test Cases

### Registration tests

1. Register a new Buyer with unused Buyer email -> `PENDING`.
2. Register another Buyer with same email -> rejected as duplicate.
3. Register a Buyer with an email already used by Seller only -> permitted if `(email, BUYER)` is unused.
4. Attempt to submit `role=ADMIN` from Buyer frontend -> ignored/rejected; resulting role remains `BUYER`.
5. Attempt to submit `status=APPROVED` -> ignored/rejected; resulting status remains `PENDING`.

### Sign-in tests

1. Approved Buyer + correct password -> authenticated.
2. Pending Buyer + correct password -> no auth; waiting-for-approval state.
3. Rejected Buyer + correct password -> no auth; rejected state.
4. Buyer + wrong password -> generic invalid credentials.
5. Seller credentials entered on Buyer login -> no Buyer authentication.

### Authorization tests

1. Guest calls protected Buyer endpoint -> unauthenticated.
2. Pending user with stale/session artifact calls protected endpoint -> denied.
3. Approved Seller calls Buyer-only endpoint -> forbidden.
4. Approved Buyer calls Buyer-only endpoint -> allowed.

### Frontend tests

1. Successful registration renders `Waiting for approval`.
2. Pending sign-in renders `Waiting for approval` rather than credential error.
3. Waiting page includes email-review explanation.
4. Waiting page has a route back to public storefront browsing.
5. Approved sign-in never flashes pending UI.

---

## 24. Implementation Notes

### Backend

Recommended separation of concerns:

- Registration service creates Buyer in `PENDING` state.
- Authentication service verifies credentials first, then evaluates role and status before issuing session/token.
- Approval service belongs to Admin domain and owns status transitions.
- Notification service sends Brevo email after approval/rejection transitions.
- Authorization middleware/policies enforce `BUYER + APPROVED` for protected Buyer actions.

### Frontend

Model auth state explicitly instead of using only `authenticated: boolean`.

Suggested state:

```ts
type BuyerAuthState =
  | { status: 'loading' }
  | { status: 'guest' }
  | { status: 'pending_approval'; email?: string }
  | { status: 'rejected'; email?: string }
  | { status: 'authenticated'; user: BuyerUser };
```

This prevents pending/rejected states from being incorrectly collapsed into generic login errors.

---

## 25. Definition of Done

Buyer authentication is MVP-complete when:

1. A guest can register as a Buyer.
2. Registration produces a `PENDING` Buyer and does not sign them in.
3. The frontend clearly shows **Waiting for approval** after registration and on pending sign-in attempts.
4. Admin approval/rejection is reflected in Buyer auth behavior and sends email notification.
5. Only approved Buyers can establish sessions/tokens.
6. Guest storefront browsing remains available.
7. Role-scoped email uniqueness is enforced with `(email, role)`.
8. Buyer protected routes are secured by authentication, role, and approval status.
9. Sign out works correctly.
10. Basic password recovery works without bypassing approval state.
