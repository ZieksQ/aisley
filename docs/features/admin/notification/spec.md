---
feature: Admin Notifications
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Admin Web Application
source_coverage: Current AISLEY project requirements; may be updated as event-producing features are implemented
---

# Admin Notifications Specification

## 1. Purpose

This document defines the **AISLEY Admin Notifications** feature.

Admin Notifications is the internal, Admin-facing attention and alert layer of AISLEY. It receives meaningful events from platform features and surfaces them to authorized administrators so they can quickly understand what requires attention and navigate to the correct owning workflow.

This feature is distinct from **Push Notification Management**.

```text
Admin Notifications
    = inbound alerts for Admins

Push Notification Management
    = outbound push/SMS campaigns sent by Admins to user segments
```

This specification is grounded in the current AISLEY project documents:

- `app.md`
- `Admin.md`
- `Buyer.md`
- `Seller.md`
- `Logistics.md`
- `Courier.md`

It also aligns with the already-defined Admin feature boundaries for:

- Account Approval
- Seller Compliance
- Complaints & Disputes
- Reports Overview
- Admin Dashboard

Where the source documents do not define exact event types, retention periods, priorities, delivery channels, polling intervals, read-state rules, or escalation policies, this specification marks those as recommended behavior or open decisions rather than presenting them as established business requirements.

---

# 2. Core Value

`Admin.md` defines the Dashboard as:

```text
Overview of platform, display notification.
```

The expanded Dashboard definition requires:

```text
alerts for critical notifications
that require immediate attention upon login
```

and the System Context requires:

```text
a real-time or polling mechanism
for incoming notifications
```

Therefore, Admin Notifications exists to answer:

```text
What changed?
What requires Admin attention?
How urgent is it, if urgency is defined?
Where should the Admin go to handle it?
Has the Admin already seen it?
```

The notification system should route attention to the correct feature.

It should not duplicate that feature's business logic.

---

# 3. Goals

Admin Notifications must:

1. provide Admins with a centralized notification feed
2. surface relevant platform events requiring awareness or action
3. integrate with the Admin Dashboard
4. support incoming notifications through real-time delivery or polling
5. identify the source feature of each notification
6. provide a clear destination/action link where appropriate
7. avoid duplicating the owning feature's state
8. support multiple Admins
9. be compatible with custom Admin permissions
10. prevent unauthorized Admins from receiving sensitive notification content
11. support deterministic notification ordering
12. provide an unread/read model if implemented
13. support notification counts/badges if implemented
14. avoid duplicate notifications for the same event where practical
15. handle notification generation asynchronously where appropriate
16. remain usable when the real-time transport is unavailable
17. protect sensitive user and operational data
18. distinguish critical operational alerts from ordinary informational events when a priority model is defined
19. remain separate from outbound Push Notification Management
20. remain separate from Admin Chat/Messaging

---

# 4. Non-Goals

Admin Notifications does not itself implement:

- account approval
- seller compliance decisions
- complaint/dispute adjudication
- user account suspension
- financial calculations
- report generation
- audit-log storage
- Admin-to-user messaging
- Buyer-to-Seller messaging
- Logistics dispatch
- Courier task assignment
- Seller order notifications
- Buyer order tracking
- promotional push campaigns
- SMS marketing blasts
- email marketing
- arbitrary notification targeting to customers
- platform announcement authoring
- policy publishing
- business workflow state transitions

The notification system points Admins to these workflows rather than replacing them.

---

# 5. Primary User

## 5.1 Admin

Admin is the recipient.

AISLEY intends to support:

```text
initial Admin
    ↓
additional Admins
    ↓
custom permissions
```

Therefore, Admin Notifications must not assume there is only one administrator.

A notification may be:

```text
visible to all authorized Admins
visible to Admins with a certain permission
visible to one assigned Admin
```

depending on the source feature and future permission/assignment rules.

Exact recipient rules are not fully defined by the current source documents.

---

# 6. Relationship to the Admin Dashboard

The Dashboard is the primary entry point for Admins.

It explicitly requires:

```text
notifications
pending actionable items
critical notifications requiring attention upon login
real-time or polling updates
```

Therefore, Admin Notifications must provide Dashboard-compatible data.

Recommended Dashboard presentation:

```text
Notifications

[Unread indicator] New seller registration awaiting review
[Unread indicator] New complaint submitted
[Unread indicator] Seller compliance case requires review
...
```

The Dashboard should show only a bounded preview.

The full notification history should live in a dedicated notification surface.

---

# 7. Relationship to Push Notification Management

`Admin.md` separately defines:

```text
Push Notification Management
```

as:

```text
Send customized push notifications or SMS blasts
to specific user segments
```

Examples include:

```text
inactive buyers
top-performing sellers
announcements
promos
critical alerts
```

This is an outbound communication tool.

Admin Notifications is different:

```text
Platform event
    ↓
Admin receives internal alert
```

Push Notification Management is:

```text
Admin creates campaign/message
    ↓
selected users receive push/SMS
```

The two systems may share low-level notification infrastructure, but they must remain separate feature domains.

---

# 8. Relationship to Chat/Messaging

`Admin.md` defines Chat/Messaging as:

```text
a direct, secure communication channel
bridging administration and users
```

with:

```text
read receipts
historical archiving
```

Admin Notifications is not a chat system.

A notification may tell an Admin:

```text
A user replied to an Admin support thread.
```

and link to:

```text
Chat/Messaging
```

but the actual message content/history belongs to the messaging domain.

---

# 9. Relationship to System Audit Logs

Notifications and Audit Logs solve different problems.

```text
Admin Notifications
    tells Admins what requires awareness/attention

System Audit Logs
    records immutable administrative actions
```

Receiving or reading a notification is not itself a substitute for an audit record.

A compliance suspension, approval, dispute resolution, or account change must still be audited by the owning workflow.

---

# 10. Notification Source Principle

Notifications should originate from authoritative domain events.

Conceptually:

```text
Source Feature
    performs / detects meaningful event
        ↓
domain event emitted
        ↓
Admin Notification created for eligible recipient(s)
        ↓
Admin sees notification
        ↓
Admin navigates to source feature
```

The notification system should not independently scan and reinterpret every domain table if the owning feature can emit a clear event.

---

# 11. Recommended Notification Model

A notification should conceptually contain:

```text
id
event type
recipient / audience
source feature
title
summary
target link / target entity
created timestamp
read state, if implemented
priority, if defined
metadata required for routing
```

Example conceptual object:

```json
{
  "id": "notification-id",
  "type": "ACCOUNT_REGISTRATION_PENDING",
  "source": "ACCOUNT_APPROVAL",
  "title": "New seller registration",
  "summary": "A seller registration is awaiting review.",
  "target": {
    "type": "REGISTRATION",
    "id": "registration-id"
  },
  "created_at": "timestamp",
  "read_at": null
}
```

This is not a mandated schema.

Use repository conventions.

---

# 12. Notification Content Principle

A notification should answer:

```text
what happened?
what feature does it belong to?
what should the Admin do, if anything?
where should the Admin navigate?
```

It should not contain the entire underlying case/application/report.

Example:

```text
New complaint submitted
A new complaint requires Admin review.
View complaint
```

instead of embedding all complaint evidence in the notification payload.

---

# 13. Notification Data Minimization

Notification payloads should contain only the data needed to inform and route the Admin.

Avoid embedding:

- full applicant profiles
- complaint evidence
- private documents
- passwords
- payment credentials
- full message histories
- sensitive Courier location history
- raw audit payloads
- protected Seller information unrelated to the alert

The destination feature should retrieve its own authorized detail data.

---

# 14. Notification Recipients

The current source documents establish multiple Admin accounts with custom permissions but do not define exact notification routing.

Recommended recipient strategies:

```text
ALL_AUTHORIZED_ADMINS
PERMISSION_SCOPED_ADMINS
ASSIGNED_ADMIN
SPECIFIC_ADMIN
```

Exact recipient resolution should come from the shared Admin authorization/assignment architecture.

---

# 15. Permission-Aware Delivery

A notification must not reveal sensitive feature data to an Admin who cannot access the feature.

Example:

```text
Admin lacks permission to review complaints
    ↓
should not receive private complaint content
```

Possible implementation:

```text
do not create notification for that Admin
```

or:

```text
create only a generic notification if policy allows
```

The preferred pattern is to scope notification recipients using source-feature authorization.

---

# 16. Shared vs Per-Admin Notification State

Two different concepts should remain distinct:

```text
Underlying platform event
```

and:

```text
an Admin's notification state
```

Example:

```text
one Seller registration event
        ↓
Admin A notification unread
Admin B notification read
Admin C not authorized, no notification
```

This suggests a notification/event model capable of per-recipient state.

Exact persistence architecture is implementation-dependent.

---

# 17. Recommended Notification Read State

The source does not explicitly define read/unread for Admin Notifications.

However, a notification feed needs a way to distinguish seen items.

Recommended model:

```text
UNREAD
READ
```

or:

```text
read_at = null / timestamp
```

This is a recommended implementation detail, not an explicit source requirement.

---

# 18. Unread Count

If read state is implemented, the Admin shell should be able to show:

```text
Unread notification count
```

Example:

```text
bell icon
3
```

The count should include only notifications the current Admin is authorized to receive.

---

# 19. Read Semantics

Recommended behavior:

```text
notification opened / explicitly marked read
    ↓
read_at set
```

Opening the notification panel alone should not necessarily mark every item read.

Exact behavior is a UI decision.

---

# 20. Mark as Read

Recommended operation:

```text
mark one notification as read
```

Optional:

```text
mark all as read
```

If "mark all" exists, it must apply only to the authenticated Admin's notifications.

---

# 21. Notification Deletion

The source documents do not define notification deletion.

For MVP, permanent user-facing deletion is not required.

Notifications may instead:

```text
remain read
age out through retention policy
```

Exact retention is an open decision.

---

# 22. Notification Ordering

Recommended default:

```text
newest first
```

If a formal priority model is introduced, sorting may become:

```text
priority
then recency
```

The current source does not define severity ordering.

---

# 23. Priority

The Dashboard mentions:

```text
critical notifications requiring immediate attention
```

but the project does not define a complete priority taxonomy.

A recommended model could be:

```text
CRITICAL
ACTION_REQUIRED
INFORMATIONAL
```

but these exact labels are not source-mandated.

For MVP, notification types may be presented without a formal severity enum.

---

# 24. Critical Notification Principle

Only events with source-backed urgency should be presented as critical.

Do not label routine events as emergencies merely to attract attention.

Example:

```text
New registration
    actionable, but not necessarily critical

Courier SOS
    potentially critical safety event
```

Severity must derive from the owning domain.

---

# 25. Account Approval Integration

AISLEY's auth flow defines:

```text
Buyer → register → Admin approval
Seller → register → Admin approval
Logistics → register → Admin approval
```

Therefore, a new pending Admin-managed registration is a strong source for an Admin notification.

Recommended event:

```text
ACCOUNT_REGISTRATION_PENDING
```

Possible display:

```text
New registration awaiting review
A Seller registration was submitted.
View registration
```

---

# 26. Account Approval Role Scope

Admin registration notifications should cover:

```text
BUYER
SELLER
LOGISTICS
```

They should not cover:

```text
COURIER
```

as an Admin approval item.

Courier registrations are approved by Logistics according to `app.md`.

---

# 27. Registration Notification Destination

Destination:

```text
Manage Account Registrations
```

Prefer linking directly to the specific application when possible.

Example:

```text
/registrations/{id}
```

Exact routes follow repository conventions.

---

# 28. Registration Decision Notification to Admin

The source explicitly requires approval/rejection **emails to applicants**.

It does not require notifying Admins about their own approval/rejection action.

Therefore:

```text
registration approved
registration rejected
```

do not automatically need an Admin notification.

Those actions belong in:

```text
System Audit Logs
```

unless another Admin needs awareness under a future collaboration model.

---

# 29. Seller Compliance Integration

`Admin.md` requires:

```text
internal reporting/flagging mechanism
```

for Seller Compliance.

A new seller/product compliance case is therefore a valid Admin attention event.

Recommended event:

```text
SELLER_COMPLIANCE_CASE_CREATED
```

Possible display:

```text
Seller compliance item requires review
A seller or product was flagged for review.
Review compliance case
```

---

# 30. Compliance Notification Destination

Destination:

```text
Monitor Seller Compliance
```

Prefer direct case link where possible.

---

# 31. Seller Warning Notification to Admin

Issuing a Seller warning is an Admin action.

The source requires:

```text
messaging integration
audit logging
```

It does not require an additional Admin notification for the same Admin action.

Avoid notification noise.

---

# 32. Seller Suspension Notification to Admin

A Seller suspension is important, but it is already an Admin-initiated action and must be audited.

Do not create a redundant notification for the actor by default.

A future multi-Admin policy may notify other authorized Admins if desired.

That behavior is not currently defined.

---

# 33. Complaints and Disputes Integration

`Admin.md` defines a centralized ticketing system for:

```text
user-submitted reports
complaints
disputes
```

A new complaint/dispute is a strong Admin notification source.

Recommended event:

```text
COMPLAINT_CREATED
```

Possible display:

```text
New complaint submitted
A new complaint requires review.
View complaint
```

---

# 34. Complaint Reply / New Evidence

If the complaint system supports:

```text
request additional information
user reply
additional evidence
```

then those events may warrant Admin notifications.

Recommended future events:

```text
COMPLAINT_USER_REPLIED
COMPLAINT_EVIDENCE_ADDED
```

These depend on the final Complaints implementation.

---

# 35. Complaint Notification Destination

Destination:

```text
Manage Complaints and Disputes
```

Prefer direct link to the case.

---

# 36. Reports Overview Integration

`Admin.md` states that large reports may be generated through background jobs.

The source does not explicitly say report completion generates a notification.

However, if asynchronous exports are implemented, notifying the requesting Admin when the export finishes is a useful recommended integration.

Possible events:

```text
REPORT_EXPORT_COMPLETED
REPORT_EXPORT_FAILED
```

These are recommended implementation events, not explicit source requirements.

---

# 37. Report Export Recipient

A report export completion/failure notification should generally go only to:

```text
the Admin who requested the export
```

unless a future shared-report workflow defines other recipients.

---

# 38. Report Notification Destination

Destination may be:

```text
Reports Overview
```

or:

```text
specific export status/download record
```

The notification must not contain a public export URL.

---

# 39. Manage User Accounts Integration

`Admin.md` allows Admins to:

```text
suspend
restore
deactivate/update account status
```

The source does not define automatic Admin notifications for those changes.

These actions should always be auditable.

Admin notifications may be introduced later for:

```text
high-risk account events
manual review requests
```

if the User Accounts feature defines such events.

Do not invent them in MVP.

---

# 40. Messaging Integration

Admin Chat/Messaging may have:

```text
unread messages
responses from users
```

The source explicitly requires read receipts and history, but does not explicitly define a separate Admin notification for every message.

A recommended integration is:

```text
ADMIN_MESSAGE_RECEIVED
```

or an unread-message count.

This should avoid generating excessive duplicate alerts for rapid chat messages.

---

# 41. Message Notification Grouping

Recommended behavior for rapid message events:

```text
several messages in same thread
    ↓
one grouped/updateable notification
```

rather than:

```text
one notification per message
```

This is an anti-noise recommendation.

Exact grouping rules are open.

---

# 42. Platform Settings Integration

`Admin.md` defines:

```text
Announcements
Policy updates
requires re-consent
```

These are Admin-created outbound/system configuration actions.

They do not inherently need Admin Notifications.

A future system-health event related to failed publication could generate a notification, but this is not source-defined.

---

# 43. Audit Logs Integration

Audit Logs must not generate a notification for every Admin action.

Doing so would create a loop:

```text
Admin action
    ↓
audit record
    ↓
notification
    ↓
Admin reads notification
    ↓
potential audit record
```

Admin Notifications should consume meaningful domain attention events, not generic audit events.

---

# 44. Global Ban / Blocklist Integration

`Admin.md` defines Global Ban/Blocklist as a security/threat mitigation feature.

The source does not explicitly define Admin alert events when:

```text
blocked IP matches
flagged payment method matches
banned user attempts access
```

These could become future Admin Notifications if the security feature defines them.

Do not invent alert volume or severity yet.

---

# 45. Courier Incident Integration

`Courier.md` defines Incident Reporting:

```text
vehicle breakdown
accident
inaccessible delivery address
```

and says it:

```text
immediately notifies the central dispatch team
```

The primary owning recipient is Logistics/dispatch.

These incidents should not automatically flood platform Admin Notifications unless a future escalation policy defines Admin visibility.

---

# 46. Courier SOS / Emergency Integration

`Courier.md` defines SOS/Emergency Button as:

```text
a critical safety alert system
```

and states its primary utility is:

```text
internal alerting
notifying the logistics/admin team
```

with:

```text
high-priority webhooks or push notifications
to a centralized admin/dispatch dashboard
```

Therefore, Courier SOS is source-supported as a potential critical Admin notification.

Recommended event:

```text
COURIER_SOS_TRIGGERED
```

Possible display:

```text
Courier emergency alert
A Courier triggered an SOS during an active delivery.
View incident
```

---

# 47. Courier SOS Data Minimization

The source says the SOS can transmit:

```text
last known GPS coordinates
active task ID
```

The Admin notification itself should not necessarily embed exact coordinates in the feed.

Recommended:

```text
notification summary
    ↓
secure incident/detail page
    ↓
authorized location/context
```

This reduces sensitive location exposure.

---

# 48. Courier SOS Recipient Scope

Because Logistics owns Courier operations, the primary real-time recipient should remain the relevant Logistics/dispatch organization.

Admin notification delivery may also occur if AISLEY chooses platform-level safety oversight.

The source supports "logistics/admin team" but does not define exact routing precedence.

This remains an implementation/product decision.

---

# 49. Courier Delivery Completion

`Courier.md` says marking delivery complete cascades notifications to:

```text
Buyer
Seller
```

This is not normally an Admin notification.

Do not send routine delivery-completion events to Admins unless a future monitoring requirement says so.

---

# 50. Seller Order Notifications

`Seller.md` has a dedicated Seller Order Notifications feature.

These notifications belong to Sellers.

They must not appear in Admin Notifications merely because they use the same low-level infrastructure.

---

# 51. Seller Low Stock Alerts

Seller low-stock notifications belong to the Seller domain.

They are not Admin notifications.

---

# 52. Buyer Wishlist / Product Alerts

Buyer wishlist price-drop/restock alerts belong to Buyers.

They are not Admin notifications.

---

# 53. Buyer Product Q&A Alerts

Product Q&A notifications belong to:

```text
Seller
Buyer who asked
```

They are not Admin notifications.

---

# 54. Logistics Order Status Notifications

Logistics status changes trigger Buyer/Seller notifications.

These should not appear in Admin Notifications unless the Admin feature later defines an operational exception event.

---

# 55. Event Ownership Matrix

Recommended high-level ownership:

| Event | Normal Recipient | Admin Notification? |
|---|---|---|
| New Buyer registration | Admin | Yes |
| New Seller registration | Admin | Yes |
| New Logistics registration | Admin | Yes |
| New Courier registration | Logistics | No |
| New seller compliance case | Admin | Yes |
| New complaint/dispute | Admin | Yes |
| Complaint user reply | Admin | Recommended if implemented |
| Complaint evidence added | Admin | Recommended if implemented |
| Report export complete | Requesting Admin | Recommended |
| Report export failed | Requesting Admin | Recommended |
| Admin warning issued | Seller via messaging | Usually no Admin alert |
| Seller suspended by Admin | Seller / audit | Usually no actor alert |
| Seller new order | Seller | No |
| Seller low stock | Seller | No |
| Order delivered | Buyer/Seller | No |
| Courier incident | Logistics/dispatch | Usually no, unless escalated |
| Courier SOS | Logistics and potentially Admin | Yes/critical if routed to Admin |
| Buyer wishlist restock | Buyer | No |
| Product Q&A response | Buyer/Seller | No |

This matrix separates Admin attention events from role-specific notifications.

---

# 56. Event Type Naming

Event names should be stable machine-readable identifiers.

Recommended pattern:

```text
DOMAIN_EVENT
```

Examples:

```text
ACCOUNT_REGISTRATION_PENDING
SELLER_COMPLIANCE_CASE_CREATED
COMPLAINT_CREATED
COMPLAINT_USER_REPLIED
REPORT_EXPORT_COMPLETED
REPORT_EXPORT_FAILED
COURIER_SOS_TRIGGERED
```

Exact names should follow repository conventions.

---

# 57. Notification Title

Titles should be short and actionable.

Examples:

```text
New registration awaiting review
New complaint submitted
Seller compliance item requires review
Report export ready
Report export failed
Courier emergency alert
```

Avoid titles that expose unnecessary sensitive details.

---

# 58. Notification Summary

Summary text should provide enough context to choose whether to open the notification.

Example:

```text
A Seller registration was submitted and is waiting for Admin review.
```

Do not include confidential evidence or full PII.

---

# 59. Notification Target

A notification should link to the owning workflow.

Recommended structure:

```text
target_type
target_id
target_route or route metadata
```

Examples:

```text
REGISTRATION
COMPLIANCE_CASE
COMPLAINT_CASE
REPORT_EXPORT
COURIER_INCIDENT
MESSAGE_THREAD
```

The backend/frontend should build safe internal links.

---

# 60. Stale Target Handling

A notification may outlive the target state.

Example:

```text
Admin sees pending registration notification
another Admin already approved registration
```

Opening the notification should:

```text
navigate to current target state
```

not fail solely because the original event is no longer actionable.

The destination page should show:

```text
already reviewed
```

or current status.

---

# 61. Actionability

Notifications may be:

```text
ACTIONABLE
INFORMATIONAL
CRITICAL
```

conceptually.

For actionable items, the notification should point to the owning feature.

The notification feed itself should generally not execute high-impact business actions.

---

# 62. No Inline High-Impact Actions

For MVP, do not approve/reject/suspend/resolve directly inside the notification item.

Examples that should require destination workflow:

```text
Approve registration
Reject registration
Suspend Seller
Remove product
Resolve complaint
```

The destination feature contains the evidence/context needed for a safe decision.

---

# 63. Notification Center Route

Recommended route:

```text
/notifications
```

The Admin Dashboard may contain only a preview.

The dedicated page should support:

```text
notification history
unread/read state
filtering if needed
pagination
```

---

# 64. Notification Bell / Shell Integration

The Admin application shell may include:

```text
notification bell/icon
unread badge
popover/dropdown preview
```

Selecting:

```text
View all notifications
```

routes to:

```text
/notifications
```

Exact visual design follows the Admin design system.

---

# 65. Notification Center Layout

Recommended:

```text
Notifications

[All] [Unread]

---------------------------------------------
New seller registration            2 min ago
A seller application awaits review.
[View]
---------------------------------------------
New complaint                      8 min ago
A complaint requires review.
[View]
---------------------------------------------
```

This is an information structure, not a pixel-perfect mandate.

---

# 66. Filters

The source does not require notification filtering.

Recommended MVP filters:

```text
ALL
UNREAD
```

Optional later filters:

```text
Account Approval
Seller Compliance
Complaints
Reports
Safety
Messaging
```

Only add domain filters if notification volume justifies them.

---

# 67. Pagination

The notification history must be paginated or cursor-based.

Do not load an unbounded lifetime notification history into the browser.

---

# 68. Unread Badge Consistency

If the application displays an unread count in:

```text
Admin Header
Dashboard
Notification Center
```

all surfaces should use the same authoritative unread-state logic.

---

# 69. Real-Time Delivery

`Admin.md` explicitly allows:

```text
real-time
or
polling
```

Therefore, the implementation may use:

```text
WebSockets
Server-Sent Events
polling
```

depending on existing project architecture.

Do not introduce a new real-time stack solely for notifications if polling already satisfies the project.

---

# 70. Polling

If polling is used:

```text
Admin client periodically requests
new/unread notifications
```

The exact polling interval is not defined by the source.

It should be configurable or chosen based on expected load and urgency.

---

# 71. Real-Time Fallback

If WebSockets/SSE are used, the system should still recover notifications after reconnect.

Recommended:

```text
real-time event
    for immediacy

API query
    for authoritative history/recovery
```

Do not make a transient socket disconnect cause permanent notification loss.

---

# 72. Notification Persistence

A notification should be persisted before or as part of reliable delivery if the event matters beyond the current socket connection.

This allows:

```text
Admin offline
    ↓
logs in later
    ↓
still sees unread notification
```

The Dashboard requirement specifically expects important notifications upon login.

---

# 73. Delivery Reliability

Important Admin events should not rely solely on:

```text
ephemeral frontend toast
```

A persisted notification record or equivalent durable event store is recommended for events requiring later attention.

---

# 74. Event Generation

Recommended architecture:

```text
Domain Service
    ↓
domain event
    ↓
notification listener/handler
    ↓
resolve recipients
    ↓
persist notification(s)
    ↓
broadcast/pollable feed
```

This keeps business logic in the owning domain.

---

# 75. Queue / Asynchronous Processing

Notification fan-out can be asynchronous where appropriate.

Example:

```text
new complaint
    ↓
case transaction commits
    ↓
notification job/event queued
    ↓
notifications created/broadcast
```

A temporary notification transport failure should not roll back the complaint itself.

---

# 76. Transaction Boundary

Recommended principle:

```text
business event commits first
notification delivery follows reliably
```

Do not leave the primary feature in an ambiguous state solely because the Admin notification mechanism was temporarily unavailable.

For high-reliability events, use the project's queue/outbox conventions.

---

# 77. Duplicate Prevention

The system should avoid duplicate notification rows when the same domain event is retried.

Recommended event identity:

```text
source_event_id
recipient_admin_id
```

or equivalent uniqueness/idempotency strategy.

Exact implementation depends on the event architecture.

---

# 78. Notification Grouping

Some event sources can generate high volume.

Recommended grouping where appropriate:

```text
multiple messages in same Admin thread
multiple identical alerts for same target
```

Do not group distinct critical events that require individual investigation.

---

# 79. Notification Flood Protection

Admin Notifications should not become a raw event stream of every platform change.

Do not notify Admins for routine events such as:

```text
every order status update
every wishlist change
every stock decrement
every delivered order
every Seller page view
```

unless a formal Admin monitoring requirement exists.

---

# 80. Action Center vs Notifications

The Admin Dashboard may contain both:

```text
Action Center
Notifications
```

They serve different purposes.

```text
Action Center
    current queues/counts derived from workflow state

Notifications
    event history indicating that something changed
```

Example:

```text
Action Center:
24 pending registrations

Notifications:
New Seller registration submitted 2 minutes ago
```

The count is state-based.

The notification is event-based.

---

# 81. Notification Does Not Define Workflow State

A notification must not be the source of truth for whether something is still pending.

Example:

```text
notification says:
New complaint submitted

but case was resolved by another Admin
```

The notification remains historical, while the complaint feature shows the current status.

---

# 82. Marking Read Does Not Resolve Work

Important invariant:

```text
notification.read = true
    ≠
registration approved
    ≠
complaint resolved
    ≠
compliance case completed
```

Read state only means the Admin has acknowledged/viewed the notification.

---

# 83. Resolving Work Does Not Necessarily Mark Notification Read

If another Admin resolves the source case, a notification may remain unread for the original recipient.

Possible UX:

```text
open notification
    ↓
destination shows already resolved
```

Automatic read/cleanup rules are optional.

---

# 84. Multi-Admin Collaboration

Because multiple Admins can exist, notifications should not imply exclusive ownership unless assignment exists.

Example:

```text
New complaint requires review
```

does not mean:

```text
this complaint is assigned to you
```

unless the Complaints feature introduces assignment.

---

# 85. Notification Assignment

If a source feature later supports case assignment:

```text
assigned Admin
```

notifications may target that Admin specifically.

This is future-compatible behavior.

---

# 86. Account Approval Notification Example

```text
Type:
ACCOUNT_REGISTRATION_PENDING

Title:
New seller registration

Summary:
A Seller registration is awaiting Admin review.

Target:
Registration detail

Priority:
Actionable / normal
```

The applicant's full profile should be loaded only after opening the protected detail page.

---

# 87. Seller Compliance Notification Example

```text
Type:
SELLER_COMPLIANCE_CASE_CREATED

Title:
Seller compliance item requires review

Summary:
A seller or product has been flagged for Admin review.

Target:
Compliance case detail
```

Do not expose the full report/evidence in the notification.

---

# 88. Complaint Notification Example

```text
Type:
COMPLAINT_CREATED

Title:
New complaint submitted

Summary:
A new complaint requires Admin review.

Target:
Complaint case detail
```

---

# 89. Complaint Reply Notification Example

Recommended if supported:

```text
Type:
COMPLAINT_USER_REPLIED

Title:
New reply on complaint

Summary:
A user responded to an Admin request for information.

Target:
Complaint case
```

---

# 90. Export Notification Example

Recommended if asynchronous exports are implemented:

```text
Type:
REPORT_EXPORT_COMPLETED

Title:
Report export ready

Summary:
Your requested financial report has finished generating.

Target:
Export status/download
```

The file itself must remain protected.

---

# 91. Export Failure Notification Example

```text
Type:
REPORT_EXPORT_FAILED

Title:
Report export failed

Summary:
Your requested financial report could not be generated.

Target:
Reports Overview / export status
```

Do not leak internal stack traces in the summary.

---

# 92. Courier SOS Notification Example

If routed to platform Admin:

```text
Type:
COURIER_SOS_TRIGGERED

Title:
Courier emergency alert

Summary:
A Courier triggered an SOS during an active delivery.

Target:
Authorized emergency/incident context

Priority:
Critical
```

Exact coordinates should be retrieved from the secure destination if authorized.

---

# 93. Messaging Notification Example

Recommended if Admin Messaging produces inbox notifications:

```text
Type:
ADMIN_MESSAGE_RECEIVED

Title:
New user message

Summary:
A user replied to an Admin conversation.

Target:
Admin messaging thread
```

Consider grouping multiple messages from the same thread.

---

# 94. Notification API — List

Recommended conceptual endpoint:

```http
GET /api/admin/notifications
```

Possible query parameters:

```text
status=unread|all
type
source
cursor
page
per_page
```

Exact route conventions should follow the repository.

---

# 95. Notification API — Unread Count

Recommended:

```http
GET /api/admin/notifications/unread-count
```

or include unread count with the list/session response.

Avoid excessive duplicate requests if the shell already fetches notification state.

---

# 96. Notification API — Mark Read

Recommended:

```http
POST /api/admin/notifications/{id}/read
```

or:

```http
PATCH /api/admin/notifications/{id}
```

The request must only modify the authenticated Admin's recipient state.

---

# 97. Notification API — Mark All Read

Optional:

```http
POST /api/admin/notifications/read-all
```

Requirements:

```text
authenticated Admin
scope only to current Admin
do not modify other Admins' read states
```

---

# 98. Notification API Response

Conceptual:

```json
{
  "id": "notification-id",
  "type": "COMPLAINT_CREATED",
  "source": "COMPLAINTS_DISPUTES",
  "title": "New complaint submitted",
  "summary": "A new complaint requires Admin review.",
  "target": {
    "type": "COMPLAINT_CASE",
    "id": "case-id"
  },
  "created_at": "timestamp",
  "read_at": null
}
```

Do not treat this as a mandated schema.

---

# 99. Pagination Response

Use repository conventions.

Conceptually:

```json
{
  "data": [],
  "meta": {
    "next_cursor": null,
    "unread_count": 0
  }
}
```

---

# 100. Backend Authorization

Every notification request must enforce:

```text
authenticated Admin
recipient ownership / eligibility
source-feature permission where applicable
```

An Admin must not retrieve another Admin's private notification record by guessing its ID.

---

# 101. Target Authorization

Opening a notification target requires the destination feature to perform its own authorization.

The notification's existence does not grant access.

Example:

```text
notification target = complaint case
    ↓
Complaints API still checks complaint permission
```

---

# 102. Sensitive Notification Types

Critical/sensitive notifications may need stricter recipient scoping.

Examples:

```text
Courier SOS
security alerts
sensitive complaint events
```

Do not broadcast these globally unless the authorization policy explicitly allows it.

---

# 103. Notification Read Privacy

Per-Admin read state is private operational state.

One Admin should not normally be able to mark another Admin's notifications read.

Whether supervisors can view team notification acknowledgement is not defined.

---

# 104. Read Timestamp

Recommended field:

```text
read_at
```

This is more useful than a mutable boolean because it preserves when the notification was acknowledged.

---

# 105. Created Timestamp

Every notification should have:

```text
created_at
```

for ordering and recency display.

Use the application's canonical timezone handling.

---

# 106. Relative Time UI

Frontend may display:

```text
2 min ago
1 hr ago
Yesterday
```

while retaining exact timestamp accessibility.

The source does not define date formatting.

---

# 107. Retention

The source does not define how long Admin Notifications should be stored.

Potential policies:

```text
fixed days
fixed months
indefinite until cleanup
```

This is an open decision.

System Audit Logs remain the authoritative long-term Admin action history regardless of notification retention.

---

# 108. Archiving

Notification archiving is not required for MVP.

Read history plus retention may be sufficient.

---

# 109. Search

The source does not require notification search.

MVP does not need full-text search.

If notification history becomes large, source/type/date filters are preferable to free-text search.

---

# 110. Empty State

Examples:

```text
No notifications yet.
```

or:

```text
You're all caught up.
```

Use project tone conventions.

Do not create fake notifications.

---

# 111. Unread Empty State

Example:

```text
No unread notifications.
```

---

# 112. Loading State

While loading:

- render Admin shell
- show notification skeletons
- do not flash notifications from another Admin/session
- do not show a fake unread count

---

# 113. Error State

Handle:

```text
notification list failure
unread-count failure
mark-read failure
real-time connection failure
polling failure
expired session
permission change
target no longer exists
```

A real-time failure should not necessarily make the full Admin application unusable.

---

# 114. Real-Time Connection Failure

Recommended fallback:

```text
socket/SSE unavailable
    ↓
continue using API/polling if available
```

The notification center should remain queryable.

---

# 115. Notification Creation Failure

A source business transaction should not generally be rolled back solely because an ordinary Admin notification could not be created.

Example:

```text
complaint submission succeeds
notification queue temporarily fails
```

The complaint should remain valid.

Use reliable retry/outbox/event patterns for important events.

---

# 116. Critical Event Reliability

Critical safety events such as Courier SOS have stronger delivery expectations than routine registration notifications.

If platform Admin receives SOS alerts, the implementation should use the owning Courier/Logistics emergency-delivery architecture rather than relying only on the ordinary notification feed.

The Admin notification record can supplement the critical alert channel.

---

# 117. Browser Notification Permission

Admin Notifications does not require browser push permission for MVP.

In-app notifications can work through the web application.

Browser/system push is a separate delivery decision.

---

# 118. Email to Admin

The source does not require Admin notification emails.

Do not automatically send every Admin notification through Brevo.

Brevo is explicitly used for system email elsewhere, but Admin internal alert email rules are not defined.

---

# 119. SMS to Admin

The source does not define SMS to Admins.

Do not conflate internal Admin Notifications with Push Notification Management/SMS blasts.

---

# 120. Push to Admin

Push delivery to Admin devices is not explicitly required.

The source only requires:

```text
real-time or polling incoming notifications
```

for the Admin Dashboard.

---

# 121. Event Timestamps

A notification should preserve:

```text
event/notification creation time
```

If domain event time differs from notification delivery time, retaining both may be useful.

The source does not require both.

---

# 122. Notification Freshness

For routine Admin events:

```text
near-real-time
```

is sufficient according to the real-time/polling requirement.

For Courier SOS:

```text
immediate/high-priority
```

comes from the Courier safety requirement.

---

# 123. Notification Badge Reset

Do not reset unread count simply because the Admin opens the Dashboard.

Use actual read-state transitions.

---

# 124. New Notification Indicator

When a new notification arrives while the Admin is online:

```text
update badge
optionally show small toast
insert/update feed
```

The toast should not be the only durable representation.

---

# 125. Toast vs Notification

```text
Toast
    ephemeral UI feedback

Admin Notification
    durable attention record
```

Example:

```text
Admin clicks Approve
→ "Registration approved" toast

New Seller registration submitted
→ Admin notification
```

Do not store every success toast as a notification.

---

# 126. Notification vs Email

Applicant approval/rejection emails are outbound lifecycle communications.

They are not Admin Notifications.

Example:

```text
Admin approves Seller
    ↓
Seller receives approval email
```

No Admin notification is required for the actor.

---

# 127. Notification vs Announcement

Platform announcements are content authored by Admin and broadcast to user dashboards.

They are not Admin Notifications.

---

# 128. Notification vs Audit

Audit records should remain comprehensive and immutable.

Notifications should remain selective and attention-focused.

Not every audited action should create a notification.

---

# 129. Notification vs Workflow Queue

Workflow queues such as:

```text
Pending Registrations
Open Complaints
Compliance Cases
```

remain authoritative state queries.

Notifications are not used to calculate those queues.

---

# 130. Dashboard Count Consistency

Dashboard unread notification count should derive from Admin Notification state.

Dashboard workflow KPI counts should derive from their source domains.

Example:

```text
Notifications unread = 5

Pending registrations = 24
```

These are different measures.

---

# 131. Deleted / Inaccessible Target

If a target no longer exists or the Admin loses permission:

```text
notification remains historical if retained
target action becomes unavailable
UI explains that the item is no longer accessible
```

Do not leak target content.

---

# 132. Permission Changes

If an Admin's permissions change after notification creation, target access must reflect current authorization.

Possible behavior:

```text
notification hidden on subsequent query
```

or:

```text
notification shown generically but target forbidden
```

Preferred behavior should avoid revealing sensitive data.

Exact policy is open.

---

# 133. Admin Deactivation

If an Admin account is deactivated, their unread notification state does not need to be reassigned automatically unless source feature assignment requires it.

Assignment/reassignment is a separate collaboration concern.

---

# 134. Notification Database Design

Possible designs:

### Per-Admin Row

```text
admin_notifications
id
admin_id
type
source
title
summary
target_type
target_id
created_at
read_at
```

### Event + Recipient State

```text
notification_events
notification_recipients
```

The second pattern can reduce duplication for multi-Admin broadcast events.

The exact schema should be chosen based on project architecture.

---

# 135. Event + Recipient Model

Conceptually:

```text
notification_events
    id
    event_type
    source_type
    source_id
    title
    summary
    target
    created_at

notification_recipients
    event_id
    admin_id
    read_at
```

This is recommended architecture, not a source requirement.

---

# 136. Indexing

Common access patterns suggest indexes on:

```text
admin_id / recipient
read_at
created_at
type
source
```

depending on schema.

Unread count should not require a full-table scan.

---

# 137. Unread Query

Conceptually:

```text
WHERE admin_id = current_admin
AND read_at IS NULL
```

with appropriate index support.

---

# 138. Pagination Strategy

Cursor pagination is well suited to:

```text
created_at + id
```

for a continuously growing feed.

Offset pagination is acceptable if consistent with the Admin app and scale.

---

# 139. Race Conditions

Mark-read actions should be safe to repeat.

Example:

```text
Admin clicks notification twice
```

must not produce an error or duplicate side effect.

Setting `read_at` should be idempotent or equivalent.

---

# 140. Concurrency Across Tabs

If Admin has multiple browser tabs open:

```text
tab A marks notification read
tab B should eventually reflect updated unread count
```

Real-time broadcast or next polling refresh can reconcile.

---

# 141. Multi-Device Admin Sessions

If Admin is signed in on multiple devices, read state should be server-backed rather than device-only if a read/unread model is implemented.

---

# 142. Local Storage

Do not make browser localStorage the source of truth for notification read state.

Admin web auth already relies on server stateful sessions.

Notification state should likewise be server-authoritative.

---

# 143. Security Requirements

Admin Notifications endpoints must:

- require authenticated Admin session
- validate recipient ownership
- enforce source-feature authorization
- prevent IDOR
- minimize notification payload data
- escape/sanitize user-derived notification text
- avoid exposing secrets
- use CSRF protection for state-changing web requests
- prevent another Admin from mutating current Admin read state
- validate target identifiers before navigation/data retrieval
- use protected access for sensitive target details
- avoid public report/evidence URLs
- avoid embedding raw GPS location in broad notification payloads unless explicitly authorized

---

# 144. Content Sanitization

Notification titles/summaries may include:

```text
user names
shop names
case subjects
```

These may originate from user-controlled fields.

Render them safely.

Do not allow HTML/script injection in the Admin notification feed.

---

# 145. Privacy

The notification feed is operational metadata.

It should not become a second database of sensitive case content.

Store references and concise summaries.

---

# 146. Logging

Application logs should not dump full notification payloads if they contain private context.

Log:

```text
notification id
event type
delivery status
recipient id
```

where sufficient.

---

# 147. Observability

Useful operational metrics may include:

```text
notification creation failures
queue delays
real-time broadcast failures
polling/API failures
unread query latency
critical alert delivery failures
```

Do not expose sensitive payload contents in telemetry.

---

# 148. Performance

Admin Notification APIs should:

- return bounded result sets
- paginate history
- efficiently calculate unread count
- avoid joining large source-domain records into every notification row
- lazy-load source detail at destination
- avoid one query per notification
- support many Admin recipients without synchronous request fan-out when needed

---

# 149. Caching

Unread counts may be cached if necessary, but cache invalidation must be reliable.

A stale unread badge is less harmful than missing a critical event, but critical event delivery must not depend only on cached counts.

---

# 150. MVP Source Events

The strongest source-backed Admin notification events for MVP are:

```text
1. New Buyer registration requiring Admin approval
2. New Seller registration requiring Admin approval
3. New Logistics registration requiring Admin approval
4. New Seller Compliance case/report requiring review
5. New Complaint/Dispute requiring review
6. Courier SOS/Emergency alert, if platform Admin is an intended recipient
```

Recommended additional events when those flows are implemented:

```text
7. Complaint user reply / additional evidence
8. Report export completed
9. Report export failed
10. New Admin support/chat reply
```

---

# 151. MVP Scope

## Required for MVP

- Admin-only notification feed
- Dashboard notification preview
- notification center route
- persistent notification records for Admin-attention events
- newest-first ordering
- source feature identification
- target/deep link
- role/permission-aware recipient resolution
- Account Approval notifications for Buyer/Seller/Logistics pending registrations
- Seller Compliance new-case notifications
- Complaints & Disputes new-case notifications
- real-time or polling delivery
- recovery through normal API/history query
- loading state
- empty state
- error state
- pagination
- secure payload minimization
- duplicate-event protection
- target authorization
- multi-Admin compatibility

## Recommended for MVP

- unread/read state
- unread badge
- mark one as read
- mark all as read
- Dashboard unread count
- notification dropdown/popover
- complaint reply notification
- report export completion/failure notification
- Admin messaging reply notification

## Conditional / Source-Dependent

- Courier SOS notification to platform Admin

This should be included if platform Admin is an intended safety-alert recipient in the deployed organization model.

## Not Required for MVP

- notification deletion
- complex folders
- full-text notification search
- notification snoozing
- per-Admin custom notification preferences
- email duplication
- SMS duplication
- browser push
- mobile Admin push
- notification digest
- scheduled digest
- AI prioritization
- automatic escalation
- SLA timers
- notification analytics dashboard
- acknowledgement assignment workflow
- role-wide notification rule builder
- arbitrary user segmentation
- promotional pushes
- outbound SMS blasts

---

# 152. Functional Acceptance Criteria

## AC-01 — Admin Authentication

Given no valid Admin session exists, Admin notification endpoints are inaccessible.

## AC-02 — Recipient Isolation

Given a notification belongs to Admin A, Admin B cannot retrieve or mutate it merely by guessing its identifier unless it is explicitly shared through the notification audience model.

## AC-03 — Dashboard Preview

Given the Admin has notifications, the Dashboard can display a bounded preview of recent eligible notifications.

## AC-04 — Notification Center

Given an authenticated Admin opens the notification center, the Admin can view a paginated history of eligible notifications.

## AC-05 — New Buyer Registration

Given a Buyer registration enters the Admin-managed pending approval state, an Admin notification can be created for eligible Admin recipients.

## AC-06 — New Seller Registration

Given a Seller registration enters the Admin-managed pending approval state, an Admin notification can be created for eligible Admin recipients.

## AC-07 — New Logistics Registration

Given a Logistics registration enters the Admin-managed pending approval state, an Admin notification can be created for eligible Admin recipients.

## AC-08 — Courier Registration Exclusion

Given a Courier registers through a Logistics organization, the platform Admin does not receive a normal Account Approval notification because Courier approval belongs to Logistics.

## AC-09 — Registration Deep Link

Given an Admin opens a pending-registration notification, the notification routes to the relevant Account Approval application/detail where current authorization is rechecked.

## AC-10 — New Compliance Case

Given a Seller Compliance case/report is created and requires Admin review, eligible Admins can receive a compliance notification.

## AC-11 — Compliance Deep Link

Given an Admin opens a compliance notification, the Admin is routed to the authoritative Seller Compliance case.

## AC-12 — New Complaint

Given a new complaint/dispute is submitted, eligible Admins can receive an Admin notification.

## AC-13 — Complaint Deep Link

Given the Admin opens a complaint notification, the Admin is routed to the authoritative complaint/dispute case.

## AC-14 — Notification Does Not Resolve Case

Given the Admin marks a complaint notification read, the complaint case remains unresolved until the Complaints workflow changes its state.

## AC-15 — Notification Does Not Approve Registration

Given the Admin marks a registration notification read, the underlying registration remains pending until Account Approval processes it.

## AC-16 — Notification Does Not Resolve Compliance

Given the Admin marks a compliance notification read, the underlying Seller Compliance case remains unchanged.

## AC-17 — Current Target State

Given another Admin already resolved the target workflow item, opening an older notification displays/navigates to the target's current state rather than treating the stale notification text as authoritative.

## AC-18 — Permission-Aware Delivery

Given an Admin lacks access to a source feature, private notifications from that feature are not exposed beyond the shared permission policy.

## AC-19 — Target Authorization

Given an Admin possesses a notification but has since lost permission to the target feature, opening the target is rejected by the target feature's backend authorization.

## AC-20 — Persistent Offline Notification

Given an Admin is offline when an important notification event occurs, the Admin can still retrieve the notification from the persisted feed after signing in later.

## AC-21 — Real-Time or Polling

Given the Admin is online, new notifications can become visible through the project's real-time or polling mechanism without requiring a full application restart.

## AC-22 — Reconnect Recovery

Given the real-time connection drops, the Admin can recover missed notifications through the authoritative notification API/history.

## AC-23 — No Duplicate Event

Given the same source event is retried, duplicate notification creation is prevented where the event/recipient identity is known.

## AC-24 — Unread State

Given read/unread state is implemented, a newly created notification begins unread for the recipient.

## AC-25 — Mark Read

Given an unread notification belongs to the Admin, the Admin can mark it read without changing the source workflow state.

## AC-26 — Mark Read Idempotency

Given a notification is already read, marking it read again does not create an invalid state.

## AC-27 — Mark All Read

Given mark-all-read is implemented, the operation affects only notifications belonging to the authenticated Admin.

## AC-28 — Unread Count

Given an Admin has unread notifications, the unread badge/count reflects only eligible unread notifications for that Admin.

## AC-29 — Zero Notifications

Given the Admin has no notifications, the UI displays a valid empty state rather than an error.

## AC-30 — Pagination

Given the Admin has many notification records, the API returns bounded paginated/cursor-based results.

## AC-31 — Safe Payload

Given a complaint notification exists, the notification payload does not contain full private complaint evidence.

## AC-32 — Safe Export Link

Given a report-export notification exists, the payload does not expose a permanent public export URL.

## AC-33 — Safe SOS Payload

Given a Courier SOS is routed to Admin, broad notification payloads do not expose more location/task detail than the recipient is authorized to see.

## AC-34 — Seller Order Exclusion

Given a Seller receives a normal new-order notification, it does not automatically create a platform Admin notification.

## AC-35 — Low Stock Exclusion

Given a Seller hits a low-stock threshold, that Seller notification does not automatically appear in the Admin notification center.

## AC-36 — Buyer Alert Exclusion

Given a Buyer receives a wishlist restock/price-drop alert, it does not create an Admin notification.

## AC-37 — Delivery Completion Exclusion

Given a Courier completes normal delivery and Buyer/Seller are notified, the routine completion does not automatically create an Admin notification.

## AC-38 — Outbound Push Separation

Given an Admin creates a user push/SMS campaign, that workflow belongs to Push Notification Management and is not represented as an inbound Admin notification feature.

## AC-39 — Messaging Separation

Given an Admin notification links to a user conversation, actual message history/read receipts remain owned by Chat/Messaging.

## AC-40 — Audit Separation

Given a notification is created/read, this does not replace audit logging for the underlying Admin business action.

## AC-41 — Primary Business Success Independent

Given a complaint/registration/compliance action successfully commits but notification delivery temporarily fails, the business record remains authoritative and the notification system can retry without rolling back the domain transaction.

## AC-42 — Critical SOS Reliability

Given Courier SOS is routed to Admin, the critical alert does not rely exclusively on a transient notification toast or normal feed refresh.

## AC-43 — Sanitized Content

Given a notification includes a user-controlled shop name/case subject, the Admin UI renders it safely without executing markup/scripts.

## AC-44 — Multi-Tab Read Sync

Given the Admin marks a notification read in one browser tab, another tab eventually reflects the server-authoritative read/unread state.

---

# 153. Suggested Backend Tests

Test:

- guest cannot list Admin notifications
- non-Admin cannot list Admin notifications
- Admin cannot retrieve another Admin's private notification
- notifications are filtered by recipient/permission
- pending Buyer registration creates eligible Admin notification
- pending Seller registration creates eligible Admin notification
- pending Logistics registration creates eligible Admin notification
- Courier registration does not create platform Admin approval notification
- Seller Compliance case can create Admin notification
- Complaint case can create Admin notification
- source event retry does not create duplicate recipient notification
- notification target references correct source entity
- target access is still independently authorized
- notification list is paginated
- notification list newest-first
- unread count is scoped to current Admin
- mark-read affects current Admin notification only
- mark-read is idempotent
- mark-all-read affects only current Admin
- read state does not mutate source workflow
- notification payload excludes protected evidence
- notification payload excludes auth/session secrets
- report export notification uses protected target/reference
- real-time delivery failure does not delete persistent notification
- source business transaction does not roll back solely due ordinary notification delivery failure
- user-controlled text is escaped/sanitized appropriately
- stale target notification can still resolve current target state
- permission removal prevents target access
- if SOS-to-Admin is enabled, SOS event creates high-priority authorized Admin notification

---

# 154. Suggested Frontend Tests

Where frontend testing infrastructure exists, test:

- Dashboard notification preview loads
- notification bell shows unread count
- notification center loads
- loading state renders
- empty state renders
- unread filter renders if implemented
- mark-read updates UI
- mark-all-read updates current Admin state only
- pagination/infinite scroll works
- new notification updates feed through chosen transport
- missed notifications appear after reconnect/refetch
- registration notification links to Account Approval
- compliance notification links to Seller Compliance
- complaint notification links to Complaints & Disputes
- report-export notification links to protected export/report state if implemented
- stale target handles current source state
- inaccessible target shows safe forbidden/unavailable state
- private evidence is not embedded in notification body
- user-controlled titles are safely rendered
- narrow viewport notification list remains usable
- notification read state does not falsely change source workflow status
- routine Seller/Buyer role-specific notifications are absent from Admin feed

---

# 155. Open Decisions

The current source documents do not define:

1. exact Admin Notification database schema
2. whether notifications are one row per Admin or event + recipient state
3. exact Admin notification event taxonomy
4. exact read/unread semantics
5. whether opening a notification automatically marks it read
6. whether mark-all-read is required
7. notification retention period
8. notification archival behavior
9. notification deletion behavior
10. whether Admins can configure notification preferences
11. whether Admins can mute certain types
12. whether notification preferences differ by permission
13. exact real-time technology
14. polling interval
15. socket/SSE reconnect strategy
16. real-time provider
17. whether browser push is supported
18. whether Admin notifications are also emailed
19. whether Admin notifications are also SMSed
20. whether Admin mobile push exists
21. exact priority/severity taxonomy
22. which events qualify as critical
23. whether new registration is actionable vs informational
24. whether complaint replies create notifications
25. whether additional complaint evidence creates notifications
26. whether Admin Chat replies create notifications
27. chat-notification grouping rules
28. whether report export completion creates notification
29. whether report export failure creates notification
30. whether background-job failures generally create notifications
31. whether policy publication failures create notifications
32. whether user-account status anomalies create notifications
33. whether blocklist matches create security notifications
34. whether fraud/security events create notifications
35. whether Courier incidents escalate to platform Admin
36. whether every Courier SOS is sent to platform Admin
37. exact SOS Admin recipient scope
38. whether SOS details include GPS in the notification or only destination
39. notification acknowledgement requirements for critical alerts
40. whether critical alerts require explicit acknowledgement
41. whether critical alerts can be dismissed
42. whether notification assignment exists
43. whether notification ownership transfers with case assignment
44. whether multiple notifications for the same target are grouped
45. grouping window
46. deduplication key strategy
47. event/outbox architecture
48. retry policy
49. dead-letter handling
50. maximum notification history page size
51. whether notification center supports source filtering
52. whether notification center supports full-text search
53. whether notification center supports date filtering
54. whether read notifications are visually archived
55. whether stale/resolved-target notifications auto-update text
56. whether resolved workflow items automatically mark associated notifications read
57. whether permission revocation hides historical notifications
58. whether supervisors can see other Admins' notification states
59. whether notification reads are themselves audited
60. whether critical notification delivery is audited
61. exact Admin custom permission keys for notification sources
62. whether Admin Notifications shares infrastructure with user notifications
63. whether Admin Notifications shares infrastructure with Push Notification Management
64. whether notification templates are stored in code or configuration
65. localization requirements
66. notification title/summary length limits
67. retention requirements for safety alerts
68. whether notification metrics/analytics are needed
69. whether notification digests are needed
70. whether "quiet hours" exist for Admin notifications

These decisions should be made as the underlying event-producing features and Admin collaboration model mature.

---

# 156. Source Traceability

## From `Admin.md`

Admin Notifications directly derives from Dashboard:

```text
Core Value:
Overview of platform, display notification.

Expanded:
alerts them to critical notifications
that require immediate attention upon login.

System:
real-time or polling mechanism
for incoming notifications.
```

It also integrates with:

```text
Manage Account Registrations
Monitor Seller Compliance
Manage Complaints and Disputes
Reports Overview
Chat/Messaging
System Audit Logs
```

The following separate feature must remain distinct:

```text
Push Notification Management
    outbound push/SMS blasts to user segments
```

---

## From `app.md`

Admin's system role includes:

```text
approvals of users
customer service
```

Auth flows establish Admin-managed registration events for:

```text
Customer / Buyer
Seller
Logistics
```

but not Courier:

```text
Courier → Logistics Admin approval
```

This defines the registration-notification recipient boundary.

---

## From `Seller.md`

Seller has its own notification domains:

```text
Order Notifications
delivery confirmation notification
Low Stock Alerts
chat
```

These are Seller-facing and should not automatically become Admin Notifications.

This prevents the Admin feed from becoming a copy of the Seller notification stream.

---

## From `Buyer.md`

Buyer contains its own notification-related behaviors:

```text
real-time order status
Buyer ↔ Seller unread messaging
wishlist restock/price alerts
Product Q&A response alerts
notification preferences
```

These are Buyer-domain alerts and should remain separate from Admin Notifications.

---

## From `Logistics.md`

Logistics owns operational real-time workflows including:

```text
seller-confirmed order queue
order status changes
Courier capacity
dispatch
```

Routine Logistics operational updates should not flood Admin Notifications.

Only explicitly escalated/critical platform-level events should cross into the Admin attention layer.

---

## From `Courier.md`

Courier defines:

```text
Incident Reporting
    immediately notifies central dispatch team

SOS / Emergency Button
    critical safety alert
    internal alerting to logistics/admin team
    high-priority webhooks or push notifications
    centralized admin/dispatch dashboard
    last known GPS
    active task ID
```

Therefore, Courier SOS is a source-supported critical Admin notification **when platform Admin is included in the configured safety-alert audience**.

Routine delivery completion remains a Buyer/Seller notification and should not automatically appear in the Admin feed.

---

# 157. Final Feature Definition

AISLEY Admin Notifications is:

```text
an Admin-only
internal attention and alert system

that receives meaningful events from:

    Account Approval
    Seller Compliance
    Complaints & Disputes
    Reports / background exports
    Admin Messaging
    critical Courier safety events where applicable

and surfaces:

    concise notification
    source feature
    timestamp
    read/unread state when implemented
    secure target/deep link

through:

    Admin Dashboard preview
    Admin notification bell/count
    dedicated notification center
    real-time delivery or polling
    persistent API-backed history

while explicitly NOT becoming:

    the Account Approval workflow
    the Seller Compliance workflow
    the Complaint resolution workflow
    the Audit Log
    the Chat system
    the Seller notification stream
    the Buyer notification stream
    the Logistics dispatch stream
    or Push Notification Management.
```

The central design principle is:

```text
Notifications tell the Admin
where attention is needed.

The owning feature decides
what the data means
and what action is allowed.
```
