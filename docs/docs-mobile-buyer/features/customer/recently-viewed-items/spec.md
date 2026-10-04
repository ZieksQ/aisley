---
feature: recently-viewed-items
role: Customer
platform: Flutter / Dart
phase: 2
flutter_status: Implemented; acceptance partial
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Recently Viewed

## WHAT

Backend: Owned record/merge/list/remove/clear and public Product resolver implemented.

Flutter (external project report): **implemented; acceptance partial**. See [Phase 2 evidence](../../../references/phase-2-verification.md); live-account/device gates remain open.

Successful authenticated detail → server record → current visible account cards; no guest store/merge.

- Buyer uses authenticated account history only. No recording from search/cards/Home impressions. Remove only buyer.public_recent_ids_v1 best-effort; blocked preferences never delay authentication.
- Owned PUT uses server time and one User/Product row with current retention 50. Resolver takes productIds ≤12. Merge takes items with optional valid bounded viewedAt; malformed/duplicate request is validation, unavailable Products omitted.
- Buyer never writes guest hints or invokes automatic merge; backend merge/resolve contracts remain available but unused by app composition. Remove is idempotent, clear-all needs confirmation. Logout retains server history and never copies it into guest storage; old-account reads/rails clear.

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

- Guest persistence is retired. Do not read, write, merge or resolve its hints; delete only the old
  key best-effort, leaving unrelated preferences untouched.
- The unused public resolver contract uses camelCase productIds1–12 and returns only visible
  Products in items; Buyer does not call it.
- Account list uses Laravel cursor collection, default 20 max50 and retention default50.
- PUT records a successful Product detail view at server current time; no request timestamp allowed.
- Merge sends items1–12 with productId and optional viewedAt; duplicate UUIDs/unknown fields invalid.
- Timestamps must not be future and must be within configured365-day age; use injected clock in tests.
- Authenticate and resolve consent before account history reads/writes. The backend merge contract
  remains documented below for compatibility; Buyer does not invoke it.
- Unavailable Products may be omitted from merge response and resolver without revealing hidden
  metadata.
- Account history should not be copied into guest storage on sign-out or rollback.
- Use verified Customer keyed memory/query generations; A→B→A never restores prior private feed.
- Delete one result returns removed boolean; repeat may return false, which is successful state.
- Clear requires confirmation and returns cleared/removedCount; repeated clear may report zero.
- No unviewable error page triggers record or merge; a visible Product view is the event boundary.
- History timestamps sort newest-first; merge retains newest eligible view, not append duplicates.
- PUT rerecords current time; do not claim exact original timestamp replay under retry.
- Legacy cleanup failure is ignored without plaintext/session fallback or another guest history store.
- Page query validates cursor≤2048 and supported keys; never substitute a fabricated cursor.
- Private history errors keep safe retry without exposing previous account’s stale rows.
- Preserve merge/resolver DTO contract coverage; test account-only recording and isolated legacy
  cleanup without reading hints.
- Test blocked storage, repeated PUT/remove/clear, session generation and cursor
  restoration/exhaustion.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient
authority.

- `GET /api/v1/customer/recently-viewed` → HTTP 200; `{data:RecentItem[],links:CursorLinks,meta:CursorMeta}`.
  Request: cursor opaque≤2048; limit1–50 default 20; unknown keys rejected.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `PUT /api/v1/customer/recently-viewed/{product}` → HTTP 200; `{data:{productId:UUID,lastViewedAt:timestamp}}`.
  Request: No body; Product UUID when present.
  Replay: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- `DELETE /api/v1/customer/recently-viewed/{product}` → HTTP 200; `{data:{productId:UUID,removed:bool}}`.
  Request: No body; Product UUID when present.
  Replay: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- `DELETE /api/v1/customer/recently-viewed` → HTTP 200; `{data:{cleared:bool,removedCount:int}}`.
  Request: No body; Product UUID when present.
  Replay: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- `POST /api/v1/customer/recently-viewed/merge` → HTTP 200; `{data:{mergedProductIds:UUID[],mergedCount:int}}`.
  Request: items1–12 [{productId distinct UUID,viewedAt optional nullable ISO date≤now and≥now−365d}]; no unknown keys.
  Replay: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- `POST /api/v1/customer/products/resolve` → HTTP 200; `{items:Product[]}`.
  Request: productIds distinct UUID[] 1–12; no unknown keys.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/recently-viewed-items.json).
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
| `RecentItem` | `id: UUID`, `lastViewedAt: timestamp`, `product: Product` |
| `Product` | `id: UUID`, `slug: string`, `title: string`, `thumbnailUrl: URL?`, `price: number`, `originalPrice: number?`, `minPrice: number?`, `maxPrice: number?`, `discountPercent: int?`, `averageRating: number?`, `reviewCount: int`, `soldCount: int`, `stockStatus: string`, `shop: ShopIdentity`, `badges: string[]`, `deal: Deal~` |
| `CursorMeta` | `path: URL`, `per_page: int`, `next_cursor: string?`, `prev_cursor: string?` |

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

- `RecentRepository` owns typed transport, parsing and owned cache access; inject dependencies through
  AppDependencies.
- `removeLegacyRecentHints` deletes only the retired key and catches preference failure independently
  of bootstrap; no guest store/coordinator participates in AppDependencies.
- `RecentViewModel` owns feature transitions, draft/query state and deliberate actions; inject
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

- [ ] Record/revisit/retention and visible out-of-stock cards follow server rules.
- [ ] No guest writes/merges; cleanup failure, account-switch/clear/late paging cannot leak private history.
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
