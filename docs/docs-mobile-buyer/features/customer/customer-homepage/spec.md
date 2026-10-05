---
feature: customer-homepage
role: Customer
platform: Flutter / Dart
phase: 2
flutter_status: Implemented; acceptance partial
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Homepage and discovery

## WHAT

Backend: Public aggregation, optional personalization and cursor discovery implemented;
shortcut/error/cache gaps remain.

Flutter (external project report): **implemented; acceptance partial**. See [Phase 2 evidence](../../../references/phase-2-verification.md); live-account/device gates remain open.

Home sections → Products/Shops search or detail → bounded discovery load more.

- Render eligible server-selected ads/categories/deals/top/history/feed; omit empty optional rails and unavailable destinations. Category cards use Products keyword search by Category name, not an exact global category filter.
- Card numeric prices/compact availability never authorize purchase. Purchase rails use purchasable visibility; recency may show visible out-of-stock Products. Cart badge comes from Cart API, not the Home viewer.cartItemCount placeholder.
- Backend public Home remains credential-free; Buyer Home mounts only after identity/consent verification. Clear viewer/history/feed immediately on account change, ignore old responses, deduplicate Product IDs, respect opaque cursor/end/client cap and preserve items on page errors. Impressions never record recency.
- Bazaar/MoneyFest, voucher wallet and absent shortcut result pages remain deferred.

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

- Home shows advertisement layer, active campaigns, category shortcuts, deals, top Products and
  recommendation feed.
- All sections consume the single top-level Home envelope; do not wrap it in data or parse it as
  Product detail.
- Optional-auth Home is private even when viewer.isAuthenticated is false; never place it in a shared
  guest cache.
- Authenticated recency is account-scoped. Guest rails/storage/merge are removed from Buyer composition;
  legacy public hints are best-effort deleted without touching other preferences.
- Viewer displayName/email/location are nullable; hide absent personalization without inventing an
  address.
- Viewer cartItemCount is currently a zero placeholder; use Cart data for a real private badge.
- AdvertisementLayer may be null. Missing images show an accessible fallback and preserve valid
  destination text.
- Fallback campaign IDs are strings such as default-primary; do not require a UUID for every campaign.
- Pause carousel rotation offscreen/background; provide accessible previous/next and avoid overriding
  keyboard focus.
- Shortcut targets may have no implemented destination: only enable supported local routes, not
  voucher-wallet placeholders.
- Category cards use keyword search by Category name; they are not exact global Product-category
  filters.
- Deal price/progress is a display projection; expiry/timer does not guarantee checkout eligibility or
  reservation.
- Recommendation limit8–50 default 20 and opaque nextCursor are server-owned; null means exhausted.
- One pager owns base signature/session/query generation and deduplicates UUIDs while preserving
  returned order.
- First refresh replaces overview/feed only after matching success; append failures keep prior rows
  with page Retry.
- Section content may be empty legitimately, while malformed JSON/network errors are unavailable
  states.
- No server cart count, exact personalization guarantee, arbitrary sort, Bazaar or MoneyFest
  implementation is inferred.
- Never navigate directly to an external campaign URL without validating configured allowed hosts and
  an intentional launch.
- Test guest/authenticated response separation, null advertisement, all empty lists, malformed cursor
  and exhausted restoration.
- Test logout during refresh/load-more and A/B/A account switching with matching Product IDs and query
  signatures.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient
authority.

- `GET /api/v1/customer/home` → HTTP 200; `Home (top-level)`.
  Request: limit int8–50 default 20; recommendations additionally cursor nullable opaque≤2048 with server validation.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `GET /api/v1/customer/home/recommendations` → HTTP 200; `{recommendations:Recommendations}`.
  Request: limit int8–50 default 20; recommendations additionally cursor nullable opaque≤2048 with server validation.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/customer-homepage.json).
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
| `Home` | `viewer: Viewer`, `advertisementLayer: Advertisement?`, `campaigns: CampaignGroups`, `quickActions: QuickAction[]`, `categories: HomeCategory[]`, `flashDeals: FlashDeals?`, `topProducts: Product[]`, `recentlyViewed: Product[]`, `recommendations: Recommendations` |
| `Viewer` | `isAuthenticated: bool`, `displayName: string?`, `email: string?`, `deliveryLocation: DeliveryLocation?`, `cartItemCount: int` |
| `Recommendations` | `items: Product[]`, `nextCursor: string?`, `pageSize: int` |
| `Campaign` | `id: string`, `placement: string~`, `title: string`, `description: string?`, `slot: string?`, `position: int`, `imageDesktopUrl: URL?`, `imageMobileUrl: URL?`, `altText: string`, `destinationUrl: URL`, `startsAt: timestamp?~`, `endsAt: timestamp?~`, `priority: int~`, `isActive: bool` |

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

- `HomeRepository` owns typed transport, parsing and owned cache access; inject dependencies through
  AppDependencies.
- `HomeViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `DiscoveryPager` owns feature transitions, draft/query state and deliberate actions; inject
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

- [ ] Public/private Home snapshots remain account-isolated through logout/late paging.
- [ ] Cursor loading/end/errors and category/Product/Shop navigation are truthful and accessible.
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
