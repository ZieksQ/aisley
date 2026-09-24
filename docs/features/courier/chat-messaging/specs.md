---
feature: courier-chat-messaging
title: Courier Operational Messaging
system: AISLEY
type: Feature Specification
version: 2.1
status: Logistics, Seller, and Buyer task-scoped API channels implemented; Flutter and counterpart UIs deferred
implementation_status: All three Courier operational chat counterparts have Laravel routes; external Flutter and Seller/Customer screens are not implemented or verified
canonical: true
role: Courier
scope: Laravel API and external Flutter client
backend_contract_version: courier-operational-messaging-v2
---

# Courier Chat / Messaging

## WHAT

- Enable a Courier to exchange private, task-linked text with the relevant Seller, Buyer
  (`customer` in API), or Logistics organization while the relationship is active.
- First mile is Seller → the selected organization's sole hub; final mile is that hub → Buyer.
  Each leg has a separate task, and the same Courier need not perform both legs.
- Use separate bilateral conversations per task and counterparty; no group room, arbitrary
  recipient search, cross-task inbox, or access to Customer–Shop chat history.
- Courier may contact the Seller for an accepted first-mile task, the Buyer for an accepted
  final-mile task, and its owning Logistics organization for an active offered/accepted task.
  Logistics may initiate its Courier thread under the same task/organization relationship.
- The Laravel API has separate Logistics–Courier, Courier–Seller, and Courier–Buyer task
  channels using shared conversation, participant, and message records. Seller/Customer
  counterpart screens and the external Flutter client have not been updated or verified.
- Chat coordinates pickup, access instructions, and delays. It cannot accept/reject a task,
  confirm a scan or delivery, change an address/route, create an Incident or SOS alert, or
  approve a Logistics action. Those features remain authoritative.
- MVP is persisted plain text over authenticated HTTP with visible-screen polling. Masked
  calling, files/photos, voice, live location, typing/presence, realtime transport, SMTP,
  SMS, and mobile push per message are deferred.

## MUST

### Authorization and relationship

- Every Courier route requires `auth:sanctum`, `courier.active`, and `policy.consent`.
  Laravel rechecks the persisted `courier` role, active account, approved current
  affiliation, active Logistics organization, and its valid sole hub on every request.
- Resolve task, Order, leg, organization, hub, counterpart, and sender from server records.
  Never accept client authority for `courier_id`, `organization_id`, `hub_id`, `order_id`,
  recipient user ID, sender, role, status, timestamps, or membership.
- For `first_mile`, the start reference is a UUID from the implemented
  `/api/v1/courier/first-mile-tasks` list; map its legacy task to its shared DeliveryTask.
  For `final_mile`, use the UUID from `/api/v1/courier/final-mile-tasks`.
- A Seller thread requires that Courier's accepted first-mile task for a Seller Order/
  pickup request selected for its organization. It is sendable until Seller handoff
  `picked_up_from_seller`; an offer alone does not expose Seller chat.
- A Buyer thread requires that Courier's accepted final-mile task, an owned active Buyer
  account/Order, and the current handling organization. It is sendable before
  `delivered`; another Courier, Order, or organization cannot use it.
- A Logistics thread requires this Courier's active offered or accepted task and the
  organization/hub recorded for that task. Affiliation alone or a company-truck
  linehaul trip does not create a parcel-chat entitlement.
- An offered task permits Logistics contact only; accepted tasks permit the relevant
  leg's Seller or Buyer contact. A rejected/re-offered/completed task loses send access.
  A new Courier offer never inherits the previous Courier's conversation.
- Historical threads are read-only only while the Courier still passes the account/
  affiliation gate and remains an actual participant. Revocation, suspension, or
  deactivation blocks API access; no old thread is transferred to a new organization.
- The thread's immutable organization/task context is not silently changed when a
  Shipment later moves by linehaul. Each new leg/organization needs its own context.
- A guessed task, thread, message, or same-email account from another role/tenant
  receives a scoped denial without disclosing the foreign record.

### Thread, send, and read rules

- The first valid message lazily creates one conversation for the organization, task,
  Courier, and counterpart role/user. Opening a task screen creates no empty thread.
- The Logistics-side task-start action and Courier-side start action resolve to the
  same Courier–Logistics thread, never parallel role-specific histories.
- Trim nonempty body to 2,000 characters; store and render as untrusted plain text,
  not HTML or MDX. Message ID, sender, UTC time, and per-thread sequence are server-owned.
- Send requires a UUID `Idempotency-Key`; exact retry returns the original committed
  message. Reused key with different text/context returns `409`. A successful response
  means persistence, not merely a local optimistic bubble.
- Lock the conversation and recheck task/participant eligibility when creating or
  sending. Concurrent starts create one thread; task reassignment before commit
  prevents the former Courier's message from being persisted.
- Keep participant-specific monotonic `last_read_sequence`; only messages from the
  other party after that marker count as Courier unread. Read actions never mark
  another party's messages read or advance beyond a committed sequence.
- List/history use bounded cursor pagination, deterministic server sequence/order,
  and `Cache-Control: private, no-store`. Chat unread is distinct from the existing
  Courier notification inbox and its read markers.
- A committed message remains stored if optional after-commit in-app alert delivery
  fails. Deduplicate alerts by message and recipient; do not send SMTP/SMS/push for
  every message by default or use notification rows as chat history.
- Limit metadata to safe task reference, leg, counterparty role/display label,
  message preview, timestamp, unread count, and read-only reason. Do not copy full
  task DTOs, phone numbers, private proof/evidence, payment secrets, or raw blob paths.
- Gate codes or location clarifications typed into chat are sensitive: restrict the
  thread to participants, avoid message-body logging, and do not rewrite the
  Customer checkout/address snapshot based on text.
- Rate-limit start/send, log safe IDs/actor/outcome, and use private role-scoped
  projections. Admin has no automatic access to operational chat bodies.

### Flutter behavior and failures

- Courier token is returned once at login, stored only in OS secure storage, and sent
  as `Authorization: Bearer`. The client never infers approval from a cached task.
- Show **Message Logistics** on an active offered/accepted task; **Message Seller**
  appears only after first-mile acceptance; **Message Buyer** only after final-mile
  acceptance. Hide unavailable actions, but let Laravel make the final decision.
- A thread header names the task reference, `first_mile` or `final_mile`, and safe
  counterpart label to prevent messaging in the wrong Order context.
- Poll visible/online inbox or thread, refetch on focus/reconnect, and reconcile by
  server message UUID/sequence. Pause polling in background or offline.
- Preserve a pending draft and its idempotency key across an uncertain timeout;
  retry only the same intended send. Do not queue offline chat writes or claim
  success before the authoritative API response.
- Keep private message bodies in memory for MVP, not an unapproved persistent
  offline cache. Clear them and pending drafts on logout, account switch, loss of
  approval, or policy denial; refetch membership before showing old data.
- Show checking-session, loading, empty, sending, saved, read-only, forbidden,
  unavailable, validation, conflict, throttled, timeout, and offline states.
  Screen-reader labels identify sender/status; controls have accessible targets,
  keyboard focus, and no color-only unread indication.
- Handle `401` by clearing the session; `403` by showing status/consent gating;
  `404` as a scoped missing/foreign thread; `409` as a changed task or key conflict;
  `422` as field validation; `429` with retry guidance. No optimistic status edit.

### Acceptance criteria

- [ ] Courier and owning Logistics share one task-scoped thread; Seller contact is
  first-mile accepted only, Buyer contact final-mile accepted only.
- [x] Laravel provides separate accepted-task Courier–Seller and Courier–Buyer threads,
  with role-scoped counterpart routes, immutable task identity, and participant-only history.
- [ ] Offered, rejected, re-offered, completed, cross-Courier, cross-role, and
  cross-organization cases enforce the stated send/read boundaries.
- [ ] Active affiliation without an active task cannot initiate Logistics chat;
  a linehaul trip does not masquerade as a DeliveryTask.
- [ ] Concurrent first sends and exact retries create one thread/message; changed
  payload keys conflict without duplicate messages or alerts.
- [ ] Read markers never regress, private history is cursor-bounded, and a new
  Courier never receives a predecessor's thread or cached text.
- [ ] Chat text cannot mutate Order, task, custody, address, Incident, SOS, or POD;
  private phone, evidence, secrets, and raw paths stay out of DTOs/logs.
- [ ] Flutter handles bearer auth, read-only history, timeout retry, offline,
  accessibility, and logout/cache clearing against implemented API behavior.
- [ ] SQLite/PostgreSQL and Flutter contract tests cover IDOR, task races,
  first/final-mile separation, retries, pagination, read state, and alert failure.

## HOW

### Courier API — all three task counterparts implemented

| Method | Exact path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/courier/operational-conversations` | Own bounded inbox |
| `POST` | `/api/v1/courier/operational-conversations` | First valid message/start |
| `GET` | `/api/v1/courier/operational-conversations/{conversation}` | Own detail |
| `GET` | `/api/v1/courier/operational-conversations/{conversation}/messages` | History |
| `POST` | `/api/v1/courier/operational-conversations/{conversation}/messages` | Send |
| `POST` | `/api/v1/courier/operational-conversations/{conversation}/read` | Read marker |

- All six routes above support `counterparty_role=logistics|seller|customer`.
  `seller` requires an accepted `first_mile` task, `customer` an accepted `final_mile`
  task, and `logistics` remains available for active offered/accepted tasks. Invalid
  leg/counterpart pairs return `422`; an unaccepted task cannot start Seller/Buyer chat.
- Authentication is the shared protected Courier middleware plus per-task policy.
  `GET` has no body; list/history accept `cursor` and `limit` (default 20, max 50).
  List may filter `leg=first_mile|final_mile`; order by latest activity/UUID.
- `POST` start is JSON with `leg`, `task_id`, `counterparty_role`, and `body`;
  `counterparty_role` is `seller`, `customer`, or `logistics`. Require the UUID
  `Idempotency-Key` header; server derives the actual recipient and Order.
- Example start body: `{"leg":"first_mile","task_id":"<uuid>","counterparty_role":"logistics","body":"Pickup delayed; please advise."}`.
- `POST` send is JSON `{"body":"I have reached the pickup point."}` plus a new
  UUID `Idempotency-Key`. `POST` read is JSON `{"last_read_sequence":12}`;
  it is monotonic and idempotent without a send key.
- Reject request fields for IDs/roles/status/sequence/timestamps other than the
  allowed `leg`, `task_id`, and `counterparty_role` start selectors. Those three
  selectors must still be resolved and authorized server-side.
- Start returns `201` on first commit or `200` for exact retry; send
  returns `201` or `200` retry; reads and GETs return `200`. All use private
  `no-store` JSON, with server-owned UUIDs and nullable next cursor.
- Start response includes both the authorized conversation projection and its
  first committed message; an exact retry returns those same UUIDs and sequence.
- Send/start responses are `{ "conversation": <safe thread>, "message": <safe message> }`;
  the message has `id`, `conversation_id`, `sequence`, `sender_role`, `mine`, `body`,
  and `created_at`. Reads use `{ "data": ... }`.
- Minimal inbox DTO: `{"data":[{"id":"<uuid>","kind":"courier_seller","leg":"first_mile","task_id":"<uuid>","counterparty_role":"seller","unread_count":0,"read_only_reason":null}],"meta":{"next_cursor":null,"unread_count":0}}`.
- Detail includes safe counterpart/context and current sendability; history uses
  `data` message rows plus `meta.next_cursor`. Read returns the committed
  `last_read_sequence` and recalculated `unread_count`, not a client echo.
- Error envelope: `{"message":"Unable to send message.","code":"TASK_NOT_ACTIVE","errors":{}}`;
  field errors use `errors.<field>`, and no response includes foreign IDs.
- Implemented messaging conflict codes include `TASK_NOT_ACTIVE`,
  `CONVERSATION_READ_ONLY`, and `IDEMPOTENCY_CONFLICT`. Policy-consent errors
  continue to use the shared protected-route contract.

### Seller and Buyer counterpart API

- `/api/v1/seller/courier-conversations` and
  `/api/v1/customer/courier-conversations` each provide the same six
  list/start/detail/history/send/read actions. All require their role's Sanctum,
  active-account, and policy-consent gates. No counterpart web UI is shipped yet.
- Seller or Buyer starts with JSON
  `{"context_type":"order","context_id":"<owned-order-uuid>","body":"..."}`
  and a UUID `Idempotency-Key` header. Laravel resolves the currently accepted
  first-mile Seller or final-mile Buyer task from that Order; clients never select
  a Courier, organization, or recipient ID.
- The counterpart list and history use the same bounded cursor/limit and private
  response shape as Courier. A Seller sees only its Shop's first-mile thread;
  a Buyer sees only its owned final-mile thread. Neither role can use the other's
  channel or the existing Customer–Shop/Logistics chat route to read it.
- The response exposes safe Order/task references and a generic `Courier` label
  to counterpart apps, not Courier contact details or location. Send is disabled
  after handoff/delivery, loss of assignment, suspension, or affiliation loss;
  actual participants retain authorized read-only history.

### Backend, dependencies, and release

- The shared `conversations`/`conversation_participants`/`messages`
  infrastructure is extended additively with typed operational contexts and immutable
  organization/task/participant identity. Existing Customer–Shop rows, uniqueness,
  and Customer/Seller endpoint behavior are preserved.
- Unique logical thread key: organization, task/leg, Courier, and counterpart
  role/user. First-mile legacy task ID maps to its shared task before storage.
  Do not create a parallel Courier-only message store or use email as identity.
- A focused Laravel messaging service owns relationship checks, row locks,
  idempotency, sequence/read state, safe DTOs, and after-commit alerts;
  controllers stay thin and enum-like DB fields remain strings.
- Seller and Customer role owners must still add authorized read/reply screens
  before enabling the channels in a user-facing app; do not launch a one-sided composer.
- Test additive migration/rollback, old Customer–Seller chat regression,
  concurrent starts/sends, task reassignment, status/affiliation changes,
  SQLite and PostgreSQL, and alert failure. Verify Flutter parser/widget
  tests and the live API; mocks alone do not establish endpoint availability.
- Retention, abuse reporting, background push, masked calls, and any offline
  body cache require separate policy. [Laravel after-commit guidance](https://laravel.com/docs/12.x/queues#jobs-and-database-transactions)
  supports alert delivery after durable message persistence.
- Courier–Buyer contact requires an active Buyer account, its owned nonterminal
  Order, the accepted final-mile task, and that task's current handling organization;
  it cannot broaden the Customer–Logistics Order-chat authority.
- Copy this API contract and `api-handoff.md` to Flutter. Enable Seller/Buyer
  buttons only after Flutter and counterpart apps implement and verify their
  screens; backend availability alone does not complete the end-to-end feature.
