---
feature: chat-messaging
title: Seller Chat / Messaging
system: AISLEY
type: Feature Specification
version: 2.0
status: First-release shared text inbox/reply implemented; PostgreSQL/browser verification pending
role: Seller
scope: Seller React dashboard and shared Laravel messaging domain
---

# Seller Chat / Messaging

## WHAT

- An approved Seller can read and reply to private Customer conversations for the Shop they currently own. This is the Seller-side release dependency of [Customer Chat/Messaging](../../customer/chat-messaging/spec.md).
- One Customer–Shop conversation and its messages serve both role apps. Seller replies do not create a Seller-only thread or separate message store.
- The first release is persisted **text** over authenticated HTTP with bounded polling while the inbox/thread is visible. It is not instant realtime. Attachments, broadcasting, Seller-initiated outreach, archive/mute/report, typing, presence, and message deletion are deferred.
- Product Q&A remains public and Product-scoped. Chat remains private and cannot change an Order, refund, delivery, or complaint decision.

## MUST

### Access and tenant boundaries

- All Seller chat routes require `auth:sanctum`, `seller.active`, and policy consent. Laravel derives the sender. Do not accept client-supplied Seller ID, Customer ID, participant list, sequence, read state, or timestamp.
- A Seller can list/open/read/reply only to conversations whose immutable `seller_user_id` is that Seller **and** whose Shop still belongs to that Seller. Guessing another conversation UUID returns a scoped `404`.
- A suspended Seller cannot access the Seller dashboard chat API. If Shop status becomes unavailable, the authorized Seller may read existing history but cannot send a new reply; the Customer retains their own history.
- A Shop ownership transfer is not an MVP operation. It must not silently grant a new Seller access to an old private conversation.
- Seller DTOs may show the Customer's profile display name, the Shop public name, safe context, last text preview, and unread count. They must not expose Customer email, phone, address, payment, evidence, or other-Shop Order items.

### Shared messages and read state

- Seller inbox uses the same UUID `conversations`, `conversation_participants`, and `messages` tables as Customer chat; `(customer_user_id, shop_id)` is unique.
- Message text is trimmed, nonempty, at most 2,000 characters, and rendered as untrusted text. Files, HTML rendering, and Markdown rendering are not supported in this release.
- Every send requires a UUID `Idempotency-Key`. Exact retries return the committed message; key reuse with different content or thread returns `409`. Laravel allocates a monotonically increasing per-thread sequence under the conversation lock.
- Seller can advance only their own `last_read_sequence` to a committed message in that thread. Stale read requests never move it backward. Only Customer-authored messages after that marker count as Seller unread.
- Inbox and history use bounded cursor pagination, private `no-store` responses, and persisted unread counts. A message is not labelled sent until the API confirms persistence.
- The Customer may attach a validated Product/Order reference to a message. Seller sees only currently safe context; an archived Product is shown as unavailable. A Seller reply in the first release is text-only.

### Delivery and UI

- Seller dashboard has a Messages sidebar link, inbox, thread history, and reply composer. Poll visible/online views and refetch on focus/reconnect. Reconcile by server message ID and preserve the draft/idempotency key after an uncertain timeout.
- Show loading, empty, older-history, sending, saved, validation, unavailable, forbidden/not-found, offline, retry, and disabled-send states. Controls must be keyboard-operable and responsive in both light and dark modes.
- Chat unread is separate from the general Seller notification inbox. No email/SMS/push per message is sent by default. A future broadcast or notification must follow committed persistence and must not become chat history's source of truth.
- Return `401` for no session, `403` for wrong role/status, scoped `404` for foreign/missing thread, `409` for conflicting send state/key, `422` for invalid input, and `429` for rate limits.

### Acceptance and release gates

- [x] Customer and Seller share a single private, Shop-scoped conversation/message store and can send/reply through role-gated APIs.
- [x] Text sends use server sequence and UUID idempotency; persisted participant markers derive unread counts independently of general notifications.
- [x] Seller React provides inbox, history, reply, polling, retry, and light/dark states.
- [ ] Verify PostgreSQL two-worker first-send and concurrent send races, migration rollback, and scoped authorization.
- [ ] Verify Customer/Seller browser interaction, narrow viewport, focus/reconnect, and uncertain timeout retry before production release.
- [ ] Decide retention and abuse-reporting ownership before a production policy declares how long private message text is kept.

## HOW

- Seller routes under `/api/v1/seller/conversations`: `GET /`, `GET /unread-count`, `GET /{conversation}`, `GET /{conversation}/messages`, `POST /{conversation}/messages`, and `POST /{conversation}/read`. Customer initiation and the matching Customer route family are owned by the Customer spec.
- Shared `ConversationService` owns membership, status, Shop relationship, validated context, transactional sequence and idempotency, read marker, and safe projections. Role controllers only delegate into this authority.
- Seller `/messages` and `/messages/:conversationId` use the existing React Router dashboard and authenticated API client; no Courier web UI is introduced.
- Database fields are UUID-backed with string-independent message state; all schema changes are additive. Tests use SQLite now and require a disposable PostgreSQL concurrency pass before release.
- Do not infer permission for Seller-started outreach, attachments, private broadcast channels, archive/mute/report, or Admin private-chat reading from this MVP. These need separate approved contracts and verification.
