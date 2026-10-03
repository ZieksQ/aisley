---
feature: customer-auth
role: Customer
platform: Flutter / Dart
phase: 1
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Customer authentication

## WHAT

Backend: Auth/approval-aware registration, login and recovery implemented; address/ID registration and
native reset links deferred.

Flutter: **pending**. These are implementation requirements, not completed screens or tests.

Profile/credentials → pending/no credential → Admin decision outside app → device-token login → /me → consent.

- Register only supported profile/credential keys; no applicant status polling or imported Courier evidence keys. Login sends device_name and securely stores the returned Customer-scoped token on Android and local web.
- Distinguish credentials-first INVALID_CREDENTIALS from pending/rejected/suspended/inactive denial, throttling and network/storage failure. No identity may self-approve.
- Forgot-password is generic; reset mail targets the configured storefront. Native reset handling needs an approved link contract. Reset revokes all personal access tokens; current-token logout does not revoke every device.

The local bundle supplies the implementation contract. Upstream paths are optional provenance only.
Use this feature with its prerequisite session/consent boundary and the related shopping or communication
repositories.
The Customer client cannot perform Seller/Admin/Logistics/Courier actions. Current Laravel ownership and
capabilities remain authoritative.

## MUST

### Feature behavior and boundaries

- Sign-in form owns email/password; registration is a separate draft and never imports another role’s
  fields.
- Registration has first/last name, optional middle name, contact, sex, birth date, email, password and
  confirmation; never submit age.
- All four sex values are supported: male, female, non_binary, prefer_not_to_say. Birth date must be before
  today.
- Passwords require at least eight characters, mixed case and a number; mismatch gets field feedback before
  submitting.
- Normalize email through the request adapter; retain display draft but never store passwords across process
  death.
- Pending success shows informational approval instructions and a sign-in return, with no token or protected
  applicant polling.
- Admin review occurs outside Buyer; pending/rejected accounts cannot open protected support as an approval
  exception.
- Correct credentials are checked before account-state denial. Do not infer pending status from a failed
  password.
- Login sends device_name even on localhost web, never invokes the cookie/CSRF login branch intentionally.
- A missing token in a successful device login is a contract/decode failure; fail closed before navigation.
- SessionController securely stores the token, validates /me, then checks current consent before private
  return navigation.
- ACCOUNT_PENDING_APPROVAL, ACCOUNT_REJECTED, ACCOUNT_SUSPENDED and ACCOUNT_INACTIVE are explicit 403 screen
  states.
- INVALID_CREDENTIALS is 422 with email feedback; EMAIL_ALREADY_REGISTERED offers sign-in/recovery without
  changing approval.
- Recovery acknowledges known and unknown valid emails identically. Do not display inferred existence or
  mailbox delivery success.
- Open trusted configured storefront reset flow deliberately. A native route alone does not make emailed
  deep links usable.
- INVALID_RESET_TOKEN includes expired/reused/wrong-role cases. Clear token/password fields on successful
  reset.
- Reset revokes all access tokens; logout revokes current token; no refresh token/session registry route
  exists.
- Login/recovery throttles allow five attempts; use Retry-After when exposed and avoid guessed countdown
  certification.
- Uncertain registration is reconciled via duplicate/login outcome, not automatic resubmission; uncertain
  login may mint another token.
- Test concurrent submit guards, normalized duplicate emails, wrong-role credentials, pending no-token
  response and storage failure.

### Exact consumed operations

JSON requests set Accept and Content-Type application/json; multipart sets its own boundary.
Private calls use Bearer only for the configured API origin. Public reads need no credential.
A path UUID or slug is encoded before use; do not submit owner, status, financial or recipient authority.

- `POST /api/v1/customer/auth/register` → HTTP 201; `{message:string,customer:RegistrationCustomer}`.
  Request: Profile fields required: names string≤255, middle_name nullable ≤255, contact_number≤32, sex male|female|non_binary|prefer_not_to_say, birth_date before today; email≤255 normalized lowercase/trim; confirmed password≥8 mixed case + digit. role/status prohibited.
  Replay: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- `POST /api/v1/customer/auth/login` → HTTP 200; `{message:string,customer:Navigation,token:string}`.
  Request: email valid≤255 normalized; password string required; device_name string required for Flutter≤255; remember optional boolean for cookie path only.
  Replay: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- `POST /api/v1/customer/auth/forgot-password` → HTTP 200; `{message:string}`.
  Request: email string valid≤255 normalized; max 5 attempts with default 60-second decay.
  Replay: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- `POST /api/v1/customer/auth/reset-password` → HTTP 200; `{message:string}`.
  Request: email valid≤255; token string; password confirmed≥8 mixed case + digit. No native link contract; use trusted storefront link unless native handoff approved.
  Replay: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.
- `POST /api/v1/customer/auth/logout` → HTTP 200; `{message:string}`.
  Request: No body; current bearer required.
  Replay: No durable replay key. After timeout/cancellation, reread authoritative state before a deliberate new action.

Full per-operation access/status notes and synthetic bodies are in [operations](../../../api/operations.md)
and
[this feature’s examples](../../../api/examples/customer-auth.json).
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
| `Navigation` | `id: UUID`, `displayName: string?`, `avatarUrl: URL?`, `role: string`, `status: string` |
| `RegistrationCustomer` | `id: UUID`, `email: string`, `role: string`, `status: string`, `profile: RegistrationProfile` |

### Errors, ownership and recovery

HTTP 401 clears invalid identity/token and every private feature state through SessionController.
Explicit account/role403 clears identity; resource403/404 clears only affected records unless it signals
account loss.
POLICY_CONSENT_REQUIRED preserves valid authentication, blocks protected work and opens current consent.
HTTP 422 binds errors by exact request field name and preserves safe editable input; errors/code may be
absent.
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
Private data is memory-only by default; token is secure-store only, guest recency holds bounded public hints
only.
Local [failure contracts](../../../api/errors.md) define concrete codes and examples; do not require a
universal error envelope.

## HOW

### Responsibility and state ownership

- `AuthRepository` owns typed transport, parsing and owned cache access; inject dependencies through
  AppDependencies.
- `LoginViewModel` owns feature transitions, draft/query state and deliberate actions; inject dependencies
  through AppDependencies.
- `RegistrationViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- `RecoveryViewModel` owns feature transitions, draft/query state and deliberate actions; inject
  dependencies through AppDependencies.
- Screens compose focused sections/forms/history; reusable widgets render typed state and forward callbacks.
- Use ChangeNotifier/ListenableBuilder with immutable DTO snapshots. No HTTP or JSON guesses in build().
- Keep independent forms/actions separately busy and preserve safe input after recoverable
  validation/network failures.
- Dispose listeners, timers, cancel tokens, byte previews and obsolete pending actions on screen/account
  loss.
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
- Conflict refresh requires review before a new deliberate write. Success follows a confirmed server
  response.
- Forbidden clears affected private content; consent-required offers reading/acceptance; offline offers
  truthful read/retry limits.
- Light-only Material styling follows [Buyer design](../../../design-buyer.md); keyboard/back/focus never
  silently lose safe drafts.
- Use at least 48×48 logical-pixel touch targets, visible focus, text-scale tolerance and non-color status
  cues.
- Android Back/browser Back/cancel return predictably. Confirm destructive actions and warn before
  discarding unsaved form input.

### Verification scenarios

- [ ] Active login/denied roles, token restoration/storage failure and pending/no-token registration match
  server results.
- [ ] Duplicate registration, generic recovery, reset and logout clear secrets and show truthful outcomes.
- [ ] Android and fixed-origin local browser verify loading/empty/errors, keyboard/back/focus, supported
  permission/retry states and cleanup after identity loss.
- [ ] DTO fixtures reject wrong required types, distinguish null/absent/false/empty and preserve wire
  casing.
- [ ] Each consumed operation uses its documented method/body/envelope and correct public/private credential
  behavior.
- [ ] Exercise normal, empty, malformed, denied, consent-required, validation, conflict, throttle, offline
  and timeout outcomes.
- [ ] Delayed responses/errors after logout/account switch cannot repopulate private state or restart
  disposed work.
- [ ] Same-key replay applies only where supported; additive Cart/image requests are never globally retried.
- [ ] Narrow Android/browser layouts, TalkBack order, large text, touch targets, keyboard insets and
  Back/cancel are checked.
- [ ] Record analyze/unit/widget/build and live target results separately; synthetic fixtures are not API
  acceptance.
- [ ] Keep release gates in [integration gaps](../../../references/integration-gaps.md) open until owning
  evidence resolves them.

### Handoff and provenance

Historical backend baseline: 7b1a08a; newly inspected checkout: `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`.
Source locators/hashes are optional audit evidence in
[provenance](../../../references/source-provenance.md).
No Flutter implementation checkbox is completed by documentation authoring or route/source inspection.
Append actual implementation/test outcomes to [Progress](../../../PROGRESS.md) and retain prior history.
Follow [architecture](../../../architecture.md), [setup](../../../setup.md) and
[verification](../../../verification.md).
