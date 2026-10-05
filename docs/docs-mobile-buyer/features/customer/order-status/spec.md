---
feature: order-status
role: Customer
platform: Flutter / Dart
phase: 3
flutter_status: Implemented at 57e9eb2; current shipping adoption pending G25
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
current_contract_inspected_checkout: 22b0a48f9575ead182d03c35ab87345711c23b90
---

# Owned Orders and tracking

## WHAT

Backend: Owned list/detail/timeline, status mapper, immutable facts and safe assigned-Courier projection
implemented; live maps deferred.

Flutter (external project report): **implemented against 57e9eb2; newer shipping contract unadopted (G25)**. See [Phase 3 evidence](../../../references/phase-3-verification.md); live-account/device gates remain open.

Account Orders → All/status group → own detail/timeline → server-capable correction/contact/review.

- All is default; group allow-list comes from server enum. page 1–10000, per_page 1–50/default 15. Each Shop Order remains independent within one checkout.
- Render canonical status/group labels, item/voucher/financial/address snapshots, chronological tracking and action hints. Detailed Shipment/task custody is distinct from OrderStatus.
- Buyer cannot advance status, scan/submit proof/accept tasks/collect COD. map.available=false means no fabricated GPS/route/ETA. Tracking Courier name/contact does not enable chat: fetch Courier Order-context.
- Responses are private; focus/reconnect/filter paging must discard obsolete account responses. Routine movement/first-mile scheduling does not imply Buyer notifications.

The current [shipping contract](../../../api/shipping-selection.md) governs provider selection and DTOs;
imported parser/operation checks do not complete G25. Upstream paths are optional provenance only.
Use this feature with its prerequisite session/consent boundary and the related shopping or
communication repositories.
The Customer client cannot perform Seller/Admin/Logistics/Courier actions. Current Laravel ownership and
capabilities remain authoritative.

Buyer presentation requires verified active Customer identity and required consent for every shopping
screen; public backend methods/envelopes remain unchanged. Auth/recovery/Terms/Privacy stay reachable.
Phone/tablet padding, natural content heights and keyboard/text resizing follow [Buyer design](../../../design-buyer.md).

## MUST

### Feature behavior and boundaries

- Order list/detail/tracking are always owned private reads; a foreign UUID returns scoped404.
- Server groups/labels and tabs drive presentation; All is null selected filter, not a fabricated all
  group value.
- List default 15 per_page; timeline default 25; both page1–10000/per_page1–50.
- Placed/seller_processing/ready_for_pickup map To Prepare; assigned/picked_up/in_transit map To Ship.
- pending_payment maps To Pay; out_for_delivery is its own group; delivered Completed; issues map
  Cancelled / Issue.
- Enum return_requested/returned labels do not authorize a Customer returns/refund workflow.
- Order Detail uses immutable items/address/payment/vouchers/totals, with explicit
  deliveryAddress.version.
- Historical productId/variantId/sku may be null; snapshots remain readable after Product removal.
- TimelineCount/HasMore determine whether to load tracking pages; preserve returned chronology and
  deduplicate event IDs.
- Tracking location omits unavailable hub/city; empty PHP array can arrive as [] and must normalize to
  no location.
- Delivery/Courier/contact are nullable safe projections; a displayed name never grants Courier chat
  eligibility.
- Order map.available is false with currentPosition/route/capturedAt null; show text unavailable, no
  live GPS promise.
- Use OrderActions canCancel/canModify and modifiableFields; backend rechecks at mutation time.
- Review action additionally checks each item canReview/reviewId; delivered group alone is insufficient.
- Courier contact uses separate order-context endpoint and only the current accepted final-mile
  relation.
- Logistics/Shop contact use their separate contracts; opening a conversation does not advance Order
  state.
- COD cash recognition and first-mile/final-mile custody updates come from external Logistics/Courier
  operations.
- Detail refresh handles terminal/custody changes and disables obsolete actions; offline read is visibly
  stale.
- Test every supported status/group, null Courier/media/Product IDs, more timeline pages and foreign
  Order denial.
- Test quote/batch/detail totals consistency, address version, terminal refresh and unavailable map with
  no GPS request.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient
authority.

- `GET /api/v1/customer/orders` → HTTP 200; `{data:OrderSummary[],links:PageLinks,meta:PageMeta,filters:OrderFilters}`.
  Request: group optional to_pay|to_prepare|to_ship|out_for_delivery|completed|cancelled_issue; page1–10000; per_page1–50 default 15.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `GET /api/v1/customer/orders/{order}` → HTTP 200; `{data:Order}`.
  Request: Owned Order UUID; no input.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `GET /api/v1/customer/orders/{order}/tracking` → HTTP 200; `{data:Tracking[],links:PageLinks,meta:PageMeta}`.
  Request: page1–10000; per_page1–50 default 25.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/order-status.json).
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
| `Order` | `id: UUID`, `reference: string`, `checkoutBatchId: UUID?`, `placedAt: timestamp`, `latestTrackingAt: timestamp`, `status: string`, `statusLabel: string`, `group: string`, `groupLabel: string`, `shop: OrderShop`, `shippingProvider: ShippingProvider?`, `items: ReviewableItem[]`, `deliveryAddress: DeliveryAddress`, `payment: Payment`, `vouchers: OrderVoucher[]`, `totals: Totals`, `timeline: Tracking[]`, `timelineCount: int`, `timelineHasMore: bool`, `trackingUrl: URL`, `delivery: Delivery?`, `map: UnavailableMap`, `actions: OrderActions` |
| `OrderSummary` | `id: UUID`, `reference: string`, `shop: OrderShop`, `shippingProvider: ShippingProvider?`, `itemPreview: ItemPreview?`, `lineCount: int`, `itemCount: int`, `status: string`, `statusLabel: string`, `group: string`, `groupLabel: string`, `latestTrackingAt: timestamp`, `totals: Totals`, `actions: OrderActions`, `detailUrl: URL` |
| `Tracking` | `id: UUID`, `status: string`, `label: string`, `eventType: string?`, `location: TrackingLocation`, `occurredAt: timestamp` |
| `OrderActions` | `canCancel: bool`, `canModify: bool`, `canReview: bool`, `modifiableFields: string[]` |

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

- `OrderRepository` owns typed transport, parsing and owned cache access; inject dependencies through
  AppDependencies.
- `OrderListViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `OrderDetailViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `TimelinePager` owns feature transitions, draft/query state and deliberate actions; inject
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

- [ ] Current nullable provider/shipping projections and related selection effects pass G25 client verification.
- [ ] Foreign/role/account-state privacy and bounded group/list/timeline work.
- [ ] Server actions/maps/labels and independent Shop Orders remain truthful through refresh/error/late
  replies.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported
  permission/retry states and cleanup after identity loss.
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
Append actual implementation/test outcomes to [Progress](../../../PROGRESS.md) and retain prior history.
Follow [architecture](../../../architecture.md), [setup](../../../setup.md) and
[verification](../../../verification.md).

Spec revision 2026-10-04: imported Phase 3 checks cover its adopted baseline only. Current
[shipping selection/DTOs](../../../api/shipping-selection.md) reopen parsing/operation gates under G25.
