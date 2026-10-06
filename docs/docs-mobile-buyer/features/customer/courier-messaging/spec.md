---
feature: courier-messaging
role: Customer
platform: Flutter / Dart
phase: 4
flutter_status: Implemented; acceptance partial
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Delivery Courier messages

## WHAT

Backend: Accepted-final-mile counterpart APIs and private Customer Order-context read implemented;
live/race release gates open.

Flutter (external project report): **implemented; acceptance partial**. See [Phase 4 evidence](../../../references/phase-4-verification.md).
Broad counterpart/device and concurrency criteria remain open.

Owned Order → private Order-context read → eligible first message → task-specific Courier thread → scoped read/reply/history.

- Order-context returns order_id,order_reference,send_allowed,conversation_id and creates no empty thread. Displayed Courier name/unaccepted offer alone grants no contact.
- Start courier-conversations with body/context_type:order/context_id and UUID key. Server resolves accepted final-mile task/offer, approved active affiliation/account/organization/custody and nonterminal Order. Never submit task/leg/recipient IDs or call Courier APIs.
- Reassignment/custody/terminal change disables sending while original participants keep scoped read-only history; new Courier gets another private thread. Operational data/meta/read last_read_sequence and frozen key/payload differ from Shop facade. Polling preserves pending first-send context and older gaps.

The local bundle supplies the implementation contract. Upstream paths are optional provenance only.
Use this feature with its prerequisite session/consent boundary and the related shopping or communication
repositories.
The Customer client cannot perform Seller/Admin/Logistics/Courier actions. Current Laravel ownership and
capabilities remain authoritative.

Buyer presentation requires verified active Customer identity and required consent for every shopping
screen; public backend methods/envelopes remain unchanged. Auth/recovery/Terms/Privacy stay reachable.
Phone/tablet padding, natural content heights and keyboard/text resizing follow [Buyer design](../../../design-buyer.md).

## MUST

### Feature behavior and boundaries

- Order entry first reads private order-context; read creates no empty thread.
- Context gives order_id/order_reference/send_allowed/nullable conversation_id only; no Courier recipient
  selector.
- Displayed Courier name or an offered task alone does not authorize contact.
- Server requires accepted final-mile task, active Courier/approved affiliation/organization, valid
  custody and nonterminal Order.
- Eligible accepted/picked-up-from-hub/in-transit/out-for-delivery stages use current server permission.
- Start sends context_type order/context_id/body and UUID key; never task/leg/Courier IDs.
- Courier conversation kind courier_customer carries final_mile leg/task reference for display only.
- Customer accesses only customer/courier-conversations route family; no courier task/operational
  endpoints.
- Inbox/history data/meta envelope differs from Shop; meta unread_count supplies channel total.
- Read uses last_read_sequence≥1 with monotonic server marker, separate from notification/support reads.
- Terminal/failure/reassignment/custody loss yields send_allowed false and TASK_NOT_ACTIVE reason.
- Original authorized participants retain scoped history; replacement Courier receives a separate private
  conversation.
- 201 created/200 exact replay are successful; frozen key/body/context prevents duplicate delivery
  contact.
- Uncertain first send survives polling and cannot rebind to replacement Courier silently.
- History limit1–50 default 20; newest-first page selection with ascending output; merge by UUID/sequence.
- Poll visible online 15s and focus/reconnect; no push/background guarantees or offline queue.
- Text≤2,000, no attachments/edit/delete/presence/calls/proof sharing or Customer delivery completion.
- Clear transcript/draft/key/timers on identity/scoped denial; keep safe readonly UI for ended relation.
- Test accepted eligibility vs offer/unaccepted/invalid affiliation, foreign Order, reassignment privacy
  and delivery close.
- Test replay/read/cursor gaps, old polling response, pending start on custody change and live external
  Courier exchange.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient authority.

- `GET /api/v1/customer/courier-conversations` → HTTP 200; `{data:CourierConversation[],meta:{next_cursor:string?,unread_count:int}}`.
  Request: cursor opaque≤2048; limit1–50 default 20.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `POST /api/v1/customer/courier-conversations` → HTTP 201; `{conversation:CourierConversation,message:OperationalMessage}`.
  Request: context_type order; context_id owned Order UUID; body trimmed1–2000; UUID header; server resolves counterparty.
  Replay: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- `GET /api/v1/customer/courier-conversations/{conversation}` → HTTP 200; `{data:CourierConversation}`.
  Request: No parameters.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `GET /api/v1/customer/courier-conversations/{conversation}/messages` → HTTP 200; `{data:OperationalMessage[],meta:{next_cursor:string?}}`.
  Request: cursor opaque≤2048; limit1–50 default 20.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `POST /api/v1/customer/courier-conversations/{conversation}/messages` → HTTP 201; `{conversation:CourierConversation,message:OperationalMessage}`.
  Request: body trimmed1–2000; UUID header; Shop allows optional validated product|order context_type/context_id; operational sends body only.
  Replay: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- `POST /api/v1/customer/courier-conversations/{conversation}/read` → HTTP 200; `{data:CourierConversation}`.
  Request: last_read_sequence required int≥1, cannot exceed committed history; monotonic.
  Replay: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- `GET /api/v1/customer/courier-conversations/order-context/{order}` → HTTP 200; `{data:CourierOrderContext}`.
  Request: Owned Order UUID; read creates no thread.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/courier-messaging.json).
Examples are source-derived synthetic fixtures, not live captures or usable test accounts.

### Response fields and nesting

The following top-level DTO fields use `?` for null and `~` for omission; otherwise the field is
required.
Named nested types and all child keys are defined in the local [wire tables](../../../api/field-index.md)
and [schema](../../../api/dto-schema.json); those definitions are part of this spec, not upstream
reading.
UUID/cursor are strings; int is integral JSON; number accepts JSON int/double; timestamps are ISO-8601
UTC.
money is a decimal string with exact minor-unit parsing; URL requires trusted-origin/path validation.
Never default a missing required object/list to empty success. Unknown enum values disable unsupported
actions.

| DTO | Wire fields and types |
| --- | --- |
| `CourierOrderContext` | `order_id: UUID`, `order_reference: string`, `send_allowed: bool`, `conversation_id: UUID?` |
| `CourierConversation` | `id: UUID`, `kind: string`, `leg: string?`, `task_id: UUID?`, `task_reference: string?`, `order_id: UUID?`, `order_reference: string?`, `counterparty_role: string`, `counterparty_label: string`, `last_message_preview: string?`, `last_message_at: timestamp?`, `last_sequence: int`, `last_read_sequence: int`, `unread_count: int`, `send_allowed: bool`, `read_only_reason: string?` |
| `OperationalMessage` | `id: UUID`, `conversation_id: UUID`, `sequence: int`, `sender_role: string`, `mine: bool`, `body: string`, `created_at: timestamp?` |

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

- `CourierChatRepository` owns typed transport, parsing and owned cache access; inject dependencies
  through AppDependencies.
- `CourierInboxViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `CourierThreadViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- Screens compose focused sections/forms/history; reusable widgets render typed state and forward
  callbacks.
- Use ChangeNotifier/ListenableBuilder with immutable DTO snapshots. No HTTP or JSON guesses in build().
- Keep independent forms/actions separately busy and preserve safe input after recoverable
  validation/network failures.
- Dispose listeners, timers, cancel tokens, byte previews and obsolete pending actions on screen/account
  loss.
- Parser/repository/controller tests use fake transport, clock, token store and UUID factory; widgets use
  injected fakes.

### Screen and interaction states

- Initial loading exposes progress and accessible labels without a private-data flash.
- Empty success explains the next supported step; unavailable includes Retry and does not pretend there
  are zero records.
- Recoverable refresh failure can retain permitted stale reads with a visible warning; paging failure has
  separate Retry.
- Validation focuses the first invalid field and associates labels/errors semantically; safe input
  remains editable.
- Submitting disables duplicate action; uncertain mutation explains reconciliation and preserves only
  supported pending intent.
- Conflict refresh requires review before a new deliberate write. Success follows a confirmed server
  response.
- Forbidden clears affected private content; consent-required offers reading/acceptance; offline offers
  truthful read/retry limits.
- Light-only Material styling follows [Buyer design](../../../design-buyer.md); keyboard/back/focus never
  silently lose safe drafts.
- Use at least 48×48 logical-pixel touch targets, visible focus, text-scale tolerance and non-color status
  cues.
- Android Back/browser Back/cancel return predictably. Confirm destructive actions and warn before
  discarding unsaved form input.

### Verification scenarios

- [ ] Foreign/unaccepted/invalid custody deny contact and accepted stages allow only current server
  permission.
- [ ] Exact lost first-send/reply replay, read state and live Courier exchange handle
  reassignment/terminal/session/cursor recovery safely.
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
- [ ] Record analyze/unit/widget/build and live target results separately; synthetic fixtures are not API
  acceptance.
- [ ] Keep release gates in [integration gaps](../../../references/integration-gaps.md) open until owning
  evidence resolves them.

### Handoff and provenance

Historical backend baseline: 7b1a08a; newly inspected checkout:
`57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`.
Source locators/hashes are optional audit evidence in
[provenance](../../../references/source-provenance.md).
No Flutter implementation checkbox is completed by documentation authoring or route/source inspection.
Append actual implementation/test outcomes to [Progress](../../../PROGRESS.md) and retain prior history.
Follow [architecture](../../../architecture.md), [setup](../../../setup.md) and
[verification](../../../verification.md).

## Additive media contract — 2026-10-06

The implemented Laravel [private media API](../../../api/chat-media.md) adds ordered `attachment_ids` to start/reply and `attachments` to messages. Optional captions and existing scoped history rules apply. This scoped addition supersedes earlier text-only media exclusions without changing imported Flutter implementation/acceptance status; external media adoption remains pending.
