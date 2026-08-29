---
feature: chat-messaging
title: Seller Chat / Messaging
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Chat / Messaging
## WHAT
- **Purpose:** Give authenticated Sellers a secure, persistent real-time inbox for answering Buyer Product inquiries and providing Order-linked support.
- **Canonical role:** `SELLER`.
- **Primary source relationship:** Seller ↔ Buyer.
- Seller source defines Chat/Messaging for:
  - pre-sale Product inquiries
  - post-sale support
  - minor issue resolution
  - real-time communication
- **Shared-domain rule:** Seller Chat and Buyer Chat use the same conversation/message domain; do not create a second Seller-only messaging database.
- **Source/system-flow capabilities:**
  - list Seller-scoped conversations
  - show participant, Product/Order context, unread count, latest message
  - open a thread with renewed authorization
  - paginate message history
  - send text and validated attachments
  - persist before real-time delivery
  - update Seller read/unread state
  - continue the same contextual conversation
  - archive, mute, or report without deleting shared history
- **Recommended flow:**
```text
INBOX
→ load Seller-authorized conversations
→ participant/context/latest message/unread count

OPEN
→ revalidate Seller membership/context
→ load paginated persisted messages
→ authorize private realtime channel
→ advance Seller read marker

SEND
→ validate + authorize
→ persist Message/attachment references
→ commit
→ broadcast MessageSent
→ Buyer inbox/unread updates

ARCHIVE / MUTE / REPORT
→ update Seller participant state
→ preserve shared conversation/history
```
- **Recommended routes:**
```text
/seller/messages
/seller/messages/{conversation}
```
- **Architecture:**
  - Next.js/React owns inbox UI, conversation view, composer, attachment UI, unread presentation, archive/mute/report actions, and reconnect states.
  - Laravel owns participant/context authorization, conversation creation, message persistence, read state, attachment authorization, events, notifications, and broadcasting.
  - Database is authoritative; broadcasting synchronizes committed state.
- **Feature boundaries:**
  - Buyer Chat is the Buyer-facing view of the same shared domain.
  - Product Detail/Browse Shop may initiate Buyer→Seller pre-sale conversations.
  - Order Detail may provide Seller↔Buyer post-sale context.
  - Complaints/Disputes owns formal dispute adjudication.
  - Admin/Courier/Logistics messaging may reuse the same shared schema under separate authorization rules.
- **Non-goals:**
  - unrestricted Seller contact with arbitrary users
  - public/group chat
  - anonymous chat
  - voice/video calls
  - end-to-end encryption unless separately designed
  - exposing Buyer phone/email/address to enable chat
  - deleting shared history when one participant archives
  - autonomous/AI replies
## MUST
### Authentication
- Seller messaging requires authenticated `SELLER`.
- Laravel derives sender identity/role from authentication.
- Never trust client-submitted:
  - sender ID
  - sender role
  - Seller/shop ID
  - participant membership
  - sent timestamp
  - read state
- Buyer/Admin/Courier/Logistics authentication does not automatically grant Seller-side access.
- Use:
  - `401` unauthenticated
  - `403` authenticated but forbidden
  - `404` Seller-scoped conversation missing
  - `422` invalid message/input
  - `409` stale/conflicting mutation where applicable
  - `429` throttled sends/uploads
### Shared messaging domain
- Minimum conceptual entities:
```text
conversations
conversation_participants
messages
```
- Optional shared entities:
```text
message_attachments
conversation_reports
```
- Do not create parallel:
```text
seller_messages
buyer_messages
```
for the same Buyer↔Seller conversation.
- Model names must follow the repository's actual account/user architecture.
### Conversation participants
- Every conversation has explicit authorized participants.
- Participant membership is unique per conversation/account.
- Seller can list/open/send/read/archive/mute/report only when authorized.
- Guessing a conversation ID must never reveal:
  - messages
  - Buyer identity
  - Product/Order context
  - attachment metadata
- HTTP API authorization and broadcast-channel authorization must enforce equivalent membership rules.
### Seller authorization basis
- Seller access requires one of:
  - explicit participant membership, and
  - valid Seller relationship to the Product/Order context where context determines access.
- Laravel resolves Seller ownership from authoritative records.
- Never accept arbitrary:
```text
seller_id
buyer_id
product_id
order_id
```
as proof of access.
### Buyer → Seller pre-sale conversation
- Buyer and Seller source both support Product questions before purchase.
- Typical flow:
```text
Buyer Product Detail / Shop
→ Message Seller
→ Laravel resolves Product owner
→ creates/reuses permitted conversation
→ Seller receives/replies
```
- Seller does not need access to a Buyer directory to answer.
- Product viewing/wishlist activity alone does not authorize Seller outreach.
### Seller-started conversation
- Seller system flow allows Seller to start a **permitted Order conversation**.
- Seller may initiate only when authoritative Order data proves:
  - Buyer belongs to Order
  - Seller owns/is associated with relevant Order items
- Seller cannot start a conversation with an unrelated Buyer.
- Non-Order Seller initiation rules are not source-defined and remain Open.
### Product context
- Pre-sale threads may reference a Product; Laravel validates existence, Seller ownership, and Buyer eligibility.
- Store a stable Product reference; archive must not destroy historical context.
### Order context
- Laravel verifies Buyer ownership and Seller association before using Order context.
- Expose only support-needed Order fields, never payment secrets, full address data, other Sellers' items, or platform financial details.
### Context integrity
- Product/Order context is server-validated conversation metadata.
- Client cannot rewrite a conversation's context to gain access to another Buyer/Product/Order.
- Exact schema is Open:
  - `product_id`
  - `order_id`
  - polymorphic context
  - separate context table
### Conversation uniqueness
- Sources do not define whether conversations are:
  - one Seller↔Buyer pair thread
  - one per Product
  - one per Order
  - multiple threads
- Do not invent final uniqueness.
- Whatever rule is chosen must be enforced transactionally/uniquely to prevent duplicate creation races.
### Inbox
- Seller inbox is paginated.
- Each conversation summary should include:
  - conversation ID
  - safe participant summary
  - Product/Order context
  - latest message preview
  - latest-message timestamp
  - unread count
  - archive/mute state where relevant
- Recommended default order: newest activity first.
- Allow-list filters/sorts only.
### Safe Buyer summary
- Return only support-needed public identity such as display name/avatar/role.
- Never expose private email, phone, address, verification documents, or payment details merely for chat.
### Message model
- Persist immutable Message ID, conversation ID, authenticated sender ID, body when present, and server timestamp.
- Optional: attachments, reply-to, client/idempotency key.
- Display name/client timestamp are never authoritative.
### Text validation
- Text messaging is required.
- Laravel must:
  - reject whitespace-only content
  - reject empty content unless valid attachment-only messages are allowed
  - enforce maximum length
  - validate expected encoding/shape
  - treat message body as untrusted text
- Exact maximum length is Open.
- Do not render arbitrary message HTML without explicit sanitization.
### Attachments
- Seller source says messaging supports text and **possibly image attachments**; Seller system flow explicitly allows validated attachments.
- Attachment support is source-supported, but exact MVP types/count/size are Open.
- If enabled:
  - authorize conversation membership
  - validate type/size
  - malware scan
  - store through configured object/file storage
  - persist asset reference
  - serve only through authorized/signed access
- Attachment authorization must be no weaker than message authorization.
- Do not store binary data inside the Message JSON/body.
### Attachment privacy
- Asset access requires conversation membership; guessing an asset ID must not expose it.
- Use safe attachment metadata and generated storage identity; exact types/count/size remain Open.
### Send message
- Conceptual endpoint:
```http
POST /api/messages/conversations/{conversation}/messages
```
- Laravel:
  1. authenticates Seller
  2. scopes conversation
  3. verifies membership/send permission
  4. validates message/attachment
  5. persists Message
  6. associates assets
  7. updates conversation activity metadata
  8. commits
  9. broadcasts/notifies after commit
- Broadcast failure must not roll back a committed Message.
### Persist before broadcast
- Database state is authoritative.
- Never emit a normal successful `MessageSent` event before persistence succeeds.
- AISLEY architecture requires broadcasts/notifications after commit.
- Laravel queue/event configuration can delay queued broadcast/notification work until commit.
### Private broadcast channel
- Chat must not use a public channel.
- Conceptual:
```text
private-conversations.{conversationId}
```
- Channel authorization verifies current account is a participant.
- Broadcast payload contains only safe Message Resource fields.
- Current Laravel private channels require authorization before a subscriber can listen.
### Broadcast authentication
- Use the same configured secure Seller web authentication mechanism used by protected APIs.
- If the repository uses stateful Sanctum for Seller web, Laravel supports Sanctum-protected private broadcast authorization.
- Do not introduce a permanent JavaScript-readable token only for WebSocket access.
### Broadcast driver
- Use Laravel broadcasting through the project-configured driver.
- Do not hard-code Reverb/Pusher/Ably unless the repository selects one.
- Real-time delivery supplements persisted API history; it does not replace it.
### Reconnect / missed events
- Broadcasting is not durable history; reconnect must reauthorize/refetch and merge by immutable Message ID.
### Conversation history
- Persisted history is paginated with stable server ordering; HTTP and realtime results deduplicate by Message ID.
### Read / unread state
- Seller flow and Buyer source require unread counts.
- Persist Seller read state server-side.
- Recommended participant fields:
```text
last_read_message_id
last_read_at
```
- Seller can modify only their own read marker.
- Marker must reference a message in the same conversation.
- Stale clients cannot move read state backwards.
### Mark read
- Conceptual:
```http
POST /api/messages/conversations/{conversation}/read
```
- Requires participant membership.
- Persist read state before any realtime read-state event.
- Operation is idempotent.
- Inbox unread count updates after commit.
### Read receipts
- Backend read markers are required for unread state; sender-visible `Seen` receipts are not source-defined and remain Open.
### Archive
- Archive is Seller-participant-specific: hide/move from Seller inbox without deleting Buyer access, shared messages, or dispute history.
- New-message resurfacing is Open.
### Mute
- Mute affects Seller notifications only; it does not block messages/delete history, and unread may still increase.
- Duration/options are Open.
### Report
- Report creates separate moderation metadata without rewriting/deleting conversation history.
- Exact Admin workflow is Open and must not expose unrelated activity.
### Editing / deletion
- Source does not define message edit, unsend, or hard delete.
- Do not make these mandatory for MVP.
- Seller archive/mute/report must never destructively remove shared support history.
- Any future retention/deletion policy must preserve dispute/audit requirements.
### Offline retry / idempotency
- Seller system flow explicitly requires offline retries not to duplicate messages.
- Use a client message key/idempotency key or equivalent.
- Retrying the same logical send returns/reconciles to the existing Message.
- Optimistic UI is optional and must reconcile HTTP + realtime by server Message ID.
### Rate limiting
- Rate-limit message sends and attachment uploads.
- Exact thresholds are Open.
- Return `429` when throttled.
- Throttling must not invalidate already-committed Messages.
### Notifications
- Committed Messages may update inbox ordering/unread/in-app notification state.
- Email/SMS/push per Message is optional and governed by mute/preferences.
### Security / privacy
- Recheck authorization on every request; Message/attachment data is participant-private.
- Do not log full private content; safely render text; never expose Buyer contact/address just for chat.
- Suspended-account chat behavior is Open/policy-controlled.
### Frontend states
- Inbox: loading, empty, loaded, archived, error.
- Conversation: loading/history, loaded, sending, send/upload failure, reconnecting, forbidden/not-found.
- Controls: active/muted/archived/reported; failed optimistic/duplicate sends must reconcile visibly.
### Accessibility
- Use semantic inbox/thread structure, labeled keyboard-operable controls, non-color-only states, and non-disruptive incoming-message announcements.
### Acceptance criteria
- [ ] Seller can access/send only authorized conversations; unrelated Buyers/other Seller threads remain inaccessible.
- [ ] Inbox exposes safe participant/context/latest-message/unread data.
- [ ] Sender/role/context/timestamp/read state cannot be forged.
- [ ] Seller replies to support threads and initiates only permitted Order-linked conversations.
- [ ] Text/attachments are validated/private and persist before private realtime delivery.
- [ ] Inbox/history are paginated; read state is persisted/monotonic.
- [ ] Retried sends do not duplicate Messages; reconnect recovers missed persisted data.
- [ ] Archive/mute/report preserve shared history.
- [ ] Attachment and broadcast authorization match conversation membership.
- [ ] UI handles loading, empty, send/upload error, forbidden, and reconnect states.
## HOW
### Project findings
- `Seller.md` defines Seller↔Buyer realtime communication for pre-sale Product inquiries, post-sale support, and minor issues; text and possibly image attachments are supported.
- `Buyer.md` independently requires the same secure Buyer↔Seller relationship, persisted threads/messages, realtime delivery, and unread counts.
- Seller system flow adds Seller-specific inbox context, permitted Order initiation, attachment validation, archive/mute/report, offline-send deduplication, and dispute-history preservation.
- Other AISLEY roles also define messaging, supporting a single shared messaging domain with role/context-specific authorization.
- AISLEY architecture assigns realtime delivery to Laravel broadcasting consumed by React and requires tenant scoping, pagination, secure uploads, and after-commit delivery.
- Sources do not define:
  - conversation uniqueness
  - message length
  - attachment limits/types
  - sender-visible read receipts
  - typing/presence
  - retention
  - mute duration
  - exact report workflow
### Recommended data model
```text
conversations
- id
- product_id/order_id/context nullable
- last_message_at
- created_at
- updated_at

conversation_participants
- conversation_id
- account/user_id
- last_read_message_id nullable
- last_read_at nullable
- archived_at nullable
- muted_until nullable

messages
- id
- conversation_id
- sender_account/user_id
- client_message_key nullable
- body nullable
- created_at

message_attachments
- id
- message_id
- asset_id
- media_type
```
- Use repository account model names.
- Add unique participant membership and message-idempotency constraints where appropriate.
- Keep reports separate from shared Message history.
### Recommended API
```http
GET  /api/messages/conversations
POST /api/messages/conversations
GET  /api/messages/conversations/{conversation}/messages
POST /api/messages/conversations/{conversation}/messages
POST /api/messages/conversations/{conversation}/read
POST /api/messages/conversations/{conversation}/archive
POST /api/messages/conversations/{conversation}/mute
POST /api/messages/conversations/{conversation}/report
```
- Shared endpoints may serve multiple roles through Policies.
- Use Form Requests, Policies/Gates, API Resources, transactions where multi-record writes occur, and participant-scoped queries.
### Recommended actions
```text
StartConversation
GetConversationInbox
SendMessage
MarkConversationRead
ArchiveConversationForParticipant
MuteConversationForParticipant
ReportConversation
```
- Seller initiation policy may wrap `StartConversation` for Order context.
### Conversation policy
- Centralize membership, send permission, Seller Product/Order context, and archive/mute/report authorization.
- Broadcast authorization should reuse the same membership logic.
### Events
Recommended:
```text
MessageSent
ConversationRead
ConversationArchived
ConversationMuted
ConversationReported
```
- Broadcast only safe participant data.
- `MessageSent` must be after commit.
- Laravel's queue `after_commit` behavior can delay queued events, notifications, and broadcasts until transaction commit.
### Broadcasting
- Conceptual authorization:
```php
Broadcast::channel('conversations.{conversationId}', function ($user, $conversationId) {
    return conversationParticipantExists($user, $conversationId);
});
```
- Actual implementation must use repository Policies/relationships.
- Laravel private channels require authenticated authorization.
- If Seller web uses Sanctum SPA authentication, Laravel documents using `auth:sanctum` for private broadcast auth.
- Do not choose a broadcast provider in this feature unless repository configuration already selects one.
### Attachments
- Upload through an authorized message-attachment/staged asset flow.
- Validate type/size before accepting.
- Shared AISLEY rules also require malware scanning and configured private/object storage.
- Persist only validated asset references.
- Attachment fetch authorization reuses conversation membership.
### Next.js / React
```text
/seller/messages
├── SellerConversationInbox
│   └── ConversationRow
└── /seller/messages/[conversation]
    ├── ConversationHeader
    ├── ProductOrderContextCard
    ├── MessageHistory
    ├── MessageComposer
    └── ConversationActions
```
- Realtime subscription/composer/attachment controls require Client Component behavior.
- Initial/history data comes from Laravel HTTP APIs.
- Realtime events merge into persisted state; they are not the history source.
### Tests
- **Laravel:** Seller isolation; inbox context/unread; reply/permitted initiation; unrelated Buyer/forged context denial; text/attachment validation; message idempotency; read monotonicity; archive/mute/report; attachment auth; private-channel auth; after-commit broadcast.
- **Frontend:** inbox/unread/history; send/upload failure; realtime dedupe; reconnect; archive/mute/report; forbidden/not-found; accessibility.
### Research-backed recommendations
- Use Laravel private channels with participant authorization.
- If Seller web uses Sanctum, reuse that SPA identity for broadcast auth rather than a second browser token.
- Broadcast/notify after commit; database remains durable history and WebSockets are synchronization only.
### Risks
- **Privacy/outreach:** weak membership/context rules can expose Buyer messages or enable Seller spam.
- **Consistency:** broadcast-before-commit/retry bugs can create ghost/duplicate Messages or unread drift.
- **Attachment/history:** weak asset auth or destructive archive/delete can leak files or remove dispute evidence.
- **Scope growth:** typing/presence/reactions/editing/calls/moderation/retention can expand MVP quickly.
### Open questions
- Conversation uniqueness/context and Seller-start eligibility outside Orders.
- Message length; attachment types/count/size/MVP requirement.
- Sender-visible `Seen`, typing/presence.
- Archive resurfacing and mute behavior.
- Report/Admin workflow and retention/deletion policy.
- Offline notification channels, broadcast driver, rate limits, suspended-Seller behavior.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture: `README.md`
- Seller source: `Seller.md`
- Buyer source: `Buyer.md`
- Seller flow: `feature-system-flows/seller/chat-messaging.md`
- Buyer spec: `buyer/chat-messaging/spec.md`
- Laravel 12 Broadcasting: https://laravel.com/docs/12.x/broadcasting
- Laravel 12 Sanctum: https://laravel.com/docs/12.x/sanctum
- Laravel 12 Queues: https://laravel.com/docs/12.x/queues
- Laravel 12 Notifications: https://laravel.com/docs/12.x/notifications
