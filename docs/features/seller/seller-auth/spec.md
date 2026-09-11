---
feature: seller-auth
title: Seller Authentication
system: AISLEY
type: Feature Specification
version: 1.2
status: Implemented foundation
role: Seller
scope: Seller Web Application
---

# Seller Authentication

## WHAT

- **Purpose:** Let a merchant register as a Seller, submit one application for Admin review, and use a secure Seller-only web session after approval.
- **Actors:** Seller applicant, approved Seller, and the authorized Admin reviewer. Courier/mobile staff and Seller storefront editing are outside this feature.
- **Authority:** React/Vite owns forms and navigation state; Laravel owns identity, validation, application state, approval gating, sessions, and authorization.
- **Canonical identity:** one `users` record with `role = seller`; same-email records for other roles are separate accounts.
- **Implemented foundation:** registration, private evidence, local PSGC address options, pending Shop creation, Admin approval integration, Sanctum session auth, status gating, password recovery, and Seller UI routes exist.
- **Lifecycle:**

```text
register → pending User/Application/Shop/evidence
        → Admin approves → active Seller + active Shop → sign in → dashboard
        ↘ Admin rejects → rejected/inactive → no Seller access
```

- **One-Shop rule:** registration creates exactly one pending Shop for the Seller. Approval activates that existing Shop; a second Shop is never created by authentication.
- **Non-goals:** Admin review UI, post-approval storefront setup, catalog/fulfillment, social login, MFA, staff sub-accounts, and Seller-controlled status changes.

## MUST

### Registration and address

- Normalize email and enforce uniqueness within the Seller role. The client cannot submit `role`, status, reviewer, approval, or Shop ownership fields.
- Validate first/last name, optional one-character middle name, contact number, sex, birth date, business name, one active Shop Category, email, and project password policy. Age is derived server-side from `birth_date`; client age is not authoritative.
- Use the bundled `@aisley/psgc-address-data` hierarchy in `Region → Province → City/Municipality → Barangay` order. Postal code, street/building, and a secondary line remain manual; changing a parent clears descendants.
- Persist submitted administrative names and manual fields as the address snapshot. PSGC codes and browser/provider identifiers are lookup values only. Keep a complete manual fallback when local data is unavailable or incomplete.
- Current Seller registration uses local PSGC files and does not require a third-party lookup or Mapbox token. Geoapify is not an authentication persistence authority.
- Require government ID and business permit images under [`docs/references/file-upload-requirements.md`](../../../references/file-upload-requirements.md): JPEG/JPG, PNG, or WebP, strictly under 10 MiB, server-inspected, and private.

### Transaction and Shop state

- Create User, SellerProfile, registration application, default business Address, exactly one pending Shop, and both evidence records as one logical operation. Remove stored blobs if the database operation fails.
- Use UUIDs and the existing string-backed enum casts (`UserRole::Seller`, `UserStatus::Pending`, `ApplicationStatus::Pending`, `ShopStatus::Pending`).
- Derive a server-owned unique Shop slug. Do not trust a submitted slug, Shop status, category status, or address ownership.
- Admin approval atomically activates the existing User and Shop and approves the application/evidence. Rejection marks the application/evidence and deactivates the pending Shop; it does not create replacement records.
- After approval, `SHOP_SETUP_REQUIRED` means required storefront fields are incomplete. Setup edits the existing Shop and must not create another Shop. Required publishing fields are defined by the shared Seller/domain contract.

### Login, session, and recovery

- Require `auth:sanctum` and the active Seller middleware for `/me`, logout, and every protected Seller endpoint. Pending, rejected, suspended, and deactivated accounts are denied at the API.
- Protected Seller endpoints additionally require current shared Terms of Service and Privacy Policy consent. The Seller `/me`, logout, policy status, and policy acceptance routes remain available to complete consent.
- Use first-party Sanctum cookie/session authentication: obtain CSRF, send credentialed cookies/XSRF, regenerate the session after login, and invalidate/regenerate it on logout.
- Login resolves the Seller role-account, verifies the Laravel hash, checks active status, and returns a safe Seller DTO. Unknown email, wrong password, and another-role-only email use the same credential error.
- Rate-limit login and reset requests. Forgot-password responses do not reveal account existence; reset tokens are hashed, expiring, single-use, and role-scoped.
- DTOs exclude hashes, session/token values, private evidence, Admin notes, and raw storage paths. Protected resources derive Seller/Shop scope from the authenticated user.
- Registration review notifications are dispatched after commit; delivery failure must not roll back the application.

### Acceptance

- [x] Registration creates one pending Seller application, business address, Shop, and private evidence transactionally.
- [x] Local PSGC cascading options and complete manual address entry are available.
- [x] Category options come from the active canonical Shop Category taxonomy.
- [x] Admin approval/rejection and active-status API gating are role- and tenant-safe.
- [x] Seller login, `/me`, logout, forgot-password, and reset-password are role-isolated and throttled.
- [x] Same-email Customer/Admin/Courier records cannot be used as Seller credentials.
- [ ] Email verification, MFA, full web-session revocation policy, and post-approval Shop setup/publishing workflow are approved and implemented.

## HOW

- Current API routes are `/api/v1/seller/auth/registration-options`, `/address-options/*`, `/register`, `/login`, `/me`, `/logout`, `/forgot-password`, and `/reset-password`.
- Current implementation is in `src/api/app/Http/Controllers/Seller/AuthController.php`, Seller Form Requests/Resources, `EnsureActiveSeller`, `RegistrationEvidenceService`, and the Admin registration decision service.
- The Seller SPA implements public registration/login/recovery routes, session bootstrap, protected navigation, and status-specific errors on port `5174`.
- Keep migrations additive; database enum-like values remain strings with PHP enum casts. Reuse the existing registration/application/document/address/shop relations rather than adding a parallel auth model.
- Address option handlers read and cache the bundled package locally and are separate from the registration transaction. No provider request is made during registration.
- API tests must cover rollback and duplicate races, evidence validation/cleanup, role isolation, every account status, CSRF/session fixation, reset-token isolation, and Admin notification failure. Seller checks cover lint, TypeScript, build, and accessible form states.
- Before adding Shop setup or editable evidence, define the required storefront fields, review policy, notification/email verification, and session-reset behavior in the affected specs.

### Current interface and error contract

- Registration returns `201` with a pending-safe Seller DTO; it never creates a session or redirects to the protected dashboard.
- Login returns `422 INVALID_CREDENTIALS` for indistinguishable credential failures and `403` with `ACCOUNT_PENDING_APPROVAL`, `ACCOUNT_REJECTED`, `ACCOUNT_SUSPENDED`, or `ACCOUNT_INACTIVE` after a valid password for an inactive account.
- `/me` returns the same safe role/profile/Shop projection as login. A session whose Seller is no longer active fails closed through middleware.
- Address-option failures are bounded and safe; the form keeps manual entry available rather than persisting provider error details or PSGC codes.
- Password reset always returns a non-enumerating acknowledgement. Invalid, expired, reused, or cross-role tokens return one field-addressable error.

### Operational safeguards

- Use an idempotent registration uniqueness boundary on normalized Seller email and clean temporary evidence if any later insert fails.
- Keep Admin approval and registration evidence decisions in the existing registration/application records; do not add a Seller-specific reviewer field.
- Persist only the manual/PSGC address values needed by the existing Address model. Coordinates, Geoapify identifiers, and lookup payloads are not Seller-auth fields.
- Keep notification and cleanup jobs outside the registration transaction with an after-commit boundary and retry-safe application reference.
- Review the one-Shop invariant whenever a future setup screen is added: it may edit or complete the pending/active record but never call a second-shop create path.

### Deferred decisions

- Decide whether email verification is required before Admin review or only before first login.
- Decide whether password reset revokes all database web sessions in addition to personal access tokens.
- Define storefront fields and publication readiness for the post-approval setup screen.
- Define any future controlled evidence replacement and MFA policy before exposing those controls.

### Verification checklist

- Registration tests assert one User/Profile/Application/Address/Shop/evidence set for a successful request and zero partial records after a failed upload or database write.
- Role-isolation tests cover same-email Customer/Admin/Courier accounts, forged role/status fields, cross-tenant resource IDs, and direct protected API calls without relying on SPA guards.
- Approval tests assert the existing Shop is activated or deactivated atomically with the User/Application decision and that Admin notes stay private.
- Session tests assert CSRF protection, session regeneration, logout invalidation, status changes taking effect on the next request, throttle headers, and reset-token single use.
- Frontend checks cover keyboard navigation, file-limit messaging, manual address fallback, pending/rejected screens, session bootstrap, and recoverable API errors.

### Route ownership summary

| Route | State | Owner |
| --- | --- | --- |
| `POST /register` | public multipart submission | Seller Auth + Admin registration review |
| `GET /registration-options` | public taxonomy | Seller Auth |
| `GET /address-options/*` | public local PSGC lookup | Seller Auth address service |
| `POST /login` | public credential exchange | Seller Auth |
| `GET /me`, `POST /logout` | active session | Seller Auth middleware |
| `POST /forgot-password`, `/reset-password` | public recovery | Seller Auth |

- Registration option and address responses are bounded, versioned, and safe to cache independently of the private application payload.
- A client may preserve form state after a validation error, but it must not replay uploaded evidence blindly with a new application without a fresh server idempotency/ownership check.
- Admin review remains the only authority that changes pending Seller approval; Seller Account Management cannot activate itself or its Shop.

**References:** `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Seller.md`, and `docs/references/user-registration-requirements.md`.
