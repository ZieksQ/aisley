---
feature: chat-messaging
title: Customer / Buyer Chat / Messaging
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Buyer
scope: Customer / Buyer Web Application
---

# Customer / Buyer Chat / Messaging
## WHAT
- **Purpose:** Give authenticated Buyers a secure, persistent real-time messaging channel for communicating with Sellers before and after purchase.
- **Canonical role:** `BUYER`.
- **Primary source-defined relationship:** Buyer ↔ Seller.
- **Source-defined uses:**
  - pre-purchase questions about product specifics
  - post-purchase support
  - minor issue resolution without leaving AISLEY
  - unread message counts
- **Cross-role compatibility:**
  - Admin, Courier, and Logistics also use messaging in their own source-defined contexts.
  - Buyer must use the same shared conversation/message domain rather than a separate Buyer-only chat database.
  - Buyer may receive/respond in authorized Admin/Courier/Logistics conversations when those role flows create or permit them.
  - Current Buyer source does not grant unrestricted Buyer initiation toward every platform role.
- **Architecture:**
  - Next.js/React owns inbox, conversation UI, composer, unread presentation, loading/error/reconnect states, and real-time subscriptions.
  - Laravel owns participant authorization, conversation creation, message validation/persistence, unread/read state, pagination, events, notifications, and broadcasting.
  - Database persistence is authoritative; WebSocket/broadcast delivery synchronizes committed state.
- **Recommended flow:**
```text
OPEN
→ fetch persisted conversation/history
→ authorize Buyer membership
→ subscribe authorized private channel

SEND
→ POST message intent to Laravel
→ validate + authorize
→ persist message
→ commit
→ broadcast MessageSent
→ update recipient inbox/unread state

READ
→ persist Buyer read marker
→ optionally broadcast read-state update
```
- **Recommended routes:**
```text
/messages
/messages/{conversation}
```
- **Recommended MVP:** persistent text messaging.
- **Useful optional context:** product ID for pre-sale conversations and order ID for post-sale support when the schema supports it.
- **Non-goals:**
  - public group chat
  - anonymous messaging
  - unrestricted user directory
  - arbitrary Buyer contact with any role
  - voice/video calling
  - end-to-end encryption unless separately designed
  - AI-generated replies
  - hard-delete/edit behavior not defined by the source
  - image/file attachments unless explicitly included later
## MUST
### Authentication
- Buyer messaging requires authenticated `BUYER` identity.
- Use the Customer Auth mechanism configured by AISLEY.
- Sender identity comes from the authenticated Laravel account.
- Never trust client-submitted:
  - sender ID
  - sender role
  - participant membership
  - sent timestamp
  - read state
- A valid Seller/Admin/Courier/Logistics session must not automatically satisfy Buyer-owned API behavior unless the endpoint is intentionally shared and authorizes that role.
- Use project error conventions:
  - `401` unauthenticated
  - `403` authenticated but forbidden
  - `404` scoped conversation not found
  - `422` invalid message/input
  - `409` stale/conflicting operation when applicable
### Shared messaging domain
- Buyer Chat must integrate with one shared messaging domain used by other roles.
- Minimum conceptual entities:
```text
conversations
conversation_participants
messages
```
- Recommended participant read state lives on `conversation_participants`.
- Do not create separate incompatible tables such as:
```text
buyer_messages
seller_messages
admin_messages
```
for each role unless the existing repository has already established another normalized design.
- One shared domain permits the same conversation to be rendered appropriately to each authorized participant.
### Conversation participant model
- Every conversation requires authorized participants.
- Each participant row must reference a real authenticated account/role identity.
- Participant membership must be unique per conversation/account.
- A Buyer can access only conversations where they are an authorized participant.
- Guessing a conversation ID must never reveal messages or metadata.
- Laravel must enforce membership on:
  - conversation list
  - conversation detail
  - message history
  - send
  - read marker
  - private broadcast subscription
### Buyer ↔ Seller initiation
- Buyer source explicitly supports direct Buyer ↔ Seller messaging.
- Buyer may initiate Seller contact from an appropriate seller/product/order context.
- Laravel must resolve the target Seller from authoritative data.
- Buyer must not submit a trusted arbitrary participant role/account pair without validation.
- Recommended entry points:
  - Product Detail → `Message Seller`
  - Browse Shop → `Message Seller`
  - Order Detail → `Contact Seller`
- Exact entry points remain coordinated with those feature specs.
- Seller availability/vacation state does not automatically delete existing conversations.
- Whether suspended/deactivated Sellers remain readable/respondable follows account/compliance policy.
### Pre-purchase context
- Pre-purchase conversation may reference a product.
- Product context is recommended but not mandatory unless UI requires it.
- If linked:
  - product must exist
  - product must belong to the target Seller
  - Buyer must be allowed to view/contact regarding it
- Do not duplicate full Product records into chat messages.
- Store a stable reference and return a safe context summary.
- Product removal later must not corrupt historical chat.
### Post-purchase context
- Post-purchase support may reference an Order.
- If linked:
  - Order must belong to the authenticated Buyer
  - target Seller must be associated with the relevant order/item
- Do not allow a Buyer to attach an unrelated order ID to a Seller conversation.
- Order context does not grant broader access to unrelated Seller/order data.
- Historical conversation remains readable according to retention policy after the order completes/cancels.
### Other role conversations
- Admin source permits Admin ↔ user support/compliance threads.
- Courier source permits temporary order-linked contact with Buyer/Seller/Logistics.
- Logistics source permits order-related Buyer communication for delivery clarification.
- Buyer may participate/respond when authorized by those owning role workflows.
- This Buyer spec does not grant:
  - arbitrary Buyer initiation toward any Admin
  - arbitrary Buyer discovery of Courier identities
  - arbitrary Buyer initiation toward Logistics
- Exact Buyer initiation rules for support/delivery roles are Open Questions.
### Conversation uniqueness
- Sources do not define whether Buyer ↔ Seller uses:
  - one permanent direct thread per pair
  - one thread per product/order/context
  - multiple independent threads
- Do not invent the final uniqueness rule.
- Whatever rule is chosen must prevent accidental duplicate conversations from repeated clicks/submits.
- Conversation creation should use a transaction/unique constraint/idempotency strategy where appropriate.
### Message model
- Each persisted message requires:
  - immutable server-generated ID
  - conversation ID
  - authenticated sender ID
  - message body
  - server-created timestamp
- Optional:
  - reply-to message ID
  - asset references if attachments are later enabled
- Do not persist sender display names as the only identity reference.
- Do not trust client timestamps for ordering.
### Text message validation
- MVP messages are text.
- Laravel must:
  - reject empty/whitespace-only bodies
  - enforce a server-side maximum length
  - validate encoding/shape
  - store text as data, not executable HTML
- React must render user-authored message content safely.
- Do not render raw message body with unsafe HTML injection.
- Exact maximum length is Open.
### Send message
- Conceptual endpoint:
```http
POST /api/messages/conversations/{conversation}/messages
```
- Conceptual payload:
```json
{
  "body": "Is this available in size M?"
}
```
- Backend sequence:
  1. authenticate
  2. scope/load conversation
  3. verify Buyer membership and send permission
  4. validate body
  5. persist message
  6. update conversation last-message metadata if used
  7. commit
  8. broadcast/notify recipients after commit
- Broadcast failure must not roll back an already committed message.
### Persistence before real time
- The database message is authoritative.
- Never broadcast a message as successful before persistence succeeds.
- If the database transaction rolls back, no normal `MessageSent` broadcast should be emitted.
- Laravel queues can delay broadcasts/notifications until transactions commit. citeturn220543search2turn676185view3
### Private broadcast channel
- Message content must use an authorized private channel.
- Conceptual channel:
```text
private-conversations.{conversationId}
```
- Laravel channel authorization must verify that the current account is a conversation participant.
- Laravel documents that private channels require server authorization before a user may listen. citeturn676185view0turn676185view1
- Never broadcast private conversation messages over public channels.
- Broadcast payload contains only the safe Message Resource fields needed by clients.
### Broadcast driver
- Use Laravel broadcasting through the configured project driver.
- Do not hard-code Pusher, Ably, or Reverb unless repository configuration chooses it.
- Laravel 12 supports Reverb, Pusher Channels, and Ably broadcast drivers. citeturn503618view0
- The Buyer web client may use Laravel Echo/React integration when compatible with repository setup.
- Current Laravel Echo React support includes private-event subscription hooks. citeturn676185view2
### WebSocket security
- Production real-time transport must use TLS (`wss://`) when WebSockets are selected.
- Restrict/validate trusted origins.
- WebSocket connection authentication does not replace per-conversation authorization.
- Validate every HTTP/message mutation independently.
- Apply:
  - message-size limits
  - send-rate limits
  - connection limits where needed
  - safe structured event parsing
- OWASP recommends `wss://`, origin validation, message-level authorization, input validation, payload limits, and rate limiting for WebSockets. citeturn607760search0
- Do not log full private message content in infrastructure/security logs by default.
### WebSocket session lifecycle
- Logout/session expiry must end effective private-channel authorization and protected message APIs must reject stale sessions.
- Reauthorization follows Customer Auth; exact immediate socket-disconnect behavior depends on the selected broadcaster.
### Conversation history
- Messages must remain persistently retrievable.
- History must be paginated.
- Use stable server ordering.
- Recommended ordering for retrieval:
```text
newest first in API pagination
→ reverse/merge for chronological UI
```
or another repository-consistent strategy.
- Real-time events and paginated history must deduplicate by immutable message ID.
- Never load an unbounded lifetime conversation in one request.
### Inbox
- Buyer inbox must be paginated.
- Safe conversation summary may contain:
  - conversation ID
  - other participant public display identity
  - optional shop/Seller summary
  - optional product/order context summary
  - last-message safe preview
  - last-message timestamp
  - unread count/status
- Do not expose private Seller/Admin/Courier/Logistics account fields.
- Sort/filter parameters must be allow-listed.
- Default newest-recent-activity-first ordering is recommended.
### Unread counts
- Buyer source explicitly requires unread notification counts.
- Unread state must derive from persisted backend state.
- Recommended participant fields:
```text
last_read_message_id
last_read_at
```
or equivalent.
- An unread count must not depend only on local React state.
- A Buyer may update only their own read marker.
- Read marker must reference a message belonging to that conversation.
- Read marker must be monotonic; stale clients cannot move it backward.
### Mark read
- Conceptual endpoint:
```http
POST /api/messages/conversations/{conversation}/read
```
- Laravel verifies membership.
- Persist read state before any real-time read update.
- Endpoint should be idempotent.
- Sender-visible "Seen" receipts are **not explicitly required by Buyer.md**.
- The shared domain may support them for Admin/read-receipt compatibility, but whether Buyer/Seller UI displays "Seen" is Open.
### Notifications
- A committed incoming message may update:
  - conversation UI
  - inbox ordering
  - unread count
  - shared in-app notification state if the notification domain uses chat events
- Broadcast/notification failure must not undo message persistence.
- Email, SMS, and push notification for every chat message are not source-required.
- Whether offline chat messages trigger email/push follows notification preferences and remains Open.
### Attachments
- Buyer source does not explicitly require attachments.
- Seller source says text and **possibly** image attachments, so images remain optional rather than MVP-required. fileciteturn36file2
- If later enabled:
  - Laravel-authorized upload
  - type/size validation
  - malware scanning
  - configured object/file storage
  - asset IDs/references in messages
  - authorized/signed file access
- Never store uploaded binaries directly inside message JSON/body.
### Message editing/deletion
- Sources do not define edit/unsend/delete, so MVP exposes none.
- Historical support/order messages must not be hard-deleted without explicit retention/moderation policy.
### Blocking / abuse reporting
- Buyer source does not define chat blocking/reporting; Global Ban and Complaints/Disputes remain separate.
- Chat-specific abuse controls are Open.
### Privacy
- Buyer/Seller chat is private to authorized participants; Admin has no blanket access and Courier/Logistics access stays context-specific.
- Avoid unnecessary phone/contact exposure and serialize only safe participant/context data.
### Reconnect / missed events
- Real-time supplements persistence: keep loaded history during disconnect; on reconnect reauthorize, refetch enough inbox/conversation state to recover missed messages, and deduplicate by message ID.
- Never assume every broadcast event arrives exactly once.
### Optimistic sending
- Optimistic UI is optional; if used, show pending/failure, use a client/idempotency identifier, and reconcile HTTP/broadcast results to the authoritative server message ID without duplicates.
### Rate limiting
- Rate-limit message sends by authenticated account and optionally IP; exact thresholds are Open.
- Use project-standard `429`; throttling must not affect already-persisted messages.
### Frontend states
- Inbox: loading, empty, loaded, error, unauthenticated.
- Conversation: loading, older-history loading, loaded, sending, validation error, send failure, disconnected/reconnecting, forbidden/not found.
- Prevent accidental duplicate submits and make real-time disconnect state visible.
### Accessibility
- Provide semantic inbox/conversation structure, labeled composer, keyboard navigation, non-color-only unread state, and non-disruptive screen-reader announcements.
### Acceptance criteria
- [ ] Guest cannot access Buyer private messaging.
- [ ] Buyer can list only conversations they participate in.
- [ ] Buyer can read only messages from authorized conversations.
- [ ] Buyer can initiate source-approved Buyer ↔ Seller conversations.
- [ ] Target Seller is resolved/validated server-side.
- [ ] Product/order context cannot be forged to unrelated Seller/order records.
- [ ] Client cannot spoof sender ID/role/timestamp/read state.
- [ ] Empty/oversized invalid messages are rejected.
- [ ] Message persists before it is broadcast as sent.
- [ ] Rolled-back message is not broadcast as a successful message.
- [ ] Private channel authorization checks conversation membership.
- [ ] Public broadcast channels never contain private chat bodies.
- [ ] Message history and inbox are paginated.
- [ ] Unread count derives from backend read state.
- [ ] Buyer can only advance their own read marker.
- [ ] Duplicate broadcast/history data deduplicates by message ID.
- [ ] Reconnect/refetch recovers missed persisted messages.
- [ ] Seller/private participant data is minimally serialized.
- [ ] Attachments are not required for MVP.
- [ ] Buyer cannot arbitrarily discover/initiate chats with every platform role.
- [ ] UI handles loading, empty, send failure, forbidden, and reconnect states.
## HOW
### Project findings
- `Buyer.md` defines Chat/Messaging as secure direct Buyer ↔ Seller interaction for pre-purchase product questions and post-purchase support, with real-time delivery, chat-thread/message persistence, and unread counts. fileciteturn36file0
- `Seller.md` independently defines Seller ↔ Buyer real-time support and says text with **possibly** image attachments, so image support is optional. fileciteturn36file2
- Admin, Courier, and Logistics also define messaging, showing that AISLEY needs a shared cross-role messaging domain rather than role-specific incompatible stores. fileciteturn34file1turn35file4turn35file3
- `README.md` explicitly assigns real-time chat delivery to Laravel broadcasting consumed by React and requires auth/ownership checks, pagination, safe Resources, and after-commit broadcasts/notifications. fileciteturn36file1
- Sources do not define exact conversation uniqueness, message limits, edit/delete behavior, offline notification channels, typing indicators, attachment MVP, retention, or which non-Seller roles Buyers may initiate contact with.
### Recommended data model
```text
conversations
- id
- context_type nullable
- context_id nullable
- last_message_at nullable
- created_at
- updated_at

conversation_participants
- conversation_id
- account/user_id
- last_read_message_id nullable
- last_read_at nullable

messages
- id
- conversation_id
- sender_account/user_id
- body
- created_at
```
- Use actual shared account/user model names from the repository.
- Add unique participant membership constraint.
- Index conversation activity and message pagination fields.
- If polymorphic context is not already a repository pattern, explicit nullable `product_id` / `order_id` or a context table may be clearer.
### Laravel API
Conceptual endpoints:
```http
GET  /api/messages/conversations
POST /api/messages/conversations
GET  /api/messages/conversations/{conversation}
GET  /api/messages/conversations/{conversation}/messages
POST /api/messages/conversations/{conversation}/messages
POST /api/messages/conversations/{conversation}/read
```
- Shared endpoints may serve multiple roles through policies.
- Use Form Requests, Policies/Gates, Resources, transactions, and participant-scoped queries.
- Suggested services:
  - `StartConversation`
  - `SendMessage`
  - `MarkConversationRead`
  - `GetConversationInbox`
### Conversation policy
- `ConversationPolicy` should centralize:
  - participant membership
  - allowed send behavior
  - role/context restrictions
- Channel authorization should reuse the same membership logic rather than implement a looser rule.
- Buyer initiation logic can live in `StartBuyerSellerConversation` if source-specific rules would otherwise clutter a generic service.
### Events
Recommended:
```text
MessageSent
ConversationRead
```
- `MessageSent` broadcasts a safe Message DTO.
- Dispatch broadcasts only after the message transaction commits.
- Laravel 12 broadcasting supports queued server events and private channel authorization. citeturn503618view0turn676185view0
- `ShouldDispatchAfterCommit` or configured queue `after_commit` behavior can prevent rolled-back records from being broadcast. citeturn676185view3turn220543search2
### Broadcasting channel
Conceptual:
```php
Broadcast::channel('conversations.{conversationId}', function ($user, $conversationId) {
    return $user->conversations()
        ->whereKey($conversationId)
        ->exists();
});
```
- Actual code must use the repository's shared-account/participant relation.
- Laravel requires explicit authorization for private channels. citeturn676185view1
- When Customer Auth uses Sanctum stateful SPA auth, broadcast authorization should use the same authenticated session configuration rather than a separate exposed browser token. Laravel documents Sanctum-compatible private-channel authorization. citeturn220543search0
### Next.js / React
Recommended component structure:
```text
/messages
├── ConversationInbox
│   └── ConversationRow
└── /messages/{conversation}
    ├── ConversationHeader
    ├── MessageHistory
    ├── LoadOlderMessages
    └── MessageComposer
```
- Real-time subscription requires a Client Component.
- Laravel Echo has React hooks for private broadcast events and leaves channels when the component unmounts. citeturn676185view2
- Use shared API client for initial history, pagination, send, and read mutations.
- Broadcast events update/merge cached client data; they do not replace HTTP persistence APIs.
### Security
- Use private channels only for message content.
- Enforce trusted origins/TLS at deployment.
- Recheck membership for every mutation and channel auth.
- Validate body sizes and rate-limit sends.
- OWASP's WebSocket guidance recommends WSS, origin allow-listing, message-level authorization, size/rate limits, and avoiding sensitive message-content logging. citeturn607760search0
### Tests
- **Laravel:** auth/role checks; participant isolation; Buyer ↔ Seller initiation; forged Seller/product/order rejection; send validation; sender spoof prevention; pagination; read-state monotonicity; private-channel auth; after-commit broadcast; rollback no-broadcast; duplicate send/idempotency behavior.
- **Frontend:** inbox/unread; conversation pagination; send pending/failure; incoming broadcast merge; duplicate-event reconciliation; reconnect/refetch; forbidden/not-found; responsive/accessibility behavior.
### Risks
- **Cross-conversation leak:** weak participant scoping can expose private messages.
- **Role overreach:** generic messaging can accidentally let Buyer discover/contact all Admin/Courier/Logistics accounts.
- **Broadcast-before-commit:** UI may display messages that later roll back.
- **Duplicate messages:** optimistic response + HTTP response + broadcast can create multiple copies.
- **Missed events:** treating WebSockets as the only source loses messages during disconnects.
- **Unread drift:** local-only read state can become inconsistent across devices.
- **XSS:** rendering message bodies as raw HTML can execute malicious content.
- **Abuse/flooding:** unrestricted send rates or payload sizes can exhaust real-time infrastructure.
- **Privacy:** raw participant records can leak personal contact/account data.
- **Scope growth:** attachments, typing, presence, editing, reactions, calls, and moderation can rapidly expand MVP.
### Open questions
- One Buyer ↔ Seller thread per pair vs context-specific/multiple conversations.
- Exact product/order context schema.
- Whether Buyer may initiate Admin support chats.
- Whether Buyer may initiate Courier/Logistics chats or only respond to active order threads.
- Message maximum length.
- Sender-visible "Seen" receipts.
- Typing indicators/presence.
- Image attachments in MVP or future.
- Message edit/delete/unsend behavior.
- Chat retention/archive duration.
- Offline email/push notification behavior.
- Per-account send/connection rate limits.
- Selected broadcast driver (Reverb/Pusher/Ably/etc.).
- Whether blocked/suspended Sellers can continue existing support conversations.
- Abuse reporting/blocking controls.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture contract: `README.md`
- Buyer feature model: `Buyer.md`
- Seller feature model: `Seller.md`
- Admin feature model: `Admin.md`
- Courier feature model: `Courier.md`
- Logistics feature model: `Logistics.md`
- Laravel Broadcasting 12.x: https://laravel.com/docs/12.x/broadcasting
- Laravel Sanctum 12.x: https://laravel.com/docs/12.x/sanctum
- Laravel Queues 12.x: https://laravel.com/docs/12.x/queues
- OWASP WebSocket Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html
