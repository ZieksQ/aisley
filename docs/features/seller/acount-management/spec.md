---
feature: account-management
title: Seller Account Management
system: AISLEY
type: Feature Specification
version: 1.2
status: Implemented foundation
role: Seller
scope: Seller Web Application
---

# Seller Account Management

## WHAT

- **Purpose:** Let an approved active Seller manage their own profile, the one Shop's storefront details, login email/password, vacation state, and profile photo.
- **Authority:** React/Vite owns forms and feedback; Laravel owns allow-lists, validation, Seller/Shop scope, re-authentication, storage, and safe DTOs.
- **Current implementation:** profile/storefront editing, vacation fields, current-password-protected email/password changes, and private profile-photo upload/view/replace/remove are available at `/account`.
- **One-Shop rule:** a Seller edits the registration-created Shop. Account Management never creates a second Shop; incomplete required storefront data is surfaced as `SHOP_SETUP_REQUIRED` by the Dashboard.
- **Boundaries:** Seller Auth owns sessions/recovery; Admin owns status, approval, compliance, and controlled review; Product/Catalog owns product data; Inventory owns balances; payout integrations own provider secrets.
- **Non-goals:** role/status/permission changes, Admin decisions, another Seller's data, arbitrary column patches, Seller closure, MFA, payouts without an approved provider, notification preferences, or replacement evidence review.

## MUST

### Scope and safe state

- Require `auth:sanctum` and active Seller middleware. Derive the Seller and exactly one Shop from the session; reject client `seller_id`, `shop_id`, role, status, slug, category, or storage-path authority.
- Return a safe account DTO containing profile fields, Shop storefront fields, status, and a security summary. Never return password hashes, sessions, tokens, Admin notes, private evidence, provider credentials, or raw storage paths.
- Use `401` unauthenticated, `403` inactive/forbidden, `404` out-of-scope asset, `409` stale/conflicting write, and field-addressable `422` validation errors.

### Ordinary profile and storefront edits

- Allow-list only current fields: first/last/middle name, contact number, sex, birth date, Shop name/description/contact details/website, `is_on_vacation`, and a required vacation message when enabled.
- Validate length, format, URL, enum, and date rules server-side. Storefront Markdown/text is untrusted and must render safely in Buyer surfaces.
- Keep Shop status, slug, category, Seller role, account status, commission, permissions, and Admin decisions server-controlled.
- Active Shop values are the only Buyer-visible values. If a future field requires review, preserve the active value and store the proposal separately; do not silently replace it.

### Email and password

- Email changes require the current password and Seller-role uniqueness; normalize before comparison and update only the authenticated Seller account.
- Password changes require current-password verification, confirmation, the project password policy, Laravel hashing, and token invalidation. Never log or return plaintext credentials.
- The current MVP intentionally has no Seller MFA or controlled-change review for email/password. Add those only after Seller Auth approves a shared policy.

### Profile photo and private storage

- Upload, view, replace, and delete only the authenticated Seller's photo. The endpoint derives ownership from the session, not a submitted user/profile ID.
- Follow [`docs/references/file-upload-requirements.md`](../../../references/file-upload-requirements.md): JPEG/JPG, PNG, or WebP only; strictly under 10 MiB; server MIME/signature/decode checks; generated object names; and private delivery.
- Store bytes on the configured filesystem (including Azure Blob when selected) and only validated disk/path metadata on `SellerProfile`. Return an authorized application URL with private/no-store headers, never the raw path or public blob URL.
- Replacing a photo updates metadata transactionally and removes the previous object only after the new record commits. A failed persistence operation removes the newly stored object.

### Notices, audit, and concurrency

- Seller security activity is a safe operational log; it is not an Admin-only audit-ledger mutation. Do not record passwords, hashes, complete emails/payout data, files, or private URLs.
- If a future notification is configured, dispatch it after a committed mutation. Notification failure must not roll back the valid account change.
- Lock the affected profile/Shop for concurrent writes and return `409` on a stale controlled write; the client refetches canonical state before retrying.
- Payout details, notification preferences, controlled identity/evidence changes, MFA, and self-deactivation remain deferred rather than inventing fields or workflows.

### UX and acceptance

- Provide labeled, keyboard-accessible forms, visible focus, field errors, save progress, password autocomplete, upload progress, retry, and non-color-only status.
- [x] A Seller reads and updates only their own allow-listed profile and storefront fields.
- [x] The Shop vacation state/message and current-password email/password flows are enforced by Laravel.
- [x] Role, status, slug, category, Admin decisions, and other protected fields cannot be self-edited.
- [x] Profile-photo replacement/removal is authorized, validated, private, and path-safe.
- [x] Account DTOs mask security-sensitive data and account mutations emit secret-free operational logs.
- [ ] Controlled review, payout tokenization, preference matrix, MFA, document replacement, notification delivery policy, and Seller-initiated closure are approved and implemented.

## HOW

- Current routes are `GET/PATCH /api/v1/seller/account`, profile/storefront/email updates, `PUT /account/password`, and `POST/GET/DELETE /account/profile-photo` under `auth:sanctum,seller.active`.
- Current implementation is `src/api/app/Http/Controllers/Seller/AccountController.php`, `SellerAccountService`, Seller Form Requests/Resources, and the configured filesystem. `SellerAccountService` locks profile rows, stores generated photo keys, redacts logs, and cleans up replaced objects.
- The Seller `/account` pages consume the credentialed API and show profile, storefront, vacation, security, and photo controls. Do not add unsupported payout/preference panels as if they were live.
- Keep migrations additive; enum-like values remain strings with PHP enum casts. Add controlled-change or asset metadata tables only after their policies are approved.
- Test Seller isolation, protected-field rejection, validation, current-password failures, role-scoped email uniqueness, password hashing/token invalidation, photo MIME/extension/size spoofing, private delivery, replacement rollback, and stale writes. Run Seller lint, TypeScript, build, and API tests on SQLite/PostgreSQL.

### Current interface

- `GET /api/v1/seller/account` returns the Seller identity, profile, one Shop, and safe security flags.
- `PATCH /account/profile` accepts only profile fields; `PATCH /account/storefront` accepts only storefront/vacation fields. Neither route accepts status, slug, category, reviewer, or ownership values.
- `PATCH /account/email` and `PUT /account/password` require `current_password` and return no credential material. Password changes delete applicable personal access tokens; the shared web-session reset policy remains open.
- `POST /account/profile-photo` accepts one `photo` field; `GET` streams the authorized private object; `DELETE` removes metadata and the old object. Responses expose a versioned application URL, not a storage path.
- The Seller SPA keeps saving, validation, upload, retry, and account-status feedback in the Account page; it must not present deferred payout, preferences, or controlled-review controls as live.

### Data and privacy boundaries

- Profile and Shop writes are separate allow-listed operations so an unexpected field cannot mass-assign `users`, `seller_profiles`, or `shops` columns.
- A private profile photo is not a public Shop asset. It is available only to the authenticated owner, with `private, no-store` delivery and `nosniff` headers.
- Shop description and vacation message are untrusted text. Buyer surfaces sanitize/render them through their owning storefront contract.
- A profile-photo replacement keeps the old object until the new metadata commits; a failed transaction deletes only the newly uploaded object.
- Security logs contain action/result, changed field names, request ID, and safe actor context only. Admin audit history is not a substitute for Seller self-service logs.

### Future policy gates

- Define which storefront/legal identity edits need Admin review and where proposed values are stored before adding controlled-change endpoints.
- Approve payout provider/tokenization and masking before collecting bank or wallet identifiers.
- Decide preference categories and mandatory compliance/security notices before enabling notification settings.
- Define MFA, email-change verification, full session revocation, document categories, and account closure before exposing those actions.

### Mutation transaction boundary

- Profile/storefront/email/password mutations lock the authenticated record, compare the current server state, allow-list fields, write the mutation, and emit a safe log in one transaction.
- Photo bytes are validated and stored before the profile transaction; the new metadata is committed first, then the old object is deleted. A storage deletion failure is reported and retried without restoring an obsolete profile path.
- No Account Management mutation changes Product publication, Inventory, Orders, Shop category, Admin approval, or compliance state. Those links must remain explicit in the UI and API.
- Account DTOs are safe to cache only for the current authenticated request; never share them through a public or cross-user cache.

### Verification checklist

- Test an active Seller, a pending/rejected/suspended Seller, another Seller, and same-email users in every other role against each route.
- Test forged protected fields, malformed URLs/enums/dates, stale profile/Shop writes, current-password failures, token invalidation, and duplicate Seller email attempts.
- Test valid/spoofed/mismatched/oversized/corrupt profile images, private response headers, replacement rollback, and object cleanup on storage/database failure.
- Test Buyer-facing Shop reads after ordinary edits and ensure private profile photos never appear in public Shop or Product DTOs.
- Test that a deactivated or suspended Seller's existing session cannot read, upload, replace, or delete a profile photo after the next request.
- Verify the Account page does not infer approval or Shop publication from a successful profile mutation; status remains server-owned.
- Keep API responses consistent with Seller Auth's safe DTO so session bootstrap and Account settings cannot disagree about role/status.

**References:** `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Seller.md`, Seller Auth, Admin Account Management, and the shared file-upload policy.
