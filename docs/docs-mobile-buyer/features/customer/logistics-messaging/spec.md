---
feature: logistics-messaging
role: Customer
platform: Flutter / Dart
phase: 4
flutter_status: Implemented; acceptance partial
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Logistics delivery messages

## WHAT

Backend: Separate owned active-Order/current-handler text/history/send/read APIs implemented.

Flutter (external project report): **implemented; acceptance partial**. See [Phase 4 evidence](../../../references/phase-4-verification.md).
Broad counterpart/device and concurrency criteria remain open.

Active owned Order → Order-context first message → current Logistics thread → scoped reply/history/read.

- Use logistics-conversations and kind customer_logistics; first message body/context_type:order/context_id plus UUID key. API resolves current organization/hub from Shipment or compatible waybill, never Buyer recipient choice.
- Payment-wait/placed/preprocessing/terminal and in-transfer/invalid-handler states cannot start/send; API eligibility is authoritative. Ended context retains original participant read-only history; replacement handler never inherits private text.
- Use operational data/meta, send body only, read last_read_sequence; channel owns its cursor/unread/pending key. Bounded foreground polling/frozen uncertain sends; no attachments/provider picker/task mutations/offline queue.

The local bundle supplies the implementation contract. Upstream paths are optional provenance only.
Use this feature with its prerequisite session/consent boundary and the related shopping or
communication repositories.
The Customer client cannot perform Seller/Admin/Logistics/Courier actions. Current Laravel ownership
and capabilities remain authoritative.

Buyer presentation requires verified active Customer identity and required consent for every shopping
screen; public backend methods/envelopes remain unchanged. Auth/recovery/Terms/Privacy stay reachable.
Phone/tablet padding, natural content heights and keyboard/text resizing follow [Buyer design](../../../design-buyer.md).

## MUST

### Feature behavior and boundaries

- This channel is Customer–Logistics delivery chat, separate from Shop and Courier task chat.
- Start accepts owned Order context only; handling organization/hub/recipient is resolved by server.
- An active Order alone is insufficient when no valid current handling organization exists.
- Custody/organization/Order status are rechecked under locks for start/send.
- No Customer endpoint lists arbitrary Logistics users or permits choosing a hub as message recipient.
- Inbox/history use data/meta with next_cursor; inbox meta.unread_count is channel total.
- No dedicated Logistics-chat unread route exists; do not derive total from visible page alone.
- Summary includes kind customer_logistics, order IDs/reference, counterpart label and
  read_only_reason.
- Message uses conversation_id,sequence,sender_role,mine,body,created_at; no Shop Product context.
- Read sends last_read_sequence≥1; message sequence beyond committed history returns validation.
- Inbox/history limit1–50 default 20, cursor≤2048; output history is ascending per newest-first page.
- 201 new/200 exact replay both reconcile committed message; key is actor-scoped and payload frozen.
- Ending handling/terminal Order disables sends with ORDER_RELATIONSHIP_ENDED while original scoped
  history remains.
- A new handling organization must not inherit another organization’s transcript or draft.
- Poll visible online every 15s; pause background/offline and reject old Customer/session responses.
- Keep pending first-send context during refresh and reachable older cursor when foreground gap
  appears.
- Text only1–2000; no attachments, GPS sharing, Order mutation, delivery proof or cash collection
  permission.
- Retention/abuse policy and operational race/live exchange verification remain release gates.
- Test owned active handler vs foreign/terminal/missing custody, handler replacement and read-only
  history.
- Test exact replay, key conflict, per-channel unread/read isolation and authorized live Logistics
  counterpart reply.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient
authority.

- `GET /api/v1/customer/logistics-conversations` → HTTP 200; `{data:LogisticsConversation[],meta:{next_cursor:string?,unread_count:int}}`.
  Request: cursor opaque≤2048; limit1–50 default 20.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `POST /api/v1/customer/logistics-conversations` → HTTP 201; `{conversation:LogisticsConversation,message:OperationalMessage}`.
  Request: context_type order; context_id owned Order UUID; body trimmed1–2000; UUID header; server resolves counterparty.
  Replay: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- `GET /api/v1/customer/logistics-conversations/{conversation}` → HTTP 200; `{data:LogisticsConversation}`.
  Request: No parameters.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `GET /api/v1/customer/logistics-conversations/{conversation}/messages` → HTTP 200; `{data:OperationalMessage[],meta:{next_cursor:string?}}`.
  Request: cursor opaque≤2048; limit1–50 default 20.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `POST /api/v1/customer/logistics-conversations/{conversation}/messages` → HTTP 201; `{conversation:LogisticsConversation,message:OperationalMessage}`.
  Request: body trimmed1–2000; UUID header; Shop allows optional validated product|order context_type/context_id; operational sends body only.
  Replay: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- `POST /api/v1/customer/logistics-conversations/{conversation}/read` → HTTP 200; `{data:LogisticsConversation}`.
  Request: last_read_sequence required int≥1, cannot exceed committed history; monotonic.
  Replay: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/logistics-messaging.json).
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
| `LogisticsConversation` | `id: UUID`, `kind: string`, `order_id: UUID?`, `order_reference: string?`, `counterparty_role: string`, `counterparty_label: string`, `last_message_preview: string?`, `last_message_at: timestamp?`, `last_sequence: int`, `last_read_sequence: int`, `unread_count: int`, `send_allowed: bool`, `read_only_reason: string?` |
| `OperationalMessage` | `id: UUID`, `conversation_id: UUID`, `sequence: int`, `sender_role: string`, `mine: bool`, `body: string`, `created_at: timestamp?` |

### Errors, ownership and recovery

HTTP 401 clears invalid identity/token and every private feature state through SessionController.
Explicit account/role403 clears identity; resource403/404 clears only affected records unless it
signals account loss.
POLICY_CONSENT_REQUIRED preserves valid authentication, blocks protected work and opens current
consent.
HTTP 422 binds errors by exact request field name and preserves safe editable input; errors/code may be
absent.
HTTP 409 refreshes authoritative state and explains conflict; never silently change a key or replay a
changed payload.
HTTP 429 honors readable Retry-After and disables repeat action until cooldown; unavailable header is
not a guessed server guarantee.
Network/CORS/decode/timeout/5xx have distinct feedback. A failed exchange does not prove a mutation
rolled back.
No offline write queue is authorized. Reconcile unsupported replay before a deliberate new action.
Duplicate submits are disabled. Supported uncertain UUID writes retain exact key and payload in
session memory.
Queries/pages belong to a full request signature and session generation. Drop stale success/error on
either change.
Private data is memory-only; token is secure-store only. Recently Viewed is account-only.
Never write or merge guest hints; legacy-key cleanup must not delay authentication.
Local [failure contracts](../../../api/errors.md) define concrete codes and examples; do not require a
universal error envelope.

## HOW

### Responsibility and state ownership

- `LogisticsChatRepository` owns typed transport, parsing and owned cache access; inject dependencies
  through AppDependencies.
- `LogisticsInboxViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `LogisticsThreadViewModel` owns feature transitions, draft/query state and deliberate actions;
  inject dependencies through AppDependencies.
- Screens compose focused sections/forms/history; reusable widgets render typed state and forward
  callbacks.
- Use ChangeNotifier/ListenableBuilder with immutable DTO snapshots. No HTTP or JSON guesses in
  build().
- Keep independent forms/actions separately busy and preserve safe input after recoverable
  validation/network failures.
- Dispose listeners, timers, cancel tokens, byte previews and obsolete pending actions on
  screen/account loss.
- Parser/repository/controller tests use fake transport, clock, token store and UUID factory; widgets
  use injected fakes.

### Screen and interaction states

- Initial loading exposes progress and accessible labels without a private-data flash.
- Empty success explains the next supported step; unavailable includes Retry and does not pretend
  there are zero records.
- Recoverable refresh failure can retain permitted stale reads with a visible warning; paging failure
  has separate Retry.
- Validation focuses the first invalid field and associates labels/errors semantically; safe input
  remains editable.
- Submitting disables duplicate action; uncertain mutation explains reconciliation and preserves only
  supported pending intent.
- Conflict refresh requires review before a new deliberate write. Success follows a confirmed server
  response.
- Forbidden clears affected private content; consent-required offers reading/acceptance; offline
  offers truthful read/retry limits.
- Light-only Material styling follows [Buyer design](../../../design-buyer.md); keyboard/back/focus
  never silently lose safe drafts.
- Use at least 48×48 logical-pixel touch targets, visible focus, text-scale tolerance and non-color
  status cues.
- Android Back/browser Back/cancel return predictably. Confirm destructive actions and warn before
  discarding unsaved form input.

### Verification scenarios

- [ ] Owned current-handler/custody/terminal eligibility and changed relationship follow server
  responses.
- [ ] Same-key replies/read/history and live Logistics exchange stay isolated through
  offline/read-only/cursor recovery.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus,
  supported permission/retry states and cleanup after identity loss.
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
Append actual implementation/test outcomes to [Progress](../../../PROGRESS.md) and retain prior
history.
Follow [architecture](../../../architecture.md), [setup](../../../setup.md) and
[verification](../../../verification.md).
