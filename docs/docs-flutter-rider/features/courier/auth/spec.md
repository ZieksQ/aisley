---
feature: courier-auth
title: Courier Authentication
system: AISLEY
type: Feature Specification
version: 2.6
status: Implemented foundation; auth denial parity covered; recovery completion deferred
implementation_status: Backend Auth v2.6 implemented per supplied snapshot; Flutter foundation adopted against d7df220; newer Auth integration and live acceptance outstanding
canonical: true
role: Courier / Rider
scope: Laravel API consumed by an external Flutter mobile client
backend_contract_commit: d1abeee73d0141e1fd7dda4bea0ee3fead370378
copied_backend_checkout: 4c3f504
source_coverage: requirements.md, workspace.md, schema.md, Courier.md, Logistics.md
---

# Courier Authentication

## WHAT

- **Purpose:** Let a Courier select one eligible Logistics organization, submit a pending application, wait for Logistics approval, and obtain mobile API access.
- **Current foundation:** Registration, organization discovery, profile/address/vehicle creation, private evidence persistence, affiliation approval, bearer login, identity, logout, status gating, and a password-recovery entry point reporting unavailability exist in Laravel.
- **Client boundary:** Courier screens belong to the separate Flutter project. This repository provides API behavior only; do not add a Courier React page, browser-cookie flow, or web dashboard under `src/`.
- **MVP cardinality:** one Courier has one current Logistics affiliation. The selected organization owns exactly one operational hub; the server derives that hub and the client cannot select a sub-hub.
- **Approval authority:** The associated active Logistics organization approves or rejects the Courier affiliation. Admin may suspend, restore, or deactivate an account through the separate lifecycle feature, but Admin does not approve the affiliation.
- **Boundary:** recovery completion, email verification, MFA, affiliation history/revocation, and session-device policy remain deferred. First-mile pickup/routing and final-mile movement, completion, history, and private POD reads exist under their owning specs; Flutter has adopted private photo POD and atomic final-mile batch acceptance locally, while authenticated/device acceptance remains unverified. Signature proof, live location telemetry, earnings, and offline mutations remain deferred.

```text
GET active Logistics options
→ select organization; server derives sole hub
→ multipart registration creates pending Courier records
→ Logistics approves or rejects affiliation
→ active account + approved affiliation → bearer login
↘ pending/rejected/suspended/deactivated/invalid affiliation → 403
```

## MUST

### Identity and relationship rules

- Derive `UserRole::Courier`, `UserStatus`, affiliation status, reviewer, hub, and token ability on the server. Prohibit client authority for these fields.
- Normalize email by trimming and lowercasing it before validation and lookup.
- Enforce the shared `unique(email, role)` rule. A same-email Customer, Seller, Admin, or Logistics account is not a Courier account.
- Require one `CourierLogisticsAffiliation` per Courier in the MVP. Its `logistics_hub_id` must belong to the selected organization and be that organization's sole hub.
- Treat `users.status` and `courier_logistics_affiliations.status` as separate facts. Protected access requires an active Courier, approved affiliation, active Logistics owner, and existing hub.
- Persist enum-like columns as strings and use PHP enum casts; do not add native PostgreSQL enum columns.

### Registration rules

- Accept `first_name`, `last_name`, optional one-character `middle_name`, `contact_number` (maximum 32), `sex`, `birth_date` before today, `email`, and confirmed password.
- Accept `sex` values `male`, `female`, `non_binary`, or `prefer_not_to_say`. Password validation is at least eight characters with mixed case and numbers.
- Accept one `logistics_organization_id` UUID. Re-resolve an active Logistics organization with a hub inside the transaction; ignore any client `hub_id` or sub-hub field.
- Accept nested `address` fields: `address_line_1`, optional `address_line_2`, `barangay`, `city_municipality`, `province`, `region`, and `postal_code` (maximum 10). Set country to `Philippines` server-side.
- Use bundled PSGC Region → Province → City/Municipality → Barangay data and a manual fallback in Flutter. Current Courier registration stores labels/text only; it does not persist PSGC codes, coordinates, or provider IDs.
- Accept `vehicle_type` values `motorcycle`, `car`, `van`, or `truck`, plus a required `plate_number` (maximum 64). MVP requires exactly one personal Vehicle per Courier; registration creates one and the additive Vehicle Fleet migration enforces uniqueness after duplicate preflight. This personal vehicle cannot satisfy a company-truck Linehaul assignment. The imported Flutter log reports all four values in registration and vehicle editing; authenticated live acceptance remains unverified.
- Multiple/shared vehicles, maintenance, vehicle history, and capacity values/units/matching are deferred under the Logistics Vehicle Fleet Management spec. This does not remove existing registration/operational history or add a map-pin contract.

### Flutter registration field map

- Text controls submit the exact snake-case keys shown in the API contract; display labels may use normal human-readable wording.
- `middle_name` is optional and limited to one character; an empty value should be omitted or sent as `null`.
- `birth_date` is the submitted date value. Flutter may display a read-only age derived from the entered birth date; it never submits age or overrides the server-derived resource value.
- `logistics_organization_id` is the selected organization UUID; do not derive or submit a hub ID.
- `address[address_line_1]` is the required street/house detail; `address[address_line_2]` is optional.
- `address[barangay]`, `address[city_municipality]`, `address[province]`, and `address[region]` are PSGC/manual labels.
- `address[postal_code]` is required text, preserving leading zeroes where applicable.
- `vehicle_type` is one of `motorcycle`, `car`, `van`, or `truck`; `plate_number` is required text.
- `government_id` and `vehicle_registration` are separate multipart file parts, not Base64 JSON fields.
- Do not send `age`, `country`, `role`, `status`, `hub_id`, `reviewer_id`, or a client-generated owner identifier.
- Preserve the selected form values after a recoverable `422`, but clear password values before retrying. Reported Flutter registration tests use production light/dark themes at 320/390px and 1×/2× text, with contrast/target/label guidelines, keyboard/error focus, evidence and discard checks; device/screen-reader acceptance remains open.

### Evidence and transaction rules

- Current multipart fields are `government_id` and `vehicle_registration`; both are required images. Planned registration replaces the combined image with required `official_receipt` and `certificate_of_registration`, plus optional make/model, under the registry contract. These inputs are not live; a distinct `drivers_license` field remains separate work.
- After initial approval, implemented Courier vehicle endpoints permit type/plate/make/model edits and independent OR/CR replacement without reapproval, notifying associated Logistics after commit. Preserve initial approval evidence; keep the combined registration field until a coordinated Flutter registration rollout switches to separate fields, and reject mixed legacy/new forms.
- Apply [`docs/references/file-upload-requirements.md`](../../../references/file-upload-requirements.md): JPEG/JPG, PNG, or WebP only, strictly under 10 MiB, with detected MIME/signature/decode validation.
- Store generated private object keys and document metadata. Never return bytes, raw paths, credentials, or predictable URLs in the Courier resource.
- Create User, CourierProfile, address, pending RegistrationApplication, pending affiliation, Vehicle, and Document rows in one logical transaction.
- Delete any stored evidence objects when persistence fails. Registration never issues a token or activates the account.
- A duplicate same-role email returns HTTP `422` with exactly `{ "code": "EMAIL_ALREADY_REGISTERED", "message": "A Courier account with this email already exists.", "errors": { "email": ["A Courier account with this email already exists."] } }`. This applies both to an existing Courier found by the precheck and to a concurrent users `(email, role)` uniqueness violation. The losing transaction rolls back before error translation and cleans up any stored evidence; unrelated uniqueness, database, or storage failures are not translated into duplicate-email errors.

### Logistics approval and lifecycle

- Logistics lists only pending affiliations belonging to its authenticated organization and decides `approve` or `reject` for one affiliation.
- Rejection requires a safe reason of at most 2,000 characters. Approval clears a rejection reason; both decisions record reviewer and time on the application and affiliation.
- Approval atomically changes the Courier User/Application and affiliation to active/approved; rejection changes them to rejected. A second decision on a non-pending affiliation returns a conflict.
- A pending, rejected, revoked, suspended, deactivated, wrong-role, orphaned, or inactive-Logistics relationship cannot issue a token or read protected Courier data.
- Notification delivery is post-commit and is not a current Courier API guarantee. A provider failure cannot reverse an approval or rejection.

### Token and protected-session rules

- Login requires `email`, `password`, and `device_name`; `role` and `abilities` are prohibited.
- Verify password, Courier role, active account, approved affiliation, active Logistics owner, and valid hub before creating a token.
- Issue only the server-owned `courier` ability and return the plain-text token once. `/me` never returns the token.
- Flutter sends `Authorization: Bearer <token>` and stores the token through its approved secure-storage package: OS secure storage on Android, with reviewed browser storage limited to localhost `web-server` testing. Never use plaintext token storage, browser cookies, or token logging.
- `/me` and logout require `auth:sanctum` and `courier.active`. Logout deletes only the current personal access token.
- After active Courier and approved-affiliation checks, protected Courier APIs require current shared Terms of Service and Privacy Policy consent. `/me`, logout, policy status, and policy acceptance remain reachable so Flutter can present the consent flow.

### Stable errors and privacy

- Login validates Courier credentials before access checks. Unknown email, wrong password, or another role's credentials return `422 INVALID_CREDENTIALS` with `The email or password is incorrect.`; no account or affiliation state is disclosed and no token is issued.
- After valid credentials at login, and after bearer authentication and Courier-role checks on protected requests, check account status before affiliation. Login and protected requests use the same `403` payload for each inactive account status, even when its affiliation is also invalid:

  | Account status | Error code | Message |
  | --- | --- | --- |
  | `pending` | `ACCOUNT_PENDING_APPROVAL` | `This Courier account is not active.` |
  | `rejected` | `ACCOUNT_REJECTED` | `This Courier account is not active.` |
  | `suspended` | `ACCOUNT_SUSPENDED` | `This Courier account is not active.` |
  | `deactivated` | `ACCOUNT_INACTIVE` | `This Courier account is not active.` |

- For an active Courier, a missing, pending, rejected, or revoked affiliation, inactive/missing Logistics owner, or missing hub returns `403 LOGISTICS_ASSOCIATION_INVALID` with `This Courier is not approved by an active Logistics organization.` at both login and protected requests. A rejected affiliation does not by itself mean the account is rejected. Denied login issues no token.
- A bearer-authenticated wrong role returns `403 FORBIDDEN_ROLE` with `This area is restricted to couriers.` before Courier access checks; guests or invalid tokens return `401`.
- Missing current shared policy acceptance returns `403 POLICY_CONSENT_REQUIRED` with required policy/version descriptors and read/status/accept paths; Flutter must not treat it as invalid credentials.
- Validation and file failures return `422`; login throttling returns `429` with `Retry-After`. Unknown organization and cross-organization IDs fail closed.
- Auth DTOs may include Courier ID/email/role/status, profile first/last name/age, affiliation status, organization name, and hub name. They omit secrets, evidence, full address, reviewer notes, token hashes, and storage paths.

### Client lifecycle mapping

- Before a request, show `checking_session`, `submitting`, or `authenticating` without treating a local token as proof of approval.
- A successful registration enters `pending_approval`; the response contains no token and cannot open operational screens.
- `ACCOUNT_PENDING_APPROVAL` maps to a local informational pending screen. No pending-status endpoint or token is issued; the Courier may retry login after Logistics approval.
- `ACCOUNT_REJECTED` maps to a rejection screen; do not invent resubmission or appeal controls.
- `ACCOUNT_SUSPENDED`, `ACCOUNT_INACTIVE`, and `LOGISTICS_ASSOCIATION_INVALID` clear operational session state and explain that access is blocked.
- A successful login stores the returned token once, then calls `/me` only to restore identity on later launches.
- The development-only Courier mockup mirrors the Flutter consent lifecycle after login: it checks `/api/v1/policy-consent/status`, fetches the current public Terms/Privacy documents, displays only policies whose current version still requires acceptance, posts explicit acceptance for each exact version, and loads protected Courier data only after the status response confirms completion. A valid bearer token is preserved while consent is pending.
- A `401` clears secure storage and returns to sign-in; a `403` preserves the reason-specific blocked state.
- A timeout or offline error preserves unsent registration form data but never queues login or approval bypass actions.
- A `429` honors `Retry-After`; retries must not submit duplicate registrations or passwords automatically.
- A logout response is terminal for the current token; an already-invalid token may be cleared locally after a confirmed `401`.

### Acceptance criteria

Backend completion and verification below reflect recorded Laravel results through `4c3f504`; this documentation sync did not rerun those tests. Flutter coverage is reported by the imported client project.

- [x] Registration creates one pending Courier foundation and no credential.
- [x] Additive uniqueness and approval completeness checks fail closed on ambiguous vehicle cardinality; legacy Logistics review continues to use the combined OR/CR registration evidence until separate registration fields are rolled out.
- [x] Age is derived from `birth_date`; client-supplied age is rejected or ignored.
- [x] Organization and sole hub are server-derived; role/status/reviewer/hub injection is prohibited.
- [x] Accepted image types and the strict under-10-MiB boundary are enforced server-side.
- [x] Logistics-only approval/rejection and protected status gating are implemented.
- [x] Bearer login, `/me`, current-token logout, and DTO redaction exist.
- [x] The recovery entry point returns the same explicit unavailability response for every valid email; it creates no reset/access token, sends no mail or notification, and leaves passwords unchanged. Email validation, normalization, and the existing limiter hit are preserved.
- [x] Login and bearer-authenticated `/me` share account-status mapping and precedence, affiliation denials, and messages; denied login creates no token. Focused SQLite tests also cover scoped issuance, current-token logout, credentials, wrong role, guests, throttling, prohibited scope fields, and consent boundaries; external Flutter integration remains unverified.
- [ ] Complete password-recovery delivery and reset; the implemented entry point does not provide recovery.
- [ ] Implement affiliation history and revocation workflows.
- [x] Concurrent duplicate registration is verified with synchronized PostgreSQL endpoint workers after both negative prechecks, for the same and different Logistics organizations: one `201`, one exact duplicate `422`, one complete pending registration, two evidence files, no access token, and only the winning application notification. Deterministic SQLite collision and unrelated-failure cleanup tests also pass; external Flutter integration remains unverified.
- [x] First- and final-mile API availability is owned by the task/pickup/delivery specs, not blocked by obsolete Auth claims that the operational schema is absent.

## HOW

### Implemented API contract

The supplied snapshot identifies the foundation baseline as commit `d1abeee73d0141e1fd7dda4bea0ee3fead370378`; contract version `2.6` supersedes its account/affiliation denial mapping, recovery availability messaging, and concurrent duplicate-registration handling. Its reported focused SQLite regressions and disposable PostgreSQL registration-race verification do not certify external Flutter integration or unrelated PostgreSQL release gates.

#### `GET /api/v1/courier/auth/logistics-options` — implemented

- The upstream development-only Courier mockup uses this list with the legacy combined `vehicle_registration` field; it does not authorize a production Courier web UI. Public endpoint with `throttle:60,1`; optional query `search` is matched case-insensitively against `business_name`; maximum 50 rows.
- `200`: `{ "data": [{ "id": "uuid", "business_name": "Example Logistics" }] }`. No credentials, hub IDs, or private application data are returned.
- Registration must revalidate organization activity and hub existence; a stale option is not an authorization grant. Network failure is retryable; no cache is authoritative.

#### `POST /api/v1/courier/auth/register` — implemented

- Public `multipart/form-data` endpoint with `throttle:10,1`. Send nested keys such as `address[address_line_1]` and the two named image fields.
- Request fields are the registration rules above. Prohibited fields include `role`, `status`, `hub_id`, and `reviewer_id`; extra authority fields must not be forwarded.
- `201`: `{ "message": "Registration submitted for Logistics approval.", "courier": <safe Courier resource> }`; no token is returned.
- `422`: validation, duplicate Courier email (including concurrent submissions), unavailable selected organization, or invalid file. The exact duplicate response is defined above and has a field-addressable `errors.email` array. The Flutter app maps `errors` by field and can retry after correction.

#### `POST /api/v1/courier/auth/login` — implemented

- Public endpoint with an internal five-attempt throttle key based on normalized email and IP. Request: `{ "email", "password", "device_name" }`.
- `200`: `{ "token": "plain-text-once", "courier": <safe Courier resource> }`.
- `422 INVALID_CREDENTIALS` covers unknown/wrong credentials; `403` covers account or affiliation denial; `429` includes `Retry-After`.

#### `GET /api/v1/courier/auth/me` — implemented

- Requires `auth:sanctum` and `courier.active`; no request body. `200`: `{ "courier": <safe Courier resource> }`.
- Middleware rechecks role, status, affiliation, active organization, and hub. Flutter treats `401` as signed out and `403` as a state-specific access screen.

#### `POST /api/v1/courier/auth/logout` — implemented

- Requires the same middleware; empty request body. `200`: `{ "message": "Signed out successfully." }`.
- The server deletes only the current token. Flutter removes its secure token after a successful response or after a confirmed unauthorized response.

#### `POST /api/v1/courier/auth/forgot-password` — recovery entry point only

- The upstream development-only mockup may exercise this entry point but must present unavailability without promising a reset email. Public request `{ "email" }`; email is required, trimmed, lowercased, validated as an email, and limited to 255 characters. Missing or malformed emails return `422` validation errors.
- Every valid email receives HTTP `200` with exactly `{ "message": "Courier password recovery is not available yet." }`, whether it belongs to a Courier, another role, or no account. The controller preserves the existing normalized-email/IP limiter hit with a 60-second decay.
- No reset token or access token is created, no mail or notification is sent, and passwords remain unchanged. Recovery delivery/reset remains deferred. Flutter must show the unavailability message and must not promise an email or fabricate a reset route.

#### Logistics-owned approval routes — implemented, not Courier actions

- `GET /api/v1/logistics/courier-applications` requires `auth:sanctum` + `logistics.active`; it returns pending affiliation IDs and safe Courier name/email rows for that organization.
- `POST /api/v1/logistics/courier-applications/{affiliation}/{decision}` accepts `approve` or `reject`; reject requires `reason` (maximum 2,000). Cross-organization IDs return not-found and non-pending decisions conflict.
- These routes are documented for workflow coordination. The Flutter Courier app must never call them or display Logistics reviewer controls.

### Resource shapes for Dart models

- The registration, login, and `/me` `courier` object has `id`, `email`, `role`, `status`, `profile`, and `logistics` keys.
- `profile` is present when the backend eager-loads it and contains `first_name`, `last_name`, and computed `age`; treat absent nested data as nullable.
- `logistics` is present when the affiliation is loaded and contains `status`, `organization`, and `hub` names; the current resource does not expose organization or hub IDs.
- `role` is the string `courier`; do not infer role from the endpoint path or a local enum alone.
- `status` uses lowercase values such as `pending`, `active`, `rejected`, `suspended`, or `deactivated`.
- Affiliation `status` is separate from account `status`; both must be retained in the client model.
- The options response has a top-level `data` array and each item has only `id` and `business_name`.
- Error responses may contain `code`, `message`, and an optional `errors` object keyed by request field.
- Unknown response fields may be ignored for forward compatibility, but missing required fields are a contract error worth logging safely.
- Do not persist reviewer IDs, evidence metadata, raw paths, password-reset tokens, or API bearer tokens in ordinary app state.

### Data, Flutter handoff, and testing

- Flutter has no forgot-password flow. Auth v2.6 denial/duplicate-response integration and recovery-unavailable presentation remain outstanding; existing client tests do not establish adoption.
- Auth uses `users`, `courier_profiles`, `addresses`, `vehicles`, `registration_applications`, `documents`, `courier_logistics_affiliations`, and Sanctum tokens. The additive fulfillment migration also defines operational records; apply it before consuming final-mile APIs.
- Flutter must model nullable `middle_name`, affiliation/rejection states, and missing optional address line; it must not assume a hub ID exists in the Courier DTO.
- Use explicit states: checking session, signed out, registration editing/submitting, pending approval, rejected, active, suspended, deactivated, invalid affiliation, offline, timeout, and retrying.
- Registration upload UI must show accepted formats and the under-10-MiB limit, progress/cancel/retry, and server field errors. Client checks are convenience only.
- Flutter protects unsaved registration text, selections, and evidence on Back, Sign in, and Android system Back; untouched, reverted, and successfully submitted forms leave without a discard prompt, and in-flight submission retains its explicit cancel action.
- Registration uses independent password visibility controls, logical Next/Done and keyboard traversal, and ordered scroll/focus for local/server field errors, including PSGC selectors and evidence controls. Passwords clear after server attempts and upload cancellation; browser/device acceptance remains separate.
- Flutter registration must retain both selected `XFile` contents until multipart submission on local web-server; browser paths cannot be passed to `MultipartFile.fromPath`. Keep Android's native upload behavior and the exact `government_id`/`vehicle_registration` parts; follow `docs/flutter-file-uploads.md` and verify both targets before claiming web upload support.
- Do not reproduce Eloquent, SQL, enum implementation, or authorization logic in Dart. The API response is authoritative and all mutations need online revalidation.
- Add API tests for role/status/affiliation/hub scope, prohibited fields, duplicate races, file spoofing/boundaries, transaction cleanup, token issuance/logout, throttling, DTO privacy, and Logistics organization isolation.
- Add Flutter contract fixtures/tests for JSON parsing, multipart names, secure-storage failure, `401/403/409/422/429`, timeout/offline states, and redacted DTOs. Mocks supplement but do not replace backend verification.
- Before expanding Auth, approve reset delivery, email verification, MFA, resubmission/revocation history, device limits, and any coordinate/pin policy. Update this spec and the copied Flutter contract with the new backend commit/API version.

### Handoff checklist

- Keep exact route/field/status/response/prohibition wording, version fixtures against the adopted baseline, and record material version changes in `docs/PROGRESS.md`. Unavailable routes remain unavailable; no mock route is promoted to production behavior.
- Flutter implementation review confirms secure-storage failure, app restart, token expiry, offline, timeout, and retry behavior.
- Backend review confirms that every new Auth mutation remains server-owned, transactional, scoped, and covered by API tests.

**References:** `docs/features/courier/rules.md`, `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domain/Courier.md`, `docs/domain/Logistics.md`, [`user-registration-requirements.md`](../../../references/user-registration-requirements.md), [`file-upload-requirements.md`](../../../references/file-upload-requirements.md), and [Laravel Sanctum token abilities](https://laravel.com/docs/sanctum#token-abilities).
