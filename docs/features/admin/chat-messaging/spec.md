---
feature: Admin Chat / Messaging
system: AISLEY
type: Feature Specification
version: 2.0
status: Draft
scope: Admin Web Application / Shared Messaging Integration
source_coverage: Admin.md, app.md, Buyer.md, Seller.md, Logistics.md, Courier.md
---

# Admin Chat / Messaging Specification

## 1. Purpose

Admin Chat / Messaging is the direct, secure communication channel between AISLEY Admins and platform users.
`Admin.md` defines the feature as:

```text
Core Value:
Communicate with the users.
Expanded Definition:
A direct, secure communication channel
bridging the administration and the user base.
Used for:
- official platform support
- inquiring about account anomalies
- providing detailed explanations regarding compliance actions
System Context:
- Admin can initiate or respond to threads
- read receipts are required
- historical archiving is required for accountability
```

This file defines requirements, boundaries, data expectations, APIs, security rules, integrations, acceptance criteria, and Open Decisions.
Step-by-step thread/send/read/archive behavior belongs in `flow.md`.

## 2. Source Context

Related role documents also define messaging:

- Buyer ↔ Seller for product questions and post-purchase support
- Seller ↔ Buyer for customer support
- Logistics ↔ Courier / Buyer / Seller for active order operations
- Courier ↔ Buyer / Seller / Logistics for delivery clarification
  These related systems support a shared messaging architecture, but their role-specific behavior does not automatically apply to Admin Messaging.

## 3. Core Responsibility

Admin Chat / Messaging owns:

- Admin-to-user direct conversations
- Admin-initiated threads
- Admin responses to existing threads
- user replies to Admin threads where allowed
- message history
- read receipts
- unread state
- historical archive
- safe participant identity
- links to related account/compliance/complaint context
- official Admin/support identity
  It does not own:
- complaint/dispute case state
- Seller Compliance sanctions
- user suspension/deactivation
- Account Approval decisions
- refunds
- order-state changes
- Logistics dispatch
- Push Notification campaigns
- platform-wide announcements
- Buyer/Seller commercial chat rules
- Courier active-delivery chat rules

## 4. Primary Actor

The primary operator is an authorized:

```text
ADMIN
```

An Admin may:

- find a user
- start a direct thread
- open an existing thread
- read messages
- send replies
- view read state
- view historical conversations
  Exact permissions are Open Decisions.

## 5. User Participants

Potential user participants are role-accounts such as:

```text
BUYER
SELLER
LOGISTICS
COURIER
```

The architecture should support these roles where product policy allows direct Admin contact.
Admin Messaging should not be used for Admin-to-Admin internal collaboration unless separately specified.

## 6. Role-Aware Identity

AISLEY uses:

```text
unique(email, role)
```

Therefore a thread must target a specific role-account, not an email alone.
Example:

```text
alex@example.com + BUYER
alex@example.com + SELLER
```

A thread intended for the Seller must not become visible to the Buyer account.

## 7. Participant Identity

A thread should preserve:

```text
target_user_id
target_role
```

and each message should preserve:

```text
sender_user_id
sender_role
sent_at
```

The backend derives sender identity from authentication.
The client must not be able to spoof:

```text
sender_id
sender_role
```

## 8. Admin Visibility Model

AISLEY can have multiple Admin accounts.
The source says the "Admin" entity can initiate or respond to threads but does not define whether threads are:

- owned by one Admin
- visible to all authorized Admins
- assigned to a support team
  Recommended MVP:

```text
thread is visible to authorized Admin Messaging operators
each Admin message retains the specific Admin sender ID
```

This supports continuity and accountability.
Exact visibility/assignment policy is Open.

## 9. Admin Messaging Use Cases

Source-backed uses:

```text
official platform support
account anomaly inquiry
compliance explanation
```

Recommended optional context labels:

```text
GENERAL_SUPPORT
USER_ACCOUNT
SELLER_COMPLIANCE
COMPLAINT_DISPUTE
```

These labels organize conversations; they are not business workflow states.

## 10. Thread vs Business Case

A message thread is not a complaint ticket.

```text
Admin Messaging
    communication
Complaints & Disputes
    case/evidence/decision
```

A message thread may link to a complaint, but the complaint feature remains authoritative for:

- status
- evidence
- resolution
- binding decision

## 11. Thread vs Seller Compliance

Likewise:

```text
Admin Messaging
    warning/explanation communication
Seller Compliance
    warning record
    Seller suspension
    product removal
    compliance case state
```

Sending a message alone must not suspend a Seller or remove a listing.

## 12. Account Anomaly Inquiry

Admin Messaging may be launched from Manage User Accounts to ask a user for clarification.
The message does not change:

```text
account status
registration status
Global Ban state
```

Any account action must happen through the owning feature.

## 13. Seller Compliance Integration

`Admin.md` explicitly requires Seller Compliance integration with messaging for warnings.
Recommended integration:

```text
Compliance Case
→ Message Seller
→ create/open Admin ↔ Seller thread
→ link thread/message to compliance case
```

The compliance feature remains the authoritative source for the warning/sanction itself.

## 14. Complaints & Disputes Integration

A complaint may link to direct Admin conversations used to:

- request additional information
- explain a decision
- follow up with a complainant
- follow up with a respondent
  Separate direct threads are recommended for separate dispute parties.
  Do not expose one party's conversation to another party.

## 15. Manage User Accounts Integration

User detail may provide:

```text
Message User
```

The action must target the exact role-account selected in Manage User Accounts.

## 16. Admin Notifications Integration

A new user reply may create:

```text
ADMIN_MESSAGE_RECEIVED
```

in Admin Notifications.
Admin Notifications owns the attention alert.
Messaging owns the thread/message/unread state.

## 17. Push Notification Boundary

```text
Admin Chat / Messaging
    one-to-one / direct conversation
Push Notification Management
    one-to-many audience campaign
```

Do not use Admin Chat for bulk promotional broadcasts.

## 18. Platform Announcement Boundary

Platform announcements belong to Platform Settings.
Do not create one Admin chat thread per user to distribute an announcement.

## 19. Thread Context

A thread may optionally reference:

```text
context_type
context_id
```

Examples:

```text
USER_ACCOUNT
SELLER_COMPLIANCE_CASE
COMPLAINT_CASE
```

General support may have no external context.

## 20. Context Validation

If a thread is linked to a case:

- the context must exist
- the target user must actually relate to that case where applicable
- the Admin must have permission to access the linked feature
- context access must not leak internal data to the user

## 21. User-Facing Context

The user may see only safe labels such as:

```text
AISLEY Support
Seller Compliance
Complaint Support
```

Do not expose:

- internal Admin notes
- private evidence
- another party's data
- internal risk/fraud metadata

## 22. Message Content

Minimum MVP message payload:

```text
text
```

The source does not require:

- attachments
- image uploads
- voice
- video
- rich text
- reactions
- typing indicators
  Plain text is sufficient.

## 23. Message Validation

Messages must:

- contain non-whitespace text
- respect a backend maximum length
- be rendered safely
- not execute HTML/scripts
- use server-generated sender/time metadata
  Exact length is Open.

## 24. Message Immutability

Historical archiving is required for accountability.
Recommended MVP:

```text
sent messages are not editable
sent messages are not hard-deletable
```

If an Admin makes a mistake, send a follow-up correction.
A future governed redaction feature may be added if privacy/legal policy requires it.

## 25. Attachments

Admin Messaging attachments are not source-required.
Although Seller chat may support images and Complaint cases may contain evidence, Admin chat should not assume file upload support.
If added later, attachment rules need separate requirements for:

- storage
- malware scanning
- file authorization
- retention
- evidence handling

## 26. Official Admin Identity

User-facing messages should clearly identify the sender as official AISLEY communication.
Recommended label:

```text
AISLEY Admin
```

or:

```text
AISLEY Support
```

The exact display name is Open.
Do not expose an Admin's private email/phone unless intended.

## 27. Read Receipts

`Admin.md` explicitly requires read receipts.
The system must track when a message has been read by the recipient.
Possible implementation:

```text
read_at
```

for simple two-party threads,
or:

```text
message_receipts
```

for multiple Admin readers/participants.
Exact schema depends on the Admin visibility model.

## 28. Read Semantics

A message should be marked read when the recipient actually opens/views the relevant conversation according to UI policy.
Opening the inbox alone should not mark every conversation read.

## 29. Read Receipt Direction

Admin should be able to know when the user has read an Admin message.
User-facing UI may show that AISLEY Support has read a reply.
If multiple Admins share a thread, exact "read by Admin/team" semantics are Open.

## 30. Unread State

Unread counts are recommended for usability.
Possible:

```text
unread threads
unread messages per thread
```

Unread state must be server-authoritative.

## 31. Historical Archiving

Historical archiving is explicitly required.
Messages should remain retrievable by authorized users/Admins according to policy even when:

- a thread becomes old
- a user is deactivated
- an Admin leaves
- a related case is closed
  Exact retention duration is Open.

## 32. Archive vs Delete

If an Archive action is implemented:

```text
archive ≠ delete
```

Archiving removes a thread from the active inbox but preserves history.
Archive state itself is optional for MVP.

## 33. Thread Lifecycle

The source does not define formal ticket states.
Do not invent:

```text
OPEN
PENDING
RESOLVED
ESCALATED
```

as mandatory messaging states.
Messaging is not a support-ticket workflow.
An optional active/archive state is sufficient if needed.

## 34. Real-Time Delivery

Admin source does not explicitly require WebSockets, but Buyer/Seller messaging expects real-time architecture.
Recommended:

```text
WebSocket / SSE
```

with API/database history as the authoritative source.
Polling is an acceptable MVP fallback if shared real-time infrastructure is not ready.

## 35. Persistence Before Broadcast

Recommended send order:

```text
authorize
validate
persist message
commit
broadcast/notify
```

A socket event must never be the only copy of a message.

## 36. Broadcast Failure

If real-time broadcast fails after message persistence:

```text
message remains stored
recipient retrieves it on refresh/reconnect
```

Do not roll back a valid stored message because the transient real-time transport failed.

## 37. Offline Behavior

If Admin or user is offline:

- messages still persist
- unread state remains
- history loads after reconnect
- no message should depend on both sides being online

## 38. Message Ordering

Use deterministic server-authoritative ordering.
Recommended:

```text
sent_at
+
message id
```

Do not trust client timestamps.

## 39. Duplicate Send Protection

Retries/double-clicks can create duplicates.
Recommended:

```text
client_message_id
idempotency key
```

or equivalent shared messaging protection.
Exact mechanism is Open.

## 40. Thread List

Recommended Admin inbox shows:

- participant name
- participant role
- safe context label
- last message preview
- last activity time
- unread count
  Recommended order:

```text
most recently active first
```

## 41. Search and Filters

Recommended:

- search by user name
- search by email
- role filter
- unread filter
- context filter
  If searching by email, role must be clearly visible because email is not globally unique.
  Full message-text search is not MVP-required.

## 42. New Conversation

Recommended Admin flow begins with:

```text
New Message
→ find/select exact role-account
→ optional context
→ compose first message
→ send
```

Detailed sequence belongs in `flow.md`.

## 43. Conversation View

Recommended components:

```text
participant identity
role
safe context
message history
read state
composer
```

Optional sidebar may show safe account context.
Do not load unrelated PII.

## 44. Participant PII

Admin UI should minimize data.
Do not automatically expose:

- Buyer full address
- Seller payout details
- Courier license/payout details
- payment credentials
- full evidence files
  Use links to owning features where authorized.

## 45. Credential Safety

Admins should never ask users through chat for:

```text
password
OTP
2FA secret
full card number
bank password
```

Optional UI guidance may remind Admins of this rule.

## 46. Phone Privacy

Related Courier messaging explicitly protects phone numbers.
Admin Messaging should similarly avoid exposing raw phone numbers unless operationally necessary and authorized.

## 47. Suspended Users

The source does not define whether suspended users can access Admin Messaging.
Because compliance explanations may need to remain accessible, recommended policy is:

```text
suspended user may retain limited official support/compliance messaging access
```

This is still an Open Decision.

## 48. Deactivated Users

Historical conversations should remain archived.
Whether a deactivated user can personally access old messages is Open.

## 49. Pending / Rejected Registrations

Account Approval already uses source-defined email notifications.
Admin Messaging is not required for pending/rejected applicants.

## 50. Globally Banned Users

Messaging availability for globally banned users is a security-policy decision.
Messaging must not bypass Global Ban automatically.

## 51. Existing Business State

A message must never directly mutate:

- account status
- Seller suspension
- listing state
- complaint status
- order status
- refund state
- financial records
  Only the owning business feature can perform those actions.

## 52. Recommended Shared Messaging Model

A shared platform messaging core is recommended because several AISLEY roles require chat.
Conceptual tables:

```text
message_threads
message_thread_participants
messages
message_receipts
```

Role-specific UI/policies can use the same core.

## 53. Thread Data

Conceptual fields:

```text
id
context_type
context_id
created_at
last_message_at
archived_at
```

Participant identity may be stored in a participant table.
Exact schema is Open.

## 54. Participant Data

Conceptual:

```text
thread_id
user_id
role
```

If Admin-team visibility is permission-based rather than participant-based, the schema may differ.

## 55. Message Data

Conceptual:

```text
id
thread_id
sender_user_id
sender_role
body
sent_at
client_message_id
```

Only use fields required by the selected architecture.

## 56. Receipt Data

Conceptual:

```text
message_id
reader_user_id
read_at
```

For simple two-party threads, a simpler `read_at` model may be enough.

## 57. Backend Authorization

Every messaging request must:

```text
authenticate actor
verify actor role
verify thread access
verify context access where applicable
verify send permission
```

Backend authorization is authoritative.

## 58. IDOR Protection

A user/Admin must not access a thread merely by guessing:

```text
thread_id
```

The backend must confirm membership/authorized Admin access.

## 59. Sender Spoofing

The backend derives sender from authenticated identity.
Client-provided sender IDs/roles are not authoritative.

## 60. Context Spoofing

If Admin creates a thread linked to:

```text
Seller Compliance Case #10
```

the backend verifies that the selected Seller is related to Case #10.

## 61. XSS Protection

Messages are user-authored content.
Render safely.
Never execute raw HTML/scripts.
If Markdown/rich text is later supported, sanitize it before rendering.

## 62. URL Safety

If automatic links are enabled, restrict unsafe schemes and prevent script execution.
External-link policy is Open.

## 63. CSRF

Admin web mutations must use the existing Sanctum CSRF protections.
Examples:

```text
create thread
send message
mark read
archive thread
```

where applicable.

## 64. Rate Limiting

Message endpoints should use sensible anti-spam/rate limits.
Exact limits are not source-defined.

## 65. System Audit Logs

Historical chat and Audit Logs serve different purposes.

```text
Messaging
    conversation content/history
System Audit Logs
    Admin action accountability
```

Recommended Audit events:

```text
ADMIN_THREAD_INITIATED
ADMIN_MESSAGE_SENT
ADMIN_MESSAGE_THREAD_ARCHIVED
```

Exact coverage is Open.

## 66. Audit Content Rule

Audit Logs should normally store:

```text
thread id
message id
Admin actor
target user
context reference
timestamp
```

Do not duplicate full message bodies unless a formal policy requires it.

## 67. Routine Reads

Normal message reads should not create Admin Audit events.
Read receipts already record messaging read state.

## 68. Admin Notifications

A user reply may create an Admin Notification with:

```text
thread id
safe preview/summary
```

Do not copy the entire sensitive message into broad notification payloads unless necessary.

## 69. User Notification

Users need awareness of new Admin messages.
At minimum, the relevant user app should expose unread state.
Whether new Admin messages also send push/email/SMS is Open.

## 70. API Surface

Conceptual Admin APIs:

```http
GET  /api/admin/messages/threads
POST /api/admin/messages/threads
GET  /api/admin/messages/threads/{threadId}
POST /api/admin/messages/threads/{threadId}/messages
POST /api/admin/messages/threads/{threadId}/read
POST /api/admin/messages/threads/{threadId}/archive
```

Archive endpoint is optional.
User-role apps may expose shared equivalents.

## 71. Thread List API

Recommended query support:

```text
search
role
unread
context_type
cursor/page
```

Only return threads the Admin is allowed to access.

## 72. Create Thread API

Conceptual payload:

```json
{
  "target_user_id": "user-id",
  "context_type": "SELLER_COMPLIANCE",
  "context_id": "case-id",
  "message": "..."
}
```

The backend validates the target and context.

## 73. Send Message API

Conceptual:

```http
POST /api/admin/messages/threads/{threadId}/messages
```

Payload:

```json
{
  "message": "..."
}
```

Sender identity comes from authentication.

## 74. Thread Detail API

Returns:

- safe participant identity
- role
- safe context
- paginated message history
- read state
  Do not embed full complaint/compliance objects.

## 75. Pagination

Thread lists must be bounded.
Message history must be paginated/cursor-based.
Recommended UX:

```text
newest thread list first
load older messages when scrolling upward
```

## 76. Error States

Admin inbox:

```text
loading
empty
filtered empty
error
unauthenticated
forbidden
```

Conversation:

```text
loading
not found
forbidden
participant unavailable
context unavailable
send failure
realtime disconnected
```

## 77. Send Failure

If persistence fails:

```text
do not show the message as successfully sent
```

The frontend may preserve the unsent draft for retry.

## 78. Read Receipt Failure

If marking read fails, the message remains readable and the receipt update may retry.
Do not report a false read state.

## 79. Reconnect

After real-time reconnect:

```text
refetch latest messages
refetch read state
```

so missed events are recovered.

## 80. Accessibility

Admin messaging should:

- use semantic message/thread structure
- identify sender and role
- expose unread/read state as text
- support keyboard navigation
- provide accessible composer labels
- announce send errors
- avoid color-only state
- preserve focus on thread navigation

## 81. Responsive Behavior

On narrower screens:

```text
thread list
→ selected conversation
```

may become a stacked navigation pattern.
Participant role/context must remain visible.

## 82. Performance

Use:

- indexed thread-participant lookups
- indexed `last_message_at`
- indexed message thread/time ordering
- bounded pagination
- aggregate unread counts
  Do not load every message for every inbox row.

## 83. MVP Scope

### Required

- authenticated Admin inbox
- Admin can initiate a direct thread
- Admin can respond to a thread
- exact role-account targeting
- Buyer/Seller/Logistics/Courier participant support where policy permits
- plain text messages
- persistent message history
- historical archiving
- read receipts
- unread state
- thread pagination
- message pagination
- safe rendering/XSS protection
- backend participant authorization
- official AISLEY Admin identity
- Manage User Accounts integration
- Seller Compliance integration
- Complaints & Disputes integration
- System Audit Logs integration for consequential Admin actions
- CSRF protection
- loading/empty/error states

### Recommended

- shared messaging core
- WebSocket/SSE delivery
- polling/refetch fallback
- Admin Notification on user reply
- context links
- per-Admin unread tracking
- no editing/hard deletion of sent messages
- duplicate-send protection

### Not Required

- attachments
- image upload
- voice/video
- masked calling
- group chat
- typing indicators
- online presence
- reactions
- message editing
- unsend
- hard delete
- scheduled messages
- templates
- chatbot/AI replies
- support SLAs
- assignment queues
- conversation analytics
- transcript export
- full-text message search

## 84. Acceptance Criteria

### AC-01 — Admin Authentication

Unauthenticated users cannot access Admin messaging APIs.

### AC-02 — Admin Permission

An Admin without Messaging permission cannot list/read/send Admin threads.

### AC-03 — Initiate Thread

An authorized Admin can start a thread with a valid role-account and first message.

### AC-04 — Respond

An authorized Admin can reply to an accessible thread.

### AC-05 — User Receive

The target user can retrieve Admin messages through their authorized messaging surface.

### AC-06 — User Reply

A permitted target user can reply and the Admin can retrieve that reply.

### AC-07 — Role Isolation

Same-email accounts under different roles do not share Admin threads.

### AC-08 — Sender Authority

Admin sender identity is derived from the authenticated session.

### AC-09 — User Cannot Spoof Admin

A Buyer/Seller/Logistics/Courier cannot create a message stored as `ADMIN`.

### AC-10 — IDOR

A user cannot access another user's Admin thread by guessing its ID.

### AC-11 — Context Validation

A compliance/complaint context must match the intended target and Admin permissions.

### AC-12 — Compliance Integration

Seller Compliance can link warning/explanation messaging without giving Messaging ownership of the sanction state.

### AC-13 — Complaint Integration

A complaint can link direct conversations while Complaint state/evidence/decision remains authoritative.

### AC-14 — Party Confidentiality

One dispute party cannot read another party's Admin conversation.

### AC-15 — User Account Integration

Manage User Accounts can open a thread targeting the exact selected role-account.

### AC-16 — Persistence

A message reported as sent is stored in the authoritative messaging store.

### AC-17 — Broadcast Failure Recovery

Real-time delivery failure does not delete a successfully stored message.

### AC-18 — Send Failure

Storage failure does not appear as successful send.

### AC-19 — Historical Archive

Old conversations remain retrievable according to retention policy.

### AC-20 — Deactivated User History

Deactivation does not automatically erase historical conversations.

### AC-21 — Read Receipt

Reading a message updates server-authoritative read state.

### AC-22 — Read Idempotency

Repeated read updates do not create inconsistent state.

### AC-23 — Unread Count

Unread counts reflect only authorized messages.

### AC-24 — Safe Rendering

User/Admin text cannot execute scripts in the messaging UI.

### AC-25 — Official Identity

User-facing Admin messages are visibly identifiable as official AISLEY communication.

### AC-26 — No Business Mutation

Sending a message alone does not suspend users, resolve complaints, change orders, or alter financial state.

### AC-27 — No Bulk Campaign

Admin Messaging does not function as Push Notification Management.

### AC-28 — No Announcement Fan-Out

Publishing a platform announcement does not create one chat thread per user.

### AC-29 — Audit Reference

Consequential Admin message actions can create safe Audit Log references without credential/secrets.

### AC-30 — Pagination

Thread lists and long message histories are bounded/paginated.

### AC-31 — Empty Message

Whitespace-only messages are rejected.

### AC-32 — Secret Safety

Thread APIs do not expose passwords, tokens, payout credentials, or unrelated sensitive data.

### AC-33 — CSRF

Admin web message mutations require configured Sanctum CSRF protection.

### AC-34 — Reconnect

A disconnected client can refetch messages/read state and recover missed events.

## 85. Backend Tests

Test:

- guest denied
- non-Admin denied
- Admin without Messaging permission denied
- Admin can create thread
- Admin can reply
- empty message rejected
- sender derived from auth
- user cannot spoof ADMIN role
- same-email Buyer/Seller remain separate
- thread access uses user ID/participant relation, not email
- Compliance context target relation is validated
- Complaint context participant relation is validated
- complaint party A cannot read party B thread
- message persists before broadcast
- broadcast failure preserves message
- persistence failure does not emit false success
- read receipts are idempotent
- unread counts are scoped correctly
- thread list paginated
- message history paginated
- XSS payload renders safely
- user deactivation does not erase archive
- Admin deactivation does not erase archive
- Audit event contains safe IDs only
- CSRF required
- realtime reconnect/refetch restores missed messages

## 86. Frontend Tests

Test:

- inbox loads
- empty state
- search/filter states
- participant role visible
- same-email role results distinguishable
- new thread targets selected role-account
- conversation loads
- send state/success/failure
- whitespace-only send blocked
- incoming message appears through realtime/refetch
- unread count updates
- opening thread updates read state
- user read receipt renders
- official AISLEY Admin identity renders
- unsafe HTML does not execute
- forbidden context handled safely
- responsive layout works
- keyboard navigation works
- sender/time/read state accessible

## 87. Open Decisions

The current sources do not define:

1. one Admin owner vs shared Admin inbox
2. thread assignment
3. exact Admin Messaging permission keys
4. whether users may initiate Admin support threads
5. exact user entry point for Admin support
6. whether Courier can always be directly messaged by platform Admin
7. suspended-user messaging access
8. deactivated-user history access
9. globally banned-user messaging access
10. exact thread categories
11. one thread per user vs multiple context threads
12. exact thread uniqueness rules
13. exact schema
14. per-message vs per-recipient read receipts
15. per-Admin vs team unread semantics
16. exact Admin display identity
17. message maximum length
18. rich text/Markdown
19. attachments
20. image/document upload
21. message editing
22. deletion/redaction
23. archive behavior
24. retention duration
25. user privacy deletion/anonymization
26. real-time transport/provider
27. polling interval
28. typing indicators
29. presence/last-seen
30. delivery receipts beyond read
31. duplicate-send/idempotency mechanism
32. user push/email notification for new Admin messages
33. whether official Admin messages can be muted
34. Audit Log coverage for every message vs only consequential contexts
35. full message body in Audit Logs (not recommended)
36. rate limits
37. group/multi-party threads
38. internal Admin-only notes
39. message templates
40. full-text search
41. transcript export
42. legal hold
43. support SLA/queue/assignment
44. encryption beyond platform-standard transport/storage

## 88. Final Definition

AISLEY Admin Chat / Messaging is:

```text
a secure,
Admin-to-user,
role-aware direct messaging system
for:
    official support
    account anomaly inquiries
    compliance explanations
with:
    Admin-initiated/responded threads
    read receipts
    unread state
    historical archiving
    safe participant identity
    related-case links
```

It remains separate from:

```text
Complaints & Disputes
Seller Compliance
Manage User Accounts
Push Notification Management
Platform Announcements
role-specific operational chats
```

Central identity rule:

```text
A conversation belongs to
a specific AISLEY role-account,
not merely an email address.
```

Central business-boundary rule:

```text
Messaging communicates a decision,
question, warning, or explanation.
The owning feature still controls
the authoritative business state.
```
