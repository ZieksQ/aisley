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

- Phase 1 adds editable basic profile fields, a private profile photo, and a secure password change. Phase 2 is explicitly deferred for email changes, notification preferences, MFA, device/session management, and account deletion/export.
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

### Profile photo upload and Azure Blob storage

- Add `POST /api/v1/customer/account/profile-photo`, `GET /api/v1/customer/account/profile-photo`, and `DELETE /api/v1/customer/account/profile-photo` inside the active-Customer route group. Upload and removal derive ownership only from the authenticated Customer.
- The POST accepts one `photo` under the shared upload policy: JPEG/JPG, PNG, or WebP only; strictly under `10 MiB`; decoded as a valid image; detected MIME/signature and normalized extension must agree; corrupt, double-extension, spoofed, and unlisted files are rejected with field-addressable `422` errors.
- Store bytes through Laravel's configured filesystem disk. Production uses the existing `FILESYSTEM_DISK=azure` Azure Blob disk; local/test environments may use their configured disk. Never hard-code a container URL, Azure credential, or disk name in Customer client code.
- Generate a server-owned UUID filename beneath `customer-profile-photos/{customer UUID}/`. Store no client filename or browser blob URL as the object identity.
- Add an additive Customer-profile migration for `profile_photo_disk`, `profile_photo_mime`, `profile_photo_size`, `profile_photo_width`, and `profile_photo_height`. Retain `profile_photo_path` as the generated relative path; do not modify the executed Customer-profile creation migration.
- The account DTO returns a safe owner-only `profilePhotoUrl` pointing to the authorized GET endpoint, optionally cache-busted by profile update time. It never returns disk, path, blob URL, credentials, raw upload metadata, or an Azure signed URL.
- The GET endpoint streams the stored object only to its owning active Customer with `private, no-store` and `nosniff` headers. Profile photos are not public marketplace assets.
- Replacement writes and validates the new object before atomically updating metadata. If the database update fails, remove the new object; after a committed replacement/removal, delete the old object best-effort without restoring stale metadata on deletion failure.
- Apply focused upload throttling, safe operational logging, and the shared maximum-dimension/decompression-bomb protections when those policy values are approved. Do not claim malware scanning exists until a scanner and pending/quarantine lifecycle are implemented.

### Concurrency, errors, and privacy

- Profile/password writes must be transactional for the User/Profile rows they touch. Concurrent retries must not partially apply a profile update or leave an unusable password/session state.
- A stale or unauthenticated request returns the project's normal `401`/`403`; a valid Customer attempting a forbidden field receives `422`, not a silently ignored mutation.
- Customer-facing errors may explain how to recover but must not disclose another account, registration state, token, or password detail.
- Changes to name/profile data should refresh the authenticated navigation display after the API confirms success. Never optimistically claim a password or profile update succeeded after a failed request.

### Deferred capabilities

- Email change is deferred. It requires a unique email/role policy, current-password confirmation, verification of the new address, collision handling, notification to the old address, and session/token consequences.
- Notification preferences are deferred until Customer notification types, delivery channels, defaults, consent, and durable preference storage are specified.
- MFA, remembered devices, session list/revocation UI, account deactivation/deletion, export, and formal security-event/audit visibility are separate approved features or policies.

### Customer experience and accessibility

- `/account/profile` remains protected by the existing same-origin `next` redirect pattern. A signed-out visitor returns to the requested Account route only after successful active-Customer sign-in.
- Phase 1 presents profile and password as separate forms with clear required-field labels, inline validation, saving/success/error states, disabled duplicate submission, and focus moved to the relevant error or confirmation.
- Do not render an editable email, status, role, or approval control as if it were functional. Link Customers to Addresses, Orders, Wishlist, and Recently Viewed rather than duplicating their contents.
- The profile photo control states accepted JPEG/PNG/WebP formats and the 10 MB maximum before selection, gives client-side early feedback only, shows transfer/persistence progress and server errors, and updates the visible photo only after Laravel confirms success. Local preview object URLs are revoked on replacement/unmount.
- Maintain responsive keyboard-accessible account navigation and use `autocomplete` attributes suitable for name, telephone, birth date, current password, and new password fields.

### Acceptance criteria

- [x] An active Customer can open the read-only `/account/profile` page; guests are redirected to sign in.
- [x] Address, Wishlist, Orders, and Recently Viewed remain distinct Customer Account navigation destinations.
- [ ] The account API and Phase 1 forms expose and update only the authenticated active Customer's allow-listed profile fields.
- [ ] A forged Customer ID, another role, inactive account, forbidden field, or cross-role same-email record cannot read or change the Customer profile.
- [ ] Password change requires the correct current password, confirmed policy-compliant replacement password, throttling, and safe session/token handling.
- [ ] A Customer can upload, replace, view, and remove only their own JPEG/PNG/WebP profile photo under 10 MiB through the configured Azure Blob/local disk.
- [ ] Spoofed, corrupt, oversized, multiple-extension, cross-account, and unauthenticated photo requests are rejected; raw blob paths/credentials are never returned.
- [ ] Private account responses and errors never expose tokens, hashes, raw media paths, registration evidence, or another Customer's data.
- [ ] UI loading, validation, retry, success, upload progress, and keyboard/focus states work without falsely reporting a saved change.

## HOW

### Existing project integration

- Reuse `CustomerProfile`, the shared `User` identity, existing Customer Auth session restoration, `customer.active` middleware, Customer protected-route shell, and Account navigation.
- Current `CustomerUserResource` is not a public Account DTO: it exposes raw `profile_photo_path` when loaded. Introduce a dedicated allow-listed account resource before serving editable account data.
- Keep `CustomerAddressController`, Wishlist, Orders, and Recently Viewed endpoints untouched except for normal navigation/auth refresh integration.
- Phase 1 profile fields need no schema change; profile photo uses the required additive metadata migration. Do not modify previous migrations.

### Laravel API

- Add a Customer-scoped `AccountController`, Form Requests, and an `AccountService` inside the existing `v1/customer` authenticated group.
- Load exactly the authenticated `User` and `customerProfile`; use a transaction and explicit allow-list for profile writes. Return `CustomerAccountResource` with camelCase fields aligned to Customer web types.
- Validate password changes with Laravel's current-password validation and configured Password rule. Use the existing hash/session/token conventions rather than inventing an alternative credential store.
- Set private cache headers, CSRF protection for the web session flow, and focused throttling for sensitive mutations. Record only redacted operational/security events if an approved Customer audit policy exists.
- Mirror the existing Admin/Seller account-photo service pattern with a Customer-scoped service and Form Request, but use the shared upload reference as the authority. Inspect/decode the image server-side, generate the path, write it to `Storage::disk(config('filesystems.default'))`, persist metadata transactionally, and serve it only through the owner-authorized endpoint.

### Customer application

- Add private API helpers/types separate from public marketplace fetch helpers, with credentialed no-store requests and safe retry behaviour.
- Replace the read-only-profile notice only when the GET/PATCH profile contract exists. Keep password editing isolated in a Security section; do not collect a current password for ordinary profile edits unless a future policy requires re-authentication.
- Add a separate profile-photo component using multipart upload. It must display the existing private delivery endpoint, accessible replacement/removal controls, format/size guidance, upload/pending/error states, and an image fallback without converting the file to Base64.
- Refresh the shared Customer auth/navigation state after a confirmed name change. On password success, follow the implemented session policy and show the resulting sign-in/session state clearly.
- Keep the generic `/account/[[...segments]]` unavailable-state page for deferred settings paths; do not manufacture empty preferences or MFA screens.

### Testing and rollout

- Laravel tests: active Customer self-read/update; guest/inactive/other-role denial; allow-list enforcement; same-email role isolation; validation; concurrent profile write behaviour; current-password failure; password policy/confirmation; rate limit; session/token outcome; safe resource/error payloads; and no-store headers.
- Photo tests: accepted formats/exact byte boundary; MIME/extension/signature spoofing; corrupt/dimension failures; generated Azure/local path; metadata persistence; owner-only delivery/replacement/removal; rollback cleanup; old-object cleanup; throttling; and no raw storage-path response.
- Customer tests: protected redirect/return; initial read-only state; profile/photo/password validation/success/failure; blocked file feedback; upload progress; private image refresh; disabled duplicate submits; navigation refresh; focus/keyboard behaviour; and responsive account navigation.
- Run focused Customer API tests, storefront lint, strict TypeScript, and production build. Append a dated `docs/PROGRESS.md` implementation entry only when a phase is built; this revision is documentation-only.

### Open implementation choices

- Decide whether a successful password change revokes every other device token/session or only the current web session; document the final policy before coding.
- Confirm which existing personal fields remain editable after registration and whether changing birth date requires an age/verification review rule.
- Decide email-change verification, notification, and collision policy as its own approved sub-feature.
- Decide whether Customer security/profile changes need a Customer-visible history or an internal redacted audit event.

### Sources

- Existing foundation: `src/webapp/src/app/(customer)/account/profile/page.tsx`, `src/webapp/src/components/account/account-navigation.tsx`, `src/api/app/Http/Controllers/Customer/AuthController.php`, `src/api/app/Models/CustomerProfile.php`, `src/api/app/Services/Seller/SellerAccountService.php`, `src/api/config/filesystems.php`, and `docs/schema.md`.
- Shared policy: `docs/references/file-upload-requirements.md`.
- [Laravel password confirmation/current-password support](https://laravel.com/docs/12.x/middleware) and [Laravel password validation](https://laravel.com/docs/12.x/validation) support the intended authenticated password-change boundary.
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) supports re-authentication and secure handling for sensitive credential changes.
- [Laravel file uploads and configured disks](https://laravel.com/docs/12.x/requests#storing-uploaded-files) supports disk-agnostic storage through the configured filesystem.
