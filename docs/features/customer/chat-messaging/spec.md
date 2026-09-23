---
feature: chat-messaging
title: Customer Chat with Seller
system: AISLEY
type: Feature Specification
version: 2.0
status: First-release shared text chat implemented; PostgreSQL/browser verification and retention policy pending
role: Customer
scope: Customer Next.js storefront and shared Laravel messaging domain
---

# Customer Chat / Messaging

## WHAT

- Let an authenticated Customer ask a Shop about a visible Product or an Order and continue the conversation in a private in-app inbox.
- Shopee's [buyer chat guidance](https://help.shopee.ph/portal/4/article/82308-%5BChat%5D-How-do-I-chat-with-sellers) is a UX reference for a **Chat** entry point on a Shop and product/order questions; it is not a claim that AISLEY has Shopee's transport or policies.
- The Shop is the conversation's public identity; the private Seller account is an authorization subject, not a displayed contact profile.
- AISLEY has Product Q&A, Customer/Seller notifications, Shop/Product pages, Order Detail, one shared conversation/message store, role-scoped chat APIs, and Customer/Seller inbox and thread pages.
- This Customer spec owns initiation, inbox, thread, composer, unread state, and Customer-facing error behavior. The same shared conversation/message records must serve the Seller's authorized reply UI.
- **MVP:** one text conversation per Customer and Shop, with optional Product/Order context on a message. Reopening Chat from another Product or Order reuses that thread.
- Customer ↔ Admin, Courier, or Logistics chat uses future role-owned initiation rules; this feature does not grant unrestricted contact with those roles.
- Product Q&A stays public and Product-scoped. Chat is private; it cannot change Orders, Inventory, delivery status, refunds, or complaint decisions.
- Existing order tracking and seller-help links remain authoritative. A chat statement is not evidence that a delivery, refund, or policy action was committed.
- No guest chat, file/image attachments, calls, typing indicators, online presence, message edits/deletion, AI replies, or WebSocket dependency in the first release.

## MUST

### Access and relationship

- All chat reads/writes require the existing `auth:sanctum`, active `customer` role, and policy-consent gate. Laravel derives the sender; no client-supplied `user_id`, `seller_id`, role, timestamp, or participant list is trusted.
- Starting a pre-sale chat requires an active, publicly available Shop. If launched from a Product, it must belong to that Shop and pass current storefront visibility, including compliance restrictions.
- Starting an Order chat requires an Order owned by the Customer with an Item from that Shop. A multi-Shop Order does not authorize contact with unrelated Shops.
- Server resolves the Seller from the Shop and checks active/approved access. A Seller may read/reply only while authorized for that same Shop; another Seller or Customer cannot guess a conversation UUID.
- If the Seller loses authorized dashboard access, keep the Customer's history readable but disable new sends with an explanatory unavailable state until policy permits contact again.
- Existing history stays readable to its authorized Customer if a Product is later archived or the Shop enters vacation mode; new replies follow the current account/status rules. An unavailable context renders a safe placeholder.
- Do not expose addresses, registration evidence, phone/email, payment secrets, private media paths, or unrelated Order items in participant/context DTOs.

### Thread and message rules

- Proposed MVP uniqueness is one `(customer_user_id, shop_id)` conversation. Concurrent first messages must create one thread, not parallel duplicates.
- A Chat click opens the composer; persist a new conversation only when the first valid message is sent. Repeated clicks alone create no empty threads.
- Starting from an Order reuses the Shop thread even when the Customer bought from several Shops in one Checkout; the selected Shop/Order relationship must be checked on every new context card.
- A message has a server UUID, conversation ID, authenticated sender ID, plain-text body, server time, and monotonically increasing per-thread sequence.
- A Seller reply uses the same sequence and history. It must not create a parallel Seller-only conversation.
- Validate trimmed nonempty text up to 2,000 characters. Render as text, never HTML/MDX; reject unsupported attachments in the first release.
- An optional Product or Order context reference is attached to the **message**, not used as a new conversation identity. Validate its Customer/Shop ownership at send time.
- The server persists the message and thread activity atomically. A failed transaction produces no successful message, unread increment, or notification.
- Require a UUID `Idempotency-Key` per send. Exact retries return the original message; key reuse with different content returns `409`.
- Sort by server sequence and paginate history with a bounded cursor; merge HTTP and optional future live events by message ID, without duplicates.
- A missing/deleted historical context must not break pagination or reorder the surviving messages.
- A recipient's unread count derives from persisted messages after their own monotonic `last_read_sequence`. Mark-read cannot move backward or mark another participant's messages read.
- Only messages from the other participant count as unread; sending your own message cannot increase your badge.
- Mark-read may advance only to a message already in the authorized thread, never to a client-invented sequence beyond the latest committed message.
- Retain historical text when a participant clears a local view; no hard-delete/unsend or shared-history purge is included until retention and moderation policy is approved.

### Delivery and notifications

- Initial delivery uses persisted HTTP APIs with bounded polling while the inbox/thread is visible, plus refetch on focus/reconnect. Pause polling while hidden or offline. Do not claim instant realtime.
- A later private broadcast channel may accelerate updates but cannot replace persistence, membership authorization, or missed-message refetch.
- If a private channel is added later, it must authorize membership on subscribe and publish only safe conversation DTOs. No public channel may carry chat text.
- Message commit is authoritative even if an after-commit notification/broadcast fails. Any optional message notification must be deduplicated by recipient and message ID.
- Chat unread state is separate from the Customer's existing general notification read state. Do not send SMTP, SMS, or mobile push for every message by default.
- If a general in-app alert is approved later, it may link to the thread but must not become the source of chat history or unread counts.
- Seller reply capability and safe Seller inbox are a release dependency; do not launch a one-sided Customer composer that no Seller can answer.

### Privacy and misuse

- Throttle conversation starts and sends per authenticated account; return `429` without changing persisted history.
- Do not expose an arbitrary user search, recipient picker, Seller email/phone, or raw Shop-owner ID in the Customer composer.
- Log safe message/conversation IDs, actor, outcome and timing for operations; do not log message bodies by default.
- Admin has no automatic right to inspect private chats. Any report/review access needs an approved complaint or moderation contract and audited scope.
- Message retention, abuse reporting, and participant-level archive/mute controls are deferred decisions; no invisible purge or cross-participant deletion is authorized by this spec.

### Customer experience

- Put **Chat** on an eligible Shop page, **Message Seller** on a visible Product Detail, and **Contact Seller** on an owned Order Detail; each resolves the same Shop thread. Do not replace public Product Q&A.
- `/messages` shows paginated Shop-labeled threads, last safe text preview, latest activity, and persisted unread counts. `/messages/{conversation}` shows bounded history, optional context cards, and composer.
- Product/Order context cards link through their owning route and recheck visibility/ownership. A missing Product shows “Product unavailable,” not private metadata.
- Show explicit loading, empty, sending, sent, validation, retry, forbidden/not-found, offline and stale-session states. On uncertain timeout, retry with the same key before composing a new message.
- Keep a pending draft in the current browser while retrying, but do not label it “sent” until Laravel returns the committed message.
- An unread badge links to `/messages`; opening one thread clears only that thread's authorized unread state.
- The Customer UI follows the light storefront design, mobile-first layout, semantic message list, labeled controls, keyboard focus, and non-color-only unread indicators; new text does not steal focus or force scroll while reading older messages.

### Acceptance criteria

- [ ] Guests and other roles cannot use Customer chat endpoints; one Customer cannot list, read, send, or mark read in another Customer's thread.
- [ ] Shop/Product/Order entry points resolve the correct Seller server-side; forged, invisible, cross-Shop, or unowned context is rejected.
- [ ] Two concurrent first sends and exact retries create one Customer-Shop conversation and one copy of each intended message.
- [ ] Sender, sequence, timestamp, recipient, and read state are server-controlled; empty/oversized/HTML-like text is safely rejected or displayed as text.
- [ ] Inbox/history pagination and unread counts reconcile across refreshes and devices; stale read updates never move backward.
- [ ] A committed message survives notification/polling failure, and a rolled-back send creates no visible success or recipient alert.
- [ ] Seller can reply through the shared authorized domain before Customer chat is enabled; no private Shop, Customer, or Order data leaks.
- [ ] A suspended Seller cannot newly receive/send while the Customer can still read the permitted historical thread.
- [ ] Customer screens handle unavailable contexts, offline/timeout, 401/403/404/409/422/429, keyboard use, and narrow viewports.

## HOW

- Add additive UUID-backed `conversations`, `conversation_participants`, and `messages` tables; never create separate Customer and Seller message stores.
- Enforce unique `(customer_user_id, shop_id)`; record immutable initiating Customer and Shop/Seller association. Participant rows have unique `(conversation_id, user_id)` and `last_read_sequence`.
- Shop ownership changes are not an MVP operation. A future transfer must not automatically grant a new Seller access to historical private chat.
- Under a conversation lock, allocate the next message sequence, persist the message, and update last activity. Add unique `(conversation_id, sequence)` and sender/idempotency constraints plus indexes for participant inbox and cursor history.
- Store nullable, validated `product_id`/`order_id` message references, not full Product or Order JSON. Serialize role-safe current context; historical unavailable records become placeholders.
- Return thread ID, Shop public name/slug, safe last-message preview, last activity, unread count and pagination cursor in the inbox; do not return a User model.
- Implemented Customer API under `/api/v1/customer/conversations`:
  - `GET /`: cursor-paginated inbox and unread summaries.
  - `POST /`: first message plus exactly one Shop/Product/Order entry context; returns existing-or-created thread and message.
  - `GET /{conversation}` and `GET /{conversation}/messages`: participant-scoped detail and cursor history.
  - `POST /{conversation}/messages`: text, optional validated context, `Idempotency-Key`.
  - `POST /{conversation}/read`: advance caller's marker to a server-known sequence.
- Seller-side reply endpoints and UI use the same shared authority; the Seller Chat spec was revised for this text-only first release.
- Customer and Seller route namespaces may differ, but both must call the same conversation/send/read authority and persist the same thread/message IDs.
- Form Requests validate text/context/cursors; policies scope each read/mutation to actual participants and current Shop ownership. Resources return only safe Shop identity and minimal context.
- Return `401` unauthenticated, `403` wrong role/status, scoped `404` for foreign/missing thread, `409` for idempotency conflict, `422` invalid input, and `429` rate limit.
- Use after-commit jobs only for optional recipient alerts; a failed job never rolls back a saved message. [Laravel queue guidance](https://laravel.com/docs/12.x/queues#jobs-and-database-transactions) supports this boundary.
- Test SQLite and PostgreSQL authorization, two-worker initiation/send races, forged contexts, retries, sequence/read monotonicity, pagination, status/vacation changes, and notification failure.
- Test repeated Product/Shop/Order entry into one Shop thread, multi-Shop Order separation, archived Product placeholder, and suspended Seller read/send boundary.
- Test Customer and Seller UI entry points, empty/history/unread states, timeout retry, accessibility, and no duplicate messages after focus/refetch. Keep private responses `no-store`.
- Roll out behind the shared API/Seller reply readiness gate. Decide message retention and abuse-reporting ownership before production release; do not invent a blanket Admin read privilege.
- Remove or disable the existing storefront `/messages` header link until the real route is available, then route it to the protected inbox rather than a 404.
