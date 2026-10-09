---
feature: wishlist
role: Customer
platform: Flutter / Dart
phase: 2
flutter_status: Implemented; acceptance partial
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Wishlist

## WHAT

Backend: Owned cursor/status list and idempotent PUT/DELETE implemented; alerts/guest merge
deferred.

Flutter (external project report): **implemented; acceptance partial**. See [Phase 2 evidence](../../../references/phase-2-verification.md); live-account/device gates remain open.

Visible card/detail → Save → Account Wishlist → remove or Product/Cart handoff.

- PUT/DELETE Product UUID derives owner and is idempotent; bounded product_ids status only describes this Customer. Current list hides unavailable/restricted Products safely.
- Wishlist never reserves stock or guarantees prices. Variant Products open Detail before Cart; simple-product Cart handoff reuses current validation.
- Guest save needs sign-in and deliberate retry; no guest merge/shared list/folders. Accessible saved/pending state, optimistic rollback and session cleanup apply. General notifications now exist but restock/price-drop alert evaluation/delivery remains deferred.

The local bundle supplies the implementation contract. Upstream paths are optional provenance
only.
Use this feature with its prerequisite session/consent boundary and the related shopping or
communication repositories.
The Customer client cannot perform Seller/Admin/Logistics/Courier actions. Current Laravel
ownership and capabilities remain authoritative.

Buyer presentation requires verified active Customer identity and required consent for every shopping
screen; public backend methods/envelopes remain unchanged. Auth/recovery/Terms/Privacy stay reachable.
Phone/tablet/desktop padding, natural content heights and keyboard/text resizing follow [Buyer design](../../../design-buyer.md).

## MUST

### Feature behavior and boundaries

- Wishlist is owned server state; guests receive sign-in guidance, with no local wishlist/guest
  merge promise.
- List uses Laravel cursor collection fixed20; saved Product nested adds requiresVariantSelection.
- Status accepts product_ids array1–50 distinct UUIDs; result data is a UUID→bool map, not an item
  list.
- Unavailable/invisible Products resolve unsaved or are omitted from visible list; no private
  Product bypass.
- Save uses PUT Product UUID and empty payload; repeated save keeps one row and original savedAt.
- Remove uses DELETE Product UUID and empty payload; repeat returns saved false even after row
  removal.
- Optimistic heart changes must roll back on confirmed failure or reread after uncertain state.
- Serialize intent per Product so save/remove response order cannot reverse the latest action.
- Paginated savedAt/newest ordering comes from server; do not fabricate count or reorder by client
  price.
- Continue cursor pages using returned next_cursor and deduplicate entry/Product IDs.
- Variant Product opens detail selector; no direct Add Cart with a guessed default variant.
- Missing thumbnail/ratings/discount renders safe Product card fallback with no invented sale.
- Product purchase/add Cart eligibility is rechecked separately from saved status.
- Empty list offers discovery; failed list keeps explicit retry and never calls it empty.
- Put “View product” and “Remove from wishlist” text buttons at the right side of each row. Retain the
  removal confirmation, show “Removing…” while pending, and keep 48px targets and visible focus.
- On narrow screens or enlarged text, place both actions under item details, right aligned and
  wrapping without clipping.
- Logout/account change clears hearts, loaded cursor pages and all account-keyed saved hints.
- Notification alerts for wishlist price/stock and voucher/Shop-follow capabilities remain
  deferred.
- No supplied Product/private-owner/price field is accepted in save/remove request.
- HTTP 404 on saving now-hidden Product clears that Product state without signing out entire
  account.
- Test save/remove repeat and interleaved responses, Product becoming unavailable and mixed50
  status lookup.
- Test guest return, account switching, cursor exhaustion and variant detail handoff.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient
authority.

- `GET /api/v1/customer/wishlist` → HTTP 200; `{data:WishlistItem[],links:CursorLinks,meta:CursorMeta}`.
  Request: cursor optional opaque string; fixed20 entries; no client limit contract.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `GET /api/v1/customer/wishlist/status` → HTTP 200; `{data:Map<UUID,bool>}`.
  Request: product_ids UUID[] distinct1–50 (encode product_ids[0], etc.).
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `PUT /api/v1/customer/wishlist/{product}` → HTTP 200; `{data:{productId:UUID,saved:bool,savedAt?:timestamp}}`.
  Request: UUID Product; empty body, all supplied fields prohibited.
  Replay: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- `DELETE /api/v1/customer/wishlist/{product}` → HTTP 200; `{data:{productId:UUID,saved:bool,savedAt?:timestamp}}`.
  Request: UUID Product; empty body, all supplied fields prohibited.
  Replay: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/wishlist.json).
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
| `WishlistItem` | `id: UUID`, `savedAt: timestamp`, `product: WishlistProduct` |
| `WishlistProduct` | `id: UUID`, `slug: string`, `title: string`, `thumbnailUrl: URL?`, `price: number`, `originalPrice: number?`, `minPrice: number?`, `maxPrice: number?`, `discountPercent: int?`, `averageRating: number?`, `reviewCount: int`, `soldCount: int`, `stockStatus: string`, `shop: ShopIdentity`, `badges: string[]`, `requiresVariantSelection: bool` |
| `CursorMeta` | `path: URL`, `per_page: int`, `next_cursor: string?`, `prev_cursor: string?` |

### Errors, ownership and recovery

HTTP 401 clears invalid identity/token and every private feature state through SessionController.
Explicit account/role403 clears identity; resource403/404 clears only affected records unless it
signals account loss.
POLICY_CONSENT_REQUIRED preserves valid authentication, blocks protected work and opens current
consent.
HTTP 422 binds errors by exact request field name and preserves safe editable input; errors/code
may be absent.
HTTP 409 refreshes authoritative state and explains conflict; never silently change a key or replay
a changed payload.
HTTP 429 honors readable Retry-After and disables repeat action until cooldown; unavailable header
is not a guessed server guarantee.
Network/CORS/decode/timeout/5xx have distinct feedback. A failed exchange does not prove a
mutation rolled back.
No offline write queue is authorized. Reconcile unsupported replay before a deliberate new action.
Duplicate submits are disabled. Supported uncertain UUID writes retain exact key and payload in
session memory.
Queries/pages belong to a full request signature and session generation. Drop stale success/error
on either change.
Private data is memory-only; token is secure-store only. Recently Viewed is account-only.
Never write or merge guest hints; legacy-key cleanup must not delay authentication.
Local [failure contracts](../../../api/errors.md) define concrete codes and examples; do not
require a universal error envelope.

Surround each complete Product entry and its item-specific actions with a white card and visible grey
outline; wrapped actions remain inside the card.

## HOW

### Responsibility and state ownership

- `WishlistRepository` owns typed transport, parsing and owned cache access; inject dependencies
  through AppDependencies.
- `WishlistViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `SavedStatusController` owns feature transitions, draft/query state and deliberate actions;
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
- Light-only Material styling follows [Buyer design](../../../design-buyer.md);
  keyboard/back/focus never silently lose safe drafts.
- Use at least 48×48 logical-pixel touch targets, visible focus, text-scale tolerance and non-color
  status cues.
- Android Back/browser Back/cancel return predictably. Confirm destructive actions and warn before
  discarding unsaved form input.

### Verification scenarios

- [ ] Idempotent saves/removes and cursor/status remain private and accurately reconciled.
- [ ] Visibility/Cart/variant handoff and guest retry preserve safe intent without inventory
  reservation.
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
- [ ] Same-key replay applies only where supported; additive Cart/image requests are never
  globally retried.
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
