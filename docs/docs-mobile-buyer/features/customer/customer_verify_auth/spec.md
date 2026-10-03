---
feature: customer_verify_auth
role: Customer
platform: Flutter / Dart
phase: 1
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Auth-aware navigation

## WHAT

Backend: /me role/status and policy guards implemented; storefront session UX has its own separate
implementation.

Flutter: **pending**. These are implementation requirements, not completed screens or tests.

App load → one deduplicated secure-token restoration → /me → guest/active/denied/retry → consent → private route.

- One session controller owns verified identity and session generation. Do not issue a new /me from every screen/render or persist a trusted login flag.
- Public discovery/Shop/Product/policies stay available. Cart/checkout/Orders/account/messages/notifications/tickets need active Customer plus server-required consent. Validate internal return destinations and require deliberate mutation retry after login.
- POLICY_CONSENT_REQUIRED opens consent while preserving auth; resource-specific denial clears its data. Logout/account switching rejects all delayed private successes/errors and clears caches/drafts/uploads/quotes/keys/read markers.

The local bundle supplies the implementation contract. Upstream paths are optional provenance only.
Use this feature with its prerequisite session/consent boundary and the related shopping or
communication repositories.
The Customer client cannot perform Seller/Admin/Logistics/Courier actions. Current Laravel ownership and
capabilities remain authoritative.

## MUST

### Feature behavior and boundaries

- One root controller deduplicates bootstrap; route rebuilds/widgets never start independent /me calls.
- Initial state hides private data but keeps public browsing available. Stored token presence never
  means approval.
- Verified /me must have role customer/status active and a Customer UUID before binding any private
  repository.
- Consent status failure retains valid identity but blocks private content behind retry feedback.
- Explicit POLICY_CONSENT_REQUIRED moves to the current policy reader without a login loop.
- Consent completion rechecks status before a safe read destination; blocked writes require deliberate
  retry.
- Allow-list return routes and validate IDs/slugs; reject arbitrary URLs, another role path and mutation
  query instructions.
- Bottom Home/Shops remain public; Cart and private Account links redirect guests to sign-in with a safe
  read return.
- Android/browser Back returns to the previous safe destination; cancelling sign-in does not execute a
  saved action.
- Foreground resume deduplicates identity/consent refresh and leaves offline private content hidden if
  identity is unverified.
- HTTP 401 invalidates credential storage; explicit account/role denial clears private identity and shows
  reason.
- Resource403/404 clears the affected record only; do not globally sign out for another account’s scoped
  Order.
- Increment session generation before disposal/cancellation on logout; stale errors are rejected as well
  as stale successes.
- A→B→A switching clears quotes, drafts, private media, cursors, read markers and pending keys even if
  Product IDs match.
- Broadcast account loss between local browser tabs through a nonsecret adapter if multi-tab testing is
  supported; never send the token.
- Failed secure deletion exposes retry and suppresses restoration; local sign-out must not claim durable
  token deletion.
- Public Home fallback uses a credential-free request; discard any authenticated response from the
  previous identity.
- Only token persists securely; identity flags, consent acceptance and cached private state are not
  trusted disk authority.
- Test delayed private200/401 completions after switching, repeated startup, forbidden roles and
  consent-version change.
- Test Android process restart, web fixed-origin storage, deletion failure and Back during checking
  states.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient
authority.

- `GET /api/v1/customer/auth/me` → HTTP 200; `{customer:Navigation}`.
  Request: No parameters.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `POST /api/v1/customer/auth/logout` → HTTP 200; `{message:string}`.
  Request: No body; current bearer required.
  Replay: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- `GET /api/v1/policy-consent/status` → HTTP 200; `{data:Consent}`.
  Request: No query/body; policy types terms_of_service|privacy_policy; history version positive integer.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/customer_verify_auth.json).
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
| `Navigation` | `id: UUID`, `displayName: string?`, `avatarUrl: URL?`, `role: string`, `status: string` |
| `Consent` | `policies: PolicyStatus[]`, `all_required_accepted: bool` |

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

- `SessionController` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `TokenStore` owns safe platform access without widget HTTP calls; inject dependencies through
  AppDependencies.
- `RouterGuard` owns feature transitions, draft/query state and deliberate actions; inject dependencies
  through AppDependencies.
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

- [ ] No private-content flash occurs at boot or denial; safe return and Android/browser Back remain
  predictable.
- [ ] A→B→A switching and delayed replies cannot restore previous private state; consent never loops or
  repeats writes.
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
