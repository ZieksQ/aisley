---
feature: logistics-auth
title: Logistics Authentication
system: AISLEY
type: Feature Specification
version: 1.3
status: Implemented auth foundation; hub-pin capture specified but not implemented
role: Logistics
scope: Logistics React SPA and Laravel API
---

# Logistics Authentication

## WHAT

- **Purpose:** Register one Logistics organization/operator, submit it for Admin review, and provide secure access to the Logistics dashboard after approval.
- **Current implementation:** Multipart registration, private government-ID/business-permit evidence, one Logistics profile, one organization, one operational hub, Admin review integration, Sanctum web-session login, `/me`, logout, password recovery, status gating, and the `src/logistics` SPA are implemented.
- **Canonical identity:** `users.role = logistics`; a same-email Customer, Seller, Admin, or Courier is a separate account and never inherits Logistics access.
- **MVP cardinality:** one Logistics account → one organization → exactly one operational hub/sorting center. The registration field is labelled **Operational hub/sorting-center address**; no sub-hub, second hub, hub selector, or staff account exists.
- **Approval:** Admin approves/rejects the Logistics registration. Logistics, not Admin, approves or rejects Courier affiliations after the Courier selects this organization; that is a separate feature.
- **Subscription:** Billing, plans, provider integration, the per-order charge, subscription records, and enforcement are deferred and do not gate the current approved active account.
- **Non-goals:** parcel/Shipment/Waybill/Scan/Delivery Task operations, sorting/dispatch, Courier UI, fleet/zone/capacity features, sub-accounts, MFA, social login, or mobile Logistics tokens.

```text
multipart register
→ pending User/Profile/Application/Organization/Sole Hub/Evidence
→ Admin approves or rejects
→ active Logistics account → web login/session → /dashboard
↘ rejection/suspension/deactivation → protected access denied
```

## MUST

### Identity, ownership, and cardinality

- Derive `UserRole::Logistics` and all ownership from the server. Prohibit client role, status, reviewer, approval, organization, hub, subscription, or owner IDs.
- Normalize email (trim/lowercase) and enforce Customer/Seller/Admin/Courier-isolated uniqueness for the Logistics role. Unknown and other-role-only credentials use the same generic login failure.
- Keep the one-account/one-organization/one-hub invariant. `logistics_organizations.user_id` and `logistics_hubs.logistics_organization_id` are unique; no request may create or select a second hub or a sub-hub.
- Resolve the organization and hub through the authenticated account. Do not authorize by email, business name, address text, or a browser-provided hub ID.
- Store enum-like database values as strings and cast them to PHP enums; do not introduce native PostgreSQL enum columns.

### Registration and hub address

- Validate first/last name, optional one-character middle name, contact number, sex, birth date, business name, email, and the project password/confirmation rules.
- Calculate age from the persisted birth date through the shared age accessor. The Logistics UI may display a calculated age, but age is not client input or a persisted authority.
- Require the **Operational hub/sorting-center address** fields: address line 1, optional line 2, barangay, city/municipality, province, region, and postal code. Country is server-set to `Philippines`; registration currently does not accept coordinates.
- Use bundled `@aisley/psgc-address-data` Region → Province → City/Municipality → Barangay controls in the SPA, with manual text fallback. PSGC codes/provider IDs are lookup-only and are not persisted.
- Planned hub pin: after completing PSGC/manual address fields, choose **Pin hub location**, geocode intentionally with Geoapify, then click/drag the Leaflet pin and explicitly confirm the actual hub entrance/location. No Mapbox or geocoding while typing.
- Extend multipart registration with optional `latitude` and `longitude`; require both finite numeric values together, latitude -90..90 and longitude -180..180. Persist the user-confirmed pair on the sole hub's linked Address, not a personal address or second hub.
- Text changes invalidate the draft coordinate pair and require pin confirmation again. Geocoding suggestions and device GPS are aids, not proof of a hub's location; GPS requires permission and explicit confirmation.
- If geocoding/map services fail, preserve entered fields and permit manual registration without a pin; show **Hub location not pinned** and offer completion in Account Settings. Do not substitute `0,0`, seed coordinates, or a barangay centroid as a confirmed exact pin.
- These fields and controls are a planned extension, not an existing API guarantee. Registration and account access gain no new coordinate-based gate.
- Persist User, LogisticsProfile, pending RegistrationApplication, one default hub Address, one LogisticsOrganization, and one LogisticsHub in a logical transaction. A failed database write removes any stored evidence objects.

### Evidence and Admin approval

- `government_id` and `business_permit` are required registration evidence in the current form. The API accepts image evidence only: JPEG/JPG, PNG, or WebP, strictly under 10 MiB, with server MIME/signature/image validation and generated private storage keys.
- Apply [`docs/references/file-upload-requirements.md`](../../../references/file-upload-requirements.md). Store metadata in `documents`; never return raw disk/blob paths, credentials, or private evidence in a Logistics DTO.
- Attach both documents to the pending RegistrationApplication and remove orphaned objects when persistence fails. Evidence remains private until the Admin review endpoint authorizes access.
- Admin Manage Account Registrations is the only approval authority. Approval updates the existing application/User/organization state; rejection records the Admin reason and leaves access denied. No duplicate records are created.
- Registration and review notification delivery is after-commit work. A communication failure cannot roll back a committed application or approval decision.

### Login, session, and recovery

- Require an approved `status = active` Logistics account before issuing credentials. Pending, rejected, suspended, deactivated, and wrong-role accounts fail closed. Protected dashboard data additionally requires the existing organization and sole hub; the dashboard fails closed when that relationship is absent.
- Use stateful Sanctum cookies for the web SPA: initialize `/sanctum/csrf-cookie`, submit credentials to the versioned login route, regenerate the session after login, and invalidate/regenerate it on logout. `device_name` is prohibited; Logistics has no mobile token flow in this repository.
- Login is rate-limited (five attempts per throttle window) and returns `429` with `Retry-After` when exhausted. Password reset is separately rate-limited and generic.
- Stable inactive codes are `ACCOUNT_PENDING_APPROVAL`, `ACCOUNT_REJECTED`, `ACCOUNT_SUSPENDED`, and `ACCOUNT_INACTIVE`; do not reveal unrelated role/account state.
- Reset tokens are hashed, Logistics-role scoped, expiring, single-use, and removed after success. Successful reset revokes personal access tokens without changing approval status.
- `GET /me` and `POST /logout` require `auth:sanctum` plus `logistics.active`; every protected Logistics endpoint repeats role/status checks at the API boundary.
- Protected Logistics endpoints additionally require current shared Terms of Service and Privacy Policy consent. `/me`, logout, policy status, and policy acceptance remain reachable so the organization account can complete consent.

### API contract and acceptance

- Routes are `POST /api/v1/logistics/auth/register`, `/login`, `/forgot-password`, `/reset-password`, and protected `GET /me`/`POST /logout`.
- Registration returns `201` with a pending-safe `logistics` resource and no credential. Login returns `200` with a safe profile/organization/hub projection only after activation.
- [x] Registration creates exactly one pending profile, application, organization, sole hub, address, and two private evidence records.
- [x] Client role/status/organization/hub/subscription injection is rejected; duplicate and concurrent registration are safe.
- [x] Admin approval/rejection and active-status middleware gate access; same-email other roles cannot authenticate as Logistics.
- [x] Web CSRF/session login, `/me`, logout, throttling, generic errors, and role-scoped password recovery are implemented.
- [x] DTOs omit password/hash/session/token values, Admin notes, private evidence, and raw storage paths.
- [x] Registration pin capture persists the confirmed complete coordinate pair on the sole hub Address, rejects partial/invalid coordinates, and handles provider failure without losing the application.
- [x] Pin UI supports keyboard-accessible coordinate adjustment/manual fallback, GPS denial, attribution, validation, and retry.
- [x] Email verification, MFA, resubmission/appeal, and session lifetime/concurrent-session policy are approved.

## HOW

### Current code and data

- Laravel routes live in `src/api/routes/api.php`. The implementation uses `App\Http\Controllers\Logistics\AuthController`, Logistics Form Requests, `LogisticsUserResource`, `EnsureActiveLogistics`, `RegistrationEvidenceService`, and the shared Admin registration-review/notification services.
- The foundation migration is `2026_09_05_000001_create_logistics_foundation_tables.php`; it adds UUID `logistics_profiles`, `logistics_organizations`, and `logistics_hubs`. The existing `users`, `addresses`, `registration_applications`, and `documents` tables are reused; migrations remain additive.
- The SPA lives in `src/logistics`: `AuthContext`, `ProtectedRoute`, AuthShell, registration/login/recovery pages, PSGC address fields, and the protected Dashboard layout. It sends credentialed requests and keeps no Logistics bearer token in browser storage.
- `LogisticsUserResource` exposes safe profile age and organization/hub names; hub address details are returned by the separate Dashboard scaffold, not as private evidence.

### Verification and deferred boundaries

- API tests cover one-account/one-hub creation, evidence persistence/cleanup, duplicate races, role/status denial, Admin approval integration, CSRF/session regeneration, logout, throttling, reset-token scope/expiry, and dashboard access.
- Frontend checks cover multipart field errors, local PSGC/manual fallback, file-limit messaging, pending/rejected states, auth bootstrap, protected redirects, theme/mobile layout, and recoverable API failures.
- Before implementing shipment actions, reconcile `docs/workspace.md`, `docs/schema.md`, and the Logistics/Courier operational specs. Keep the first-mile/final-mile assignments independent and the sole-hub boundary intact.
- Subscription enforcement, online billing, staff accounts, alternate hubs, and operational records require separate approved specs/migrations. Do not add them to Auth as hidden assumptions.

**References:** `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Logistics.md`, `docs/features/logistics/dashboard/specs.md`, `docs/features/courier/auth/spec.md`, `docs/references/user-registration-requirements.md`, and the shared file-upload policy.
