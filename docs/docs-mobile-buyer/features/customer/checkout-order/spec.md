---
feature: checkout-order
role: Customer
platform: Flutter / Dart
phase: 3
flutter_status: Implemented at 57e9eb2; current shipping adoption pending G25
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
current_contract_inspected_checkout: 22b0a48f9575ead182d03c35ab87345711c23b90
---

# COD checkout and placement

## WHAT

Backend: Quote/place/batch, per-Shop Orders, shipping/vouchers/reservations/snapshots and UUID replay
implemented.

Flutter (external project report): **implemented against 57e9eb2; newer shipping contract unadopted (G25)**. See [Phase 3 evidence](../../../references/phase-3-verification.md); live-account/device gates remain open.

Buy Now or selected Cart → saved shipping + COD → per-Shop quote → reviewed Place → atomic batch result.

- Choose exactly buy_now product_id/nullable-present variant_id/quantity or distinct owned cart_item_ids; add address_id,payment_method:cod and optional voucher UUID/target Shop selections. Add logistics_selections per Shop; no computed price/total/shipping/owner/status.
- Requote changed intent and display exact server serviceability/provider/routeStatus/shippingFee/savings/COD. Customer selects one Seller-enabled provider per Shop; Seller pickup enforces it. One Shop creates one independent Order; all group Orders/snapshots/redemptions/reservations/selected Cart cleanup commit atomically.
- Place same intent plus quote_id and UUID key; COD starts placed/pending payment and reserves stock until authoritative first-mile fulfillment. Buy Now leaves Cart unchanged; commission does not increase COD.
- Freeze uncertain key/payload for exact replay. Fresh quote needs review and deliberate Place; process-death recovery and missing GET-by-key remain gaps. Do not show partial success.

The current [shipping contract](../../../api/shipping-selection.md) governs provider selection and DTOs;
imported parser/operation checks do not complete G25. Upstream paths are optional provenance only.
[B06 legacy shipping funding](../../../api/legacy-voucher-funding.md): unaffordable candidates are disabled; quote uses 409 VOUCHER_FUNDING_INSUFFICIENT on vouchers.
Placement shortfalls use 409 QUOTE_STALE before effects; refresh/review. Committed exact-key replay remains valid; Flutter adoption is unverified.
The Customer client cannot perform Seller/Admin/Logistics/Courier actions. Current Laravel ownership
and capabilities remain authoritative.

Buyer presentation requires verified active Customer identity and required consent for every shopping
screen; public backend methods/envelopes remain unchanged. Auth/recovery/Terms/Privacy stay reachable.
Phone/tablet padding, natural content heights and keyboard/text resizing follow [Buyer design](../../../design-buyer.md).

## MUST

### Feature behavior and boundaries

- One reviewed checkout intent uses Buy Now or selected Cart, an owned shipping address and COD.
- Variant key is present nullable; Cart/Buy Now cannot coexist. Quantity and voucher selections follow
  operation validation.
- Quote computes fresh Product/variant stock, shipping serviceability/rate and voucher effects; no
  local payable authority.
- Quote groups are one per Shop; show each subtotal/shipping/discount/payable and the overall
  orderCount summary. Product name/quantity/options/total share an outlined card; Shop totals/vouchers stay outside.
- Successful Quote shippingQuote exposes serviceable true, provider UUID/name, routeStatus and final fee;
  unplanned is a commercial fallback, not operational readiness. No private tariff components remain.
- Select one provider per Shop; implicit single-option fallback is allowed, multiple options require choice.
- Empty options block quoting; provider failures never authorize substitution or a Courier selector.
- Display returned expiresAt (default lifetime15min) and clear review validity when any intent input
  changes.
- Place sends quote_id, exact intent and one UUID Idempotency-Key generated for that deliberate action.
- Placement200 includes Batch; replay returns same Batch and one set of reservations/redemptions.
- All Shop Orders, immutable snapshots, voucher redemptions and selected Cart cleanup commit
  atomically.
- COD starts placed/pending payment; no client confirmation collects/recognizes cash or advances
  delivery.
- Product stock reservation persists until authoritative fulfillment/cancellation; client success does
  not imply physical shipment.
- QUOTE_EXPIRED, QUOTE_INPUT_CHANGED and QUOTE_STALE require refreshed quote, user review and
  deliberate Place.
- QUOTE_ALREADY_PLACED or IDEMPOTENCY_KEY_REUSED must not trigger a fresh-key blind retry.
- Preserve immutable pending key/payload after offline/timeout and same-identity consent interruption;
  disable competing placement while uncertain and require deliberate exact replay.
- GET batch is available only with known owned batch ID; no placement GET-by-key recovery endpoint
  exists.
- Process-death uncertainty stays G12 with memory-only pending state; do not claim automated recovery.
- Batch result shows each Order reference and link; never report partial checkout success for an error.
- Test one/multiple Shops, stale prices/stock/rates/address/vouchers and atomic rollback on any failing
  group.
- Test lost-response exact replay, changed payload key conflict, Buy Now Cart preservation and owned
  Batch denial.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient
authority.

- `POST /api/v1/customer/checkout/logistics-options` → HTTP 200; `{data:LogisticsOptions}`.
  Request: same CheckoutQuoteRequest intent; no key or quote creation. Read retry with session guards.
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
| `Quote` | `quoteId: UUID`, `expiresAt: timestamp`, `mode: string`, `paymentMethod: string`, `address: QuoteAddress`, `groups: QuoteGroup[]`, `summary: QuoteSummary` |
| `QuoteGroup` | `shop: QuoteShop`, `items: QuoteItem[]`, `availableVouchers: Voucher[]`, `appliedVouchers: AppliedVoucher[]`, `shippingQuote: ShippingQuote`, `totals: Totals` |
| `QuoteItem` | `cartItemId: UUID?`, `productId: UUID`, `variantId: UUID?`, `productName: string`, `sku: string?`, `selectedOptions: SelectedOption[]`, `unitPrice: money`, `quantity: int`, `lineSubtotal: money` |
| `Batch` | `id: UUID`, `currency: string`, `placedAt: timestamp`, `orders: BatchOrder[]` |
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

- `CheckoutRepository` owns typed transport, parsing and owned cache access; inject dependencies
  through AppDependencies.
- `CheckoutViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `PendingPlacement` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
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
- Defer initial address loading until after the first frame with a mounted guard; never notify during build.
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

- [ ] Current provider choice/fallback, shipping DTOs and frozen selection intent pass G25 client verification.
- [ ] Atomic one/multi-Shop placement and immutable current quote/totals/serviceability follow Laravel.
- [ ] Lost-response same-key replay creates one batch/reservation/redemption; stale inputs require
  reviewed recovery.
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
