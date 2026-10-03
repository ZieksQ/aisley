---
feature: order-modification-cancellation
role: Customer
platform: Flutter / Dart
phase: 3
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Order cancellation and address correction

## WHAT

Backend: Eligible placed COD mutations, locked reservations, new address snapshots and replay
implemented; shipping-rate revalidation gap remains.

Flutter: **pending**. These are implementation requirements, not completed screens or tests.

Owned eligible Order → confirm cancellation or select saved shipping row → locked action → refreshed state/history.

- Only server-eligible placed COD/pending-payment Orders with required records and no pickup/waybill/task may change. Seller processing closes the window; no invented grace timer.
- Cancel uses optional reason ≤500 and UUID key, releases only its reserved stock once and makes no refund/payment-reversal promise. Modification uses address_id, optional expected_revision and UUID key, validating own complete shipping row and creating new immutable version/history.
- The inspected service does not recalculate the saved shipping rate/coverage on address correction. Record G21 and coordinate material-location handling with backend owner; never derive a replacement fee or serviceability locally.
- On 409 refetch capabilities; freeze uncertain key/payload for exact replay. No quantity/variant/voucher/price/status changes. Address Book edits do not modify Order snapshots.

The local bundle supplies the implementation contract. Upstream paths are optional provenance only.
Use this feature with its prerequisite session/consent boundary and the related shopping or
communication repositories.
The Customer client cannot perform Seller/Admin/Logistics/Courier actions. Current Laravel
ownership and capabilities remain authoritative.

## MUST

### Feature behavior and boundaries

- Only placed COD Orders are currently eligible; Seller processing closes Customer mutation window.
- Confirmation shows current reference and cancellation reason or reviewed replacement address.
- Cancellation reason optional nullable ≤500; never send status/payment/quantity/owner fields.
- Cancellation uses UUID key and releases owned reserved inventory once; current vouchers do not
  regain capacity.
- Address correction selects owned shipping/both address and sends optional expected_revision from
  deliveryAddress.version.
- Send known revision to detect stale screen even though API accepts omission/null.
- Address CRUD alone never changes Order; explicit correction creates a new immutable address
  version.
- Item/quantity/variant/price/payment/provider modifications are unavailable and must not enter the
  form.
- ORDER_NOT_CANCELLABLE/ORDER_NOT_MODIFIABLE are authoritative409; refresh detail and close
  disabled action.
- Address unchanged/stale revision/transition conflict preserve safe input until current detail is
  reviewed.
- Unknown/foreign/incomplete/non-shipping address yields field error or scoped failure; no client
  owner override.
- One frozen key/payload per deliberate action; exact replay reconciles lost response rather than
  repeat stock release.
- Changing reason/address after uncertainty requires reconciliation before a new key.
- Do not queue an offline correction/cancellation or optimistically advance Order status.
- Address correction checks completeness/eligibility but does not demonstrate new
  published-rate/coverage recalculation.
- Material-location correction remains G21 release review; never promise automatic shipping fee
  adjustment.
- Address version in returned Order is refreshed along with actions/timeline/totals after success.
- Another Shop Order in the same Batch has independent status/cancellation; never cancel Batch
  implicitly.
- Test placed COD success/replay, processing race, stale/unchanged revision and foreign
  Order/Address UUID.
- Test inventory release once, vouchers capacity unchanged, old snapshot preservation and uncertain
  correction retry.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient
authority.

- `POST /api/v1/customer/orders/{order}/cancel` → HTTP 200; `{data:Order}`.
  Request: reason optional nullable string≤500; UUID header; placed COD only.
  Replay: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- `PATCH /api/v1/customer/orders/{order}/modification` → HTTP 200; `{data:Order}`.
  Request: address_id owned shipping UUID; expected_revision optional nullable int≥1 (send deliveryAddress.version); UUID header; placed COD only.
  Replay: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/order-modification-cancellation.json).
Examples are source-derived synthetic fixtures, not live captures or usable test accounts.

### Response fields and nesting

The following top-level DTO fields use `?` for null and `~` for omission; otherwise the field is
required.
Named nested types and all child keys are defined in the local [wire
tables](../../../api/field-index.md)
and [schema](../../../api/dto-schema.json); those definitions are part of this spec, not upstream
reading.
UUID/cursor are strings; int is integral JSON; number accepts JSON int/double; timestamps are
ISO-8601 UTC.
money is a decimal string with exact minor-unit parsing; URL requires trusted-origin/path
validation.
Never default a missing required object/list to empty success. Unknown enum values disable
unsupported actions.

| DTO | Wire fields and types |
| --- | --- |
| `Order` | `id: UUID`, `reference: string`, `checkoutBatchId: UUID?`, `placedAt: timestamp`, `latestTrackingAt: timestamp`, `status: string`, `statusLabel: string`, `group: string`, `groupLabel: string`, `shop: OrderShop`, `items: ReviewableItem[]`, `deliveryAddress: DeliveryAddress`, `payment: Payment`, `vouchers: OrderVoucher[]`, `totals: Totals`, `timeline: Tracking[]`, `timelineCount: int`, `timelineHasMore: bool`, `trackingUrl: URL`, `delivery: Delivery?`, `map: UnavailableMap`, `actions: OrderActions` |
| `OrderActions` | `canCancel: bool`, `canModify: bool`, `canReview: bool`, `modifiableFields: string[]` |
| `DeliveryAddress` | `version: int`, `recipientName: string`, `contactNumber: string`, `addressLine1: string`, `addressLine2: string?`, `barangay: string`, `cityMunicipality: string`, `province: string`, `region: string`, `postalCode: string`, `country: string` |

### Errors, ownership and recovery

HTTP 401 clears invalid identity/token and every private feature state through SessionController.
Explicit account/role403 clears identity; resource403/404 clears only affected records unless it
signals account loss.
POLICY_CONSENT_REQUIRED preserves valid authentication, blocks protected work and opens current
consent.
HTTP 422 binds errors by exact request field name and preserves safe editable input; errors/code may
be absent.
HTTP 409 refreshes authoritative state and explains conflict; never silently change a key or replay
a changed payload.
HTTP 429 honors readable Retry-After and disables repeat action until cooldown; unavailable header
is not a guessed server guarantee.
Network/CORS/decode/timeout/5xx have distinct feedback. A failed exchange does not prove a mutation
rolled back.
No offline write queue is authorized. Reconcile unsupported replay before a deliberate new action.
Duplicate submits are disabled. Supported uncertain UUID writes retain exact key and payload in
session memory.
Queries/pages belong to a full request signature and session generation. Drop stale success/error
on either change.
Private data is memory-only by default; token is secure-store only, guest recency holds bounded
public hints only.
Local [failure contracts](../../../api/errors.md) define concrete codes and examples; do not
require a universal error envelope.

## HOW

### Responsibility and state ownership

- `OrderMutationRepository` owns typed transport, parsing and owned cache access; inject
  dependencies through AppDependencies.
- `CancelViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `AddressCorrectionViewModel` owns feature transitions, draft/query state and deliberate actions;
  inject dependencies through AppDependencies.
- Screens compose focused sections/forms/history; reusable widgets render typed state and forward
  callbacks.
- Use ChangeNotifier/ListenableBuilder with immutable DTO snapshots. No HTTP or JSON guesses in
  build().
- Keep independent forms/actions separately busy and preserve safe input after recoverable
  validation/network failures.
- Dispose listeners, timers, cancel tokens, byte previews and obsolete pending actions on
  screen/account loss.
- Parser/repository/controller tests use fake transport, clock, token store and UUID factory;
  widgets use injected fakes.

### Screen and interaction states

- Initial loading exposes progress and accessible labels without a private-data flash.
- Empty success explains the next supported step; unavailable includes Retry and does not pretend
  there are zero records.
- Recoverable refresh failure can retain permitted stale reads with a visible warning; paging
  failure has separate Retry.
- Validation focuses the first invalid field and associates labels/errors semantically; safe input
  remains editable.
- Submitting disables duplicate action; uncertain mutation explains reconciliation and preserves
  only supported pending intent.
- Conflict refresh requires review before a new deliberate write. Success follows a confirmed
  server response.
- Forbidden clears affected private content; consent-required offers reading/acceptance; offline
  offers truthful read/retry limits.
- Light-only Material styling follows [Buyer design](../../../design-buyer.md); keyboard/back/focus
  never silently lose safe drafts.
- Use at least 48×48 logical-pixel touch targets, visible focus, text-scale tolerance and non-color
  status cues.
- Android Back/browser Back/cancel return predictably. Confirm destructive actions and warn before
  discarding unsaved form input.

### Verification scenarios

- [ ] Seller-processing race/stale revision/key replay yield one permissible outcome and release
  stock once.
- [ ] Correction preserves previous address versions and shows current
  capability/error/shipping-gap boundaries.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus,
  supported permission/retry states and cleanup after identity loss.
- [ ] DTO fixtures reject wrong required types, distinguish null/absent/false/empty and preserve
  wire casing.
- [ ] Each consumed operation uses its documented method/body/envelope and correct public/private
  credential behavior.
- [ ] Exercise normal, empty, malformed, denied, consent-required, validation, conflict, throttle,
  offline and timeout outcomes.
- [ ] Delayed responses/errors after logout/account switch cannot repopulate private state or
  restart disposed work.
- [ ] Same-key replay applies only where supported; additive Cart/image requests are never globally
  retried.
- [ ] Narrow Android/browser layouts, TalkBack order, large text, touch targets, keyboard insets
  and Back/cancel are checked.
- [ ] Record analyze/unit/widget/build and live target results separately; synthetic fixtures are
  not API acceptance.
- [ ] Keep release gates in [integration gaps](../../../references/integration-gaps.md) open until
  owning evidence resolves them.

### Handoff and provenance

Historical backend baseline: 7b1a08a; newly inspected checkout:
`57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`.
Source locators/hashes are optional audit evidence in
[provenance](../../../references/source-provenance.md).
No Flutter implementation checkbox is completed by documentation authoring or route/source
inspection.
Append actual implementation/test outcomes to [Progress](../../../PROGRESS.md) and retain prior
history.
Follow [architecture](../../../architecture.md), [setup](../../../setup.md) and
[verification](../../../verification.md).
