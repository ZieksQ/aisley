---
feature: Admin Notifications
system: AISLEY
type: Feature Specification
version: 2.0
status: Draft
scope: Admin Web Application / Internal Admin Attention Feed
source_coverage: Admin.md, Courier.md, app.md, current AISLEY Admin feature specifications
---

# Admin Notifications Specification

## 1. Purpose

Admin Notifications is AISLEY's internal, Admin-facing attention feed.
Its purpose is to surface meaningful platform events that require Admin awareness or action and route the Admin to the authoritative feature that owns the underlying record.
`Admin.md` defines the Dashboard as:

```text
Overview of platform, display notification.
```

It further requires:

```text
alerts for critical notifications
that require immediate attention upon login
```

and:

```text
a real-time or polling mechanism
for incoming notifications
```

Admin Notifications therefore provides:

```text
platform event
→ Admin-facing notification
→ safe preview
→ owning feature/deep link
```

A separate `flow.md` is not required because this feature has only a small notification lifecycle and no substantial business-state machine of its own.

## 2. Core Boundary

Admin Notifications is:

```text
inbound platform → Admin alerts
```

It is not:

```text
Admin → user Push/SMS campaign
```

That belongs to:

```text
Push Notification Management
```

It is also not:

```text
Admin ↔ user conversation
```

That belongs to:

```text
Admin Chat / Messaging
```

## 3. Primary Recipient

The recipient is:

```text
ADMIN
```

AISLEY supports multiple Admin accounts and custom permissions.
Therefore notification visibility must be permission-aware.
A notification should only be visible to Admins authorized to access the underlying feature/data.

## 4. Core Responsibilities

Admin Notifications owns:

- Admin notification records
- notification feed
- unread/read state
- unread count/badge
- safe notification previews
- source feature metadata
- deep links
- permission-aware visibility
- deterministic ordering
- real-time or polling delivery
- deduplication where appropriate
- Dashboard notification preview
- notification history
- safe retention according to policy
  It does not own:
- Account Registration approval
- Seller Compliance decisions
- Complaint resolution
- report generation
- Admin Chat conversation state
- Push/SMS campaigns
- platform announcements
- Global Ban decisions
- Audit Log storage
- Courier dispatch actions

## 5. Notification Principle

A notification is:

```text
an attention signal
```

It is not:

```text
the authoritative business record
```

Example:

```text
"New complaint submitted"
```

links to the complaint case.
The complaint case, not the notification, owns:

```text
evidence
status
decision
resolution
```

## 6. Source-Backed Notification Need

The source explicitly requires Admin notifications at Dashboard level.
The strongest source-backed Admin attention sources are:

- Seller Compliance internal flags/reports
- Complaints/Disputes submitted for Admin review
- Courier SOS/emergency events when platform Admin is an intended recipient
- critical platform events surfaced to the Dashboard
  Other integrations can be added where owning features emit meaningful Admin events.

## 7. Manage Account Registrations Integration

Manage Account Registrations owns:

```text
PENDING
APPROVED
REJECTED
```

A newly submitted Buyer/Seller/Logistics registration is a reasonable Admin attention event.
Recommended notification:

```text
ACCOUNT_REGISTRATION_PENDING
```

This integration is recommended from the Admin workload model, but `Admin.md` explicitly requires the decision email to the applicant rather than explicitly naming an Admin notification event.

## 8. Registration Role Scope

If registration notifications are implemented, include Admin-owned approvals:

```text
BUYER
SELLER
LOGISTICS
```

Exclude:

```text
COURIER
```

because Courier registration approval belongs to Logistics.

## 9. Registration Notification Deep Link

Recommended:

```text
notification
→ Manage Account Registrations
→ exact pending registration
```

Opening the notification must not approve/reject the account.

## 10. Seller Compliance Integration

`Admin.md` requires:

```text
internal reporting/flagging mechanism
```

A new compliance item requiring Admin review is a direct notification candidate.
Recommended:

```text
SELLER_COMPLIANCE_REVIEW_REQUIRED
```

The notification links to:

```text
Monitor Seller Compliance
```

## 11. Compliance Boundary

Marking a compliance notification read:

```text
does not resolve the compliance case
```

The compliance feature remains authoritative.

## 12. Complaints & Disputes Integration

`Admin.md` requires Admin review of:

```text
user-submitted reports/complaints
```

A newly submitted complaint is a direct Admin attention event.
Recommended:

```text
COMPLAINT_SUBMITTED
```

Deep link:

```text
Manage Complaints & Disputes
```

## 13. Complaint Boundary

Marking a complaint notification read:

```text
does not resolve or close the complaint
```

## 14. Courier SOS Integration

`Courier.md` defines:

```text
SOS/Emergency Button
```

with:

```text
immediately alerts the Logistics team
and local authorities
```

and further states the primary utility is:

```text
internal alerting
(notifying the logistics/admin team)
```

It may transmit:

```text
courier last known GPS coordinates
active task ID
```

Therefore Courier SOS is source-supported as a critical Admin notification when platform Admin is included in the configured safety-alert audience.

## 15. SOS Recipient Boundary

The source refers to:

```text
logistics/admin team
```

but does not define whether every platform Admin receives every SOS.
Exact recipient routing is Open.

## 16. SOS Data Minimization

A broad Admin notification preview should not expose more location/task data than necessary.
Recommended preview:

```text
Courier SOS alert requires attention.
```

Detailed GPS/task information should be accessed only by authorized recipients through the owning operational/safety surface.

## 17. SOS Priority

Courier SOS is clearly safety-critical.
If a priority model exists, SOS should use the highest relevant priority.
Exact priority enum is Open.

## 18. Admin Chat Integration

A user reply in an Admin Chat thread may reasonably notify eligible Admins.
Recommended:

```text
ADMIN_MESSAGE_RECEIVED
```

This is a recommended integration rather than an explicitly named event in `Admin.md`.

## 19. Chat Boundary

The notification:

```text
links to the thread
```

Admin Chat owns:

```text
message history
read receipts
conversation state
```

Notification read state must not be treated as message read state.

## 20. Reports Overview Integration

Reports Overview may use background processing for large exports.
Recommended events:

```text
REPORT_EXPORT_COMPLETED
REPORT_EXPORT_FAILED
```

This is an implementation recommendation, not an explicit source requirement.

## 21. Reports Boundary

Admin Notifications does not:

- generate reports
- calculate platform revenue
- store report files
  It only alerts the Admin when a background result is available if that integration is implemented.

## 22. Global Ban Integration

Routine blocked requests should not produce one Admin notification each.
That would flood the feed.
Possible future aggregated security notification:

```text
Repeated blocked activity detected
```

Exact threshold is Open.

## 23. Platform Settings Boundary

Publishing an announcement is not normally an Admin Notification.
Manage Platform Settings owns:

```text
announcement content
policy content
```

Admin Notifications is for events requiring Admin attention.

## 24. Push Notification Management Boundary

Critical distinction:

```text
Admin Notifications
    internal inbound alerts

Push Notification Management
    outbound Push/SMS campaigns
```

The notification feed must never become a campaign composer.

## 25. Notification Data Model

Conceptual fields:

```text
id
type
source_type
source_id
recipient_scope
title
message_preview
priority
created_at
```

Read state may be stored separately per Admin.
Exact schema is Open.

## 26. Source Reference

Every actionable notification should preserve enough metadata to resolve its authoritative source.
Recommended:

```text
source_type
source_id
```

Examples:

```text
ACCOUNT_REGISTRATION + user_id
SELLER_COMPLIANCE + case_id
COMPLAINT + case_id
ADMIN_CHAT + thread_id
COURIER_SOS + alert/task reference
REPORT_EXPORT + export_id
```

## 27. Notification Content

A notification should contain:

- concise title
- safe preview
- source type
- timestamp
- unread/read state for current Admin
- deep link when applicable
  Avoid embedding full domain data.

## 28. PII Minimization

Do not put unnecessary sensitive information into feed rows.
Avoid:

- full addresses
- payout credentials
- payment data
- complaint evidence
- raw GPS coordinates unless justified
- passwords/tokens
- private Admin notes

## 29. Read State

Recommended lifecycle:

```text
UNREAD → READ
```

No separate flow file is needed for this simple state.

## 30. Read Meaning

`READ` means:

```text
the Admin has viewed/acknowledged the notification
```

It does not mean:

```text
the underlying work is completed
```

## 31. Read vs Resolved

Examples:

```text
registration notification READ
registration still PENDING

complaint notification READ
complaint still actionable

compliance notification READ
case still requires action
```

## 32. Mark Read

Recommended:

```http
POST /api/admin/notifications/{id}/read
```

or equivalent PATCH endpoint.
Backend must verify the Admin may access the notification.

## 33. Mark All Read

Optional:

```http
POST /api/admin/notifications/read-all
```

This is a convenience feature, not source-required.

## 34. Unread Count

Recommended:

```text
notification bell badge
```

The count should reflect notifications visible to the current Admin only.

## 35. Per-Admin Read State

Because AISLEY supports multiple Admins:

```text
Admin A reads notification
```

must not automatically imply:

```text
Admin B read notification
```

Recommended:

```text
per-Admin read state
```

unless a future shared-team acknowledgment model is selected.

## 36. Recipient Scope

Possible models:

```text
all authorized Admins
Admins with required permission
specific assigned Admin
specific Admin team
```

Current sources do not define assignment/team routing.

## 37. Permission-Aware Delivery

If an Admin cannot access Seller Compliance:

```text
do not expose sensitive Seller Compliance notification content
```

Recommended:

```text
do not surface inaccessible notifications
```

## 38. Permission Re-Check on Open

A notification being visible once does not permanently grant access.
On deep-link open:

```text
owning feature rechecks authorization
```

## 39. Ordering

Recommended:

```text
newest first
```

Use server timestamps.

## 40. Priority

The source requires:

```text
critical notifications
```

A conceptual model may be:

```text
NORMAL
HIGH
CRITICAL
```

Exact enum and classification rules are Open.

## 41. Priority Is Not Workflow State

Priority changes presentation/attention.
It does not alter the underlying case/account state.

## 42. Deduplication

Repeated delivery of the same event should not create unnecessary duplicate notifications.
Recommended idempotency basis:

```text
event type
+ source ID
+ logical event occurrence
```

Exact key format is Open.

## 43. Distinct Repeated Events

One source record may legitimately produce different notifications.
Example:

```text
complaint submitted
complaint receives new evidence
```

These may be distinct events if product policy chooses to notify both.

## 44. Real-Time or Polling

`Admin.md` explicitly allows:

```text
real-time or polling
```

Acceptable implementations:

```text
WebSocket
SSE
polling
```

Exact mechanism is Open.

## 45. Durable Feed

Realtime transport is an enhancement.
If realtime fails:

```text
notification remains stored
→ Admin receives it on refresh/poll/reconnect
```

## 46. Persistence Before Broadcast

Recommended:

```text
domain event
→ durable notification
→ commit
→ realtime signal
```

Do not use a transient socket event as the only copy.

## 47. Async Generation

Non-critical notification generation may be asynchronous.
Exact queue infrastructure is Open.

## 48. Critical Delivery

Courier SOS should not rely exclusively on:

```text
transient toast
```

Use a durable alert record plus appropriate high-priority delivery to intended recipients.
Exact redundant/escalation channels are Open.

## 49. Dashboard Integration

Admin Dashboard consumes:

```text
bounded notification preview
unread count
```

Full history remains in Admin Notifications.

## 50. Dashboard Preview

Recommended:

```text
latest 5–10 relevant notifications
```

Exact count is Open.

## 51. Dashboard Load

Recommended:

```text
loading Dashboard
does not mark notifications read
```

Read state changes only according to explicit notification-view/acknowledgment UX.

## 52. Notification Center Route

Recommended:

```text
/notifications
```

or:

```text
/admin/notifications
```

Exact route follows repository conventions.

## 53. Notification List

Recommended content:

```text
Unread indicator
Priority
Title
Source
Safe preview
Created At
```

## 54. Filters

Recommended:

```text
unread/read
source type
priority
date
```

## 55. Pagination

Notification history must be paginated/bounded.

## 56. Retention

Retention duration is not defined.
Notifications may be pruned according to policy because authoritative business history remains in owning features.
Do not use notification rows as the only record of consequential actions.

## 57. Delete / Dismiss

Not source-defined.
Recommended MVP:

```text
read/unread only
```

Archive/dismiss/delete is Open.

## 58. API Surface

Conceptual:

```http
GET  /api/admin/notifications
GET  /api/admin/notifications/unread-count
POST /api/admin/notifications/{id}/read
POST /api/admin/notifications/read-all
```

`read-all` is optional.

## 59. List API

Recommended query:

```text
read_state
source_type
priority
date
page/cursor
```

Return only notifications visible to the current Admin.

## 60. Notification DTO

Conceptual:

```json
{
  "id": "notification-id",
  "type": "COMPLAINT_SUBMITTED",
  "title": "New complaint submitted",
  "message": "Complaint #123 requires review.",
  "priority": "NORMAL",
  "source_type": "COMPLAINT",
  "source_id": "123",
  "is_read": false,
  "created_at": "..."
}
```

## 61. Deep Link

The API may return a safe internal route or source metadata used to construct one.
Do not allow arbitrary external URLs from event payloads.

## 62. Open Redirect Safety

If notification destinations are stored:

```text
allow internal Admin routes only
```

## 63. Authentication

All Admin Notification endpoints require:

```text
authenticated ADMIN
```

## 64. Authorization

Visibility must respect custom Admin permissions.
Notifications do not bypass owning-feature authorization.

## 65. CSRF

Read-state mutation endpoints require configured Sanctum CSRF protection.

## 66. IDOR

Knowing a notification ID does not grant permission to read/update it.

## 67. Safe Rendering

Notification previews may contain user/domain text.
Render safely and never execute untrusted HTML/scripts.

## 68. Secret Safety

Never place:

```text
password
password hash
session cookie
access token
OTP
CVV
full payment details
```

in notification payloads.

## 69. Audit Log Boundary

```text
System Audit Logs
    immutable Admin accountability

Admin Notifications
    attention feed
```

Routine notification read/unread changes do not require Audit Log entries by default.

## 70. Notification Generation Failure

If an underlying business event commits but notification generation fails:

```text
do not roll back the business event
```

Recommended:

- retry notification creation
- log failure
- use durable event/outbox architecture when reliability matters

## 71. Domain Authority

Example:

```text
complaint committed
notification failed
```

The complaint remains authoritative and actionable.

## 72. Outbox Pattern

Recommended:

```text
domain transaction
→ durable event/outbox
→ notification worker
→ notification record
→ realtime signal
```

This is an implementation recommendation.

## 73. Generation Idempotency

Worker retries must not create uncontrolled duplicate notifications for the same logical event.

## 74. Realtime Reconnect

After reconnect:

```text
refetch notification list
refetch unread count
```

This recovers missed events.

## 75. Loading State

Support:

```text
loading
loaded
empty
error
```

## 76. Empty State

Example:

```text
No notifications.
```

Zero notifications is valid.

## 77. Unread Empty State

Example:

```text
You're all caught up.
```

Exact wording is design-owned.

## 78. Accessibility

Notification UI should:

- expose unread/read state textually
- expose priority textually
- use semantic list/navigation
- support keyboard activation
- provide meaningful link names
- announce critical alerts appropriately
- not rely on color alone

## 79. Responsive Behavior

Notification center and Dashboard preview should remain usable on smaller Admin screens.

## 80. Notification Bell

Recommended Admin-shell element:

```text
notification bell
+ unread badge
```

Click may open:

```text
bounded notification panel
or full Notification Center
```

## 81. Toasts

Realtime events may optionally show transient toasts.
Toasts must not replace durable notification records for actionable events.

## 82. Critical Alert UX

Courier SOS may require:

- persistent visual treatment
- sound
- explicit acknowledgment
- repeated prominence
  These are Open Decisions.

# MVP Scope

## 83. Required

- authenticated Admin notification feed
- Dashboard notification preview
- unread/read state
- per-Admin unread count
- permission-aware visibility
- source feature/type
- source ID/reference
- safe title/preview
- deep links
- newest-first ordering
- pagination
- realtime or polling refresh
- durable notification records
- safe rendering
- role/permission authorization
- Seller Compliance integration
- Complaints integration
- Courier SOS integration when Admin is an intended recipient
- CSRF for read mutations
- loading/empty/error states

## 84. Recommended

- pending registration notification
- Admin Chat reply notification
- report export completion/failure notification
- priority field
- bell/badge
- event deduplication
- outbox/async generation
- reconnect refetch
- safe internal deep-link mapping
- aggregated security alerts instead of one-per-blocked-request

## 85. Not Required

- outbound Push campaigns
- SMS campaigns
- promotional targeting
- announcement authoring
- direct chat
- Admin email notifications
- browser Push for Admin
- mobile Admin notifications
- notification templates CMS
- snooze
- assignment
- escalation workflows
- user-configurable Admin notification preferences
- notification export

# Acceptance Criteria

## 86. AC-01 — Admin Access

Guests/non-Admins cannot access Admin Notification APIs.

## 87. AC-02 — Permission Visibility

An Admin does not receive sensitive notification data for a feature they cannot access.

## 88. AC-03 — Durable Notification

An actionable notification is stored independently of realtime transport.

## 89. AC-04 — Dashboard Preview

Dashboard can retrieve a bounded notification preview.

## 90. AC-05 — Unread Count

Current Admin can retrieve an unread count for visible notifications.

## 91. AC-06 — Per-Admin Read

Admin A marking a notification read does not automatically mark it read for Admin B.

## 92. AC-07 — Read Transition

An unread notification can be marked read.

## 93. AC-08 — Read Idempotency

Marking an already-read notification read again does not corrupt state.

## 94. AC-09 — Read Does Not Resolve

Marking a notification read does not mutate the underlying business item.

## 95. AC-10 — Registration Role Scope

If pending-registration notifications are implemented, Courier approval is excluded from platform Admin registration workload.

## 96. AC-11 — Compliance Link

Seller Compliance notification routes to the authoritative compliance case.

## 97. AC-12 — Complaint Link

Complaint notification routes to the authoritative complaint case.

## 98. AC-13 — Chat Boundary

Admin Chat notification read state does not replace chat-message read receipts.

## 99. AC-14 — SOS Alert

A Courier SOS routed to platform Admin can create a critical durable notification.

## 100. AC-15 — SOS Privacy

Broad SOS preview does not unnecessarily expose precise location/task details.

## 101. AC-16 — Report Boundary

Report notification does not calculate/generate the report itself.

## 102. AC-17 — Push Boundary

Admin Notifications cannot dispatch Push/SMS campaigns.

## 103. AC-18 — Announcement Boundary

Publishing an announcement does not create a campaign or one notification per user.

## 104. AC-19 — Deduplication

Retrying the same logical event does not create uncontrolled duplicates.

## 105. AC-20 — Realtime Failure

Realtime failure does not delete the durable notification.

## 106. AC-21 — Reconnect

Client can refetch notifications/unread count after reconnect.

## 107. AC-22 — Business Independence

Notification-generation failure does not roll back the committed business event.

## 108. AC-23 — Deep-Link Authorization

Owning feature re-checks authorization when a notification is opened.

## 109. AC-24 — Route Safety

Notification deep links cannot redirect to arbitrary external URLs.

## 110. AC-25 — Safe Rendering

Notification previews cannot execute untrusted scripts.

## 111. AC-26 — Secret Safety

Notification payloads do not expose passwords, tokens, OTPs, or payment secrets.

## 112. AC-27 — Pagination

Notification history is bounded/paginated.

## 113. AC-28 — CSRF

Read-state mutations use configured Sanctum CSRF protection.

# Tests

## 114. Backend Tests

Test:

- guest denied
- non-Admin denied
- permission-filtered visibility
- durable notification creation
- newest-first ordering
- unread count
- per-Admin read state
- mark read
- idempotent mark read
- read does not change registration status
- read does not resolve complaint
- read does not resolve compliance case
- Seller Compliance source/deep link
- Complaint source/deep link
- Courier SOS critical notification when Admin recipient
- SOS payload minimized
- pending registration excludes Courier if implemented
- retry does not duplicate logical event
- notification failure does not roll back domain event
- realtime broadcast failure preserves stored notification
- pagination/filtering
- internal deep-link validation
- unsafe preview escaped/sanitized
- secrets absent from payloads
- CSRF required

## 115. Frontend Tests

Test:

- bell renders
- unread badge renders
- Dashboard preview loads
- full notification center loads
- loading/empty/error states
- unread/read distinction
- mark-read update
- read does not imply resolved
- source/priority visible where applicable
- deep link opens correct feature
- forbidden destination handled safely
- realtime notification appears
- reconnect refetch recovers missed items
- critical SOS visually distinguished when configured
- safe preview rendering
- responsive layout
- keyboard navigation
- state not color-only

# Open Decisions

## 116. Open Decisions

Current sources do not define:

1. exact notification schema
2. exact event-type enum
3. recipient routing
4. all-Admins vs permission-scoped notifications
5. assigned-Admin notifications
6. Admin teams/groups
7. priority enum
8. priority rules
9. whether pending registrations always notify Admin
10. whether Admin Chat replies notify Admin
11. whether report exports notify Admin
12. whether every Courier SOS reaches platform Admin
13. SOS acknowledgment
14. SOS escalation/repeat behavior
15. exact SOS preview data
16. realtime transport
17. polling interval
18. queue/outbox implementation
19. deduplication key format
20. notification retention
21. dismiss/archive/delete
22. mark-all-read
23. Dashboard preview count
24. page size
25. unread-count cache
26. browser-tab synchronization
27. toasts
28. critical sound/banner behavior
29. read-on-click vs read-on-detail-open
30. whether opening the notification panel marks anything read
31. Admin notification preferences
32. quiet hours
33. email/browser Push for Admin
34. exact Admin permission keys
35. security aggregation thresholds
36. exact event naming
37. retention/privacy rules for notification snapshots
38. notification-content immutability

# Final Definition

## 117. Final Definition

AISLEY Admin Notifications is:

```text
an internal Admin-facing attention feed

that converts meaningful platform events
into durable, permission-aware alerts
with safe previews and deep links
to authoritative Admin workflows.
```

Core mini-lifecycle:

```text
event
→ notification
→ UNREAD
→ READ
```

Important rule:

```text
READ notification
≠
RESOLVED business item
```

Examples:

```text
Seller Compliance alert
→ Monitor Seller Compliance

Complaint alert
→ Manage Complaints & Disputes

Courier SOS
→ intended Admin/safety destination

Pending registration (recommended)
→ Manage Account Registrations
```

Central boundary:

```text
Admin Notifications
= platform → Admin alerts

Push Notification Management
= Admin → user Push/SMS campaigns
```
