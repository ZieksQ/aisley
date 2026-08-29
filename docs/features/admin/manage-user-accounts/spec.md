---
feature: manage-user-accounts
title: Admin Manage User Accounts
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Admin
scope: Admin Web Application
---

# Admin Manage User Accounts

## WHAT

- **Purpose:** Let authorized Admins search, inspect, and manage existing AISLEY user accounts and their account lifecycle/status.
- **Primary actor:** Authenticated `ADMIN`.
- **Managed account roles:** Buyer, Seller, Courier, Logistics, and any other non-Admin account types supported by the shared user model.
- **Admin-account management:** managing other Admin accounts is not assumed by this spec unless the permission model explicitly allows it.
- **Source-defined capabilities:**
  - view user profiles
  - review user history
  - search/filter users
  - update account status
  - suspend accounts
  - restore/reactivate accounts
  - deactivate/delete accounts as allowed by platform policy
  - expose user metadata without leaking restricted PII
- **Source ambiguity:** `Admin.md` describes full CRUD, but account creation is also covered by registration/approval flows.
  - Existing-account read/update/status management is required.
  - Admin-created end-user accounts are an Open Question.
  - Do not create a second registration path unless the project explicitly requires it.
- **Architecture:**
  - Next.js/React owns user list/detail pages, filters, status controls, confirmation dialogs, and UI feedback.
  - Laravel owns authentication, authorization, scoped queries, validation, lifecycle transitions, persistence, audit records, and access enforcement.
  - Laravel/database state is authoritative.
- **Feature boundaries:**
  - Manage Account Registrations owns `PENDING → APPROVED/REJECTED`.
  - Manage User Accounts owns lifecycle management after an account exists/has entered normal account administration.
  - Admin Account Management owns the current Admin's own profile/security settings.
  - Seller Compliance owns seller/product policy violations and may request a seller-account restriction through this feature where appropriate.
  - Global Ban owns security blocklist entries; a normal suspension/deactivation is not automatically a global ban.
- **Recommended routes:**

```text
/users
/users/{user}
```

- **Non-goals:**
  - public registration
  - registration approval/rejection
  - arbitrary Admin self-service changes
  - global IP/payment blocking
  - product moderation
  - complaint adjudication
  - password disclosure/resetting without a separate recovery/admin-reset requirement
  - hard deletion of transactional history

## MUST

### Access control
- Every endpoint requires:
  - authenticated session
  - persisted role = `ADMIN`
  - Manage User Accounts permission where custom Admin permissions exist
- Laravel authorization is authoritative.
- Frontend-hidden buttons are not authorization.
- Direct API calls cannot bypass permission checks.
- Use project-standard:
  - `401` unauthenticated
  - `403` forbidden
  - `404` scoped user not found
  - `422` validation error
  - `409` invalid/stale lifecycle transition

### User list
- Admin must be able to list user accounts.
- List must be paginated.
- Recommended allow-listed filters:
  - role
  - account status
  - created/joined date
- Recommended search fields where allowed by privacy policy:
  - account ID
  - name
  - email
- Search/filter input must be validated.
- Do not allow arbitrary client-provided column names for sort/filter.
- List DTO should contain only fields needed for administration, such as:
  - ID
  - display name
  - role
  - masked/safe contact identity
  - account status
  - created timestamp
  - last relevant account-status update when available
- Do not return sensitive documents, password hashes, payment data, private messages, or unrelated profile fields in list responses.

### User detail
- Admin must be able to view an authorized account profile.
- Detail may include:
  - account identity/profile information required for administration
  - persisted role
  - current account status
  - registration/approval summary where relevant
  - safe status/history timeline
  - role-specific summary data needed for administration
- Exact profile fields depend on the real shared/role-specific schema.
- Do not invent additional user fields.
- Sensitive PII must be masked or omitted unless it is necessary and authorized for the Admin task.
- Private uploaded identity/business/vehicle documents belong to their owning registration/compliance feature and should be linked through authorized access, not indiscriminately embedded here.

### Role-aware identity
- AISLEY uses role-aware account identity equivalent to:

```text
unique(email, role)
```

- Account actions target immutable account/user IDs.
- Do not suspend/deactivate every account sharing an email.
- Displayed role comes from persisted server data.
- The Admin client cannot change role merely by submitting a `role` field.
- Role conversion is not part of this feature unless separately specified.

### Account status model
- Account status must use an allow-listed server-controlled state model.
- Source explicitly supports:
  - active/usable account
  - temporarily suspended account
  - restored/reactivated account
  - deactivated account
- Exact enum names are repository-defined.
- Recommended conceptual states:

```text
ACTIVE
SUSPENDED
DEACTIVATED
```

- Registration states such as `PENDING`, `APPROVED`, `REJECTED` belong to Manage Account Registrations and must not be conflated with lifecycle status unless the real schema intentionally combines them.
- The client must not submit arbitrary status strings for direct assignment.

### Suspend account
- Suspension is a temporary access restriction.
- Suspension must:
  - authorize the acting Admin
  - verify the current account can be suspended
  - require a reason or reason code when platform policy requires it
  - transition status atomically
  - record acting Admin and timestamp
  - record audit history
- A suspended account must be denied protected application actions according to shared account-status enforcement.
- Exact capabilities still available while suspended are Open Questions, such as:
  - logout
  - support/chat
  - appeals
  - order history
  - refund/return flows
  - completion of already-running delivery obligations

### Restore/reactivate account
- Admin must be able to restore an eligible suspended account.
- Restoration must:
  - authorize Admin
  - validate current status
  - record actor/timestamp
  - preserve prior suspension history
- Restoring a user from ordinary suspension does not automatically remove an independent Global Ban entry.
- Restoration must not overwrite unresolved compliance/security restrictions owned by other features.

### Deactivate account
- Deactivation is the normal non-destructive removal/disable action unless project policy explicitly requires hard deletion.
- Deactivation must:
  - authorize Admin
  - validate current status
  - require confirmation
  - preserve historical relationships needed for orders, payments, disputes, deliveries, reviews, and auditability
  - record actor/timestamp/reason as required
- A deactivated account must not retain normal protected access.
- Whether deactivation is reversible is an Open Question.
- Prefer status-based deactivation or soft deletion over destructive deletion when records are referenced by historical transactions.
- Hard delete must not be exposed merely because the source says CRUD.
- Permanent deletion requires a separately defined retention/privacy workflow.

### Create/update boundary
- `Admin.md` mentions CRUD, but existing registration/approval workflows already own normal account creation.
- MVP must support profile viewing and lifecycle status changes.
- General Admin creation of Buyer/Seller/Courier/Logistics accounts is not required without explicit project confirmation.
- If Admin-created accounts are later required:
  - use a dedicated creation workflow
  - validate role-specific required data
  - do not bypass registration/verification requirements silently
- Profile editing by Admin is allowed only for fields explicitly designated as Admin-editable.
- Do not expose a generic mass-assignment endpoint for all user columns.

### Account history
- Admin must be able to review relevant account history.
- At minimum, preserve lifecycle actions:
  - suspension
  - restoration
  - deactivation
  - other approved status transitions
- History should record:
  - action
  - previous/new status
  - acting Admin
  - timestamp
  - safe reason metadata
- Related complaint/compliance/ban events may be referenced by ID instead of copying their full contents.
- Do not use mutable `updated_at` as the only account history.

### Cross-feature actions
- Other features may request account lifecycle changes, but this feature's state rules must still apply.
- Examples:
  - Seller Compliance may suspend a seller account.
  - Complaints/Disputes may result in an account-level action.
  - Global Ban may independently block an account.
- Cross-feature callers should use the same centralized account-status action/service.
- Do not let another feature directly assign status fields and bypass validation/audit rules.
- Preserve source context/reference when a lifecycle action originates from another feature.

### Global Ban boundary
- Ordinary `SUSPENDED`/`DEACTIVATED` status and Global Ban are distinct security concepts unless the project explicitly merges them.
- A Global Ban may deny access even if account status is otherwise active.
- Removing a Global Ban must not silently reactivate an independently suspended/deactivated account.
- Suspending an account must not silently create IP/payment blocklist entries.

### Authentication/session enforcement
- Account lifecycle status must be enforced by backend authentication/authorization flows.
- A user whose account becomes suspended/deactivated must not continue normal protected activity indefinitely because an old session/token remains valid.
- Exact revocation behavior depends on each role's configured authentication mechanism.
- Implementation must define how existing sessions/tokens are invalidated or how every protected request re-checks account status.
- Do not rely on frontend logout alone.
- Whether all existing sessions/tokens are immediately revoked on suspension/deactivation is an Open Question, but access denial must become effective promptly.

### Concurrency
- Two Admins may modify the same account simultaneously.
- Lifecycle transitions must be concurrency-safe.
- Re-read current state inside the mutation transaction or use atomic/versioned updates.
- If the account changed since the UI loaded:
  - do not overwrite the newer state
  - return `409`
  - refetch current account state
- Duplicate requests must not create duplicate audit/history side effects.

### PII and serialization
- Expose only fields required for the Admin task.
- Never return:
  - password hashes
  - session/token values
  - 2FA/recovery secrets
  - full payment credentials
  - unrelated private messages
- Laravel Resources/serializers must explicitly shape safe user DTOs.
- Model `$hidden` configuration is defense-in-depth, not a replacement for purpose-built Admin resources.
- Sensitive contact/location/document fields follow project masking/access rules.

### Notifications
- Whether users are notified about suspension, restoration, or deactivation is not explicitly defined in `Admin.md`.
- Notification behavior is therefore an Open Question.
- If enabled:
  - dispatch after the lifecycle transaction commits
  - do not roll back status changes because notification delivery fails
  - expose only applicant/user-safe reasons
  - keep internal moderation/security notes private

### Audit trail
- Every Admin lifecycle mutation must be auditable.
- Safe audit metadata:
  - Admin ID
  - target user ID
  - role
  - action
  - previous/new status
  - safe reason/reference
  - timestamp
- Do not place secrets or excessive PII in audit records.
- Read-only profile views need not create immutable audit entries unless the privacy/security policy requires access logging.

### Frontend states
- User list:
  - loading
  - empty
  - loaded
  - error
  - forbidden
- User detail:
  - loading
  - loaded
  - stale/conflict
  - error
- Lifecycle action:
  - confirmation
  - validation error
  - submitting
  - success
  - conflict
  - failure
- Disable duplicate lifecycle submissions.
- Do not optimistically show a final status before Laravel confirms it.
- On `409`, refetch and display current status.

### Accessibility
- Search/filter/list/detail/status controls require semantic labels and keyboard access.
- Account status must not rely on color alone.
- Confirmation dialogs must identify the user/account and action.
- Validation/conflict messages must be accessible.

### Acceptance criteria
- [ ] Guest cannot access Manage User Accounts.
- [ ] Non-Admin cannot access Admin user-management APIs.
- [ ] Custom Admin permission is enforced.
- [ ] User list is paginated and supports allow-listed search/filtering.
- [ ] List/detail DTOs omit restricted secrets and unnecessary PII.
- [ ] Account actions target immutable user/account ID.
- [ ] Same-email accounts under another role are not modified accidentally.
- [ ] Client cannot arbitrarily change role or account status.
- [ ] Eligible active account can be suspended.
- [ ] Eligible suspended account can be restored.
- [ ] Eligible account can be deactivated without destroying required history.
- [ ] Invalid/stale transitions return conflict instead of overwriting state.
- [ ] Lifecycle actions preserve actor, timestamp, and history.
- [ ] Lifecycle actions are audited.
- [ ] Existing authenticated access is denied promptly after suspension/deactivation.
- [ ] Global Ban remains independent from normal lifecycle state.
- [ ] Cross-feature account actions use the same lifecycle rules.
- [ ] Hard delete is not exposed without explicit retention/privacy requirements.
- [ ] UI handles loading, empty, forbidden, conflict, validation, success, and failure states.

## HOW

### Project findings
- `Admin.md` defines Manage User Accounts as viewing user profiles/history and updating account status, including suspension and restoration; it also describes full CRUD and requires robust search/filtering plus safe PII exposure. fileciteturn12file0
- Manage Account Registrations separately owns initial approval/rejection, so ordinary account creation/approval should not be duplicated here.
- Admin Account Management separately owns the current Admin's own profile/security settings. fileciteturn12file1
- Global Ban is a separate security/blocklist concept. fileciteturn12file1
- `README.md` requires Laravel-owned authorization, resource scoping, validated state transitions, transactions, audit history, pagination, and safe serialization. fileciteturn12file15
- Exact user schema, lifecycle enum, role-specific profile fields, session/token revocation strategy, and notification policy were not available.

### Laravel data model
- Reuse the shared user/account model.
- Preserve role-aware identity:

```text
unique(email, role)
```

- Prefer explicit lifecycle fields/concepts such as:

```text
account_status
status_reason nullable
status_changed_at
status_changed_by_admin_id nullable
```

- Maintain durable lifecycle history separately if the main row stores only current state.
- If the existing model uses Laravel `SoftDeletes`, soft-deletion/restoration can support deactivation semantics, but do not adopt it automatically if `DEACTIVATED` is already a domain status.
- Laravel's `SoftDeletes` supports soft-delete and restore operations. citeturn496366search0

### Laravel API
Conceptual endpoints:

```http
GET  /api/admin/users
GET  /api/admin/users/{user}
POST /api/admin/users/{user}/suspend
POST /api/admin/users/{user}/restore
POST /api/admin/users/{user}/deactivate
```

- Add profile-update endpoint only for explicitly Admin-editable fields.
- Do not expose a generic `PATCH user {status, role, ...}` endpoint for lifecycle transitions.
- Use:
  - Form Requests
  - `UserPolicy`/Gates
  - API Resources
  - dedicated domain actions
- Suggested actions:
  - `SuspendUserAccount`
  - `RestoreUserAccount`
  - `DeactivateUserAccount`
- Laravel policies are intended for authorization against specific models/resources. citeturn926517search8

### Querying
- Build one scoped user-query service/action with allow-listed filters and sort fields.
- Use database pagination rather than returning all users.
- For large/high-churn lists, cursor pagination may be considered when ordering guarantees fit the UI; Laravel provides cursor paginator primitives. citeturn496366search1turn496366search2
- Index common search/filter columns supported by the real schema.
- Avoid eager-loading large histories on the list endpoint.
- Fetch detailed history only on user detail or a separate paginated history endpoint.

### Lifecycle mutation
- Wrap state transition + history/audit updates in a database transaction.
- Verify current status inside the transaction.
- Use row locking/atomic conditional update where concurrent Admin changes are realistic.
- Publish events/notifications only after commit.
- Laravel queue guidance warns that jobs dispatched inside transactions may execute before commit unless after-commit behavior is configured. citeturn496366search3

### Status enforcement
- Centralize an `AccountStatus` policy/service/middleware used by protected role APIs.
- Suspension/deactivation must affect backend access, not just frontend navigation.
- Integrate with the authentication mechanisms actually used by each AISLEY app:
  - session-cookie web roles
  - token-based mobile roles where configured
- Determine whether to revoke existing sessions/tokens immediately or deny them on subsequent authorization checks.
- Preserve support/recovery exceptions defined by product policy.

### Safe serialization
- Use dedicated Admin list/detail Resources.
- Return only necessary profile fields.
- Laravel supports hiding model attributes such as passwords from JSON serialization, but Resources should still define purpose-specific Admin DTOs. citeturn926517search6
- Never return auth secrets or raw sensitive evidence.

### Next.js / React
- Build:
  - user table/list
  - search/filter controls
  - user detail
  - lifecycle history
  - suspend/restore/deactivate confirmations
- Use shared API client.
- Keep list and detail payloads separate.
- Refresh user and list state after mutations.
- On `409`, refetch current user status.
- Do not duplicate Laravel transition rules in React.

### Tests
- **Laravel:** guest/non-Admin/permission denial; pagination/filter validation; role-aware lookup; safe DTOs; suspend/restore/deactivate; invalid/concurrent transitions; audit/history; cross-feature service reuse; Global Ban independence; session/token denial; hard-delete protection.
- **Frontend:** list/search/filter/detail/history; lifecycle confirmations; duplicate-submit protection; validation/conflict/forbidden states; refreshed status; accessibility.

### Research-backed recommendations
- Use Laravel Policies for resource authorization. citeturn926517search8
- Use allow-listed/enum-backed lifecycle values; Laravel supports enum validation. citeturn926517search7
- Prefer reversible deactivation/soft deletion where history must remain intact. citeturn496366search0
- Paginate user collections and load detailed history separately. citeturn496366search1turn496366search2
- Dispatch side effects after commit. citeturn496366search3

### Risks
- **Registration duplication:** CRUD create could create a second onboarding path.
- **PII leakage:** broad DTOs can expose sensitive user data.
- **Role corruption:** generic updates could accidentally change role.
- **Historical loss:** hard deletion can break transactional/audit references.
- **Session bypass:** suspended users may retain access if status is checked only at login.
- **Feature collision:** suspension, compliance, and Global Ban can conflict without centralized lifecycle rules.
- **Concurrency:** stale Admin actions may overwrite newer state.
- **Overbroad Admin control:** managing other Admins needs explicit permission rules.

### Open questions
- Lifecycle enum and whether registration `APPROVED` is separate from `ACTIVE`.
- Which roles are manageable, including whether Admins may manage other Admins.
- Whether Admin-created end-user accounts are required.
- Admin-editable profile fields.
- Suspension/deactivation reason and user-visible messaging.
- What suspended users may still access.
- Deactivation reversibility and permanent-erasure workflow.
- Session/token invalidation and status-change notification policy.
- SoftDeletes vs explicit deactivation status.
- User-history retention plus search/default sorting.

### Sources
- Project feature-spec rules: `SKILL.md`
- AISLEY architecture/system-flow contract: `README.md`
- Admin feature model: `Admin.md`
- Admin Authentication source/spec
- Laravel Authorization: https://laravel.com/docs/12.x/authorization
- Laravel Eloquent SoftDeletes API: https://api.laravel.com/docs/12.x/Illuminate/Database/Eloquent/SoftDeletes.html
- Laravel Validation: https://laravel.com/docs/11.x/validation
- Laravel Pagination APIs: https://api.laravel.com/docs/12.x/Illuminate/Pagination/CursorPaginator.html
- Laravel Queues / database transactions: https://laravel.com/docs/12.x/queues
- Laravel Eloquent Serialization: https://laravel.com/docs/12.x/eloquent-serialization
