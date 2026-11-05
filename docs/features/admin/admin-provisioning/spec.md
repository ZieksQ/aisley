---
feature: admin-provisioning
title: Admin provisioning and permissions
role: Admin
status: Implemented; deployment and live SMTP acceptance pending
---

# Admin provisioning and permissions

## WHAT

Authenticated administrators manage Admin accounts separately from non-Admin users and self-service Account Settings. The initial deployment-configured admin is a protected super admin with all present and future permissions and no first-login setup requirement. Existing admins keep existing grants and setup status.

## MUST

- Custom roles are live permission groups; effective authority is the union of assigned roles and individual grants. Super admins receive the complete permission catalog.
- Separate permissions control viewing, creating, updating, suspending, restoring and archiving admins. The matching create/update/archive permissions control role mutations. Any appropriately authorized admin may manage eligible roles, regardless of creator.
- Non-super admins grant only their own effective permissions and manage only accounts/role members within their authority. They cannot modify super admins. Only super admins promote/demote super admins. Protect the initial admin and prevent self privilege/status changes.
- Require names, email, temporary password and confirmation at creation; middle name/contact number are optional. Preserve role-aware email uniqueness and existing password rules.
- Archive retains identity and audit history but disables login; no physical account deletion. Delete roles only when unassigned.
- Confirm administrator mutations with the actor's current password. Management writes have a separate per-actor limit of ten per minute. Check revisions and authority under a shared database lock; stale edits return 409.
- New accounts cannot use operational APIs until both temporary-password replacement and email OTP succeed. A changed email requires OTP again, without requiring another password replacement. Existing registration toggles never bypass this gate.
- OTP: six digits, ten-minute expiry, sixty-second resend cooldown, five sends/hour and five failed attempts/challenge. Bind to account, identity, credential and replacement password; hash codes, consume once and invalidate superseded challenges. Reuse encrypted transactional outbox and recoverable queue delivery.
- Login/setup/logout retain Sanctum session/CSRF protection. Setup completion regenerates the current session and invalidates other sessions using temporary credentials. Suspension/archive/restoration invalidate existing sessions.
- Safe audit metadata records all management/setup changes; passwords, hashes, codes and session secrets never appear in projections or audit payloads.
- Follow docs/design.md and reuse @aisley/ui portal primitives. Show loading/error/empty/read-only states and protect deep links as well as navigation.

## HOW

- Add migrations rather than editing executed migrations. Keep existing direct-grant pivot semantics and add role memberships, role permissions, security/setup fields, hashed setup challenges and a single authority-lock row.
- Management APIs: /api/v1/admin/admin-accounts, /admin-roles and /permissions. Setup APIs: /api/v1/admin/auth/setup, /setup/code and /setup/complete.
- Extend current-admin DTO with effective permissions, roles, super-admin/initial-admin indicators and setup requirements. Laravel is authoritative; refresh frontend identity on access loss and management changes.
- Deployment: run additive migrations, then targeted AdminPermissionSeeder and InitialAdminSeeder (not demo/database seeding). Initial identity is reconciled by configured email, preserving credentials/status; refuse silently replacing an established initial admin.
- Verify authorization/delegation, live role propagation, bootstrap, setup bypass, OTP replay/expiry/throttling, email changes, session revocation, concurrency, safe mail/audit projections, responsive themes and keyboard workflows.
- Out of scope: recurring login OTP, MFA enrollment, admin recovery and manager password resets. No external Flutter contract change.


## API and UI contract

- `/admin-accounts`: GET paginated search/status listing; POST creation. `/{adminAccount}`: GET detail and PATCH replacement of editable profile, direct permissions and role IDs. `/{adminAccount}/{suspend|restore|archive}`: POST lifecycle mutation. All paths are under `/api/v1/admin` and require `admin-accounts.view` plus the action-specific permission for writes.
- `/admin-roles`: GET list and POST creation; `/{adminRole}`: PATCH revision-bound update or DELETE unassigned role. `/permissions`: GET catalog of slug/name/description. Role writes use corresponding account create/update/archive permission.
- Creation accepts `email`, `first_name`, optional `middle_name`/`contact_number`, `last_name`, `password`, `password_confirmation`, `permissions` (slugs), `role_ids`, optional `is_super_admin`, and the actor's `current_password`. Account PATCH excludes password changes and requires `revision`. Role writes accept `name`, permission slugs and current password; PATCH requires revision. Status and DELETE actions require revision/current password.
- Management projections contain safe profile, account status/archive/setup status, direct and effective permissions, assigned roles and revision. Role projections include permissions, revision and member count. Normalized email identity remains unique per platform role, including archived identities.
- `GET /api/v1/admin/auth/setup` returns the current Admin DTO. `POST /setup/code` accepts current password and, when first-login replacement is required, confirmed replacement password. It returns challenge ID, masked email, expiry and resend time. `POST /setup/complete` adds challenge ID and six-digit verification code and returns the refreshed Admin DTO.
- Setup codes are requested explicitly. Password drafts remain in memory, are bound to their challenge, and are cleared on completion/sign-out. Frontend uses current-password and one-time-code autocomplete. Incorrect/expired/superseded codes never clear the gate. Sending a code does not prove delivery.
- Error semantics: 401 missing/invalid session, 403 role/authority/setup gate (`ADMIN_SETUP_REQUIRED` for pending setup), 409 stale revision/current-state conflict, 422 field validation, 429 throttling with `Retry-After`.
- `/admin-accounts` and `/admin-roles` use existing portal styling. Detail pages show setup/status and authorized lifecycle actions; the initial Admin is protected. No password display/reset flow is added. Assigned roles cannot be deleted, including assignments to archived accounts.

## Deployment and recovery

Run the migration before deploying consumers. From the repository root, use `php src/api/artisan migrate --force`, then targeted `php src/api/artisan db:seed --class=AdminPermissionSeeder --force` and `php src/api/artisan db:seed --class=InitialAdminSeeder --force` with the normal deployment configuration. An existing configured initial Admin can be reconciled without supplying a replacement password. Bootstrap never overwrites existing credentials/status and rejects switching an established initial identity. Keep INITIAL_ADMIN_EMAIL synchronized with any authorized identity change.

Keep the database queue worker and minute scheduler running for durable OTP delivery. Use existing mail status/retry tooling; retries never complete account setup. Do not use schema rollback after roles or provisioning state are in use: recover with a forward migration. Existing admins are grandfathered; newly created accounts require setup even when promoted to super admin. SMTP inbox delivery, deployed cookie/CSRF configuration and assistive-technology acceptance remain release checks.
