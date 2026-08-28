---
feature: System Audit Logs
system: AISLEY
type: Feature Specification
version: 2.0
status: Draft
scope: Admin Web Application / Shared Admin Infrastructure
source_coverage: Admin.md, app.md, current AISLEY Admin feature specifications
---

# System Audit Logs Specification

## 1. Purpose

System Audit Logs is AISLEY's immutable administrative accountability ledger.
`Admin.md` defines:

```text
Core Value:
Track administrative actions and changes made
within the system for security and accountability.

Expanded Definition:
An immutable, time-stamped ledger
recording every administrative operation.

It tracks:
- who performed an action
- what data was altered
- when it occurred

It is designed to:
- prevent abuse of power
- facilitate post-incident forensics

System Context:
Requires a dedicated AuditLogs table
or an external logging service.

Operations across the Admin dashboard
must trigger middleware that asynchronously
writes to this log
without failing the primary request.
```

For AISLEY MVP:

```text
dedicated internal AuditLogs table = default
external logging service = optional
```

No third-party logging provider is required.

## 2. Core Principle

Audit Logs records:

```text
who
did what
to which resource
when
```

Optionally, where safe:

```text
what changed
```

## 3. Primary Actor

The main actor recorded by this feature is:

```text
ADMIN
```

Every consequential Admin action should identify the exact:

```text
admin_user_id
```

Do not record only:

```text
role = ADMIN
```

without the actor identity.

## 4. Audit Viewer

Authorized Admins may view Audit Logs.
Viewing logs should require a dedicated permission or equivalent Admin authorization.
Not every Admin must automatically have full audit visibility.

## 5. Core Responsibilities

System Audit Logs owns:

- immutable audit records
- Admin actor identity
- event/action type
- target resource reference
- timestamp
- safe before/after metadata where appropriate
- source feature reference
- searchable/filterable Admin viewer
- pagination
- asynchronous write integration
- retry/recovery when audit writing fails
- safe retention
- access control
  It does not own the business action being audited.

## 6. Non-Goals

System Audit Logs does not perform:

- account approval
- user suspension/restoration
- Seller Compliance decisions
- complaint decisions
- policy publication
- Global Ban changes
- campaign delivery
- Admin Chat messaging
- payment processing
- order changes
- fraud detection
- application error logging
- performance monitoring
- analytics telemetry
- SIEM as an MVP requirement

## 7. Source Boundary

The source permits either:

```text
dedicated AuditLogs table
OR
external logging service
```

AISLEY MVP should use:

```text
dedicated internal AuditLogs table
```

External forwarding may be added later.

## 8. Third-Party Requirement

No third-party service is required for System Audit Logs.
Optional future integrations may include:

```text
SIEM
security log aggregator
external archival service
```

These remain Open Decisions.

# Event Scope

## 9. What Should Be Audited

Audit consequential Admin mutations.
Examples:

- approve registration
- reject registration
- suspend user
- restore user
- deactivate user
- issue Seller warning
- apply Seller compliance suspension
- remove non-compliant product
- resolve complaint
- publish announcement
- publish policy
- require re-consent
- create/disable Global Ban entry
- update Admin account/security settings where appropriate
- send outbound Notification Management campaign
- other high-impact Admin mutations

## 10. Routine Reads

Routine read-only operations should not create Audit Log records by default.
Examples:

```text
open Dashboard
view report
search users
view notification list
```

These are not consequential mutations.

## 11. Read Auditing Exceptions

Certain sensitive reads may later warrant auditing.
Examples:

```text
view highly sensitive evidence
download financial export
```

Exact policy is Open.

## 12. Authentication Events

Whether successful/failed Admin login attempts belong in this Audit Log is Open.
They may instead belong to dedicated security/authentication logs.

## 13. Runtime Security Events

High-frequency events such as:

```text
every blocked IP request
every Global Ban match
```

should not create one Audit Log row each.
Those belong to:

```text
security/application logs
```

Admin changes to the blocklist itself should be audited.

## 14. Complaints Integration

`Admin.md` explicitly requires:

```text
an audit trail of messages and actions
taken by the administrator
during complaint resolution
```

Complaint-specific history may exist inside the complaint case.
System Audit Logs should still record consequential Admin actions such as:

```text
COMPLAINT_DECIDED
COMPLAINT_CLOSED
```

## 15. Domain Authority

Audit Logs is historical accountability infrastructure.
It is not the authoritative business state.
Example:

```text
USER_ACCOUNT_SUSPENDED
```

records the action.
Manage User Accounts owns:

```text
current account status
```

# Audit Record

## 16. Recommended Fields

Conceptual:

```text
id
actor_admin_id
event_type
source_feature
target_type
target_id
summary
before_data
after_data
metadata
occurred_at
created_at
```

Exact schema is implementation-specific.

## 17. Actor

Required:

```text
actor_admin_id
```

Optional:

```text
actor_role
actor_display_name snapshot
```

The user ID is authoritative.

## 18. Event Type

Each audit event should have a stable machine-readable event type.
Examples:

```text
ACCOUNT_REGISTRATION_APPROVED
USER_ACCOUNT_SUSPENDED
SELLER_COMPLIANCE_WARNING_ISSUED
POLICY_VERSION_PUBLISHED
BLOCKLIST_USER_ADDED
```

Exact naming convention is Open.

## 19. Source Feature

Recommended:

```text
source_feature
```

Examples:

```text
MANAGE_ACCOUNT_REGISTRATIONS
MANAGE_USER_ACCOUNTS
SELLER_COMPLIANCE
COMPLAINTS
PLATFORM_SETTINGS
GLOBAL_BAN
NOTIFICATION_MANAGEMENT
```

## 20. Target

Recommended:

```text
target_type
target_id
```

Examples:

```text
USER + user_id
COMPLAINT + case_id
PRODUCT + product_id
POLICY_VERSION + version_id
BLOCKLIST_ENTRY + entry_id
CAMPAIGN + campaign_id
```

## 21. Summary

A short human-readable summary may be stored.
Example:

```text
Seller account suspended for compliance violation.
```

Do not rely on summary text as the only structured event data.

## 22. Before / After

Safe structured before/after values may be useful for mutations.
Example:

```text
before:
status = ACTIVE

after:
status = SUSPENDED
```

## 23. Before / After Minimization

Do not dump full database rows into Audit Logs.
Store only fields relevant to the action.

## 24. Metadata

Metadata may contain:

```text
reason reference
case ID
policy version
campaign audience summary
```

It must remain bounded and safe.

## 25. Timestamp

Each record must include a server-generated timestamp.
Recommended:

```text
occurred_at
```

## 26. Server Authority

Do not trust the frontend to provide:

```text
actor identity
event timestamp
before state
authoritative target state
```

These must be determined by the backend.

# Immutability

## 27. Immutable Ledger

Source requirement:

```text
immutable
```

Therefore normal Admin UI must not support:

- edit audit record
- delete audit record
- rewrite event type
- rewrite actor
- rewrite timestamp
- rewrite target

## 28. No CRUD Management

Audit Logs is not a normal CRUD feature.
Recommended Admin capabilities:

```text
READ
SEARCH
FILTER
```

Not:

```text
CREATE manually
UPDATE
DELETE
```

## 29. Database Protection

Recommended implementation controls:

- no public update/delete endpoints
- restricted database permissions where practical
- append-only application service
- no cascading deletion from source records

## 30. Source Record Deletion

If a source record is later deactivated/removed:

```text
audit record remains
```

It should preserve stable target identifiers.

## 31. Hard Delete

Routine Admin hard delete of audit history is not allowed.
Retention/archival cleanup must be a controlled system process if later required.

## 32. Cryptographic Tamper Proofing

Hash chains, signing, notarization, blockchain, or WORM storage are not source-required.
Open Decision.

# Async Writing

## 33. Source Requirement

`Admin.md` requires Audit Log writing to be:

```text
asynchronous
```

and:

```text
must not fail the primary request
```

## 34. Primary Action First

Conceptually:

```text
Admin action
→ business transaction commits
→ audit event is persisted/queued
→ audit writer stores AuditLog
```

## 35. Primary Action Independence

Example:

```text
account suspension commits
audit worker temporarily fails
```

Result:

```text
account suspension remains committed
```

Do not roll back the business action solely because the asynchronous audit writer failed.

## 36. Reliability Requirement

Although the primary action should not fail because of audit delivery problems, audit events must not be silently discarded.
Recommended:

```text
transactional outbox
or equivalent durable event handoff
```

## 37. Transactional Outbox

Recommended architecture:

```text
business transaction
→ domain change
+ durable audit event/outbox record
→ commit
→ async worker
→ AuditLogs table
```

This reconciles:

```text
do not fail primary request
```

with:

```text
do not lose audit history
```

## 38. Middleware

`Admin.md` mentions:

```text
middleware
```

Middleware may participate in capturing request/action context.
However, domain-level audit events are often safer for accurately recording:

```text
what actually committed
```

Exact architecture may combine middleware and domain events.

## 39. Do Not Audit Failed Mutation as Success

If a business mutation fails:

```text
do not create a success audit event
```

A separate failure/security log may be used if required.

## 40. Worker Retry

Audit-writer failure should retry according to bounded queue policy.
Exact retry count/backoff is Open.

## 41. Dead-Letter / Failed Jobs

Recommended:

```text
failed audit job
→ operational visibility
→ manual/system retry path
```

Exact implementation is Open.

# Feature Integrations

## 42. Manage Account Registrations

Recommended events:

```text
ACCOUNT_REGISTRATION_APPROVED
ACCOUNT_REGISTRATION_REJECTED
```

Target:

```text
user_id + role
```

## 43. Manage User Accounts

Recommended:

```text
USER_PROFILE_UPDATED
USER_ACCOUNT_SUSPENDED
USER_ACCOUNT_RESTORED
USER_ACCOUNT_DEACTIVATED
```

## 44. Seller Compliance

Recommended:

```text
SELLER_COMPLIANCE_WARNING_ISSUED
SELLER_COMPLIANCE_SUSPENSION_APPLIED
SELLER_COMPLIANCE_SUSPENSION_REMOVED
SELLER_PRODUCT_REMOVED_FOR_COMPLIANCE
SELLER_COMPLIANCE_CASE_RESOLVED
```

## 45. Complaints & Disputes

Recommended:

```text
COMPLAINT_DECIDED
COMPLAINT_CASE_CLOSED
```

Request-information/message events may remain in complaint/chat history unless policy requires Audit Log duplication.

## 46. Manage Platform Settings

Recommended:

```text
ANNOUNCEMENT_CREATED
ANNOUNCEMENT_UPDATED
ANNOUNCEMENT_PUBLISHED
ANNOUNCEMENT_ARCHIVED
POLICY_VERSION_CREATED
POLICY_VERSION_PUBLISHED
POLICY_RECONSENT_REQUIRED
```

## 47. Global Ban / Blocklist

Recommended:

```text
BLOCKLIST_USER_ADDED
BLOCKLIST_IP_ADDED
BLOCKLIST_PAYMENT_METHOD_ADDED
BLOCKLIST_ENTRY_DISABLED
BLOCKLIST_ENTRY_REACTIVATED
```

Runtime block matches are not Audit Log mutations.

## 48. Notification Management

Recommended:

```text
NOTIFICATION_CAMPAIGN_CREATED
NOTIFICATION_CAMPAIGN_UPDATED
NOTIFICATION_CAMPAIGN_QUEUED
```

Completion may be logged if useful.

## 49. Admin Account Management

Recommended:

```text
ADMIN_PROFILE_UPDATED
ADMIN_PASSWORD_CHANGED
ADMIN_TWO_FACTOR_ENABLED
ADMIN_TWO_FACTOR_DISABLED
```

Do not log passwords, secrets, recovery codes, or OTP values.

## 50. Admin Chat

Routine individual message bodies should not be copied into System Audit Logs by default.
The chat system owns message history.
Audit Logs may record high-level administrative events if later required.

## 51. Reports Overview

Routine report views are not audited by default.
Recommended sensitive actions:

```text
FINANCIAL_REPORT_EXPORT_REQUESTED
FINANCIAL_REPORT_EXPORT_DOWNLOADED
```

if export auditing is enabled.

## 52. Admin Notifications

Routine:

```text
UNREAD → READ
```

does not require Audit Log entries by default.

# Data Safety

## 53. Secret Exclusion

Never store:

- password
- password hash
- session cookie
- access token
- refresh token
- OTP
- 2FA secret
- recovery code
- API key
- provider credential
- CVV
- full payment card data

## 54. Payment Data

For blocklist/payment-related events, use safe identifiers only.
Examples:

```text
provider reference
masked identifier
safe fingerprint reference
```

## 55. Complaint Evidence

Do not copy evidence binaries or full sensitive evidence into Audit Logs.
Store:

```text
case/evidence reference
```

instead.

## 56. Message Content

Do not copy entire private Admin Chat conversations into Audit Logs.
Store safe references when needed.

## 57. PII Minimization

Prefer:

```text
user ID
role
safe display identifier
```

Avoid unnecessary addresses, phone numbers, and personal details.

## 58. Reason Fields

Reasons may contain sensitive information.
Keep them concise, safely rendered, and only as detailed as needed.

## 59. Structured Metadata

Prefer bounded structured metadata over arbitrary unvalidated JSON.
Exact schema strategy is Open.

# Viewer

## 60. Recommended Route

```text
/audit-logs
```

or equivalent Admin route.

## 61. List Columns

Recommended:

```text
Timestamp
Admin Actor
Action
Target
Source Feature
Summary
```

## 62. Detail View

Recommended:

```text
Event ID
Timestamp
Admin
Event Type
Source Feature
Target
Before
After
Safe Metadata
```

## 63. Search

Recommended:

```text
event ID
Admin name/email
target ID
event type
```

If email is used for Admin search, resolve to exact Admin account identity.

## 64. Filters

Recommended:

```text
date
Admin actor
source feature
event type
target type
```

## 65. Pagination

Audit Logs must be paginated/bounded.
Do not load the entire ledger into the browser.

## 66. Sorting

Default:

```text
newest first
```

## 67. Read-Only UI

The viewer must not expose:

```text
Edit
Delete
Rewrite
```

actions.

## 68. Empty State

Example:

```text
No audit events found for this filter.
```

## 69. Loading / Error

Support:

```text
loading
empty
filtered empty
error
```

# API

## 70. Recommended Read API

Conceptual:

```http
GET /api/admin/audit-logs
GET /api/admin/audit-logs/{auditLogId}
```

## 71. No Public Mutation API

Do not expose normal Admin endpoints such as:

```http
POST   /api/admin/audit-logs
PATCH  /api/admin/audit-logs/{id}
DELETE /api/admin/audit-logs/{id}
```

Audit records are generated by trusted backend infrastructure.

## 72. List Query

Recommended:

```text
actor_id
event_type
source_feature
target_type
target_id
date_from
date_to
search
page/cursor
```

## 73. Detail Response

Return safe event metadata only.
Never return secrets/redacted fields.

# Authorization

## 74. Authentication

Audit Log viewer requires:

```text
authenticated ADMIN
```

## 75. Permission

Possible:

```text
view audit logs
```

Exact permission key is Open.

## 76. Field-Level Visibility

Some metadata may require additional restrictions.
Exact field-level policy is Open.

## 77. CSRF

Read-only Audit Log GET endpoints do not require mutation CSRF behavior beyond normal authenticated session protections.
There should be no normal audit-log mutation endpoint.

## 78. IDOR

Knowing an Audit Log ID does not grant access.
Authorization must be checked for list/detail requests.

# Retention

## 79. Retention Requirement

The source requires historical accountability but does not define a retention duration.
Open Decision.

## 80. Retention Policy

Possible future policies:

```text
retain indefinitely
retain N years
archive after N months
```

Do not invent a duration.

## 81. Archive

Archiving old logs to lower-cost storage is optional.
It must preserve immutability and authorized retrieval if implemented.

## 82. External Archive

External archival services are optional, not required.

# Performance

## 83. Write Path

Audit writing must not significantly delay Admin mutations.
Use asynchronous processing.

## 84. Query Indexes

Likely useful:

```text
occurred_at
actor_admin_id
event_type
source_feature
target_type + target_id
```

Exact indexes depend on schema.

## 85. Large Ledger

Use pagination/cursor-based retrieval for large datasets.

## 86. Avoid Large Payloads

Keep Audit Log records compact.
Do not store:

- full source rows
- binary evidence
- full conversation histories
- giant campaign recipient lists

# Operational Behavior

## 87. Audit Writer Failure

Recommended:

```text
retry
surface failed jobs operationally
preserve durable source event
```

## 88. Audit Database Failure

A temporary AuditLogs table/storage failure should not invalidate the already-committed business action.
Recovery should process durable pending events later.

## 89. Duplicate Processing

Audit event handling should be idempotent.
A retried event should not create uncontrolled duplicate Audit Log records.

## 90. Idempotency Key

Recommended:

```text
event_id
```

or equivalent unique source event identifier.

## 91. Ordering

Strict total ordering across every Admin action is not required by source.
Each event must at minimum preserve accurate server time.

# Accessibility

## 92. Accessibility

Audit viewer should:

- expose data in semantic tables/lists
- support keyboard filtering/navigation
- provide textual timestamps/actions
- not rely on color alone
- clearly indicate redacted values

## 93. Responsive Behavior

Audit list/detail should remain usable on smaller Admin screens.

# MVP Scope

## 94. Required

- dedicated internal AuditLogs table
- immutable append-only records
- exact Admin actor ID
- event type
- target type/ID
- timestamp
- source feature
- safe metadata
- asynchronous writing
- primary business action not rolled back because audit writer temporarily fails
- durable retry/recovery strategy
- read-only Admin viewer
- search/filter
- pagination
- Admin authorization
- secret/PII minimization
- integration with consequential Admin features

## 95. Recommended

- transactional outbox
- safe before/after values
- idempotent event processing
- dedicated audit-view permission
- failed-job operational visibility
- export download auditing where sensitive
- database-level protection against ordinary update/delete

## 96. Not Required

- external logging vendor
- SIEM
- blockchain
- cryptographic hash chain
- WORM appliance
- real-time analytics dashboard
- audit-log editing
- routine read-event logging
- one audit row per runtime blocklist match
- full chat-message duplication
- full evidence duplication
- indefinite retention unless policy chooses it

# Acceptance Criteria

## 97. AC-01 — Admin Actor

Every audited Admin mutation records the exact Admin actor ID.

## 98. AC-02 — Action

Every audit record has a stable event/action type.

## 99. AC-03 — Target

Consequential target mutations identify the affected resource by stable ID where available.

## 100. AC-04 — Timestamp

Every Audit Log uses a server-generated timestamp.

## 101. AC-05 — Immutable

Normal Admin UI/API cannot edit or delete Audit Log records.

## 102. AC-06 — Async

Audit writing does not require the primary Admin HTTP action to wait for final AuditLogs persistence.

## 103. AC-07 — Primary Action Independence

Temporary audit-writer failure does not roll back an already-committed business action.

## 104. AC-08 — Durable Recovery

Audit events are not silently lost when asynchronous writing temporarily fails.

## 105. AC-09 — Idempotent Retry

Retrying the same audit event does not create uncontrolled duplicates.

## 106. AC-10 — Registration Decisions

Account registration approval/rejection actions create appropriate Audit events.

## 107. AC-11 — User Lifecycle

Suspend/restore/deactivate actions create appropriate Audit events.

## 108. AC-12 — Seller Compliance

Warning/suspension/product-removal actions create appropriate Audit events.

## 109. AC-13 — Complaint Decision

Binding complaint decisions create Audit events.

## 110. AC-14 — Platform Settings

Announcement/policy publication creates Audit events.

## 111. AC-15 — Global Ban

Blocklist add/disable/reactivate actions create Audit events.

## 112. AC-16 — Notification Campaign

Outbound notification campaign send/queue creates an Audit event.

## 113. AC-17 — Runtime Blocklist Boundary

Routine blocked-request matches do not flood System Audit Logs.

## 114. AC-18 — Routine Read Boundary

Opening Dashboard/searching users does not create Audit events by default.

## 115. AC-19 — Secret Safety

Audit Logs never store passwords, tokens, OTPs, recovery codes, API keys, or payment secrets.

## 116. AC-20 — Evidence Safety

Complaint evidence binaries are referenced, not copied into Audit Logs.

## 117. AC-21 — Chat Safety

Full Admin Chat message bodies are not duplicated into Audit Logs by default.

## 118. AC-22 — Viewer Permission

Unauthorized Admins cannot view Audit Logs.

## 119. AC-23 — Pagination

Audit list is paginated/bounded.

## 120. AC-24 — No Third Party Required

MVP works using the internal AuditLogs table without an external logging service.

# Tests

## 121. Backend Tests

Test:

- guest denied from viewer
- non-Admin denied
- Admin without audit permission denied
- account approval produces event
- account rejection produces event
- user suspension produces event
- user restore produces event
- Seller warning produces event
- Seller suspension produces event
- complaint decision produces event
- policy publication produces event
- blocklist mutation produces event
- Notification Management campaign queue/send produces event
- exact actor Admin ID recorded
- target ID/type recorded
- server timestamp recorded
- before/after fields bounded
- passwords/tokens omitted
- payment secrets omitted
- evidence binaries omitted
- chat content omitted
- audit record cannot be updated through Admin API
- audit record cannot be deleted through Admin API
- failed async writer does not roll back domain action
- durable event can be retried
- duplicate event retry idempotent
- list search/filter works
- pagination works

## 122. Frontend Tests

Test:

- Audit Logs page loads
- loading state
- empty state
- error state
- newest-first list
- filter by Admin
- filter by event
- filter by source feature
- filter by date
- search target/event
- detail view
- before/after values displayed safely
- no Edit action
- no Delete action
- redacted/sensitive values not shown
- responsive layout
- keyboard accessibility

# Open Decisions

## 123. Open Decisions

Current sources do not define:

1. exact table/schema names
2. exact event naming convention
3. exact audit-view permission key
4. whether successful Admin login is audited here
5. whether failed login is audited here
6. actor IP storage
7. actor user-agent/device storage
8. field-level visibility
9. exact before/after schema
10. metadata structure
11. exact transactional outbox design
12. queue technology
13. retry count/backoff
14. dead-letter handling
15. retention duration
16. archival strategy
17. export capability for Audit Logs
18. sensitive-read auditing
19. financial export download auditing
20. cryptographic integrity controls
21. database-level append-only enforcement
22. external SIEM/log forwarding
23. external long-term archive
24. timezone/display format
25. whether Admin Chat high-level events are audited
26. whether campaign completion creates a second Audit event

# Final Definition

## 124. Final Definition

AISLEY System Audit Logs is:

```text
an immutable, time-stamped,
Admin accountability ledger
```

It records:

```text
who
did what
to which resource
when
```

Core architecture:

```text
Admin business action
→ commit authoritative change
→ durable audit event
→ asynchronous writer
→ internal AuditLogs table
```

Critical reliability rule:

```text
audit writer failure
must not roll back
an already committed primary Admin action
```

Critical security rule:

```text
Audit Logs are append-only/read-only
for normal Admin workflows
and never contain secrets.
```

Third-party rule:

```text
external logging service = optional

internal AuditLogs table = sufficient for MVP
```
