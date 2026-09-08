---
feature: courier-account-management
title: Courier Account Management
system: AISLEY
type: Feature Specification
version: 2.0
status: Phase 1 implementation-ready; API not implemented
implementation_status: planned; no Courier account-management routes currently exist
canonical: false
role: Courier / Rider
scope: Laravel API plus external Flutter mobile client
backend_contract_commit: 3c4303d (auth/dashboard baseline; account endpoints absent)
backend_contract_version: courier-account-management-v1 (planned)
source_coverage: requirements.md, workspace.md, schema.md, Courier.md, Logistics.md, courier/auth/spec.md, courier/rules.md
---

# Courier Account Management

## WHAT
- Purpose: let an authenticated Courier view and maintain the safe, personal account information needed by the Flutter app.
- Primary actor: the Courier whose identity is derived from the Sanctum bearer token.
- Phase 1 scope: own-account read, basic profile updates, and password change.
- The API is the authority; Flutter only displays server responses and submits allow-listed fields.
- Current foundation: Courier registration, Logistics affiliation approval, bearer login, /me, logout, profile, address, vehicle, and token tables exist.
- Current gap: no Courier account-management controller, request, resource, service, route, or test exists.
- This specification defines planned endpoints; planned routes are unavailable until the Laravel implementation is added and tested.
- Because the API is absent, this reviewed plan is not a callable backend authority; mark it canonical after implementation and contract tests land.

Request flow:
    sign in and store bearer token
    → GET /api/v1/courier/account
    → view or edit allowed profile fields
    → PATCH profile, or PUT password
    → server validates and returns the current account

Account Management begins only after Courier access is active. It does not approve registration, change Logistics affiliation, assign work, or alter shipment state.

Phase 1 deliberately excludes vehicle mutations, license information, payout methods, profile-photo upload, email changes, account deletion, availability, and delivery operations. Those areas need separate authority, storage, or policy decisions.

Non-goals:
- No Courier web or React UI in this repository; screens belong to the external Flutter project.
- No Shipment, Parcel, Waybill, Scan, Delivery Task, assignment, proof, route, or order-status writes.
- No self-service role, status, reviewer, organization, or hub changes.
- No payment, payout execution, license-government lookup, 2FA, SMS, Push, or map provider.

## MUST
### Authentication and ownership
- Every Phase 1 endpoint requires auth:sanctum and courier.active.
- The server must recheck the persisted courier role, active user status, approved affiliation, active Logistics owner, and valid sole hub.
- Flutter sends Authorization: Bearer token; it does not send cookies or CSRF tokens for this feature.
- The authenticated user is the only account scope. Client-supplied user_id, courier_id, profile_id, role, status, organization_id, hub_id, reviewer_id, or token abilities are prohibited.
- A same-email Customer, Seller, Admin, or Logistics account must never inherit Courier access.
- Affiliation organization and sole hub are read-only. Reassignment remains a separate Logistics workflow.
- Failed authorization must make no mutation and must not disclose another account.

### Phase 1 profile contract
- Editable profile fields are first_name, middle_name, last_name, and contact_number only.
- Names are trimmed; an empty optional middle_name is normalized to null.
- Required names remain non-empty strings with the existing profile length limits.
- contact_number is required when supplied and remains within the existing 32-character limit.
- sex, birth_date, and derived age are read-only in Phase 1 because registration evidence and correction authority are not defined.
- email, role, status, approval data, affiliation, hub, timestamps, and internal paths are read-only.
- Profile photo is not uploaded, replaced, or deleted by this feature. The nullable legacy profile_photo_path is never returned as a raw path.
- A profile update changes only the submitted allow-listed fields and preserves all other profile values.
- The update is transactional, locks the authenticated Courier profile, and returns the post-commit account projection.

### Password security
- Password change requires current_password, password, and password_confirmation.
- The backend verifies current_password and applies the centralized Laravel password policy.
- Password fields, hashes, reset values, and tokens never appear in responses, logs, audit metadata, or Flutter state.
- A successful password change rotates remember_token and revokes every personal access token for the Courier, including the token used by the request.
- Flutter must treat the successful response as a signed-out state, clear secure storage, and require a fresh login.
- A password request is not automatically retried after a timeout because the server may already have committed it.
- Courier forgot-password currently returns only a generic acknowledgement; it is not an Account Management reset endpoint.

### Existing authentication dependencies
| Endpoint | Status | Use |
| --- | --- | --- |
| GET /api/v1/courier/auth/me | implemented | identity and approval-gated session check |
| POST /api/v1/courier/auth/logout | implemented | deletes the current personal access token |
| GET /api/v1/courier/account | planned/unavailable | full Phase 1 account projection |
| PATCH /api/v1/courier/account/profile | planned/unavailable | allow-listed profile update |
| PUT /api/v1/courier/account/password | planned/unavailable | current-password change |

Flutter must not call an endpoint marked planned or unavailable.
### Endpoint: account read
- Method/path: GET /api/v1/courier/account.
- Auth: auth:sanctum plus courier.active; no query parameters or client identity fields.
- Response: 200 with account, profile, affiliation, and security capability data for the authenticated Courier.
- Account includes id, email, role, and status. Profile includes first_name, middle_name, last_name, contact_number, sex, birth_date, age, and profile_photo_url (currently null).
- Affiliation includes approved status, organization name, and sole hub name; it does not expose organization internals or private evidence.
- Security includes email_editable=false, profile_photo_editable=false, and password_change_requires_current_password=true.
- Response headers are Cache-Control: private, no-store and Pragma: no-cache.
- GET is safe to retry. On timeout, Flutter may retry with bounded backoff.
- Errors: 401 unauthenticated/invalid token; 403 inactive, wrong role, invalid affiliation, or invalid hub.

Minimal response shape:
    { "account": { "id": "uuid", "email": "courier@example.com",
      "role": "courier", "status": "active",
      "profile": { "first_name": "Ana", "middle_name": null,
        "last_name": "Santos", "contact_number": "09...",
        "sex": "female", "birth_date": "1999-01-01", "age": 27,
        "profile_photo_url": null },
      "affiliation": { "status": "approved",
        "organization_name": "Example Logistics", "hub_name": "Main Hub" },
      "security": { "email_editable": false,
        "profile_photo_editable": false,
        "password_change_requires_current_password": true } } }

### Endpoint: profile update
- Method/path: PATCH /api/v1/courier/account/profile.
- Auth and scope are identical to account read.
- Content-Type is application/json. Allowed keys are first_name, middle_name, last_name, and contact_number.
- Prohibited keys include id, user_id, courier_id, email, role, status, sex, birth_date, age, profile_photo_path, organization_id, hub_id, and arbitrary model attributes.
- A successful 200 response returns message and the complete post-commit account projection.
- 401 and 403 have the same meanings as account read.
- 422 returns field-addressable validation errors and no partial update.
- Repeated identical payloads are safe; the server must not change ownership or duplicate a business effect.
- Flutter should send an Idempotency-Key for a user-initiated save when available. On an uncertain response, fetch account before showing failure.
- This endpoint is private and no-store; do not persist its response in shared or public caches.

Example request:
    { "first_name": "Ana", "middle_name": null,
      "last_name": "Santos", "contact_number": "09171234567" }

### Endpoint: password update
- Method/path: PUT /api/v1/courier/account/password.
- Auth and scope are identical to account read.
- Content-Type is application/json. Required keys are current_password, password, and password_confirmation.
- Prohibited keys include email, role, status, token, abilities, user_id, courier_id, and remember.
- 200 means the password was committed and all personal access tokens were revoked.
- 401 means the bearer token is missing or invalid; 403 means the account is no longer eligible.
- 422 covers invalid current_password, password policy failure, and confirmation mismatch.
- 429 is returned when the configured credential-sensitive throttle is exceeded and includes Retry-After.
- Do not auto-retry this mutation. After a timeout, retain no password in memory, clear the token only after the result is known, and use login to verify access.
- Response is private, no-store, and contains only a success message; it never returns a new token.

### Privacy and failure rules
- DTOs contain no password, hash, bearer token, token hash, evidence bytes, raw storage path, reviewer note, payout credential, or unrestricted Buyer/Seller data.
- A private profile response is visible only to the authenticated Courier and must not be shared across users or devices.
- Network failure is distinct from validation, forbidden, inactive, and signed-out states.
- Flutter may keep unsaved form text locally during an interruption, but must not queue password changes or authoritative profile writes offline.
- Server revalidation always wins over cached display data.
- Notification or audit delivery failure, if added later, must not roll back a committed profile or password change.

### Flutter states and interaction
- Auth states: checking token, signed out, pending approval, rejected, suspended, invalid affiliation, authenticated, and recoverable network failure.
- Account screen states: loading, success, validation error, forbidden, signed out, and retryable failure.
- Disable save while a request is pending, but allow canceling local edits.
- Announce field errors and save results semantically; do not rely on color alone.
- Use labeled controls, keyboard/screen-reader semantics, adequate touch targets, and a confirmation step before password submission.
- Never log request bodies containing passwords or authorization headers.
- Clear account data and navigation state after logout, token revocation, or a 401.

### Acceptance criteria
- [ ] Guest, invalid-token, wrong-role, inactive, and invalid-affiliation requests cannot read or mutate the account.
- [ ] A Courier can read only the account resolved from its bearer token.
- [ ] Profile updates persist only the four allow-listed fields and preserve all other values.
- [ ] Role, status, email, affiliation, hub, age, and registration evidence cannot be changed through profile update.
- [ ] Invalid fields produce 422 errors without a partial write.
- [ ] Concurrent profile writes are serialized and return the latest committed projection.
- [ ] Password change requires the current password and centralized password validation.
- [ ] A successful password change revokes all Courier personal access tokens and forces fresh login.
- [ ] Passwords, hashes, tokens, paths, and private evidence are absent from every DTO and log.
- [ ] Responses are private and no-store; no personalized account data is shared-cached.
- [ ] Flutter handles loading, success, validation, forbidden, 401, 429, timeout, and offline states.

## HOW
### Backend implementation
- Add Courier AccountController, Form Requests, AccountResource, and AccountService under the existing Courier namespaces.
- Add routes under the protected /api/v1/courier group and reuse courier.active; do not add a browser-cookie route.
- Resolve the User from Request::user(), load exactly one CourierProfile, and never accept a target ID.
- Use a database transaction and row lock for profile changes. Use Laravel Hash checks and the User hashed cast for password changes.
- Revoke tokens only after a successful password write in the same transaction; return no replacement token.
- Add a safe audit/security event only if the shared audit contract is approved. Do not log secrets or raw paths.

### Data and dependencies
- Phase 1 needs no migration: users and courier_profiles already hold the editable data; personal_access_tokens already supports revocation.
- The existing CourierProfile age accessor remains derived from birth_date; age is never stored or client-supplied.
- Vehicle records are read-only or omitted until Logistics/Fleet authority defines update semantics and a current-vehicle rule.
- License, payout, profile-photo, and document changes require separate specifications, fields, authorization, and tests.
- Shipment and Delivery Task schema approval is not a prerequisite for this Phase 1 slice.
- Registration approval remains Logistics-owned; this feature cannot activate or reassign a Courier.

### Flutter handoff
- Implement a Settings/Account screen against only the implemented endpoint versions.
- Store bearer tokens in OS secure storage; never use browser cookies, shared preferences for tokens, or plaintext logs.
- Use Dart models matching the snake_case JSON names shown here, or document an explicit mapping.
- Keep profile edits as local form state until the API returns 200.
- After password success, delete the token, show the signed-out state, and navigate to login.
- Do not show vehicle, license, payout, photo, or shipment edit controls as if they were available.

### Tests and rollout
- Backend tests must cover role/status/affiliation gates, IDOR attempts, prohibited fields, normalization, transaction rollback, concurrent updates, privacy, and token revocation.
- Request tests must cover 401, 403, 422, 429, malformed JSON, duplicate keys, and oversized strings.
- Flutter tests must cover JSON parsing, secure-storage failure, form validation, no-store refresh, 401 logout, 403 messages, timeout, offline recovery, and accessible announcements.
- Add the route, controller, request, resource, service, and tests in one backend change; do not expose the planned endpoint earlier.
- Run focused Laravel tests and Flutter analyzer/tests before marking the implementation complete.
- Update this spec's backend_contract_commit after the API is implemented, then copy the synchronized spec to the Flutter project.
- Append the implementation summary to docs/PROGRESS.md.

### Deferred decisions
- Whether sex or birth_date corrections require Logistics review.
- Whether email changes are ever allowed and require re-verification.
- The authoritative owner and workflow for vehicle type, plate, capacity, and maintenance changes.
- License fields, payout methods, profile-photo metadata, and their verification/retention rules.
- Whether a shared audit ledger is required for ordinary profile edits.
- Any future token lifetime or active-device management policy.

### Source boundaries
- Shared identity, address, vehicle, affiliation, hub, and auth rules come from requirements.md, workspace.md, schema.md, Courier.md, and Logistics.md.
- Courier bearer-token and Flutter boundaries come from courier/auth/spec.md and courier/rules.md.
- File or image upload work must first adopt docs/references/file-upload-requirements.md.
- Historical order-logistics decisions cannot authorize this feature or create operational records.
- This Phase 1 contract is standalone, but its planned endpoints remain unavailable until implemented and tested.
