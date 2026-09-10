---
feature: courier-account-management
title: Courier Account Management
system: AISLEY
type: Feature Specification
version: 2.3
status: Phase 1 account operations and profile-photo extension implemented
implementation_status: implemented; six protected account routes available
canonical: true
role: Courier / Rider
scope: Laravel API plus external Flutter mobile client
backend_contract_commit: 20afd9f (Courier profile-photo implementation)
backend_contract_version: courier-account-management-v1 (photo extension implemented)
source_coverage: requirements.md, workspace.md, schema.md, Courier.md, Logistics.md, courier/auth/spec.md, courier/rules.md, file-upload-requirements.md
---

# Courier Account Management

## WHAT

- Purpose: let an authenticated Courier view and maintain safe personal account information in the external Flutter app.
- Primary actor: the Courier resolved from the Sanctum bearer token.
- Implemented Phase 1: own-account read, basic profile updates, and password change.
- Implemented extension: own profile-photo upload, private retrieval, replacement, and removal.
- Laravel is authoritative; Flutter displays server responses and submits only documented fields.
- Courier registration, Logistics affiliation approval, bearer login, /me, logout, profile, address, vehicle, and token tables already exist.
- The six account endpoints are available only through the protected /api/v1/courier bearer-token boundary.
- This document is the callable contract for the implemented account and photo operations.

Current flow:
sign in and store bearer token
→ GET /api/v1/courier/account
→ view or edit allowed profile fields
→ PATCH profile or PUT password
→ server validates and returns the current account

Photo flow:
select image locally → POST /api/v1/courier/account/profile-photo
→ server validates and persists it → account returns a safe delivery URL
→ Flutter fetches the private image with the bearer token

Account Management begins only after Courier access is active. It does not approve registration, change Logistics affiliation, assign work, or alter shipment state.

Vehicle mutations, license information, payout methods, email changes, account deletion, availability, and delivery operations remain separate or deferred.

Non-goals:

- No Courier web or React UI in this repository; screens belong to the external Flutter project.
- No Shipment, Parcel, Waybill, Scan, Delivery Task, assignment, proof, route, or order-status writes.
- No self-service role, status, reviewer, organization, hub, or affiliation changes.
- No payment, payout execution, license-government lookup, 2FA, SMS, push, map provider, or direct Azure SDK dependency.

## MUST

### Authentication and ownership

- Every endpoint requires auth:sanctum and courier.active.
- Recheck persisted courier role, active User status, approved affiliation, active Logistics owner, and valid sole hub.
- Flutter sends Authorization: Bearer; it does not send browser cookies or CSRF tokens for this API.
- Resolve the only account scope from the authenticated User. Prohibit client user_id, courier_id, profile IDs, role, status, organization, hub, reviewer, path, or token-ability fields.
- Same-email Customer, Seller, Admin, or Logistics records never inherit Courier access.
- Affiliation and sole-hub data are read-only; reassignment belongs to Logistics.
- Failed authorization makes no mutation and does not disclose another account.

### Phase 1 profile contract

- Editable fields are first_name, middle_name, last_name, and contact_number only.
- Trim names and normalize an empty optional middle_name to null; retain existing length limits.
- contact_number remains within the existing 32-character limit.
- sex, birth_date, and derived age are read-only because correction authority is not defined.
- Email, role, status, approval data, affiliation, hub, timestamps, and internal paths are read-only.
- The account response exposes a safe owner-authorized profile_photo_url when a photo exists and profile_photo_editable true.
- A profile update changes only submitted allow-listed fields and returns the post-commit projection.
- Profile writes use a transaction and lock the authenticated Courier profile.

### Profile-photo extension (implemented)

- POST, GET, and DELETE /api/v1/courier/account/profile-photo are inside the active-Courier route group and covered by API tests.
- POST is multipart/form-data with one required photo field. Ownership is derived from the bearer token; client IDs and storage paths are prohibited.
- Apply docs/references/file-upload-requirements.md without overriding it: JPEG/JPG, PNG, or WebP only; strictly under 10 MiB; server MIME/signature/decode validation; mismatches, corrupt, double-extension, spoofed, or unlisted files return field-addressable 422.
- Use Laravel's configured filesystem (FILESYSTEM_DISK; Azure Blob when configured) and never hard-code Azure credentials, container names, or public blob URLs.
- Generate a server-owned UUID object name under courier-profile-photos/{courier UUID}/; do not use the original filename as identity.
- Add an additive migration for profile_photo_disk, profile_photo_mime, profile_photo_size, profile_photo_width, and profile_photo_height; retain the existing relative profile_photo_path and do not edit the executed creation migration.
- Persist validated metadata and the new pointer transactionally. If persistence fails, remove the new object; after commit, delete a replaced object best-effort without restoring stale metadata.
- GET streams only the authenticated owning active Courier's object with detected Content-Type, private/no-store, Pragma: no-cache, and X-Content-Type-Options: nosniff.
- DELETE clears metadata and removes the current object; no-photo deletion is idempotent. Upload replacement and deletion never expose raw paths or credentials.
- The account DTO exposes only an owner-authorized profile_photo_url for that GET endpoint; it never exposes disk, path, blob URL, signed URL, or raw upload metadata.
- Upload retries use a stable Idempotency-Key when available; after an uncertain response Flutter refetches account/photo state before retrying. GET is safe to retry; DELETE is idempotent.
- Do not claim malware scanning, quarantine, derivatives, or stricter dimensions until their policies and lifecycle are approved.

### Password security

- Password change requires current_password, password, and password_confirmation.
- Verify the current password and use the centralized Laravel password policy.
- Never return or log password values, hashes, reset values, bearer tokens, or token hashes.
- A successful change rotates remember_token and revokes every Courier personal access token, including the request token.
- Flutter clears secure storage and requires fresh login after password success; do not automatically retry after a timeout.
- Courier forgot-password remains a generic recovery acknowledgement, not an Account Management reset endpoint.

### Existing authentication dependencies

| Endpoint                              | Status      | Use                                                |
| ------------------------------------- | ----------- | -------------------------------------------------- |
| GET /api/v1/courier/auth/me           | implemented | identity and approval-gated session check          |
| POST /api/v1/courier/auth/logout      | implemented | deletes the current personal access token          |
| GET /api/v1/courier/account           | implemented | full Phase 1 account projection                    |
| PATCH /api/v1/courier/account/profile | implemented | allow-listed profile update                        |
| PUT /api/v1/courier/account/password  | implemented | current-password change                            |
| POST /api/v1/courier/account/profile-photo | implemented | multipart upload/replacement |
| GET /api/v1/courier/account/profile-photo  | implemented | private owner-only stream      |
| DELETE /api/v1/courier/account/profile-photo | implemented | idempotent removal             |

### Endpoint: account read

- GET /api/v1/courier/account; auth:sanctum plus courier.active; no query or client identity fields.
- Returns 200 with account, profile, affiliation, and security capability data for the authenticated Courier.
- Profile includes names, contact number, sex, birth_date, derived age, and nullable profile_photo_url.
- Affiliation includes approved status, organization name, and sole hub name; private evidence and organization internals are excluded.
- Current security flags are email_editable: false, profile_photo_editable: true, and password_change_requires_current_password: true.
- Responses use Cache-Control: private, no-store and Pragma: no-cache; GET is safe to retry with bounded backoff.
- Errors: 401 missing/invalid bearer; 403 inactive, wrong role, invalid affiliation, or invalid hub.

Minimal response:
{ "account": { "id": "uuid", "email": "courier@example.com", "role": "courier", "status": "active", "profile": { "first_name": "Ana", "middle_name": null, "last_name": "Santos", "contact_number": "09...", "sex": "female", "birth_date": "1999-01-01", "age": 27, "profile_photo_url": "/api/v1/courier/account/profile-photo?v=..." }, "affiliation": { "status": "approved", "organization_name": "Example Logistics", "hub_name": "Main Hub" }, "security": { "email_editable": false, "profile_photo_editable": true, "password_change_requires_current_password": true } } }

### Endpoint: profile update

- PATCH /api/v1/courier/account/profile; auth and scope match account read.
- Content-Type: application/json; allowed keys are first_name, middle_name, last_name, and contact_number.
- Prohibit IDs, email, role, status, sex, birth_date, age, all photo/storage fields, organization/hub fields, and arbitrary model attributes.
- 200 returns a message and complete post-commit account projection; 422 returns field-addressable errors with no partial update.
- Repeated identical payloads are safe; use an Idempotency-Key when available and refetch after an uncertain response.
- This private response must not enter shared or public caches.

Example:
{ "first_name": "Ana", "middle_name": null, "last_name": "Santos", "contact_number": "09171234567" }

### Endpoint: password update

- PUT /api/v1/courier/account/password; auth and scope match account read; JSON body requires the three password fields.
- Prohibit email, role, status, token, abilities, User IDs, and remember.
- 200 means the password was committed and all personal access tokens were revoked; response contains only a success message.
- 401 means missing/invalid bearer; 403 means the account is no longer eligible; 422 covers current-password or policy failure.
- 429 applies the credential-sensitive throttle and includes Retry-After; never auto-retry this mutation.
- Response is private/no-store and contains no replacement token.

### Privacy, errors, and client states

- DTOs contain no password, hash, bearer token, token hash, evidence bytes, raw storage path, reviewer note, payout credential, or unrestricted Buyer/Seller data.
- Account data and the profile photo are visible only to the authenticated Courier; never shared-cache personalized responses.
- Network failure is distinct from validation, forbidden, inactive, signed-out, and unavailable-feature states.
- Flutter states include token checking, signed out, pending/rejected approval, suspended, invalid affiliation, authenticated, loading, success, validation error, forbidden, retryable failure, timeout, and offline.
- For the photo control, show accepted formats/size before selection, local preview, progress, cancellation, server rejection, retry, missing-photo fallback, and confirmed-success refresh. Do not claim success from a local preview.
- Never log passwords, bearer headers, file contents, raw paths, or private URLs; clear account/photo state after logout, revocation, or 401.
- Server revalidation wins over cached display data; authoritative profile/photo writes are not queued offline.

### Acceptance criteria

- [x] Guest, invalid-token, wrong-role, inactive, and invalid-affiliation requests cannot read or mutate the account.
- [x] A Courier can read only the account resolved from its bearer token.
- [x] Profile updates persist only the four allow-listed fields and preserve all other values.
- [x] Role, status, email, affiliation, hub, age, and registration evidence cannot be changed through profile update.
- [x] Invalid fields produce 422 errors without a partial write.
- [x] Concurrent profile writes are serialized and return the latest committed projection.
- [x] Password change requires the current password and centralized password validation.
- [x] A successful password change revokes all Courier personal access tokens and forces fresh login.
- [x] Passwords, hashes, tokens, paths, and private evidence are absent from every DTO and log.
- [x] Responses are private and no-store; no personalized account data is shared-cached.
- [x] Flutter handles current account loading, success, validation, forbidden, 401, 429, timeout, and offline states.
- [x] A Courier can upload, replace, privately view, and remove only their own valid profile photo through the implemented endpoints.
- [x] The photo endpoint enforces the shared format, exact byte limit, signature/MIME/decode, extension, and ownership rules.
- [x] Photo metadata is persisted without exposing raw paths; replacement rollback and best-effort old-object cleanup are safe.
- [x] Unauthorized, inactive, missing-photo, malformed, oversized, spoofed, corrupt, and throttled photo requests return truthful safe responses.
- [x] Flutter photo picker, crop/preview, progress, cancel, retry, fallback, 401, 403, 422, 429, timeout, and offline states match the API.

## HOW

### Backend implementation

- Keep the existing Courier AccountController, Form Requests, AccountResource, AccountService, protected routes, throttles, and tests for the six-route slice.
- Resolve User from Request::user(), load exactly one CourierProfile, and never accept a target ID.
- The photo extension uses a Courier Form Request, service methods, controller routes, resource projection, private stream response, and focused throttle.
- Use a transaction and row lock for metadata; use configured Storage and compensation cleanup rather than direct Azure SDK calls.
- The additive metadata migration leaves the executed Courier-profile migration unchanged.
- Flutter may call the photo routes after adopting this released contract and API version.

### Data and dependencies

- Current Phase 1 needs no migration: existing profile fields and personal access tokens support the implemented slice.
- The photo implementation uses existing profile_photo_path plus disk/MIME/size/width/height metadata, consistent with other role profile-photo implementations.
- Age remains derived from birth_date; it is never stored or client-supplied.
- Vehicle, license, payout, and evidence changes remain separate contracts; registration approval remains Logistics-owned.
- Shipment and Delivery Task schema approval is not a prerequisite for this account feature.
- The shared upload policy is mandatory; stricter avatar limits, scanning, derivatives, retention, and audit policy remain open.

### Flutter handoff

- Use bearer tokens in OS secure storage; do not use browser cookies, shared preferences for tokens, or plaintext logs.
- Use Dart models matching the snake_case JSON names and call only the implemented photo routes.
- Send multipart/form-data field photo, retain no Base64/blob URL as server identity, and refresh the private image only after 200.
- Keep local edits/previews separate from authoritative account state and never bypass server approval or revalidation.

### Tests and rollout

- Existing tests cover role/status/affiliation gates, IDOR attempts, prohibited fields, normalization, transactions, concurrency, privacy, and token revocation.
- Photo tests cover accepted types/exact byte boundary, MIME/extension/signature spoofing, corrupt images, generated disk paths, metadata, owner-only delivery, replacement/removal, throttling, and no raw path.
- Add Flutter contract tests for multipart names, JSON/photo parsing, secure-storage failures, upload progress, retries, image fallback, 401/403/422/429, timeout, offline recovery, and accessible announcements.
- The focused Laravel Courier suite passes; update the Flutter copy with the released API commit/version before mobile rollout.
- Append the implementation summary to docs/PROGRESS.md with the code commit and test result.

### Open decisions

- Whether to require an idempotency record/table for upload retries or rely on refetch-before-retry.
- Whether profile-photo metadata needs checksum, scan state, derivatives, retention, or redacted audit events.
- Whether a Logistics operator may view a Courier photo; default is owner-only.
- Whether sex or birth-date corrections require Logistics review, and whether email changes require re-verification.
- Any future token lifetime or active-device management policy.

### Source boundaries

- Shared identity, address, vehicle, affiliation, hub, and auth rules come from requirements.md, workspace.md, schema.md, Courier.md, and Logistics.md.
- Courier bearer-token and Flutter boundaries come from courier/auth/spec.md and courier/rules.md.
  > Use docs/references/file-upload-requirements.md as the mandatory upload contract. Define only Courier-specific API, schema, ownership, lifecycle, and Flutter behavior; do not duplicate or override the shared policy.
- Historical order-logistics decisions cannot authorize this feature or create operational records.
- This Phase 1 contract remains standalone; profile-photo routes are implemented for the external Flutter client.
