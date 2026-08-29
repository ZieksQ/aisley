---
feature: manage-account-registration
title: Admin Manage Account Registrations
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Admin
scope: Admin Web Application
---

# Admin Manage Account Registrations

## WHAT

- **Purpose:** Let authorized Admins review pending account-registration applications and approve or reject them.
- **Primary actor:** Authenticated `ADMIN`.
- **Source-defined behavior:**
  - review incoming registration requests
  - inspect submitted credentials/application details
  - approve applications that satisfy platform criteria
  - reject applications that do not
  - maintain registration status such as `PENDING`, `APPROVED`, `REJECTED`
  - automatically notify the applicant by email after the decision
- **Feature boundary:**
  - public/user registration forms create the application.
  - this feature begins when a reviewable registration/application already exists.
  - Manage User Accounts owns post-approval account administration such as suspension/restoration/deactivation.
  - Admin Authentication does not own public account approval.
- **Architecture:**
  - Next.js/React owns the Admin queue, application detail page, document previews, decision UI, filters, and user feedback.
  - Laravel owns authentication, authorization, application lookup, state transitions, validation, persistence, audit events, and notification dispatch.
  - Laravel/database state is authoritative.
- **Core lifecycle:**

```text
registration submitted
→ PENDING
→ Admin reviews application + submitted credentials
→ APPROVE or REJECT
→ transaction commits
→ audit/event recorded
→ applicant notification queued
```

- **MVP states:**

```text
PENDING
APPROVED
REJECTED
```

- Do not add extra states such as `UNDER_REVIEW`, `NEEDS_CHANGES`, or `RESUBMITTED` unless another project source defines them.
- **Recommended Admin routes:**

```text
/account-registrations
/account-registrations/{application}
```

or repository-equivalent routes.

- **Non-goals:**
  - public registration UI
  - Admin account registration
  - post-approval suspension/deactivation
  - seller compliance moderation after onboarding
  - document OCR
  - automated identity verification
  - automated approval/rejection
  - face matching
  - external KYC provider integration unless separately specified

## MUST

### Access control

- Every Admin registration-review endpoint requires:
  - authenticated session
  - persisted role = `ADMIN`
  - Manage Account Registrations permission where custom Admin permissions exist
- Laravel authorization is authoritative.
- Frontend guards are UX only.
- Direct API requests cannot bypass permission checks.
- Use project-standard responses:
  - `401` unauthenticated
  - `403` forbidden
  - `404` application not found/scoped out
  - `422` invalid request
  - `409` stale or invalid state transition

### Application ownership and identity

- Each registration application must resolve to the intended persisted account/application record.
- IDs are server-generated and immutable.
- Admin must never choose or rewrite the applicant's role during approval unless a separate role-correction workflow explicitly exists.
- Approval applies only to the reviewed role-account.
- The feature must preserve AISLEY's role-aware identity rules where applicable.
- The Admin UI must display the applicant role from persisted data, not client-submitted approval payload.

### Registration queue

- Admin must be able to list registration applications.
- Default operational view should prioritize `PENDING` applications.
- List must be paginated.
- Recommended allow-listed filters:
  - status
  - role
  - submitted date
- Optional search may use safe applicant identifiers supported by the schema.
- List summary should expose only fields needed for triage, such as:
  - application/account ID
  - applicant display name
  - role
  - submitted timestamp
  - current registration status
- Do not place full ID documents or other sensitive application evidence in list payloads.

### Application detail

- Admin must be able to open a single authorized application.
- Detail may include:
  - applicant/account information submitted by the registration feature
  - role-specific application data already stored by the system
  - references to submitted supporting files
  - current registration status
  - submission timestamp
  - existing decision metadata if already decided
- Exact required fields/documents per role must come from the actual registration features/schema.
- Do not invent a document checklist that is not defined by the registration source.
- Sensitive PII must be minimized and exposed only where needed for review.

### Supporting documents

- If the registration includes uploaded credentials/documents:
  - store files outside the application server according to the shared project storage rule
  - persist asset references, not raw server filesystem paths
  - validate type and size during original upload
  - malware scan according to the shared project contract
  - authorize every Admin document-view request
  - use signed/temporary/authorized URLs for private files
- Registration documents must not be publicly addressable by predictable URLs.
- File URLs returned to the Admin should be short-lived when the storage driver supports temporary URLs.
- The approval API must not trust filenames or MIME types supplied by the browser as proof of document validity.
- Document viewing is read-only in this feature unless a separate document-management requirement exists.

### Status transition rules

- Registration status is a server-controlled state machine.
- Valid MVP decision transitions:

```text
PENDING → APPROVED
PENDING → REJECTED
```

- The client must not submit an arbitrary status string and have Laravel assign it directly.
- `APPROVED → PENDING`, `APPROVED → REJECTED`, `REJECTED → APPROVED`, or similar reversals are not part of this MVP unless separately specified.
- Re-review/reopen behavior is an Open Question.
- Only a `PENDING` application can be decided through the normal approval/rejection actions.
- A second decision against an already-decided application must return a stale/conflict response rather than silently overwrite the first decision.

### Approval

- Approval must:
  - verify Admin authorization
  - verify application is still `PENDING`
  - transition to `APPROVED`
  - store decision metadata
  - record the acting Admin
  - record decision timestamp
  - commit atomically
- Approval must grant whatever normal application access the registration/auth system defines for an approved account.
- Do not invent additional role privileges at approval time.
- Any role-specific post-approval setup must be delegated to the owning registration/account feature.

### Rejection

- Rejection must:
  - verify Admin authorization
  - verify application is still `PENDING`
  - transition to `REJECTED`
  - store decision metadata
  - record the acting Admin
  - record decision timestamp
  - commit atomically
- A rejection reason should be required if the project needs to communicate why an application failed.
- Exact rejection-reason taxonomy is an Open Question.
- Internal Admin notes and applicant-visible rejection reasons must be separate if both are supported.
- Never expose internal fraud/security notes to the applicant unless explicitly intended.

### Concurrency

- Two Admins may open the same `PENDING` application simultaneously.
- Only one final transition may succeed.
- Approval/rejection must run in a database transaction.
- Use row locking, conditional update, version checking, or an equivalent concurrency-safe technique.
- If the record changed since the Admin loaded it:
  - do not overwrite the newer decision
  - return `409` or project-equivalent stale-state error
  - refresh the frontend with the current state
- Duplicate clicks/retries must not produce duplicate side effects.

### Decision metadata

- Recommended persisted decision fields/concepts:
  - status
  - reviewed/decided by Admin ID
  - decided timestamp
  - rejection reason if applicable
- Exact schema may use an application history table rather than columns on `users`.
- Preserve enough information for accountability.
- Do not overwrite decision history if the project later adds reopen/re-review behavior.

### Audit trail

- Approval and rejection are administrative mutations and must be auditable.
- Audit metadata should include:
  - Admin ID
  - application/account ID
  - applicant role
  - previous status
  - new status
  - timestamp
  - safe reason metadata when applicable
- Do not copy sensitive uploaded documents into the audit log.
- Do not log passwords, auth secrets, or raw identity-document contents.
- Follow the project System Audit Logs implementation when available.

### Applicant notification

- The source requires corresponding notification email after approval/rejection.
- Notification must be triggered only after the decision transaction commits.
- Email failure must not roll back an already successful approval/rejection.
- Queue notification delivery when the configured queue infrastructure is available.
- Notification should state the resulting application status.
- Rejection email may include an applicant-visible reason when that policy is defined.
- Do not include unnecessary PII or private document URLs in email.
- Notification retries must not repeat the underlying approval/rejection transaction.
- Whether an in-app notification is also required is an Open Question.

### Login/access relationship

- `PENDING` or `REJECTED` accounts must not gain the same protected application access as `APPROVED` accounts.
- The exact enforcement point belongs to each role's Authentication/authorization layer.
- Approval must not automatically create a second account if the registration already created the account/application record.
- Do not duplicate registration data during approval.

### Dashboard integration

- Admin Dashboard may display a `PENDING` registration count or pending action summary.
- Dashboard is read-only composition; approval/rejection remains owned here.
- After a decision, Dashboard counts/action items should eventually reflect the new state.
- Real-time/broadcast update is optional unless the Dashboard implementation requires it.

### Manage User Accounts handoff

- Once approved, future account status administration belongs to Manage User Accounts.
- Rejected applications remain registration-history records according to retention policy.
- Do not use registration `REJECTED` as a substitute for later account suspension/deactivation.
- Exact cleanup/retention of rejected applications is an Open Question.

### Frontend states

- Queue:
  - loading
  - empty
  - loaded
  - error
  - forbidden
- Detail:
  - loading
  - loaded
  - document loading/error
  - already decided/stale
  - error
- Decision:
  - confirmation
  - submitting
  - success
  - validation failure
  - stale/conflict
  - server failure
- Disable duplicate decision submission while pending.
- Do not optimistically show final approval/rejection before Laravel confirms the transition.
- On `409`, refresh the application to show the actual current decision.

### Accessibility

- Queue/detail pages must support keyboard navigation.
- Decision controls require clear accessible names.
- Status must not rely on color alone.
- Approval/rejection confirmations must state the applicant and action.
- Validation and conflict errors must be announced/accessibly associated.
- Private document previews must provide appropriate fallback/download behavior where needed.

### Acceptance criteria

- [ ] Guest cannot access registration review.
- [ ] Non-Admin cannot access Admin registration-review APIs.
- [ ] Custom Admin permission is enforced.
- [ ] Admin can view paginated registration applications.
- [ ] Pending applications can be filtered.
- [ ] Application detail exposes only required review information.
- [ ] Private documents require authorized access.
- [ ] Browser cannot select the applicant role or decision actor.
- [ ] Only `PENDING → APPROVED` succeeds for approval.
- [ ] Only `PENDING → REJECTED` succeeds for rejection.
- [ ] Arbitrary status assignment is rejected.
- [ ] Two concurrent Admin decisions cannot overwrite each other.
- [ ] Approval records Admin and decision timestamp.
- [ ] Rejection records Admin and decision timestamp.
- [ ] Approval/rejection is auditable.
- [ ] Applicant notification is queued after commit.
- [ ] Notification failure does not reverse the decision.
- [ ] Duplicate submission does not duplicate decision side effects.
- [ ] Rejected/pending account cannot bypass approval-gated access.
- [ ] Approved account hands off to normal account/auth management.
- [ ] Dashboard pending count can update from authoritative registration state.
- [ ] UI handles empty, validation, stale/conflict, forbidden, and server-error states.

## HOW

### Project findings

- `Admin.md` defines Manage Account Registrations as review + approve/disapprove of submitted registrations.
- It explicitly defines a status state machine such as `PENDING`, `APPROVED`, `REJECTED`.
- It explicitly requires corresponding applicant notification emails after state changes. fileciteturn8file0
- Admin Authentication excludes public account approval and establishes that non-Admin account creation uses registration/approval flows. fileciteturn8file1
- `README.md` requires Laravel-owned authorization/validation, transactional mutations, audit/event trails, after-commit notifications, private file handling, pagination, and idempotency. fileciteturn8file13
- Exact registration forms, role-specific application fields, document checklist, Eloquent models, and storage driver were not available in the researched sources.

### Laravel data model

- Reuse the existing registration/account schema when it can represent:
  - applicant role/account
  - review status
  - submitted application data
  - asset/document references
  - decision metadata
- Do not create a second duplicate application model without repository evidence.
- If registration status currently lives on the shared user record, enforce transitions through a domain action rather than generic profile update.
- If dedicated application records exist, preserve that separation.

### Laravel API

Conceptual endpoints:

```http
GET  /api/admin/account-registrations
GET  /api/admin/account-registrations/{application}
POST /api/admin/account-registrations/{application}/approve
POST /api/admin/account-registrations/{application}/reject
```

- Follow repository version/resource conventions.
- Use Form Requests where decision input exists.
- Use a Policy/Gate for view/approve/reject.
- Suggested actions:
  - `ApproveAccountRegistration`
  - `RejectAccountRegistration`
- Keep controllers thin.
- Use an API Resource for safe list/detail DTOs.

### Transition implementation

- Wrap each decision in `DB::transaction`.
- Re-read/lock the application row or use an atomic conditional update.
- Confirm status is still `PENDING` inside the transaction.
- Update decision state and metadata once.
- Create required audit/event data in the same transaction when the audit design requires atomicity.
- Laravel provides `lockForUpdate()` for pessimistic row locking; use it only where it fits the repository/database.
- Return `409` when another Admin already decided the application.

### Notification implementation

- Create separate approval/rejection notification classes or a clear status-aware notification.
- Use Laravel Notifications with the mail channel.
- Queue notification delivery where configured.
- Use `afterCommit()` / queue `after_commit` behavior so mail cannot run against an uncommitted decision.
- Notification job receives/reference persisted IDs rather than repeating decision logic.
- Retry mail delivery independently from the account transition.

### File access

- Reuse asset references created by registration.
- Validate Admin permission before generating access.
- Use private storage.
- Laravel filesystem supports temporary URLs when the configured disk supports them.
- Never expose raw application-server paths.
- Do not move/copy applicant documents just for Admin review unless storage lifecycle requires it.

### Next.js / React

- Build:
  - registration queue/table
  - filter controls
  - application detail
  - document viewer/link
  - approve confirmation
  - reject confirmation/reason input when required
- Use shared API client.
- Fetch detail from Laravel; do not place full application payload in list navigation state.
- After decision:
  - show confirmed result
  - invalidate/refetch queue
  - refresh Dashboard pending-registration summary when integrated
- On `409`, refetch detail and show who/current status if API safely provides that information.

### Tests

- **Laravel:**
  - guest/non-Admin/permission denial
  - pagination/filtering
  - safe list/detail DTO
  - authorized private document access
  - unauthorized document access
  - approve pending
  - reject pending
  - reject invalid status transition
  - concurrent approve/approve
  - concurrent approve/reject
  - decision metadata
  - audit record
  - notification queued after commit
  - notification failure does not rollback
  - duplicate/idempotent decision behavior
  - pending/rejected access remains blocked by role auth
- **Frontend:**
  - queue loading/empty/error
  - filters
  - detail rendering
  - document access/error
  - approve/reject confirmation
  - validation
  - duplicate-submit disabled
  - conflict refresh
  - success feedback
  - forbidden state
  - accessibility

### Research-backed recommendations

- Model approval/rejection as explicit domain transitions rather than arbitrary status updates.
- Protect decisions against concurrent Admin reviews using transactional locking/conditional state checks. Laravel supports transaction-wrapped `lockForUpdate()` patterns. citeturn490925search0
- Queue applicant email notifications only after commit; Laravel documents `afterCommit()` for queued notifications triggered from transactions. citeturn519069search0
- Keep submitted credentials private and expose them through authorized temporary URLs where supported. citeturn854496search1
- Use Policies/Gates for model/resource authorization rather than relying on page visibility. citeturn854496search0
- Apply Laravel file validation during the originating upload flow for allowed types/sizes. citeturn519069search2

### Risks

- **Race decisions:** two Admins may approve/reject the same application concurrently.
- **PII leakage:** applicant credentials/documents are sensitive.
- **State bypass:** generic status-update endpoints can bypass transition rules.
- **Notification coupling:** synchronous email failure can incorrectly make a valid decision appear failed.
- **Role confusion:** changing applicant role during review can approve the wrong role-account.
- **Workflow overlap:** later suspension should not reuse registration rejection.
- **Invented requirements:** role-specific documents cannot be finalized without the actual registration specs.
- **Stale UI:** Admin may review an application already decided in another tab/session.

### Open questions

- Which roles use this Admin approval queue in the final implementation.
- Exact role-specific registration fields/documents.
- Whether rejection reason is mandatory.
- Applicant-visible vs internal rejection reason.
- Whether rejected users may edit/resubmit.
- Whether Admin can reopen/reverse a decision.
- Rejected application/document retention duration.
- Whether approval email also creates an in-app notification.
- Exact email templates/branding.
- Whether approval immediately enables login or another verification step exists.
- Whether application review should track `review_started_at`.
- Whether multiple Admins may claim/assign applications.
- Whether Dashboard updates via broadcast or normal refetch.
- Exact storage disk and temporary-URL lifetime.

### Sources

- Project feature-spec rules: `SKILL.md`
- AISLEY architecture/system-flow contract: `README.md`
- Admin feature model: `Admin.md`
- Admin Authentication source/spec
- Laravel Authorization: https://laravel.com/docs/12.x/authorization
- Laravel Query Builder / transaction locking: https://laravel.com/docs/13.x/queries
- Laravel Notifications: https://laravel.com/docs/12.x/notifications
- Laravel Queues / transaction behavior: https://laravel.com/docs/12.x/queues
- Laravel File Validation API: https://api.laravel.com/docs/12.x/Illuminate/Validation/Rules/File.html
- Laravel Filesystem temporary URLs: https://api.laravel.com/docs/12.x/Illuminate/Filesystem/FilesystemAdapter.html
