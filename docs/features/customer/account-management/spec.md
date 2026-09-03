---
feature: account-management
title: Customer Account Management
system: AISLEY
type: Feature Specification
version: 2.0
status: Ready for phased implementation
role: Customer
scope: Customer web application and Laravel API
---

# Customer Account Management

## WHAT

- Provide an active Customer a private self-service Account area for profile identity and account security, without mixing in marketplace data owned by other features.
- The current foundation is intentionally read-only: `/account/profile` shows the authenticated Customer's display name and active status; the account navigation links to Profile, Addresses, Wishlist, Orders, and Recently Viewed.
- Address Book, Wishlist, Orders, and Recently Viewed remain separate owning features. This specification owns only Customer profile/account changes and security settings.
- The Customer role uses the existing Sanctum web session and `customer.active` boundary. Guests, inactive accounts, other roles, and arbitrary Customer IDs cannot read or mutate an account.

- Phase 1 adds editable basic profile fields and a secure password change. Phase 2 is explicitly deferred for email changes, profile photo, notification preferences, MFA, device/session management, and account deletion/export.
- This feature does not change registration approval, role, account status, address records, payment data, order data, Wishlist data, or any Seller/Admin/Courier account.

## MUST

### Current foundation and ownership

- Preserve the protected `/account/profile` read-only page until Phase 1 APIs and UI are complete. Do not present profile editing as available before a successful authoritative update exists.
- Keep account navigation links as links to their respective features; Account Management must not reimplement Address Book CRUD, Wishlist, Order history, or Recently Viewed history.
- Every API operation derives the Customer from the authenticated Sanctum principal and confirms role `customer` plus active status. Never accept `user_id`, role, status, approval state, or another account identifier in the request body.
- Same-email records in another role remain isolated because the API resolves the authenticated User record, not an email match.

### Phase 1 profile

- Add `GET /api/v1/customer/account` returning a private, explicit Customer account DTO: immutable ID/role/status, email read-only, and allowed profile fields.
- Add `PATCH /api/v1/customer/account/profile` for only `first_name`, `middle_name`, `last_name`, `contact_number`, `sex`, and `birth_date` when those existing `customer_profiles` columns are supported by the registration/profile policy.
- Validate and normalize input server-side. A profile change must not alter email, password hash, role, account status, registration data, profile-photo path, or another role's profile.
- Return a safe DTO after a successful update. Never return password hashes, Sanctum tokens, raw storage paths, internal registration evidence, Admin notes, or other Customer data.
- Use `no-store` responses and do not put Customer profile data in shared homepage or public discovery caches.

### Password change

- Add `PATCH /api/v1/customer/account/password` only for an active authenticated Customer. Require `current_password`, `password`, and `password_confirmation`.
- Laravel validates the current password against the authenticated Customer and applies the same configured strength/confirmation rules as Customer registration and password reset.
- Rate-limit the endpoint and return safe validation/authentication errors; never log, return, email, or place any password value in an audit payload.
- On success, rotate the current web session and revoke other Customer personal-access tokens/sessions according to the decided policy. The exact multi-device revocation choice must be implemented and tested consistently, not implied by the UI.
- Password recovery remains owned by Customer Authentication. This feature changes a password only for an already authenticated Customer.

### Concurrency, errors, and privacy

- Profile/password writes must be transactional for the User/Profile rows they touch. Concurrent retries must not partially apply a profile update or leave an unusable password/session state.
- A stale or unauthenticated request returns the project's normal `401`/`403`; a valid Customer attempting a forbidden field receives `422`, not a silently ignored mutation.
- Customer-facing errors may explain how to recover but must not disclose another account, registration state, token, or password detail.
- Changes to name/profile data should refresh the authenticated navigation display after the API confirms success. Never optimistically claim a password or profile update succeeded after a failed request.

### Deferred capabilities

- Email change is deferred. It requires a unique email/role policy, current-password confirmation, verification of the new address, collision handling, notification to the old address, and session/token consequences.
- Profile photo is deferred. It needs an additive metadata schema and a dedicated authenticated delivery endpoint; raw `profile_photo_path` must not become a public URL. Any implementation must follow `docs/references/file-upload-requirements.md`.
- Notification preferences are deferred until Customer notification types, delivery channels, defaults, consent, and durable preference storage are specified.
- MFA, remembered devices, session list/revocation UI, account deactivation/deletion, export, and formal security-event/audit visibility are separate approved features or policies.

### Customer experience and accessibility

- `/account/profile` remains protected by the existing same-origin `next` redirect pattern. A signed-out visitor returns to the requested Account route only after successful active-Customer sign-in.
- Phase 1 presents profile and password as separate forms with clear required-field labels, inline validation, saving/success/error states, disabled duplicate submission, and focus moved to the relevant error or confirmation.
- Do not render an editable email, status, role, approval, or profile-photo control as if it were functional. Link Customers to Addresses, Orders, Wishlist, and Recently Viewed rather than duplicating their contents.
- Maintain responsive keyboard-accessible account navigation and use `autocomplete` attributes suitable for name, telephone, birth date, current password, and new password fields.

### Acceptance criteria

- [x] An active Customer can open the read-only `/account/profile` page; guests are redirected to sign in.
- [x] Address, Wishlist, Orders, and Recently Viewed remain distinct Customer Account navigation destinations.
- [ ] The account API and Phase 1 forms expose and update only the authenticated active Customer's allow-listed profile fields.
- [ ] A forged Customer ID, another role, inactive account, forbidden field, or cross-role same-email record cannot read or change the Customer profile.
- [ ] Password change requires the correct current password, confirmed policy-compliant replacement password, throttling, and safe session/token handling.
- [ ] Private account responses and errors never expose tokens, hashes, raw media paths, registration evidence, or another Customer's data.
- [ ] UI loading, validation, retry, success, and keyboard/focus states work without falsely reporting a saved change.

## HOW

### Existing project integration

- Reuse `CustomerProfile`, the shared `User` identity, existing Customer Auth session restoration, `customer.active` middleware, Customer protected-route shell, and Account navigation.
- Current `CustomerUserResource` is not a public Account DTO: it exposes raw `profile_photo_path` when loaded. Introduce a dedicated allow-listed account resource before serving editable account data.
- Keep `CustomerAddressController`, Wishlist, Orders, and Recently Viewed endpoints untouched except for normal navigation/auth refresh integration.
- No migration is required for Phase 1 because the target Customer-profile fields already exist. Use a new additive migration only for an approved deferred capability such as photo metadata or preferences.

### Laravel API

- Add a Customer-scoped `AccountController`, Form Requests, and an `AccountService` inside the existing `v1/customer` authenticated group.
- Load exactly the authenticated `User` and `customerProfile`; use a transaction and explicit allow-list for profile writes. Return `CustomerAccountResource` with camelCase fields aligned to Customer web types.
- Validate password changes with Laravel's current-password validation and configured Password rule. Use the existing hash/session/token conventions rather than inventing an alternative credential store.
- Set private cache headers, CSRF protection for the web session flow, and focused throttling for sensitive mutations. Record only redacted operational/security events if an approved Customer audit policy exists.

### Customer application

- Add private API helpers/types separate from public marketplace fetch helpers, with credentialed no-store requests and safe retry behaviour.
- Replace the read-only-profile notice only when the GET/PATCH profile contract exists. Keep password editing isolated in a Security section; do not collect a current password for ordinary profile edits unless a future policy requires re-authentication.
- Refresh the shared Customer auth/navigation state after a confirmed name change. On password success, follow the implemented session policy and show the resulting sign-in/session state clearly.
- Keep the generic `/account/[[...segments]]` unavailable-state page for deferred settings paths; do not manufacture empty preferences or MFA screens.

### Testing and rollout

- Laravel tests: active Customer self-read/update; guest/inactive/other-role denial; allow-list enforcement; same-email role isolation; validation; concurrent profile write behaviour; current-password failure; password policy/confirmation; rate limit; session/token outcome; safe resource/error payloads; and no-store headers.
- Customer tests: protected redirect/return; initial read-only state; profile and password validation/success/failure; disabled duplicate submits; navigation refresh; focus/keyboard behaviour; and responsive account navigation.
- Run focused Customer API tests, storefront lint, strict TypeScript, and production build. Append a dated `docs/PROGRESS.md` implementation entry only when a phase is built; this revision is documentation-only.

### Open implementation choices

- Decide whether a successful password change revokes every other device token/session or only the current web session; document the final policy before coding.
- Confirm which existing personal fields remain editable after registration and whether changing birth date requires an age/verification review rule.
- Decide email-change verification, notification, and collision policy as its own approved sub-feature.
- Decide whether Customer security/profile changes need a Customer-visible history or an internal redacted audit event.

### Sources

- Existing foundation: `src/webapp/src/app/(customer)/account/profile/page.tsx`, `src/webapp/src/components/account/account-navigation.tsx`, `src/api/app/Http/Controllers/Customer/AuthController.php`, `src/api/app/Models/CustomerProfile.php`, and `docs/schema.md`.
- [Laravel password confirmation/current-password support](https://laravel.com/docs/12.x/middleware) and [Laravel password validation](https://laravel.com/docs/12.x/validation) support the intended authenticated password-change boundary.
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) supports re-authentication and secure handling for sensitive credential changes.
