---
feature: manage-platform-settings
title: Admin Manage Platform Settings
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Admin
scope: Admin Web Application
---

# Admin Manage Platform Settings

## WHAT
- **Purpose:** Let authorized Admins manage platform-wide announcements and platform policy content used across AISLEY.
- **Primary actor:** Authenticated `ADMIN`.
- **Source-defined capabilities:**
  - post platform announcements
  - add/update platform policies
  - manage Terms of Service, Privacy Policy, and internal platform rules
  - surface announcements in user dashboard/feed experiences
  - optionally require active users to re-consent after material policy updates
- **Architecture:**
  - Next.js/React owns settings pages, announcement/policy editors, preview, validation feedback, publishing controls, and history presentation.
  - Laravel owns authentication, authorization, validation, versioning, publishing state, persistence, re-consent decisions, events, cache invalidation, and audit records.
  - Laravel/database state is authoritative.
- **Feature areas:**
```text
Manage Platform Settings
├── Announcements
└── Policies
    ├── Terms of Service
    ├── Privacy Policy
    └── Internal Platform Rules
```
- **Recommended Admin routes:**
```text
/platform-settings/announcements
/platform-settings/policies
/platform-settings/policies/{policy}
```
or repository-equivalent routes.
- **Feature boundary:**
  - Dashboard/user feeds consume published announcements.
  - Push Notification Management owns targeted push/SMS campaigns; posting an announcement does not automatically mean sending a push/SMS blast.
  - Authentication may enforce required policy re-consent at login/session entry when a published policy version requires it.
  - System Audit Logs records Admin configuration mutations.
- **Non-goals:**
  - arbitrary runtime editing of `.env`, secrets, database credentials, mail settings, payment keys, or infrastructure configuration
  - feature flags unless separately specified
  - targeted marketing campaigns
  - legal interpretation of policy wording
  - automatic generation of policies
  - forcing re-consent for every typo/edit
  - editing source-code configuration from the Admin UI

## MUST

### Access control
- Every Platform Settings endpoint requires:
  - authenticated session
  - persisted role = `ADMIN`
  - Manage Platform Settings permission when custom Admin permissions exist
- Laravel authorization is authoritative.
- Frontend visibility is not authorization.
- Direct API calls cannot bypass permission checks.
- Use project-standard responses:
  - `401` unauthenticated
  - `403` forbidden
  - `404` setting/resource not found
  - `422` validation failure
  - `409` stale/conflicting publish/update state when applicable

### Settings scope
- Admin-editable settings are allow-listed domain records.
- Do not expose a generic key/value editor that can modify arbitrary server configuration.
- Secrets and deployment configuration must never be editable through this feature.
- New setting categories require explicit schema/domain support.

### Announcements
- Admin must be able to:
  - create an announcement
  - edit a non-final/draft announcement when draft behavior is supported
  - publish an announcement
  - view announcement history
  - retire/unpublish an announcement when policy allows
- Minimum announcement data:
  - immutable server ID
  - title
  - body/content
  - status
  - creating/updating Admin metadata
  - created/updated timestamps
- Recommended optional fields:
  - publish timestamp
  - expiration timestamp
  - audience/scope when explicitly defined
- Exact announcement status names are not source-defined.
- Recommended lifecycle:
```text
DRAFT → PUBLISHED → ARCHIVED
```
- If drafts are not needed for MVP, direct publish is acceptable.
- The client must not assign arbitrary status values.

### Announcement visibility
- Only published, currently active announcements may appear in user-facing feeds.
- Draft/archived announcements must not appear to normal users.
- If expiration exists, expired announcements must stop appearing without destructive deletion.
- User-facing announcement queries must return only safe published content.
- Announcement visibility must be determined by Laravel, not by hiding drafts in React.
- Exact role/audience targeting is an Open Question.
- Unless targeting is explicitly defined, treat announcements as platform-wide.

### Announcement integration
- Published announcements should integrate with user dashboard/feed surfaces as the Admin source requires.
- Do not create duplicate copies per user unless the notification architecture specifically needs them.
- Prefer one announcement record plus read/dismiss state only if those behaviors are required.
- Announcement publication may emit an event/broadcast after commit so connected clients can refresh.
- Push/SMS/email fan-out is not implied by ordinary announcement publication.

### Announcement content
- Validate title/body server-side.
- Define maximum lengths.
- Treat content as untrusted input.
- If rich text/HTML is supported:
  - sanitize with an approved server-side strategy
  - allow-list supported formatting
  - block executable/script content
- Plain text/Markdown is preferable if the project has no approved rich-text sanitizer.
- Exact editor/format is an Open Question.

### Policies
- Admin must be able to manage supported platform policy types.
- Source-supported examples:
  - Terms of Service
  - Privacy Policy
  - internal platform rules
- Policy types must be allow-listed.
- Do not let the browser invent arbitrary privileged system-setting types.
- Each published policy must have a stable policy identity/type plus a version/revision record.

### Policy versioning
- Do not overwrite the only copy of an already-published policy.
- Preserve policy history.
- Recommended model:
```text
policy
→ version 1
→ version 2
→ version 3 (current)
```
- A new material update creates a new policy version.
- Minimum policy-version data:
  - immutable ID
  - policy type
  - version/revision identifier
  - title
  - content
  - status
  - author/publishing Admin
  - created timestamp
  - published timestamp
  - `requires_reconsent` or equivalent decision
- Exact version numbering format is an Open Question.
- Published historical versions remain read-only through normal editing.
- Corrections after publication should create a new version rather than silently rewriting history.

### Policy publishing
- Publishing must be an explicit server-side transition.
- Recommended lifecycle:
```text
DRAFT → PUBLISHED → SUPERSEDED
```
- Only one current published version per policy type should be effective at a time unless the product explicitly supports multiple concurrent policies.
- Publishing a new version must atomically:
  - verify authorization
  - validate draft/version state
  - mark the new version current/published
  - supersede the prior current version when one exists
  - persist the re-consent requirement decision
  - record audit/history
- Concurrent publish attempts must not produce two unintended current versions.
- Use transaction + locking/unique constraint/atomic check as appropriate.

### Policy re-consent
- `Admin.md` says policy updates **might** require a `requires re-consent` flag for active users.
- Therefore re-consent must be an explicit property of the published version, not automatic for every edit.
- When `requires_reconsent = true`:
  - affected active users must be identifiable as not yet accepting the new version
  - the relevant app/auth flow must require acceptance according to the chosen enforcement policy
  - acceptance must record the exact policy version
- Do not represent consent as a single boolean detached from policy version.
- Recommended acceptance record:
```text
user_id
policy_version_id
accepted_at
```
- If multiple policy types require consent, track acceptance independently per policy/version.
- Do not silently mark users as accepted.
- Exact enforcement point is an Open Question:
  - at next login
  - before accessing protected application features
  - via blocking consent screen after session restoration

### Re-consent fan-out
- Publishing a policy version requiring re-consent must not synchronously update every active user row during the request.
- Prefer version-based comparison:
  - current required version
  - latest accepted version per user
- This avoids massive write fan-out when policy versions change.
- If the existing account schema already uses a re-consent flag, preserve repository conventions unless they create correctness/performance problems.
- Any queued notification announcing the change must run after publish commit.

### Policy acceptance boundary
- Platform Settings owns:
  - policy content
  - version
  - whether re-consent is required
- User-facing apps/auth flows own:
  - presenting the policy
  - collecting explicit acceptance
  - blocking/allowing access according to the chosen policy
- The Admin UI must not fabricate acceptance on behalf of users.
- Whether Admin accounts themselves must re-consent is an Open Question.

### Read APIs for users
- User-facing applications need a safe way to retrieve:
  - current published announcements
  - current published policy content
  - outstanding required-consent versions when applicable
- These endpoints must never expose drafts, internal notes, or Admin-only metadata.
- Public-vs-authenticated visibility for Terms/Privacy is an Open Question; many systems expose current legal policies publicly, but the source does not require it.

### Caching
- Published announcements/policies are strong cache candidates because reads may greatly exceed writes.
- Cache is an optimization; database state is authoritative.
- Publish/archive/supersede operations must invalidate affected cache keys after commit.
- Do not cache drafts into user-facing keys.
- Laravel cache may be used with the configured backend.
- Exact TTL is an implementation choice based on freshness requirements.
- HTTP cache headers/ETags may be used for public policy pages when their visibility model permits it.

### Notifications
- Announcement publication may update user dashboards through the shared notification/feed/broadcast architecture.
- Policy publication may notify affected users when product policy requires it.
- Push Notification Management remains the feature for targeted push/SMS blasts.
- Do not automatically turn every announcement into SMS/push.
- Queue notification/broadcast work after commit.
- Notification failure must not roll back a published announcement/policy.

### Audit trail
- Platform-setting mutations are administrative actions and must be auditable.
- Record safe metadata:
  - Admin ID
  - action
  - resource type
  - resource/version ID
  - previous/new status
  - timestamp
- Policy history itself preserves content revisions.
- Audit log should not need to duplicate entire policy/announcement bodies unless policy requires snapshots there.
- Draft/publish/archive/supersede/re-consent-setting changes should be attributable to an Admin.

### Concurrency
- Multiple Admins may edit/publish settings concurrently.
- Publishing a policy/announcement must detect stale state.
- A stale publish must not overwrite a newer publication.
- Use:
  - transactions
  - row locks
  - version fields
  - conditional updates
  - unique current-version constraints
  as appropriate.
- Return `409` for stale/conflicting publish attempts.

### Frontend states
- Announcements:
  - list loading/empty/error
  - editor validation
  - draft/publish/archive confirmation
  - submitting/success/conflict/failure
- Policies:
  - policy-type list
  - current version
  - version history
  - draft editor
  - publish confirmation
  - re-consent decision
  - validation/conflict/success/failure
- Do not optimistically display content as published before Laravel confirms it.
- On `409`, refetch current publication state.

### Accessibility
- Editors/forms require semantic labels and keyboard navigation.
- Publish/archive status must not rely on color alone.
- Re-consent choice must have explicit explanatory text.
- Validation and conflict messages must be programmatically associated.
- Policy/announcement preview should remain readable without relying solely on visual formatting.

### Acceptance criteria
- [ ] Guest cannot access Platform Settings Admin APIs.
- [ ] Non-Admin cannot manage Platform Settings.
- [ ] Custom Admin permission is enforced server-side.
- [ ] Admin can create and publish a valid announcement.
- [ ] Draft/archived announcements do not appear in user feeds.
- [ ] Published active announcement can appear in the configured user feed.
- [ ] Announcement content is server-validated and safely rendered.
- [ ] Admin can create a new version of a supported policy.
- [ ] Published policy versions are preserved historically.
- [ ] Publishing a new policy does not silently overwrite old content.
- [ ] Only one intended current version per policy type is effective.
- [ ] Concurrent publish cannot create conflicting current versions.
- [ ] Re-consent is explicit per policy version.
- [ ] User acceptance, when required, references the exact policy version.
- [ ] Users are never silently marked as having accepted a new version.
- [ ] Publishing does not require synchronous per-user row updates when version comparison can enforce consent.
- [ ] Cache is invalidated after publication/status changes.
- [ ] Notification/broadcast failure does not roll back publication.
- [ ] Draft/internal metadata is absent from user-facing DTOs.
- [ ] Platform-setting mutations are auditable.
- [ ] Admin UI cannot edit `.env`, secrets, or arbitrary server configuration.
- [ ] UI handles validation, forbidden, conflict, success, and failure states.

## HOW

### Project findings
- `Admin.md` defines Platform Settings as announcement publishing plus adding/updating platform policies such as Terms of Service, Privacy Policy, and internal rules. fileciteturn11file0
- It says announcements should integrate with user dashboard feeds and policy updates may require a re-consent flag on next login. fileciteturn11file0
- Admin Authentication requires Platform Settings to remain behind authenticated Admin access and custom permissions. fileciteturn11file1
- `README.md` requires Laravel-owned authorization/validation, transactional mutations, after-commit notifications/events, audit history, and shared frontend API access. fileciteturn11file15L1-L26
- Exact policy schema, announcement audience rules, user consent flow, notification model, and rich-text/editor choice are not defined by available project sources.

### Laravel data model
Recommended conceptual schema:
```text
announcements
- id
- title
- body
- status
- published_at nullable
- expires_at nullable
- created_by_admin_id
- updated_by_admin_id
- created_at
- updated_at

policies
- id
- type
- current_version_id nullable

policy_versions
- id
- policy_id
- version
- title
- content
- status
- requires_reconsent
- created_by_admin_id
- published_by_admin_id nullable
- published_at nullable
- created_at

policy_acceptances
- id
- user_id
- policy_version_id
- accepted_at
```
- Use real repository names/types.
- Keep historical published policy versions immutable.
- Add uniqueness/indexes for policy type/current version and user+policy-version acceptance.

### Laravel API
Conceptual Admin endpoints:
```http
GET  /api/admin/platform-settings/announcements
POST /api/admin/platform-settings/announcements
PATCH /api/admin/platform-settings/announcements/{announcement}
POST /api/admin/platform-settings/announcements/{announcement}/publish
POST /api/admin/platform-settings/announcements/{announcement}/archive

GET  /api/admin/platform-settings/policies
GET  /api/admin/platform-settings/policies/{policy}
POST /api/admin/platform-settings/policies/{policy}/versions
POST /api/admin/platform-settings/policy-versions/{version}/publish
```
Conceptual user endpoints:
```http
GET  /api/announcements
GET  /api/policies/{type}/current
GET  /api/me/policy-consents/pending
POST /api/me/policy-consents/{policyVersion}
```
- Exact URLs follow repository conventions.
- Use Form Requests, Policies/Gates, domain actions, and API Resources.
- Suggested actions:
  - `CreateAnnouncement`
  - `PublishAnnouncement`
  - `ArchiveAnnouncement`
  - `CreatePolicyVersion`
  - `PublishPolicyVersion`
  - `AcceptPolicyVersion`

### Publish transaction
- Wrap policy publication in a database transaction.
- Lock/re-check current policy/version state.
- Supersede prior current version and publish new version atomically.
- Record Admin/audit metadata.
- Commit before:
  - cache invalidation dependent events
  - dashboard/feed broadcasts
  - user notifications
- Laravel supports after-commit jobs/notifications so workers do not observe uncommitted state. citeturn540778search1turn540778search2

### Re-consent implementation
- Prefer version comparison over setting `requires_reconsent = true` on every user row.
- Determine pending consent from:
  - current published version requiring consent
  - absence of matching `policy_acceptances` record
- Auth/application middleware may query a compact consent service to decide whether the user must enter a consent screen.
- Acceptance endpoint must:
  - authenticate user
  - validate that the policy version is current/acceptable
  - create an idempotent acceptance record with server timestamp
- OWASP privacy guidance recommends keeping policy/T&C version history and tracking which version each user accepted. citeturn540778search46

### Announcements and notifications
- Use shared Laravel notification/broadcast infrastructure when announcements need live feed refresh.
- Persist the announcement once; do not duplicate content per user unless unread/dismiss state requires a separate relation.
- Laravel queued notifications can explicitly dispatch after transaction commit. citeturn540778search1
- Keep targeted push/SMS behavior in Push Notification Management.

### Cache
- Cache current published policies and active announcements where useful.
- Laravel supports cache storage/retrieval/invalidation through its cache abstraction. citeturn540778search0
- Suggested keys:
```text
platform:announcements:active
platform:policy:{type}:current
```
- Invalidate after publish/archive/supersede.
- Public legal-policy pages may use HTTP cache headers/ETags if allowed; Laravel provides cache-header middleware. citeturn540778search3

### Next.js / React
- Build:
  - announcement list/editor/preview
  - policy type list
  - policy version history
  - policy editor/preview
  - explicit publish confirmation
  - explicit re-consent toggle/choice when publishing
- Use shared Laravel API client.
- Treat server validation as authoritative.
- Refetch current state after mutations.
- On conflict, show current published state and require Admin review before retry.
- User-facing apps consume published-only endpoints and pending-consent state.

### Tests
- **Laravel:** guest/non-Admin/permission denial; announcement create/update/publish/archive; draft visibility and expiration; safe content serialization; policy version creation/publication/history; one-current-version invariant; concurrent publish conflict; re-consent persistence; exact-version acceptance; idempotent acceptance; user DTO privacy; cache invalidation; audit creation; after-commit notification behavior.
- **Frontend:** announcement list/editor states; publish/archive confirmation; policy history/editor validation; re-consent selection; conflict refresh; forbidden state; safe preview rendering; accessibility.

### Research-backed recommendations
- Preserve published policy versions instead of overwriting them.
- Track consent against a specific version, not a generic boolean. citeturn540778search46
- Require re-consent only for versions explicitly marked as requiring it.
- Cache high-read published content and invalidate after publication changes. citeturn540778search0
- Queue notification/broadcast work after commit. citeturn540778search1turn540778search2
- Keep runtime secrets/environment configuration outside this Admin feature.

### Risks
- **Policy history loss:** editing published content in place destroys the record users accepted.
- **Fake consent:** one global boolean cannot establish accepted policy version.
- **Mass fan-out:** updating every user row during publication is unnecessarily expensive.
- **Stale cache:** missed invalidation can serve old policy/announcement content.
- **Permission leakage:** generic settings editors can expose dangerous configuration.
- **XSS:** unsanitized rich content can execute in user-facing pages.
- **Notification coupling:** synchronous fan-out can slow/fail publication.
- **Scope overlap:** announcements must not silently become push/SMS campaigns.

### Open questions
- Announcements: lifecycle, targeting, expiration, read/dismiss behavior, and content format.
- Policies: allowed types, version naming, material-change/re-consent decision owner, and whether publication requires second-Admin approval.
- Consent: affected roles, Admin participation, enforcement point, withdrawal behavior, and public visibility of Terms/Privacy.
- Operations: policy-change notification channel, cache backend/TTL, and scheduled future publication.

### Sources
- Project feature-spec rules: `SKILL.md`
- AISLEY architecture/system-flow contract: `README.md`
- Admin feature model: `Admin.md`
- Admin Authentication integration
- Laravel docs: Notifications, Queues, Cache, and HTTP Responses (`laravel.com/docs/12.x/...`)
- OWASP Privacy Risks Countermeasures: https://owasp.org/www-project-top-10-privacy-risks/
