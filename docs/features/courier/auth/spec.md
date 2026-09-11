---
feature: courier-auth
title: Courier Authentication
system: AISLEY
type: Feature Specification
version: 2.0
status: Implemented foundation; dedicated coverage and recovery completion deferred
implementation_status: foundation implemented; operational work unavailable
canonical: true
role: Courier / Rider
scope: Laravel API consumed by an external Flutter mobile client
backend_contract_commit: d817a10
source_coverage: requirements.md, workspace.md, schema.md, Courier.md, Logistics.md
---

# Courier Authentication

## WHAT

- **Purpose:** Let a Courier select one eligible Logistics organization, submit a pending application, wait for Logistics approval, and obtain mobile API access.
- **Current foundation:** Registration, organization discovery, profile/address/vehicle creation, private evidence persistence, affiliation approval, bearer login, identity, logout, status gating, and a generic password-recovery entry point exist in Laravel.
- **Client boundary:** Courier screens belong to the separate Flutter project. This repository provides API behavior only; do not add a Courier React page, browser-cookie flow, or web dashboard under `src/`.
- **MVP cardinality:** one Courier has one current Logistics affiliation. The selected organization owns exactly one operational hub; the server derives that hub and the client cannot select a sub-hub.
- **Approval authority:** The associated active Logistics organization approves or rejects the Courier affiliation. Admin may suspend, restore, or deactivate an account through the separate lifecycle feature, but Admin does not approve the affiliation.
- **Deferred:** reset-token delivery/completion, email verification, MFA, affiliation history/revocation, session-device policy, and all shipment, pickup, delivery, scan, routing, proof, earnings, and offline endpoints.

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
- Accept `vehicle_type` values `motorcycle`, `car`, or `van`, plus a required `plate_number` (maximum 64). Registration creates one active initial Vehicle.
- Do not add a vehicle fleet, multiple vehicles, map pin, or Courier location contract to Auth without a separate approved feature.

### Flutter registration field map

- Text controls submit the exact snake-case keys shown in the API contract; display labels may use normal human-readable wording.
- `middle_name` is optional and limited to one character; an empty value should be omitted or sent as `null`.
- `birth_date` is a date value, not a client-calculated age; show age only after the server resource returns it.
- `logistics_organization_id` is the selected organization UUID; do not derive or submit a hub ID.
- `address[address_line_1]` is the required street/house detail; `address[address_line_2]` is optional.
- `address[barangay]`, `address[city_municipality]`, `address[province]`, and `address[region]` are PSGC/manual labels.
- `address[postal_code]` is required text, preserving leading zeroes where applicable.
- `vehicle_type` is one of `motorcycle`, `car`, or `van`; `plate_number` is required text.
- `government_id` and `vehicle_registration` are separate multipart file parts, not Base64 JSON fields.
- Do not send `age`, `country`, `role`, `status`, `hub_id`, `reviewer_id`, or a client-generated owner identifier.
- Preserve the selected form values after a recoverable `422`, but clear password values before retrying.

### Evidence and transaction rules

- Current multipart fields are `government_id` and `vehicle_registration`; both are required images. The first field covers the current ID/driver-license requirement; a distinct `drivers_license` field needs an approved contract.
- Apply [`docs/references/file-upload-requirements.md`](../../../references/file-upload-requirements.md): JPEG/JPG, PNG, or WebP only, strictly under 10 MiB, with detected MIME/signature/decode validation.
- Store generated private object keys and document metadata. Never return bytes, raw paths, credentials, or predictable URLs in the Courier resource.
- Create User, CourierProfile, address, pending RegistrationApplication, pending affiliation, Vehicle, and Document rows in one logical transaction.
- Delete any stored evidence objects when persistence fails. Registration never issues a token or activates the account.
- A duplicate same-role email returns `EMAIL_ALREADY_REGISTERED` with a field-addressable `email` error; concurrent duplicate handling must be covered before this contract is called complete.

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
- Flutter stores the token only in OS secure storage and sends `Authorization: Bearer <token>`; it must not log or ordinary-cache tokens.
- `/me` and logout require `auth:sanctum` and `courier.active`. Logout deletes only the current personal access token.
- After active Courier and approved-affiliation checks, protected Courier APIs require current shared Terms of Service and Privacy Policy consent. `/me`, logout, policy status, and policy acceptance remain reachable so Flutter can present the consent flow.

### Stable errors and privacy

- Invalid credentials return `422` with `INVALID_CREDENTIALS`; inactive status returns `403` with `ACCOUNT_PENDING_APPROVAL`, `ACCOUNT_REJECTED`, `ACCOUNT_SUSPENDED`, or `ACCOUNT_INACTIVE`.
- Invalid or missing affiliation returns `403` with `LOGISTICS_ASSOCIATION_INVALID`; wrong role returns `FORBIDDEN_ROLE`.
- Missing current shared policy acceptance returns `403 POLICY_CONSENT_REQUIRED` with required policy/version descriptors and read/status/accept paths; Flutter must not treat it as invalid credentials.
- Validation and file failures return `422`; login throttling returns `429` with `Retry-After`. Unknown organization and cross-organization IDs fail closed.
- Auth DTOs may include Courier ID/email/role/status, profile first/last name/age, affiliation status, organization name, and hub name. They omit secrets, evidence, full address, reviewer notes, token hashes, and storage paths.

### Client lifecycle mapping

- Before a request, show `checking_session`, `submitting`, or `authenticating` without treating a local token as proof of approval.
- A successful registration enters `pending_approval`; the response contains no token and cannot open operational screens.
- `ACCOUNT_PENDING_APPROVAL` maps to a pending screen with a retryable status check, not to a login loop.
- `ACCOUNT_REJECTED` maps to a rejection screen; do not invent resubmission or appeal controls.
- `ACCOUNT_SUSPENDED`, `ACCOUNT_INACTIVE`, and `LOGISTICS_ASSOCIATION_INVALID` clear operational session state and explain that access is blocked.
- A successful login stores the returned token once, then calls `/me` only to restore identity on later launches.
- A `401` clears secure storage and returns to sign-in; a `403` preserves the reason-specific blocked state.
- A timeout or offline error preserves unsent registration form data but never queues login or approval bypass actions.
- A `429` honors `Retry-After`; retries must not submit duplicate registrations or passwords automatically.
- A logout response is terminal for the current token; an already-invalid token may be cleared locally after a confirmed `401`.

### Acceptance criteria

- [x] Registration creates one pending Courier foundation and no credential.
- [x] Age is derived from `birth_date`; client-supplied age is rejected or ignored.
- [x] Organization and sole hub are server-derived; role/status/reviewer/hub injection is prohibited.
- [x] Accepted image types and the strict under-10-MiB boundary are enforced server-side.
- [x] Logistics-only approval/rejection and protected status gating are implemented.
- [x] Bearer login, `/me`, current-token logout, generic recovery response, and DTO redaction exist.
- [x] Dedicated Courier auth tests, stable concurrent duplicate response, reset completion/delivery, and affiliation-history/revocation exist.
- [x] Operational Courier endpoints remain unavailable until the shared Shipment/Delivery Task schema is approved and migrated.

## HOW

### Implemented API contract

The validated backend baseline is commit `d817a10`; the following routes are the current contract.

#### `GET /api/v1/courier/auth/logistics-options` — implemented

- Public endpoint with `throttle:60,1`; optional query `search` is matched case-insensitively against `business_name`; maximum 50 rows.
- `200`: `{ "data": [{ "id": "uuid", "business_name": "Example Logistics" }] }`. No credentials, hub IDs, or private application data are returned.
- Registration must revalidate organization activity and hub existence; a stale option is not an authorization grant. Network failure is retryable; no cache is authoritative.

#### `POST /api/v1/courier/auth/register` — implemented

- Public `multipart/form-data` endpoint with `throttle:10,1`. Send nested keys such as `address[address_line_1]` and the two named image fields.
- Request fields are the registration rules above. Prohibited fields include `role`, `status`, `hub_id`, and `reviewer_id`; extra authority fields must not be forwarded.
- `201`: `{ "message": "Registration submitted for Logistics approval.", "courier": <safe Courier resource> }`; no token is returned.
- `422`: validation, duplicate Courier email, unavailable selected organization, or invalid file. The Flutter app maps `errors` by field and can retry after correction.

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

- Public request `{ "email" }`; current controller records a limiter hit and always returns a generic `200` message.
- No reset token or notification is currently created. Flutter must show a generic result and must not promise an email or fabricate a reset route.

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

- Current tables are `users`, `courier_profiles`, `addresses`, `vehicles`, `registration_applications`, `documents`, `courier_logistics_affiliations`, and Sanctum tokens. Operational shipment tables do not exist.
- Flutter must model nullable `middle_name`, affiliation/rejection states, and missing optional address line; it must not assume a hub ID exists in the Courier DTO.
- Use explicit states: checking session, signed out, registration editing/submitting, pending approval, rejected, active, suspended, deactivated, invalid affiliation, offline, timeout, and retrying.
- Registration upload UI must show accepted formats and the under-10-MiB limit, progress/cancel/retry, and server field errors. Client checks are convenience only.
- Do not reproduce Eloquent, SQL, enum implementation, or authorization logic in Dart. The API response is authoritative and all mutations need online revalidation.
- Add API tests for role/status/affiliation/hub scope, prohibited fields, duplicate races, file spoofing/boundaries, transaction cleanup, token issuance/logout, throttling, DTO privacy, and Logistics organization isolation.
- Add Flutter contract fixtures/tests for JSON parsing, multipart names, secure-storage failure, `401/403/409/422/429`, timeout/offline states, and redacted DTOs. Mocks supplement but do not replace backend verification.
- Before expanding Auth, approve reset delivery, email verification, MFA, resubmission/revocation history, device limits, and any coordinate/pin policy. Update this spec and the copied Flutter contract with the new backend commit/API version.

### Handoff checklist

- The Flutter project copies this spec and records the backend commit or API version used for its fixtures.
- The copied document must retain the exact route, field, status, response, and prohibition wording unless a newer backend contract supersedes it.
- Any unavailable operational route is shown as unavailable in the Flutter project; no mock route is promoted to production behavior.
- Flutter implementation review confirms secure-storage failure, app restart, token expiry, offline, timeout, and retry behavior.
- Backend review confirms that every new Auth mutation remains server-owned, transactional, scoped, and covered by API tests.
- A material contract change increments this spec version, updates the copied Flutter document, and appends `docs/PROGRESS.md`.

**References:** `docs/features/courier/rules.md`, `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Courier.md`, `docs/domains/Logistics.md`, [`user-registration-requirements.md`](../../../references/user-registration-requirements.md), [`file-upload-requirements.md`](../../../references/file-upload-requirements.md), and [Laravel Sanctum token abilities](https://laravel.com/docs/sanctum#token-abilities).
