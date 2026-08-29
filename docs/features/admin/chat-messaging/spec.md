---
feature: chat-messaging
title: Admin Chat / Messaging
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Admin
scope: Admin Web Application
---

# Admin Chat / Messaging

## WHAT

- **Purpose:** Secure, persistent Admin ↔ user messaging for support, account inquiries, compliance actions, and related platform communication.
- **Primary actor:** Authenticated `ADMIN`.
- **Participants:** Authorized Buyer, Seller, Courier, or Logistics accounts.
- **Source-defined Admin behavior:**
  - initiate/respond to user conversations
  - handle support and account anomalies
  - explain compliance/moderation actions
  - send seller-compliance warnings
  - support read receipts
  - archive history for accountability
- **Shared-domain requirement:** Buyer, Seller, Courier, and Logistics also use messaging; Admin Chat must use the same messaging domain, not a separate Admin-only store.
- **Architecture:**
  - Next.js/React: inbox, conversation UI, composer, unread/read presentation, real-time subscriptions.
  - Laravel: authentication, authorization, validation, persistence, pagination, read state, events, broadcasting.
  - Laravel data is authoritative; broadcasts synchronize committed state.
- **Recommended flow:**

```text
open
→ fetch persisted history
→ authorize
→ subscribe private channel

send
→ POST to Laravel
→ validate + authorize
→ persist
→ commit
→ broadcast

read
→ persist read marker
→ broadcast read update
```

- **Recommended routes:** `/messages` and `/messages/{conversation}`.
- **MVP:** text messages.
- **Optional context:** existing order, complaint/dispute, or compliance-case relationship when supported by the real schema.
- **Non-goals:** public rooms, anonymous chat, voice/video, blanket Admin surveillance, reactions, editing, hard deletion, arbitrary attachments, AI replies.

## MUST

### Authorization

- Every messaging API and private broadcast channel requires authentication.
- Admin actions require:
  - authenticated `ADMIN`
  - Chat/Messaging permission where configured
  - authorization for the target conversation/user/context
- Sender identity comes from the authenticated account.
- Never trust client-submitted sender ID, role, permission, timestamp, or read state.
- Check authorization for:
  - conversation list/detail
  - message history
  - send
  - mark read
  - channel subscription
  - attachment access if later added
- Guessed conversation IDs must not expose data.
- Frontend guards are UX only.
- Use project error conventions: `401`, `403`, `404`, `422`, `409`.

### Admin scope

- Admin may initiate/respond to authorized Admin-user threads for support, account inquiries, and compliance communication.
- Seller Compliance may reference an Admin ↔ Seller warning conversation.
- Complaint/dispute flows may reference relevant Admin-user messages when explicitly linked.
- Current sources do **not** grant Admin blanket access to unrelated Buyer ↔ Seller/Courier/Logistics conversations.
- Do not implement global chat surveillance without a separate authorization/privacy requirement.

### Shared data model

- Minimum conceptual entities:

```text
conversations
conversation_participants
messages
```

- Participants reference the shared authenticated user/account record.
- Conversation requires:
  - immutable server ID
  - participant membership
  - created timestamp
  - updated/last-message ordering value
- Message requires:
  - immutable server ID
  - conversation ID
  - authenticated sender ID
  - body
  - server-created timestamp
- Participant rows must be unique.
- Optional context may reference order, complaint/dispute, or compliance case only when those schemas exist.
- Whether one canonical Admin-user thread or multiple threads are allowed is open.

### Message validation and ordering

- Validate message body server-side.
- Reject empty/whitespace-only messages.
- Define a server-side maximum length.
- Render user text safely; do not trust it as HTML.
- Order messages using server-generated IDs/timestamps, never client clock alone.
- Persist before broadcast.
- Broadcast failure must not roll back a committed message.
- Apply the project idempotency/duplicate-submit mechanism to sends.

### History

- Admin source requires archived history.
- History must be paginated with stable ordering.
- Real-time events must merge without duplicating paginated messages.
- MVP must not expose hard deletion of Admin-user messages.
- Retention duration is open.
- If deletion is introduced later, it must preserve dispute/compliance/accountability rules.

### Read receipts

- Persist read state in Laravel.
- Recommended representation:

```text
conversation_participants.last_read_message_id
conversation_participants.last_read_at
```

or equivalent.

- Unread counts derive from backend state.
- Users may mark only authorized conversations as read.
- Read marker must reference a message in the same conversation.
- Read state is monotonic; stale clients cannot move it backward.
- Persist before broadcasting read-state changes.

### Inbox

- Admin inbox must be paginated.
- Safe summary fields may include:
  - conversation ID
  - other participant display identity
  - optional context summary
  - last-message preview
  - last-message timestamp
  - unread count/status
- Filters/sorts must be allow-listed.
- Sensitive profile/contact data follows project masking rules.

### Start conversation

- Admin may start a thread only with an existing authorized account.
- Conceptual endpoint:

```http
POST /api/messages/conversations
```

- Request may contain target account ID, supported context, and optional first message.
- Laravel resolves the target and authorizes contact.
- Reject invalid/self/duplicate combinations according to selected thread rules.
- Do not expose unrestricted user-directory data just to support chat.

### Send message

- Conceptual endpoint:

```http
POST /api/messages/conversations/{conversation}/messages
```

- Conceptual request:

```json
{ "body": "Message text" }
```

- Backend sequence:
  1. authenticate
  2. scope/load conversation
  3. authorize
  4. validate
  5. persist message
  6. update conversation metadata if used
  7. commit
  8. broadcast/notify after commit

### Real-time delivery

- Use Laravel broadcasting consumed by React.
- Use an authorized **private** channel per conversation or equivalent secure scheme.
- Never broadcast private message content on public channels.
- Channel authorization must verify conversation access.
- Broadcast only safe message DTO fields.
- Recommended events:
  - `MessageSent`
  - `ConversationRead`
- Presence and typing indicators are not MVP requirements.
- Do not assume Reverb/Pusher/Ably until repository configuration confirms the driver.

### Real-time security

- Production WebSockets use `wss://`.
- Restrict allowed origins.
- Socket authentication does not replace authorization of messaging mutations.
- Apply message-size, send-rate, and connection limits.
- Do not log full private message bodies in infrastructure/security logs by default.
- Session/token invalidation must stop unauthorized private-channel access.

### Notifications

- A committed message may update:
  - open conversation
  - inbox summary
  - unread count
  - shared platform notification
- Notification/broadcast failure must not undo message persistence.
- Email/SMS/push for each chat message is not required.

### Attachments

- Attachments are not required by the Admin source.
- If later enabled:
  - Laravel-authorized upload
  - type/size validation
  - malware scan
  - configured external storage
  - asset references instead of server paths
  - authorized/signed access

### Audit and privacy

- Chat history provides accountability.
- Security-sensitive Admin chat actions may also write safe audit metadata:
  - Admin ID
  - conversation ID
  - message ID
  - action
  - timestamp
- Do not duplicate full private message bodies into immutable Admin audit logs unless policy requires it.
- Never log auth secrets or private signed URLs/tokens.

### Frontend states

- Inbox: loading, empty, loaded, error, forbidden.
- Conversation: loading, older-history loading, loaded, sending, validation error, send failure, disconnected/reconnecting.
- Prevent/reconcile duplicate sends.
- Optimistic messages, if used, must reconcile to the authoritative server message ID.
- Reconnect must refetch enough state to recover missed messages.
- Loaded persisted history remains usable during temporary real-time disconnect.

### Accessibility

- Inbox, conversation, and composer require semantic labels and keyboard navigation.
- Read/unread state cannot rely on color alone.
- Incoming messages must not steal focus.
- Screen-reader announcements should avoid excessive interruption.

### Acceptance criteria

- [ ] Guest cannot access Admin Chat.
- [ ] Non-Admin cannot use Admin-only chat actions.
- [ ] Admin sees only authorized conversations.
- [ ] Admin can start an authorized user conversation.
- [ ] Admin can send a valid text message.
- [ ] Sender identity is server-derived.
- [ ] Empty/oversized messages are rejected.
- [ ] Message persists before broadcast.
- [ ] Broadcast failure does not remove committed message.
- [ ] Unauthorized conversation-ID access fails.
- [ ] Unauthorized private-channel subscription fails.
- [ ] Private message content is never broadcast publicly.
- [ ] History is paginated and stably ordered.
- [ ] MVP provides no hard-delete action for archived Admin-user messages.
- [ ] Read state is persisted and cannot regress.
- [ ] Unread state is backend-derived.
- [ ] Real-time events do not duplicate existing messages.
- [ ] Reconnect/refetch recovers missed messages.
- [ ] Direct API calls enforce conversation authorization.
- [ ] Admin receives no blanket access to unrelated user chats.
- [ ] Production real-time transport is secure and origin-restricted.
- [ ] UI covers loading, empty, forbidden, send-error, and disconnected states.

## HOW

### Project findings

- `Admin.md`: Admin messaging covers support, account anomalies, compliance explanations, read receipts, and historical archiving.
- Seller Compliance uses messaging for warnings.
- Buyer, Seller, Courier, and Logistics also define messaging, requiring a shared domain.
- Logistics explicitly mentions order-linked threads.
- Courier messaging emphasizes protecting user contact information.
- `README.md` selects Laravel broadcasting consumed by React and requires Laravel-owned authorization/validation, pagination, scoped data, and post-commit async work.
- Exact code, Eloquent schema, auth guard, and broadcasting driver were not available during research.

### Laravel model

Recommended conceptual schema:

```text
conversations
- id
- optional supported context reference
- created_at
- updated_at

conversation_participants
- conversation_id
- user_id
- last_read_message_id nullable
- last_read_at nullable

messages
- id
- conversation_id
- sender_user_id
- body
- created_at
```

- Use repository naming/types.
- Index participant lookup, ordered conversation messages, and unread calculations.
- Enforce unique conversation participant membership.
- Add domain context fields only when supported by actual order/complaint/compliance schemas.

### Laravel API

Conceptual API:

```http
GET  /api/messages/conversations
POST /api/messages/conversations
GET  /api/messages/conversations/{conversation}
GET  /api/messages/conversations/{conversation}/messages
POST /api/messages/conversations/{conversation}/messages
POST /api/messages/conversations/{conversation}/read
```

- Follow repository versioning/resource conventions.
- Use Form Requests and Policies/Gates.
- Suggested actions:
  - `StartConversation`
  - `SendMessage`
  - `MarkConversationRead`
- Scope records before returning/mutating.
- Use API Resources or equivalent safe DTOs.
- Use a transaction for message + conversation metadata changes.
- Broadcast/notify only after commit.

### Broadcasting

- Use the configured Laravel broadcasting driver.
- Recommended private channel:

```text
conversations.{conversationId}
```

- Authorize subscription against conversation access.
- For Sanctum SPA auth, use Laravel's authenticated private-channel authorization configuration.
- Broadcast a safe persisted DTO, not unrestricted Eloquent data.
- Configure transaction-dependent broadcasts to dispatch after commit.
- Reverb is a valid first-party option if the project has not selected a driver, but it is not mandatory.

### Next.js / React

- Build inbox, conversation history, and composer.
- Keep HTTP access in the shared API client.
- Use client components only where live subscription/composer state requires them.
- Flow:
  1. fetch persisted conversation/history
  2. render
  3. subscribe private channel
  4. reconcile incoming events by server message ID
- On reconnect, refetch recent state and deduplicate.
- Use server ordering values.
- Leave channels when conversation UI unmounts.

### Read-state implementation

- Client submits the highest message actually read.
- Laravel verifies participant access and conversation ownership of that message.
- Reject/ignore backward read markers.
- Persist then broadcast the read state.

### Tests

- **Laravel:** guest/non-Admin denial, conversation isolation, start-thread authorization, valid/invalid send, forged sender protection, pagination/order, read-state persistence/non-regression, unread counts, post-commit broadcast, rollback behavior, idempotent duplicate send, private-channel authorization, safe DTOs.
- **Frontend:** inbox states, history pagination, send/error states, incoming event, duplicate reconciliation, reconnect recovery, read/unread update, forbidden state, keyboard/accessibility behavior.

### Research-backed recommendations

- Use private Laravel broadcast channels with server-side channel authorization.
- Use secure WebSocket transport and explicit allowed origins.
- Treat message content as untrusted input.
- Apply size/rate limits.
- Persist first; broadcast after commit.
- Avoid logging full private message content.
- Prefer the repository's configured broadcasting driver; select Reverb only if the project chooses it.

### Risks

- **Privacy:** blanket Admin visibility exceeds the source scope.
- **Fragmentation:** separate role-specific stores break shared conversations.
- **Broadcast-before-commit:** clients could display rolled-back messages.
- **Channel leakage:** weak authorization can expose private chat.
- **Duplicates:** retries/reconnects can duplicate rows.
- **Read races:** stale tabs can regress read state.
- **History loss:** hard deletion conflicts with accountability.
- **Logging leakage:** message bodies may expose private user data.
- **Code gap:** exact models/routes/driver must follow the real repository.

### Open questions

- One canonical Admin-user thread or multiple threads.
- Maximum message length.
- Retention duration.
- Local archive/hide behavior.
- Attachments in MVP.
- Complaint/dispute evidence linkage.
- Automatic Seller thread for compliance warnings.
- Order linkage for Admin threads.
- Search/filter requirements.
- Presence/typing indicators.
- Delivery states beyond persisted/read.
- Offline notification behavior.
- Selected broadcasting driver.
- Exact rate/connection limits.

### Sources

- Project rules: `SKILL.md`
- Architecture contract: `README.md`
- Role models: `Admin.md`, `Buyer.md`, `Seller.md`, `Courier.md`, `Logistics.md`
- Laravel Sanctum private broadcast authorization:
  - https://laravel.com/docs/12.x/sanctum#authorizing-private-broadcast-channels
- Laravel broadcasting:
  - https://laravel.com/docs/11.x/broadcasting
- Laravel queues / after-commit:
  - https://laravel.com/docs/12.x/queues#jobs-and-database-transactions
- Laravel notifications:
  - https://laravel.com/docs/12.x/notifications#broadcast-notifications
- Laravel Reverb:
  - https://reverb.laravel.com/
- OWASP WebSocket Security Cheat Sheet:
  - https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html
