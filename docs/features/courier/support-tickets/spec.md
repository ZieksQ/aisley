---
feature: courier-support-tickets
title: Courier Support Tickets
system: AISLEY
type: Feature Specification
version: 1.1
status: Courier API implemented; external Flutter UI pending
implementation_status: Five protected requester routes and shared ticket persistence are implemented
canonical: true
role: Courier
scope: Laravel API and external Flutter mobile application
backend_contract_commit: 40c68de
backend_contract_version: courier-support-tickets-v1
source_coverage: docs/features/admin/chat-messaging/spec.md, docs/schema.md, docs/domains/Courier.md
---

# Courier Support Tickets

## WHAT

- Give an approved Courier a private, asynchronous way to request help from platform Admin support.
- Keep support tickets separate from task-scoped Logistics, Seller, and Buyer operational chat.
- One ticket represents one issue and retains a reference, category, status, revision, replies, and lifecycle events.
- Courier owns only tickets created by the same authenticated Courier User and role.
- Admin owns triage, assignment, status changes, and resolution through the separate Admin feature.
- The production Courier interface belongs to the external Flutter app; this repository provides no Courier web UI.
- Implemented requester categories are `general`, `account`, `order`, and `delivery`.
- Implemented statuses are `open`, `in_progress`, `waiting_for_requester`, and `resolved`.
- Creating a ticket starts it as `open`; a Courier reply may reopen `waiting_for_requester` or `resolved` to `open`.
- Tickets do not approve accounts, alter Orders or tasks, change custody, issue refunds, or decide compliance cases.
- Linked Order, Parcel, Delivery Task, Shop, Logistics, and compliance contexts are not accepted in this release.
- Attachments, internal Admin notes, push notifications, email ingestion, guest appeals, and offline writes are deferred.

```text
approved Courier → create ticket → Admin triage/reply/status
                 → Courier list/detail/reply/read
                 → resolved history remains readable
```

## MUST

### Authorization and ownership

- Require Sanctum bearer authentication, `courier.active`, active approved Logistics affiliation, active organization, sole hub, and current policy consent.
- Derive requester User and persisted `courier` role from the token; never accept requester, role, organization, hub, assignee, or status as client authority.
- A Courier may list, open, reply to, and mark read only its own Courier-role tickets.
- Foreign, cross-role same-email, malformed, and deleted ticket identifiers must not reveal another requester's record.
- Pending, rejected, suspended, deactivated, or invalid-affiliation accounts cannot use these protected routes.
- Ticket access grants no access to private chat, registration evidence, task proof, Order data, or Admin-only history.
- All responses are private JSON with `Cache-Control: private, no-store`.

### Creation and content

- Create requires trimmed `subject` of 1–150 characters, one allowed `category`, and trimmed plain-text `body` of 1–2,000 characters.
- Reject `context_type`, `context_id`, and undeclared authority or linked-record fields.
- Render subject and body as untrusted text, never HTML, Markdown, or MDX.
- Server creates the UUID, non-authorizing `SUP-` reference, requester identity, timestamps, initial reply event, revision, and status.
- A ticket reference is display/search context only and never substitutes for UUID ownership checks.
- Log safe ticket, event, actor, and outcome identifiers; do not log reply bodies by default.

### Replies, history, and read state

- Reply requires trimmed plain-text `body`, current positive `expected_revision`, and a UUID `Idempotency-Key` header.
- A Courier reply to `open` or `in_progress` preserves status.
- A Courier reply to `waiting_for_requester` or `resolved` appends the reply and reopens the same ticket to `open` atomically.
- Replies and lifecycle events are append-only and ordered by server-owned sequence.
- Detail history is cursor-bounded and returned oldest-to-newest within the fetched page.
- Mark-read requires `last_read_sequence >= 0`; it never moves the Courier marker backward.
- Reject a read sequence greater than the ticket's current last sequence with validation failure.
- Courier read state is independent from each Admin's read marker and from the notification inbox.
- A resolved ticket remains readable and may be reopened only through an authorized reply or Admin action.

### Concurrency and retries

- Create and reply require a stable UUID `Idempotency-Key`; preserve the same key and payload after an uncertain timeout.
- An exact retry returns the original stored response and status without another ticket or event.
- Reusing the same key with different input returns `409` and creates no duplicate event.
- Reply locks the ticket and compares `expected_revision`; stale revisions return `409` and require refetch.
- Do not queue create, reply, or mark-read mutations offline.
- A read retry is naturally monotonic and returns the current safe ticket summary.
- Admin assignment/status activity may race with a Courier reply; the server revision remains authoritative.

### Privacy and Flutter behavior

- Safe summaries include ticket ID/reference, subject, category, status, revision, requester role, safe assignee name, unread count, and timestamps.
- Courier responses return `requester_name: null` and `assignee_id: null`; Admin-only identity controls remain excluded.
- Safe events include ID, sequence, type, actor role, `is_mine`, body, status change, assignment-change flag, and timestamp.
- Never expose email, phone, address, payment data, bearer token, raw storage path, private evidence, or unrelated activity.
- Store bearer tokens only through approved secure storage and clear ticket caches on logout or authorization loss.
- Keep bounded ticket/history state in memory; do not persist private transcripts in ordinary device storage.
- Poll only a visible list/detail when online, and refetch on focus or reconnect.
- Preserve unsent draft text and its idempotency key after timeout, but never label it sent before server confirmation.
- Show checking-session, loading, empty, validation, sending, saved, conflict, forbidden, not-found, throttled, timeout, offline, and retry states.
- Use semantic status text, readable timeline order, large-text support, screen-reader labels, and adequate touch targets.
- Keep ticket entry visually distinct from operational task chat and the Courier notification inbox.

### Errors

| HTTP | Meaning | Flutter action |
| --- | --- | --- |
| `401` | Missing or invalid Sanctum token | Clear protected state and return to sign-in |
| `403` | `FORBIDDEN_ROLE`, account-status code, `LOGISTICS_ASSOCIATION_INVALID`, or `POLICY_CONSENT_REQUIRED` | Show the matching gate; route consent to the returned policy URLs |
| `404` | Ticket absent or outside Courier scope | Remove stale local detail and return to own list |
| `409` | Stale revision or changed-payload idempotency key | Refetch; preserve draft and require explicit retry |
| `422` | Invalid field, transition, key, or read sequence | Show field/message validation without mutation |
| `429` | Create/reply throttled | Preserve draft and retry only after backoff |
| timeout/offline | Outcome unknown or request unavailable | Keep draft/key and reconcile before resubmitting |

The API currently uses Laravel's standard `message` and `errors` response shape; no support-ticket-specific machine error code is promised.

### Acceptance criteria

- [x] Protected Courier routes exist under `/api/v1/courier/support-tickets`.
- [x] Token identity and role scope prevent forged requester and foreign-ticket access.
- [x] Create/reply validation, revisions, exact retries, and changed-key conflicts are server-owned.
- [x] Ticket events are append-only and Courier/Admin read markers remain independent.
- [x] Courier DTOs omit Admin-only IDs, unrelated PII, private evidence, and raw paths.
- [ ] Flutter implements create, list, detail, reply, and mark-read screens against this exact contract.
- [ ] Flutter contract/widget tests cover parsing, pagination, drafts, retry, errors, accessibility, and logout cleanup.
- [ ] Authenticated mobile/API integration and installed-device interaction are verified.
- [ ] PostgreSQL concurrency/retry verification passes before production release.

## HOW

### Implemented endpoint contract

| Method | Path | Request | Success |
| --- | --- | --- | --- |
| `GET` | `/api/v1/courier/support-tickets` | Query: `cursor?`, `limit?` 1–50, `status?`, `category?` | `200` list envelope |
| `POST` | `/api/v1/courier/support-tickets` | JSON create body plus UUID key | `201` mutation envelope |
| `GET` | `/api/v1/courier/support-tickets/{ticket}` | Query: `cursor?`, `limit?` 1–50 | `200` detail envelope |
| `POST` | `/api/v1/courier/support-tickets/{ticket}/replies` | JSON reply body plus UUID key | `201` mutation envelope |
| `POST` | `/api/v1/courier/support-tickets/{ticket}/read` | JSON read body; no key required | `200` summary envelope |

All endpoints require `Authorization: Bearer <token>`, Courier gates, and policy consent. Create is throttled to 10/minute and reply to 30/minute in addition to shared API limits.

Create request:

```json
{"subject":"Unable to open my assigned task","category":"delivery","body":"The task detail returns an unavailable state."}
```

Reply request:

```json
{"body":"The issue still occurs after signing in again.","expected_revision":2}
```

Read request:

```json
{"last_read_sequence":3}
```

List response shape:

```json
{"items":[{"id":"<uuid>","reference":"SUP-...","subject":"...","category":"delivery","status":"open","revision":1,"requester_role":"courier","requester_name":null,"assignee_name":null,"assignee_id":null,"unread_count":0,"last_activity_at":"<utc>","created_at":"<utc>","resolved_at":null}],"next_cursor":null}
```

Detail response shape:

```json
{"data":{"id":"<uuid>","reference":"SUP-...","status":"open","revision":1},"events":[{"id":"<uuid>","sequence":1,"type":"reply","actor_role":"courier","is_mine":true,"body":"...","from_status":null,"to_status":null,"assignment_changed":false,"created_at":"<utc>"}],"next_cursor":null}
```

Mutation responses contain `data` with the full safe summary and `event` with the committed event. Flutter must tolerate additional safe fields while requiring the documented identity, status, revision, and sequence fields.

### Flutter model mapping

- Map JSON `id`, `reference`, `subject`, `category`, and `status` to immutable Dart strings.
- Map `revision`, `unread_count`, and event `sequence` to nonnegative integers.
- Parse UTC timestamp strings as nullable `DateTime` values without changing server ordering.
- Keep `requester_name`, `assignee_name`, `assignee_id`, and `resolved_at` nullable.
- Treat unknown category, status, or event type as unsupported data and retain a safe fallback label.
- Preserve the opaque `next_cursor`; never decode it or construct one locally.
- Replace a page only after its complete response parses; an invalid item must not corrupt current state.
- Deduplicate appended history by event UUID and sequence when reconciling a timeout or refresh.
- Use the latest returned `revision` for the next reply and never increment it optimistically.
- Clear transcript, cursor, revision, draft keys, and pending mutation state when the session changes.

### Components and data flow

- `RequesterSupportTicketController` owns Courier requester HTTP transport and no-store responses.
- Form Requests trim input, reject undeclared fields, validate categories/status filters, and require mutation keys.
- `SupportTicketReader` owns Courier scoping, deterministic cursor reads, unread counts, and monotonic read markers.
- `SupportTicketWriter` owns transactions, row locks, revisions, idempotency receipts, append-only events, and safe logging.
- `SupportTicketView` returns role-safe summaries/events; Flutter must not model raw Eloquent records.
- UUID-backed ticket, event, read-marker, and idempotency tables are shared with other requester roles and Admin.
- No notification is emitted in this release; Flutter refresh/polling reads the authoritative ticket history.

### Verification and rollout

- Retain SQLite tests for Courier ownership, cross-role/cross-user IDOR, validation, create/reply retries, stale revision, reopen behavior, and read markers.
- Verify PostgreSQL locking and exact-retry behavior before production release.
- Add Flutter repository fixtures for all envelopes and nullable summary/event fields.
- Add controller/widget tests for cursor continuation, unknown safe fields, conflicts, throttling, timeout reconciliation, offline blocking, and session cleanup.
- Record the adopted Laravel commit/API version in Flutter `docs/PROGRESS.md`.
- Keep the feature unavailable in Flutter navigation until its screens and contract tests are present; API availability alone does not prove client implementation.
- Retention, attachments, ticket notifications, linked business records, and ineligible-account appeals require separate approved revisions.
