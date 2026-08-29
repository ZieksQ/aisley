---
feature: manage-complaints-and-disputes
title: Admin Manage Complaints and Disputes
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Admin
scope: Admin Web Application
---

# Admin Manage Complaints and Disputes

## WHAT

- **Purpose:** Centralized Admin resolution center for reviewing user-submitted complaints/reports, examining evidence, recording investigation activity, and issuing binding dispute decisions.
- **Primary actor:** Authenticated `ADMIN`.
- **Source-defined behavior:**
  - review reports/complaints
  - inspect text, image, and document evidence
  - adjudicate conflicts between platform participants
  - make binding decisions
  - preserve an audit trail of Admin messages/actions
- **Architecture:**
  - Next.js/React owns queue, case detail, evidence viewer, timeline, resolution forms, and UI states.
  - Laravel owns authentication, authorization, validation, evidence access, state transitions, persistence, audit history, and notifications.
  - Laravel/Eloquent state is authoritative.
- **Cross-feature relationships:**
  - Chat/Messaging may provide relevant communication references.
  - Courier Delivery History and Proof of Delivery may provide delivery evidence.
  - Seller Compliance owns seller sanctions.
  - Manage User Accounts owns account-status actions.
  - Global Ban owns security bans/blocking.
  - Payment/order features own refunds, returns, and payment mutations.
- **Recommended case model:** complaint/dispute case + participants + evidence references + append-only activity/history + final resolution.
- **Recommended routes:**

```text
/complaints-disputes
/complaints-disputes/{case}
```

- Source does not define exact case statuses.
- Recommended normalized lifecycle:

```text
OPEN
→ IN_REVIEW
→ RESOLVED

or

OPEN
→ IN_REVIEW
→ DISMISSED
```

- Status names are recommendations, not source-mandated values.
- **Non-goals:** automatic adjudication, fraud scoring, unrestricted chat surveillance, destructive evidence deletion, or inventing refund/suspension/ban rules owned by other features.

## MUST

### Access control

- Require:
  - authenticated session
  - persisted role = `ADMIN`
  - Manage Complaints and Disputes permission when custom permissions exist
- Laravel authorization is authoritative.
- Direct API calls must not bypass case/evidence permissions.
- Use project-standard:
  - `401` unauthenticated
  - `403` forbidden
  - `404` scoped resource missing
  - `422` validation error
  - `409` stale/invalid transition

### Case queue

- Admin must be able to list cases.
- List must be paginated.
- Recommended allow-listed filters:
  - status
  - category/type when defined
  - submitted date
  - involved role/account
- Safe list fields may include:
  - case ID
  - category/type
  - status
  - complainant display identity
  - respondent display identity
  - created/updated timestamps
- Do not return full evidence payloads or unnecessary PII in list responses.

### Case detail

- Admin must be able to review an authorized case.
- Detail may contain:
  - complaint/report text
  - complainant
  - respondent/involved parties
  - related order/delivery/product references
  - evidence references
  - current state
  - Admin activity timeline
  - final resolution
- Related IDs must be resolved and validated server-side.
- Do not trust a client-submitted relationship merely because an ID exists.

### Participants

- Persist submitting account and explicitly involved accounts.
- Reference shared AISLEY user/account IDs.
- Role/display identity comes from persisted data.
- Exact rules for who may report whom belong to complaint-submission flows and remain open where undefined.

### Evidence

- Source-supported evidence:
  - text
  - images
  - documents
- Existing evidence may be referenced when relevant:
  - Proof of Delivery
  - order/delivery history
  - relevant message IDs
- Prefer references to existing immutable source records rather than copying them.
- Uploaded files must follow shared project rules:
  - type/size validation
  - malware scanning
  - server-generated storage identifiers
  - storage outside public application paths
  - asset reference persisted in the case
- Evidence must not be public.
- Every evidence view/download requires authorization.
- Use signed/temporary/otherwise authorized URLs.
- Never expose internal storage paths.
- Do not silently replace or overwrite submitted evidence.

### Evidence metadata

- Evidence records should preserve:
  - case ID
  - uploader/source account ID
  - asset/reference ID
  - evidence type
  - created timestamp
- Recommended optional metadata:
  - display filename
  - detected MIME type
  - file size
  - checksum/hash when available
- Resolution must reference persisted evidence IDs, not temporary browser state.
- Admin must be able to distinguish which party supplied each item.

### State transitions

- Case state must use explicit domain transitions, not arbitrary status mass-assignment.
- Suggested actions:
  - start review
  - resolve
  - dismiss
  - reopen only if later approved
- At minimum:
  - unresolved and final cases must be distinguishable
  - final resolution cannot be silently overwritten
- Stale decisions return `409` or project equivalent.

### Case timeline

- Maintain chronological case activity/history.
- Timeline may include:
  - case created
  - review started
  - evidence referenced
  - Admin note/action
  - message reference
  - state transition
  - final decision
- Do not rely only on mutable `updated_at`.
- Do not overwrite previous history entries.
- Internal Admin notes must be distinguishable from participant-visible communication if both exist.
- Visibility rules for internal notes are open.

### Final decision

- Final resolution must:
  - require authorization
  - validate current case state
  - record resolution outcome
  - record deciding Admin ID
  - record timestamp
  - preserve rationale/notes according to policy
  - commit transactionally
- Exact resolution outcomes are not source-defined.
- Do not invent automatic:
  - refunds
  - seller suspensions
  - courier penalties
  - user bans
- Cross-feature remedies must use the owning feature's domain action/service.
- A generic dispute payload must not directly mutate unrelated domain tables.

### Cross-feature actions

- If resolution requires an existing action:
  - call owning Laravel service/action
  - enforce that feature's rules
  - preserve authorization and transaction requirements
- Examples:
  - seller warning/suspension → Seller Compliance
  - account action → Manage User Accounts
  - security block → Global Ban
  - refund/order mutation → payment/order feature
- Unsupported remedies must not be fabricated.

### Concurrency

- Multiple Admins may review the same case.
- Final-state mutation must be concurrency-safe.
- Use:
  - database transaction
  - row lock
  - atomic conditional update
  - or repository-equivalent version check
- If another Admin resolves first:
  - do not overwrite
  - return `409`
  - refresh frontend state
- Duplicate requests must not repeat downstream side effects.

### Notifications

- Notify involved parties after final resolution when project notification policy requires it.
- Exact channels/templates are not source-defined.
- Use shared Laravel Notifications when available.
- Dispatch only after the decision transaction commits.
- Notification failure must not roll back a resolved case.
- Do not include private evidence URLs or unnecessary PII.
- In-app/email selection is open.

### Chat/Messaging integration

- Admin may communicate through the shared Chat/Messaging feature.
- Prefer storing message/conversation references in the case timeline instead of copying complete chat histories.
- Admin must not gain blanket access to unrelated private chats.
- If a message is used as evidence:
  - authorize the relationship
  - preserve message ID and original timestamp
  - keep source message immutable
- New dispute communication follows Chat/Messaging authorization/archive rules.

### Delivery evidence

- Delivery-related disputes may reference:
  - order records
  - courier delivery history
  - Proof of Delivery
- Source domains remain authoritative.
- Dispute review must not mutate delivery/POD history.
- Access is scoped to the case and authorized Admin.

### Audit trail

- Admin case mutations must be auditable.
- Safe metadata:
  - Admin ID
  - case ID
  - action
  - previous/new state
  - related resource IDs
  - timestamp
- Do not copy full evidence files into audit logs.
- Avoid unnecessary message contents/PII in immutable audit entries.
- Audit/history remains available after closure.

### Retention

- Source requires history/accountability but does not define retention duration.
- Normal Admin UI must not hard-delete resolved cases or evidence.
- Retention/anonymization policy is open.
- If legal deletion is later required, preserve approved minimum audit references.

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
  - evidence loading/error
  - conflict/stale
  - error
- Resolution:
  - confirmation
  - validation error
  - submitting
  - success
  - conflict
  - failure
- Do not optimistically show a final resolution.
- On `409`, refetch current case state.

### Accessibility

- Queue, timeline, evidence controls, and decision forms must support keyboard use.
- Status/severity must not rely on color alone.
- Errors must be associated with fields.
- Confirmation dialogs must identify the case and intended action.

### Acceptance criteria

- [ ] Guest cannot access dispute Admin APIs.
- [ ] Non-Admin cannot access dispute management.
- [ ] Custom Admin permission is enforced.
- [ ] Admin can list paginated cases.
- [ ] Admin can open authorized case detail.
- [ ] Evidence is private and access-authorized.
- [ ] Evidence preserves source/uploader and timestamp.
- [ ] Existing POD/order/message evidence can be referenced without mutating source history.
- [ ] Client cannot assign arbitrary case status.
- [ ] Final decision records Admin, timestamp, outcome, and rationale.
- [ ] Concurrent final decisions cannot overwrite each other.
- [ ] Duplicate decisions do not duplicate downstream actions.
- [ ] Admin actions remain in case/audit history.
- [ ] Closed history is not hard-deleted by normal UI.
- [ ] Cross-feature remedies use owning feature rules.
- [ ] Notification failure does not roll back resolution.
- [ ] Unrelated private chats remain inaccessible.
- [ ] Sensitive evidence/PII is absent from list DTOs.
- [ ] UI handles empty, forbidden, conflict, evidence-error, and success states.

## HOW

### Project findings

- `Admin.md` defines a ticket-style resolution center for user reports/complaints, evidence review, binding decisions, secure evidence storage, and an Admin action/message audit trail.
- Admin Chat/Messaging provides the shared archived communication layer.
- Courier sources identify Delivery History and Proof of Delivery as dispute-relevant evidence.
- `README.md` requires Laravel-owned authorization, validated transitions, transactions, audit trails, private evidence URLs, pagination, and after-commit async work.
- Exact complaint-submission flows, state enum, remedy taxonomy, SLAs, and persistence schema are not defined.

### Laravel data model

Recommended conceptual schema:

```text
dispute_cases
- id
- category nullable
- complainant_user_id
- respondent_user_id nullable
- status
- body
- related_order_id nullable
- resolved_at nullable
- resolved_by_admin_id nullable
- resolution_code nullable
- resolution_notes nullable
- created_at
- updated_at

dispute_evidence
- id
- dispute_case_id
- submitted_by_user_id
- asset_id/reference
- evidence_type
- created_at

dispute_events
- id
- dispute_case_id
- actor_user_id/admin_id nullable
- event_type
- safe metadata/reference
- created_at
```

- Use actual repository names/types.
- Prefer source evidence IDs over duplicated blobs.
- Index status, created date, participant IDs, and related order when used.

### Laravel API

Conceptual endpoints:

```http
GET  /api/admin/disputes
GET  /api/admin/disputes/{case}
POST /api/admin/disputes/{case}/start-review
POST /api/admin/disputes/{case}/resolve
POST /api/admin/disputes/{case}/dismiss
GET  /api/admin/disputes/{case}/evidence/{evidence}
```

- Follow project version/resource conventions.
- Use Form Requests.
- Use `DisputeCasePolicy`/Gates.
- Suggested actions:
  - `StartDisputeReview`
  - `ResolveDispute`
  - `DismissDispute`
  - `AttachExistingEvidenceReference`
- Keep controllers thin.
- Use API Resources for queue/detail/timeline DTOs.

### Decision transaction

- Wrap final decisions in `DB::transaction`.
- Re-read/lock the current case or use atomic/version checks.
- Verify the case is still resolvable.
- Persist resolution and timeline/audit data.
- Execute approved downstream actions through owning services.
- Commit before notifications/broadcasts.
- Laravel provides `lockForUpdate()` for row-level update locking when appropriate.

### Evidence storage/access

- Reuse configured object/file storage.
- Keep evidence private.
- Laravel supports temporary URLs on supported filesystem drivers.
- OWASP recommends allow-listed file types, size limits, generated storage names, authorization, storage outside webroot, and malware scanning.
- Upload security belongs primarily to the complaint-submission feature; Admin review must preserve and authorize stored evidence.

### Authorization
- Use Laravel Policies for case/evidence resource access.
- Authentication alone is insufficient; every case/evidence action must authorize the specific resource.
### Notifications
- Use Laravel Notifications when resolution notifications are required.
- Queue them after commit.
- Laravel supports `afterCommit()` for queued notifications so workers do not observe uncommitted case state.
### Next.js / React
- Build:
  - dispute queue
  - filters
  - case detail
  - participants/context summary
  - evidence viewer
  - timeline
  - resolve/dismiss forms
- Use shared API client.
- Fetch temporary evidence URLs only when needed.
- Do not persist private temporary URLs in frontend storage.
- Refetch case after mutations.
- On `409`, display current state and disable stale controls.
### Tests
- **Laravel:** guest/non-Admin/permission denial, pagination/filtering, safe detail DTO, evidence authorization, invalid evidence relationship, review/resolve/dismiss transitions, concurrent resolution, duplicate protection, audit/timeline, downstream delegation, after-commit notification, private URL behavior.
- **Frontend:** queue states, filters, detail/timeline, evidence error, resolve/dismiss validation, duplicate-submit prevention, conflict refresh, forbidden state, accessibility.
### Research-backed recommendations
- Model disputes as cases with append-only history and evidence references.
- Use explicit transition actions, not generic status editing.
- Use private temporary evidence access plus defense-in-depth upload controls.
- Protect final decisions with transactional locking/atomic checks.
- Queue notifications only after commit.
- Keep sanctions/refunds behind owning domain services.
### Risks
- **Evidence leakage:** complaint files may contain sensitive data.
- **Decision overwrite:** two Admins may resolve concurrently.
- **Audit loss:** mutable-only status/notes weaken accountability.
- **Chat overreach:** dispute review must not become blanket surveillance.
- **Domain bypass:** generic resolution actions can bypass seller/user/payment rules.
- **Malicious uploads:** evidence files may be hostile.
- **Retention conflict:** hard deletion can destroy investigation history.
- **Spec gap:** complaint creation, exact statuses, remedies, and SLAs remain undefined.
### Open questions
- Who may submit complaints/reports.
- Complaint categories.
- Exact state names.
- Whether `IN_REVIEW` is required.
- Reopen/appeal behavior.
- Resolution outcome taxonomy.
- Internal vs participant-visible Admin notes.
- Whether parties can add evidence during review.
- Evidence file types/size limits.
- Retention duration.
- Whether message IDs can be formal evidence.
- Which order/POD fields are shown.
- Refund/return workflow.
- Available seller/courier/user sanctions.
- Notification recipients/channels.
- SLA/priority/escalation rules.
- Admin assignment/claiming.
- Dashboard count definition.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture contract: `README.md`
- Admin model: `Admin.md`
- Courier model: `Courier.md`
- Laravel Authorization: https://laravel.com/docs/12.x/authorization
- Laravel Query Builder locking: https://api.laravel.com/docs/12.x/Illuminate/Database/Query/Builder.html
- Laravel Notifications: https://laravel.com/docs/12.x/notifications
- Laravel Filesystem temporary URLs: https://api.laravel.com/docs/12.x/Illuminate/Filesystem/FilesystemAdapter.html
- OWASP File Upload Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html
