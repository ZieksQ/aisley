---
feature: search
role: Customer
platform: Flutter / Dart
phase: 2
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Products and Shops search

## WHAT

Backend: Separate public Product/Shop search endpoints and ranked result modes implemented.

Flutter: **pending**. These are implementation requirements, not completed screens or tests.

Query → Products/Shops mode → current page → owning detail; mode/query change resets page.

- Product search matches Product name, Shop name or Product Category name and returns Product cards. Shop search matches Shop name only and returns unique Shop summaries. Keep result types/totals separate.
- Trim q (1–100), page 1–10000, limit 8–50 (default 20); blank local query shows a prompt without an HTTP search. Literal wildcard escaping, visibility and ranking remain server-owned.
- Mode chooses an endpoint, not a Product API type filter. Preserve query/mode/page through browser Back/navigation and retry, reject malformed state and obsolete responses; distinguish no-query/no-match/validation/throttle/offline/service failure. No semantic/autocomplete/SKU search or purchase/recency mutation.

The local bundle supplies the implementation contract. Upstream paths are optional provenance
only.
Use this feature with its prerequisite session/consent boundary and the related shopping or
communication repositories.
The Customer client cannot perform Seller/Admin/Logistics/Courier actions. Current Laravel
ownership and capabilities remain authoritative.

## MUST

### Feature behavior and boundaries

- Search owns separate Products and Shops result modes and calls only the selected endpoint.
- An absent/blank query shows entry guidance without issuing an invalid query; submit
  explicitly.
- Products match visible Product name, owning Shop name or Product category name; Shops mode
  matches Shop name only.
- Literal percent/underscore input is searched literally by the backend; never implement client
  wildcard interpretation.
- Product ranking is relevance/promoted/rating/sales/newness with stable server tie-breaks;
  preserve returned order.
- Shops mode uses server ranking and safe Shop summaries, never Seller email/contact or
  inactive shop records.
- Mode/query/limit/page form a normalized query signature; mode/query changes reset page1.
- Persist only safe public search state in navigation; screen back/forward restores mode and
  query intentionally.
- Query is scalar trimmed1–100; reject arrays, repeated parameters and unknown filters in route
  parsing.
- Page1–10000 and limit8–50 default 20 are bounded; page beyond last is a paging recovery state.
- Directory/category filtering and in-Shop Product q belong to Browse Shop; global search has
  no category query field.
- Keep Product cards and Shop cards separately typed even though pagination envelopes match.
- Empty results retain query/mode and useful clear/modify action; unavailable response retains
  safe draft with Retry.
- Loading a new mode must not flash results from the previous mode or initiate both endpoints.
- Use a 15-second read deadline; typing alone does not need speculative network requests.
- Renew throttle state on repeated429 and use readable Retry-After without immediate retry
  loops.
- Public response caches must key full normalized query/mode/page/limit and exclude private
  enrichment.
- No Shop ratings/following, arbitrary sort or Product quick-add bypassing variants is
  supplied.
- Test each mode, escaped wildcards, empty q,100/101 chars, scalar array/repeated query and
  page bounds.
- Test delayed old-mode results, offline draft, back/forward restoration and page Retry without
  duplicated cards.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient
authority.

- `GET /api/v1/customer/products/search` → HTTP 200; `{items:Product[],pagination:Pagination}`.
  Request: q required trimmed scalar string 1–100; page optional int 1–10000; limit optional int 8–50 default 20; repeated/array query rejected.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `GET /api/v1/customer/search/shops` → HTTP 200; `{items:Shop[],pagination:Pagination}`.
  Request: q required trimmed scalar string 1–100; page optional int 1–10000; limit optional int 8–50 default 20; repeated/array query rejected.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/search.json).
Examples are source-derived synthetic fixtures, not live captures or usable test accounts.

### Response fields and nesting

The following top-level DTO fields use `?` for null and `~` for omission; otherwise the field
is required.
Named nested types and all child keys are defined in the local [wire
tables](../../../api/field-index.md)
and [schema](../../../api/dto-schema.json); those definitions are part of this spec, not
upstream reading.
UUID/cursor are strings; int is integral JSON; number accepts JSON int/double; timestamps are
ISO-8601 UTC.
money is a decimal string with exact minor-unit parsing; URL requires trusted-origin/path
validation.
Never default a missing required object/list to empty success. Unknown enum values disable
unsupported actions.

| DTO | Wire fields and types |
| --- | --- |
| `Product` | `id: UUID`, `slug: string`, `title: string`, `thumbnailUrl: URL?`, `price: number`, `originalPrice: number?`, `minPrice: number?`, `maxPrice: number?`, `discountPercent: int?`, `averageRating: number?`, `reviewCount: int`, `soldCount: int`, `stockStatus: string`, `shop: ShopIdentity`, `badges: string[]`, `deal: Deal~` |
| `Shop` | `id: UUID`, `slug: string`, `name: string`, `description: string?`, `logoUrl: URL?`, `bannerUrl: URL?`, `category: Category?` |
| `Pagination` | `currentPage: int`, `lastPage: int`, `perPage: int`, `total: int` |

### Errors, ownership and recovery

HTTP 401 clears invalid identity/token and every private feature state through
SessionController.
Explicit account/role403 clears identity; resource403/404 clears only affected records unless
it signals account loss.
POLICY_CONSENT_REQUIRED preserves valid authentication, blocks protected work and opens current
consent.
HTTP 422 binds errors by exact request field name and preserves safe editable input; errors/code
may be absent.
HTTP 409 refreshes authoritative state and explains conflict; never silently change a key or
replay a changed payload.
HTTP 429 honors readable Retry-After and disables repeat action until cooldown; unavailable
header is not a guessed server guarantee.
Network/CORS/decode/timeout/5xx have distinct feedback. A failed exchange does not prove a
mutation rolled back.
No offline write queue is authorized. Reconcile unsupported replay before a deliberate new
action.
Duplicate submits are disabled. Supported uncertain UUID writes retain exact key and payload in
session memory.
Queries/pages belong to a full request signature and session generation. Drop stale
success/error on either change.
Private data is memory-only by default; token is secure-store only, guest recency holds bounded
public hints only.
Local [failure contracts](../../../api/errors.md) define concrete codes and examples; do not
require a universal error envelope.

## HOW

### Responsibility and state ownership

- `SearchRepository` owns typed transport, parsing and owned cache access; inject dependencies
  through AppDependencies.
- `SearchViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `SearchQueryParser` owns feature transitions, draft/query state and deliberate actions;
  inject dependencies through AppDependencies.
- Screens compose focused sections/forms/history; reusable widgets render typed state and
  forward callbacks.
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
- Empty success explains the next supported step; unavailable includes Retry and does not
  pretend there are zero records.
- Recoverable refresh failure can retain permitted stale reads with a visible warning; paging
  failure has separate Retry.
- Validation focuses the first invalid field and associates labels/errors semantically; safe
  input remains editable.
- Submitting disables duplicate action; uncertain mutation explains reconciliation and
  preserves only supported pending intent.
- Conflict refresh requires review before a new deliberate write. Success follows a confirmed
  server response.
- Forbidden clears affected private content; consent-required offers reading/acceptance;
  offline offers truthful read/retry limits.
- Light-only Material styling follows [Buyer design](../../../design-buyer.md);
  keyboard/back/focus never silently lose safe drafts.
- Use at least 48×48 logical-pixel touch targets, visible focus, text-scale tolerance and
  non-color status cues.
- Android Back/browser Back/cancel return predictably. Confirm destructive actions and warn
  before discarding unsaved form input.

### Verification scenarios

- [ ] Mode/query/reset/back/pagination preserve the selected collection and typed results.
- [ ] Wildcard/visibility/bounds and error recovery match server behavior without false empty
  success.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus,
  supported permission/retry states and cleanup after identity loss.
- [ ] DTO fixtures reject wrong required types, distinguish null/absent/false/empty and
  preserve wire casing.
- [ ] Each consumed operation uses its documented method/body/envelope and correct
  public/private credential behavior.
- [ ] Exercise normal, empty, malformed, denied, consent-required, validation, conflict,
  throttle, offline and timeout outcomes.
- [ ] Delayed responses/errors after logout/account switch cannot repopulate private state or
  restart disposed work.
- [ ] Same-key replay applies only where supported; additive Cart/image requests are never
  globally retried.
- [ ] Narrow Android/browser layouts, TalkBack order, large text, touch targets, keyboard
  insets and Back/cancel are checked.
- [ ] Record analyze/unit/widget/build and live target results separately; synthetic fixtures
  are not API acceptance.
- [ ] Keep release gates in [integration gaps](../../../references/integration-gaps.md) open
  until owning evidence resolves them.

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
