# Backend and Buyer integration gaps

Phase 5 local readiness adds [repeatable checks and the acceptance runbook](phase-5-verification.md).
The 2026-10-04 API probe was initially unreachable, then the API recovered without
Buyer starting/modifying Laravel. All 42 public/denial/preflight tests and extended
localhost:8766 browser smoke passed. ADB reported no attached devices; CORS exposed
headers remain absent. No new backend conflict was established.
Controlled authentication/device gates, deployed revision, Retry-After exposure,
production application ID/signing and unresolved owner decisions remain open.

Baseline reviewed 2026-10-03. Phases 1–4 are implemented with verification recorded separately; unverified live/device gates remain open. This register identifies unavailable platform behavior, source contradictions and integration/release decisions; it does not authorize backend changes.

| ID | Gap and evidence | Buyer delivery treatment | Owner / phase |
| --- | --- | --- | --- |
| G01 | Customer RegisterRequest/controller omit reference-required address/ID evidence | Profile/credentials-only pending registration; explain limitation; no copied Courier upload parts | Customer API/Admin review; 1 follow-up |
| G02 | No pending-applicant read, rejection resubmission, appeal exception or email-verification policy | Informational pending/rejected state and later login; no protected applicant support | Customer Auth; 1 |
| G03 | Reset mail URL targets configured storefront; native links not configured | Use trusted storefront recovery; approve native app-link/reset handoff separately | Auth/deployment; 1 |
| G04 | Laravel source exposes Retry-After and permits Buyer localhost:8766 (B05); historical live checks predate this fix | Verify deployed headers and actual client cooldowns; preserve delta-seconds/HTTP-date handling | API/deployment; 1/5 |
| G05 | Fresh-project SDK/package/architecture choices supplied and Phase 1 dependencies resolved | Flutter 3.47.2 / Dart 3.13.2, locked dependencies, Phase 1 analysis/tests and Android/web builds pass; installed-device and real-account gates remain open | Flutter; 1/5 |
| G06 | All 19 source-identical PSGC assets/manifest copied/registered; Phase 2 Dart loaders implemented; newer selected-only locality dropdowns require valid listed entries and failed assets block save with Retry | Source checksums and all regional hierarchies pass; deployed NCR shipping coverage and installed-device acceptance remain open | Flutter/data; 2 |
| G07 | MapLibre/geolocator implemented and localhost Geoapify verified October 8; native and production acceptance remain open | Geoapify intentional pin only; keep text-only if credential/permission/provider gate unresolved | Maps/deployment; 2/5 |
| G08 | Portable Cart/Product contracts reconciled against source; historical canonical contradictions preserved upstream | Use local typed operations/specs; no backend/runtime fix implied | Current shipping adopted; live/device G25 open |
| G09 | Portable checkout/fulfillment context reconciled with implemented downstream workflow | Customer selects a Seller-enabled provider per Shop Order; Seller pickup enforces it. Courier assignment stays outside Buyer; current client evidence is recorded under G25 | Shipping adopted; live/device G25 open |
| G10 | Voucher discovery/collection is implemented; Bazaar/MoneyFest remain placeholders | Keep unsupported destinations unavailable | Discovery/product; 2 |
| G11 | Voucher collection/wallet, names/pairing and server quotation exist; funding-specific client and live/device checks remain incomplete | No code entry/authoring; verify server reasons, caps, capacity and exact replay | Checkout/API/Flutter; 3/5 |
| G12 | Pending mutation keys/payloads are session memory; no GET placement-by-key | Same-key in-session reconciliation; process-death uncertainty needs approved recovery/storage design before unattended recovery claims | Checkout/security; 3/5 |
| G13 | General notification list/detail/read exists; unread-count/read-all and push device registration absent | Per-page unread is not an exact global badge; no invented unread-count, native push/background guarantee | Notifications; 4 |
| G14 | Wishlist alerts, voucher authoring, online payments, returns/refunds, live GPS/ETA and broader account controls deferred | Clear unavailable state or omit action; source enum value alone is not implemented workflow | Owning platform features; later |
| G15 | Profile/review multipart lacks durable replay; B04 now bounds profile dimensions and performs isolated full decode/rewrite | Preserve reread/partial-review recovery; deployed upload, retention and installed-device acceptance remain open | Upload/security; 2/4/5 |
| G16 | Three channels implemented; retention/abuse policy, operational two-worker races/live exchanges remain release gates | Foreground HTTP polling and scoped read-only state; Laravel private media is implemented, Flutter image support is implemented locally; video/document uploads and live/device gates remain G27; no Admin blanket transcript access | Messaging/API/Flutter; 4/5 |
| G17 | Support ticket notifications/linked records/attachments deferred; requester UI says description but API uses body | Only subject/category/body create, revision-checked reply; pending/inactive Customers have no exception | Support; 4 |
| G18 | Sanctum token expiration currently null; no refresh/revoke-all/session registry API | Secure restore and /me revalidation; current-token logout, documented password token effects; no invented refresh schedule | Security/Auth; 1/5 |
| G19 | Portable contracts now cover inspected behavior; canonical historical wording remains optional evidence | Local specs/typed contracts govern implementation; log live contract differences separately | Documentation resolved; each phase |
| G20 | Phase 1 Android builds, Chromium UI/transport and public localhost API checks now pass; installed Android and live authenticated flows remain unverified | See [Phase 1 evidence](phase-1-verification.md); preserve broad acceptance criteria until target/account checks pass | Flutter/release; 1/5 |
| G21 | B02 enforces recipient/contact-only corrections at identical trimmed location and seven-decimal pins | Buyer parses frozen Order pins, compares seven-decimal pairs and handles specific 422 recovery (B10); synthetic regression evidence is in Progress; live/device acceptance remains open | Orders/API/Flutter; 3/5 |

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

Historical runtime sections above record checks performed in this Buyer project on their original dates. The newer backend contract is supplied by the webapp handoff and was not inspected or executed locally during this sync. Its adopted baseline remains `57e9eb20e569321b1c7ab7ae22265a3e5cbd7c50`; the running API revision was unidentified. Current source inspection is `22b0a48f9575ead182d03c35ab87345711c23b90`.

| ID | Gap / required action | Owner / gate |
| --- | --- | --- |
| G25 | Flutter now adopts `22b0a48` options, Shop-scoped selections, current quote/Batch DTOs and nullable Order providers. [Synthetic client evidence](shipping-selection-verification.md) covers parsing, accessible choice/fallback, invalidation and exact frozen recovery. Controlled live commerce, installed Android/TalkBack and deployed schema/provider configuration remain open; client tests do not complete those gates. | Buyer/API; Phase 3/5 |

[Shipping contract](../api/shipping-selection.md) documents provider eligibility, automatic single-option fallback, explicit multiple choice, empty discovery, route degradation and exact-key recovery. The storefront retains guest browsing/recency; Flutter requires sign-in and account-only history.

<a id="reported-checkout-deployment-failure--2026-10-05"></a>

## Reported checkout provider failures — 2026-10-05

Historical user reports first described Buyer quote HTTP 500 / PostgreSQL SQLSTATE 42P01 for missing `shop_logistics_providers` while storefront checkout reportedly worked. Later on October 5, the user reported storefront failure too: “No shipping provider can quote this Shop order right now.” That later observation supersedes storefront success at that time; different responses do not establish a shared root cause.

Current resolution, API origins, deployed revisions, database schema and enabled Shop-provider configuration remain unverified here. Current source contains the provider-selection contract and migration; its presence does not prove deployment. Keep COD placement gated on a valid server quote. Compare each deployed target/schema/provider configuration and verify quotes through both clients. These are attributed user reports, not live checks run during this sync, and do not establish a current platform outage or a Flutter code cause. No migration or repair ran here; never show database traces in the client.

## Current contract review — 2026-10-07

[Review and preservation record](synchronization-2026-10-07.md) distinguishes the current reviewed backend from Buyer adoption `57e9eb2`. New presentation evidence closes neither provider-selection G25 nor media adoption G27.

| ID | Gap / required action | Owner / gate |
| --- | --- | --- |
| G27 | Laravel private chat attachments, additive message DTOs and runtime controls are implemented; local Flutter now adopts images with upload/status/retry, explicit binding/send and private lifecycle cleanup. Receive-only video/document playback/download and inclusive 8 MB image selection are implemented locally; mobile video/document uploads and live/installed-device acceptance remain open. | Buyer/API; communication/device acceptance |

General-notification unread-count/read-all/native push remain unavailable under G13. The newer web chat-alert API is separate from that inbox; this synchronization claims no Flutter alert adoption.

## Map acceptance update — local 2026-10-08 evidence

[MapLibre report](maplibre-verification.md) records analysis, focused synthetic tests, browser renderer checks and APK/web builds. The full suite reports one pre-existing desktop checkout accessibility failure; retain it until separately fixed and verified. [Live Geoapify report](geoapify-live-verification.md) records public-landmark lookup/tiles and localhost interaction after an allowed-origin change. Laravel responses stayed synthetic. These results narrow G07 only for that public key/local origin; installed Android/GPS/TalkBack, production restrictions/quotas, real-account CRUD/shipping, provider selection G25 and media G27 remain open. No Flutter/provider/runtime checks were rerun during this sync.

## Upload recovery client verification — 2026-10-10

[Upload recovery evidence](upload-recovery-verification.md) records bounded Android/web
selection, platform-neutral Review dimension checks, individual cancellation, current
account/photo rereads and partial Review recovery. No durable image replay or backend
decoding/rewrite/retention behavior is inferred. G15 and live/installed-device gates remain open.

## Voucher collection adoption — 2026-10-11

| ID | Gap / required action | Owner / gate |
| --- | --- | --- |
| G28 | Buyer discovery/detail, Shop/platform collection, My Vouchers and deliberate Checkout requote are implemented. See [client evidence](voucher-collection-verification.md); deployed API/schema, controlled commerce and installed Android/TalkBack remain open. | Buyer/API; release acceptance |

## Order images — audit G30 / T02

G30 is implemented locally in Buyer Order history/detail with nullable image parsing,
public-media loading and safe fallbacks. T02 has Laravel endpoint coverage for image
precedence/fallback/null projections across quote, placement/replay, history/detail
and batch retrieval. [Verification](order-images-verification.md) distinguishes local
checks from deployed media and installed Android/TalkBack acceptance, which stay open.

## Audit G27 receive-only media — 2026-10-12

[Verification](private-media-verification.md) records local consumption and image-limit adoption. The audit ID refers to private media (Buyer-local G27, portable G27); voucher IDs and historical reports remain unchanged. Runtime/deployed/installed-device acceptance is still open.


## Checkout thumbnails — audit G31

G31 is implemented locally in Buyer Checkout review/results using optional nullable
quote image parsing and shared trusted public-media thumbnails/fallbacks.
[G31 verification](checkout-images-verification.md) records actual checks separately
from deployed-media and installed Android/TalkBack acceptance, which remain open.


## Current source audit — 2026-10-12

Shared IDs: G25 shipping, G26 voucher names/default pairing, G27 private chat media, G28 voucher collection. Earlier Buyer reports using G26 for media retain their original bytes and refer to G27 here. Audit G26 is also a historical private-media issue identifier, not proof that the voucher gate closed.

- G25: per-Shop provider choices/frozen selections and shipping projections are implemented; live commerce, deployed configuration and device gates remain open.
- G26: candidate name fallback is implemented; AppliedVoucher/SnapshotVoucher omit names, and selection toggling removes only the same UUID rather than replacing same-benefit App/Shop choices. Adopt the documented names/pairing policy and funding-specific recovery tests.
- G27: image selection/upload/viewing and receive-only MP4/documents are implemented with the inclusive 8,000,000-byte selection cap and permanent 422 replacement. Video/document uploads, live runtime and device acceptance remain open.
- G28: discovery, collection and wallet are implemented; deployed commerce/device acceptance remains open.
- G21: B10 adopts Order coordinates, normalized pin eligibility and specific location-change 422 recovery; live/device acceptance remains open.
- Shop context: Laravel GET /customer/conversations/shops/{shop} and availability projection are implemented; Buyer still uses its earlier prospective Shop flow and does not consume this route/field.

Current checks are documented in [synchronization evidence](synchronization-2026-10-12.md). Historical failure reports and verification runs remain dated evidence; this audit does not establish a current outage or live/device acceptance.

## B09 voucher selection and names — 2026-10-15

Buyer now replaces same-benefit choices in the selected Shop and same-benefit App choices across the batch, preserving opposite benefits and explicit targets. Applied and frozen Batch names/code/savings are parsed and shown with historical code fallback; Order detail/history keeps its code-only contract. [B09 evidence](voucher-selection-verification.md) supersedes the names/pairing source gaps recorded in the dated October 12 audit above.

This resolves audit B09/F07 in local source and narrows Buyer G26 only for names/pairing. Funding-specific client verification, deployed API/schema/provider configuration, controlled real-account redemption/concurrency and installed Android/TalkBack acceptance remain open. Exact uncertain-placement replay remains memory-only (G12); this change adds no recovery endpoint or backend behavior.
