---
model: Admin
type: Domain Context
purpose: Shared Admin workflow and implementation context
version: 1.1
status: Revised — aligned with the implemented Admin console and deferred platform operations
---

# Admin Model Context

## Overview

Admin is Aisley's privileged platform-operations role. The Admin console is the isolated React/Vite application in `src/admin`; Laravel and PostgreSQL are authoritative for authentication, permissions, registration decisions, account lifecycle, compliance state, policies, notifications, and audit history.

Admin is not a generic client-side superuser. Every protected feature request requires the persisted `admin` role and an active account, plus the destination feature's permission whenever that feature defines one. The Admin Dashboard summarizes other domains; it must not reimplement their mutations or invent data for features whose contracts are not implemented.

The Admin role reviews Customers, Sellers, and Logistics registrations. Courier registration approval belongs to the selected Logistics organization. Admin may still manage the lifecycle of modeled non-Admin accounts through the separate User Accounts feature, but that does not make Admin the Courier affiliation approver or the owner of Logistics operations.

## Authentication, permissions, and account boundary

- The initial Admin is bootstrapped from deployment configuration through the existing seeder. There is no public Admin registration flow.
- Admin web authentication uses the stateful Laravel Sanctum session/cookie flow. Identity is resolved by normalized `email + role`; a same-email Customer, Seller, Courier, or Logistics account cannot authenticate as Admin.
- Laravel derives the authenticated Admin, role, status, and effective permissions. The browser cannot submit `role`, `admin_id`, `permissions`, or `is_admin` as proof of authority.
- Pending, suspended, deactivated, expired, or otherwise invalid Admin sessions cannot read or mutate protected Admin data. API gates are authoritative; React route guards are only a usability layer.
- Current permission slugs are feature-scoped, including `registrations.view`, `registrations.review`, `users.view`, `users.manage`, `seller_compliance.manage`, `platform-settings.view`, `platform-settings.manage`, `notifications.view`, and `audit-logs.view`.
- Permission assignment and creation of additional Admin accounts are not part of the current self-service Account Management feature. The existing permission tables and initial-admin grant provide the foundation for a later explicitly authorized Admin-management workflow.
- The Admin may manage only its own profile, credentials, and profile photo through Account Management. It cannot change its role, permissions, registration evidence, or another Admin's account through that feature.

Admin authentication must use CSRF protection, secure session settings, generic credential failures, throttling, and safe logout/session invalidation. Deployment secrets are never exposed in the Admin UI or API DTOs.

## Admin console boundary

Current protected routes are:

```text
/dashboard
/registrations
/users
/seller-compliance
/notifications
/platform-settings
/audit-logs
/account
```

- Each route calls its owning Laravel API and renders explicit loading, empty, forbidden, not-found, validation, conflict, retry, and unavailable states.
- Navigation visibility may use the Admin's permission DTO, but hidden links are not security. Every API endpoint repeats the role, active-status, and permission checks.
- Admin responses use purpose-built, least-privilege DTOs. They omit password hashes, tokens, payment secrets, raw storage paths, private evidence bytes, unnecessary PII, and unrelated role data.
- Admin-specific responses and notification lists must not be placed in a shared public cache. A stale UI never overrides a newer server decision.

## Admin capabilities

### 1. Admin Authentication

- **Purpose:** Establish, restore, and end a secure Admin session before protected console features are usable.
- **Current state:** Role-aware login, CSRF/session flow, session restoration, logout, throttling, active-status enforcement, and environment-backed initial Admin seeding are implemented.
- **Boundary:** Authentication does not approve public Customer/Seller/Logistics registrations, create additional Admins, or assign permissions.

### 2. Dashboard

- **Purpose:** Give an authenticated Admin a high-level platform overview, important notifications, and pending actionable work.
- **Current state:** The Admin Dashboard has a permission-aware registration aggregate and a PII-minimized Registration Action Center, with responsive loading, zero, error, retry, timestamp, and deep-link states. The dashboard shell and notification bell are available.
- **Rules:** Dashboard cards are read projections. Counts come from Laravel aggregate queries and are scoped by the Admin's permissions. A missing or failed source appears unavailable/error, never as an authoritative zero. Dashboard links navigate to the owning feature; they do not approve accounts, suspend users, resolve cases, or edit policies inline.
- **Deferred:** Full platform KPIs, commission/revenue trends, technical health telemetry, charts, and broad operational workload metrics require their source domains and definitions.

### 3. Manage Account Registrations

- **Purpose:** Review pending onboarding applications and approve or reject them.
- **Current state:** Authorized Admins can list/search/paginate applications, open role-aware details, preview/download private submitted evidence, approve or reject pending Customer, Seller, and Logistics applications, record reviewer metadata, and handle stale decisions safely.
- **Rules:** Registration status (`pending`, `approved`, `rejected`) is distinct from ordinary account lifecycle status (`active`, `suspended`, `deactivated`). Approval/rejection is server-controlled and transactional; for Seller it includes the pending Shop/evidence transition. The applicant receives the appropriate post-commit email, and eligible Admins receive a persisted in-app review notification.
- **Boundary:** Admin does not approve Courier affiliations; the associated Logistics organization owns that decision. Registration review does not provide post-approval suspension, restoration, product moderation, or generic account CRUD.

### 4. Manage User Accounts

- **Purpose:** Inspect existing non-Admin accounts and apply controlled account lifecycle actions.
- **Current state:** Authorized Admins can search/filter/paginate safe account summaries, open role-aware details and registration context, view lifecycle history, and suspend, restore, or deactivate eligible Customer, Seller, Courier, and other modeled non-Admin accounts.
- **Rules:** Actions use expected-current-status checks, row locking/transactional persistence, a required reason where defined, and an exact identity confirmation for destructive deactivation. The service writes an immutable lifecycle event and audit outbox entry together. Repeated or stale requests fail safely and do not duplicate history.
- **Boundary:** Admin cannot target another Admin through this feature, change a user's role, approve a pending registration, hard-delete historical accounts, rewrite Orders, or approve/revoke a Courier's Logistics affiliation. Seller suspension referrals from Compliance reuse this lifecycle service.

### 5. Monitor Seller Compliance

- **Purpose:** Manually review Seller/Product compliance and apply policy-linked moderation decisions.
- **Current state:** Authorized Admins can create and inspect Seller/Product cases, record immutable decisions, issue warnings, impose/revoke active Product restrictions, refer Seller suspension to Account Management, and close/dismiss cases with idempotent actions and after-commit Seller notifications.
- **Rules:** A case's Product must belong to its Seller's authoritative Shop. Active restrictions override public discovery, Product Detail, Cart, Checkout, Seller publication, and Seller unarchive without deleting catalog, Inventory, or historical Orders. Seller suspension is delegated to the canonical Account Lifecycle service; this feature does not write `users.status` directly.
- **Boundary:** Compliance is not an automatic fraud engine, complaint-resolution system, or replacement for immutable audit/case history. Communication failure never restores a restricted Product or reverses a committed decision.

### 6. Manage Platform Settings

- **Purpose:** Maintain platform announcements and the allow-listed Terms of Service, Privacy Policy, and Internal Platform Rules.
- **Current state:** Authorized Admins can draft/edit/publish/archive announcements and create, view, edit, publish, and inspect versioned policy content through `/platform-settings`.
- **Rules:** Announcements have explicit lifecycle/revision/expiration behavior and only active published records reach user-facing reads. A published policy version is immutable. Editing it creates or reopens one copied successor Draft; publishing that successor atomically supersedes the previous current version while preserving exact history. Ordinary policy views show only the current published version; authorized history views show prior published versions. Every mutation is revision-checked, audited, and followed by cache invalidation after commit.
- **Boundary:** Platform Settings cannot modify `.env`, secrets, infrastructure, arbitrary key/value configuration, feature flags, legal policy outside the allow-list, or targeted push campaigns. User consent presentation/enforcement remains a separate integration decision.

### 7. Admin Notifications

- **Purpose:** Provide an authenticated Admin with a persistent in-app inbox for important platform events and pending attention.
- **Current state:** The Laravel database notification table, permission-aware recipients, unread count, paginated list, mark-one/read-all actions, private destinations, polling/reconnect refresh, and responsive notification center are implemented.
- **Rules:** Notifications are addressed to eligible Admins based on persisted permissions and source-domain rules. Registration submissions are the current Admin-facing producer; other domain events require an explicit recipient contract. Notification creation/delivery occurs after the source transaction; retries are idempotent. An email/SMTP delivery, in-app notification, broadcast, or provider failure cannot undo the source decision.
- **Boundary:** This inbox is distinct from outbound Push Notification Management and from SMTP workflow emails. It does not let the browser create arbitrary notifications or mutate the referenced business record.

### 8. System Audit Logs

- **Purpose:** Preserve an immutable ledger of important administrative and security-sensitive actions.
- **Current state:** Authorized Admins can search/filter/paginate audit events and open safe read-only details. Registration decisions, account lifecycle actions, platform settings, Seller compliance, and successful active-Admin logins produce sanitized audit events through the transactional outbox.
- **Rules:** Every event preserves actor identity/snapshot, action, target, safe before/after values, source feature, server occurrence time, and request metadata when available. Audit rows are append-only in Eloquent and at the database layer; the UI has no edit/delete/bulk-clear path. Outbox/retry processing must not fail or repeat the business mutation.
- **Boundary:** Audit Logs do not replace Compliance decision history, Complaint timelines, or technical application logs. They never store passwords, tokens, payment credentials, raw evidence, full message bodies, or binary files.

### 9. Admin Account Management

- **Purpose:** Let the current Admin maintain its own profile and security credentials.
- **Current state:** `/account` supports allow-listed profile updates, role-aware email changes, current-password-protected password changes, private profile-photo upload/view/replace/remove, session/token safety, and immediate shell identity refresh. Profile images use the configured disk/Azure Blob and the shared upload policy.
- **Rules:** The API derives the current Admin and never accepts an arbitrary Admin ID. Sensitive changes are validated under the current-password policy and recorded safely; profile-photo responses are owner-only, private, no-store, and never expose raw blob paths.
- **Deferred:** 2FA/MFA, preference keys, session-device management UI, and additional Admin creation/permission assignment require separate approved contracts. The current implementation does not claim them.

### 10. Platform-wide Vouchers

- **Purpose:** Create and manage App-funded vouchers that Customers may use at Checkout.
- **Status:** Customer Checkout can validate and snapshot allow-listed App/Shop voucher definitions and redemptions, but the Admin creation/management UI and full promotion policy are deferred.
- **Boundary:** Admin must not invent voucher terms, bypass Checkout eligibility, alter a placed Order's financial snapshot, or expose payment secrets. Implement this only against a dedicated voucher-management contract.

### 11. Complaints and Disputes

- **Purpose:** Review user reports, supporting evidence, and disputes, then record a binding resolution.
- **Status:** Documented as a future Admin resolution center; complaint/dispute tables, evidence ownership, state transitions, and UI are not implemented in the current foundation.
- **Boundary:** Do not infer complaints from Seller Compliance cases or Admin notifications. A future implementation must use private evidence access, participant scoping, immutable case history, and explicit downstream actions.

### 12. Reports Overview

- **Purpose:** Show platform commission and financial performance totals with date filtering.
- **Status:** Deferred. Orders and COD snapshots exist, but platform commission, Logistics per-order fees, payouts, taxes, refunds, and a financial ledger are not yet authoritative enough for an Admin report.
- **Boundary:** Do not calculate commission from incomplete UI collections or label generic Order totals as profit. Exports, if added, require bounded asynchronous jobs, safe downloads, and an approved financial source of truth.

### 13. Chat/Messaging

- **Purpose:** Support secure Admin communication with authorized Customers, Sellers, Logistics operators, or Couriers.
- **Status:** Deferred. Conversation, participant, message, attachment, and read-state persistence is not implemented.
- **Boundary:** Future messaging must be relationship/permission scoped and must not duplicate notification, Compliance, Complaint, or Audit records or expose private evidence, addresses, or payment data.

### 14. Global Ban / Blocklist

- **Purpose:** Maintain and enforce blocks for abusive users, IP addresses, or payment methods.
- **Status:** Deferred. No approved persistence or enforcement contract currently exists.
- **Boundary:** Do not add a generic ban field or silently merge Global Ban with ordinary `users.status`. A future blocklist must define target types, normalization, expiry/revocation, enforcement points, permission, audit, and payment-secret handling.

### 15. Push Notification Management

- **Purpose:** Compose and dispatch targeted promotional or critical push/SMS campaigns.
- **Status:** Deferred. The `push-notification-bar` specification is not an implemented provider/campaign system.
- **Boundary:** It is separate from the Admin in-app notification center and registration SMTP emails. Provider credentials, audience consent, recipient snapshots, retries, and campaign audit records require their own approved contract.

## Operational invariants

- Every Admin endpoint validates Sanctum authentication, persisted `admin` role, active status, and the feature permission. A UI permission check is never sufficient.
- Registration approval, account lifecycle, compliance decisions, policy publication, and other state-changing actions are server-owned, transactionally validated, revision/idempotency protected, and append history/audit records without partial success.
- Registration application status and ordinary account lifecycle status remain separate. Courier Logistics affiliation approval remains owned by Logistics.
- Admin reads are scoped to authorized resources and return least-privilege DTOs. Private registration evidence and profile photos are served through authenticated owner/reviewer endpoints, not predictable public paths.
- Communication, queue, broadcast, map, or external-provider failure cannot roll back a committed platform decision. Failed delivery is retried/observed separately.
- Published policy versions and audit records are immutable. Corrections are represented by successor versions or new compensating events, not silent rewrites.
- All important administrative mutations include a safe actor, target, reason/changed-field summary, timestamp, and request correlation where available. Secrets and raw evidence never enter audit or notification payloads.
- Persisted enum-like values remain lowercase `snake_case` strings with PHP enum casts. Admin feature transitions must reject client-invented values and stale revisions.

## Current and deferred data boundary

Implemented Admin foundation:

- Admin role/profile, environment-backed initial bootstrap, Sanctum authentication, permissions, protected React console, and Admin self-service profile/email/password/profile-photo management.
- Registration review for Customer, Seller, and Logistics applications with private evidence access, atomic approval/rejection, reviewer history, email notification, and Admin in-app notification.
- Dashboard registration aggregate/action center, Admin notification inbox, User Account lifecycle management for non-Admin accounts, Seller Compliance cases/restrictions, Platform Settings announcement/policy versioning, and append-only Audit Logs/outbox.

Deferred or dependent Admin operations:

- Additional Admin provisioning and permission administration, full Dashboard KPIs/health metrics, Admin-managed App vouchers, Complaints/Disputes, commission/financial reports, Chat/Messaging, Global Ban/Blocklist, Push/SMS campaign delivery, 2FA/preferences, and consent enforcement.

Admin does not own Seller catalog, Customer Cart/Checkout, Logistics hub operations, or Courier mobile UI. It may receive safe notifications or review records from those domains only through explicit feature contracts.

## Shared contracts

- `docs/requirements.md` — Admin responsibilities, approval boundaries, policies, and platform operations.
- `docs/workspace.md` — Admin journeys, role/permission gates, and shared order/Logistics flow.
- `docs/schema.md` — Admin profiles, permissions, registration applications/documents, notifications, lifecycle events, compliance, policies, and audit/outbox tables.
- `docs/references/user-registration-requirements.md` — registration data and evidence Admin reviews.
- `docs/references/file-upload-requirements.md` — private evidence and profile/image upload rules.
- `docs/features/admin/*/spec.md` — feature-specific Admin implementation contracts and deferred boundaries.
