---
feature: notifications
role: Customer
platform: Flutter / Dart
phase: 4
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Inbox notifications and preference

## WHAT

Backend: Allow-listed own list/detail/read and in-app promotion preference implemented;
unread-count/read-all/native push absent.

Flutter: **pending**. These are implementation requirements, not completed screens or tests.

Account Notifications → all/read/unread page → allowed target → mark read; settings controls in-app promotions.

- List status all/read/unread, per_page 1–50/default 20 and Laravel data/links/meta pagination. Mark read is idempotent and never advances Order/chat/ticket state. No dedicated unread-count/read-all; page unread is not global total.
- Allowed records cover announcements, important Order decisions/outcomes, ongoing promos/campaigns, Q&A answered and Seller Review response; routine movement/first-mile schedules are filtered out.
- Map destinations to allow-listed native Product/Q&A/Review/Shop/Order/Notification routes; never treat arbitrary web path as external navigation authority. Preference is default-off boolean, independent of consent. Device registration/FCM/APNs/native push/background sync are deferred.

The local bundle supplies the implementation contract. Upstream paths are optional provenance only.
Use this feature with its prerequisite session/consent boundary and the related shopping or
communication repositories.
The Customer client cannot perform Seller/Admin/Logistics/Courier actions. Current Laravel ownership
and capabilities remain authoritative.

## MUST

### Feature behavior and boundaries

- General notification inbox is separate from chat unread counts and ticket read markers.
- List uses Laravel page data/links/meta, default 20/per_page1–50 and status all|unread|read.
- Only current allow-listed own types are returned; private user IDs/order snapshots are not exposed.
- Notification destination is server-sanitized but still validated and mapped to supported Flutter
  routes.
- Order destinations open owned Order read; Product Q&A/review anchors map to corresponding sections.
- Campaign Product UUID/Shop slug routes open public content; unknown destination falls back to
  notification detail.
- Detail/read require owned UUID and never accept arbitrary resource/user IDs.
- read_at nullable means unread; POST read is state-idempotent and returns updated data Notification.
- Tapping a notification marks it only when appropriate display completes; never marks unrelated
  messages.
- Resource can become unavailable after notification issuance; show safe unavailable record rather
  than infer success.
- No unread-count/read-all API exists; visible page unread is not an authoritative global badge.
- No FCM/APNs device registration, background delivery or guaranteed realtime is implemented.
- Preference PATCH is the Account operation promotional_in_app_opted_in boolean, default off.
- Promotional consent is optional and independent from Terms/Privacy acceptance; keep separate
  controls.
- Notification title/summary have safe fallbacks; nullable reference/status/resource fields may be
  omitted from display.
- Serialize read/filter refreshes; account generation prevents old notification reads from entering a
  new inbox.
- Empty inbox/read filter is legitimate; transport/denied states must not render empty success.
- No browser OS notification prompt is justified for this HTTP inbox feature.
- Test all/unread/read paging, repeated read, foreign UUID and removed Order/Product destination.
- Test safe internal URL mapping/blocked external URL, nullable fields, no global-count invention and
  preference default-off.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient
authority.

- `GET /api/v1/customer/notifications` → HTTP 200; `{data:Notification[],links:PageLinks,meta:PageMeta}`.
  Request: status nullable all|unread|read; per_page1–50 default 20; page uses framework paginator.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `GET /api/v1/customer/notifications/{notification}` → HTTP 200; `{data:Notification}`.
  Request: Owned notification UUID; no body.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `POST /api/v1/customer/notifications/{notification}/read` → HTTP 200; `{data:Notification}`.
  Request: Owned notification UUID; no body.
  Replay: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.
- `GET /api/v1/customer/account/notification-preferences` → HTTP 200; `{data:Preference}`.
  Request: PATCH promotional_in_app_opted_in required boolean; default off. GET no input.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `PATCH /api/v1/customer/account/notification-preferences` → HTTP 200; `{data:Preference}`.
  Request: PATCH promotional_in_app_opted_in required boolean; default off. GET no input.
  Replay: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.

Full per-operation access/status notes and synthetic bodies are in
[operations](../../../api/operations.md) and
[this feature’s examples](../../../api/examples/notifications.json).
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
money is a decimal string with exact minor-unit parsing; URL requires trusted-origin/path validation.
Never default a missing required object/list to empty success. Unknown enum values disable
unsupported actions.

| DTO | Wire fields and types |
| --- | --- |
| `Notification` | `id: UUID`, `type: string`, `title: string`, `summary: string`, `order_id: UUID?`, `order_reference: string?`, `status: string?`, `read_at: timestamp?`, `created_at: timestamp?`, `resource_type: string?`, `resource_id: string?`, `product_id: UUID?`, `destination: URL` |
| `Preference` | `promotional_in_app_opted_in: bool`, `promotional_in_app_opted_in_at: timestamp?` |

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
Private data is memory-only by default; token is secure-store only, guest recency holds bounded
public hints only.
Local [failure contracts](../../../api/errors.md) define concrete codes and examples; do not require
a universal error envelope.

## HOW

### Responsibility and state ownership

- `NotificationRepository` owns typed transport, parsing and owned cache access; inject dependencies
  through AppDependencies.
- `NotificationInboxViewModel` owns feature transitions, draft/query state and deliberate actions;
  inject dependencies through AppDependencies.
- `NotificationDetailViewModel` owns feature transitions, draft/query state and deliberate actions;
  inject dependencies through AppDependencies.
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

- [ ] Own allow-listed notifications/filters/reads/destinations work without invented global badge.
- [ ] Promotion remains default off and neither consent nor read changes grant push/commerce actions.
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
No Flutter implementation checkbox is completed by documentation authoring or route/source
inspection.
Append actual implementation/test outcomes to [Progress](../../../PROGRESS.md) and retain prior
history.
Follow [architecture](../../../architecture.md), [setup](../../../setup.md) and
[verification](../../../verification.md).
