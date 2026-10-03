---
feature: policy-viewing-consent
role: Customer
platform: Flutter / Dart
phase: 1
flutter_status: Pending
backend_baseline: 7b1a08a0c89d7983a0e0503c5e8d322d2c2fa2a0
contract_inspected_checkout: 57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50
---

# Policies and Customer consent

## WHAT

Public Terms/Privacy current/history reading, authenticated status and explicit version acceptance are implemented in Laravel. All Buyer Flutter DTOs/repositories/controllers/screens and target acceptance remain **pending**. This shared spec is complete without the Customer200–230-line requirement.

One platform-wide version stream serves all roles. Buyer reads public published current versions and published/superseded history. Drafts/Internal Rules never become Customer content. Reading history does not establish acceptance. Server policy controls decide required initial/re-consent; optional promotion preference remains separate.

Public reader → active identity through /me → status → read exact required current version → explicit confirmation → acceptance → refreshed status → safe protected read destination. Public browsing remains usable when private consent cannot be resolved.

## MUST

### Exact operations and ownership

| Method/path | Input | HTTP 200 envelope |
| --- | --- | --- |
| GET /api/v1/platform/policies/{type} | public type string | {data:PublicPolicy} |
| GET /api/v1/platform/policies/{type}/history | public type string | {data:PolicyHistory} |
| GET /api/v1/platform/policies/{type}/history/{version} | positive version integer | {data:PublicPolicy} |
| GET /api/v1/policy-consent/status | active actor bearer; no body/query | {data:Consent} |
| POST /api/v1/policy-consent/{type}/versions/{version}/accept | active actor bearer; confirmation:true JSON | {data:PolicyAcceptance} |

`type` is exactly terms_of_service or privacy_policy. Public reads have no token requirement. Status/accept require Sanctum and active policy actor but remain exempt from consent blocking, alongside Customer /me/logout. Actor identity and accepted_at are server-derived; no user ID/time/version body override. There is no refresh token or UUID-header requirement for acceptance.

Public current content caches300s; history collection60s and history version300s. Private status/accept/consent denial are private/no-store. Refresh on publication conflict instead of using a stale reader’s checkbox. These collections contain all eligible versions and have no cursor/page contract.

### Wire DTOs and nullability

| Named DTO | Exact keys/types |
| --- | --- |
| PublicPolicy | type:string, label:string, version:PolicyVersion |
| PolicyVersion | id:UUID string, version:int, title:string, content:string, status:string, change_summary:string?, requires_reconsent:bool, published_at:ISO timestamp? |
| PolicyHistory | type:string, label:string, versions:PolicyHistoryVersion[] |
| PolicyHistoryVersion | id:UUID, version:int, title:string, status:string, change_summary:string?, published_at:timestamp? |
| Consent | policies:PolicyStatus[], all_required_accepted:bool |
| PolicyStatus | type:string,label:string,required:bool,accepted:bool,accepted_at:timestamp?,current_version:PolicyVersionSummary?,accepted_version:AcceptedVersion? |
| PolicyVersionSummary | id:UUID,version:int,title:string,change_summary:string?,requires_reconsent:bool,published_at:timestamp? |
| AcceptedVersion | id:UUID,version:int,accepted_at:timestamp? |
| PolicyAcceptance | type:string,label:string,version:PolicyVersion,accepted_at:timestamp? |

All listed keys are required but `?` permits JSON null. Preserve snake_case exactly. UUID/cursor types are strings and version is integral JSON. Content may be long; reader is scrollable/selectable, without HTML/script execution. Safe Markdown uses flutter_markdown_plus; external links need explicit trusted URL handling. A missing required descriptor or malformed content is unavailable/decode failure, never “no consent required.”

`accepted` means the exact current version was accepted. `required` means action is needed under current server controls/history. `all_required_accepted` means no required action remains, not necessarily that accepted is true for every current version. Enforcement disabled or non-reconsent publications can give required:false/accepted:false legitimately. A null current_version cannot be invented into a reader or accept route.

### Validation, denial and publication conflict

Acceptance body is `{"confirmation":true}`. Validation requires boolean with accepted semantics; use a real JSON true. Do not precheck, auto-submit, infer acceptance from scrolling, or reuse history confirmation for a new current version. Exact User/version uniqueness makes repeated acceptance safe, with one accepted_at outcome.

HTTP 409 POLICY_VERSION_STALE means requested version is no longer current/published. Reload status/current content, reset explicit confirmation and ask the user to read/confirm the new version. Do not silently accept a replacement version. HTTP 422 uses confirmation field errors;429 named consent limiters use server retry timing. Unknown/unsupported type/history version404 stays unavailable. Public reader network errors preserve safe navigation and Retry.

Protected actions can return403 POLICY_CONSENT_REQUIRED with code/message and `data:{required_policies:[{type,label,version,read_url,accept_url}],status_url}`. Version int and accept_url can be null. Validate returned paths against trusted API/type mapping; never send bearer to arbitrary URLs. Keep identity while suspending private work; open the reader. A descriptor is not consent acceptance and does not authorize replay of the blocked commerce write.

HTTP 401 or explicit role/account-state denial clears invalid identity and private repositories; scoped policy/resource404 does not automatically sign out. Offline/status/decode failure leaves private routes blocked with Retry while public discovery remains usable. Do not persist a trusted accepted flag in ordinary preferences.

### Screen states and interaction

Guest policy reader has loading/content/history/empty-history/unavailable states, with no authenticated acceptance promise. Authenticated consent screen shows each required policy, exact title/version/summary, readable content, unchecked confirmation and deliberate Accept. Independent success can retain one accepted policy while another still requires action; final status controls navigation.

Busy disables duplicate acceptance; uncertain timeout offers exact same-version retry, never a guessed success. Current publication change resets confirmation. Back/cancel stays within safe public navigation when private access is blocked. Declining does not delete a valid session or silently accept; expose Logout and public Home. Large text/TalkBack/keyboard/48px targets/light-only presentation remain usable.

No native push, promotional opt-in, Admin policy authoring or internal-policy navigation is supplied. Public policy history does not reveal actor acceptances or private audit records.

## HOW

PolicyRepository owns current/history/status/accept parsing and public/private cache separation. PolicyReaderViewModel owns selected type/version/content/read failure. ConsentViewModel owns pending required policy/explicit confirmation/busy/conflict. Root SessionController owns identity, consent gating and router refresh; screens never call /me from build.

Inject repositories, HTTP clients, clock and session generation through AppDependencies. Widgets use immutable DTOs and ChangeNotifier/ListenableBuilder. Actor-scoped responses carry generation/Customer UUID; reject late status/accept errors and successes after logout/account switch. Clear confirmation/private accepted state/listeners when identity changes; public policy content can remain publicly cached.

After acceptance, refresh status. Resume safe read navigation only when all_required_accepted true. Never automatically retry checkout/chat/support writes that were blocked. A new policy requirement encountered mid-session stops timers/private mutations until resolved; repository cancellation does not prove a pending server write rolled back.

Synthetic requests, nullable status/current versions, stale-conflict and denied examples are supplied in [policy examples](../../../api/examples/policy-viewing-consent.json), [wire tables](../../../api/field-index.md), [operations](../../../api/operations.md) and [failure handling](../../../api/errors.md). No monorepo files are required to implement these contracts.

### Verification

- [ ] Guest current/history views and authenticated status remain distinct and safe.
- [ ] Required consent after restoration or mid-session publication blocks private work without losing identity/replaying writes.
- [ ] Explicit confirmation, exact replay, stale conflict, enforcement toggle, offline/throttle and account switching match Laravel.
- [ ] Android/browser keyboard/back/focus and readable policy/loading/error states are verified.
- [ ] DTOs preserve null/current/accepted descriptors and reject malformed success without treating it as consent-free.
- [ ] Enforcement disabled, initial acceptance, non-reconsent current change and required reconsent produce correct routing.
- [ ] Publication during reader/accept gives409, resets confirmation and never auto-accepts new content.
- [ ] Exact timeout retry accepts once; duplicate taps are disabled; partial Terms/Privacy success rechecks status.
- [ ] Guest/current/history and private actor status use different cache/credential boundaries.
- [ ] Logout/account switch discards delayed status/accept responses, private flags and confirmation drafts.
- [ ] Decline/Back/public browsing/logout stay reachable without login/consent redirect loops.
- [ ] Controlled Android/browser live acceptance is recorded separately from fixtures/analyze/build results.

### Provenance and release

Historical baseline7b1a08a; new source inspection57e9eb2 includes PolicyConsentController/Service, active-policy/consent middleware, AcceptPolicyRequest and PolicyConsentTest definitions. Those upstream paths are optional provenance; no application tests ran for this documentation task.

Read [authentication](../../../api/authentication.md), [setup](../../../setup.md), [verification](../../../verification.md), [design](../../../design-buyer.md) and [provenance](../../../references/source-provenance.md). Record material deployed-contract differences and actual Flutter progress without overwriting historical evidence.
