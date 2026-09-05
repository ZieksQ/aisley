---
role: Courier/Rider
feature: Chat / Messaging
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Flutter Courier Mobile Application / Active-Order Communication
source_coverage: Courier.md, app.md
---
# Courier / Rider Chat / Messaging Specification
## 1. Purpose
Courier Chat / Messaging is AISLEY's direct operational communication feature for active delivery work.
`Courier.md` defines:
```text
Core Value:
Communicate with the users.
```
Expanded definition:
```text
A direct communication line.

It enables the courier
to contact the buyer
(or seller/logistics team)

for:
- address clarifications
- gate codes
- immediate delivery delays.
```
System context:
```text
Requires temporary,
secure chat instances
or masked calling features

linked to active orders

to facilitate communication
while protecting
user phone numbers/privacy.
```
This feature therefore provides temporary order-linked communication between the Courier and operational counterparties while protecting direct personal contact details.
A separate `flow.md` is required because the feature has meaningful lifecycle behavior:
```text
active order
→ authorize participants
→ open/create temporary thread
→ exchange messages
→ preserve conversation state
→ restrict/close access according to order lifecycle
```
## 2. Primary Actor
Primary actor:
```text
COURIER / RIDER
```
The Courier uses the Flutter mobile application.
## 3. Counterparties
Source-supported counterparties are:
```text
BUYER
SELLER
LOGISTICS
```
The Courier may communicate with the relevant party for an active order.
## 4. Authentication
Courier mobile authentication follows `app.md`:
```text
Flutter login
→ Laravel personal access token
→ flutter_secure_storage

Requests:
Authorization: Bearer <token>
```
Every messaging request must resolve:
```text
authenticated user_id
+
COURIER role
```
## 5. Identity Rule
AISLEY account uniqueness is:
```text
unique(email, role)
```
Therefore message authorization must use stable user IDs and roles.
Never authorize a participant based on email alone.
# Feature Responsibility
## 6. Chat / Messaging Owns
Courier Chat owns:
- temporary secure order-linked conversations
- Courier-to-Buyer communication
- Courier-to-Seller communication
- Courier-to-Logistics communication
- message creation
- message retrieval
- participant authorization
- thread/order relationship
- read/unread state where implemented
- conversation history during the permitted lifecycle
- real-time or near-real-time message delivery
- privacy protection around phone numbers
- safe conversation access from active delivery screens
- optional masked-calling handoff if later implemented
## 7. Chat / Messaging Does Not Own
It does not own:
- order-state mutation
- delivery-task assignment
- changing Courier availability
- Buyer Address Book editing
- Seller pickup-address editing
- Route optimization
- Proof of Delivery
- Incident creation
- SOS alerts
- Complete Delivery
- refund/dispute resolution
- sanctions
- general social messaging unrelated to orders
## 8. Core Boundary
Chat is:
```text
communication
```
not:
```text
delivery-state authority
```
A message does not itself change:
```text
ACCEPTED
IN_TRANSIT
DELIVERED
COMPLETED
```
# Active-Order Scope
## 9. Source Requirement
The source explicitly says chat/calling is:
```text
linked to active orders
```
## 10. Order Relationship
Every Courier operational conversation should be tied to an:
```text
order_id
```
and/or:
```text
delivery_task_id
```
according to final data architecture.
## 11. No Generic Social Inbox Requirement
The source does not require unrestricted Courier messaging with arbitrary AISLEY users.
MVP should focus on:
```text
active delivery/order communication
```
## 12. Active Order Meaning
The exact states that count as:
```text
active
```
are not defined.
Open Decision.
## 13. Recommended Active Context
Likely relevant phases include:
```text
ACCEPTED
IN_TRANSIT
before final completion
```
where the Courier needs operational coordination.
This is a recommendation.
## 14. Post-Completion Access
Whether messages remain:
```text
readable
sendable
archived
closed immediately
```
after `DELIVERED` / `COMPLETED` is Open.
# Communication Purposes
## 15. Address Clarifications
Source-supported purpose:
```text
address clarifications
```
Example operational need:
```text
which entrance
which building
which unit context
```
where appropriate.
## 16. Gate Codes
Source-supported purpose:
```text
gate codes
```
Gate/access information should be treated as sensitive operational content.
## 17. Immediate Delivery Delays
Source-supported purpose:
```text
report immediate delivery delays
```
This can be communicated to:
```text
Buyer
Seller
Logistics
```
as appropriate.
## 18. Routing Assistance
Courier may contact Logistics for operational routing/support where relevant.
## 19. Pickup Coordination
Courier may contact Seller/Logistics for pickup clarification.
## 20. No Address Mutation
A Buyer message saying:
```text
deliver somewhere else
```
must not automatically overwrite the authoritative delivery address.
Any address-change policy belongs to another workflow.
# Thread Model
## 21. Temporary Secure Thread
The source explicitly describes:
```text
temporary secure chat instances
```
## 22. Recommended Thread Boundary
Recommended:
```text
Order
├── Courier ↔ Buyer
├── Courier ↔ Seller
└── Courier ↔ Logistics
```
This avoids unnecessary cross-party disclosure.
## 23. Group Chat
The source does not require:
```text
Buyer + Seller + Logistics + Courier
```
in one shared room.
Open Decision.
## 24. Separate Threads Recommendation
Separate counterparty threads are recommended for privacy and operational clarity.
## 25. Thread Identity
Each conversation should have a stable:
```text
thread_id
```
or equivalent identifier.
## 26. Order Link
Thread must be linked to its active:
```text
order_id
```
or delivery-task context.
## 27. Participants
Thread participants should be derived from authoritative order/delivery relationships.
The client must not freely add arbitrary users.
# Participant Authorization
## 28. Courier Authorization
The Courier may access only threads for orders/tasks they are currently authorized to work on, subject to post-completion history policy.
## 29. Buyer Authorization
Buyer access should be limited to the Buyer's own relevant order.
## 30. Seller Authorization
Seller access should be limited to the Seller/shop relevant to the order/pickup context.
## 31. Logistics Authorization
Logistics access should be limited to the Logistics organization handling the active delivery.
## 32. Cross-Order Isolation
Knowing a:
```text
thread_id
order_id
message_id
```
must not expose another order's conversation.
## 33. Same-Email Isolation
Same email under a different role does not grant participant access.
# Message Model
## 34. Message Entity
Conceptually:
```text
message_id
thread_id
sender_user_id
sender_role
body
created_at
```
Exact schema is Open.
## 35. Sender Authority
The backend derives sender identity from authentication.
The client must not authoritatively submit:
```text
sender_user_id
sender_role
```
## 36. Message Body
Plain text is sufficient for MVP.
## 37. Message Length
Maximum message length is not defined.
Open Decision.
## 38. Empty Messages
Empty/whitespace-only messages should be rejected.
## 39. Ordering
Messages should be ordered using authoritative:
```text
created_at
sequence
```
or equivalent.
## 40. Immutable Sender
A message's sender identity must not be editable by the client.
# Read / Unread State
## 41. Requirement Level
Read/unread state is not explicitly defined in `Courier.md`.
It is recommended for a usable messaging experience.
## 42. Recommended Participant State
Possible per-participant fields:
```text
last_read_message_id
last_read_at
unread_count
```
Exact approach is Open.
## 43. Delivery Receipts
Separate:
```text
sent
delivered
read
```
receipts are not source-required.
Open Decision.
# Realtime Behavior
## 44. Messaging Freshness
Operational messaging should be real-time or near-real-time.
## 45. Transport Options
AISLEY may use:
```text
WebSockets
Server-Sent Events
polling
```
or another internal transport.
## 46. No Hosted Realtime Requirement
The source does not require a hosted messaging/realtime vendor.
## 47. Server Authority
Realtime events notify clients of changes.
The database/backend remains authoritative for message history.
## 48. Reconnect
After reconnect:
```text
refetch missing messages
→ reconcile with local UI
```
## 49. Duplicate Events
Realtime retries must not create duplicate message rows.
Stable `message_id` should be used for deduplication.
# Sending a Message
## 50. Preconditions
Before sending:
```text
authenticated participant
+
authorized active order/thread
+
valid message body
```
## 51. Send Operation
Conceptually:
```text
compose
→ submit
→ authorize
→ persist
→ publish realtime event
→ return durable message
```
## 52. Persistence Before Publish
Recommended:
```text
persist message first
→ then publish realtime event
```
## 53. Failed Persistence
If persistence fails:
```text
do not display message as permanently sent
```
## 54. Network Failure
The mobile app should distinguish:
```text
pending
failed
sent
```
if optimistic UI is used.
Exact client behavior is Open.
## 55. Duplicate Send
Retries should be idempotent or deduplicated where feasible.
# Receiving Messages
## 56. Active Screen
New messages should appear without requiring a full app restart.
## 57. Background App
Background mobile notification behavior is not explicitly defined.
Open Decision.
## 58. Push Provider
No Push provider is selected by the source for this feature.
Do not make mobile Push mandatory.
## 59. In-App Notification
At minimum, when the app is active, new-message indicators should be supported.
# Masked Calling
## 60. Source Capability
`Courier.md` explicitly permits:
```text
masked calling features
```
## 61. Purpose
Masked calling should:
```text
facilitate communication
while protecting user phone numbers/privacy
```
## 62. Core MVP Choice
Recommended MVP:
```text
secure order-linked chat
```
as the required core communication implementation.
## 63. Masked Calling Optionality
Masked calling is source-supported but should remain optional until AISLEY selects:
- telephony provider
- number masking mechanism
- call routing
- billing
- call retention/logging policy
## 64. No Direct Phone Exposure
If masked calling is implemented, the Courier should not receive the counterparty's raw personal phone number merely to initiate the call.
## 65. Telephony Provider
No provider is selected in `app.md` or `Courier.md`.
Open Decision.
## 66. No Invented Twilio Requirement
Do not require:
```text
Twilio
```
or another telephony vendor without explicit architecture selection.
# Privacy
## 67. Source Requirement
The source explicitly emphasizes:
```text
protecting user phone numbers/privacy
```
## 68. Phone Number Minimization
Core chat should not need to reveal direct phone numbers.
## 69. Participant Identity
Use operational display names/roles where appropriate.
## 70. Sensitive Message Content
Users may share:
```text
gate codes
delivery instructions
location clarification
```
Treat conversation access as operationally sensitive.
## 71. Retention
Message retention duration is not defined.
Open Decision.
## 72. Deletion
Whether participants may delete messages is not defined.
Recommended MVP:
```text
no destructive deletion
```
for operational traceability.
This is a recommendation.
## 73. Edit Messages
Message editing is not source-required.
Open Decision.
# Attachments
## 74. Source Boundary
`Courier.md` Chat/Messaging does not require:
```text
photos
files
voice notes
location pins
```
## 75. MVP
Plain text is sufficient for MVP.
## 76. Proof Photos
Delivery-evidence photos belong to:
```text
Proof of Delivery
```
not Chat attachments.
## 77. Incident Media
Incident evidence belongs to:
```text
Incident Reporting
```
if implemented.
# Order State Boundary
## 78. Message Does Not Mutate Order
Never:
```text
Courier says "delivered"
→ Order = DELIVERED
```
## 79. Message Does Not Confirm Pickup
Never:
```text
Seller says "picked up"
→ IN_TRANSIT
```
## 80. Owning Features
State mutations remain with:
```text
Accept Delivery Requests
Pick Up Order
Complete Delivery
Logistics Update Status
```
# Deliver Order Integration
## 81. Active Transit
Deliver Order should provide a direct Chat/Messaging entry point.
## 82. Address Clarification
During transit:
```text
Deliver Order
→ Chat Buyer
→ clarification
→ return to route
```
## 83. Delay Reporting
Courier can use Chat to notify Buyer or Logistics of immediate delays.
## 84. No Route Mutation
Chat does not directly recalculate or persist route changes.
# Pick Up Order Integration
## 85. Seller Contact
At Seller pickup:
```text
Pick Up Order
→ Chat Seller
```
may be used for pickup clarification.
## 86. Logistics Contact
Courier may contact Logistics for sorting-center/hub issues.
# Incident Reporting Boundary
## 87. Operational Delay vs Incident
A normal short delay may be communicated through Chat.
A material blocker such as:
```text
vehicle breakdown
accident
inaccessible address
```
belongs to Incident Reporting.
## 88. Chat Does Not Replace Incident
Sending a message to Logistics does not automatically create an `Incident` record.
## 89. Incident Link
A Chat thread may link to Incident Reporting for active task context.
# SOS Boundary
## 90. Emergency
SOS/Emergency Button owns high-priority emergency alerting.
## 91. Chat Not Emergency Replacement
Do not require the Courier to type a chat message during an emergency instead of using SOS.
# Post-Completion Behavior
## 92. Temporary Nature
The source explicitly calls chat instances:
```text
temporary
```
## 93. Sendability After Completion
Recommended:
```text
Order active
→ send + read

Order completed
→ read-only/archive
```
possibly after a short configured window.
Exact behavior is Open.
## 94. History
Whether completed-order conversations remain visible to the Courier is Open.
## 95. Dispute Support
Retaining read-only history may help support/dispute workflows.
This is a recommendation.
# API
## 96. Thread List
Conceptual:
```http
GET /api/courier/chat/threads
```
MVP may restrict this to relevant active-order threads.
## 97. Order Threads
Conceptual:
```http
GET /api/courier/orders/{orderId}/chat
```
or:
```http
GET /api/courier/delivery-tasks/{taskId}/chat
```
## 98. Messages
Conceptual:
```http
GET /api/courier/chat/threads/{threadId}/messages
```
with cursor pagination.
## 99. Send Message
Conceptual:
```http
POST /api/courier/chat/threads/{threadId}/messages
```
Example:
```json
{
  "body": "I am at the gate. Which entrance should I use?"
}
```
## 100. Read State
If implemented:
```http
POST /api/courier/chat/threads/{threadId}/read
```
## 101. Start Thread
Whether threads are:
```text
pre-created
or
lazy-created on first contact
```
is Open.
## 102. Counterparty Selection
If separate threads are used, the API may require a permitted counterparty role.
The backend determines the actual participant from the order relationship.
# Authorization
## 103. Bearer Authentication
Every Courier messaging endpoint requires a valid Bearer token.
## 104. Exact Role
Backend verifies:
```text
role = COURIER
```
## 105. Order Access
Courier must be authorized for the linked active order/task.
## 106. Thread Access
Courier must be a valid participant in the thread.
## 107. Message Access
Message belongs to an authorized thread.
## 108. IDOR
Knowing IDs does not bypass participant/order authorization.
# Security
## 109. XSS / Rendering
Message bodies are untrusted user content.
Render safely.
## 110. Rich HTML
MVP should not accept arbitrary HTML.
## 111. URLs
If URLs become clickable, validate/sanitize presentation.
## 112. Rate Limiting
Messaging endpoints should have reasonable abuse/rate protection.
Exact limits are Open.
## 113. Spam / Abuse
Moderation/reporting behavior is not defined.
Open Decision.
## 114. Credentials
Never expose:
```text
Bearer token
password
API secret
```
inside thread metadata.
# Pagination
## 115. Message History
Messages must be cursor/bounded paginated.
## 116. Initial Load
Load a recent window, not the entire thread.
## 117. Older Messages
Allow loading older messages incrementally where retained.
## 118. Ordering
Use stable chronological sequencing.
# Offline Behavior
## 119. Offline Mode Boundary
`Courier.md` separately defines Offline Mode.
## 120. Message Sending Offline
Offline Chat sending is not source-required.
Open Decision.
## 121. Recommended MVP
Recommended:
```text
no network
→ message not server-confirmed
→ show failed/pending state
```
## 122. Cached Messages
Recent thread history may be cached later, but authoritative sync belongs to Offline Mode/client architecture.
# Notifications
## 123. In-App Unread
Recommended:
```text
new message
→ unread indicator
```
## 124. Background Notification
Push notification for background messages is Open.
## 125. Brevo
Brevo email is not required for operational Courier Chat.
## 126. SMS
SMS is not required.
## 127. Calling
Masked calling, if implemented, uses separate telephony infrastructure.
# Data Model
## 128. Conceptual Thread
```text
chat_threads
- id
- order_id / delivery_task_id
- conversation_type
- active/archived state
- created_at
```
Exact schema is Open.
## 129. Conceptual Participants
```text
chat_participants
- thread_id
- user_id
- role
- last_read...
```
## 130. Conceptual Messages
```text
chat_messages
- id
- thread_id
- sender_user_id
- body
- created_at
```
## 131. Conversation Type
If separate counterparty threads are adopted:
```text
COURIER_BUYER
COURIER_SELLER
COURIER_LOGISTICS
```
Exact enum names are Open.
# Performance
## 132. Message Query
Index by:
```text
thread_id
created_at / sequence
```
## 133. Thread Query
Index active-order/thread participant relationships.
## 134. No N+1
Avoid repeated participant/order lookups per message row.
## 135. Realtime Payload
Publish compact events:
```text
thread_id
message_id
sender
created_at
```
with safe preview fields where needed.
# Reliability
## 136. Durable Message Before Ack
A successful send response should mean the message is durably stored.
## 137. Publish Failure
If DB persist succeeds but realtime publish fails:
```text
message remains stored
→ recipient gets it on refetch/reconnect
```
## 138. Duplicate Client Retry
Client-generated idempotency key may be used.
Open Decision.
## 139. Reconnect Recovery
Clients must fetch missed messages after reconnection.
# UX
## 140. Recommended Active-Order Entry
```text
Active Delivery
├── Message Buyer
├── Message Seller
└── Message Logistics
```
show only contextually valid counterparties.
## 141. Thread Screen
```text
Chat
├── Counterparty Role/Name
├── Order Reference
├── Message History
└── Composer
```
## 142. Order Context
Keep order/task reference visible enough to prevent messaging in the wrong delivery context.
## 143. Privacy
Do not display raw phone numbers in secure chat.
## 144. Empty Thread
Example:
```text
No messages yet.
```
## 145. Send Failure
Show:
```text
Message failed to send.
Retry.
```
## 146. Archived Thread
If post-completion send is disabled:
```text
Delivery completed.
This conversation is read-only.
```
## 147. Accessibility
The Flutter UI should:
- expose sender and message text to screen readers
- identify unread state textually
- use accessible composer/send controls
- use large touch targets
- announce send failures
- not rely on color alone
# Masked Calling UX
## 148. Optional Call Action
If later implemented:
```text
Call Buyer
Call Seller
Call Logistics
```
may appear only for authorized active-order context.
## 149. Privacy Label
The UI should make clear that direct phone numbers are protected.
## 150. Failure
If masked call cannot be created:
```text
fallback to secure chat
```
where possible.
# Third-Party Dependencies
## 151. Core Chat
No new third-party provider is required for core secure text chat.
AISLEY can use:
```text
backend database
authenticated APIs
self-hosted WebSockets/SSE
or polling
```
## 152. Masked Calling
Masked calling likely requires telephony infrastructure/provider.
No provider is selected in the source.
## 153. Brevo
Not required.
## 154. Mapbox
Not required for messaging itself.
## 155. SMS
Not required for core Chat.
# MVP Scope
## 156. Required
- authenticated Courier access
- exact Courier-role authorization
- active-order linked thread
- Courier ↔ Buyer secure chat
- Courier ↔ Seller secure chat where contextually relevant
- Courier ↔ Logistics secure chat
- server-authorized participants
- plain-text messages
- durable persistence
- message history
- cursor/bounded pagination
- realtime or near-realtime updates
- reconnect/refetch
- no raw phone-number exposure
- cross-order/thread isolation
- loading/empty/error states
- active-delivery entry points
- XSS-safe rendering
## 157. Recommended
- separate counterparty threads
- unread counts
- last-read state
- archived/read-only conversation after completion
- client idempotency key
- active-order reference in thread header
- self-hosted realtime transport
- Chat links from Pick Up Order / Deliver Order
## 158. Not Required
- masked calling for MVP
- telephony provider
- group chat
- attachments
- images
- voice notes
- arbitrary location sharing
- message editing
- message deletion
- moderation dashboard
- email
- SMS
- mobile Push
- state mutation from chat text
- address-book edits
# Acceptance Criteria
## 159. Access
- Invalid/absent Courier token cannot access threads.
- Non-Courier token cannot use Courier messaging APIs.
- Same-email other-role account does not inherit Courier thread access.
- Courier sees only authorized order-linked threads.
## 160. Thread Scope
- Each core thread is linked to an active order/task.
- Arbitrary users cannot be added by the mobile client.
- Cross-order thread IDs do not leak messages.
- Buyer/Seller/Logistics participant access is backend-derived.
## 161. Messaging
- Courier can send plain-text message to authorized counterparty.
- Message is durably stored before successful acknowledgement.
- Recipient can retrieve the message.
- Realtime/near-realtime delivery works according to selected transport.
- Reconnect retrieves missed messages.
- Duplicate realtime events do not duplicate UI messages.
## 162. Privacy
- Raw participant phone numbers are not required for core chat.
- Message/thread responses expose only necessary operational identities.
- Gate codes/address clarifications remain restricted to authorized thread participants.
- Tokens/secrets are absent.
## 163. State Boundary
- Sending a message does not change order/task status.
- Chat does not assign a Courier.
- Chat does not edit Buyer Address Book.
- Chat does not create an Incident automatically.
- Chat does not replace SOS.
## 164. Lifecycle
- Active-order conversation is sendable according to policy.
- Post-completion behavior follows configured archive/closure rule.
- Historical messages are read-only if archived.
- Thread expiration/deletion does not silently erase required operational records.
## 165. Third-Party
- Core secure text chat works without a new hosted third-party provider.
- Masked calling remains optional until a provider/architecture is selected.
- Brevo/Mapbox/SMS are not required.
# Tests
## 166. Backend Tests
Test:
- missing token denied
- invalid token denied
- Buyer/Seller/Logistics token denied from Courier endpoint
- authenticated Courier allowed
- same-email role isolation
- authorized active-order thread
- unauthorized order denied
- unauthorized thread denied
- Buyer thread participant resolution
- Seller thread participant resolution
- Logistics thread participant resolution
- send message
- empty message rejected
- unsafe HTML rendered safely
- message pagination
- message ordering
- duplicate retry/idempotency if implemented
- cross-thread IDOR
- post-completion policy
- archived read-only policy if implemented
- no raw phone numbers
- no token leakage
## 167. Flutter Tests
Test:
- Chat entry from active delivery
- Buyer thread
- Seller thread
- Logistics thread
- thread header/order context
- send text
- message appears
- receive message
- unread indicator if implemented
- pagination/load older
- reconnect
- missed-message refetch
- send failure/retry
- archived thread
- no phone-number exposure
- screen-reader message labels
- touch-target sizing
- error states
- keyboard/composer behavior
# Open Decisions
## 168. Open Decisions
The current sources do not define:
1. exact active-order statuses that permit chat
2. post-completion send window
3. message-retention duration
4. whether completed threads remain visible
5. separate counterparty threads vs group room
6. thread creation timing
7. exact thread schema
8. exact message schema
9. exact max message length
10. message edit support
11. message delete support
12. read receipts
13. delivered receipts
14. unread-count implementation
15. realtime transport
16. background mobile Push
17. Push provider
18. offline message queueing
19. attachments
20. image sharing
21. voice notes
22. location-pin sharing
23. moderation/report-abuse policy
24. rate-limit thresholds
25. whether historical Chat appears from Delivery History
26. whether Incident records link into Chat
27. masked calling MVP inclusion
28. telephony provider
29. masked-number allocation model
30. call-log retention
31. exact API routes
# Final Definition
## 169. Final Definition
AISLEY Courier Chat / Messaging is:
```text
a temporary,
secure,
active-order communication channel
```
that allows the Courier to contact:
```text
Buyer
Seller
Logistics
```
for source-backed operational needs such as:
```text
address clarification
gate codes
immediate delivery delays
```
Core privacy rule:
```text
communication must protect
participant phone numbers/privacy
```
Recommended MVP:
```text
secure order-linked text chat
```
with optional future:
```text
masked calling
```
Critical boundary:
```text
Chat
= communication

Accept / Pick Up / Complete / Incident / SOS
= stateful operational actions
```
Third-party rule:
```text
Core text chat requires no new hosted provider.

Masked calling may require
a future telephony provider,
but none is selected by current sources.
```
