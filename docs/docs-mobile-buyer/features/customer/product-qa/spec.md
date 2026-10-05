---
feature: product-qa
role: Customer
platform: Flutter / Dart
phase: 4
flutter_status: Implemented; acceptance partial
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Public Product questions

## WHAT

Backend: Public Product Q&A, active-Customer ask, owning Seller official answer and
after-commit alerts implemented.

Flutter (external project report): **implemented; acceptance partial**. See [Phase 4 evidence](../../../references/phase-4-verification.md).
Broad counterpart/device and concurrency criteria remain open.

Visible Product questions → ask after auth/consent → committed question → official answer/allowed notification.

- Public read is Product-visibility-gated and bounded page/limit. Asking does not need purchase proof.
- Create accepts question (not question_text), normalized plain text ≤1,000 and UUID key; no owner/Seller/answer/attachment fields. Exact retries preserve one logical question and after-commit alert.
- Display one official Seller answer without Customer answer/edit permissions; render escaped text. Q&A is public Product knowledge distinct from private chat/verified Review. Hidden Products never leak their historical Q&A; answer notification maps to the allowed Product anchor.

The local bundle supplies the implementation contract. Upstream paths are optional
provenance only.
Use this feature with its prerequisite session/consent boundary and the related shopping or
communication repositories.
The Customer client cannot perform Seller/Admin/Logistics/Courier actions. Current Laravel
ownership and capabilities remain authoritative.

Buyer presentation requires verified active Customer identity and required consent for every shopping
screen; public backend methods/envelopes remain unchanged. Auth/recovery/Terms/Privacy stay reachable.
Phone/tablet padding, natural content heights and keyboard/text resizing follow [Buyer design](../../../design-buyer.md).

## MUST

### Feature behavior and boundaries

- Public Q&A lists only current visible Product questions; no public Customer
  contact/identity is exposed.
- Each Question has nullable answer/answeredAt/sellerLabel; unanswered is a legitimate
  state.
- Order is newest asked_at/UUID tie-break, normal page/limit default 10 max50.
- Active approved Customer+consent can ask; guests open sign-in with a safe Product/Q&A
  return.
- Question field is question, never body/description; required trimmed plain text≤1,000.
- Normalize Unicode/newlines consistently; unsafe HTML/Markdown/scripts/control characters
  are rejected.
- No owner/seller/Product ID payload override; Product UUID comes from route and Laravel
  visibility.
- UUID header supports exact question replay; changed question under one key conflicts.
- Disable duplicate submits and freeze uncertain normalized question/key until reconciled.
- 201 including replay represents committed question, not an optimistic local success.
- Only owning Seller provides an official answer through their role app; Buyer cannot mutate
  answer.
- Public answer label is safe Shop/Seller name; never derive private Seller contacts.
- Official after-commit answer alert belongs to notification inbox and maps to Product Q&A
  section.
- No free-form chat thread, customer replies, moderation/edit/delete/attachments or push
  promise.
- Product visibility loss404 clears question composer/history context without leaking hidden
  Product.
- Ask error remains separate from list error; preserve safe draft after
  correctable422/throttle.
- Plain text rendering prevents link/script execution; accessibility reads question followed
  by official answer.
- Page retry retains existing rows and deduplicates question IDs without invented cursors.
- Test unanswered/answered nullability, visible/hidden Product, Unicode/plain text
  and1000/1001 boundary.
- Test UUID exact replay/changed key payload, double submit, approval/consent denial and
  owning Seller answer alert.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no
credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or
recipient authority.

- `GET /api/v1/products/{product}/questions` → HTTP 200; `{data:Question[],links:PageLinks,meta:PageMeta}`.
  Request: page1–10000; limit1–50 default 10.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `POST /api/v1/products/{product}/questions` → HTTP 201; `{data:Question}`.
  Request: question required trimmed plain text≤1,000; rejects unsafe HTML/Markdown/control characters and extra fields; UUID header.
  Replay: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/product-qa.json).
Examples are source-derived synthetic fixtures, not live captures or usable test accounts.

### Response fields and nesting

The following top-level DTO fields use `?` for null and `~` for omission; otherwise the
field is required.
Named nested types and all child keys are defined in the local [wire
tables](../../../api/field-index.md)
and [schema](../../../api/dto-schema.json); those definitions are part of this spec, not
upstream reading.
UUID/cursor are strings; int is integral JSON; number accepts JSON int/double; timestamps
are ISO-8601 UTC.
money is a decimal string with exact minor-unit parsing; URL requires trusted-origin/path
validation.
Never default a missing required object/list to empty success. Unknown enum values disable
unsupported actions.

| DTO | Wire fields and types |
| --- | --- |
| `Question` | `id: UUID`, `question: string`, `askedAt: timestamp?`, `answer: string?`, `answeredAt: timestamp?`, `sellerLabel: string?` |

### Errors, ownership and recovery

HTTP 401 clears invalid identity/token and every private feature state through
SessionController.
Explicit account/role403 clears identity; resource403/404 clears only affected records
unless it signals account loss.
POLICY_CONSENT_REQUIRED preserves valid authentication, blocks protected work and opens
current consent.
HTTP 422 binds errors by exact request field name and preserves safe editable input;
errors/code may be absent.
HTTP 409 refreshes authoritative state and explains conflict; never silently change a key or
replay a changed payload.
HTTP 429 honors readable Retry-After and disables repeat action until cooldown; unavailable
header is not a guessed server guarantee.
Network/CORS/decode/timeout/5xx have distinct feedback. A failed exchange does not prove a
mutation rolled back.
No offline write queue is authorized. Reconcile unsupported replay before a deliberate new
action.
Duplicate submits are disabled. Supported uncertain UUID writes retain exact key and payload
in session memory.
Queries/pages belong to a full request signature and session generation. Drop stale
success/error on either change.
Private data is memory-only; token is secure-store only. Recently Viewed is account-only.
Never write or merge guest hints; legacy-key cleanup must not delay authentication.
Local [failure contracts](../../../api/errors.md) define concrete codes and examples; do not
require a universal error envelope.

## HOW

### Responsibility and state ownership

- `QuestionRepository` owns typed transport, parsing and owned cache access; inject
  dependencies through AppDependencies.
- `QuestionListViewModel` owns feature transitions, draft/query state and deliberate
  actions; inject dependencies through AppDependencies.
- `AskQuestionViewModel` owns feature transitions, draft/query state and deliberate actions;
  inject dependencies through AppDependencies.
- Screens compose focused sections/forms/history; reusable widgets render typed state and
  forward callbacks.
- Use ChangeNotifier/ListenableBuilder with immutable DTO snapshots. No HTTP or JSON guesses
  in build().
- Keep independent forms/actions separately busy and preserve safe input after recoverable
  validation/network failures.
- Dispose listeners, timers, cancel tokens, byte previews and obsolete pending actions on
  screen/account loss.
- Parser/repository/controller tests use fake transport, clock, token store and UUID
  factory; widgets use injected fakes.

### Screen and interaction states

- Initial loading exposes progress and accessible labels without a private-data flash.
- Empty success explains the next supported step; unavailable includes Retry and does not
  pretend there are zero records.
- Recoverable refresh failure can retain permitted stale reads with a visible warning;
  paging failure has separate Retry.
- Validation focuses the first invalid field and associates labels/errors semantically; safe
  input remains editable.
- Submitting disables duplicate action; uncertain mutation explains reconciliation and
  preserves only supported pending intent.
- Conflict refresh requires review before a new deliberate write. Success follows a
  confirmed server response.
- Forbidden clears affected private content; consent-required offers reading/acceptance;
  offline offers truthful read/retry limits.
- Light-only Material styling follows [Buyer design](../../../design-buyer.md);
  keyboard/back/focus never silently lose safe drafts.
- Use at least 48×48 logical-pixel touch targets, visible focus, text-scale tolerance and
  non-color status cues.
- Android Back/browser Back/cancel return predictably. Confirm destructive actions and warn
  before discarding unsaved form input.

### Verification scenarios

- [ ] Public visibility and Customer question/key/role/consent/limits match Requests.
- [ ] Retry/throttle/error and official answer/notification rendering retain safe drafts and
  omit private identities.
- [ ] Android and fixed-origin local browser verify loading/empty/errors,
  keyboard/back/focus, supported permission/retry states and cleanup after identity loss.
- [ ] DTO fixtures reject wrong required types, distinguish null/absent/false/empty and
  preserve wire casing.
- [ ] Each consumed operation uses its documented method/body/envelope and correct
  public/private credential behavior.
- [ ] Exercise normal, empty, malformed, denied, consent-required, validation, conflict,
  throttle, offline and timeout outcomes.
- [ ] Delayed responses/errors after logout/account switch cannot repopulate private state
  or restart disposed work.
- [ ] Same-key replay applies only where supported; additive Cart/image requests are never
  globally retried.
- [ ] Narrow Android/browser layouts, TalkBack order, large text, touch targets, keyboard
  insets and Back/cancel are checked.
- [ ] Record analyze/unit/widget/build and live target results separately; synthetic
  fixtures are not API acceptance.
- [ ] Keep release gates in [integration gaps](../../../references/integration-gaps.md) open
  until owning evidence resolves them.

### Handoff and provenance

Historical backend baseline: 7b1a08a; newly inspected checkout:
`57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`.
Source locators/hashes are optional audit evidence in
[provenance](../../../references/source-provenance.md).
No Flutter implementation checkbox is completed by documentation authoring or route/source
inspection.
Append actual implementation/test outcomes to [Progress](../../../PROGRESS.md) and retain
prior history.
Follow [architecture](../../../architecture.md), [setup](../../../setup.md) and
[verification](../../../verification.md).
