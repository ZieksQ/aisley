---
feature: view-product
role: Customer
platform: Flutter / Dart
phase: 2
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Product Detail and configuration

## WHAT

Backend: Product Detail Resource, media/valid variants and current purchase handoffs implemented;
canonical checklist retains historical foundation wording.

Flutter: **pending**. These are implementation requirements, not completed screens or tests.

Visible Product → gallery/description → complete valid variant + quantity → Cart or Buy Now.

- Use immutable Product UUID, safe visibility-gated media, meaningful fallback/alt text and approved sanitized Markdown/GFM description. Raw HTML/arbitrary external image paths must not execute; descriptions and plain-text user content have distinct renderers.
- Use ordered optionGroups/values and server-listed variant optionValueIds, not a Cartesian product. Selected price/media/stock may inherit permitted base fields; disable impossible/out-of-stock/incomplete combinations and bound quantity.
- Guests can inspect; protected purchase/save/message requires sign-in then intentional retry. Detail never reserves inventory. Q&A/reviews/Wishlist/recency/chat retain their owning contracts; successful canonical detail load alone records recency.

The local bundle supplies the implementation contract. Upstream paths are optional provenance only.
Use this feature with its prerequisite session/consent boundary and the related shopping or
communication repositories.
The Customer client cannot perform Seller/Admin/Logistics/Courier actions. Current Laravel ownership and
capabilities remain authoritative.

## MUST

### Feature behavior and boundaries

- Product screen loads current visible Product by UUID and presents media, descriptions, specifications
  and Shop.
- Gallery uses returned ordered media; a legacy thumbnail fallback can have null media.id/variantId.
- Unavailable Product404 clears detail and disables every purchase/context action.
- Product names/slugs are navigation/display values; route uses id, never a guessed slug endpoint.
- For optionGroups choose one value per group and resolve a variant whose optionValueIds exactly match.
- Invalid/incomplete combinations show unavailable and never fall back to base stock/pricing.
- Variant inStock/stockQuantity/price/media override display; requiresVariantSelection means selection
  before purchase.
- Quantity is positive integer and constrained by current stock projection; server rechecks at
  Cart/quote/place.
- No options means variant_id is explicitly null in Add Cart/Buy Now, not omitted.
- Add Cart hands exact Product/variant/quantity to CartRepository; it increments and is not UUID
  replay-safe.
- Buy Now builds a checkout intent without changing Cart and requires owned shipping address/COD quote.
- Wishlist and Q&A/review sections use their own repositories and independent loading/error state.
- Only record Recently Viewed after successful public detail display; error/loading does not create
  history.
- Product Markdown uses flutter_markdown_plus, no HTML/webview script execution; validate linked
  media/launch URLs.
- Specifications preserve stored JSON; recognize supported name/value pairs and show unavailable for
  malformed legacy entries.
- Public media URLs check owning publication/visibility; no raw storage path construction.
- AverageRating/originalPrice/discount may be null; never show zero ratings or a fake discount for null.
- Shop vacation flag disables purchasing as appropriate; backend Cart/checkout still owns final
  eligibility.
- Test base and variant Product, incomplete combinations, invisible variant media, null fallback media
  ID and unavailable Shop.
- Test stale stock before placement, failed Add Cart reconciliation, guest sign-in return and plain
  Markdown links.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient
authority.

- `GET /api/v1/products/{id}` → HTTP 200; `{data:ProductDetail}`.
  Request: Product UUID route; currently published visible Product required.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `GET /api/v1/product-media/{media}` → HTTP 200; `image bytes with declared MIME; 404 when unavailable`.
  Request: Use returned safe asset URL; campaign variant desktop|mobile; current owning visibility required.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `GET /api/v1/product-description-assets/{asset}` → HTTP 200; `image bytes with declared MIME; 404 when unavailable`.
  Request: Use returned safe asset URL; campaign variant desktop|mobile; current owning visibility required.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `GET /api/v1/product-review-images/{image}` → HTTP 200; `image bytes with declared MIME; 404 when unavailable`.
  Request: Use returned safe asset URL; campaign variant desktop|mobile; current owning visibility required.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `GET /api/v1/homepage-advertisement-images/{campaign}/{variant}` → HTTP 200; `image bytes with declared MIME; 404 when unavailable`.
  Request: Use returned safe asset URL; campaign variant desktop|mobile; current owning visibility required.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/view-product.json).
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
| `ProductDetail` | `id: UUID`, `slug: string`, `title: string`, `shortDescription: string?`, `descriptionMarkdown: string?`, `specifications: json?`, `price: number`, `originalPrice: number?`, `discountPercent: int?`, `badges: string[]`, `averageRating: number?`, `reviewCount: int`, `soldCount: int`, `availability: ProductAvailability`, `media: ProductMedia[]`, `optionGroups: OptionGroup[]`, `variants: Variant[]`, `shop: ProductShop` |
| `OptionGroup` | `id: UUID`, `name: string`, `position: int`, `values: OptionValue[]` |
| `Variant` | `id: UUID`, `sku: string?`, `optionValueIds: UUID[]`, `price: number`, `originalPrice: number?`, `discountPercent: int?`, `stockQuantity: int`, `inStock: bool`, `primaryMediaId: UUID?` |
| `ProductMedia` | `id: UUID?`, `url: URL`, `altText: string`, `position: int`, `variantId: UUID?` |

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
Private data is memory-only by default; token is secure-store only, guest recency holds bounded public
hints only.
Local [failure contracts](../../../api/errors.md) define concrete codes and examples; do not require a
universal error envelope.

## HOW

### Responsibility and state ownership

- `ProductRepository` owns typed transport, parsing and owned cache access; inject dependencies through
  AppDependencies.
- `ProductViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `VariantSelector` owns feature transitions, draft/query state and deliberate actions; inject
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

- [ ] Gallery/options/quantity and safe description links are keyboard/TalkBack usable and reflect valid
  combinations.
- [ ] Hidden Products reveal no media; protected handoffs revalidate and never mutate on impression.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported
  permission/retry states and cleanup after identity loss.
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
Append actual implementation/test outcomes to [Progress](../../../PROGRESS.md) and retain prior history.
Follow [architecture](../../../architecture.md), [setup](../../../setup.md) and
[verification](../../../verification.md).
