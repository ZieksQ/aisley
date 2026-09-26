---
feature: admin-support-tickets
title: Admin Support Ticket System
system: AISLEY
type: Feature Specification
version: 2.1
status: Ticket schema/API and Admin, Customer, Seller, Logistics web screens implemented; Courier Flutter and production release checks pending
role: Admin
scope: Laravel API, Admin React dashboard, and role-owned requester interfaces
---

# Admin Support Ticket System

## WHAT

- Replace the earlier Admin live-chat proposal with a tracked, asynchronous support-ticket
  workflow. An eligible Customer, Seller, Logistics user, or Courier submits an issue; authorized
  Admins triage, reply, and resolve it. “Buyer” is the storefront name for `customer`.
- One ticket represents one issue, with a reference, subject, category, requester, status,
  ordered public replies, and immutable lifecycle history. Linked business context is deferred.
  Tickets are not a permanently open Admin–user chat or a general user directory.
- The Admin dashboard owns the support queue, ticket detail, assignment, replies, and status
  actions. Each requester sees only their own tickets through their role app; Courier UI belongs
  to the external Flutter project, not this repository.
- Customer–Seller and operational text chat use `conversations`/`messages`. Admin tickets use a
  distinct ticket/workflow store and never expose or repurpose private conversation history.
- Ticket replies do not approve registrations, reverse account restrictions, decide a compliance
  case, alter Orders, dispatch Couriers, or create a refund. Those actions stay with their owning
  features and may be referenced only through an approved, authorized link.
- MVP is authenticated, plain-text, persisted HTTP with polling/refetch. No WebSocket, email
  ingestion, guest ticket, group chat, internal note, file attachment, AI reply, SLA timer,
  automatic routing, or provider dependency is implied.
- Admin-initiated outreach is deferred; compliance warnings remain source-owned.

## MUST

### Requesters and authority

- Require `auth:sanctum`, current role/account authorization, and applicable policy consent on
  every route. The server derives requester and role; a client cannot set `requester_user_id`,
  Admin assignee, reply author, status, timestamps, or a linked record's ownership.
- MVP requester creation is for active/approved accounts that can use their role app. Pending,
  rejected, suspended, or deactivated account access needs a separately approved, narrowly
  scoped support/appeal auth exception; do not claim those users can use this in-app flow yet.
- A requester can list, open, reply to, and mark read only their own ticket. A foreign UUID or
  reference returns a scoped `404`; same-email accounts in different roles do not share tickets.
  Admins need `support-tickets.view`/`support-tickets.manage` permissions, not just the `admin` role.
- An Admin may view authorized support tickets but has no blanket right to inspect unrelated
  Customer–Seller, Logistics, or Courier chat. Compliance/evidence access follows those source
  policies; ticket visibility does not grant private source-record access by association.
- This release accepts only `subject`, `category`, and plain-text `body` on creation. `context_type`,
  `context_id`, and other undeclared fields are rejected. Optional Order, Shop, pickup, task,
  or compliance links are deferred until each requester role has an approved relationship and
  visibility matrix. A future reference must never grant source-record access by itself.

### Ticket lifecycle

- Create a ticket with a trimmed subject (1–150 characters), one of `general`, `account`,
  `order`, or `delivery`, and a first nonempty plain-text `body` (1–2,000 characters).
  The server assigns a UUID and a human-readable, non-authorizing reference.
- Persist status as string-backed `open`, `in_progress`, `waiting_for_requester`, or `resolved`.
  The public status is a server-owned projection; every transition appends an event with actor,
  from/to, reason where required, and server UTC time.
- Creation starts `open`. An authorized Admin can claim/assign to an active support-authorized
  Admin and move it to `in_progress`; requesting information moves it to
  `waiting_for_requester`. An Admin resolves with a visible resolution reply or reason.
- A requester reply to `waiting_for_requester` or `resolved` reopens the same ticket to `open`
  atomically with the reply. A reply to `open`/`in_progress` preserves its status. Admins may
  reopen `resolved` with a reason. No automatic closure or silent status change from a read.
- Assignment changes, status changes, and replies retain immutable actor/time history. A
  reassigned Admin loses no previous event; an unassigned ticket remains in the support queue.
  No hard deletion of tickets, replies, or events is offered in MVP.
- Lock the ticket or check its revision for concurrent transitions. Require UUID idempotency keys
  for create, reply, and status/assignment mutations; exact retries return the original result,
  while the same key with a different payload returns `409`.

### Replies, notifications, and privacy

- Public replies are append-only ticket events with server UUID, author role, UTC time, and
  per-ticket sequence. Render user text as text, never HTML/MDX. Admin-only internal notes are
  deferred; no private note may accidentally appear in the requester projection.
- Bound queue/history pagination with deterministic cursors. Persist one read marker per
  ticket **and User**, including each individual Admin. Admin A opening a ticket cannot clear
  Admin B's unread count. Requester/Admin markers are separate from notification read state;
  stale reads cannot move a marker backward.
- A future after-commit in-app notification may link the opposite party to a newly committed reply or
  relevant status change. Deduplicate by ticket/event and recipient. Notification delivery failure
  never rolls back the ticket, reply, or event and never becomes the source of truth for history.
- Ticket DTOs expose only safe requester identity, subject/category/status, assignee display
  name where appropriate, timeline, and counts. No linked context is exposed in this release.
  Do not expose emails, phone numbers, addresses, payment secrets, private evidence, raw storage
  paths, or unrelated user activity merely because a ticket exists.
- Log safe ticket/event IDs, actor, action, and outcome, not reply bodies by default. Throttle
  ticket creation and replies. Private API responses use `no-store`; no public search/index route
  or unrestricted Admin transcript export exists.
- Retention duration, abuse-reporting process, evidence attachments, and exceptional access for
  ineligible accounts require separate policy before production release. Any later attachments
  must follow `docs/references/file-upload-requirements.md` and source-owner access rules.

### Role experience and errors

- Admin UI offers a paginated queue with status/category/assignee filters, unread/updated time,
  a detail timeline, claim/reassign, reply, wait, resolve, and reopen controls. It distinguishes
  saved replies from pending drafts and shows the immutable event history.
- Role apps offer **Support tickets** entry, submit form, own-ticket list/detail, and public reply.
  Existing chat inboxes stay separate. Courier uses the same API contract through Flutter; no
  Courier web screen is added here.
- Poll visible ticket views and refetch on focus/reconnect. On uncertain timeout, preserve the
  draft and its idempotency key; never label an unconfirmed reply as sent or queue offline writes.
- Provide loading, empty, validation, sending, saved, read-only, forbidden/not-found, conflict,
  throttled, timeout, and offline states. Admin UI follows dashboard light/dark design; all role
  views use labeled controls, keyboard focus, semantic timelines, and non-color-only statuses.
- Return `401` unauthenticated, `403` wrong role/status/permission/consent, scoped `404` foreign,
  `409` stale revision/key conflict, `422` invalid input/transition, and `429` throttled.

### Acceptance criteria

- [ ] Eligible users can create and view only their own tickets; forged requester, cross-role
  same-email identity, foreign UUID, or unrelated business context cannot bypass authorization.
- [ ] Only support-authorized Admins can list, claim, assign, reply, or change status; they cannot
  see unrelated private chat or source evidence through ticket access.
- [ ] Ticket transitions and requester reply/reopen behavior match the approved state rules and
  preserve append-only actor/time/reason history under retries and concurrent Admin actions.
- [ ] Exact create/reply/action retries return one result; changed-payload keys and stale
  revisions conflict without duplicate replies, events, or notifications.
- [ ] Queue/history pagination, read markers, safe DTOs, plain-text rendering, and role-specific
  UI states work without conflating tickets with Customer–Seller chat or platform notifications.
- [ ] A committed ticket/reply survives notification failure; a rolled-back action emits no
  recipient alert, and private reply bodies are absent from ordinary logs.
- [ ] SQLite and PostgreSQL tests cover migration, IDOR, permission/status gates, context
  validation, transitions, concurrency, retries, pagination, and after-commit behavior.

## HOW

- Add UUID-backed `support_tickets`, append-only `support_ticket_events`, idempotency receipts,
  and participant read-marker tables through additive migrations. Events cover public replies,
  status, and assignment; keep Customer–Seller `conversations`/`messages` unchanged.
- Index requester/activity, status/activity, assignee/status, and ticket/sequence; enforce unique
  ticket reference, per-ticket event sequence, and actor/action-scoped idempotency keys. Store
  enum-like status/category values as strings with typed PHP enums.
- Use the existing Sanctum, role middleware, Admin permission seeding, Form Requests, safe DTOs,
  and focused service pattern. The ticket writer owns row locks, transitions, immutable history,
  and idempotency. Linked-record validation and after-commit notification fanout are deferred.
- Implemented Admin routes under `/api/v1/admin/support-tickets`: `GET /`,
  `GET /{ticket}`, `POST /{ticket}/claim`, `POST /{ticket}/assign`,
  `POST /{ticket}/replies`, `POST /{ticket}/status`, and `POST /{ticket}/read`. `GET /assignees`
  lists only active support-authorized Admin display names/IDs for the assignment control.
- Implemented requester routes under each of `/api/v1/customer/support-tickets`,
  `/api/v1/seller/support-tickets`, `/api/v1/logistics/support-tickets`, and
  `/api/v1/courier/support-tickets`: `GET /`, `POST /`, `GET /{ticket}`,
  `POST /{ticket}/replies`, and `POST /{ticket}/read`.
- Create accepts subject, category, and first body only; reply accepts body; actions accept
  expected revision and permitted reason/assignee. Mutations require a UUID `Idempotency-Key`.
  Responses return ticket/reference/status/revision, role-safe replies/events, unread count,
  and pagination cursor, never raw Eloquent models.
- Admin `/support-tickets` queue/detail and Customer, Seller, and Logistics requester web entry
  points are implemented. Courier's `/api/v1/courier/support-tickets` routes are available to
  the external Flutter app; no Courier web screen was added here. See the role-owned requester
  specs for their current UI boundary.
- Use HTTP/polling first. Optional notifications, if added later, must dispatch
  [after commit](https://laravel.com/docs/12.x/queues#jobs-and-database-transactions).
  Realtime transport and email ingestion remain separate future choices.
- SQLite role-scoped feature tests cover ownership, permission gates, per-Admin read markers,
  retries, assignment, and lifecycle transitions. PostgreSQL concurrency, browser/mobile flows,
  accessibility, and timeout interaction checks remain release verification gates.
- Open decision: define retention and support/appeal access for ineligible accounts before launch.
