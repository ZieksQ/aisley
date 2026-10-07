---
feature: browse-shop
role: Customer
platform: Flutter / Dart
phase: 2
flutter_status: Implemented; acceptance partial
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Shop directory and storefront

## WHAT

Backend: Directory/detail, category filtering and optional Shop-scoped q search implemented.

Flutter (external project report): **implemented; acceptance partial**. See [Phase 2 evidence](../../../references/phase-2-verification.md); live-account/device gates remain open.

Shops directory → visible Shop → its Product category/keyword page → Product Detail.

- Directory shop_category is an active Shop business-category slug. Shop Product category options come only from that Shop’s visible active Product categories.
- Shop Product q is optional, trimmed ≤100 and Product-name-only; accepted fields q,category,page,limit. Combine category/keyword with ownership/visibility, retain newest-publication order and independent category options.
- Filter/clear changes reset page and preserve the other filter. Visible empty Shop is valid, unavailable Shop is 404. No global search then client filtering, Shop ratings/following/vouchers/arbitrary sort/quick-add. Chat uses its own channel.

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

- Directory business Category and one Shop’s Product Category are different filter domains.
- Directory accepts active shop_category slug; Category options remain stable across its current
  page.
- Shop detail resolves by public slug, returns the same safe Shop type and may have nullable
  category/branding.
- Visible empty Shop is valid; hidden/unknown Shop404 is unavailable, not an empty catalogue
  success.
- One Shop Product page combines optional q Product-name search with its own category filter.
- Product q does not match Shop name/description/category text; global Search is a separate feature.
- Category belongs to the resolved Shop’s visible Product categories; never apply a global result
  then filter client-side.
- Keyword/category changes reset page and preserve the other filter; provide independent clear
  controls.
- Publication/newest order is retained during filtering; no client relevance re-sort or invented
  sort parameter.
- Category options derive from the whole visible Shop catalogue and remain independent of q/page.
- Slug/query/category/page/limit are the request signature; reject old responses after changing
  Shop.
- Page beyond last offers first-page recovery, not a conclusion that the Shop has no Products.
- Display a placeholder for missing logo/banner and meaningful Shop name; omit unprovided
  ratings/following.
- Keep 16px between directory search and category controls, 24px before results and 12px between
  Shop cards, including narrow layouts.
- Product Detail opens valid Product UUID, retaining the Shop filter state on Back.
- Shop chat receives public Shop ID and optional Product context only through its own
  repository/eligibility.
- No Seller dashboard, recipient lookup, Shop voucher wallet or arbitrary public Seller contact UI
  belongs here.
- Buyer catalogue screens require verified active Customer/consent; public backend methods remain
  credential-free, with unchanged visibility and ownership rules.
- Tenant visibility is enforced by Laravel; client filters cannot expose another Shop’s inventory.
- Test keyword/category intersection, no-results with stable options, unknown category and inactive
  Shop.
- Test directory/category resets, q-only clear, category-only clear and delayed response after slug
  navigation.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient
authority.

- `GET /api/v1/customer/shops` → HTTP 200; `{items:Shop[],pagination:Pagination,categories:Category[]}`.
  Request: shop_category optional active business-category slug≤100; page 1–10000; limit 8–50 default 20; unknown query keys rejected.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `GET /api/v1/customer/shops/{slug}/products` → HTTP 200; `{items:Product[],pagination:Pagination,categories:Category[],shop:Shop}`.
  Request: q optional nullable trimmed string≤100; category optional scalar slug≤100, must belong to this Shop; page1–10000; limit8–50 default 20; unknown/repeated/array keys rejected.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `GET /api/v1/customer/shops/{slug}` → HTTP 200; `{data:Shop}`.
  Request: Visible Shop slug; no body.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/browse-shop.json).
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
| `Shop` | `id: UUID`, `slug: string`, `name: string`, `description: string?`, `logoUrl: URL?`, `bannerUrl: URL?`, `category: Category?` |
| `Category` | `id: UUID`, `slug: string`, `name: string` |
| `Product` | `id: UUID`, `slug: string`, `title: string`, `thumbnailUrl: URL?`, `price: number`, `originalPrice: number?`, `minPrice: number?`, `maxPrice: number?`, `discountPercent: int?`, `averageRating: number?`, `reviewCount: int`, `soldCount: int`, `stockStatus: string`, `shop: ShopIdentity`, `badges: string[]`, `deal: Deal~` |
| `Pagination` | `currentPage: int`, `lastPage: int`, `perPage: int`, `total: int` |

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

- `ShopRepository` owns typed transport, parsing and owned cache access; inject dependencies through
  AppDependencies.
- `ShopDirectoryViewModel` owns feature transitions, draft/query state and deliberate actions;
  inject dependencies through AppDependencies.
- `ShopCatalogueViewModel` owns feature transitions, draft/query state and deliberate actions;
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

- [ ] Scoped keyword/category/directory and back/pagination keep intended state.
- [ ] Manipulated input cannot widen visibility or expose another Shop; empty/unavailable/error
  remain distinct.
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
