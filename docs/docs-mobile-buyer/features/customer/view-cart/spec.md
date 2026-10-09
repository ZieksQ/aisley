---
feature: view-cart
role: Customer
platform: Flutter / Dart
phase: 3
flutter_status: Implemented; acceptance partial
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Cart configuration

## WHAT

Backend: Cart routes/tables/service/Resources/tests implemented despite stale Draft spec claiming no
API.

Flutter (external project report): **implemented; acceptance partial**. See [Phase 3 evidence](../../../references/phase-3-verification.md); live-account/device gates remain open.

Valid Product configuration → Add → owned lines → quantity/variation/remove → selected checkout.

- Send product_id,variant_id,quantity only. Same configuration increments/merges, different variants stay separate; valid required variant belongs to Product. PATCH quantity/variant atomically validates/merges or preserves original line on failure.
- Cart never reserves Inventory. Display current server prices/ordered choices/availability, preserve unavailable intent and exclude ineligible selected checkout. itemCount is quantity total, distinctItemCount line total; numeric subtotals are display only.
- No guest Cart/merge. Disable duplicate taps; additive POST has no durable UUID replay contract, so uncertain adds need refetch/explanation rather than automatic incrementing again.

The local bundle supplies the implementation contract. Upstream paths are optional provenance only.
Use this feature with its prerequisite session/consent boundary and the related shopping or
communication repositories.
The Customer client cannot perform Seller/Admin/Logistics/Courier actions. Current Laravel ownership
and capabilities remain authoritative.

Buyer presentation requires verified active Customer identity and required consent for every shopping
screen; public backend methods/envelopes remain unchanged. Auth/recovery/Terms/Privacy stay reachable.
Phone/tablet/desktop padding, natural content heights and keyboard/text resizing follow [Buyer design](../../../design-buyer.md).

## MUST

### Feature behavior and boundaries

- Cart is authenticated owned server state; no guest Cart or local Cart merge is available.
- GET and every mutation return the full data Cart; normal empty Cart may still have a UUID.
- itemCount is quantity sum, distinctItemCount counts configurations; do not confuse badge meanings.
- Cart numeric totals are display hints and include availableSubtotal separately from full subtotal.
- Each line has safe Product link, nullable variant/media and selectedOptions; retain configuration
  labels.
- Add requires present variant_id including null; same configuration increases existing quantity.
- No UUID header makes additive POST replay-safe; timeout rereads Cart before deliberate adjustment.
- Quantity PATCH is absolute; variant PATCH can merge with an existing configuration and
  remove/change old line IDs.
- Replace full Cart projection after success instead of locally patching obsolete line references.
- Remove returns full Cart200 rather than204; confirm destructive removal before request.
- availability reason distinguishes product_unavailable, variant_unavailable, out_of_stock and
  insufficient_stock.
- availableQuantity is current projection; Laravel validates stock/visibility at every later
  commerce step.
- Unavailable lines remain visible with remove/configure guidance and cannot be selected for
  checkout.
- Checkout handoff contains distinct owned cart_item_ids only, excluding unchecked/unavailable
  lines.
- Quote invalidation follows changed selected lines/quantity/variant/address/vouchers; no client
  price payload.
- Only selected Cart lines are removed after successful placement; Buy Now leaves Cart untouched.
- Serialize line edits and prevent duplicate Add; failed refresh cannot mark an uncertain write
  rolled back.
- Keep selection IDs reconciled against returned Cart after variant merge/delete and clear on
  account loss.
- Keep the 48px Cart selection checkbox on the left. Put text buttons named “View product”, “Edit cart
  item” and “Remove cart item” on the right, preserving the existing removal confirmation.
- On narrow screens or enlarged text, place the Cart actions below item details, right aligned and
  wrapping without clipping; retain 48px targets and visible focus. A full-width bottom divider separates each complete item and its actions.
- Tri-state Select all acts once in the Cart controller on eligible lines across Shop groups. A
  partial selection fills remaining eligible lines; a full selection clears them. Existing edit
  locks, quote invalidation and server-response reconciliation still apply.
- Test configuration add/increment, absolute quantity update, variant merge and changed line IDs.
- Test foreign item404, unavailable/insufficient stock, timeout reread, partial selection and empty
  Cart200.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient
authority.

- `GET /api/v1/customer/cart` → HTTP 200; `{data:Cart}`.
  Request: No input.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `POST /api/v1/customer/cart/items` → HTTP 200; `{data:Cart}`.
  Request: product_id UUID; variant_id present nullable UUID; quantity int 1–2147483647; server enforces visibility/complete variant/stock.
  Replay: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- `PATCH /api/v1/customer/cart/items/{item}` → HTTP 200; `{data:Cart}`.
  Request: quantity int 1–2147483647 and/or variant_id nullable UUID; at least one supported field; variant must belong to Product.
  Replay: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- `DELETE /api/v1/customer/cart/items/{item}` → HTTP 200; `{data:Cart}`.
  Request: Owned Cart Item UUID; no body.
  Replay: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/view-cart.json).
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
| `Cart` | `id: UUID`, `itemCount: int`, `distinctItemCount: int`, `subtotal: number`, `availableSubtotal: number`, `items: CartItem[]` |
| `CartItem` | `id: UUID`, `quantity: int`, `unitPrice: number`, `lineSubtotal: number`, `product: CartProduct`, `variant: CartVariant?`, `selectedOptions: SelectedOption[]`, `media: CartMedia`, `availability: CartAvailability` |
| `CartAvailability` | `isAvailable: bool`, `reason: string?`, `availableQuantity: int` |

### Errors, ownership and recovery

HTTP 401 clears invalid identity/token and every private feature state through SessionController.
Explicit account/role403 clears identity; resource403/404 clears only affected records unless it
signals account loss.
POLICY_CONSENT_REQUIRED preserves valid authentication, blocks protected work and opens current
consent.
HTTP 422 binds errors by exact request field name and preserves safe editable input; errors/code may
be absent.
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
Local [failure contracts](../../../api/errors.md) define concrete codes and examples; do not require
a universal error envelope.

## HOW

### Responsibility and state ownership

- `CartRepository` owns typed transport, parsing and owned cache access; inject dependencies through
  AppDependencies.
- `CartViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `CartLineEditor` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
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

- [ ] Variant upsert/substitution/separate-line and stock/visibility conflicts return current Cart.
- [ ] Owned reads/badges and uncertain/duplicate/session/consent failures do not double-add or
  reserve stock.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus,
  supported permission/retry states and cleanup after identity loss.
- [x] DTO fixtures reject wrong required types, distinguish null/absent/false/empty and preserve
  wire casing.
- [x] Each consumed operation uses its documented method/body/envelope and correct public/private
  credential behavior.
- [ ] Exercise normal, empty, malformed, denied, consent-required, validation, conflict, throttle,
  offline and timeout outcomes.
- [x] Delayed responses/errors after logout/account switch cannot repopulate private state or
  restart disposed work.
- [ ] Same-key replay applies only where supported; additive Cart/image requests are never globally
  retried.
- [ ] Narrow Android/browser layouts, TalkBack order, large text, touch targets, keyboard insets and
  Back/cancel are checked.
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

Spec revision 2026-10-04: Phase 3 client implemented against the unchanged inspected checkout;
synthetic verification is separate from live commerce and installed-device acceptance.
