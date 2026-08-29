---
feature: system-audit-logs
title: Admin System Audit Logs
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Admin
scope: Admin Web Application
---

# Admin System Audit Logs
## WHAT
- **Purpose:** Provide an immutable, timestamped ledger of administrative actions for security, accountability, and post-incident investigation.
- **Primary actor:** Authorized authenticated `ADMIN` viewing audit history.
- **Primary producers:** Administrative mutations performed across AISLEY Admin features.
- **Source-defined requirements:**
  - record administrative operations
  - identify who performed the action
  - identify what data/resource was changed
  - record when it occurred
  - preserve an immutable history
  - write audit events without causing the primary Admin action to fail
  - use a dedicated `AuditLogs` table or external logging service
- **Architecture:**
  - Next.js/React owns the read-only audit-log viewer, filters, pagination, detail drawer/page, and UI states.
  - Laravel owns audit-event creation, normalization, authorization, persistence/dispatch, redaction, and query APIs.
  - Database/external audit storage is authoritative.
- **Core flow:**
```text
Admin mutation succeeds
→ capture normalized audit event
→ source transaction commits
→ enqueue/persist audit event
→ immutable audit store
→ authorized Admin can search/view
```
- **Audit record answers:**
```text
WHO performed it?
WHAT action occurred?
WHICH resource was affected?
WHEN did it happen?
WHAT safe before/after context is needed?
WHERE/through which request did it occur? (optional)
```
- **Feature boundary:**
  - System Audit Logs record administrative/business actions.
  - Application/security logs record technical/security telemetry.
  - Complaint case timelines remain owned by Complaints & Disputes.
  - Compliance histories remain owned by Seller Compliance.
  - Audit Logs may reference those records but must not replace their domain history.
- **Authentication boundary:**
  - current sources do not decide whether successful login, logout, or failed login belongs in this immutable Admin Audit Log.
  - these may remain in security/auth logs instead.
- **Recommended route:**
```text
/system-audit-logs
```
- **Non-goals:**
  - editing or deleting audit events from normal Admin UI
  - storing plaintext secrets
  - storing full evidence files/message bodies
  - replacing infrastructure/application error logs
  - automatically reversing Admin actions
  - SIEM implementation unless separately selected
  - capturing every read request by default
## MUST
### Access control
- Every audit-log endpoint requires:
  - authenticated session
  - persisted role = `ADMIN`
  - System Audit Logs permission when custom Admin permissions exist
- Reading audit logs is highly sensitive and requires explicit backend authorization.
- React route visibility is not authorization.
- Direct API calls cannot bypass permission checks.
- Use project-standard:
  - `401` unauthenticated
  - `403` forbidden
  - `404` scoped log not found
  - `422` invalid filters
- Whether all Admins or only privileged Admins can view audit logs is an Open Question.
### Immutability
- Audit records are append-only.
- Normal application code must not expose:
  - update audit-log endpoint
  - delete audit-log endpoint
  - bulk-clear endpoint
- Admin UI is read-only.
- Once recorded, historical action facts must not be silently rewritten.
- Corrections, when truly necessary, should be represented as a new compensating/correction event referencing the original record.
- Database/service permissions should restrict modification/deletion where practical.
- If an external logging service is chosen, its retention/tamper-protection controls must satisfy the same immutability intent.
### What must be audited
- Security-sensitive and administrative mutations across Admin features must produce audit events.
- Existing examples include:
  - account approval/rejection
  - user suspension/restoration/deactivation
  - seller warning/suspension/product removal
  - complaint/dispute resolution
  - platform-policy publication
  - announcement publication/archive
  - Global Ban create/revoke
  - outbound notification campaign send/cancel
  - sensitive Admin account/security-setting changes
- Exact event catalog must be defined by each owning feature.
- Read-only page views do not automatically require immutable audit events unless policy explicitly requires them.
- Financial-report export may be auditable where sensitive-report access policy requires it.
- Login/logout/failed-login inclusion remains Open.
### Audit event schema
- Every audit event must have:
  - immutable server-generated ID
  - event/action type
  - actor Admin ID
  - target/resource type when applicable
  - target/resource ID when applicable
  - occurred/created timestamp
- Recommended safe fields:
  - request/correlation ID
  - previous state summary
  - new state summary
  - reason/reason code
  - source feature
  - related domain record ID
  - safe IP/user-agent metadata where policy permits
- Exact schema follows the real repository and privacy policy.
### Actor identity
- Actor identity must be derived from the authenticated Laravel Admin context.
- Never trust client-submitted:
```text
admin_id
actor_id
performed_by
role
```
- Persist the immutable Admin/account ID.
- Optionally persist a safe display snapshot if historical readability requires it, but the stable ID remains authoritative.
- Automated/system-originated audit events may use a distinct `SYSTEM` actor representation only if explicitly supported.
### Action naming
- Use stable application-level action names.
- Recommended style:
```text
account_registration.approved
user.suspended
seller.warning_issued
product.removed_for_compliance
dispute.resolved
policy.published
global_ban.created
push_campaign.sent
```
- Do not require frontend logic to infer semantics from route names.
- Event names must be allow-listed/defined by application code.
- Client input must not invent event types.
### Target/resource references
- Store stable IDs instead of full serialized models.
- Recommended:
```text
subject_type
subject_id
```
or repository-equivalent fields.
- For multi-resource actions, store one primary target plus safe related IDs in structured metadata.
- Avoid duplicating complete domain records into the audit table.
### Before/after data
- Audit logs may record safe changed-field summaries where useful.
- Prefer changed-field names and safe previous/new values rather than dumping full models.
- Example:
```json
{
  "changes": {
    "status": {
      "from": "ACTIVE",
      "to": "SUSPENDED"
    }
  }
}
```
- Never include hidden/authentication/payment secrets merely because a model changed.
- For large/sensitive objects, store references/reason codes rather than raw content.
### Sensitive-data exclusion
- Never intentionally audit:
  - plaintext passwords
  - password hashes
  - session cookies/IDs
  - CSRF secrets
  - Bearer/personal-access tokens
  - 2FA secrets
  - recovery codes
  - OTP values
  - API/provider secret keys
  - database connection strings
  - CVV/CVC/PIN/full-track payment data
- Avoid full payment-card/bank data.
- Avoid full identity documents/evidence files.
- Avoid full private message bodies unless a separately approved policy requires it.
- PII must be minimized, masked, pseudonymized, or omitted where the actor/resource ID is sufficient.
- OWASP recommends excluding or masking authentication secrets, tokens, sensitive PII, payment data, and encryption keys from logs.
### Audit metadata sanitization
- Treat all textual metadata as untrusted input.
- Sanitize/encode values before display.
- Prevent log injection/control-character abuse.
- Do not render audit metadata as executable HTML.
- Free-text reasons may be stored only within documented limits and safe serialization.
### Write timing
- `Admin.md` requires asynchronous audit writes that do not fail the primary Admin request.
- Audit creation must not cause an otherwise-valid domain mutation to fail solely because the downstream audit sink is temporarily unavailable.
- Audit event dispatch should happen only after the source domain transaction commits.
- Do not create immutable audit records for a mutation that ultimately rolls back.
- Laravel's after-commit queue/listener behavior is appropriate for asynchronous post-commit dispatch.
- Exact delivery-guarantee architecture is an Open Question.
### Delivery reliability
- Async delivery introduces a risk that an event could be lost after the primary transaction succeeds.
- At minimum:
  - queued jobs must retry transient failures
  - failures must be observable
  - duplicate retries must not create duplicate logical audit events
- Recommended event payload includes a stable event/audit ID generated before dispatch.
- A stronger transactional-outbox pattern may be used if the project later requires durable "no lost audit event" guarantees.
- Do not introduce an outbox as mandatory unless repository/reliability requirements justify it.
### Idempotency
- Replayed queue jobs must not create duplicate audit rows.
- Enforce uniqueness with a stable audit-event ID/idempotency key where appropriate.
- Retrying an audit write must not repeat the business mutation.
- Audit persistence consumes facts about the completed action; it does not execute the action.
### Middleware vs domain events
- Source mentions middleware triggering audit writes across the Admin dashboard.
- Generic middleware can capture:
  - actor
  - route
  - request/correlation ID
  - request time
  - response/result category
- Middleware alone may not know:
  - exact domain action
  - target resource
  - previous/new business state
  - safe reason code
- Recommended implementation:
  - use shared audit infrastructure
  - emit structured audit events from domain actions/services
  - optionally enrich them with request context from middleware
- Do not blindly serialize every request body from middleware.
### Failed actions
- Immutable Admin Audit Logs primarily describe administrative operations.
- Whether rejected/failed Admin mutation attempts are stored here or in security/application logs is an Open Question.
- If failed attempts are audited:
  - mark outcome explicitly
  - never claim a mutation occurred when it did not
- Authorization failures should normally be available in security logs even if excluded from business audit history.
### Audit-log viewer
- Admin must be able to view a paginated audit-log collection.
- Default order: newest first.
- Recommended allow-listed filters:
  - Admin/actor
  - action/event type
  - source feature
  - resource type
  - resource ID
  - date/time range
- Optional search may cover safe identifiers only.
- Avoid unrestricted full-text search over sensitive metadata unless explicitly required.
- Use server-side filtering/pagination.
### Date/time
- Store timestamps in UTC according to project conventions.
- Return ISO 8601 timestamps with timezone context.
- Render in the Admin's locale/timezone.
- Filters must normalize browser-entered date ranges server-side.
- Preserve precise ordering for events occurring close together.
- Server-generated timestamps are authoritative; never trust a client-submitted event timestamp.
### Audit detail
- Authorized Admin may open a single log entry.
- Detail may contain:
  - actor summary
  - action
  - target/resource reference
  - timestamp
  - safe before/after changes
  - safe reason/reference
  - correlation/request ID
- Detail must not expose secrets/redacted fields omitted during write.
- Audit detail is read-only.
### Correlation IDs
- A request/correlation ID is recommended for linking audit records to application/security logs.
- Generate/propagate correlation IDs server-side according to project middleware conventions.
- Correlation IDs are diagnostic references, not authentication credentials.
- Do not use them as permission proof.
### Retention
- Audit data must have a documented retention policy.
- Source does not define retention duration.
- Normal Admin users must not delete history to satisfy retention.
- Automated retention/archival may remove data only according to approved policy.
- OWASP recommends not destroying logs before required retention and not retaining them beyond justified duration.
- Exact archive/storage tier is an Open Question.
### Integrity/tamper resistance
- Protect audit storage from unauthorized modification/deletion.
- Restrict write privileges to the application/audit service.
- Restrict read privileges to authorized Admins/operations.
- Consider database permissions, append-only storage, external immutable storage, checksums/hash chaining, or SIEM/WORM storage only if risk/compliance needs justify them.
- These stronger mechanisms are implementation options, not current source requirements.
- Access to audit logs itself may need monitoring depending on privacy/security policy.
### Performance
- Audit writes must not materially delay primary Admin actions.
- Queue asynchronous storage when following the source-defined architecture.
- Viewer queries must be indexed/paginated.
- Likely index candidates:
  - occurred/created timestamp
  - actor Admin ID
  - action
  - subject type + ID
  - source feature
- Do not load the entire audit ledger into Next.js.
- Large metadata blobs should be avoided.
### Audit-log failure observability
- Queue/audit-sink failures must be observable to system operators.
- Do not silently swallow failures forever.
- Use Laravel failed-job/monitoring mechanisms or configured external observability.
- Failure alerts belong to operational/security monitoring, not necessarily the Admin audit viewer itself.
- Exact alert channel is Open.
### Frontend states
- Audit list:
  - loading
  - empty
  - loaded
  - error
  - forbidden
- Filters:
  - applying
  - invalid date range
  - no results
- Detail:
  - loading
  - loaded
  - not found
  - forbidden
  - error
- UI must provide no edit/delete controls.
- A failed viewer request must not imply logs were erased.
### Accessibility
- Audit table/list must support keyboard navigation.
- Table headers and filters require semantic labels.
- Action/outcome indicators cannot rely on color alone.
- Structured before/after changes need accessible textual rendering.
- Date/time labels should expose understandable values.
### Acceptance criteria
- [ ] Guest cannot access System Audit Logs.
- [ ] Non-Admin cannot access System Audit Logs.
- [ ] Custom Audit Logs permission is enforced.
- [ ] Audit viewer exposes no update/delete operation.
- [ ] Administrative mutations produce structured audit events according to their feature specs.
- [ ] Actor ID is derived from authenticated Admin context.
- [ ] Event timestamp is server-generated.
- [ ] Target/resource references use server-validated IDs.
- [ ] Secrets/tokens/passwords/payment secrets are never persisted in audit metadata.
- [ ] Rolled-back business mutation does not produce a false successful audit event.
- [ ] Audit dispatch occurs after source transaction commit.
- [ ] Audit-delivery failure does not roll back a successful Admin mutation.
- [ ] Retry does not create duplicate logical audit events.
- [ ] Viewer list is paginated and newest-first.
- [ ] Filters are server-side and allow-listed.
- [ ] Audit timestamps are returned in ISO 8601/timezone-aware form.
- [ ] Admin can inspect a safe read-only event detail.
- [ ] Audit records are protected against normal application update/delete.
- [ ] Retention is controlled by policy rather than user deletion.
- [ ] Audit metadata renders safely without log/HTML injection.
- [ ] Login/logout/failed-login behavior remains separate until policy is decided.
## HOW
### Project findings
- `Admin.md` defines System Audit Logs as an immutable, timestamped ledger of every administrative operation, recording who acted, what data changed, and when. fileciteturn21file0
- It explicitly permits a dedicated `AuditLogs` table or external logging service and requires asynchronous writes that do not fail the primary request. fileciteturn21file0
- The project architecture requires security-sensitive/admin mutations to be written to an audit trail and asynchronous follow-up work to run after commit. fileciteturn21file10turn21file15
- Admin Auth explicitly leaves login/logout/failed-login inclusion in this immutable ledger unresolved. fileciteturn21file2turn21file13
- Exact audit schema, retention period, external logging service, failure guarantees, and permissions for viewing logs are not defined by current project sources.
### Recommended Laravel model
Conceptual table:
```text
audit_logs
- id / event_id
- actor_admin_id
- action
- source_feature
- subject_type nullable
- subject_id nullable
- changes_json nullable
- metadata_json nullable
- request_id nullable
- occurred_at
```
- Keep rows append-only.
- Do not add ordinary update/delete Admin endpoints.
- Index timestamp, actor, action, source feature, and subject lookup columns.
- Use JSON metadata only for bounded safe structured context, not arbitrary model dumps.
### Audit event service
- Prefer one shared service/event contract:
```text
AuditEvent
AuditRecorder
```
- Domain action supplies:
  - action type
  - target
  - safe change summary
  - reason/reference
- Shared request context supplies:
  - authenticated Admin ID
  - request/correlation ID
  - optional safe request metadata
- Redaction/sanitization occurs before enqueue/persistence.
- Generate a stable event ID for retry deduplication.
### Laravel integration
Recommended conceptual flow:
```text
Admin domain action
→ database transaction
→ successful state mutation
→ emit structured audit event
→ commit
→ queued after-commit listener
→ append audit record
```
- Laravel can defer queued listeners/jobs/events until open database transactions commit. citeturn512908search3
- Do not enqueue raw Eloquent models containing sensitive hidden fields when a minimal immutable payload is enough.
- Queue worker reload is unnecessary when the event already contains the safe historical change facts.
### Middleware
- Use Admin middleware/request context to provide common metadata.
- Do not rely on middleware alone for business semantics.
- Middleware must never automatically dump full request bodies.
- Domain services should identify the exact business action and safe changes.
### Viewer API
Conceptual:
```http
GET /api/admin/audit-logs
GET /api/admin/audit-logs/{auditLog}
```
- No normal `POST`, `PATCH`, or `DELETE` endpoints for audit rows.
- Use Policy/Gate authorization.
- Use query validator/Form Request for filters.
- Use dedicated API Resource for safe output.
- Paginate collection.
### Next.js / React
- Build:
  - filterable audit-log table/list
  - actor/action/resource/date filters
  - read-only detail panel/page
  - structured before/after display
- Use shared Laravel API client.
- Keep filters in URL search params when consistent with the router conventions.
- Never implement edit/delete controls.
- Escape/render all metadata as data, not HTML.
### Security/logging guidance
- OWASP distinguishes audit/transaction trails from ordinary security-event logs and recommends collecting administrative actions while keeping purposes clear. citeturn512908search0
- OWASP recommends excluding/masking passwords, tokens, sensitive PII, payment data, keys, and other secrets from logs. citeturn512908search0
- OWASP also recommends protecting logs from unauthorized modification/deletion and controlling retention. citeturn512908search0
### Tests
- **Laravel:** authorization denial; structured event creation; server-derived actor/timestamp; redaction; after-commit/rollback behavior; retry deduplication; filters/pagination; read-only API; safe serialization.
- **Frontend:** loading/empty/error/forbidden states; filters; pagination; safe detail display; no edit/delete controls; accessibility.
### Research-backed recommendations
- Keep audit records append-only and separate from ordinary technical/security logs. citeturn512908search0
- Record Admin/privilege/data changes without secrets or unnecessary PII. citeturn512908search0turn512908search1
- Protect logs against tampering, deletion, and unauthorized access. citeturn512908search0
- Use after-commit async delivery so rolled-back actions do not create false audit history. citeturn512908search3
### Risks
- **Secret leakage:** raw request/model dumps can preserve credentials or PII.
- **Lost async events:** queue outages can create gaps without retries/monitoring.
- **Duplicate events:** retries can duplicate records without stable IDs.
- **Tampering:** edit/delete capability defeats ledger integrity.
- **False history:** pre-commit writes can record rolled-back actions.
- **Log injection:** untrusted text can corrupt displays.
- **Storage growth:** unlimited retention can become expensive.
- **Coverage gaps/noise:** generic middleware can both miss meaningful actions and overlog trivial ones.
### Open questions
- Mandatory event catalog and failed/forbidden-action policy.
- Login/logout/failed-login inclusion.
- Read permission and whether viewing/exporting logs is itself audited.
- Database table vs external service.
- Delivery guarantee/outbox requirement.
- Retention/archive and audit-export requirements.
- IP/user-agent collection policy.
- Before/after value depth.
- Whether hash chaining, WORM, or SIEM integration is needed.
### Sources
- Project feature-spec rules: `SKILL.md`
- AISLEY architecture/system-flow contract: `README.md`
- Admin feature model: `Admin.md`
- Admin Authentication source/spec
- Laravel Queues / after-commit: https://laravel.com/docs/12.x/queues
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- OWASP Logging Vocabulary Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html
