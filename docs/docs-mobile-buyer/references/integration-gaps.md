# Backend and Buyer integration gaps

Phase 5 local readiness adds [repeatable checks and the acceptance runbook](phase-5-verification.md).
The 2026-10-04 API probe was initially unreachable, then the API recovered without
Buyer starting/modifying Laravel. All 42 public/denial/preflight tests and extended
localhost:8766 browser smoke passed. ADB reported no attached devices; CORS exposed
headers were absent at that probe. No new backend conflict was established.
The 2026-10-10 backend B05 fix explicitly exposes Retry-After in source; deployed
exposure and actual Flutter cooldown acceptance still require verification.
Controlled authentication/device gates, deployed revision, deployed Retry-After exposure,
production application ID/signing and unresolved owner decisions remain open.

Baseline reviewed 2026-10-03. Phases 1–4 are implemented with verification recorded separately; unverified live/device gates remain open. This register identifies unavailable platform behavior, source contradictions and integration/release decisions; it does not authorize backend changes.

| ID | Gap and evidence | Buyer delivery treatment | Owner / phase |
| --- | --- | --- | --- |
| G01 | Customer RegisterRequest/controller omit reference-required address/ID evidence | Profile/credentials-only pending registration; explain limitation; no copied Courier upload parts | Customer API/Admin review; 1 follow-up |
| G02 | No pending-applicant read, rejection resubmission, appeal exception or email-verification policy | Informational pending/rejected state and later login; no protected applicant support | Customer Auth; 1 |
| G03 | Reset mail URL targets configured storefront; native links not configured | Use trusted storefront recovery; approve native app-link/reset handoff separately | Auth/deployment; 1 |
| G04 | Historical CORS default omitted Buyer; local API permits localhost:8766, verified 2026-10-04. Backend B05 source fix on 2026-10-10 explicitly exposes Retry-After | Refresh deployed configuration and verify readable delta/date headers and actual Flutter cooldown handling. Authenticated cookie isolation remains a target gate; source completion does not close deployed/client acceptance | API/deployment/Flutter verification; 1/5 |
| G05 | Fresh-project SDK/package/architecture choices supplied and Phase 1 dependencies resolved | Flutter 3.47.2 / Dart 3.13.2, locked dependencies, Phase 1 analysis/tests and Android/web builds pass; installed-device and real-account gates remain open | Flutter; 1/5 |
| G06 | All 19 source-identical PSGC assets/manifest copied/registered; Phase 2 Dart loaders implemented; newer selected-only locality dropdowns require valid listed entries and failed assets block save with Retry | Source checksums and all regional hierarchies pass; deployed NCR shipping coverage and installed-device acceptance remain open | Flutter/data; 2 |
| G07 | MapLibre/geolocator implemented per October 8 external report; native public credential suitability still external | Geoapify intentional pin only; keep text-only if credential/permission/provider gate unresolved | Maps/deployment; 2/5 |
| G08 | Portable Cart/Product contracts reconciled against source; historical canonical contradictions preserved upstream | Use local typed operations/specs; no backend/runtime fix implied | Current contract documented; G25 client adoption pending |
| G09 | Portable checkout/fulfillment context reconciled with implemented downstream workflow | Customer selects a Seller-enabled provider per Shop Order; Seller pickup enforces it. Courier assignment stays outside Buyer; current adoption remains G25 | Contract documented; client adoption pending |
| G10 | Homepage configured shortcuts include unavailable vouchers/listings; Bazaar/MoneyFest deferred | Omit enabled destinations without approved implemented result; Category cards are keyword search, not exact global Category filter | Discovery/product; 2 |
| G11 | Quote/voucher rules exist but voucher-specific concurrency and full UX cases remain open | No wallet/claim/code-entry/authoring API promises; verify stacking, zero savings, stale choices and limited capacity | Checkout/API/Flutter; 3/5 |
| G12 | Pending mutation keys/payloads are session memory; no GET placement-by-key | Same-key in-session reconciliation; process-death uncertainty needs approved recovery/storage design before unattended recovery claims | Checkout/security; 3/5 |
| G13 | General notification list/detail/read exists; unread-count/read-all and push device registration absent | Per-page unread is not an exact global badge; no invented unread-count, native push/background guarantee | Notifications; 4 |
| G14 | Wishlist alerts, voucher wallet/authoring, online payments, returns/refunds, live GPS/ETA and broader account controls deferred | Clear unavailable state or omit action; source enum value alone is not implemented workflow | Owning platform features; later |
| G15 | Profile/review multipart lacks durable image replay; Customer profile decode/rewrite and 8,000-edge/40M-pixel validation fixed locally by audit B04 (2026-10-10); deployed runtime, review processing and retention remain unverified | Reconcile uncertainty and retain partial review progress; profile rejects corrupt/warning-producing images with safe `422 photo` errors and preserves prior photo; verify live/Flutter adoption separately | Upload/security; 2/4/5 |
| G16 | Three channels implemented; retention/abuse policy, operational two-worker races/live exchanges remain release gates | Foreground HTTP polling and scoped read-only state; Laravel private media is implemented, Flutter adoption remains G27; no Admin blanket transcript access | Messaging/API/Flutter; 4/5 |
| G17 | Support ticket notifications/linked records/attachments deferred; requester UI says description but API uses body | Only subject/category/body create, revision-checked reply; pending/inactive Customers have no exception | Support; 4 |
| G18 | Sanctum token expiration currently null; no refresh/revoke-all/session registry API | Secure restore and /me revalidation; current-token logout, documented password token effects; no invented refresh schedule | Security/Auth; 1/5 |
| G19 | Portable contracts now cover inspected behavior; canonical historical wording remains optional evidence | Local specs/typed contracts govern implementation; log live contract differences separately | Documentation resolved; each phase |
| G20 | Phase 1 Android builds, Chromium UI/transport and public localhost API checks now pass; installed Android and live authenticated flows remain unverified | See [Phase 1 evidence](phase-1-verification.md); preserve broad acceptance criteria until target/account checks pass | Flutter/release; 1/5 |
| G21 | B02 server guard implemented 2026-10-10; external adoption/live verification pending | Laravel restricts corrections to recipient/contact at an identical complete trimmed location and seven-decimal coordinate pair, preserving frozen price/provider/route. Order deliveryAddress adds nullable latitude/longitude; adopt coordinate checks and ADDRESS_LOCATION_CHANGE_NOT_ALLOWED. Geographic changes/repricing remain deferred. Prior Phase 3 client evidence and adopted 57e9eb2 baseline are unchanged. | Buyer/Order/API; 3/5 |

Unavailable APIs must not be mocked into production success. Test fixtures may model future/denied states clearly, but future endpoint proposals need separate backend authorization and acceptance.


## Newly inspected contracts — checkout 57e9eb2

| ID | New finding / treatment | Release evidence |
| --- | --- | --- |
| G22 | Support detail cursor uses Laravel’s global request-bound resolver; source confirms traversal is available. | Verify advancing older-event pages and no-progress guard with controlled live records; no backend gap claimed. |
| G23 | NCR has direct cities/no Province nodes, but saved Address province remains required text. Flutter requires the `National Capital Region (NCR)` compatibility selection, never a fictional PSGC Province; other direct cities without a supported Province mapping block save. | Verify exact saved-text NCR shipping coverage; unsupported direct-city mappings remain blocked. |
| G24 | Registration Resource exposes profile_photo_path (normally null); discard this field. No evidence upload endpoint exists. | Backend owner assesses privacy of any non-null path; Flutter never constructs URLs from it. |

Corrected portable contract details: Account uses account envelope; Quote Address has label but no coordinates; Support write replay preserves201 and Customer reply automatically reopens waiting/resolved tickets. These were source inspections, not live exchanges. No additional routes or backend fixes are authorized.

## Phase 2 runtime checks — 2026-10-04

Local contract baseline remains `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`; running Laravel revision is unidentified. Public Home/recommendations, Products/Shops search, directory/category/Shop browsing, Product detail and resolver parse successfully. Account, addresses, Wishlist, recency and avatar deny unauthenticated reads. No new runtime contract conflict was observed in that scope. G04 Retry-After exposure, G07 provider credentials, G15 upload hardening and G23 deployed NCR coverage remain open. [Phase 2 evidence](phase-2-verification.md) separates synthetic private workflows, public live checks and unverified acceptance.

## Phase 3 runtime checks — 2026-10-04

Cart/Orders/detail/tracking/Batch unauthenticated denial and exact localhost:8766 POST/PATCH Idempotency-Key preflights pass. Running backend revision remains unidentified; no authenticated commerce or transactional behavior was verified. G04/G11/G12/G21 remain open. [Phase 3 evidence](phase-3-verification.md) records synthetic replay, lifecycle and G21 restriction checks separately.

## Phase 4 runtime checks — 2026-10-04

Public questions/reviews and private conversation/context/notification/ticket unauthenticated or invalid-bearer denial checks pass, together with exact localhost:8766 preflights. No contract conflict was observed in this limited runtime scope; running backend revision remains unidentified. Controlled counterpart exchanges, real uploads and server concurrency remain unverified. G04 header exposure, G12 memory-only recovery, G15 upload hardening, G16 communication retention/abuse and G22 controlled live ticket-cursor gates remain open. See [Phase 4 evidence](phase-4-verification.md) for synthetic recovery and browser coverage.

## Current platform inspection — 2026-10-04

Imported runtime sections above report checks performed in the external Flutter project, not here. Its adopted baseline remains `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`; the running API revision was unidentified. Current source inspection is `22b0a48f9575ead182d03c35ab87345711c23b90`.

| ID | Gap / required action | Owner / gate |
| --- | --- | --- |
| G25 | New checkout logistics-options, Shop-scoped selections, quote/Batch shipping DTOs and nullable Order shippingProvider are not established as adopted by imported Buyer code. Adopt current typed models, selections in frozen intent and failure/retry states; reverify parsers/UI and controlled commerce. Earlier tests cannot complete this gate. | Buyer/API; Phase 3/5 |

[Shipping contract](../api/shipping-selection.md) documents provider eligibility, automatic single-option fallback, explicit multiple choice, empty discovery, route degradation and exact-key recovery. The storefront retains guest browsing/recency; Flutter requires sign-in and account-only history.

### G26 — Voucher names and default pairing (2026-10-09)

Backend adds `name` to quote candidates, applied vouchers and frozen Batch vouchers. Permit one App discount plus one App shipping per batch and one of each benefit per Shop, regardless of stored stacking flags; replace only same-benefit selections. Parse/display names and caps, retain UUID/target requests and test snapshots/retries. See [contract delta](../api/voucher-selection-update.md). External Flutter adoption, Android/browser and live acceptance are unverified; prior implementation status remains unchanged.

## Reported checkout provider failures — 2026-10-05

Historical external-project user reports first described Buyer quote HTTP 500 / PostgreSQL SQLSTATE 42P01 for missing `shop_logistics_providers` while storefront checkout reportedly worked. Later on October 5, the user reported storefront failure too: “No shipping provider can quote this Shop order right now.” That later observation supersedes storefront success at that time; different responses do not establish a shared root cause.

Current resolution, API origins, deployed revisions, database schema and enabled Shop-provider configuration remain unverified here. Current source contains the provider-selection contract and migration; its presence does not prove deployment. Keep COD placement gated on a valid server quote. Compare each deployed target/schema/provider configuration and verify quotes through both clients. These are attributed user reports, not live checks run during this sync, and do not establish a current platform outage or a Flutter code cause. No migration or repair ran here; never show database traces in the client.

## Current contract review — 2026-10-07

[Review and preservation record](synchronization-2026-10-07.md) distinguishes the current reviewed backend from Buyer adoption `57e9eb2`. New presentation evidence closes neither provider-selection G25 nor media adoption G27.

| ID | Gap / required action | Owner / gate |
| --- | --- | --- |
| G27 | Laravel private chat attachments, additive message DTOs and runtime controls are implemented; the imported Flutter evidence demonstrates text-chat workflows only. Adopt upload/status/retry, explicit binding/send, authenticated image/video/document delivery and private lifecycle cleanup. | Buyer/API; communication/device acceptance |

General-notification unread-count/read-all/native push remain unavailable under G13. The newer web chat-alert API is separate from that inbox; this synchronization claims no Flutter alert adoption.

Gap IDs after the 2026-10-09 rebase: G26 covers voucher names/default pairing; G27 covers private chat media. Historical imported reports and archives that call media G26 retain their original IDs and refer to the gap now tracked as G27. Neither adoption gap is completed by this documentation merge.

## Map acceptance update — imported 2026-10-08 evidence

[MapLibre report](maplibre-verification.md) records analysis, focused synthetic tests, browser renderer checks and APK/web builds. The full suite reports one pre-existing desktop checkout accessibility failure; retain it until separately fixed and verified. [Live Geoapify report](geoapify-live-verification.md) records public-landmark lookup/tiles and localhost interaction after an allowed-origin change. Laravel responses stayed synthetic. These results narrow G07 only for that public key/local origin; installed Android/GPS/TalkBack, production restrictions/quotas, real-account CRUD/shipping, provider selection G25 and media G27 remain open. No Flutter/provider/runtime checks were rerun during this sync.
