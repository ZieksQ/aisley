---
role: Logistics
feature: Chat / Messaging
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Logistics Web Application / Order-Linked Communication
source_coverage: Logistics.md, Courier.md, Buyer.md, Seller.md, app.md
---
# Logistics Chat / Messaging Specification
## 1. Purpose
Logistics Chat / Messaging is AISLEY's order-linked communication feature for allowing the centralized Logistics team to communicate with users involved in an active delivery.
`Logistics.md` defines:
```text
Core Value:
Communicate with the users.
```
Expanded definition:
```text
A tri-directional communication hub.

Logistics can communicate with:
- active Couriers for routing assistance
- Buyers for delivery-address clarification
- Sellers regarding pickup delays
```
System context:
```text
Requires an administrative view
of the global messaging schema,

allowing dispatchers
to join or initiate threads
related to specific active order_ids.
```
A separate `flow.md` is required because this feature has meaningful thread creation, authorization, message delivery, unread/read state, and order-lifecycle behavior.
## 2. Primary Actor
Primary actor:
```text
LOGISTICS
```
Authorized counterparties:
```text
BUYER
SELLER
COURIER
```
## 3. Authentication and Identity
The Logistics web application uses the existing Laravel Sanctum web-authentication flow.
Every request resolves:
```text
authenticated user_id
+
LOGISTICS role
```
AISLEY identity remains:
```text
unique(email, role)
```
Therefore:
```text
alex@example.com + LOGISTICS
alex@example.com + BUYER
```
are separate role-accounts.
Email alone must never determine messaging access.
## 4. Feature Responsibility
Logistics Chat owns:
- order-linked conversation access
- initiating authorized threads
- joining authorized order-linked threads where permitted
- sending and receiving messages
- durable message history
- participant membership
- unread/read state
- real-time or near-real-time delivery
- thread/message pagination
- safe order context
- privacy between participants
It does not own:
- order status changes
- Courier assignment
- Buyer Address Book changes
- waybill generation
- complaint decisions
- account restrictions
- Admin notification campaigns
## 5. Operational Boundary
Messaging coordinates work.
It does not itself perform business mutations.
Examples:
```text
Message:
"I picked up the parcel."

≠

order status = IN_TRANSIT
```
and:
```text
Message:
"Can you take this delivery?"

≠

Courier assignment
```
Those changes belong to:
```text
Update Status
Deploy Rider
Courier task workflows
```
# Order Linkage
## 6. Active Order Requirement
`Logistics.md` explicitly ties Logistics messaging to:
```text
specific active order_ids
```
Therefore Logistics messaging should primarily be scoped to an active order.
## 7. Order Authorization
Before opening or creating a thread, the backend must verify:
```text
Logistics account
→ authorized for order
```
A valid `order_id` alone is insufficient.
## 8. Active Order Definition
The exact order statuses considered:
```text
active
```
are not defined.
Open Decision.
## 9. Historical Orders
Recommended:
```text
active order
→ messaging allowed

terminal order
→ thread archived/read-only after configured support window
```
Exact timing is Open.
## 10. Safe Order Context
Thread UI may display:
```text
order reference
current shipment status
Seller/shop
assigned Courier
pickup/delivery summary
```
only where operationally necessary.
# Participant Eligibility
## 11. Buyer
The Buyer participant must be the Buyer associated with the order.
Logistics cannot choose an unrelated Buyer from the global users table.
## 12. Seller
The Seller participant must be related to the order or fulfillment being coordinated.
## 13. Multi-Seller Orders
If one checkout/order includes multiple Sellers, exact Seller-thread scoping is Open.
Possible designs:
```text
one thread per Seller fulfillment
```
or:
```text
shipment/sub-order scoped thread
```
## 14. Courier
The Courier participant should be related to the active order/task through:
```text
dispatch offer
assignment
accepted task
```
according to the chosen Deploy Rider model.
## 15. Candidate Courier
Whether Logistics can chat with a Courier before dispatch is not defined.
Recommended:
```text
do not create an order chat
with arbitrary unassigned candidate Couriers
```
## 16. Role-Aware Participants
Participants must be stored/resolved by:
```text
user_id + role
```
not email.
# Thread Model
## 17. Source Ambiguity
The source says Logistics may:
```text
join or initiate threads
```
but does not define whether AISLEY uses:
```text
one shared multi-party order room
```
or:
```text
separate order-linked conversations
```
## 18. Recommended Model
Recommended:
```text
Order
├── Logistics ↔ Buyer
├── Logistics ↔ Seller
└── Logistics ↔ Courier
```
This limits unnecessary disclosure between counterparties.
## 19. Group Chat
A shared:
```text
Buyer + Seller + Courier + Logistics
```
group chat is not required by source.
Open Decision.
## 20. Buyer-Seller Chat Boundary
`Buyer.md` and `Seller.md` separately define Buyer ↔ Seller messaging.
Logistics must not automatically gain access to unrelated Buyer-Seller conversation history simply because an order exists.
## 21. Joining Existing Threads
If Logistics may join an existing conversation, the thread must:
- already be explicitly tied to the active order
- permit Logistics participation
- not expose unrelated private history
## 22. Duplicate Threads
Repeated creation requests for the same logical conversation should not produce uncontrolled duplicates.
Recommended:
```text
find-or-create
```
using an order/context uniqueness rule.
# Messages
## 23. MVP Message Type
Required:
```text
plain text
```
## 24. Sender Identity
The sender is derived from authentication.
Do not trust client-submitted:
```text
sender_user_id
sender_role
```
## 25. Message Validation
Message body must be:
- non-empty
- bounded
- validated
- safely rendered
Exact length limit is Open.
## 26. XSS Protection
Messages must be safely rendered across:
```text
Logistics web
Buyer web/mobile
Seller web
Courier mobile
```
## 27. Message Editing
Edit/delete/unsend behavior is not source-required.
Recommended MVP:
```text
sent message is immutable
```
## 28. Attachments
`Logistics.md` does not require file/image attachments.
Therefore:
```text
text-only MVP
```
is sufficient.
Attachment support is Open/future.
## 29. Location Sharing
Structured live-location sharing in chat is not required.
Courier location already belongs to dispatch/routing systems.
## 30. Calling
`Courier.md` mentions:
```text
masked calling
```
as a possible privacy-preserving communication capability.
It is not required for Logistics Chat MVP.
# Real-Time Delivery
## 31. Messaging Architecture
Buyer and Seller messaging requirements reference real-time communication using examples such as:
```text
WebSockets
Server-Sent Events
```
Logistics uses the same global messaging schema.
Therefore Logistics Chat should support:
```text
real-time
or
near-real-time
```
updates.
## 32. No Required External Provider
A third-party realtime provider is not required.
AISLEY may use:
```text
self-hosted WebSockets
SSE
polling
```
## 33. Persist Before Broadcast
Recommended:
```text
authorize
→ validate
→ persist message
→ commit
→ broadcast realtime event
```
Never treat an unpersisted broadcast as an authoritative message.
## 34. Realtime Failure
If storage succeeds but realtime delivery fails:
```text
message remains stored
```
The recipient can retrieve it after:
```text
reconnect
refetch
poll
```
## 35. Reconnect
After reconnect:
```text
load messages after last known cursor
```
or refresh the bounded thread.
## 36. Duplicate Events
Realtime retries must not create duplicate database messages.
The message ID is authoritative.
# Unread / Read State
## 37. Unread Counts
`Buyer.md` explicitly mentions:
```text
unread notification counts
```
for the messaging architecture.
Logistics should support unread counts for authorized order threads.
## 38. Per-Participant State
Recommended:
```text
read state
→ per exact user_id + role
```
## 39. Read Marker
Possible models:
```text
last_read_message_id
```
or:
```text
read_at
```
Exact schema is Open.
## 40. Thread Opening
Opening/loading a thread may mark visible messages read according to UX policy.
Do not mark unseen messages read before they are loaded.
## 41. Read Receipts
Whether counterparties can see:
```text
Seen
Read
```
is Open.
# Logistics Inbox
## 42. Administrative View
The source requires:
```text
administrative view
of the global messaging schema
```
This means an operational Logistics inbox.
It does not mean unrestricted access to all private platform messages.
## 43. Recommended Thread List
```text
Order Reference
Counterparty
Role
Last Message Preview
Unread Count
Last Activity
Order Status
```
## 44. Filters
Recommended:
```text
active order
Buyer / Seller / Courier
unread
```
## 45. Search
Recommended:
```text
order reference
waybill reference
counterparty name
shop name
```
within authorized scope.
## 46. Pagination
Thread lists and message history must be bounded/paginated.
## 47. Default Sort
Recommended:
```text
most recent activity first
```
# Cross-Feature Integrations
## 48. Logistics Dashboard
Dashboard may provide:
```text
Message
```
on an active order.
Flow:
```text
Dashboard
→ order
→ Logistics Chat
```
## 49. Deploy Rider
After a Courier is appropriately dispatched/assigned:
```text
Deploy Rider
→ authorized Courier
→ Logistics ↔ Courier thread
```
Messaging does not alter dispatch state.
## 50. Update Status
Chat may explain a status issue.
Actual status mutation belongs to:
```text
Update Status
```
## 51. Buyer Address Clarification
Source-backed use:
```text
Logistics ↔ Buyer
→ clarify delivery address
```
Chat must not silently rewrite the Buyer's saved Address Book.
## 52. Seller Pickup Delay
Source-backed use:
```text
Logistics ↔ Seller
→ coordinate pickup delay
```
Chat does not automatically mutate order status.
## 53. Courier Routing Assistance
Source-backed use:
```text
Logistics ↔ Courier
→ routing assistance
```
Routing remains owned by the dispatch/navigation systems.
# Privacy and Security
## 54. Phone Privacy
The messaging system should avoid exposing user phone numbers simply to enable communication.
## 55. Buyer Privacy
Do not expose:
```text
payment data
unrelated addresses
unrelated orders
account credentials
private unrelated conversations
```
## 56. Seller Privacy
Do not expose:
```text
payout credentials
security settings
unrelated Seller orders
```
## 57. Courier Privacy
Do not expose:
```text
full GPS history
payout information
unrelated tasks
account credentials
```
## 58. Logistics Identity
Counterparties should receive only the intended Logistics identity.
Possible display forms:
```text
AISLEY Logistics
Hub name
Dispatcher name
```
Open Decision.
## 59. Thread Authorization
Every thread read/write operation verifies:
```text
authenticated participant
+
thread membership
+
order scope
+
role/context authorization
```
## 60. Logistics Scope
A Logistics account may access only order threads within its operational scope.
## 61. Buyer Scope
Buyer accesses only order chats tied to their own order.
## 62. Seller Scope
Seller accesses only relevant Seller/order fulfillment chats.
## 63. Courier Scope
Courier accesses only task/order chats permitted by assignment/offer policy.
## 64. Reassigned Courier
Access behavior for a previous Courier after reassignment is Open.
Recommended:
```text
no new-message access
```
with historical access governed by policy.
## 65. Logistics Staff Scope
Whether every Logistics employee can see every hub thread or conversations can be assigned to individual dispatchers is Open.
# Thread Lifecycle
## 66. Active Thread
Recommended initial state:
```text
ACTIVE
```
## 67. Order Completion
Recommended:
```text
ACTIVE
→ ARCHIVED / READ_ONLY
```
when the order becomes terminal and the configured communication window ends.
Exact enum/timing is Open.
## 68. Cancellation
Cancelled-order thread behavior is not defined.
Recommended:
```text
preserve history
```
rather than deleting messages.
## 69. Reopen
Whether archived threads can be reopened is Open.
# Data Model
## 70. Global Messaging Schema
Recommended conceptual tables:
```text
threads
thread_participants
messages
participant_read_state
```
## 71. Thread
Conceptual:
```text
id
order_id
context
status
created_at
updated_at
```
## 72. Participant
Conceptual:
```text
thread_id
user_id
role
joined_at
left_at
```
## 73. Message
Conceptual:
```text
id
thread_id
sender_user_id
sender_role
body
created_at
```
## 74. Read State
Conceptual:
```text
thread_id
user_id
role
last_read_message_id
updated_at
```
## 75. Role-Aware Identity
Do not deduplicate participants using email.
# API
## 76. Thread List
Conceptual:
```http
GET /api/logistics/messages/threads
```
Possible filters:
```text
order
counterparty_role
unread
status
search
page/cursor
```
## 77. Order Threads
Conceptual:
```http
GET /api/logistics/orders/{orderId}/threads
```
## 78. Open / Create Thread
Conceptual:
```http
POST /api/logistics/orders/{orderId}/threads
```
Example:
```json
{
  "counterparty_role": "COURIER"
}
```
The backend resolves the exact authorized counterparty.
## 79. Thread Detail
Conceptual:
```http
GET /api/logistics/messages/threads/{threadId}
```
## 80. Message List
Conceptual:
```http
GET /api/logistics/messages/threads/{threadId}/messages
```
Use pagination/cursor.
## 81. Send Message
Conceptual:
```http
POST /api/logistics/messages/threads/{threadId}/messages
```
Example:
```json
{
  "body": "Pickup is delayed by approximately 10 minutes."
}
```
## 82. Mark Read
Conceptual:
```http
POST /api/logistics/messages/threads/{threadId}/read
```
Exact route is Open.
## 83. Backend Sender Authority
The send request must not control authoritative:
```text
sender ID
sender role
thread participants
order ownership
```
## 84. CSRF
State-changing Logistics web message/thread requests require configured Sanctum CSRF protection.
# Error Handling
## 85. Invalid Thread
Unauthorized/not-found threads must not leak private thread existence/content.
## 86. Inactive Order
If policy prohibits new conversations after terminal state:
```text
reject new thread/message
```
or move to read-only according to configured rules.
## 87. Invalid Counterparty
If no eligible Buyer/Seller/Courier exists for the order:
```text
do not create thread
```
## 88. Invalid Message
Empty/invalid/oversized message:
```text
reject
→ no stored message
```
## 89. Persistence Failure
If storing the message fails:
```text
do not show authoritative Sent
```
## 90. Realtime Failure
If persistence succeeds but realtime push fails:
```text
keep message
→ recipient retrieves later
```
# Performance
## 91. Thread Query
Index/filter around:
```text
order_id
participant user_id/role
thread status
last activity
```
## 92. Message Pagination
Do not fetch full history on every thread open.
## 93. Unread Counts
Unread counts should avoid scanning complete message history repeatedly.
## 94. Realtime Payload
Broadcast only bounded necessary message/thread information.
# Logging / Audit Boundary
## 95. Conversation History
The messaging database is the authoritative message history.
## 96. Admin System Audit Logs
Do not duplicate every Logistics message body into Admin System Audit Logs.
## 97. Application Logs
Normal application logs should not contain full private chat bodies.
Prefer:
```text
thread_id
message_id
actor
error metadata
```
# Third-Party Dependencies
## 98. Core Chat
No new third-party provider is required.
Core architecture can use:
```text
AISLEY backend
database
WebSocket / SSE / polling
```
## 99. Brevo
Brevo is not required for in-app chat.
## 100. SMS / Telephony
SMS and masked calling are not required.
If masked calling is later implemented, a telephony provider may be required.
## 101. Attachments
Object storage is not required for text-only MVP.
If media attachments are added later, storage becomes a separate design decision.
# UX
## 102. Recommended Layout
```text
Logistics Messaging
├── Conversation List
└── Active Thread
    ├── Order Summary
    ├── Counterparty + Role
    ├── Message History
    └── Composer
```
## 103. Role Labels
Clearly label:
```text
Buyer
Seller
Courier
```
to reduce messaging mistakes.
## 104. Order Reference
Show the relevant order reference prominently.
## 105. Message Preview
Thread list may show:
```text
last message preview
last activity time
unread badge
```
## 106. Composer
MVP:
```text
plain text field
Send
```
## 107. Send State
Support:
```text
sending
sent
failed
retry
```
## 108. Empty States
Examples:
```text
No active order conversations.
No messages yet.
```
## 109. Archived State
Read-only/archive state must be clearly indicated.
## 110. Accessibility
The UI should:
- identify sender and role in text
- support keyboard navigation
- expose unread state without color-only meaning
- announce send errors
- use readable timestamps
- not rely on layout alone to distinguish participants
# MVP Scope
## 111. Required
- authenticated Logistics access
- exact Logistics role authorization
- active order linkage
- authorized Buyer/Seller/Courier participants
- role-aware identity
- Logistics conversation list
- open/create authorized order-linked thread
- text messages
- durable history
- real-time or near-real-time updates
- unread/read state
- pagination
- backend sender identity
- CSRF
- XSS protection
- order/thread authorization
- privacy/PII minimization
- Dashboard/order handoff
- loading/empty/error/send states
## 112. Recommended
- separate Logistics ↔ Buyer/Seller/Courier threads
- find-or-create thread
- archive/read-only after completion
- reconnect/refetch
- last-message preview
- counterparty filters
- order-reference search
- send rate limits
## 113. Not Required
- four-party group chat
- image/file attachments
- voice/video
- masked calling
- SMS
- email
- mobile Push
- hosted realtime vendor
- access to unrelated Buyer-Seller conversations
- order mutation from messages
- Courier assignment from messages
- live GPS sharing inside chat
# Acceptance Criteria
## 114. Access
- Guests cannot access Logistics Chat.
- Non-Logistics accounts cannot use Logistics messaging APIs.
- Same-email other-role accounts do not receive Logistics access.
- Logistics can access only authorized order threads.
- Order/thread/message IDs cannot bypass authorization.
## 115. Participants
- Buyer belongs to the order.
- Seller belongs to the relevant fulfillment.
- Courier belongs to the permitted dispatch/task relationship.
- Unrelated users cannot be injected.
- Participant identity uses `user_id + role`.
## 116. Threads
- Logistics can initiate an authorized order-linked conversation.
- Duplicate logical threads are prevented/reused.
- Logistics does not automatically gain unrelated Buyer-Seller history.
- Thread history is preserved according to terminal-order retention policy.
## 117. Messages
- Valid text message persists.
- Sender cannot be spoofed.
- Invalid/empty message is rejected.
- XSS is safely handled.
- Persistence occurs before authoritative realtime delivery.
- Broadcast failure does not delete stored messages.
- History is paginated.
## 118. Read State
- Unread counts are participant-specific.
- Reading as Logistics does not mark another user's messages read.
- Thread list exposes authorized unread counts.
## 119. Feature Boundaries
- Message text does not mutate order status.
- Message text does not assign a Courier.
- Address clarification does not silently edit Buyer Address Book.
- Full Courier GPS history is not exposed.
- Routine message bodies are not copied into Admin Audit Logs.
## 120. Third-Party
- Core chat works without a new third-party provider.
- Hosted WebSockets are optional.
- Brevo/SMS are not required.
- Object storage is not required for text-only MVP.
# Tests
## 121. Backend Tests
Test:
- guest denied
- Buyer/Seller/Courier denied from Logistics APIs
- authenticated Logistics allowed
- same-email role isolation
- unauthorized order/thread denied
- unrelated Buyer rejected
- unrelated Seller rejected
- unrelated Courier rejected
- authorized Buyer/Seller/Courier thread
- duplicate thread prevention
- sender spoof rejected/ignored
- valid message persistence
- invalid message rejection
- XSS safe handling
- pagination
- unread state
- mark-read authorization
- realtime broadcast after commit
- broadcast failure preserves message
- terminal-order archive behavior
- Courier reassignment authorization behavior
- CSRF
- private body absent from normal logs
## 122. Frontend Tests
Test:
- messaging page
- thread list
- active order reference
- role labels
- unread count
- search/filter
- thread loading
- message pagination
- plain-text composer
- send loading/success/failure
- incoming realtime message
- reconnect/refetch
- duplicate realtime prevention
- archived/read-only state
- empty inbox/thread
- unauthorized/not-found
- keyboard accessibility
- responsive layout
# Open Decisions
## 123. Open Decisions
The current sources do not define:
1. exact active-order statuses
2. shared group chat vs separate counterparty threads
3. whether Logistics can join Buyer-Seller order threads
4. multi-Seller thread scope
5. pre-dispatch Courier messaging
6. Courier reassignment history/access
7. Logistics staff visibility/assignment
8. exact thread status enum
9. post-delivery chat window
10. cancellation behavior
11. thread/message retention
12. message editing/deletion
13. visible read receipts
14. typing indicators
15. presence/online indicators
16. message length
17. attachments
18. location sharing
19. masked calling
20. realtime transport
21. polling fallback
22. unread schema
23. rate limits
24. abuse/report/block controls
25. Logistics display identity
26. complaint/dispute interaction
# Final Definition
## 124. Final Definition
AISLEY Logistics Chat / Messaging is:
```text
an active-order-linked operational communication hub
```
allowing Logistics to communicate with:
```text
Courier
Buyer
Seller
```
for needs such as:
```text
routing assistance
delivery-address clarification
pickup-delay coordination
```
Core model:
```text
authorized active order
+
authorized Logistics account
+
authorized order counterparty
→ secure thread
→ durable messages
→ realtime/near-realtime delivery
→ participant-specific unread state
```
Critical boundaries:
```text
Chat
≠ order status mutation
≠ Courier assignment
≠ Address Book editing
≠ Admin notification campaigns
```
Third-party rule:
```text
No new third-party provider
is required for text-based Logistics Chat.
```
