---
feature: voucher-usage
role: Customer
platform: Flutter / Dart
phase: 3
flutter_status: Implemented at 57e9eb2; current shipping adoption pending G25
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
current_contract_inspected_checkout: 22b0a48f9575ead182d03c35ab87345711c23b90
---

# Checkout voucher usage

## WHAT

Backend: Existing quote candidate/eligibility/selection/savings/snapshot/redemption implemented;
wallet/claim deferred; Admin/Seller authoring exists outside Customer endpoints.

Flutter (external project report): **implemented against 57e9eb2; newer shipping/voucher contracts unadopted (G25/G26)**. See [Phase 3 evidence](../../../references/phase-3-verification.md); live-account/device gates remain open.

Quote candidates → explicit UUID/target Shop → requote → reviewed savings → placement redeems.

- Selections vouchers:[{voucher_id,target_shop_id}] ≤20; code is display, not accepted code-entry. Candidates may be ineligible with reason. No automatic best selection/claim/wallet API.
- One App voucher of each benefit per batch with explicit eligible Shop targets; Shop voucher only its Shop. At most one discount and one shipping benefit per group, combined by default. Minimum spend uses full target-Shop merchandise before discounts.
- Server time/scopes/exclusions/capacity/customer limit and integer-cent calculation/caps decide saving. Selected zero-saving voucher still redeems; quote reserves nothing. Placement locks/rechecks/redempts atomically and snapshots terms; cancellation/rejection currently does not restore counters.
- Disclose removed/stale choices before another Place action and reject previous-account selections/results.

The current [shipping contract](../../../api/shipping-selection.md) governs provider selection and DTOs;
imported parser/operation checks do not complete G25. Upstream paths are optional provenance only.
Use this feature with its prerequisite session/consent boundary and the related shopping or
communication repositories.
The Customer client cannot perform Seller/Admin/Logistics/Courier actions. Current Laravel ownership
and capabilities remain authoritative.

Buyer presentation requires verified active Customer identity and required consent for every shopping
screen; public backend methods/envelopes remain unchanged. Auth/recovery/Terms/Privacy stay reachable.
Phone/tablet padding, natural content heights and keyboard/text resizing follow [Buyer design](../../../design-buyer.md).

## MUST

### Feature behavior and boundaries

- Voucher selection belongs to quote/checkout; no independent wallet, claim, code-entry or
  voucher-authoring route exists.
- Show existing availableVouchers from each Quote group and submit UUID plus target_shop_id.
- Issuer types are app|shop and benefits discount|shipping; never rename wire values to
  platform|seller.
- Value fixed|percent, maximumDiscount nullable and minimumSpend apply to authoritative qualifying
  basis.
- Scope lists included/excluded Product/Category UUIDs; eligibility and savings remain server
  decisions.
- Candidate eligible/reason/saving are separate; ineligible candidates show reason and remain
  unselectable.
- Selections max20 with distinct voucher_id; target Shop must actually belong to the current checkout.
- Opposite benefits combine by default, including old empty policies; stackableWith describes allowed
  categories and the server enforces one of each benefit per group and one App of each benefit per batch.
- Do not predict stacking solely from one candidate flag or reimplement a discount calculator in the
  view model.
- Changing selection invalidates quote and obtains reviewed authoritative totals before placement.
- Zero-saving selected voucher can still redeem capacity; show it honestly and allow deselection
  before Place.
- Global/per-Customer limits and validFrom/validUntil are checked under placement locks, not local
  clocks alone.
- Voucher capacity expiry/race can make quote stale; refresh and preserve safe intent without
  automatic Place.
- AppliedVouchers expose qualifyingBasis/discountAmount; Order snapshots retain committed
  terms/name/code/amount.
- Cancellation currently does not restore voucher redemption capacity; do not promise reuse or refund.
- Shipping discount reduces the selected provider’s server shipping fee; changing provider requires reviewed
  requote and updated savings. Commission does not increase Customer COD.
- No auto claim, code text injection, implicit promotion opt-in or other Customer’s eligibility
  inspection.
- Candidate failures and checkout unavailable state are distinct from no available vouchers.
- Test minimum spend, exclusions, exhausted/customer-limit/not-started/expired/payment-ineligible and
  default opposite-benefit pairing.
- Test zero saving, maximum cap, changed target Shop, concurrent final capacity and quote-to-Order
  snapshot parity.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient
authority.

- `POST /api/v1/customer/checkout/quote` → HTTP 200; `{data:Quote}`.
  Request: mode cart|buy_now; exactly cart_item_ids distinct UUID[] min1 OR buy_now product_id UUID, present nullable variant_id UUID, quantity1–2147483647; address_id owned UUID; payment_method cod; optional vouchers max20 {voucher_id distinct UUID,target_shop_id UUID}; optional logistics_selections max50 {shop_id distinct UUID,logistics_organization_id UUID}; no owner/prices/status.
  Replay: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- `POST /api/v1/customer/checkout/place` → HTTP 200; `{data:Batch}`.
  Request: mode cart|buy_now; exactly cart_item_ids distinct UUID[] min1 OR buy_now product_id UUID, present nullable variant_id UUID, quantity1–2147483647; address_id owned UUID; payment_method cod; optional vouchers max20 {voucher_id distinct UUID,target_shop_id UUID}; optional logistics_selections max50 {shop_id distinct UUID,logistics_organization_id UUID}; no owner/prices/status. quote_id UUID + UUID header.
  Replay: UUID Idempotency-Key required. Freeze payload/key; exact retry only after uncertain outcome. Changed intent uses a new key after reconciliation.
- `GET /api/v1/customer/checkout/{batch}` → HTTP 200; `{data:Batch}`.
  Request: Owned batch UUID; no body.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/checkout-order.json).
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
| `Voucher` | `id: UUID`, `name: string`, `code: string`, `issuerType: string`, `benefitType: string`, `valueType: string`, `value: money`, `maximumDiscount: money?`, `minimumSpend: money`, `termsSummary: string`, `validFrom: timestamp`, `validUntil: timestamp`, `paymentMethod: string?`, `stackableWith: string[]`, `scope: VoucherScope`, `eligible: bool`, `reason: string?`, `saving: money` |
| `VoucherScope` | `productIds: UUID[]`, `categoryIds: UUID[]`, `excludedProductIds: UUID[]`, `excludedCategoryIds: UUID[]` |
| `AppliedVoucher` | `id: UUID`, `name: string`, `code: string`, `issuerType: string`, `benefitType: string`, `qualifyingBasis: money`, `discountAmount: money` |
| `QuoteGroup` | `shop: QuoteShop`, `items: QuoteItem[]`, `availableVouchers: Voucher[]`, `appliedVouchers: AppliedVoucher[]`, `shippingQuote: ShippingQuote`, `totals: Totals` |
| `Totals` | `merchandiseSubtotal: money`, `shippingFee: money`, `discount: money`, `shippingDiscount: money`, `payable: money`, `currency: string` |

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

- `CheckoutRepository` owns typed transport, parsing and owned cache access; inject dependencies
  through AppDependencies.
- `VoucherSelectionViewModel` owns feature transitions, draft/query state and deliberate actions;
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

- [ ] Current nullable provider/shipping projections and related selection effects pass G25 client verification.
- [ ] Targeting, stacking/reasons/zero-saving/current amount display are server-driven.
- [ ] Voucher-bearing replay/rollback/capacity conflicts and account switch do not double-consume or
  silently retarget.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus,
  supported permission/retry states and cleanup after identity loss.
- [ ] DTO fixtures reject wrong required types, distinguish null/absent/false/empty and preserve wire
  casing.
- [ ] Each consumed operation uses its documented method/body/envelope and correct public/private
  credential behavior.
- [ ] Exercise normal, empty, malformed, denied, consent-required, validation, conflict, throttle,
  offline and timeout outcomes.
- [x] Delayed responses/errors after logout/account switch cannot repopulate private state or restart
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

Spec revision 2026-10-04: imported Phase 3 checks cover its adopted baseline only. Current
[shipping selection/DTOs](../../../api/shipping-selection.md) reopen parsing/operation gates under G25.

Spec revision 2026-10-09: [voucher names/default pairing](../../../api/voucher-selection-update.md)
adds customer-visible names and frozen Order names. Client adoption remains unverified (G26).
