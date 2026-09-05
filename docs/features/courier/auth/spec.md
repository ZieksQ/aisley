---
feature: courier-auth
title: Courier Authentication
system: AISLEY
type: Feature Specification
version: 1.1
status: Draft — pending Courier authentication and Logistics relationship implementation
role: Courier / Rider
scope: External Courier Mobile Application and Laravel API
---

# Courier Authentication

## WHAT

- **Purpose:** Let a Courier applicant register under one selected Logistics organization, receive that organization's approval, and obtain secure mobile API access.
- **Actors:** Courier applicant, approved active Courier, authorized Logistics reviewer, and platform Admin for separate account-lifecycle actions.
- **Boundary:** The external Flutter/mobile client owns forms, token storage, and mobile states; Laravel owns identity, validation, approval gating, tokens, and authorization.
- **Mobile-only rule:** Do not build a Courier web dashboard or web-session UI under `src/`; Courier endpoints are consumed by the external mobile application.
- **Registration source fields:** Last name, first name, optional middle initial, sex, email, contact number, birthday, server-derived age, Philippine address, vehicle type, plate number, OR/CR, and ID/driver’s license.
- **Canonical identity:** A `users` row with `role = courier`, resolved by normalized `email + role`; a same-email Customer, Seller, or Admin is a separate account.
- **Current foundation:** `UserRole::Courier`, `CourierProfile`, `Vehicle`, registration applications, documents, addresses, Sanctum personal access tokens, and the Logistics role/profile/organization/sole-hub foundation exist, but Courier auth routes/controllers and the Courier-to-Logistics relationship do not.
- **Current gap:** The Courier affiliation and Logistics approval records still need an additive migration/service. The relationship is server-derived and must never be a client-authorized field.
- **Source lifecycle:**

```text
select active Logistics → register → Logistics review
                                      ↘ REJECTED → no token or Courier API access
                                      ↘ APPROVED → ACTIVE → mobile sign in
ACTIVE → SUSPENDED/DEACTIVATED → token/API access denied
```

- **Owned flows:** Logistics selection, registration, login, token/session revocation, current-Courier identity, status gating, logout, and role-scoped password recovery.
- **Recommended API namespace:** `/api/v1/courier/auth/*`.
- **Non-goals:** Delivery requests, pickup/delivery scanning, routing, proof of delivery, incidents, earnings, chat, offline task sync, vehicle fleet management, Logistics review UI, subscriptions, social login, MFA, and a Courier web app.

## MUST

### Approval and relationship prerequisite

- The selected Logistics organization is the sole Courier registration reviewer and approval authority for the MVP. A Courier is not required to receive a separate Admin approval.
- Admin account-management actions remain a separate lifecycle boundary: an Admin may suspend, restore, or deactivate an account according to platform policy, but those actions do not approve a pending Courier registration.
- Record the Logistics reviewer, decision, reason, and server timestamp immutably. A pending, rejected, or revoked Logistics relationship cannot issue a Courier token.
- The repository approval-gating rule and the product requirements both designate the associated Logistics organization as the Courier approver. Do not introduce a second Admin approval stage unless the product policy is explicitly changed later.
- The API derives `courier` and the authorized Logistics relationship. Clients cannot set role, status, reviewer, approval, organization, hub, or token abilities.
- Every protected Courier endpoint checks Sanctum authentication, Courier role, active status, approval state, and the authorized Logistics relationship; task ownership/assignment checks remain mandatory in operational features.

### Registration

- Require the starred personal fields from the registration reference: first name, last name, sex, email, contact number, and birthday. Middle initial is optional.
- Calculate age from `birth_date` on the server using the application timezone. Never accept, persist, or authorize from a client-supplied age.
- Require the applicant to select one eligible active Logistics organization. Derive that organization's sole operational hub server-side; do not accept a client-selected hub or sub-hub.
- Provide a valid vehicle type and plate number for one initial vehicle. Use the existing `motorcycle`, `car`, and `van` values; additional vehicles belong to Courier Account/Fleet features.
- Address selection must follow the repository flow Region → Province → City/Municipality → Barangay, with manual street/house details and a complete fallback. The source omits postal-code/recipient requirements; reconcile those with the current `addresses` schema before enabling registration.
- Use bundled PSGC address data for administrative selectors. Address lookup is assistive; it must not call a third-party geocoder inside registration or persist provider identifiers.
- Attach OR/CR as `vehicle_registration` evidence and the submitted ID/license as `government_id` or `drivers_license` after the exact document mapping is approved. The source does not mark these uploads as required, so mandatoryness and PDF support are open decisions.
- If an evidence item is an image, apply `docs/references/file-upload-requirements.md`: JPEG/JPG, PNG, or WebP, strictly under 10 MiB, signature/MIME/decode validated, privately stored, and never exposed by raw path. A PDF requires a separate approved policy.
- Persist the User, CourierProfile, selected Logistics relationship, address, initial Vehicle, pending RegistrationApplication, and evidence metadata as one logical operation. Store bytes on the configured private filesystem and delete orphaned blobs after failure.
- Registration creates a pending account/application only; it never authenticates, activates, or self-approves the applicant. Duplicate and retried submissions must be idempotent and return stable field-addressable errors.

### Approval and lifecycle

- Record the Logistics reviewer, decision, reason, and server timestamp without overwriting prior decisions. Rejection must leave the Courier unable to sign in.
- Only a Courier approved by the selected Logistics organization, with an active account and valid Logistics association, may receive a token or access Courier operations.
- Pending, rejected, suspended, deactivated, wrong-role, and orphaned-relationship accounts must be denied server-side even with a correct password.
- Use safe, stable codes such as `ACCOUNT_PENDING_APPROVAL`, `ACCOUNT_REJECTED`, `ACCOUNT_SUSPENDED`, `ACCOUNT_INACTIVE`, and `LOGISTICS_ASSOCIATION_INVALID`; do not expose unrelated accounts or private review notes.
- A Logistics approval or rejection notification is post-commit work. An Admin lifecycle action after approval is also post-commit and must not be confused with the registration decision.
- If a Logistics company/hub becomes inactive or a Courier is disassociated, revoke or deny access according to the approved cascade policy; do not silently transfer the Courier.
- Approval/rejection email and in-app delivery failure must not roll back the persisted Logistics decision; retries and delivery-failure status are separate concerns.

### Mobile token authentication

- `POST /api/v1/courier/auth/login` accepts normalized email, password, and `device_name`; it must not accept a trusted role or caller-selected abilities.
- Verify the Courier role, password, Logistics approval, active status, and Logistics relationship before calling Sanctum `createToken`. Return the plain-text token only in the successful response.
- Grant server-owned least-privilege abilities (at minimum a Courier baseline ability); operational endpoints may require narrower abilities when their contracts exist.
- The mobile app stores the token only in OS secure storage (Flutter secure storage/Keychain/Keystore) and sends `Authorization: Bearer <token>`. Never log, cache in ordinary preferences, or return it from `me`.
- Protect `me` and logout with `auth:sanctum` plus Courier-active middleware. `GET /api/v1/courier/auth/me` rechecks role, status, Logistics approval, and relationship on every request.
- `POST /api/v1/courier/auth/logout` revokes the current personal access token. Expired or revoked tokens return `401`; forbidden status or relationship returns `403` without leaking private details.
- No token-refresh endpoint is implied. Use the configured Sanctum expiration/revocation policy, and document device/session limits before adding multi-device management.

### Authentication interface

- `GET /api/v1/courier/auth/logistics-options` may expose only active Logistics organizations accepting Courier applications; the sole hub is derived after selection. Search and pagination must be bounded and relationship-scoped.
- `POST /api/v1/courier/auth/register` accepts the validated profile, address, vehicle, and evidence as multipart input and returns `201` with a safe pending-application summary.
- A successful registration response contains no password, token, evidence bytes, private storage path, reviewer note, or unapproved Logistics data.
- Successful login returns the one-time plain-text token, Courier identity summary, and approval/status information needed by the mobile client.
- `GET /api/v1/courier/auth/me` returns the current safe Courier identity only; it is not a delivery-job or vehicle-fleet endpoint.
- Use field-addressable `422` validation errors, `401` for missing/invalid bearer credentials, `403` for status/relationship denial, and `429` for throttling.

### Recovery, privacy, and abuse controls

- Provide role-scoped `forgot-password` and `reset-password` endpoints only after the Courier notification path exists. Responses for unknown, inactive, or cross-role email addresses remain generic.
- Store reset tokens hashed, expiring, single-use, rate-limited, and keyed by `email + courier`; successful reset rotates the remember token and revokes personal access tokens.
- Apply CSRF only to any future browser surface; bearer-token mobile requests use transport security and do not use the web SPA cookie flow.
- Throttle registration, login, and recovery by normalized email plus IP and return `429` with `Retry-After`. Log safe success/failure categories, request IDs, and account IDs—not passwords, tokens, documents, or private URLs.
- The mobile client must show pending/rejected/disabled states and recoverable validation/network errors. Offline task caching may not bypass approval or perform unsynchronized auth decisions.

### Acceptance criteria

- [ ] A valid submission creates one pending Courier User/Profile/Application with server-derived age and one selected Logistics relationship.
- [ ] Personal, PSGC/manual address, vehicle, and approved evidence rules reject invalid or unauthorized input without partial records or orphaned blobs.
- [ ] Duplicate/retried registration cannot create duplicate role accounts, applications, vehicles, or evidence.
- [ ] Every required approval is recorded and only an approved active Courier can obtain a token.
- [ ] Same-email accounts under other roles cannot authenticate as Courier.
- [ ] Token abilities, secure mobile storage guidance, role/status/relationship middleware, `me`, logout, and revocation are enforced.
- [ ] Password recovery is generic, Courier-scoped, expiring, single-use, throttled, and token-revoking.
- [ ] Private registration evidence is never returned in auth DTOs or fetched without authorization.

## HOW

- Add Courier-namespaced Form Requests, controller, resource, notifications, middleware, service, and routes beside the existing Customer/Seller auth groups; keep the mobile client external to this repository.
- Reuse `users`, `CourierProfile`, `Vehicle`, `registration_applications`, `documents`, `addresses`, Sanctum `personal_access_tokens`, password-reset, and private-storage patterns. Add only new migrations after the Logistics relationship and approval model are approved.
- Model a Logistics approval record with reviewer, decision, reason, and timestamp; keep any later Admin suspend/restore/deactivate action in the separate account-lifecycle history rather than treating it as Courier approval.
- Reuse the current Courier profile age accessor, `VehicleType` enum, UUID conventions, bundled PSGC data, and shared upload policy. Keep file bytes in blob storage and metadata in database records.
- Implement the mobile flow as: search eligible Logistics options → submit multipart registration → show pending status → receive the Logistics decision notification → login with `device_name` → securely store token → call Courier APIs.
- Add API tests for validation/rollback, duplicate races, age boundaries, address hierarchy, vehicle/document mapping, Logistics-only approval, role isolation, status/relationship revocation, token abilities, logout, throttling, and reset-token isolation.
- Roll out only after the Courier-to-Logistics relationship/approval schema, required document types, email delivery, private storage, token lifetime, and external mobile API contract are approved.
- **Open decisions:** requiredness and PDF policy for OR/CR and ID/license; vehicle multiplicity; relationship deactivation cascade; email verification; token expiration/device limits; and final mobile status endpoint. The MVP's one-Logistics-organization/one-sole-hub affiliation and Logistics-only approval are settled.

### References

- Project: `docs/requirements.md`, `docs/workspace.md`, `docs/architecture.md`, `docs/schema.md`, `docs/domains/Courier.md`, `docs/domains/Logistics.md`, and `docs/references/user-registration-requirements.md`.
- Shared upload policy: `docs/references/file-upload-requirements.md`.
- [Laravel Sanctum token abilities](https://laravel.com/framework/docs/10.x/sanctum#token-abilities)
- [Laravel authentication](https://laravel.com/framework/docs/13.x/authentication)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
