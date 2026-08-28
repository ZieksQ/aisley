---
feature: Manage Complaints and Disputes
system: AISLEY
type: Feature Specification
version: 2.0
status: Draft
scope: Admin Web Application / Complaint and Dispute Resolution
source_coverage: Admin.md, app.md, current AISLEY Admin feature specifications
---

# Manage Complaints and Disputes Specification

## 1. Purpose

Manage Complaints and Disputes is AISLEY's centralized Admin resolution center for user-submitted reports and conflicts between platform participants.
`Admin.md` defines:

```text
Core Value:
Review reports/complaints and supporting evidence for violations.

Expanded Definition:
A centralized resolution center for adjudicating conflicts.

This feature functions as a ticketing system where
administrators can review user-submitted reports,
examine attached media or text evidence,
and make binding decisions to resolve disputes
between interacting parties on the platform.

System Context:
Requires secure storage and retrieval for evidence files
(images, documents).

Needs an audit trail of messages and actions taken
by the administrator during the resolution process.
```

This file defines requirements, boundaries, evidence handling, APIs, security rules, acceptance criteria, and Open Decisions.
Sequence-heavy case handling belongs in `flow.md`.

## 2. Primary Actor

The primary decision-maker is:

```text
ADMIN
```

The feature also interacts with:

```text
complainant
respondent / other involved party
```

The exact user roles allowed to create complaints are not defined by the current source.

## 3. Core Responsibilities

The feature owns:

- complaint/dispute case records
- user-submitted report intake integration
- case list/search/filter
- case detail
- involved-party references
- text evidence
- uploaded media/document evidence
- secure evidence retrieval
- Admin review
- Admin decision recording
- case message/action history
- binding resolution record
- Audit Log integration
- links to related messaging/security/compliance features
  It does not automatically own:
- refunds
- payment reversals
- compensation
- chargebacks
- Seller suspension
- user suspension
- Global Ban
- product removal
- order cancellation
- Logistics reassignment
- Courier discipline
  Those actions require the owning feature and explicit rules.

## 4. Ticketing Model

The source explicitly describes this feature as:

```text
a ticketing system
```

Therefore each complaint/dispute should have a stable:

```text
case_id
```

The case is the authoritative record for:

- submitted complaint
- involved parties
- evidence references
- Admin review history
- Admin messages/actions
- final decision
- resolution metadata

## 5. Case State

The source requires a review-and-resolution lifecycle but does not define exact status names.
Do not treat any specific enum as source-mandated.
The implementation must support the logical stages:

```text
submitted
awaiting / undergoing Admin review
resolved / decided
```

Exact database status values are an Open Decision.

## 6. No Invented Status Workflow

Do not silently require statuses such as:

```text
ESCALATED
MEDIATION
REFUND_PENDING
APPEALED
ARBITRATION
CHARGEBACK
```

without new requirements.

## 7. Case Identity

Each case should have a stable unique identifier.
Recommended:

```text
complaint_id
case_id
```

Exact naming follows repository conventions.

## 8. Role-Aware Party Identity

AISLEY uses:

```text
unique(email, role)
```

Therefore parties should be referenced by:

```text
user_id
role
```

rather than email alone.
Example:

```text
alex@example.com + BUYER
alex@example.com + SELLER
```

are separate role-accounts.

## 9. Complainant

A complaint must identify the submitting account.
Recommended:

```text
complainant_user_id
complainant_role
```

The backend derives the authenticated submitter for user-created reports.

## 10. Respondent / Other Party

Where a dispute involves another platform account, the case should reference the exact role-account.
Recommended:

```text
respondent_user_id
respondent_role
```

The source does not require every report to have a respondent.

## 11. Multi-Party Disputes

The source says disputes may occur between interacting parties but does not define multi-party cases.
MVP may support a complainant plus one principal respondent.
Multi-party dispute structure remains Open.

## 12. Related Entity

A complaint may relate to:

```text
order
product
Seller
Buyer
Logistics
Courier
delivery
other platform interaction
```

Exact source types depend on the reporting entry points implemented elsewhere.
Use references instead of copying entire domain records into the complaint.

## 13. Related Order

If a case concerns an order:

```text
related_order_id
```

may be stored.
The complaint feature must not directly mutate order state unless a separate explicit action is defined.

## 14. Related Product

If a report concerns a product:

```text
related_product_id
```

may be referenced.
Product removal remains owned by Seller Compliance or the appropriate catalog moderation feature.

## 15. Complaint Category

The source does not define a complaint taxonomy.
Possible categories must remain implementation-defined.
Do not invent mandatory categories such as:

```text
fraud
damaged item
late delivery
harassment
counterfeit
```

as authoritative business rules.

## 16. Complaint Description

A complaint should contain:

```text
textual description
```

Requirements:

- non-empty
- bounded length
- safely rendered
- persisted with server timestamps
  Exact maximum length is Open.

## 17. Evidence Types

`Admin.md` explicitly supports:

```text
text evidence
images
documents
```

These are source-backed evidence forms.

## 18. Evidence Storage

Evidence files require secure storage and retrieval.
Requirements:

- private/non-public by default
- access through authorization checks
- stable evidence metadata
- no path traversal
- no arbitrary server execution
- safe file delivery
- case association

## 19. Evidence Metadata

Recommended:

```text
evidence_id
case_id
uploader_user_id
uploader_role
file_type
safe original name
storage key
file size
uploaded_at
```

Only fields supported by implementation should be used.

## 20. Evidence Content Types

Allowed file types should be explicitly allowlisted.
Source-backed categories:

```text
images
documents
```

Exact MIME extensions remain Open.

## 21. Evidence Size

Maximum individual file size and total case evidence size are not defined.
Open Decision.

## 22. Malware Scanning

Malware scanning is recommended for uploaded documents/media.
The source requires secure storage but does not explicitly mandate a scanning provider.

## 23. Evidence Immutability

For accountability, evidence should not be silently overwritten.
Recommended:

```text
new evidence upload
creates a new evidence record
```

If evidence must be removed/redacted for policy reasons, preserve safe audit history.

## 24. Evidence Deletion

Hard deletion behavior is not source-defined.
Open Decision.

## 25. Evidence Authorization

Only authorized participants/Admins may retrieve evidence according to case visibility policy.
A user must not retrieve another case's evidence by guessing:

```text
evidence_id
storage URL
object key
```

## 26. Signed URLs

If cloud object storage is used, short-lived signed URLs are recommended.
Permanent public URLs should not be used for sensitive evidence.

## 27. Evidence Download

The backend must verify access before issuing a download/view response.

## 28. Internal Admin Notes

The source requires an audit trail of messages/actions.
It does not explicitly define private Admin notes.
If internal notes are added:

- mark them Admin-only
- never expose them to user parties
- keep them separate from user-visible messages

## 29. Case Messages

The resolution process may contain:

```text
messages
```

These may include:

- user-submitted case comments
- Admin requests for information
- Admin explanations
  Admin Chat / Messaging is the preferred direct communication feature when one-to-one conversation is needed.

## 30. Messaging Integration

Recommended:

```text
Complaint Case
→ Message Party
→ Admin Chat / Messaging
→ thread linked back to case
```

The complaint case keeps the authoritative resolution history.

## 31. Separate Party Conversations

If both complainant and respondent are contacted:

```text
Admin ↔ Complainant
Admin ↔ Respondent
```

Separate direct threads are recommended to prevent accidental disclosure.

## 32. Cross-Party Privacy

One party must not see:

- another party's private Admin conversation
- restricted evidence
- internal Admin notes
- internal compliance/security findings
  unless explicitly authorized by complaint policy.

## 33. Admin Review

An authorized Admin must be able to:

- open case
- inspect complaint text
- inspect safe party identities
- inspect evidence
- inspect message/action history
- request more information where supported
- record a binding decision

## 34. Binding Decision

The source explicitly states:

```text
administrators make binding decisions
to resolve disputes
```

Therefore the case must support a final Admin decision record.

## 35. Decision Data

Recommended:

```text
decision_summary
decided_by_admin_id
decided_at
```

Optional:

```text
decision_reason
```

Exact required fields are Open.

## 36. Decision Outcome

The source does not define a fixed outcome enum.
Do not invent mandatory outcomes such as:

```text
REFUND_BUYER
RELEASE_SELLER_FUNDS
BAN_SELLER
COMPENSATE_COURIER
```

A decision can record the adjudication result without automatically performing unrelated business actions.

## 37. Refund Boundary

No source provided in this project defines Admin complaint resolution as direct refund execution.
Therefore:

```text
refund / reversal / compensation
= not an automatic complaint action
```

If later added, it requires financial/payment rules and explicit integration.

## 38. Suspension Boundary

A complaint decision may justify a separate:

```text
Manage User Accounts
```

or:

```text
Seller Compliance
```

action.
The complaint case itself should not silently change account status.

## 39. Global Ban Boundary

A complaint may justify a separate Global Ban action.
Recommended:

```text
case
→ explicit Create Blocklist Entry
→ separate confirmation/authorization
```

No automatic ban.

## 40. Seller Compliance Boundary

A Seller-related complaint may hand off to Seller Compliance.
Recommended:

```text
complaint evidence/findings
→ explicit compliance case/action
```

Complaint state and compliance state remain independent.

## 41. Order Boundary

A complaint decision should not silently:

- cancel an order
- mark delivered
- mark returned
- alter shipment state
  Order lifecycle remains owned by the order/logistics domain.

## 42. Financial Record Boundary

Complaint resolution must not rewrite historical financial records without a separately defined financial operation.

## 43. Case History

The case should preserve a chronological history of:

- complaint submission
- evidence upload
- Admin review actions
- linked messages
- decision
- resolution/closure actions

## 44. Action Timeline

Recommended case timeline:

```text
timestamp
actor
action
safe description/reference
```

The exact implementation may use:

- case activity table
- domain events
- Audit Log references

## 45. System Audit Logs

`Admin.md` separately requires immutable System Audit Logs for Admin actions.
Complaint case history and System Audit Logs are related but not identical.
Recommended:

```text
case timeline
    case-specific interaction history

System Audit Logs
    immutable Admin action accountability
```

## 46. Audit Events

Recommended:

```text
COMPLAINT_CASE_OPENED_BY_ADMIN
COMPLAINT_EVIDENCE_VIEWED
COMPLAINT_INFORMATION_REQUESTED
COMPLAINT_DECIDED
COMPLAINT_CASE_CLOSED
```

Exact taxonomy is Open.
Routine evidence-view Audit events may be too noisy; exact coverage is Open.

## 47. Audit Decision

A binding decision should create an Audit Log event.
Recommended fields:

```text
Admin actor
case ID
safe decision reference
timestamp
```

Avoid copying sensitive evidence into the Audit Log.

## 48. Evidence Audit

Evidence uploads/access/removal should have traceability appropriate to security policy.
Exact Audit Log granularity is Open.

# Admin Queue

## 49. Case List

Recommended columns:

```text
Case ID
Complainant
Respondent / Subject
Related Context
Status
Submitted At
Last Activity
```

Only show safe summary data.

## 50. Default View

Recommended:

```text
cases requiring Admin attention
```

Exact status filter depends on the implemented lifecycle.

## 51. Search

Recommended:

```text
case ID
user name
email
order ID
product ID
```

If searching by email, show role clearly.

## 52. Filters

Possible:

```text
status
date
party role
related entity type
assigned Admin if assignment exists
```

Exact filters are Open.

## 53. Pagination

Case lists must be paginated/bounded.

## 54. Case Detail

Recommended sections:

```text
Case Summary
Parties
Related Entity
Complaint
Evidence
Messages / Communication
Admin Activity
Decision
```

## 55. Assignment

The source does not define Admin case assignment.
Do not require:

```text
assigned_admin_id
```

unless the team chooses a queue/ownership model.

## 56. SLA

The source does not define:

- response SLA
- resolution deadline
- escalation timer
  Open Decision.

## 57. Priority

The source does not define severity/priority levels.
Open Decision.

# User Submission

## 58. Submission Source

The feature receives:

```text
user-submitted reports
```

Exact user-facing report entry points are not defined in the provided sources.

## 59. Submission Requirements

At minimum, a case submission should provide:

- authenticated submitter where authentication is required
- complaint description
- related context if applicable
- evidence if provided
  Exact validation depends on the reporting surface.

## 60. Anonymous Complaints

Anonymous complaint submission is not defined.
Open Decision.

## 61. Duplicate Complaints

Duplicate detection is not source-defined.
Open Decision.

## 62. Withdraw Complaint

Complaint withdrawal is not source-defined.
Open Decision.

# API

## 63. Recommended Admin API

Conceptual:

```http
GET  /api/admin/complaints
GET  /api/admin/complaints/{caseId}
POST /api/admin/complaints/{caseId}/decision
POST /api/admin/complaints/{caseId}/request-information
POST /api/admin/complaints/{caseId}/close
```

Only implement endpoints consistent with selected case lifecycle.

## 64. Evidence API

Conceptual:

```http
GET /api/admin/complaints/{caseId}/evidence/{evidenceId}
```

Evidence access must be authorized.

## 65. List API

Recommended query:

```text
status
search
date
role
context_type
page/cursor
```

## 66. Detail API

Returns:

- safe case metadata
- parties
- complaint text
- related entity references
- authorized evidence metadata
- timeline/history
- decision if made

## 67. Decision API

Conceptual:

```http
POST /api/admin/complaints/{caseId}/decision
```

Possible payload:

```json
{
  "decision_summary": "...",
  "decision_reason": "..."
}
```

Exact required fields are Open.

## 68. Decision Preconditions

Backend must:

- authenticate Admin
- authorize complaint decision
- ensure case is still eligible for decision
- validate decision input
- commit decision atomically
- record decision actor/time
- append case history
- emit Audit event

## 69. Close API

A separate close endpoint is useful only if:

```text
decision
```

and:

```text
closure
```

are distinct in the selected lifecycle.
Whether these are separate is Open.

## 70. Request Information API

If case-specific communication is implemented:

```http
POST /api/admin/complaints/{caseId}/request-information
```

Recommended implementation may instead create/use an Admin Chat thread linked to the case.

## 71. User Submission API

The exact user-facing complaint submission endpoint is outside the Admin UI spec.
The Admin module should consume cases from the shared complaint domain.

# Concurrency and Integrity

## 72. Concurrent Decision

Two Admins may review the same case.
The backend must prevent conflicting final decisions.
Recommended:

```text
optimistic locking
version check
atomic status/decision condition
```

Exact mechanism is Open.

## 73. Decision Immutability

A binding decision should not be silently overwritten.
If corrections/appeals are later supported, preserve the original decision and add a new revision/action.

## 74. Appeal

Appeal/reopen is not source-defined.
Open Decision.

## 75. Case Deletion

Hard deletion of resolved cases is not recommended because the source requires accountability/audit history.
Retention policy is Open.

# Evidence Security

## 76. File Name Safety

Never trust the uploaded file name as a storage path.
Use generated storage keys.

## 77. MIME Validation

Validate actual accepted content types rather than file extension alone.

## 78. Executable Content

Do not execute uploaded documents/media.

## 79. Public Directory

Sensitive evidence should not be stored in a directly browsable public web directory.

## 80. Access Expiry

If signed URLs are used, keep them time-limited.

## 81. Download Headers

Serve files with safe headers appropriate to content type.

## 82. PII

Evidence may contain sensitive PII.
Access must be restricted to case-authorized actors.

## 83. Logs

Do not log full evidence content or signed URLs unnecessarily.

## 84. Virus/Malware Failure

If malware scanning is implemented and a file fails:

```text
quarantine / deny access
```

according to security policy.
Exact behavior is Open.

# Authentication and Authorization

## 85. Admin Authentication

All Admin complaint endpoints require:

```text
authenticated ADMIN
```

## 86. Permissions

Possible conceptual permissions:

```text
view complaints
view evidence
message parties
decide complaints
close complaints
```

Exact permission keys are Open.

## 87. CSRF

Admin web mutations require Sanctum CSRF protection.

## 88. IDOR Protection

Case/evidence IDs do not grant access.
Backend authorization must verify every case/evidence request.

## 89. User Access

A user party may access only complaint data allowed by user-facing case policy.
They must never gain Admin-only access by manipulating IDs.

# Communication

## 90. Admin Chat Integration

Use Admin Chat / Messaging for direct one-to-one communication where practical.
Benefits:

- read receipts
- historical archive
- role-aware participant identity

## 91. Message Reference

The complaint case may store:

```text
thread_id
message_id
```

references for case history.

## 92. Messaging Does Not Decide Case

A message such as:

```text
"We have resolved your complaint."
```

does not itself change the case.
The authoritative decision must be persisted in the complaint domain.

# Notifications

## 93. Admin Notifications

A new complaint/report may create:

```text
COMPLAINT_SUBMITTED
```

or equivalent Admin Notification.
Admin Notifications owns the alert.
Complaints owns the case.

## 94. Dashboard

Admin Dashboard may show:

```text
Open Complaints
```

using the owning complaint feature's actionable/non-terminal case definition.

## 95. Party Notification

Parties should be notified when a binding decision is available.
Exact channel:

```text
in-app
email
push
message
```

is not specified.
Open Decision.

# Error Handling

## 96. Admin Errors

Handle:

```text
case not found
evidence not found
permission denied
invalid evidence
decision conflict
case already decided
storage unavailable
session expired
server error
```

## 97. Evidence Storage Failure

If evidence upload storage fails:

```text
do not record it as successfully attached
```

## 98. Decision Failure

If decision persistence fails:

```text
do not show the case as resolved
```

## 99. Notification Failure

If a decision commits but external notification fails:

```text
decision remains committed
```

Notification retry behavior is Open.

# Performance

## 100. Pagination

Use pagination for:

- case lists
- timeline if large
- evidence list if large

## 101. Evidence Metadata

List metadata first; load/download binary evidence only on demand.

## 102. Search Indexing

Recommended indexes depend on schema:

```text
case status
created_at
complainant user
respondent user
related order/product
```

## 103. Large Evidence

Do not stream large evidence through application memory unnecessarily if secure object storage delivery is available.

# UX

## 104. Case List States

Support:

```text
loading
empty
filtered empty
error
```

## 105. Case Detail States

Support:

```text
loading
loaded
evidence loading
decision submitting
decision conflict
error
```

## 106. Decision Confirmation

A binding decision is consequential.
Require deliberate confirmation.
Recommended summary:

```text
Case ID
Parties
Decision summary
```

## 107. Resolved Case

A resolved/decided case should clearly show:

- decision
- deciding Admin
- decision time
- historical evidence/messages/actions

## 108. Accessibility

UI should:

- use semantic headings
- label party roles
- expose status textually
- support keyboard evidence navigation
- use accessible confirmations
- announce decision errors/success
- not rely on color alone

## 109. Responsive Behavior

Case list/detail should remain usable on smaller Admin screens.
Evidence and long text should wrap/scroll within safe containers.

# MVP Scope

## 110. Required

- authenticated Admin complaint queue
- stable case ID
- user/party role-aware references
- complaint text
- related entity references where applicable
- image evidence
- document evidence
- secure evidence storage
- authorized evidence retrieval
- case list/search/filter/pagination
- case detail
- Admin review
- binding decision record
- decision actor/time
- case action/message history
- concurrency protection for final decision
- decision immutability
- Admin Chat integration or equivalent communication link
- Admin Notifications integration for new cases
- Dashboard Open Complaints integration
- System Audit Log integration
- CSRF
- PII/evidence protection
- loading/empty/error states

## 111. Recommended

- object storage with signed URLs
- malware scanning
- explicit decision confirmation
- separate complainant/respondent threads
- safe source references
- optimistic locking/versioning
- decision notification to involved parties
- case timeline

## 112. Not Required

- refunds
- payment reversal
- compensation
- automatic user suspension
- automatic Seller suspension
- automatic product removal
- automatic Global Ban
- order cancellation
- chargeback handling
- appeal
- mediation
- arbitration
- SLA/escalation
- anonymous reports
- multi-party group chat
- AI decisioning
- automatic evidence interpretation

# Acceptance Criteria

## 113. AC-01 — Admin Access

Unauthenticated/non-Admin users cannot access Admin complaint endpoints.

## 114. AC-02 — Permission

Complaint viewing/decision actions require configured Admin permissions.

## 115. AC-03 — Stable Case

Every submitted complaint has a stable case identifier.

## 116. AC-04 — Role-Aware Parties

Parties are identified by user ID/role, not email alone.

## 117. AC-05 — Same Email Isolation

Same-email Buyer and Seller accounts are not conflated in a dispute.

## 118. AC-06 — Complaint Text

Admin can review the persisted complaint description.

## 119. AC-07 — Image Evidence

Authorized Admin can retrieve supported image evidence.

## 120. AC-08 — Document Evidence

Authorized Admin can retrieve supported document evidence.

## 121. AC-09 — Evidence Authorization

Unauthorized users cannot retrieve evidence by guessing IDs/URLs.

## 122. AC-10 — Evidence Storage Safety

Uploaded evidence is stored outside an unsafe directly executable/public path.

## 123. AC-11 — Safe File Handling

Uploaded evidence names/types are validated and safely served.

## 124. AC-12 — Case History

Admin actions/messages relevant to resolution are traceable in case history.

## 125. AC-13 — Binding Decision

Authorized Admin can persist a binding decision on an eligible case.

## 126. AC-14 — Decision Actor

Decision records the deciding Admin and timestamp.

## 127. AC-15 — Decision Concurrency

Two Admins cannot silently overwrite each other's final decision.

## 128. AC-16 — Decision History

A committed binding decision is not silently overwritten/deleted.

## 129. AC-17 — No Automatic Refund

A complaint decision does not automatically execute a refund absent separate rules.

## 130. AC-18 — No Automatic Suspension

A complaint decision does not automatically suspend accounts.

## 131. AC-19 — No Automatic Global Ban

A complaint decision does not automatically add a blocklist entry.

## 132. AC-20 — No Automatic Order Mutation

A decision does not silently rewrite order/logistics state.

## 133. AC-21 — Messaging Privacy

One dispute party cannot read another party's private Admin conversation.

## 134. AC-22 — Messaging State Boundary

Sending a message does not itself mark the complaint resolved.

## 135. AC-23 — Audit Decision

A binding Admin decision creates a safe System Audit Log event.

## 136. AC-24 — Audit Secret Safety

Audit Logs do not copy sensitive evidence files or secrets.

## 137. AC-25 — New Complaint Notification

New complaint intake can create an Admin Notification without replacing the complaint case.

## 138. AC-26 — Dashboard Count

Dashboard Open Complaints derives from the complaint feature's authoritative actionable definition.

## 139. AC-27 — CSRF

Admin complaint mutations use configured Sanctum CSRF protection.

## 140. AC-28 — Pagination

Case lists are bounded/paginated.

## 141. AC-29 — Safe Rendering

Complaint/evidence metadata cannot execute untrusted scripts.

## 142. AC-30 — Decision Failure

A failed decision write is not shown as successful resolution.

# Tests

## 143. Backend Tests

Test:

- guest denied
- non-Admin denied
- Admin without view permission denied
- Admin without decision permission denied
- create/retrieve stable case ID
- complainant user ID/role preserved
- respondent user ID/role preserved
- same-email roles separated
- complaint text persisted
- allowed image metadata/storage
- allowed document metadata/storage
- invalid evidence type rejected
- unauthorized evidence access denied
- path traversal prevented
- safe signed/private evidence access
- Admin can load case
- Admin can record decision
- deciding Admin/time recorded
- concurrent decisions do not overwrite
- committed decision not silently overwritten
- case history records Admin action
- complaint decision does not auto-refund
- does not auto-suspend
- does not auto-ban
- does not mutate order state
- complaint-linked message preserves party privacy
- messaging alone does not resolve case
- decision Audit event created
- Audit payload excludes evidence content/secrets
- CSRF required
- pagination/search/filter work

## 144. Frontend Tests

Test:

- complaint list loads
- loading/empty/filter states
- role visible with same-email users
- case detail loads
- complaint text rendered safely
- evidence list renders
- image/document access handles loading/error
- unauthorized evidence handled
- timeline renders
- decision form validation
- decision confirmation
- decision submitting/success/conflict states
- resolved case displays decision actor/time
- Message Party link uses correct role-account
- responsive layout
- keyboard navigation
- status not color-only

# Open Decisions

## 145. Open Decisions

Current sources do not define:

1. exact case status enum
2. exact submission roles
3. anonymous complaint support
4. complaint categories
5. priority/severity
6. Admin case assignment
7. SLA / deadlines
8. escalation
9. exact complainant/respondent structure
10. multi-party cases
11. duplicate complaint detection
12. complaint withdrawal
13. exact related-entity types
14. required complaint fields
15. message/comment model inside case
16. internal Admin notes
17. exact decision fields
18. decision outcome taxonomy
19. whether decision and closure are separate
20. reopen/appeal
21. decision revision process
22. required decision reason
23. user-visible decision detail
24. party notification channel
25. evidence MIME allowlist
26. max file size
27. max evidence count
28. total evidence quota
29. malware scanner/provider
30. image transformations/previews
31. document preview support
32. evidence redaction/removal
33. evidence retention
34. case retention
35. signed URL lifetime
36. storage provider
37. case timeline schema
38. exact Audit event taxonomy
39. evidence-view Audit logging
40. exact Admin permission keys
41. Admin Notification event names
42. Dashboard actionable/open definition
43. refund/reversal integration
44. compensation rules
45. account suspension integration
46. Seller Compliance handoff rules
47. Global Ban handoff rules
48. order cancellation/refund rules
49. financial-record integration
50. dispute party access after account deactivation/ban

# Final Definition

## 146. Final Definition

AISLEY Manage Complaints and Disputes is:

```text
an Admin-operated ticketing and resolution center

for:
    user-submitted reports
    complaints
    disputes between platform participants
```

It provides:

```text
stable case records
party references
text complaints
image/document evidence
secure evidence access
Admin review
message/action history
binding Admin decisions
Audit Log accountability
```

Central evidence rule:

```text
Evidence is private, authorized,
securely stored, and traceable.
```

Central decision rule:

```text
The complaint case records the binding decision.

Unrelated actions such as refunds,
suspensions, product removal,
Global Ban, and order mutations
require explicit rules in their owning features.
```
