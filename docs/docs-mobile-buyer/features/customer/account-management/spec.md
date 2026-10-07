---
feature: account-management
role: Customer
platform: Flutter / Dart
phase: 2
flutter_status: Implemented; acceptance partial
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Profile, password, photo and preference

## WHAT

Backend: Owned account/profile/password/private-photo and promotional preference APIs implemented.

Flutter (external project report): **implemented; acceptance partial**. See [Phase 2 evidence](../../../references/phase-2-verification.md); live-account/device gates remain open.

Account → independent profile/photo/password form → confirmed change → refresh navigation; settings shows promotional preference.

- Read private allow-listed account DTO; PATCH profile uses permitted names/contact/sex/birth_date. Email/role/status/approval are read-only; no client owner ID.
- Password PATCH requires current_password and confirmed replacement; current bearer survives and other tokens are revoked. Email/MFA/device-list/delete/export remain deferred.
- Photo multipart uses photo and authenticated bytes/private reread/remove; refetch uncertain replacement before another upload. Promotion PATCH uses promotional_in_app_opted_in boolean, default off and separate from consent. Clear private forms/media on identity loss.

The local bundle supplies the implementation contract. Upstream paths are optional provenance only.
Use this feature with its prerequisite session/consent boundary and the related shopping or communication
repositories.
The Customer client cannot perform Seller/Admin/Logistics/Courier actions. Current Laravel ownership and
capabilities remain authoritative.

Buyer presentation requires verified active Customer identity and required consent for every shopping
screen; public backend methods/envelopes remain unchanged. Auth/recovery/Terms/Privacy stay reachable.
Phone/tablet/desktop padding, natural content heights and keyboard/text resizing follow [Buyer design](../../../design-buyer.md).

## MUST

### Feature behavior and boundaries

- GET account uses account envelope; profile/photo mutations return message,account,customer; do not parse
  data.
- Split profile/password/photo/preference workflows so a failure in one preserves safe input in another.
- Profile PATCH requires a complete form: names/contact/sex/birth_date; middle_name becomes null when blank.
- Profile embeds photo viewing, picking, preview, upload and confirmed removal. Photo work is
  independently busy and preserves profile text; pending selections participate in discard checks.
- Account has no separate Photo destination. Legacy `/account/photo` links open Profile.
- Keep 16px between Profile fields and 24px before each section.
- Email/role/status/approval and storage metadata remain read-only. Never submit arbitrary copied account DTO.
- Age is server-derived and read-only. Preserve date-only representation instead of timezone-shifting
  birthdays.
- Password change verifies current password and confirmed new strong password; successful current bearer
  survives.
- Other personal access tokens are revoked, but the UI must not claim every existing cookie session was
  revoked.
- No email edit, MFA, device/session registry, revoke-all, deletion or export API is available.
- Photo upload uses multipart photo and under 10 MiB JPEG/PNG/WebP; client hints never replace server
  validation.
- GET avatar fetches authorized private bytes; relative versioned URL retains /api path and cache-busting
  query.
- Never pass bearer as URL parameter or use unauthenticated Image.network for private avatar.
- Upload/remove success updates account and navigation snapshots together; invalidates old byte previews.
- Uncertain photo replacement needs reread before a deliberate new upload; no invented replay key.
- Android picker recovery must confirm original Customer/form context; web uses bytes rather than native file
  path.
- Promotional preference is required boolean, default off and independent of required policy consent.
- Preference read/update uses snake_case data; opted-in timestamp may be null.
- Private forms/bytes/pending uploads are disposed on account change/authorization loss.
- Backend profile dimension/decode hardening remains G15; do not certify global upload-policy parity from
  client checks.
- Test complete profile and prohibited fields, wrong current password, unchanged current bearer and revoked
  other token.
- Test missing avatar404, upload timeout/reread/remove, browser multipart bytes and preference default-off
  reversal.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient authority.

- `GET /api/v1/customer/account` → HTTP 200; `{account:Account}`.
  Request: No parameters.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `PATCH /api/v1/customer/account/profile` → HTTP 200; `{message:string,account:Account,customer:Navigation}`.
  Request: Complete profile fields as registration; middle_name nullable. Reject id/user_id/email/role/status/password/photo storage fields.
  Replay: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- `PATCH /api/v1/customer/account/password` → HTTP 200; `{message:string}`.
  Request: current_password required and matches server hash; new password confirmed≥8 mixed case + digit; identity/email/role/status prohibited.
  Replay: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- `GET /api/v1/customer/account/profile-photo` → HTTP 200; `image bytes (private)`.
  Request: POST multipart photo: JPEG/PNG/WebP, strictly<10485760 bytes, one matching extension; GET/DELETE no body.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `POST /api/v1/customer/account/profile-photo` → HTTP 200; `{message:string,account:Account,customer:Navigation}`.
  Request: POST multipart photo: JPEG/PNG/WebP, strictly<10485760 bytes, one matching extension; GET/DELETE no body.
  Replay: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- `DELETE /api/v1/customer/account/profile-photo` → HTTP 200; `{message:string,account:Account,customer:Navigation}`.
  Request: POST multipart photo: JPEG/PNG/WebP, strictly<10485760 bytes, one matching extension; GET/DELETE no body.
  Replay: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- `GET /api/v1/customer/account/notification-preferences` → HTTP 200; `{data:Preference}`.
  Request: PATCH promotional_in_app_opted_in required boolean; default off. GET no input.
  Replay: Read retry after bounded backoff; reject obsolete session/query generations.
- `PATCH /api/v1/customer/account/notification-preferences` → HTTP 200; `{data:Preference}`.
  Request: PATCH promotional_in_app_opted_in required boolean; default off. GET no input.
  Replay: State-idempotent exact request may be repeated; serialize writes and reread after uncertainty.

Full per-operation access/status notes and synthetic bodies are in [operations](../../../api/operations.md)
and
[this feature’s examples](../../../api/examples/account-management.json).
Examples are source-derived synthetic fixtures, not live captures or usable test accounts.

### Response fields and nesting

The following top-level DTO fields use `?` for null and `~` for omission; otherwise the field is required.
Named nested types and all child keys are defined in the local [wire tables](../../../api/field-index.md)
and [schema](../../../api/dto-schema.json); those definitions are part of this spec, not upstream reading.
UUID/cursor are strings; int is integral JSON; number accepts JSON int/double; timestamps are ISO-8601 UTC.
money is a decimal string with exact minor-unit parsing; URL requires trusted-origin/path validation.
Never default a missing required object/list to empty success. Unknown enum values disable unsupported
actions.

| DTO | Wire fields and types |
| --- | --- |
| `Account` | `id: UUID`, `email: string`, `role: string`, `status: string`, `profile: Profile`, `security: Security` |
| `Profile` | `firstName: string?`, `middleName: string?`, `lastName: string?`, `contactNumber: string?`, `sex: string?`, `birthDate: date?`, `age: int?`, `profilePhotoUrl: URL?` |
| `Preference` | `promotional_in_app_opted_in: bool`, `promotional_in_app_opted_in_at: timestamp?` |
| `Navigation` | `id: UUID`, `displayName: string?`, `avatarUrl: URL?`, `role: string`, `status: string` |

### Errors, ownership and recovery

HTTP 401 clears invalid identity/token and every private feature state through SessionController.
Explicit account/role403 clears identity; resource403/404 clears only affected records unless it signals
account loss.
POLICY_CONSENT_REQUIRED preserves valid authentication, blocks protected work and opens current consent.
HTTP 422 binds errors by exact request field name and preserves safe editable input; errors/code may be absent.
HTTP 409 refreshes authoritative state and explains conflict; never silently change a key or replay a changed
payload.
HTTP 429 honors readable Retry-After and disables repeat action until cooldown; unavailable header is not a
guessed server guarantee.
Network/CORS/decode/timeout/5xx have distinct feedback. A failed exchange does not prove a mutation rolled
back.
No offline write queue is authorized. Reconcile unsupported replay before a deliberate new action.
Duplicate submits are disabled. Supported uncertain UUID writes retain exact key and payload in session
memory.
Queries/pages belong to a full request signature and session generation. Drop stale success/error on either
change.
Private data is memory-only; token is secure-store only. Recently Viewed is account-only.
Never write or merge guest hints; legacy-key cleanup must not delay authentication.
Local [failure contracts](../../../api/errors.md) define concrete codes and examples; do not require a
universal error envelope.

## HOW

### Responsibility and state ownership

- `AccountRepository` owns typed transport, parsing and owned cache access; inject dependencies through
  AppDependencies.
- `ProfileViewModel` owns feature transitions, draft/query state and deliberate actions; inject dependencies
  through AppDependencies.
- `PasswordViewModel` owns feature transitions, draft/query state and deliberate actions; inject dependencies
  through AppDependencies.
- `PhotoViewModel` owns feature transitions, draft/query state and deliberate actions; inject dependencies
  through AppDependencies.
- `PreferenceViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- Screens compose focused sections/forms/history; reusable widgets render typed state and forward callbacks.
- Use ChangeNotifier/ListenableBuilder with immutable DTO snapshots. No HTTP or JSON guesses in build().
- Keep independent forms/actions separately busy and preserve safe input after recoverable validation/network
  failures.
- Dispose listeners, timers, cancel tokens, byte previews and obsolete pending actions on screen/account loss.
- Parser/repository/controller tests use fake transport, clock, token store and UUID factory; widgets use
  injected fakes.

### Screen and interaction states

- Initial loading exposes progress and accessible labels without a private-data flash.
- Empty success explains the next supported step; unavailable includes Retry and does not pretend there are
  zero records.
- Recoverable refresh failure can retain permitted stale reads with a visible warning; paging failure has
  separate Retry.
- Validation focuses the first invalid field and associates labels/errors semantically; safe input remains
  editable.
- Submitting disables duplicate action; uncertain mutation explains reconciliation and preserves only
  supported pending intent.
- Conflict refresh requires review before a new deliberate write. Success follows a confirmed server response.
- Forbidden clears affected private content; consent-required offers reading/acceptance; offline offers
  truthful read/retry limits.
- Light-only Material styling follows [Buyer design](../../../design-buyer.md); keyboard/back/focus never
  silently lose safe drafts.
- Use at least 48×48 logical-pixel touch targets, visible focus, text-scale tolerance and non-color status
  cues.
- Android Back/browser Back/cancel return predictably. Confirm destructive actions and warn before discarding
  unsaved form input.

### Verification scenarios

- [ ] Own profile fields/password token effects and denied inputs match current API.
- [ ] Android/browser authenticated avatar upload/read/remove and explicit default-off preference handle
  errors and cleanup.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported
  permission/retry states and cleanup after identity loss.
- [ ] DTO fixtures reject wrong required types, distinguish null/absent/false/empty and preserve wire casing.
- [ ] Each consumed operation uses its documented method/body/envelope and correct public/private credential
  behavior.
- [ ] Exercise normal, empty, malformed, denied, consent-required, validation, conflict, throttle, offline and
  timeout outcomes.
- [ ] Delayed responses/errors after logout/account switch cannot repopulate private state or restart disposed
  work.
- [ ] Same-key replay applies only where supported; additive Cart/image requests are never globally retried.
- [ ] Narrow Android/browser layouts, TalkBack order, large text, touch targets, keyboard insets and
  Back/cancel are checked.
- [ ] Record analyze/unit/widget/build and live target results separately; synthetic fixtures are not API
  acceptance.
- [ ] Keep release gates in [integration gaps](../../../references/integration-gaps.md) open until owning
  evidence resolves them.

### Handoff and provenance

Historical backend baseline: 7b1a08a; newly inspected checkout: `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`.
Source locators/hashes are optional audit evidence in [provenance](../../../references/source-provenance.md).
No Flutter implementation checkbox is completed by documentation authoring or route/source inspection.
Append actual implementation/test outcomes to [Progress](../../../PROGRESS.md) and retain prior history.
Follow [architecture](../../../architecture.md), [setup](../../../setup.md) and
[verification](../../../verification.md).
