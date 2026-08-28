---
feature: System Audit Logs
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Admin Web Application / Shared Admin Infrastructure
source_coverage: Current AISLEY project requirements; may be updated as additional Admin operations and retention/security rules are defined
---

# System Audit Logs Specification

## 1. Purpose

This document defines the **AISLEY System Audit Logs** feature.

System Audit Logs is the platform's immutable administrative accountability ledger. It records meaningful operations performed by Admin users so that AISLEY can determine:

```text
who performed an administrative action
what resource/data was affected
what changed
when the action occurred
```

The feature exists for:

```text
security
accountability
abuse-of-power prevention
post-incident investigation / forensics
administrative traceability
```

This specification is grounded in the current AISLEY project documents:

- `app.md`
- `Admin.md`
- `Buyer.md`
- `Seller.md`
- `Logistics.md`
- `Courier.md`

The most direct source is `Admin.md`, which explicitly requires:

```text
an immutable, time-stamped ledger
recording every administrative operation
```

and requires Admin operations to trigger:

```text
middleware that asynchronously writes to this log
without failing the primary request
```

The source also requires an audit trail of Admin messages/actions during complaint and dispute resolution.

Where the source documents do not define exact retention periods, export requirements, cryptographic tamper-proofing, read-access auditing, actor IP/device storage, event names, or legal/compliance policies, this specification treats them as implementation choices or open decisions rather than inventing requirements.

---

# 2. Core Value

`Admin.md` defines:

```text
System Audit Logs

Core Value:
Track administrative actions and changes made within the system
for security and accountability.
```

Expanded:

```text
immutable
time-stamped
ledger
```

that records:

```text
who performed an action
what data was altered
when it occurred
```

The feature is designed to:

```text
prevent abuse of power
facilitate post-incident forensics
```

---

# 3. Goals

System Audit Logs must:

1. record meaningful administrative operations
2. identify the Admin actor
3. identify the affected resource
4. record the action performed
5. record the time of the action
6. preserve relevant before/after change context where safe and useful
7. remain immutable through normal application workflows
8. provide an Admin-facing audit-log viewer
9. support investigation through filtering/search
10. support multiple Admin accounts
11. integrate with custom Admin permissions
12. capture actions from all Admin modules
13. write asynchronously without failing the primary request
14. remain reliable despite temporary queue/logging-service failures
15. avoid storing passwords, tokens, secrets, or raw evidence
16. minimize unnecessary sensitive PII
17. preserve references to authoritative source records
18. support historical accountability after the source record changes
19. distinguish audit records from notifications
20. distinguish audit records from ordinary application/server logs
21. support complaint/dispute resolution accountability
22. support post-incident investigation
23. make it difficult for ordinary Admins to alter or erase historical audit records

---

# 4. Non-Goals

System Audit Logs does not itself implement:

- account approval
- user-account status changes
- Seller Compliance enforcement
- complaint/dispute decisions
- report calculations
- platform settings changes
- Admin messaging
- Admin authentication
- security blocklist enforcement
- push notification campaigns
- Courier dispatch
- Logistics status updates
- ordinary application error logging
- performance monitoring
- analytics telemetry
- user activity tracking
- full SIEM implementation
- legal discovery workflow
- cryptographic notarization
- blockchain logging
- external compliance certification
- automatic incident response
- automated fraud detection
- user-facing history
- full event-sourcing architecture

Audit Logs records administrative operations; it does not own those operations.

---

# 5. Primary Actor

## 5.1 Admin as Audit Actor

Admin users perform the operations that generate audit records.

AISLEY supports:

```text
initial Admin
    ↓
additional Admins
    ↓
custom permissions
```

Therefore, every audit record must identify the specific Admin identity that performed the action.

Do not store only:

```text
role = ADMIN
```

without the actor account identifier.

---

# 6. Audit Viewer User

An authorized Admin may view Audit Logs.

The ability to view the logs should itself be controlled by Admin authorization.

Not every Admin necessarily needs full audit-log visibility if future custom permissions restrict it.

---

# 7. System Boundary

System Audit Logs is a **cross-cutting Admin infrastructure feature**.

It receives audit events from:

```text
Admin Auth / Account Administration
Account Approval
Manage User Accounts
Seller Compliance
Complaints & Disputes
Reports Overview
Manage Platform Settings
Admin Chat/Messaging
Admin Account Management
Global Ban/Blocklist
Push Notification Management
future Admin modules
```

It must not embed each feature's business rules.

---

# 8. Audit Log vs Business Data

An audit record is not the authoritative business record.

Example:

```text
Account Approval
    authoritative state = registration.status

Audit Log
    historical evidence that Admin changed status
```

If the audit record says:

```text
PENDING → APPROVED
```

the current account status must still come from the Account Approval/User domain.

---

# 9. Audit Log vs Notification

These are separate systems.

```text
Admin Notification
    tells an Admin what needs attention

Audit Log
    records what an Admin did
```

Example:

```text
New Seller registration
    → Admin Notification

Admin approves Seller
    → Audit Log
```

Reading a notification is not equivalent to approving the registration.

---

# 10. Audit Log vs Application Log

Do not confuse:

```text
System Audit Log
```

with:

```text
server error log
request log
debug log
performance log
```

Application logs may record technical information.

Audit Logs record security-relevant administrative actions.

---

# 11. Audit Log vs User History

Manage User Accounts may show a user-specific administrative history.

That view may be derived from Audit Logs, but System Audit Logs remains the centralized immutable source.

---

# 12. Audit Log vs Complaint Timeline

Complaints & Disputes may maintain:

```text
case timeline
messages
resolution history
```

System Audit Logs separately records Admin actions for accountability.

One Admin action may appear in both:

```text
case timeline
audit ledger
```

without making them the same data model.

---

# 13. Immutability Requirement

`Admin.md` explicitly requires:

```text
immutable
```

Therefore, normal application behavior must not allow Admins to:

```text
edit an audit record
rewrite an audit record
delete an audit record
change its actor
change its timestamp
change its payload
```

after persistence.

---

# 14. No Normal CRUD

Audit Logs is not a normal CRUD module.

The Admin UI should support:

```text
Read
Search
Filter
Inspect
```

but not:

```text
Update
Delete
```

for ordinary audit entries.

---

# 15. Exceptional Retention Deletion

If future legal/privacy policy requires audit retention/deletion, that process must be:

```text
system-controlled
policy-driven
privileged
separately audited where feasible
```

It must not be a normal "Delete Log" button.

The current source does not define audit retention deletion.

---

# 16. Time-Stamped Requirement

Every audit record must contain an authoritative timestamp.

Recommended:

```text
occurred_at
```

and optionally:

```text
recorded_at
```

if asynchronous audit persistence can occur later than the business action.

---

# 17. Event Time vs Write Time

Because writes are asynchronous:

```text
Admin action occurs
    ↓
audit event queued
    ↓
audit record persisted later
```

the system should preserve the original action time.

Recommended:

```text
occurred_at = business/Admin action time
created_at = audit record persistence time
```

This avoids queue delay changing the historical event time.

---

# 18. Actor Requirement

Every Admin-generated audit event should identify:

```text
actor Admin user id
actor role
safe actor display snapshot where useful
```

The Admin user ID is the authoritative relationship.

---

# 19. Actor Snapshot

A safe actor name/email snapshot can help historical readability if the Admin later changes profile information.

Example:

```text
actor_id: 17
actor_name: "Admin Name"
```

Whether to snapshot email is an open privacy decision.

The actor relationship should still be retained where possible.

---

# 20. Target Requirement

Every audit action should identify the affected resource where applicable.

Conceptual:

```text
target_type
target_id
```

Examples:

```text
REGISTRATION
USER
SELLER
PRODUCT
COMPLIANCE_CASE
COMPLAINT_CASE
PLATFORM_POLICY
ANNOUNCEMENT
BLOCKLIST_ENTRY
REPORT_EXPORT
ADMIN_ACCOUNT
PUSH_CAMPAIGN
MESSAGE_THREAD
```

Exact values should follow codebase conventions.

---

# 21. Action Requirement

Each audit record must contain a stable action identifier.

Recommended naming pattern:

```text
DOMAIN_ACTION
```

Examples:

```text
ACCOUNT_REGISTRATION_APPROVED
USER_SUSPENDED
SELLER_WARNING_ISSUED
PRODUCT_REMOVED
COMPLAINT_RESOLVED
PLATFORM_POLICY_UPDATED
```

Exact taxonomy should be centralized.

---

# 22. Human-Readable Summary

In addition to a machine action identifier, the system may store or derive a human-readable summary.

Example:

```text
Admin suspended Seller account.
```

Do not rely solely on free-form text for filtering/reporting.

---

# 23. What Changed

`Admin.md` explicitly requires:

```text
what data was altered
```

Therefore, for mutations, Audit Logs should record a safe change representation.

Recommended:

```text
before
after
changed_fields
```

where appropriate.

---

# 24. Before/After Example

For an account status change:

```json
{
  "before": {
    "account_status": "ACTIVE"
  },
  "after": {
    "account_status": "SUSPENDED"
  }
}
```

For registration approval:

```json
{
  "before": {
    "registration_status": "PENDING"
  },
  "after": {
    "registration_status": "APPROVED"
  }
}
```

---

# 25. Minimal Change Payload

Do not copy the full database row when only one field changed.

Preferred:

```text
changed field(s) only
```

This reduces:

- sensitive PII duplication
- audit database size
- accidental secret storage

---

# 26. Sensitive Data Exclusion

Audit payloads must never include:

```text
plaintext password
password hash
Bearer token
personal access token plaintext
session id
remember token
CSRF secret
2FA secret
2FA recovery codes
private API keys
payment credentials
full card/bank details
raw authentication cookies
```

---

# 27. Evidence File Exclusion

Complaints and Seller Compliance may involve private files/evidence.

Do not store:

```text
raw evidence binary
full evidence contents
private file URL with reusable secret
```

inside the Audit Log.

Instead store:

```text
evidence id/reference
case id
action performed
```

where needed.

---

# 28. PII Minimization

Audit Logs should store enough information for accountability without becoming an uncontrolled duplicate of user PII.

Prefer:

```text
target_id
field name
masked/safe value when necessary
```

over copying:

```text
full profile
full address
full license
full payout details
```

---

# 29. Sensitive Field Changes

If Admin changes a sensitive value, the audit record may log:

```text
field changed
```

without storing full old/new secret values.

Example:

```json
{
  "changed_fields": ["payout_method"],
  "before": {
    "payout_method": "[REDACTED]"
  },
  "after": {
    "payout_method": "[REDACTED]"
  }
}
```

Exact masking policy is an open security decision.

---

# 30. Source Feature

Recommended field:

```text
source_feature
```

Examples:

```text
ACCOUNT_APPROVAL
USER_ACCOUNTS
SELLER_COMPLIANCE
COMPLAINTS_DISPUTES
REPORTS
PLATFORM_SETTINGS
ADMIN_MESSAGING
ADMIN_ACCOUNT
BLOCKLIST
PUSH_NOTIFICATIONS
```

This helps filtering and investigations.

---

# 31. Correlation Identifier

A correlation/request identifier is recommended for tying together related technical/business actions.

Possible fields:

```text
request_id
correlation_id
operation_id
```

This is not explicitly required by the source but improves forensics.

---

# 32. Request Context

Optional safe request context may include:

```text
IP address
user agent
session/device reference
request id
```

The source does not require these fields.

If stored, they should follow privacy/security policy.

Do not make IP/device data mandatory without a defined retention purpose.

---

# 33. Audit Record Logical Model

Recommended conceptual structure:

```text
id
event_id
occurred_at
recorded_at

actor:
    admin_user_id
    safe actor snapshot

action
source_feature

target:
    type
    id
    safe reference

changes:
    before
    after
    changed_fields

metadata:
    safe domain references
    optional request/correlation context
```

This is a logical specification, not a mandated table layout.

---

# 34. Dedicated AuditLogs Table

`Admin.md` explicitly allows:

```text
dedicated AuditLogs table
```

A relational implementation might include:

```text
audit_logs
```

with JSON fields for:

```text
before_data
after_data
metadata
```

if consistent with the repository.

---

# 35. External Logging Service

`Admin.md` also allows:

```text
external logging service
```

If used, the application must still provide:

```text
reliable write path
authorized query/view capability
immutable semantics
```

for the Admin Audit Logs feature.

---

# 36. Storage Choice

The specification does not mandate:

```text
database table
external service
hybrid storage
```

The implementation should choose based on:

```text
reliability
query requirements
scale
immutability
security
operational cost
```

---

# 37. Write Architecture

The source explicitly requires asynchronous audit writing.

Recommended flow:

```text
Admin business action
        ↓
business transaction succeeds
        ↓
audit event emitted / queued
        ↓
primary request returns
        ↓
audit worker persists immutable record
```

---

# 38. Primary Request Must Not Fail

The source explicitly says audit writes should occur:

```text
without failing the primary request
```

Therefore:

```text
temporary Audit Log storage failure
```

must not normally turn a successful:

```text
account approval
seller suspension
complaint resolution
```

into a failed user-visible business operation.

---

# 39. Reliability Requirement

"Asynchronous" must not mean:

```text
best effort and silently drop events
```

Important audit events require reliable persistence.

Recommended infrastructure:

```text
transactional outbox
reliable queue
retry
dead-letter handling
monitoring
```

The exact mechanism is an architecture decision.

---

# 40. Transactional Outbox Recommendation

To reduce the risk:

```text
business action commits
but audit event disappears
```

a transactional outbox is recommended.

Conceptually:

```text
business DB transaction:
    mutate domain
    write audit-event/outbox entry

commit
    ↓
worker publishes/persists Audit Log
```

This satisfies asynchronous processing while improving reliability.

---

# 41. Retry

Audit persistence should retry transient failures.

Exact retry count/backoff is not defined.

Failures should be observable.

---

# 42. Dead-Letter Handling

If an audit event cannot be persisted after retries, the system should retain it for operator investigation.

Exact dead-letter architecture is not defined.

---

# 43. Duplicate Delivery

Async queues may deliver an event more than once.

Audit persistence must avoid accidental duplicate records where event identity is known.

Recommended:

```text
event_id unique
```

or equivalent idempotency key.

---

# 44. Audit Event ID

Every audit operation should have a unique immutable event identifier.

This helps:

```text
deduplication
correlation
investigation
```

---

# 45. Ordering

Global strict ordering across all Admin operations may be expensive.

At minimum, the viewer should sort by:

```text
occurred_at
```

with stable tie-breaking such as:

```text
id/event_id
```

The source does not require globally serialized events.

---

# 46. Clock Source

Use server-authoritative timestamps.

Do not trust a browser-provided audit timestamp.

---

# 47. Timezone

Persist timestamps in the application's canonical server format, preferably an unambiguous standard such as UTC if consistent with the project.

Render in the Admin application's chosen timezone.

The source does not define timezone rules.

---

# 48. Admin Auth Integration

Admin authentication itself produces a security-relevant event after a successful active-Admin login.

The source defines Audit Logs as:

```text
every administrative operation
```

but does not explicitly list login/logout as audit events.

Implemented security event:

```text
ADMIN_LOGIN_SUCCEEDED
```

Possible future security events:

```text
ADMIN_LOGOUT
ADMIN_LOGIN_FAILED
ADMIN_CREDENTIAL_CHANGED
```

Successful Admin logins must identify the authenticated Admin account, including the currently viewing Admin's own login. Customer, Seller, Courier, inactive-Admin, and failed authentication attempts are not recorded as successful Admin login events. Whether failed login attempts or logout events belong in this Admin Audit Log or a dedicated security log remains an open decision.

---

# 49. Account Approval Integration

Account Approval must generate audit events for:

```text
ACCOUNT_REGISTRATION_APPROVED
ACCOUNT_REGISTRATION_REJECTED
```

Each should identify:

```text
Admin actor
registration/account
role
previous status
new status
time
```

Do not store applicant password data.

---

# 50. Approval Example

```text
Admin #7
approved
Seller Registration #128
PENDING → APPROVED
at timestamp
```

---

# 51. Rejection Example

```text
Admin #7
rejected
Logistics Registration #144
PENDING → REJECTED
at timestamp
```

If rejection notes exist, audit only safe references/content according to visibility policy.

---

# 52. Manage User Accounts Integration

User Account actions that should be audited include:

```text
user profile updated
user suspended
user access restored
user deactivated
user deleted if supported
user created if Admin creation is supported
```

---

# 53. User Update Diff

For profile updates, record only permitted changed fields.

Example:

```json
{
  "changed_fields": ["display_name", "contact_number"]
}
```

Do not dump the entire User row.

---

# 54. User Suspension Event

Recommended:

```text
USER_SUSPENDED
```

Record:

```text
target user id
target role
previous access state
new access state/restriction
suspension source
```

if available.

---

# 55. User Restore Event

Recommended:

```text
USER_ACCESS_RESTORED
```

Record which restriction changed.

Do not falsely log:

```text
user fully active
```

if other restrictions remain.

---

# 56. User Deactivation Event

Recommended:

```text
USER_DEACTIVATED
```

Preserve role context because identical emails may exist across roles.

---

# 57. Seller Compliance Integration

Seller Compliance actions must be auditable.

Source-backed actions include:

```text
product verified/reviewed
formal warning issued
Seller temporarily suspended
non-compliant product permanently removed
```

---

# 58. Seller Warning Event

Recommended:

```text
SELLER_WARNING_ISSUED
```

Record:

```text
seller id
compliance case id
product id if relevant
policy reference if available
Admin actor
```

Do not copy the entire Seller message into Audit Log unless policy explicitly requires it.

Prefer message/thread reference.

---

# 59. Seller Suspension Event

Recommended:

```text
SELLER_SUSPENDED
```

Record:

```text
Seller
compliance case
previous restriction state
new restriction state
```

Product visibility side effects may be referenced through the main action.

Do not generate one Audit Log row per product merely because products become hidden, unless the system specifically needs per-product forensic events.

---

# 60. Product Removal Event

Recommended:

```text
PRODUCT_REMOVED_FOR_COMPLIANCE
```

Record:

```text
product id
seller id
compliance case id
previous moderation/visibility state
new moderation state
```

---

# 61. Compliance Case Status Event

Important case lifecycle changes may be audited:

```text
COMPLIANCE_CASE_RESOLVED
COMPLIANCE_CASE_DISMISSED
```

Exact event taxonomy is an open decision.

---

# 62. Complaints and Disputes Integration

`Admin.md` explicitly requires:

```text
audit trail of messages and actions
taken by the administrator
during the resolution process
```

This makes complaint/dispute auditing a direct source requirement.

---

# 63. Complaint Events

Recommended audit events include:

```text
COMPLAINT_REVIEW_STARTED
COMPLAINT_STATUS_CHANGED
COMPLAINT_INFORMATION_REQUESTED
COMPLAINT_RESOLVED
COMPLAINT_CLOSED
COMPLAINT_REFERRED_TO_SELLER_COMPLIANCE
```

Exact naming is implementation-defined.

---

# 64. Complaint Resolution Event

A binding decision must preserve:

```text
Admin actor
complaint case
previous case state
new case state
resolution reference
resolved time
```

Do not copy private evidence into the Audit Log.

---

# 65. Complaint Messaging Audit

The source requires an audit trail of Admin messages/actions.

Two valid approaches are:

```text
1. Messaging system preserves immutable/history records
   and Audit Log stores message action/reference.

2. Audit Log records an Admin message event
   with thread/message id and safe metadata.
```

Avoid duplicating entire message bodies unnecessarily.

---

# 66. Evidence Access

The source does not explicitly require auditing evidence views/downloads.

This may be desirable for sensitive evidence.

If implemented:

```text
EVIDENCE_VIEWED
EVIDENCE_DOWNLOADED
```

should record only evidence/case references, not evidence content.

This remains an open security decision.

---

# 67. Reports Overview Integration

Reports are primarily read-only.

Source-backed Admin operations include:

```text
large financial export generation
```

Recommended audit event:

```text
FINANCIAL_REPORT_EXPORT_REQUESTED
```

and optionally:

```text
FINANCIAL_REPORT_EXPORT_COMPLETED
FINANCIAL_REPORT_EXPORT_DOWNLOADED
```

Whether simple report views are audited is not source-defined.

---

# 68. Report Export Audit Data

Safe metadata may include:

```text
report type
date period
filter summary
format
export id
```

Avoid copying the entire financial report into the Audit Log.

---

# 69. Manage Platform Settings Integration

Platform Settings can:

```text
post announcements
update Terms of Service
update Privacy Policy
update internal rules
trigger re-consent
```

These are significant global Admin operations and must be audited.

---

# 70. Announcement Events

Recommended:

```text
ANNOUNCEMENT_CREATED
ANNOUNCEMENT_UPDATED
ANNOUNCEMENT_PUBLISHED
ANNOUNCEMENT_UNPUBLISHED
```

depending on the final CMS lifecycle.

---

# 71. Policy Events

Recommended:

```text
TERMS_UPDATED
PRIVACY_POLICY_UPDATED
PLATFORM_RULE_UPDATED
```

Record:

```text
policy id/version/reference
previous version
new version
re-consent flag change
```

Do not duplicate full policy text into every audit record if version references are sufficient.

---

# 72. Re-Consent Event

If a policy update sets:

```text
requires re-consent
```

the Admin action that triggered the flag should be audited.

Do not generate one Admin audit event per affected user unless required.

---

# 73. Admin Chat/Messaging Integration

Admin messaging is used for:

```text
support
account anomalies
compliance explanations
```

and requires historical archiving.

Possible audit events:

```text
ADMIN_MESSAGE_SENT
ADMIN_THREAD_CREATED
```

Whether every Admin message is duplicated into Audit Logs is an open decision.

At minimum, message history itself must remain accountable.

---

# 74. Messaging Data Minimization

If message events are audited, store:

```text
thread id
message id
target user id
timestamp
```

rather than full message body where possible.

---

# 75. Admin Account Management Integration

Admin Account Management allows:

```text
profile updates
login credential updates
preferences
security settings
2FA
```

Security-relevant Admin account changes should be audited.

---

# 76. Admin Profile Event

Recommended:

```text
ADMIN_PROFILE_UPDATED
```

Record safe changed fields.

---

# 77. Admin Credential Event

Recommended:

```text
ADMIN_CREDENTIAL_CHANGED
```

Never store:

```text
old password
new password
password hash
```

in the audit payload.

---

# 78. Admin 2FA Event

If 2FA exists:

```text
ADMIN_2FA_ENABLED
ADMIN_2FA_DISABLED
```

should be security-audited.

Do not store the secret.

---

# 79. Global Ban/Blocklist Integration

Blocklist operations are security-sensitive.

Recommended events:

```text
BLOCKLIST_ENTRY_ADDED
BLOCKLIST_ENTRY_UPDATED
BLOCKLIST_ENTRY_REMOVED
```

Exact categories may include:

```text
user
IP
payment method
```

but audit payloads must protect sensitive payment data.

---

# 80. Blocked User Event

If a user is added to a blocklist:

```text
target user id
reason/reference if policy defines it
Admin actor
```

should be recorded.

---

# 81. IP Block Event

If IP addresses are stored in audit payloads, they are security/privacy data and should follow retention/access policies.

The source does not define masking.

---

# 82. Payment Method Block Event

Do not store raw payment credentials.

Use:

```text
tokenized payment method id
fingerprint/reference
masked identifier
```

from the payment/security domain.

---

# 83. Push Notification Management Integration

Outbound Admin campaigns are administrative operations.

Recommended events:

```text
PUSH_CAMPAIGN_CREATED
PUSH_CAMPAIGN_UPDATED
PUSH_CAMPAIGN_SENT
PUSH_CAMPAIGN_CANCELLED
```

where supported.

---

# 84. Campaign Audit Metadata

Safe fields:

```text
campaign id
audience/segment reference
channel
scheduled/sent time
template/message reference
```

Avoid storing full recipient lists in each Audit Log record.

---

# 85. Admin Notifications Integration

Admin Notifications is mainly an inbound alert feed.

Routine:

```text
notification read
```

does not need to be audited by default.

Critical notification acknowledgement may be audited if future safety/security policy requires it.

This is an open decision.

---

# 86. Dashboard Integration

The Dashboard itself is primarily read-only.

Routine page views do not need Audit Log entries by default.

Actions initiated from Dashboard shortcuts must be audited by the owning feature.

Example:

```text
Dashboard → registration detail → Approve
```

Audit source:

```text
Account Approval
```

not:

```text
Dashboard clicked
```

---

# 87. Read Operations

The source says:

```text
every administrative operation
```

but specifically emphasizes:

```text
what data was altered
```

Therefore, MVP Audit Logs should prioritize **mutating/security-sensitive Admin operations**.

Routine read-only views do not need to be logged unless security policy defines them.

---

# 88. Sensitive Read Auditing

Potential future read events:

```text
viewed private complaint evidence
downloaded financial export
viewed highly sensitive PII
```

may merit auditing.

These are not explicitly source-required and should be decided by security policy.

---

# 89. System-Generated Actions

Some Admin-triggered actions produce asynchronous system consequences.

Example:

```text
Admin suspends Seller
    ↓
system hides Seller products
```

The primary Admin Audit Log should record:

```text
Admin suspension action
```

The system may separately record internal technical events if needed, but those are not necessarily Admin Audit Logs.

---

# 90. Actor Types

System Audit Logs is focused on:

```text
administrative actions
```

The primary actor type is Admin.

If future automated Admin processes need entries, a controlled actor type may include:

```text
SYSTEM
```

with:

```text
initiated_by_admin_id
```

where applicable.

The source does not require system actors.

---

# 91. Impersonation

AISLEY currently does not define Admin impersonation.

Do not add impersonation-specific audit behavior until such a feature exists.

If introduced, every impersonated action would require explicit actor/subject distinction.

---

# 92. Audit Log Viewer Route

Recommended route:

```text
/audit-logs
```

Navigation label:

```text
System Audit Logs
```

---

# 93. Audit Log List

Recommended layout:

```text
System Audit Logs

Search ______________________

Filters:
Admin
Feature
Action
Target Type
Date Range

-------------------------------------------------------------------
Time        Admin       Feature         Action              Target
-------------------------------------------------------------------
...
```

The exact UI follows the Admin design system.

---

# 94. Default Ordering

Recommended:

```text
newest occurred_at first
```

This supports incident investigation.

---

# 95. Audit Row

Recommended summary fields:

```text
occurred time
Admin actor
source feature
action
target type
target reference
```

Do not show huge JSON diffs in the table.

---

# 96. Audit Detail

Selecting an audit record should show:

```text
event id
occurred time
recorded time if different
Admin actor
feature
action
target
safe before/after change
safe metadata
correlation/request reference if available
```

---

# 97. Read-Only UI

The audit detail must not offer:

```text
Edit
Delete
Rewrite
Change Actor
Change Time
```

---

# 98. Search

Recommended server-side search fields:

```text
event id
Admin name/email if safely indexed
target reference
action identifier
```

Full-text searching arbitrary JSON payloads is optional and may be expensive.

---

# 99. Admin Filter

Filter by:

```text
actor_admin_id
```

This is critical for investigations into actions performed by a specific Admin.

---

# 100. Feature Filter

Recommended:

```text
Account Approval
User Accounts
Seller Compliance
Complaints & Disputes
Reports
Platform Settings
Messaging
Admin Account
Blocklist
Push Notifications
```

---

# 101. Action Filter

Support filtering by stable machine action identifiers.

Do not filter only on localized/free-form summary text.

---

# 102. Target Type Filter

Recommended target categories:

```text
USER
REGISTRATION
SELLER
PRODUCT
COMPLIANCE_CASE
COMPLAINT_CASE
REPORT_EXPORT
POLICY
ANNOUNCEMENT
BLOCKLIST_ENTRY
ADMIN_ACCOUNT
CAMPAIGN
```

Only use actual implemented target types.

---

# 103. Date Range Filter

Audit investigations require time-bound queries.

Recommended:

```text
from
to
```

Use server-authoritative timestamp boundaries.

---

# 104. Sorting

MVP can support:

```text
occurred_at descending
occurred_at ascending
```

Additional sorting is optional.

---

# 105. Pagination

Audit Logs must be paginated or cursor-based.

The log is append-only and potentially very large.

Do not load all records into the browser.

---

# 106. Cursor Pagination

Cursor pagination by:

```text
occurred_at
id
```

is recommended for large append-only datasets.

Offset pagination is acceptable if project conventions and scale allow it.

---

# 107. Recommended API — List Audit Logs

Conceptual:

```http
GET /api/admin/audit-logs
```

Possible parameters:

```text
actor_id
source_feature
action
target_type
target_id
search
from
to
cursor
page
per_page
sort
```

Exact route/parameter names follow repository conventions.

---

# 108. Recommended API — Audit Detail

Conceptual:

```http
GET /api/admin/audit-logs/{eventId}
```

Requirements:

- authenticated Admin
- Audit Log view permission
- safe payload
- immutable read-only result

---

# 109. No Audit Update API

There should be no normal endpoint such as:

```http
PATCH /api/admin/audit-logs/{id}
```

---

# 110. No Audit Delete API

There should be no normal Admin endpoint such as:

```http
DELETE /api/admin/audit-logs/{id}
```

Retention jobs, if ever required, are separate system-level operations.

---

# 111. Recommended Audit Event DTO

Conceptual:

```json
{
  "id": "audit-event-id",
  "occurred_at": "timestamp",
  "recorded_at": "timestamp",
  "actor": {
    "id": "admin-id",
    "name": "Admin Name"
  },
  "source_feature": "USER_ACCOUNTS",
  "action": "USER_SUSPENDED",
  "target": {
    "type": "USER",
    "id": "user-id",
    "role": "SELLER"
  },
  "changes": {
    "before": {
      "account_status": "ACTIVE"
    },
    "after": {
      "account_status": "SUSPENDED"
    }
  }
}
```

This is a conceptual contract, not a mandated schema.

---

# 112. Safe Metadata

Optional metadata can include:

```text
registration role
compliance case id
complaint case id
report export id
policy version
message thread id
```

Keep metadata small and non-secret.

---

# 113. Action Taxonomy Centralization

Audit action identifiers should be defined centrally.

Avoid each controller inventing inconsistent strings:

```text
"suspend"
"suspended_user"
"user-suspension"
```

for the same operation.

---

# 114. Versioning Action Names

Once used in persistent audit history, action identifiers should remain stable.

If semantics change, introduce a new version/action if necessary rather than rewriting history.

---

# 115. Schema Evolution

Audit records may outlive application schema changes.

Audit payload design should tolerate old events.

Recommended:

```text
event version
```

optional field, such as:

```text
schema_version: 1
```

This is an implementation recommendation.

---

# 116. Before/After Serialization

Only serialize:

```text
safe relevant fields
```

not entire ORM models.

Avoid recursive relationships.

---

# 117. Null / Removed Values

For deletion/deactivation, before/after representation may indicate:

```text
previous value
new status
```

rather than dumping deleted entity content.

---

# 118. Delete Audit Event

If hard delete is ever permitted:

```text
USER_DELETED
```

should preserve enough safe identity/reference data to know what was removed.

Do not depend on a foreign key that disappears without retaining a safe target snapshot/reference.

---

# 119. Immutability at Application Layer

Application code should expose AuditLog models/entities as read-only.

Avoid generic repository methods that allow update/delete.

---

# 120. Immutability at Database Layer

Where practical, strengthen immutability using:

```text
restricted DB permissions
append-only table access
database triggers/policies
external immutable logging
```

The source does not mandate a specific method.

---

# 121. Administrator Deletion Risk

An ordinary Admin should not be able to erase evidence of their own actions.

This is central to the feature's abuse-prevention purpose.

---

# 122. Privileged Maintenance

Database/system operators may technically have infrastructure-level access.

Application-level immutability should still prevent Admin UI/API manipulation.

Stronger tamper-evident infrastructure may be added later.

---

# 123. Tamper Evidence

The source requires immutable logs but does not explicitly require cryptographic tamper evidence.

Possible future mechanisms:

```text
hash chaining
signed log batches
WORM storage
external SIEM
```

These are not MVP requirements unless security policy elevates them.

---

# 124. Retention

The source does not define audit-log retention.

Because the feature supports forensics, retention should be long enough for investigations.

Exact period is an open policy decision.

---

# 125. Archive Storage

If Audit Logs become large, old records may move to archive storage while remaining retrievable for authorized investigations.

Not required for MVP.

---

# 126. Export

The source does not explicitly require Audit Log exports.

CSV/PDF export is therefore optional/future unless operational/security requirements request it.

Do not copy Reports Overview export requirements onto Audit Logs automatically.

---

# 127. Audit Log Dashboard KPI

The current Admin Dashboard spec does not require an Audit Log KPI.

Audit Logs belongs in Admin navigation but does not need a Dashboard card for MVP.

---

# 128. Security Alerts

Audit Logs can support post-incident investigation, but it is not itself the real-time Admin alert system.

Security alerts belong to:

```text
Admin Notifications
security monitoring
Global Ban/Blocklist
```

Audit data may later feed anomaly detection.

---

# 129. Audit Read Authorization

Recommended conceptual permission:

```text
VIEW_AUDIT_LOGS
```

Exact permission name is not defined.

---

# 130. Sensitive Audit Authorization

If some audit events contain highly sensitive metadata, the platform may require more granular access.

Example:

```text
financial export events
security blocklist events
Admin credential events
```

Field/event-level policies are open decisions.

---

# 131. Self-Visibility

The source does not define whether an Admin may view only:

```text
their own events
```

or:

```text
all Admin events
```

The feature's forensic/accountability purpose suggests authorized security/super-admin users need cross-Admin visibility.

Exact permission scope is open.

---

# 132. Initial Admin

The initial Admin is created from environment credentials.

Bootstrap creation itself may be logged as a system/bootstrap event if Audit Logs exists at that time.

This is not source-required.

---

# 133. Additional Admin Creation

`app.md` says initial Admin can:

```text
add Admins with custom permissions
```

Creating/updating an Admin account or permission set is highly security-relevant and should be audited once that feature exists.

Recommended:

```text
ADMIN_CREATED
ADMIN_PERMISSION_CHANGED
ADMIN_DEACTIVATED
```

---

# 134. Permission Change Audit

An Admin permission change should record:

```text
actor Admin
target Admin
safe before permission set/reference
safe after permission set/reference
time
```

Do not store secrets.

---

# 135. Permission Escalation Forensics

Permission changes are especially important for:

```text
post-incident investigation
```

because they can explain how an Admin gained access to later operations.

---

# 136. Account Approval Email

Approval/rejection sends an applicant email.

Audit Log should record the Admin decision.

Whether email-delivery success/failure is part of Audit Logs is not defined.

Email delivery telemetry can live in notification/job logs.

---

# 137. Notification Read Events

Routine Admin Notification read/unread actions are not important enough for MVP Audit Logs unless a critical acknowledgement policy defines them.

---

# 138. Courier/Logistics Operations Boundary

System Audit Logs is defined for **administrative operations**.

Routine Logistics/Courier operational actions such as:

```text
waybill scan
parcel transfer
delivery completion
Courier online toggle
```

are not automatically part of the Admin Audit Log.

They may have their own operational histories.

---

# 139. Admin-Initiated Cross-Domain Action

If an Admin directly performs a domain intervention, it should be audited.

Example:

```text
Admin manually changes user access
Admin resolves complaint
Admin removes Seller product
```

---

# 140. Read Receipts

Admin Chat/Messaging requires read receipts.

Those are messaging-domain data, not necessarily Audit Log events.

---

# 141. Background Job Events

Background processing of an Admin-triggered operation may have technical status logs.

Audit Logs should focus on the administrative operation and important outcome references.

Example:

```text
Admin requested report export
```

rather than every worker retry.

---

# 142. Failed Admin Mutations

The source focuses on actions/changes made.

Whether failed attempts should be audited is not explicitly defined.

Security-sensitive failed attempts may be useful.

Recommended future examples:

```text
unauthorized permission change attempt
failed Admin login
failed blocklist action
```

This remains an open security policy.

---

# 143. Successful vs Failed Action

MVP Audit Logs should reliably record successful administrative mutations.

Failed attempts may be recorded in:

```text
security logs
application logs
```

until policy decides which also belong in Audit Logs.

---

# 144. Audit Detail PII Rendering

The UI must apply masking/redaction rules even if safe audit data includes personal fields.

Example:

```text
contact_number changed
```

may be displayed masked if required.

---

# 145. JSON Rendering

If change metadata uses JSON, render it as structured:

```text
Field
Before
After
```

rather than raw unformatted JSON when possible.

---

# 146. Unknown Historical Fields

Old records may reference fields/actions removed from current code.

The Audit Viewer should still show:

```text
stored action identifier
stored safe metadata
```

rather than failing to render.

---

# 147. Deleted Target

A target may no longer exist.

Audit detail must remain readable using stored safe references.

Do not require successful current foreign-key lookup to display historical event.

---

# 148. Target Link

If current target still exists and Admin has permission:

```text
View target
```

may be offered.

If it no longer exists:

```text
Target no longer available
```

while preserving the audit record.

---

# 149. Target Authorization

Possessing Audit Log access does not automatically grant full access to every target feature.

If the UI links to a Complaint/User/Product:

```text
destination feature rechecks authorization
```

---

# 150. Search Security

Audit search must not leak sensitive metadata through autocomplete/error responses.

Search operates only within the Admin's authorized audit scope.

---

# 151. Indexing

Common Audit Log query fields should be indexed:

```text
occurred_at
actor_admin_id
source_feature
action
target_type
target_id
event_id
```

Exact index choices depend on schema/scale.

---

# 152. Append Performance

Audit writes should not significantly increase latency of primary Admin actions.

This directly aligns with asynchronous-write source requirements.

---

# 153. Viewer Performance

The Audit Viewer should:

- paginate
- avoid loading large payloads in list rows
- load detail on demand
- use indexed filters
- avoid N+1 actor/target queries
- preserve historical snapshots if targets are missing

---

# 154. High Volume

As AISLEY grows, Audit Logs can become one of the largest Admin datasets.

Architecture should support:

```text
append-heavy writes
time-range reads
filtered investigations
archive strategy later
```

---

# 155. Audit Payload Size

Keep each event compact.

Do not store:

```text
entire product catalog
full complaint conversation
full financial export
all hidden Seller products
```

inside one event.

Use references.

---

# 156. Error Handling — Viewer

Handle:

```text
audit list failure
audit detail failure
forbidden access
expired Admin session
unknown action type
missing target
old schema version
```

The viewer should not corrupt/delete records because rendering failed.

---

# 157. Error Handling — Writer

A writer failure should:

```text
retry
remain observable
not fail the already-successful primary business request
```

per source requirements.

---

# 158. Monitoring Audit Pipeline

Operational monitoring should detect:

```text
queue backlog
persistent audit write failures
dead-letter events
unexpected duplicate rate
storage failures
```

This monitoring is infrastructure, not part of the Admin Audit UI.

---

# 159. Data Integrity

Audit writes must accurately match committed business state.

Avoid:

```text
write "APPROVED"
then business transaction rolls back
```

Recommended ordering/outbox design should ensure audit events describe committed operations.

---

# 160. Event Creation Location

Do not scatter handcrafted AuditLog inserts in every React component.

Events should originate in backend domain/application services, middleware, or centralized audit hooks after successful authorization/business operations.

---

# 161. Middleware

`Admin.md` specifically mentions:

```text
middleware
```

for triggering audit writes across the Admin dashboard.

Middleware can capture common context:

```text
actor
request id
route
timestamp
```

but feature/domain code may still need to provide:

```text
action
target
safe before/after values
```

A hybrid design is recommended.

---

# 162. Generic Request Logging Is Insufficient

Simply recording:

```text
POST /api/admin/users/123/suspend
```

does not fully satisfy:

```text
what data was altered
```

Audit events need semantic business context.

---

# 163. Recommended Audit Service

Conceptual:

```text
AuditService.record(
    event_id,
    actor,
    action,
    source_feature,
    target,
    changes,
    metadata,
    occurred_at
)
```

The actual write can be queued.

---

# 164. Feature Helper

Features may call a typed audit event factory.

Example:

```text
UserSuspendedAuditEvent
RegistrationApprovedAuditEvent
ComplaintResolvedAuditEvent
```

This reduces inconsistent payloads.

---

# 165. Validation

Audit event creation should validate:

```text
action exists
actor exists
target reference shape valid
payload contains no prohibited secret fields
event id present
occurred_at valid
```

---

# 166. Secret Redaction Defense

Use defense-in-depth:

```text
feature-level allowlist
+
central AuditService redaction
```

to reduce the chance a password/token is accidentally serialized.

---

# 167. Common Redaction Keys

Recommended denylist safety net includes field names matching concepts such as:

```text
password
password_hash
token
access_token
refresh_token
remember_token
secret
api_key
authorization
cookie
session
2fa_secret
recovery_code
```

Field-name redaction is only a safety net; allowlisting is preferred.

---

# 168. File/Binary Redaction

Do not accept file/blob fields into audit payloads.

---

# 169. Audit Event Creation and Permissions

The audited Admin's permission state at the time of the action may be useful for forensics.

The source does not require snapshotting full permission sets.

Do not duplicate large permission structures in every event.

Permission-change events themselves are more important.

---

# 170. Actor Deactivated Later

If an Admin is later deactivated, their historical Audit Logs must remain.

---

# 171. Actor Deleted Later

If Admin hard deletion is ever allowed, preserve a safe actor snapshot so historical records remain attributable.

---

# 172. System Audit Log UI Access

Recommended:

```text
Super Admin / authorized security Admin
```

but exact role names/permissions are not defined.

---

# 173. Audit Viewer Filters — MVP

Required/recommended MVP filters:

```text
Date Range
Admin Actor
Feature
Action
Target Type
```

Optional:

```text
Target ID
Search
```

---

# 174. Detail Changes Table

Recommended UI:

```text
Changed Fields

Field             Before             After
------------------------------------------------
account_status    ACTIVE             SUSPENDED
```

For redacted values:

```text
payout_method     [REDACTED]         [REDACTED]
```

---

# 175. No Diff When Not Applicable

Some actions do not alter a single record field.

Example:

```text
financial report export requested
message sent
```

The Audit Detail may instead show:

```text
metadata/reference
```

with no before/after section.

---

# 176. Event Severity

The source does not define Audit Log severity.

Do not invent:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

for audit events unless a security classification is later defined.

---

# 177. Event Category

Feature/action categories are sufficient for MVP.

---

# 178. Audit Notes

Admins should not be able to append editable notes to an existing Audit Log record if that changes the immutable record.

If investigation notes are needed, use a separate incident/investigation system.

---

# 179. Export Future

If Audit Log export is later introduced, it must:

```text
respect audit permissions
preserve filter period
protect generated files
minimize sensitive values
```

Not required for MVP.

---

# 180. System Audit Logs and Forensics

For post-incident investigation, the system should allow reconstruction such as:

```text
Which Admin changed this account?
When was it changed?
What was its previous status?
What did it become?
Was there a complaint/compliance case?
What other Admin operations happened around the same time?
```

---

# 181. Cross-Feature Correlation

Correlation/target references should allow investigators to move between related events.

Example:

```text
Complaint #77 resolved
Seller Compliance #31 created
Product #991 removed
Seller #42 suspended
```

These may share:

```text
case reference
correlation id
target links
```

---

# 182. Account Approval Forensic Example

```text
10:02 — Admin A approved Seller registration #101
10:03 — approval email queued
```

The Admin decision is an Audit Log event.

Email queue status may remain in email/job logs.

---

# 183. Seller Compliance Forensic Example

```text
14:21 — Admin B reviewed Compliance Case #5
14:26 — Admin B issued warning to Seller #91
14:31 — Admin B removed Product #505
```

The audit system should preserve the Admin operations with relevant references.

---

# 184. Complaint Forensic Example

```text
09:10 — Admin C began reviewing Complaint #33
09:24 — Admin C requested more information
11:41 — Admin C resolved Complaint #33
11:42 — Admin C referred Seller to Compliance Case #18
```

---

# 185. User Account Forensic Example

```text
16:05 — Admin A suspended User #19 (SELLER)
18:10 — Admin D restored account-level restriction
18:10 — Seller Compliance restriction remained active
```

The Audit Log should make the distinct operations clear.

---

# 186. Platform Policy Forensic Example

```text
08:00 — Admin A published Terms version 4
08:00 — requires_reconsent changed false → true
```

---

# 187. Blocklist Forensic Example

```text
19:03 — Admin Security added User #82 to Global Blocklist
```

Target data should remain safely represented.

---

# 188. Push Campaign Forensic Example

```text
07:30 — Admin Marketing sent Push Campaign #24
Audience: segment reference
Channel: PUSH
```

No full recipient list in the audit record.

---

# 189. Audit Log Acceptance Philosophy

The feature is successful if AISLEY can answer:

```text
Who did it?
What did they do?
Which record/domain did it affect?
What changed?
When did it happen?
Can the record be trusted as historical evidence?
```

without exposing secrets or allowing ordinary Admin users to rewrite the answer.

---

# 190. MVP Scope

## Required for MVP

- immutable Admin audit records
- timestamped events
- Admin actor identity
- source feature
- stable action identifier
- target type/id/reference
- safe before/after changes where applicable
- safe metadata/references
- asynchronous write pipeline
- primary business request not failing due normal audit persistence delay/failure
- reliable retry/persistence strategy
- deduplication/idempotent event handling
- Admin Audit Log list
- Audit Log detail
- newest-first ordering
- date-range filter
- Admin actor filter
- feature filter
- action filter
- target type filter
- pagination
- Admin authorization
- PII minimization
- secret redaction
- no edit API
- no delete API
- Account Approval integration
- Manage User Accounts integration
- Seller Compliance integration
- Complaints & Disputes integration
- Platform Settings integration when implemented
- Admin Account security-change integration when implemented
- Blocklist integration when implemented
- Push Notification Management integration when implemented
- loading/empty/error states

## Recommended for MVP

- event/correlation ID
- target links
- structured before/after diff
- outbox-backed audit delivery
- dead-letter monitoring
- safe actor snapshot
- event schema version

## Not Required for MVP

- Audit Log export
- cryptographic hash chain
- blockchain
- external SIEM
- WORM archival
- legal hold management
- user-facing audit access
- audit analytics dashboard
- anomaly detection
- automatic threat response
- routine page-view logging
- logging every notification read
- logging every Logistics/Courier operational event
- full request/response capture
- raw evidence storage
- arbitrary Admin notes on audit entries

---

# 191. Functional Acceptance Criteria

## AC-01 — Admin Mutation Creates Audit Event

Given an authorized Admin successfully performs a source-backed administrative mutation, the system creates or reliably queues an Audit Log event for that operation.

## AC-02 — Immutable Record

Given an Audit Log event has been persisted, ordinary Admin APIs/UI cannot edit it.

## AC-03 — No Delete

Given an Audit Log event exists, ordinary Admin APIs/UI cannot delete it.

## AC-04 — Actor Recorded

Given an Admin performs an audited action, the event identifies the specific Admin account.

## AC-05 — Timestamp Recorded

Given an audited action occurs, the event preserves the authoritative action timestamp.

## AC-06 — Target Recorded

Given an Admin action affects a resource, the event records the affected target type/reference.

## AC-07 — Action Recorded

Given an Admin operation is audited, the event contains a stable machine-readable action identifier.

## AC-08 — Change Recorded

Given a mutation changes relevant fields, the event records safe before/after or changed-field information sufficient to understand the change.

## AC-09 — Secret Exclusion

Given an audited action touches authentication/security data, the Audit Log does not contain plaintext passwords, hashes, access tokens, session IDs, 2FA secrets, or recovery codes.

## AC-10 — PII Minimization

Given an Admin updates sensitive profile information, the Audit Log stores only the safe change representation necessary for accountability.

## AC-11 — Evidence Exclusion

Given an Admin resolves a Complaint with attached evidence, the Audit Log references the case/evidence identifiers where needed but does not copy raw evidence content.

## AC-12 — Asynchronous Write

Given an Admin action succeeds, Audit Log persistence can occur asynchronously rather than blocking the primary request.

## AC-13 — Primary Request Independence

Given the Audit Log storage/worker is temporarily unavailable, the already-successful primary Admin business operation is not incorrectly returned as failed solely because the async audit write did not complete immediately.

## AC-14 — Reliable Retry

Given an audit write fails transiently, the event remains recoverable/retryable through the project's reliable async architecture rather than being silently discarded.

## AC-15 — Duplicate Prevention

Given the same audit event is delivered more than once by a queue, the system prevents duplicate persisted events where the event ID is identical.

## AC-16 — Committed State Accuracy

Given a business transaction rolls back, the system does not persist an Audit Log claiming the rolled-back mutation succeeded.

## AC-17 — Account Approval Approval Event

Given Admin approves a pending Buyer/Seller/Logistics registration, the Audit Log records actor, target role/account, `PENDING → APPROVED`, and time.

## AC-18 — Account Approval Rejection Event

Given Admin rejects a registration, the Audit Log records actor, target, `PENDING → REJECTED`, and time.

## AC-19 — User Suspension Event

Given Admin suspends a user, the Audit Log records the selected role-scoped account and status/restriction change.

## AC-20 — Cross-Role Accuracy

Given two accounts share the same email under different roles, suspending one account produces an Audit Log referencing only the targeted role/account.

## AC-21 — User Restore Event

Given Admin restores an account restriction, the Audit Log records what restriction changed and does not falsely claim unrelated restrictions were cleared.

## AC-22 — User Deactivation Event

Given Admin deactivates a user, the Audit Log records the actor, role-scoped target, and access-state change.

## AC-23 — Seller Warning Event

Given Admin issues a formal Seller warning, the action is auditable with Seller/compliance-case references.

## AC-24 — Seller Suspension Event

Given Admin suspends a Seller for compliance, the Audit Log records the Admin, Seller, compliance context, and restriction change.

## AC-25 — Product Removal Event

Given Admin permanently removes a non-compliant product listing, the Audit Log records the affected product/Seller and moderation change.

## AC-26 — Complaint Resolution Event

Given Admin issues a binding complaint/dispute decision, the Audit Log records actor, case, state/resolution reference, and time.

## AC-27 — Complaint Admin Actions

Given Admin performs resolution-related actions required by the complaint workflow, those actions are traceable through case history and/or Audit Logs according to the defined event taxonomy.

## AC-28 — No Raw Complaint Evidence

Given a complaint has private image/document evidence, the Audit Log does not embed those files.

## AC-29 — Platform Policy Change

Given Admin updates a platform policy, the Audit Log can record policy/version/reference and relevant state/version change without copying unnecessary full content.

## AC-30 — Admin Credential Change

Given an Admin credential/security setting changes, the Audit Log records the security action without storing secret credential values.

## AC-31 — Blocklist Change

Given Admin adds/removes a Global Blocklist entry, the action is auditable without exposing raw sensitive payment credentials.

## AC-32 — Push Campaign Operation

Given Admin sends an outbound push/SMS campaign, the operation can be audited using campaign/segment/channel references without duplicating recipient lists.

## AC-33 — Audit List Access

Given an Admin has Audit Log viewing permission, they can retrieve a paginated Audit Log list.

## AC-34 — Unauthorized Viewer Denied

Given an Admin lacks Audit Log permission, the backend denies Audit Log access.

## AC-35 — Guest Denied

Given no authenticated Admin session exists, Audit Log endpoints are inaccessible.

## AC-36 — Actor Filter

Given events from multiple Admins exist, an authorized viewer can filter by Admin actor.

## AC-37 — Feature Filter

Given events from multiple Admin features exist, the viewer can filter by source feature.

## AC-38 — Action Filter

Given multiple action types exist, the viewer can filter by stable action identifier.

## AC-39 — Date Filter

Given historical events exist, the viewer can query an authorized date range.

## AC-40 — Pagination

Given many Audit Log events exist, the API returns bounded paginated/cursor-based results.

## AC-41 — Deleted Target History

Given an audited target is later deleted/unavailable, the Audit Log entry remains readable using its stored safe historical reference.

## AC-42 — Actor Deactivation History

Given an Admin actor is later deactivated, their historical Audit Logs remain attributable.

## AC-43 — Target Authorization

Given an Audit Log links to a target feature, opening the target still requires the destination feature's current authorization.

## AC-44 — Viewer Read-Only

Given an Audit Log detail is open, the UI does not expose mutation/delete controls for the audit event.

## AC-45 — Technical Log Separation

Given a normal application error occurs without an Admin operation, it is not automatically treated as a System Audit Log entry.

## AC-46 — Notification Separation

Given an Admin receives or reads a notification, this does not replace required audit records for later Admin business actions.

## AC-47 — Operational Domain Separation

Given a Courier completes a normal delivery or Logistics scans a parcel, that routine non-Admin operational event does not automatically become an Admin Audit Log entry.

## AC-48 — Safe Diff

Given a profile update includes both safe and sensitive fields, the Audit Log diff includes only fields approved for audit representation and redacts prohibited data.

---

# 192. Suggested Backend Tests

Test:

- guest cannot query Audit Logs
- non-Admin cannot query Audit Logs
- Admin without audit permission cannot query Audit Logs
- authorized Admin can list Audit Logs
- list is paginated
- list orders by occurred time
- actor filter works
- source-feature filter works
- action filter works
- target-type filter works
- date-range filter works
- audit detail loads
- audit detail is read-only
- no normal update route exists
- no normal delete route exists
- Admin approval queues/persists audit event
- Admin rejection queues/persists audit event
- user suspension audit includes correct role-scoped target
- user restoration audit records actual restriction change
- user deactivation audit persists
- Seller warning audit persists
- Seller compliance suspension audit persists
- product removal audit persists
- complaint resolution audit persists
- platform policy update audit persists when implemented
- Admin credential/security-change audit never stores secrets
- blocklist audit never stores raw payment credentials
- push campaign audit uses safe references
- password fields are redacted/rejected centrally
- token/session fields are redacted/rejected centrally
- raw evidence/file blobs cannot be serialized into audit payload
- business rollback does not persist false success audit
- async audit failure does not fail completed primary request
- transient audit failure retries
- duplicate event ID does not duplicate record
- event occurred_at remains original event time after delayed processing
- deleted target does not make historical audit unreadable
- deactivated Admin actor remains identifiable
- target link authorization remains destination-controlled

---

# 193. Suggested Frontend Tests

Where frontend testing infrastructure exists, test:

- Audit Log page loads
- loading state renders
- empty state renders
- unauthorized state hides log data
- date filter works
- Admin actor filter works
- feature filter works
- action filter works
- target-type filter works
- pagination/cursor navigation works
- newest-first ordering renders
- Audit Detail shows actor
- Audit Detail shows timestamp
- Audit Detail shows action
- Audit Detail shows target
- structured before/after change renders
- redacted values display safely
- no edit button exists
- no delete button exists
- missing/deleted target displays historical reference safely
- target link rechecks access
- long metadata values do not break layout
- old/unknown action identifiers still render safely
- narrow viewport remains readable

---

# 194. Open Decisions

The current AISLEY source documents do not define:

1. exact Audit Log database schema
2. whether logs use a database table, external service, or both
3. exact event taxonomy
4. exact action naming convention
5. whether event schema version is stored
6. exact event ID format
7. whether correlation/request IDs are stored
8. whether IP address is stored
9. whether user agent/device info is stored
10. whether session reference is stored
11. whether location/geolocation is ever stored
12. exact actor snapshot fields
13. whether actor email is snapshotted
14. exact target-type taxonomy
15. exact diff format
16. sensitive-field masking rules
17. whether sensitive field names alone are stored
18. exact PII retention policy
19. exact Audit Log retention period
20. archive policy
21. legal hold policy
22. whether any Audit Logs can ever be deleted
23. privileged retention/deletion procedure
24. whether retention cleanup itself is audited
25. whether cryptographic tamper evidence is required
26. hash chaining
27. WORM storage
28. external SIEM integration
29. exact queue technology
30. retry policy
31. retry backoff
32. dead-letter policy
33. transactional outbox requirement
34. acceptable audit persistence delay
35. audit pipeline monitoring/alert thresholds
36. whether failed Admin login is stored in System Audit Logs
37. whether Admin logout is stored (successful Admin login is stored)
38. whether routine read-only Admin page views are audited
39. whether sensitive PII views are audited
40. whether complaint evidence views/downloads are audited
41. whether financial report views are audited
42. whether financial export downloads are audited
43. whether Admin message sends are all duplicated into Audit Logs
44. whether notification acknowledgements are audited
45. whether Courier SOS acknowledgement is audited
46. whether failed Admin mutation attempts are audited
47. whether unauthorized attempts are audited here or in security logs
48. whether system-generated side effects receive separate audit events
49. whether system actors are supported
50. whether audit events can have parent/child relationships
51. exact correlation approach across Complaint → Compliance actions
52. whether Dashboard displays recent Admin Audit activity
53. whether Audit Log export is required
54. export formats
55. export retention/security
56. whether all Admins can view all logs
57. whether only Super Admin/security Admin can view all logs
58. whether Admins can view only their own logs
59. exact Audit Log permission keys
60. field-level audit visibility permissions
61. whether security events require stronger permissions
62. whether financial audit records require stronger permissions
63. whether Admin permission changes include full before/after permission lists
64. whether policy updates store full content hash/version only
65. whether announcement content is snapshotted
66. whether deleted user safe snapshots include email
67. whether target names are snapshotted
68. exact cursor pagination design
69. audit list search fields
70. whether JSON metadata is searchable
71. whether old events are migrated when schemas change
72. whether unknown historical actions are mapped to friendly labels
73. whether audit viewer supports saved filters
74. whether audit viewer supports case/investigation grouping
75. whether audit records are replicated/backed up separately
76. disaster-recovery requirements
77. audit database encryption requirements
78. backup retention
79. database administrator access controls
80. whether external compliance certifications impose additional requirements

These decisions should be made as AISLEY's security, privacy, infrastructure, and Admin permission models mature.

---

# 195. Source Traceability

## From `Admin.md`

System Audit Logs directly derives:

```text
Core Value:
Track administrative actions and changes
for security and accountability.

Expanded:
immutable
time-stamped ledger
every administrative operation
who performed the action
what data was altered
when it occurred
prevent abuse of power
post-incident forensics

System Context:
dedicated AuditLogs table
or external logging service
Admin operations trigger middleware
asynchronous write
audit write must not fail primary request
```

Additional direct source requirement from Complaints & Disputes:

```text
audit trail of messages
and actions taken by the administrator
during the resolution process
```

---

## From `app.md`

System Audit Logs must support a multi-Admin model:

```text
initial Admin
→ create partners
→ add Admins with custom permissions
```

Therefore, specific Admin actor identity and future permission-change auditing are important.

`app.md` also establishes the role-aware account model:

```text
unique(email, role)
```

so user-related audit targets must preserve role context.

---

## From `Buyer.md`

Buyer contains sensitive data and historical domains such as:

```text
addresses
orders
reviews
messages
```

Audit Logs should reference Admin changes involving Buyer accounts without duplicating unrelated private Buyer data.

---

## From `Seller.md`

Seller contains sensitive and business data including:

```text
products
inventory
shop
payout details
orders
reports
Vacation Mode
```

Seller Compliance/Admin account audit events must record enforcement/account changes without copying sensitive payout data or entire catalogs.

---

## From `Logistics.md`

Logistics owns operational actions such as:

```text
dispatch
order status
messaging
waybills
zones
Courier capacity
```

These routine Logistics operations are separate from **Admin** Audit Logs unless an Admin performs an administrative intervention.

---

## From `Courier.md`

Courier has independent operational histories:

```text
Delivery History
Incident Reporting
Proof of Delivery
SOS
```

These records can support complaints/forensics but should not all be duplicated into Admin Audit Logs.

Admin Audit Logs should record Admin actions related to those records, while the Courier/Logistics domains preserve their own operational histories.

---

# 196. Final Feature Definition

AISLEY System Audit Logs is:

```text
an immutable,
append-only,
time-stamped administrative ledger

that records:

    who acted
    what Admin action occurred
    which feature produced it
    which resource was affected
    what safe data changed
    when it happened

for Admin workflows such as:

    Account Approval
    Manage User Accounts
    Seller Compliance
    Complaints & Disputes
    Platform Settings
    Admin Account Security
    Global Ban/Blocklist
    Push Notification Management
    other future Admin mutations

while:

    writing asynchronously
    not failing the primary business request
    reliably retrying persistence
    preventing duplicate events
    protecting secrets and PII
    remaining read-only to normal Admin users
    preserving history even when targets change or disappear.
```

The central design principle is:

```text
The business feature remains
the source of truth for current state.

The Audit Log remains
the source of truth for
which Admin changed that state,
what changed,
and when.
```

And the core security guarantee is:

```text
An Admin should not be able
to perform a consequential platform action
and then erase or rewrite
the historical evidence
that they performed it.
```
