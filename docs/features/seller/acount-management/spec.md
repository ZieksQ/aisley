---
feature: account-management
title: Seller Account Management
system: AISLEY
type: Feature Specification
version: 1.1
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Account Management

## WHAT

- Approved, active Sellers manage their own profile, single Shop’s public identity, password, supported notification preferences, and controlled sensitive changes.
- The Seller React/Vite dashboard owns forms, masked summaries, pending-review states, and accessible feedback. Laravel owns Seller scope, allow-lists, validation, re-authentication, review state, storage, auditing, and safe DTOs.
- Existing foundation: `SellerProfile` stores name, contact number, sex, birth date, and optional photo path; the Seller owns exactly one `Shop` with name, description, contact details, logo/banner paths, and vacation fields.
- Seller Auth owns sessions and recovery. Admin approval/compliance owns account status and decisions. Product Management owns catalog data. Payment integration owns provider-specific payout tokenization.
- This feature does not let a Seller change role, account/compliance status, commission, permissions, Admin decisions, another Seller’s data, or arbitrary model columns.
- It does not invent Seller MFA, a payout provider, self-account closure, or mandatory moderation for every ordinary update. Until an approved MFA mechanism exists, email and password changes use server-verified current-password confirmation and apply immediately.

## MUST

### Authorization and current state

- Every API requires `auth:sanctum`, active Seller role/status middleware, and identity derived only from the authenticated user.
- Direct requests must be scoped to that Seller’s `SellerProfile` and exactly one Shop; never trust submitted `seller_id`, `shop_id`, role, status, or storage path.
- Return a safe current-account DTO with profile, Shop, safe security summary, supported preferences, and any Seller-visible pending controlled changes.
- Never return password hashes, current passwords, sessions, tokens, private Admin notes, private document paths, or full payout credentials.
- Use `401` unauthenticated, `403` wrong/inactive role, `404` out-of-scope resource, `409` stale/review conflict, and field-addressable `422` validation errors.

### Ordinary profile and storefront changes

- Allow-list only fields backed by the current schema: profile name/contact fields and Shop name, description, contact email/number, website, vacation state/message, and approved image references where enabled.
- Laravel validates type, length, format, and any existing uniqueness/reserved-value rule. Storefront text is untrusted and must render safely for Buyers.
- Ordinary updates may become active immediately only when policy allows. Buyer-facing queries must read active approved Shop values, never a pending/rejected proposal.
- If a Storefront or identity field requires review, preserve the active value and store the proposed value separately until approval; a rejected proposal changes nothing active.
- Do not make a generic mass-assignment `PATCH` endpoint that accepts every `users`, `seller_profiles`, or `shops` column.

### Controlled and sensitive changes

- Sensitive/controlled categories are legal identity or ownership, primary login identifier when enabled, payout destination, replacement verification evidence, and security credentials.
- A controlled-change record must contain Seller ownership, change type, safe/encrypted proposed value or asset reference, status, timestamps, reviewer, and Seller-visible rejection reason where policy permits.
- Lifecycle is `PENDING_REVIEW → APPROVED | REJECTED`; only approval applies the proposed value. Duplicate or stale review/submission actions return `409`.
- Sensitive changes require server-enforced re-authentication before submission. The Seller must see a safe summary of the change being confirmed.
- Re-auth freshness, additional factors, and whether a sensitive change needs human review are server policy decisions; React timestamps or flags are never proof.
- Current temporary policy: changing the Seller login email requires the current password and updates the Seller role-account immediately without 2FA or a controlled-change record. Replace this bypass when Seller MFA and sensitive-change review policy are approved.

### Password and session security

- Password change requires authenticated Seller, current-password verification, project password policy, confirmation, and Laravel’s configured hashing.
- Never log, audit, return, or persist a plaintext password; audit only the safe action/result metadata.
- Rotate/invalidate sessions, remember tokens, or API tokens according to the shared Seller Auth decision after a successful password change.
- MFA/2FA configuration is out of scope until Seller Auth defines an approved mechanism. Factor changes must then be treated as sensitive changes.

### Payout information

- Payout changes are sensitive and require re-authentication, provider/format validation, server-side authorization, and review when policy requires it.
- Preferred flow: Seller submits data to an approved provider/integration; AISLEY stores only provider reference/token plus a masked safe summary and verification state.
- The browser may see provider/type, masked identifier, and status only. It must never receive complete payout identifiers, provider secrets, or stored raw credentials.
- If no payout provider/model exists, preserve payout as an integration boundary rather than inventing bank fields or a gateway.

### Verification documents and images

- Replacement verification documents follow `docs/references/file-upload-requirements.md`: authorized Seller ownership, JPEG/JPG/PNG/WebP only, strictly under 10 MiB, server MIME/signature/decode checks, generated storage paths, and private delivery.
- Uploads create a controlled pending change where review is required; they never overwrite approved evidence in place or become publicly retrievable.
- Profile/shop images use the same ownership, validation, generated-path, and visibility rules. Pending, rejected, and cross-tenant assets are not public.

### Preferences, notices, audit, and concurrency

- Support only explicitly configured notification preferences. Compliance and security notices cannot be disabled by a generic preference.
- Send an after-commit out-of-band notice when configured for password, payout, identity, or authorization-factor changes. Notification failure does not roll back a valid mutation.
- Audit sensitive actions with Seller ID, action, result, request reference, and safe old/new summaries; never record secrets, hashes, full payout data, files, or private URLs.
- Use revisions/locking for sensitive or controlled writes. On `409`, the client refetches canonical account state before retrying.

### APIs and UX

- Follow `/api/v1/seller/account` conventions:

```http
GET   /account
PATCH /account/profile
PATCH /account/storefront
PATCH /account/email
PUT   /account/password
POST  /account/profile-photo
GET   /account/profile-photo
DELETE /account/profile-photo
PUT   /account/notification-preferences
POST  /account/controlled-changes
POST  /account/payout-change
POST  /account/verification-documents
```

- Exact route grouping may follow repository conventions, but each mutation needs a dedicated Form Request and safe `SellerAccountResource` projection.
- The dashboard provides profile, storefront, security, payout, preferences, and pending-changes sections with loading, validation, saving, pending, approved/rejected, conflict, and retry states.
- Forms use labels, keyboard-accessible confirmations, field errors, correct password autocomplete, non-color-only review status, upload progress, and masked sensitive summaries.

### Acceptance criteria

- [x] A Seller can read and modify only their own allowed profile/Shop fields.
- [x] Platform-controlled role, status, commission, permissions, and Admin decisions cannot be self-edited.
- [x] Ordinary active storefront values are validated and are the only values exposed to Buyers.
- [ ] A controlled change preserves the active value until approved; rejection leaves it unchanged.
- [x] Password change verifies current credentials and persists only a Laravel hash.
- [ ] Payout data is re-authenticated, masked/tokenized, and never returned in full.
- [x] Seller profile-photo replacement is private, authorized, validated, and does not expose storage paths.
- [ ] Verification-document replacement creates a controlled pending change instead of overwriting approved evidence.
- [x] Implemented account mutations emit safe operational security logs without secrets; the Admin-only audit ledger remains restricted to Admin actions.
- [ ] Required security notices run only after committed mutations.

## HOW

- Reuse `User`, `SellerProfile`, `Shop`, current Seller Auth middleware/session flow, shared file-upload policy, Laravel Form Requests/Resources, configured filesystem, and the existing audit infrastructure.
- Add an additive migration only for new controlled-change, preference, payout-reference, or safe image-metadata records. Do not alter executed migrations; database enum-like values remain strings with Eloquent enum casts.
- Implement Seller-scoped account service methods: read current account, update ordinary profile/storefront fields, change password, submit controlled/payout/document changes, and apply approved changes through the appropriate Admin workflow.
- Make each service mutation transactional. Lock the affected Seller/Shop/change record, validate current revision/state, write the safe record, audit inside the transaction, and dispatch notices/cache/search refresh only after commit.
- Use a dedicated private asset endpoint or configured short-lived authorization mechanism for evidence and other private images; persist metadata/path, not bytes or browser URLs.
- Add Laravel tests for Seller isolation, protected fields, validation, active-vs-pending Buyer visibility, re-auth, password hashing, payout masking, upload authorization, review transitions, conflict handling, and secret-free audit data.
- Add Seller UI tests for form validation, pending/rejected states, password failure, masked payout display, upload errors/progress, conflict recovery, and accessibility.
- Roll out after policy decides editable/reviewed fields, payout integration, email/MFA/session behavior, document categories, preference matrix, and Seller-initiated closure.

### Sources

- Project: `docs/requirements.md`, `docs/architecture.md`, `docs/domains/Seller.md`, current Seller models and Seller Auth spec.
- [AISLEY file upload requirements](../../references/file-upload-requirements.md)
- [Laravel current-password validation](https://laravel.com/docs/11.x/validation)
- [OWASP re-authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP transaction authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
