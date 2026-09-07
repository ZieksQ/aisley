---
feature: courier-auth
title: Courier Authentication
system: AISLEY
type: Feature Specification
version: 1.2
status: Implemented foundation; recovery and delivery operations deferred
role: Courier / Rider
scope: External Flutter/mobile client and Laravel API
source_coverage: Courier.md, requirements.md, workspace.md, schema.md
---

# Courier Authentication

## WHAT

- **Purpose:** Let a Courier register under one Logistics organization, wait for that organization's decision, and obtain secure API access from the external mobile application.
- **Current implementation:** Active-Logistics discovery, multipart registration, one Courier profile/address/vehicle, private registration evidence, pending application and affiliation, Logistics approve/reject endpoints, Sanctum bearer login, `me`, current-token logout, status/affiliation middleware, and a generic forgot-password response are implemented.
- **Mobile-only boundary:** Courier UI is Flutter/mobile-only and external to this repository. `src/` must contain API support only; it must not gain a Courier web dashboard or browser token flow.
- **MVP relationship:** one Courier has one current Logistics affiliation. The selected organization operates exactly one hub/sorting center; its hub is derived server-side and is not a Courier-selected sub-hub.
- **Approval:** The associated active Logistics organization approves or rejects the pending Courier affiliation. Admin account suspension, restoration, and deactivation remain separate lifecycle actions; Admin's registration queue does not approve Couriers.
- **Deferred:** password-reset completion/notification delivery, email verification, MFA, affiliation revocation/history, multi-device policy, and all shipment, pickup, delivery, proof, routing, earnings, and offline operations.

```text
list active Logistics organizations
→ select organization; server derives its sole hub
→ submit pending Courier User/Profile/Application/Affiliation/Vehicle/Evidence
→ Logistics approves or rejects
→ approved affiliation + active account → mobile token login
↘ rejection, suspension, deactivation, or invalid affiliation → API access denied
```

## MUST

### Identity, relationship, and ownership

- Derive `UserRole::Courier` and all ownership from the server. Reject client `role`, `status`, reviewer, approval, hub, affiliation, token-ability, or owner fields.
- Normalize email (trim/lowercase) and enforce uniqueness by `email + role`; a same-email Customer, Seller, Admin, or Logistics account never authenticates as Courier.
- Require exactly one current `CourierLogisticsAffiliation` per Courier in the MVP. The API must verify that the selected organization is active and that its derived hub belongs to that organization.
- Treat `users.status` and `courier_logistics_affiliations.status` as separate facts. Operational access requires an active Courier, an approved affiliation, an active Logistics owner, and a valid sole hub.
- Store enum-like database values as strings and cast them to PHP enums; do not introduce native PostgreSQL enum columns.

### Registration contract

- Validate first/last name, optional one-character middle name, contact number, sex, birth date before today, normalized email, and confirmed password (minimum 8 characters with mixed case and numbers).
- Calculate `age` from the persisted `birth_date` through the shared accessor. Age is display-only and never accepted, persisted, or authorized from client input.
- Accept one `logistics_organization_id` UUID. Resolve it to an active Logistics organization with a hub while ignoring any client hub or sub-hub value; persist the organization's sole `logistics_hub_id` on the affiliation.
- Require address line 1, optional line 2, barangay, city/municipality, province, region, and postal code. Country is server-set to `Philippines`; the current API stores address labels and does not accept coordinates.
- The external client should use the repository's Region → Province → City/Municipality → Barangay PSGC data with a complete manual fallback. PSGC codes, provider IDs, and map coordinates are not persisted by current Courier registration.
- Require one vehicle type (`motorcycle`, `car`, or `van`) and plate number. Registration creates one active initial Vehicle; additional vehicles belong to a later account/fleet feature.
- Current multipart fields map the reference documents to `government_id` (ID/driver's license evidence) and `vehicle_registration` (OR/CR evidence). Both are required images: JPEG/JPG, PNG, or WebP, strictly under 10 MiB, with server MIME/signature/decode validation.
- Apply [`docs/references/file-upload-requirements.md`](../../../references/file-upload-requirements.md): use generated private storage keys and database metadata; never return raw paths, bytes, or private evidence in an auth DTO. PDF support or a distinct `drivers_license` document requires an approved change.
- Create the User, CourierProfile, address, pending RegistrationApplication, pending affiliation, initial Vehicle, and Document rows in one logical transaction. Delete stored evidence objects when persistence fails; registration never authenticates or activates the applicant.

### Logistics approval and account lifecycle

- Public discovery is `GET /api/v1/courier/auth/logistics-options`; return only active organizations, bounded to 50 results, with safe `id` and `business_name` projections. Search is optional and server-side.
- Logistics uses `GET /api/v1/logistics/courier-applications` and `POST /api/v1/logistics/courier-applications/{affiliation}/{decision}`. The decision is `approve` or `reject`; rejection requires a reason, and the affiliation must belong to the authenticated Logistics organization.
- Approval/rejection updates the existing affiliation, Courier account status, and Courier registration application transactionally. The current affiliation stores reviewer, decision time, and rejection reason; append-only decision history and `revoked` actions require a future migration.
- A pending, rejected, suspended, deactivated, wrong-role, or orphaned relationship cannot receive a token or read protected Courier data. Cross-organization IDs must fail closed without disclosing another organization's Courier.
- Admin may use the separate user-account lifecycle feature to suspend, restore, or deactivate a Courier. Those actions do not approve a pending affiliation and must be rechecked on the next request.
- Notification or email delivery is post-commit work. A delivery failure must not roll back a committed Logistics decision; the current foundation does not promise a notification endpoint.

### Mobile token contract

- `POST /api/v1/courier/auth/login` accepts normalized `email`, `password`, and required `device_name`; `role`, `abilities`, and ownership fields are prohibited.
- Verify password, Courier role, active account, approved affiliation, active Logistics owner, and valid hub before `createToken`. Issue only server-owned baseline `courier` ability and return the plain-text token once.
- The Flutter client stores the token only in OS secure storage (Keychain/Keystore/Flutter secure storage) and sends `Authorization: Bearer <token>`. It must not log, ordinary-cache, or return the token from `me`.
- `GET /api/v1/courier/auth/me` and `POST /api/v1/courier/auth/logout` require `auth:sanctum` and `courier.active`. `me` rechecks the relationship; logout deletes only the current personal access token.
- Invalid bearer credentials return `401`; login failures use the generic `INVALID_CREDENTIALS` response (currently `422`); status/relationship denial returns `403`; validation returns `422`; throttling returns `429` with `Retry-After`. No token-refresh endpoint is implied.

### Recovery, privacy, and abuse controls

- The current `POST /api/v1/courier/auth/forgot-password` endpoint returns a generic response and records a rate-limit hit. It does not yet issue a reset token or send a notification.
- Before implementing reset completion, use hashed, expiring, single-use, Courier-role-scoped tokens and revoke personal access tokens after a successful reset. Unknown and cross-role emails must remain indistinguishable.
- Rate-limit options, registration, and login (current login limit: five attempts per throttle key); do not log passwords, bearer tokens, document contents, private paths, or reviewer notes.
- Protected auth DTOs may expose only Courier identity, profile name/age, affiliation status, organization name, and hub name. They must omit private evidence, addresses not needed by the client, credentials, token hashes, and raw storage paths.

### Acceptance criteria

- [x] Active Logistics options, pending multipart registration, one profile/address/vehicle, two private evidence records, and one server-derived pending affiliation are implemented.
- [x] Age, role, status, organization, hub, and document ownership are server-authoritative; invalid file types/sizes and prohibited fields are rejected.
- [x] Logistics-only affiliation approval/rejection, active-account gating, Courier role middleware, bearer login, `me`, and current-token logout are implemented.
- [x] Same-email other-role accounts cannot authenticate as Courier, and auth DTOs omit secrets and raw evidence paths.
- [ ] Stable normalization of concurrent duplicate-registration conflicts, append-only affiliation history/revocation, reset-token delivery/completion, email verification, MFA, and multi-device limits are implemented.
- [ ] Courier operational endpoints remain blocked until the shared Shipment/Delivery Task schema and transition contract are approved and migrated.

## HOW

### Current API and data

- Routes live in `src/api/routes/api.php`; implementation uses `Courier\AuthController`, `Courier` Form Requests, `CourierUserResource`, `EnsureActiveCourier`, `CourierLogisticsAffiliation`, and `Logistics\CourierApprovalController`.
- `2026_08_27_000102_create_courier_profiles_table.php`, `2026_08_27_000110_create_vehicles_table.php`, and `2026_09_05_000002_create_courier_logistics_affiliations_table.php` provide the current foundation. Existing `users`, `addresses`, `registration_applications`, `documents`, and Sanctum token tables are reused; future changes require additive migrations.
- The external Flutter client must copy these versioned endpoint contracts and implement secure token storage, pending/rejected/disabled states, field errors, retry behavior, and no offline bypass. No Courier UI is implemented here.

### Verification and rollout

- Verify registration rollback/evidence cleanup, address and vehicle validation, duplicate races, role isolation, Logistics organization scope, approval transitions, status/affiliation revocation, token abilities, logout, throttling, and DTO privacy on SQLite/PostgreSQL.
- Before adding pickup or delivery actions, reconcile `docs/order-logistics-flow-decisions.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Courier.md`, and the affected Courier/Logistics specs. Keep first-mile and final-mile assignments independent and preserve the sole-hub boundary.
- Approve required document/PDF policy, email/reset delivery, affiliation history/revocation, token expiration/device limits, and the external mobile API version before expanding this feature.

**References:** `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Courier.md`, `docs/domains/Logistics.md`, `docs/references/user-registration-requirements.md`, [`docs/references/file-upload-requirements.md`](../../../references/file-upload-requirements.md), [Laravel Sanctum token abilities](https://laravel.com/docs/sanctum#token-abilities), and [Laravel authentication](https://laravel.com/docs/authentication).
