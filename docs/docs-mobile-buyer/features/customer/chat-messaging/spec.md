---
feature: chat-messaging
role: Customer
platform: Flutter / Dart
phase: 4
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Shop messages

## WHAT

Backend: Shared Customer–Shop thread APIs, Seller replies and Shop unread-count implemented;
retention/release gates remain.

Flutter: **pending**. These are implementation requirements, not completed screens or tests.

Shop/Product/owned Order → first valid message → one reused Shop thread → reply/read/history.

- Use conversations and customer_shop; start shop_id/body with optional Product/Order context, server-derived Seller. Thread persists only on committed first message and is reused across contexts.
- Text ≤2,000, UUID start/send key, server sequence/time/mine; read body uses sequence. Shop list/history envelopes are items/next_cursor, inbox adds unread_count. Context availability and send_allowed come from server.
- Poll visible online only, freeze uncertain body/context/key, and retain pending first-send through polling. Older cursor gaps remain reachable and monotonic read is separate from all other channels/notifications/tickets.
- Seller permission loss disables sends while scoped history remains readable. No attachments, typing/presence/edit/delete/Admin blanket transcript access/offline queue.

The local bundle supplies the implementation contract. Upstream paths are optional provenance only.
Use this feature with its prerequisite session/consent boundary and the related shopping or communication
repositories.
The Customer client cannot perform Seller/Admin/Logistics/Courier actions. Current Laravel ownership and
capabilities remain authoritative.

## MUST

### Feature behavior and boundaries

- One reused Customer–Shop relationship handles Product/owned Order contexts; thread is not one per Order.
- First valid message persists the thread; merely opening composer creates no empty conversation.
- Start sends shop_id/body and optional Product/Order context; Seller identity is always server-derived.
- Product context must currently belong to public Shop; owned Order context must belong to that Shop.
- Later messages can include valid contexts; no arbitrary user recipient search exists.
- Shop summary has no kind/read_only_reason; customer_name is null for Customer viewer.
- Shop inbox/history use items/next_cursor, unlike operational data/meta; dedicated unread_count route
  exists.
- Message context may be null or an unavailable placeholder with null id/url; never infer raw Product
  metadata.
- Read body uses sequence≥1; do not send operational last_read_sequence to Shop API.
- History cursor selection is newest-first, page output ascending; render chronological
  sequence/time/mine.
- Fixed inbox20/history30, no configurable limit. Cursor≤2048 is opaque.
- Poll visible online screen every 15s plus focus/reconnect; pause background/offline/disposed timers.
- Freeze body/context/key after uncertain first/send. Polling cannot discard unresolved first-send
  context.
- 201 new and replay are successful; IDs/sequence deduplicate lost-response retry.
- 409 idempotency or relationship conflict needs refresh/review; do not silently generate another key.
- Seller inactive/permission loss disables sends while authorized scoped history remains readable.
- Incoming messages do not steal input focus or force scrolling away from older history; expose
  new-message cue.
- No attachments/edit/delete/presence/calls/offline queue/Admin transcript access is provided.
- Test start reuse across Product/Order, foreign context, missing/changed UUID key, server plain text and
  readonly Seller.
- Test late polling vs pending start, older-history gaps, monotonic read, throttled same-key retry and
  live Seller reply.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient authority.

- `GET /api/v1/customer/conversations` → HTTP 200; `{items:ShopConversation[],next_cursor:string?,unread_count:int}`.
  Request: cursor opaque≤2048; fixed20 inbox/fixed30 history; no limit field.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `POST /api/v1/customer/conversations` → HTTP 201; `{conversation:ShopConversation,message:ShopMessage}`.
  Request: shop_id UUID; body trimmed string 1–2000; optional context_type product|order with context_id UUID; UUID header.
  Replay: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- `GET /api/v1/customer/conversations/{conversation}` → HTTP 200; `{data:ShopConversation}`.
  Request: No parameters.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `GET /api/v1/customer/conversations/{conversation}/messages` → HTTP 200; `{items:ShopMessage[],next_cursor:string?}`.
  Request: cursor opaque≤2048; fixed20 inbox/fixed30 history; no limit field.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `POST /api/v1/customer/conversations/{conversation}/messages` → HTTP 201; `{conversation:ShopConversation,message:ShopMessage}`.
  Request: body trimmed1–2000; UUID header; Shop allows optional validated product|order context_type/context_id; operational sends body only.
  Replay: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- `POST /api/v1/customer/conversations/{conversation}/read` → HTTP 200; `{data:ShopConversation}`.
  Request: sequence required int≥1, cannot exceed committed history; monotonic.
  Replay: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- `GET /api/v1/customer/conversations/unread-count` → HTTP 200; `{unread_count:int}`.
  Request: No parameters.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/chat-messaging.json).
Examples are source-derived synthetic fixtures, not live captures or usable test accounts.

### Response fields and nesting

The following top-level DTO fields use `?` for null and `~` for omission; otherwise the field is required.
Named nested types and all child keys are defined in the local [wire tables](../../../api/field-index.md)
and [schema](../../../api/dto-schema.json); those definitions are part of this spec, not upstream reading.
UUID/cursor are strings; int is integral JSON; number accepts JSON int/double; timestamps are ISO-8601
UTC.
money is a decimal string with exact minor-unit parsing; URL requires trusted-origin/path validation.
Never default a missing required object/list to empty success. Unknown enum values disable unsupported
actions.

| DTO | Wire fields and types |
| --- | --- |
| `ShopConversation` | `id: UUID`, `shop: ChatShop`, `customer_name: null`, `last_message_preview: string?`, `last_message_at: timestamp?`, `last_sequence: int`, `last_read_sequence: int`, `unread_count: int`, `send_allowed: bool` |
| `ShopMessage` | `id: UUID`, `sequence: int`, `body: string`, `mine: bool`, `sender_role: string`, `context: MessageContext?`, `created_at: timestamp?` |
| `MessageContext` | `type: string`, `id: UUID?`, `label: string`, `url: URL?` |

### Errors, ownership and recovery

HTTP 401 clears invalid identity/token and every private feature state through SessionController.
Explicit account/role403 clears identity; resource403/404 clears only affected records unless it signals
account loss.
POLICY_CONSENT_REQUIRED preserves valid authentication, blocks protected work and opens current consent.
HTTP 422 binds errors by exact request field name and preserves safe editable input; errors/code may be
absent.
HTTP 409 refreshes authoritative state and explains conflict; never silently change a key or replay a
changed payload.
HTTP 429 honors readable Retry-After and disables repeat action until cooldown; unavailable header is not a
guessed server guarantee.
Network/CORS/decode/timeout/5xx have distinct feedback. A failed exchange does not prove a mutation rolled
back.
No offline write queue is authorized. Reconcile unsupported replay before a deliberate new action.
Duplicate submits are disabled. Supported uncertain UUID writes retain exact key and payload in session
memory.
Queries/pages belong to a full request signature and session generation. Drop stale success/error on
either change.
Private data is memory-only by default; token is secure-store only, guest recency holds bounded public
hints only.
Local [failure contracts](../../../api/errors.md) define concrete codes and examples; do not require a
universal error envelope.

## HOW

### Responsibility and state ownership

- `ShopChatRepository` owns typed transport, parsing and owned cache access; inject dependencies through
  AppDependencies.
- `ShopInboxViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `ShopThreadViewModel` owns feature transitions, draft/query state and deliberate actions; inject
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
- Validation focuses the first invalid field and associates labels/errors semantically; safe input remains
  editable.
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

- [ ] Entry/context ownership reuses correct thread and never exposes another Shop or Customer.
- [ ] Lost first-send/send replay, sequence/read/cursor reconciliation and live Seller exchange work with
  read-only/offline/error states.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported
  permission/retry states and cleanup after identity loss.
- [ ] DTO fixtures reject wrong required types, distinguish null/absent/false/empty and preserve wire
  casing.
- [ ] Each consumed operation uses its documented method/body/envelope and correct public/private
  credential behavior.
- [ ] Exercise normal, empty, malformed, denied, consent-required, validation, conflict, throttle, offline
  and timeout outcomes.
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
