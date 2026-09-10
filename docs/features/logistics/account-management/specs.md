---
feature: logistics-account-management
title: Logistics Account Management
system: AISLEY
type: Feature Specification
version: 1.3
status: Implemented (Phase 1) — protected self-service profile, organization, hub-label, and password settings; business-logo extension specified (not implemented)
role: Logistics
scope: Logistics React SPA and Laravel API
source_coverage: docs/requirements.md, docs/workspace.md, docs/schema.md, docs/domains/Logistics.md, docs/references/file-upload-requirements.md
---

# Logistics Account Management

## WHAT

- **Purpose:** Let an approved active Logistics account view and maintain its own personal profile and the operational identity of its organization and sole hub.
- **Current implementation:** Logistics registration, Admin approval, web Sanctum login/session, `/auth/me`, logout, password recovery, dashboard scaffold, pickup views, the protected account API, and the Account Settings page exist. The account API returns a safe private projection and supports allow-listed profile, organization, sole-hub-label, and password changes. Organization-logo storage, delivery, and UI are not implemented yet.
- **Canonical identity:** `users.role = logistics`; the authenticated `user_id` resolves exactly one `LogisticsProfile`, one `LogisticsOrganization`, and one `LogisticsHub`.
- **MVP cardinality:** one Logistics account → one organization → exactly one operational hub/sorting center. Account Management cannot create, select, rename into, or move to a second hub or sub-hub.
- The registration field **Operational hub/sorting-center address** represents the sole hub address. Any relocation or coordinate change is an operational change, not an ordinary personal-profile edit.
- This is a self-service settings feature. It does not grant operational authority beyond the authenticated organization or replace Admin registration approval.
- **Non-goals:** registration/evidence review, subscription billing or gating, Courier approval, fleet, zones, waybills, orders, parcel/status changes, dispatch, chat, reports, MFA, or a Courier mobile/web UI.

```text
active Logistics session
→ GET current account projection
→ edit an allow-listed personal or organization field
→ server validates and locks the owning rows
→ commit the update (or return 409/422)
→ refresh the projection; sensitive notifications run after commit
```

## MUST

### Access, ownership, and tenant scope

- Require `auth:sanctum` and `logistics.active` for every account endpoint. Resolve `user → logisticsProfile → logisticsOrganization → sole hub` server-side.
- Never accept `user_id`, organization ID, hub ID, email, role, status, approval, subscription, or owner fields as the authority for a write.
- A same-email Customer, Seller, Admin, or Courier is a different role record and cannot read or mutate Logistics settings. Cross-organization identifiers return ownership-safe `404`/`403`.
- Return `401` for no session, `403` for wrong role/inactive account, `404` for a missing or foreign relationship, `409` for a stale concurrent update, and `422` for invalid or forbidden fields.
- Account Management must fail closed when the active account lacks its required organization or sole hub. It must not create missing relationships as a side effect of a read.

### Editable data and immutability

- Use explicit allowlists and separate personal, organization, and hub forms. The current schema supports personal `first_name`, `middle_name`, `last_name`, `contact_number`, `sex`, and `birth_date`; organization `business_name`; and hub display `name` plus its linked Address.
- Ordinary profile updates may change only the personal fields that the product policy approves. Role, account status, approval/application state, password hash, reviewer fields, and relationships are never editable here.
- Organization `business_name` and hub display name are organization-owned values. A change must be authorized for this account and must not affect another organization or Courier affiliation.
- Do not allow an address edit, hub reassignment, second address, or second hub in the initial account feature. If relocation is later approved, use an additive, reviewable address/version workflow and retain the old operational snapshot; never overwrite a committed pickup/waybill address.
- Coordinates are optional and not part of the current registration schema. If exact hub pinning is later approved, reuse the Customer Address Book's PSGC/manual/Geoapify/Leaflet contract; Mapbox is not used.
- Email change, phone verification, personal profile-photo upload, staff accounts, and organization-level permission delegation remain separate decisions. The organization business-logo extension below is specified but not implemented; do not expose it as an available control until its API and migration exist.

### Organization business logo (specified extension; not yet implemented)

- This upload represents the Logistics organization's business identity, not the authenticated person's profile photo. Store it on `LogisticsOrganization`; do not add `profile_photo_*` fields to `LogisticsProfile` for this purpose.
- Planned endpoints are `POST /api/v1/logistics/account/organization/logo` (multipart upload with field `logo`), `GET /api/v1/logistics/account/organization/logo` (authorized image delivery), and `DELETE /api/v1/logistics/account/organization/logo`. Until implemented, these routes are unavailable and must not be called by the SPA.
- Derive the organization from the authenticated active Logistics user → profile → organization chain. Ignore or reject client-supplied user, organization, owner, disk, or path values; a Logistics account cannot upload to another organization's logo.
- The upload inherits `docs/references/file-upload-requirements.md`: enforce a strict size below 10 MiB (`10,485,760` bytes), allow only JPEG/JPG, PNG, and WebP, and validate detected MIME, file signature, extension, and successful image decoding server-side. Reject spoofed, corrupt, double-extension, and unsupported files.
- Use the configured Laravel filesystem/object storage (Azure Blob when configured). Generate a server-owned UUID object key such as `logistics-organization-logos/{organization UUID}/{asset UUID}.{extension}`; never use the original filename as the storage path.
- An additive migration may add nullable `logo_disk`, `logo_path`, `logo_mime`, `logo_size`, `logo_width`, and `logo_height` metadata to `logistics_organizations`. Store no credentials, absolute paths, browser blobs, data URIs, or expiring URLs in the database.
- Replace atomically from the caller's perspective: validate and store the new object, update the organization metadata in a transaction, delete the old object only after commit, and clean up the new object if persistence fails. Deletion is idempotent; failed old-object cleanup is observable and retryable without restoring stale metadata.
- By default, logo delivery is organization-owner/admin-authorized and private, with `no-store` and `nosniff` headers. Any Seller/Customer logistics-provider card or public URL requires a separately approved visibility and DTO contract; never return a raw storage path.
- Return `401` for no session, `403` for wrong role/inactive or foreign ownership, `404` when no logo exists, `422` for file validation failures, and `429` for upload throttling. A successful mutation returns the safe account projection or logo capability, never a storage path.
- The Organization section of Account Settings should show an empty state, selected-logo preview, upload progress, remove confirmation, validation errors, retry state, and unauthorized/network failures. It must not claim success until storage and metadata persistence complete.

### Password and authentication boundary

- The implemented `PUT /api/v1/logistics/account/password` requires the current password, confirmation, and the shared password policy; it never accepts or returns a password hash.
- Password changes are separate from profile/organization updates. Apply rate limiting and preserve the configured session/token revocation policy atomically.
- Existing `/auth/forgot-password` and `/auth/reset-password` remain owned by Logistics Authentication. Account Management does not approve, activate, reject, or reset another role.
- Email verification, MFA, recent-authentication challenges, and concurrent-session management require separate approved contracts; do not infer them from the settings screen.

### Approval, subscription, and operational boundaries

- Admin remains the authority for Logistics registration approval/rejection and account lifecycle changes. Account Management cannot self-approve, clear rejection, change `users.status`, or edit registration evidence.
- Subscription is not an MVP gate. Profile changes must not activate, cancel, charge, or alter subscription entitlements; billing/provider records are deferred.
- Updating an organization or hub label must not mutate Orders, Inventory, waybills, pickup schedules, Couriers, affiliations, routes, or operational statuses.
- Operational DTOs and logs omit passwords, tokens, private evidence, payment secrets, raw storage paths, unrelated-user data, and unnecessary full addresses.

### Consistency, errors, and notifications

- Use PATCH semantics for partial profile/organization changes, validate every submitted key, and reject forbidden keys rather than silently mass-assigning them.
- Lock the authenticated profile/organization/hub rows, re-read current values, and commit all related changes in one transaction. A failed write leaves the prior projection intact.
- Use an expected revision or server version when the supporting migration is approved. Until then, row locking plus current-value comparison must prevent stale overwrites.
- Replayed updates may safely return the latest projection but must not duplicate account events or notifications. If idempotency storage is added, scope it to the Logistics user and request hash.
- Send security/account-change notifications only after commit. Provider failure cannot roll back a successful profile change; retry/observability is separate.

### Logistics SPA experience

- Use the existing protected Account Settings route, Sanctum credentialed requests, and shared `@aisley/ui` components. Add the business-logo controls only after the logo API contract exists; do not add a Courier web page.
- Separate **Personal profile**, **Organization**, **Operational hub**, and **Security** sections. Clearly label the hub as the sole operational hub/sorting center, not a personal residence.
- Show loading, saved, validation, conflict, unauthorized, missing-hub, network, and retry states. Do not optimistically claim a save before the server projection returns.
- Use semantic labels, keyboard-accessible controls, visible focus, field-level errors, responsive dark-mode dashboard styling, and non-color-only status/error cues.
- Account Settings is linked from the protected Logistics navigation. Existing authentication and `/auth/me` behavior remains unchanged; the settings page refreshes the shell projection after a successful organization update.

### Acceptance criteria

- [x] The implemented auth resource exposes the authenticated Logistics profile, organization, and sole-hub identity without credentials or private evidence.
- [x] Admin approval and `logistics.active` gate protected Logistics access; subscription status does not gate the MVP.
- [x] The foundation enforces one organization per Logistics account and one hub per organization.
- [x] An authenticated Logistics account can read only its own safe account projection through `GET /api/v1/logistics/account`.
- [x] Allow-listed personal and organization fields can be updated transactionally; forbidden role/status/approval/subscription fields are rejected.
- [x] Hub address relocation is blocked until a separately approved reviewable versioning workflow exists; no second hub/address can be created.
- [x] Password change is rate-limited, current-password protected, and follows the configured session/token policy.
- [x] Concurrent/retried writes preserve the latest committed projection without duplicate events or notifications.
- [x] The Logistics Account Settings UI handles loading, validation, conflict, retry, unauthorized, and success states accessibly.
- [ ] The organization can upload, replace, retrieve, and remove only its own valid business logo through the approved logo endpoints.
- [ ] Logo validation enforces the shared under-10-MiB JPEG/JPG/PNG/WebP policy, persists only approved metadata, and never exposes a raw storage path.
- [ ] Replacement/removal cleanup is transaction-safe and idempotent; storage failures cannot roll back a committed metadata decision or resurrect an old logo.
- [ ] Private logo delivery is authorized and no-store by default; any buyer/seller-visible delivery has a separate approved visibility contract.
- [ ] The Logistics SPA exposes accessible organization-logo empty, preview, progress, validation, retry, removal, and unauthorized states only after backend support exists.

## HOW

### Current code and interfaces

- Existing routes are `POST /api/v1/logistics/auth/register`, `/login`, `/forgot-password`, `/reset-password`, protected `GET /api/v1/logistics/auth/me`/`POST /logout`, `GET /api/v1/logistics/dashboard`, pickup/Courier-approval routes, and the account routes below.
- Existing implementation uses `Logistics\\AuthController`, `LogisticsUserResource`, `LogisticsProfile`, `LogisticsOrganization`, `LogisticsHub`, `EnsureActiveLogistics`, and `2026_09_05_000001_create_logistics_foundation_tables.php`.
- Implemented routes are `GET /api/v1/logistics/account`, `PATCH /api/v1/logistics/account/profile`, `PATCH /api/v1/logistics/account/organization`, and throttled `PUT /api/v1/logistics/account/password`. The organization payload may update `business_name` and the sole hub's display `hub_name`; it cannot change the linked address or hub relationship.
- Responses should return a private/no-store JSON projection with safe personal fields, organization name, sole-hub name, approved address summary, and (once implemented) a safe logo capability URL or asset identifier. Never return raw database/storage paths or client-controlled ownership fields.

### Implementation and data flow

- Authenticate active Logistics user → load exact profile/organization/sole hub → validate allow-listed payload → lock rows → write the transaction → return the fresh projection. Account mutations are application-logged with request context; no notification provider is attached to this Phase 1 settings flow.
- Reuse the existing models and `HasBirthDateAge` accessor. Age is derived from persisted `birth_date`; never accept or persist a client-supplied age.
- Add only additive migrations for approved revision/history/idempotency data. Keep enum-like columns string-backed with PHP enum casts and never edit executed migrations.
- Do not add a new address provider, subscription table, hub table, staff role, or operational Shipment/Delivery Task record for this feature.
- The planned logo extension requires an additive organization-metadata migration and the shared upload/storage service; it does not create a personal profile photo or a public media catalog.

### Verification and open decisions

- API tests cover role/status gates, missing relationships, field allowlists, organization/hub cardinality, successive writes, password validation/throttling, safe DTOs, and no-store headers. SPA type, lint, and production-build checks pass for the protected Account Settings route.
- Future regression coverage should add a true revision/conflict contract, notification failure behavior, and browser-level keyboard/responsive assertions when those supporting contracts are approved.
- Regression coverage must prove that foreign organization/hub identifiers never leak data and that failed transactions preserve the prior profile projection.
- Run focused Logistics API tests and SPA type/lint/build checks before marking any acceptance item implemented.
- Open decisions: exact editable personal fields; whether business-name/hub-label changes need Admin review; relocation/address versioning; email/phone verification; password session revocation; security history; future staff permissions; and whether a separately approved provider directory may display the organization logo.
- Before implementing hub relocation, Courier-impacting changes, or operational status actions, revise the owning Logistics/waybill/pickup specifications and schema together.

**References:** `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Logistics.md`, `docs/features/logistics/auth/spec.md`, `docs/features/logistics/dashboard/specs.md`, `docs/references/user-registration-requirements.md`, `docs/references/file-upload-requirements.md`, and `docs/design.md`.
