---
feature: logistics-chat-messaging
title: Logistics Operational Chat
system: AISLEY
type: Feature Specification
version: 2.0
status: Logistics–Courier task chat, Customer–Logistics Order chat, and Seller–Logistics pickup chat implemented
role: Logistics
scope: Laravel API, Logistics React dashboard, and role-owned Customer/Seller/Courier entry points
---

# Logistics Chat / Messaging

## WHAT

- Provide private, text-only operational chat between one Logistics organization and a relevant
  Seller, Courier, or Customer (called “Buyer” in the storefront). Each side may initiate and
  reply while its current relationship is authorized; Logistics is not the only initiator.
- Seller contact is tied to a Seller-owned pickup request selecting that Logistics organization.
  Courier contact is tied to an active offered or accepted first-/final-mile task for that Courier
  and organization. Buyer contact requires an active Customer account and an owned, nonterminal
  Order currently handled by that organization.
- A separate bilateral thread is created for each counterparty and operational context. A Seller,
  Courier, and Buyer do not join one group thread or each other's private conversations. Chat does
  not add Logistics to the implemented Customer–Shop thread.
- The existing Customer–Seller feature has persisted conversations, messages, unread markers,
  idempotent sends, bounded polling, and Customer/Seller screens. An additive extension now
  permits separate Logistics–Courier task threads without changing those Customer–Shop records.
  Customer–Logistics Order chat and Seller–Logistics pickup chat are also implemented as distinct kinds.
- Messages coordinate pickup, delivery, routing, and address clarification. They are not Order
  status changes, Courier offers/acceptance, scan validation, proof of delivery, Address Book
  edits, support decisions, or Admin campaigns.
- MVP excludes group chat, guest access, files/images, location sharing, calls, typing/presence,
  message edits/deletion, public broadcasting, and a new third-party messaging provider.
  Persisted HTTP plus bounded polling is sufficient.

## MUST

### Relationship and access

- Require `auth:sanctum`, the current active role/account gate, and any applicable policy-consent
  gate on every role route. Resolve sender, organization, hub, role, counterpart, and context from
  authenticated server records, never from client-supplied authority fields or matching emails.
- Logistics may list/read/send only threads belonging to its own organization and sole operational
  hub. There is no separate hub account and no cross-organization inbox. Another organization's
  account receives a scoped `404` for guessed thread/context IDs.
- Seller may initiate from its own selected-Logistics pickup request and reply only while that
  Seller, Shop, request, and organization remain related. Orders within a grouped pickup request
  do not grant access to another Seller's conversation.
- Courier may initiate or reply only while approved and affiliated with that organization **and**
  holding an active offered or accepted task for it. An affiliation alone, a completed task, a
  rejected/expired offer, or another Courier's task does not authorize new messages.
- Buyer may initiate or reply only from an owned Order while the Customer account is active, the
  Order is not terminal, and this Logistics organization is its current authorized handler. An
  active account without a related Order cannot contact arbitrary Logistics organizations.
- Resolve current handler from authoritative pickup/shipment custody records; a Seller's selected
  origin organization does not automatically retain Buyer-contact rights after an authorized
  linehaul handoff. A later handler gets a distinct thread, not the previous organization's history.
- On cancellation, delivery, relationship loss, task rejection/completion, or custody transfer,
  preserve authorized historical messages but stop new sends for the former relationship.
  Historical read access is limited to actual participants and safe context; never transfer an old
  thread to a new Courier or Logistics organization.
- Logistics may start a thread only for the same eligible Seller, Courier, or Buyer/context pair.
  Do not expose arbitrary user search, raw user IDs, unrelated Orders, other Shops, other Couriers,
  or Customer–Seller message history.

### Thread and message behavior

- Start a thread on the first valid send; opening an entry point alone creates no empty thread.
  Uniqueness is per Logistics organization, context type/ID, counterparty role, and counterparty
  user, so concurrent first sends cannot create duplicates.
- Keep one ordered, immutable message history per thread with server UUID, sender, server UTC time,
  and monotonically increasing sequence. Trim nonempty plain text to the shared 2,000-character
  limit; render as untrusted text, not HTML/MDX.
- Require a UUID `Idempotency-Key` for every send. Under a thread lock, persist one message and
  activity update; exact retries return the original result, while reuse with different
  content/context returns `409`.
- Persist participant-specific monotonic read markers. Only messages from the other side after
  the caller's marker count as unread; one role's read action never marks another role's messages
  read.
- Bound inbox and history pagination with stable cursors. Private responses use `no-store`; do not
  label a timed-out send successful until the authoritative response or retry confirms persistence.
- Chat unread is separate from general role notifications. Optional after-commit in-app alerts may
  link to a thread and must deduplicate by recipient/message; alert failure cannot undo a committed
  message or make notification rows the chat source of truth. Do not send SMTP, SMS, or push for
  every message by default.
- Rate-limit starts and sends; log message IDs, actor, outcome, and timing without body by default.
  Do not expose addresses, phone/email, payment secrets, private evidence, raw paths, or unrelated
  Order items in thread DTOs. Show only the minimum task/Order context needed by that participant.
- Admin has no automatic private-chat read privilege. Moderation, retention/deletion, abuse
  reporting, and exceptional access need separate approved policy before production release.

### Role experience and failure states

- Logistics dashboard has an organization-scoped inbox, unread count, context-linked entry from pickup/task/Order detail, thread history, and text composer. Distinguish Seller, Courier, and Buyer threads with safe labels and operational references.
- Seller opens **Contact Logistics** from its selected pickup request; Courier opens **Contact Logistics** from its active task in the external Flutter app; Buyer opens **Contact Logistics** from an eligible owned Order/tracking page. No Courier web UI is added to this repository.
- Poll only visible/online inbox or thread views and refetch on focus/reconnect. Preserve a local draft and its idempotency key after an uncertain timeout; never silently queue offline mutations.
- Show loading, empty, sending, saved, read-only, relationship-ended, validation, unauthorized, scoped not-found, conflict, throttling, timeout, and offline states. Screens are responsive, keyboard accessible, and use role-appropriate design; unread is not conveyed by color alone.
- Return `401` for missing session, `403` for inactive/wrong role or required policy consent using the existing auth contract, scoped `404` for foreign/missing context or thread, `409` for idempotency/state conflict, `422` for invalid input, and `429` for throttling. Do not leak relationship existence through error detail.

### Acceptance criteria

- [x] Seller and Logistics can each initiate/reply for that Seller's selected pickup request; another Seller or Logistics organization cannot read or create the thread.
- [ ] An approved affiliated Courier with an active offered/accepted task can contact the owning Logistics organization; affiliation alone, a rejected/completed task, or a forged task cannot start or continue chat.
- [x] An active Customer with an owned nonterminal Order can contact its current handling Logistics organization; guests, inactive accounts, unrelated Orders, and prior/other organizations cannot.
- [x] Bilateral operational threads remain separate from each other and from Customer–Shop chat; no role gains a global messaging inbox or access through a guessed UUID.
- [ ] Concurrent starts, sends, and exact retries yield one logical thread/message; changed-payload key reuse conflicts and read markers never regress.
- [x] Lifecycle changes make the former relationship read-only without deleting authorized history or exposing it to a new Courier/organization.
- [ ] Paginated history, participant unread, private caching, safe DTOs, plain-text rendering, and timeout/offline retry behavior pass API and role-UI checks.
- [ ] Notification failure cannot roll back a committed message; private bodies do not appear in normal logs or unrelated notifications.
- [ ] SQLite and PostgreSQL tests cover tenant/role IDOR, first-send and send concurrency, task/order relationship races, handoff, terminal-state gating, pagination, and idempotency.

## HOW

### Shared backend and rollout

- The existing UUID `conversations`, `conversation_participants`, and `messages` tables now also store Logistics–Courier task, Customer–Logistics Order, and Seller–Logistics pickup conversations. Customer–Shop uniqueness and behavior are retained.
- Additive extensions use a string-backed conversation kind, organization/hub/task/Courier identity for task chat, a nullable Order FK plus unique `(logistics_organization_id, order_id, customer_user_id)` for Customer delivery chat, and a nullable Seller pickup request FK plus unique `(logistics_organization_id, seller_pickup_request_id, seller_user_id)` for Seller pickup chat. No second message store is introduced.
- Form Requests validate starts/sends; `OperationalConversationService` owns relationship checks, locking, idempotency, sequence/read state, and lifecycle gating. Optional per-message alerts are not enabled.
- The Logistics–Courier task, Customer–Logistics Order, and Seller–Logistics pickup channels use the role-scoped, versioned routes below. Focused SQLite/PostgreSQL API tests and a Customer/Logistics browser exchange passed for the prior channels; Seller pickup two-worker races and role-browser verification remain release checks.

| Role route family | Actions | Start context, server-resolved |
| --- | --- | --- |
| `/api/v1/logistics/operational-conversations` | `GET /`, `POST /`, `GET /{id}`, `GET /{id}/messages`, `POST /{id}/messages`, `POST /{id}/read` | Implemented for selected Seller pickup requests, eligible Courier tasks, and currently handled Customer Orders, in one role-scoped operational inbox |
| `/api/v1/seller/logistics-conversations` | Same list/start/detail/history/send/read actions | Implemented for Seller-owned pickup request |
| `/api/v1/courier/operational-conversations` | Same list/start/detail/history/send/read actions | Implemented for Logistics on an active offered/accepted task, Seller on an accepted first-mile task, and Buyer on an accepted final-mile task; Seller/Buyer counterpart screens remain deferred |
| `/api/v1/customer/logistics-conversations` | Same list/start/detail/history/send/read actions | Implemented for owned active Order with current handler; separate `/delivery-messages` storefront UI |

- Start accepts only a context type/UUID, text body, and UUID `Idempotency-Key`; server resolves the counterpart and returns the committed thread/message. Send accepts body and key; history/list accept bounded cursor/limit; read accepts a server-known sequence. Responses contain thread/message UUIDs, safe context summary, sender role, sequence, timestamps, unread count, read-only reason, and next cursor; never participant authority or raw model data.
- Recheck current relationship at start/send/read and scope inbox/history to historical participants. If an offer or Order relationship changes between check and commit, abort or return a read-only/conflict response without persisting a new message. A prior sender may retain only authorized historical read access.
- Existing Customer–Seller endpoints and pages keep their contract; their queries explicitly filter `customer_shop` kind. Customer Order Detail opens the separate delivery inbox; Logistics parcel detail opens its operational inbox with Order context. Seller Pickup Requests and Logistics Pickup Detail open their respective inboxes with pickup request context. Courier Flutter consumes only explicitly implemented API routes and its copied contract.
- Courier–Seller and Courier–Buyer use separate task-scoped kinds and Seller/Customer route families; those conversations do not join the Logistics inbox. Their Laravel APIs exist, while the Seller/Customer counterpart screens and Flutter chat remain unverified or unimplemented.
- Test shared migration/backfill, old Customer–Shop regression, two-worker PostgreSQL races, role/tenant isolation, and notification failure before enabling route families. Verify Logistics React and external Flutter states against live API; polling is acceptable without a realtime provider.
- Implemented “active Buyer” means an active Customer account **and** an owned, nonterminal Order with a current Logistics handler resolved from Shipment custody or the selected Waybill before Shipment creation. In-transfer custody has no sendable handler; a later handler receives a new thread while the former participants retain read-only history.
- Open production-policy decision: approve private-message retention, abuse reporting, and audited exceptional access. Until then, do not invent message purging or Admin transcript access.
