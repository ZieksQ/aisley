---
feature: product-review-ratings
role: Customer
platform: Flutter / Dart
phase: 4
flutter_status: Implemented; acceptance partial
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Verified reviews and ratings

## WHAT

Backend: Delivered own-item Review create/public list/photos and read-only official Seller response
implemented; release/media concurrency checks incomplete.

Flutter (external project report): **implemented; acceptance partial**. See [Phase 4 evidence](../../../references/phase-4-verification.md).
Broad counterpart/device and concurrency criteria remain open.

Delivered owned Order Item → rating/body → canonical Review → independent photo uploads → public list/response.

- POST owned order-item Review with rating 1–5/body plain text ≤2,000. Backend proves delivered purchase and one Review per Item. Identical content replay returns same Review; changed repeat conflicts, not editing. No UUID-header requirement for text create.
- Upload separate multipart image on own Review; current max 5, JPEG/PNG/WebP strictly under 10 MiB, review dimension caps per config. Partial image failure never undoes text. Image upload has no durable replay; reconcile uncertainty before another copy.
- Public photos/list recheck visibility and expose safe Verified Customer label/real aggregates/read-only published Seller response. No seeded counts as authored Reviews, Courier ratings, video, moderation/edit/delete API or private storage paths.

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

- Public reviews expose verifiedPurchase and safe authorLabel, never buyer email/contact/full profile.
- Create is tied to an owned delivered Order Item, not arbitrary Product/reviewer ID.
- Order Detail item canReview/reviewId provides entry guidance; server rechecks eligibility/product
  visibility.
- Rating int 1–5 and required body plain text≤2,000; trimmed Unicode/newline normalization rejects
  unsafe markup.
- No review edit/delete API or arbitrary aggregate rating mutation is available.
- Same normalized rating/body for same Order Item returns same Review200; new Review201; changed
  content409.
- No UUID header requirement for create; replay derives from unique Order Item and matching content.
- Photo workflow starts after confirmed Review ID and tracks successes independently from failed image
  selections.
- Upload multipart image under 10 MiB JPEG/PNG/WebP, one matching extension, max5, edge≤8000/pixels≤40M.
- Public review photos use returned delivery URL; hidden owning content is still unavailable at
  delivery.
- No durable image replay contract; lost image response requires reread Review/photos before new
  upload.
- Preserve already committed text/photos after partial failure; retry only unresolved deliberate image
  intent.
- List response adds summary averageRating/reviewCount/distribution to page data/links/meta.
- SellerResponse nullable; only published current response appears and Buyer cannot reply/edit it.
- Official Seller response notification maps to Product review section without exposing another role
  UI.
- Android picker process recovery confirms same Customer/Review; browser uses selected bytes.
- Auth/consent/scoped denial clears private draft/bytes; shopping reading remains blocked until verification/consent resolves.
- Media concurrent limit/cleanup/retention and live target validation remain release evidence
  requirements.
- Test delivered ownership, duplicate identical/changed review, unsafe text and rating boundaries.
- Test partial photo success/timeout/corrupt/exact10MiB/limits, null Seller response and public
  summary consistency.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient
authority.

- `GET /api/v1/products/{product}/reviews` → HTTP 200; `{data:Review[],links:PageLinks,meta:PageMeta,summary:{averageRating:number?,reviewCount:int,distribution:Map<string,int>}}`.
  Request: page1–10000; limit1–50 default 10.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `POST /api/v1/customer/order-items/{orderItem}/review` → HTTP 201; `{data:Review}`.
  Request: rating int 1–5; body required trimmed plain text≤2,000; unsafe markup/control characters and extra fields rejected; delivered owned Order Item.
  Replay: Same normalized rating/body for same Order Item returns same Review (200 replay/201 created); changed content conflicts. No header key required.
- `POST /api/v1/customer/reviews/{review}/images` → HTTP 201; `{data:ReviewPhoto}`.
  Request: multipart image JPEG/PNG/WebP strictly <10 MiB; one matching extension; ≤8000 edge/40M pixels; maximum5 photos; owned Review.
  Replay: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/product-review-ratings.json).
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
| `Review` | `id: UUID`, `rating: int`, `body: string`, `verifiedPurchase: bool`, `authorLabel: string`, `createdAt: timestamp?`, `photos: ReviewPhoto[]`, `sellerResponse: SellerResponse?` |
| `ReviewPhoto` | `id: UUID`, `url: URL`, `mimeType: string`, `width: int`, `height: int` |
| `SellerResponse` | `id: UUID`, `shopName: string`, `body: string`, `publishedAt: timestamp?` |

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

- `ReviewRepository` owns typed transport, parsing and owned cache access; inject dependencies through
  AppDependencies.
- `ReviewListViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `ReviewComposerViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `ReviewPhotoViewModel` owns feature transitions, draft/query state and deliberate actions; inject
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

- [ ] Delivered ownership/identical replay/changed repeat and real aggregates/response privacy match
  server.
- [ ] Android/browser photo boundaries, partial/uncertain recovery and public pagination stay safe and
  accessible.
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
