---
feature: support-tickets
role: Customer
platform: Flutter / Dart
phase: 4
flutter_status: Implemented; acceptance partial
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Admin support tickets

## WHAT

Backend: Own-ticket APIs and Admin triage/status lifecycle implemented; linked
records/attachments/notification fanout deferred.

Flutter (external project report): **implemented; acceptance partial**. See [Phase 4 evidence](../../../references/phase-4-verification.md).
Broad counterpart/device and concurrency criteria remain open.

Account Support → subject/category/description → ticket → Admin reply/status → revision-checked Customer reply/read.

- Create subject 1–150/category general|account|order|delivery/body 1–2000 with UUID key; UI description maps to body. No linked Order/context fields or arbitrary Admin chat.
- Own requester User plus customer-role scope; no pending/inactive exception. Replies need body/expected_revision/UUID key and reopen waiting_for_requester/resolved. Buyer cannot claim/assign/set status.
- List is items/next_cursor; detail data/events/next_cursor; read last_read_sequence ≥0, bounded to known history. Unread is independent of chat/notifications. Freeze uncertain draft/key/revision, poll foreground and refresh conflict before deliberate new action.

The local bundle supplies the implementation contract. Upstream paths are optional provenance only.
Use this feature with its prerequisite session/consent boundary and the related shopping or
communication repositories.
The Customer client cannot perform Seller/Admin/Logistics/Courier actions. Current Laravel ownership and
capabilities remain authoritative.

Buyer presentation requires verified active Customer identity and required consent for every shopping
screen; public backend methods/envelopes remain unchanged. Auth/recovery/Terms/Privacy stay reachable.
Phone/tablet padding, natural content heights and keyboard/text resizing follow [Buyer design](../../../design-buyer.md).

## MUST

### Feature behavior and boundaries

- Support is owned Admin ticket workflow, independent from all three operational/Shop conversation
  channels.
- Create accepts subject/category/body only; display label Description maps to body, never description.
- Categories general|account|order|delivery; subject1–150/body 1–2000 trimmed; no linked
  records/attachments.
- Active approved Customer+consent required; pending/inactive applicants have no support exception.
- Inbox uses items/next_cursor and optional status/category; omit Admin-only assignment filter.
- Detail uses data/events/next_cursor with newest selected events returned ascending.
- Laravel cursorPaginate resolves cursor from the current request; no explicit reader cursor argument is needed.
- Use the returned older-history cursor and merge events by ID/sequence; test that each page advances without gaps.
- Inbox and detail both use framework cursor paging; malformed cursor may reset to first page, so stop on no progress.
- Summary requester_name/assignee_id are null for Customer; assignee_name may appear safely.
- Revision is required on reply expected_revision≥1; stale revision409 needs refreshed detail and
  review.
- Create/reply UUID key freezes payload;201 created and recorded201 replay are both successful.
- Read last_read_sequence≥0 bounded by committed history; no UUID header; marker monotonic.
- Events include body nullable, statuses nullable and assignment_changed bool; status event is not a
  text reply.
- Customer replies automatically reopen waiting_for_requester/resolved tickets; they cannot assign/resolve or execute Order/refund actions.
- Reply is the supported Customer reopening action; no separate reopen/Admin-action endpoint is available.
- Foreground polling can refresh detail; native push/fanout notifications are currently deferred.
- No Admin blanket transcript access to other channels or linked private business data follows from
  support.
- Test ownership, category/body/unknown fields, revision conflict, exact UUID replay and monotonic read.
- Test nullable events/names, resolved-reply reopening and more-than30 event cursor traversal without lost or duplicate events.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient
authority.

- `GET /api/v1/customer/support-tickets` → HTTP 200; `{items:Ticket[],next_cursor:string?}`.
  Request: cursor≤2048; limit1–50 default 20; status open|in_progress|waiting_for_requester|resolved, category general|account|order|delivery optional; omit Admin-only assignee.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `POST /api/v1/customer/support-tickets` → HTTP 201; `{data:Ticket,event:TicketEvent}`.
  Request: subject trimmed1–150, category general|account|order|delivery, body trimmed1–2000; UUID header; context/unknown keys rejected.
  Replay: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- `GET /api/v1/customer/support-tickets/{ticket}` → HTTP 200; `{data:Ticket,events:TicketEvent[],next_cursor:string?}`.
  Request: cursor≤2048 accepted but reader does not pass it; limit1–50 default 30; owned ticket.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `POST /api/v1/customer/support-tickets/{ticket}/replies` → HTTP 201; `{data:Ticket,event:TicketEvent}`.
  Request: body trimmed1–2000, expected_revision required int≥1; UUID header; no unknown keys.
  Replay: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- `POST /api/v1/customer/support-tickets/{ticket}/read` → HTTP 200; `{data:Ticket}`.
  Request: last_read_sequence required int≥0, ≤history; no key; monotonic.
  Replay: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/support-tickets.json).
Examples are source-derived synthetic fixtures, not live captures or usable test accounts.

### Response fields and nesting

The following top-level DTO fields use `?` for null and `~` for omission; otherwise the field is
required.
Named nested types and all child keys are defined in the local [wire
tables](../../../api/field-index.md)
and [schema](../../../api/dto-schema.json); those definitions are part of this spec, not upstream
reading.
UUID/cursor are strings; int is integral JSON; number accepts JSON int/double; timestamps are ISO-8601
UTC.
money is a decimal string with exact minor-unit parsing; URL requires trusted-origin/path validation.
Never default a missing required object/list to empty success. Unknown enum values disable unsupported
actions.

| DTO | Wire fields and types |
| --- | --- |
| `Ticket` | `id: UUID`, `reference: string`, `subject: string`, `category: string`, `status: string`, `revision: int`, `requester_role: string`, `requester_name: null`, `assignee_name: string?`, `assignee_id: null`, `unread_count: int`, `last_activity_at: timestamp?`, `created_at: timestamp?`, `resolved_at: timestamp?` |
| `TicketEvent` | `id: UUID`, `sequence: int`, `type: string`, `actor_role: string`, `is_mine: bool`, `body: string?`, `from_status: string?`, `to_status: string?`, `assignment_changed: bool`, `created_at: timestamp?` |

### Errors, ownership and recovery

HTTP 401 clears invalid identity/token and every private feature state through SessionController.
Explicit account/role403 clears identity; resource403/404 clears only affected records unless it signals
account loss.
POLICY_CONSENT_REQUIRED preserves valid authentication, blocks protected work and opens current consent.
HTTP 422 binds errors by exact request field name and preserves safe editable input; errors/code may be
absent.
HTTP 409 refreshes authoritative state and explains conflict; never silently change a key or replay a
changed payload.
HTTP 429 honors readable Retry-After and disables repeat action until cooldown; unavailable header is not
a guessed server guarantee.
Network/CORS/decode/timeout/5xx have distinct feedback. A failed exchange does not prove a mutation
rolled back.
No offline write queue is authorized. Reconcile unsupported replay before a deliberate new action.
Duplicate submits are disabled. Supported uncertain UUID writes retain exact key and payload in session
memory.
Queries/pages belong to a full request signature and session generation. Drop stale success/error on
either change.
Private data is memory-only; token is secure-store only. Recently Viewed is account-only.
Never write or merge guest hints; legacy-key cleanup must not delay authentication.
Local [failure contracts](../../../api/errors.md) define concrete codes and examples; do not require a
universal error envelope.

## HOW

### Responsibility and state ownership

- `SupportRepository` owns typed transport, parsing and owned cache access; inject dependencies through
  AppDependencies.
- `TicketInboxViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `TicketDetailViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `TicketComposerViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- Screens compose focused sections/forms/history; reusable widgets render typed state and forward
  callbacks.
- Use ChangeNotifier/ListenableBuilder with immutable DTO snapshots. No HTTP or JSON guesses in build().
- Keep independent forms/actions separately busy and preserve safe input after recoverable
  validation/network failures.
- Dispose listeners, timers, cancel tokens, byte previews and obsolete pending actions on screen/account
  loss.
- Parser/repository/controller tests use fake transport, clock, token store and UUID factory; widgets
  use injected fakes.

### Screen and interaction states

- Initial loading exposes progress and accessible labels without a private-data flash.
- Empty success explains the next supported step; unavailable includes Retry and does not pretend there
  are zero records.
- Recoverable refresh failure can retain permitted stale reads with a visible warning; paging failure
  has separate Retry.
- Validation focuses the first invalid field and associates labels/errors semantically; safe input
  remains editable.
- Submitting disables duplicate action; uncertain mutation explains reconciliation and preserves only
  supported pending intent.
- Conflict refresh requires review before a new deliberate write. Success follows a confirmed server
  response.
- Forbidden clears affected private content; consent-required offers reading/acceptance; offline offers
  truthful read/retry limits.
- Light-only Material styling follows [Buyer design](../../../design-buyer.md); keyboard/back/focus
  never silently lose safe drafts.
- Use at least 48×48 logical-pixel touch targets, visible focus, text-scale tolerance and non-color
  status cues.
- Android Back/browser Back/cancel return predictably. Confirm destructive actions and warn before
  discarding unsaved form input.

### Verification scenarios

- [ ] Own ticket and field/role/foreign denials expose no unrelated cases.
- [ ] Same-key create/reply, stale revision/reopen, read/history and offline/conflict preserve one
  intended event.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported
  permission/retry states and cleanup after identity loss.
- [ ] DTO fixtures reject wrong required types, distinguish null/absent/false/empty and preserve wire
  casing.
- [ ] Each consumed operation uses its documented method/body/envelope and correct public/private
  credential behavior.
- [ ] Exercise normal, empty, malformed, denied, consent-required, validation, conflict, throttle,
  offline and timeout outcomes.
- [ ] Delayed responses/errors after logout/account switch cannot repopulate private state or restart
  disposed work.
- [ ] Same-key replay applies only where supported; additive Cart/image requests are never globally
  retried.
- [ ] Narrow Android/browser layouts, TalkBack order, large text, touch targets, keyboard insets and
  Back/cancel are checked.
- [ ] Record analyze/unit/widget/build and live target results separately; synthetic fixtures are not
  API acceptance.
- [ ] Keep release gates in [integration gaps](../../../references/integration-gaps.md) open until
  owning evidence resolves them.

### Handoff and provenance

Historical backend baseline: 7b1a08a; newly inspected checkout:
`57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`.
Source locators/hashes are optional audit evidence in
[provenance](../../../references/source-provenance.md).
No Flutter implementation checkbox is completed by documentation authoring or route/source inspection.
Append actual implementation/test outcomes to [Progress](../../../PROGRESS.md) and retain prior history.
Follow [architecture](../../../architecture.md), [setup](../../../setup.md) and
[verification](../../../verification.md).
