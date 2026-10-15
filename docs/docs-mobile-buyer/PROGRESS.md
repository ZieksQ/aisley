# Buyer Flutter Progress

Short, dated implementation log. Append entries; archive complete logs after 150 physical lines. Preserve historical reports and distinguish local verification from deployed/device acceptance.

## Current status

- Buyer Phases 1–4/Phase 5 tooling, MapLibre/PSGC addresses, per-Shop shipping, voucher collection/wallet, Order/Checkout thumbnails and private chat images/received MP4/documents are implemented locally. See the dated entries below for voucher names/pairing, Order coordinates and Shop-context adoption; live/device gates remain open.
- Historical adoption slices: General 57e9eb2; shipping 22b0a48; collection 7e89b391; Order/Checkout images 5d55ecf; media 28fc740. Inspected source: Laravel `240eefddd4e2e2eea2f9558beec0292efa2121fe`, Buyer `7924cf06158817a2dcd709ec19a7442e3496dda5`. Inspection does not promote every contract to client adoption; deployed revision remains unidentified.
- Live authenticated/deployed API, private-media runtime and installed Android/accessibility acceptance remain open. Buyer provider configuration and signing gates remain open.
- Application test/build/browser results are dated in the entries, archives and verification reports below.

## Historical progress

- [Platform history](logs/PROGRESS-2026-10-12.md): original dated results with their own execution scope.
- [Client history](logs/PROGRESS-2026-10-12-2.md): original dated results with their own execution scope.

## 2026-10-12 — Three-project documentation synchronization

- Reconciled server contracts with current Flutter sources, imported newer client evidence, corrected status summaries and retained explicit adoption/release gaps. Archived the two complete role histories separately with attribution; existing archives remain unchanged.
- Validated portable links/anchors, JSON/examples, endpoint inventory, spec bounds, synchronized copies, preserved archive prefixes and PSGC bytes, plus Git whitespace. See [audit and validation](references/synchronization-2026-10-12.md). No application tests/builds or live/device checks were rerun.

## 2026-10-14 — Backend complete-route checkout contract

- Updated affected shipping/checkout contracts, error descriptions, field notes and synthetic examples: discovery omits incomplete routes, explicit quote rejects with `SHIPPING_COVERAGE_UNAVAILABLE`, and lost coverage at placement returns `QUOTE_STALE` before effects. Historical unplanned Orders and committed same-key replay retain their behavior.
- The web storefront now defaults providers, uses a separate draft/Apply selection page and confirms before placement. These changes do not establish Flutter adoption; existing client/device/live acceptance remains open. Affected portable links and JSON validate; Laravel/web evidence is recorded in the canonical app progress log.

## 2026-10-14 — Email-verified account password changes

- Added current/new passwords → emailed verification code → confirmed password change in Buyer account settings. Typed code requests/confirmation preserve the current bearer, expiry/resend limits, cancellation, account-switch cleanup and uncertain-result sign-in reconciliation. Adopted the new password-code API contract and updated only affected documentation.
- Verification: 27 focused contract/controller/widget tests, Flutter analyzer, web build and Android release APK pass; portable bundle validation passes (988 links, 22 specs, 19 PSGC registrations). Live SMTP/deployed API and installed-device acceptance remain open.

## 2026-10-14 — Email-first registration OTP

- Adopted registration-email contract v1 (2026-10-14): public code/verify APIs, six-digit OTP, required role/email-bound proof, resend/expiry/Retry-After, memory-only secrets, retained registration drafts and existing approval gates. Existing accounts keep their login behavior. Updated typed API models/repositories and native registration UI; no new dependencies.
- Verification: 77 networking/session/OTP/responsive checks and the additional registration-screen draft test, Flutter analyzer, web build and Android release APK pass. Laravel registration/mail enforcement and isolated PostgreSQL concurrency checks pass independently; live SMTP/deployed API and installed-device acceptance remain open. API enforcement requires coordinated client release and the new backend migration/workers.

## 2026-10-14 — B11 Buyer password reconciliation lifetime

- Buyer SessionController now owns nonsecret pending-password/reconciliation and cooldown state across Back/Cancel, screen recreation and identity/consent revalidation. Delayed confirmations settle only their originating session; fresh authentication/identity loss resets recovery. Secrets stay screen-local; restart persistence is outside this memory-only scope. Updated the paired password API/account specifications.
- Buyer source verification: 18 new lifetime tests plus 51 adjacent account/session/contract regressions, Flutter analyzer, release web/Android builds and bundle validation pass with synthetic repositories. Live API/SMTP, installed-device/TalkBack and deployed acceptance remain open; existing Android SDK XML warning remains. Preserve previous imported evidence and client history.

## 2026-10-15 — B09 voucher replacement and applied/Batch names

- Implemented same-benefit replacement across the batch for App vouchers and within the selected Shop for all issuers; preserved opposite benefits, explicit targets, targeted deselection and current-quote/eligibility/max-20 guards. Applied/Batch DTOs and review/results now retain names with historical code fallback, secondary codes and exact savings; Order detail keeps its code-only contract. No API/schema/dependency changes.
- Added 35 controller/DTO/widget regressions, preserving immutable uncertain-placement payload/key and explicit refreshed review. Updated voucher/Checkout specs, adoption/status notes and [B09 verification](references/voucher-selection-verification.md); retained historical records and the separate shipping/Order/messaging boundaries.
- Verification: 197 focused tests, Flutter analyzer, changed-file formatting, web/Android release builds, bundle validation and whitespace pass. Chromium passes 32 synthetic layouts/11 journeys; reviewed B09 320/1440px screenshots. Widgets cover 320/390/600/800/1024/1440px, long names, doubled text and landscape. Evidence: ignored `build/b09-tests.log` and `build/verification/vouchers/`. Funding-specific, deployed/live-account and installed Android/TalkBack gates remain open; existing SDK XML warning remains.

## 2026-10-15 — B10 frozen Order pins in contact correction

- Buyer now parses nullable frozen Order coordinates and compares valid pairs at seven-decimal storage precision before offering or submitting a saved contact correction. Both-null pairs remain eligible; changed, added, removed, partial or invalid pins are blocked alongside existing trimmed-text/contact checks.
- Added explicit ADDRESS_LOCATION_CHANGE_NOT_ALLOWED feedback while preserving field errors, detail refresh, cleared pending requests and required saved-row reselection. Synchronized the owning Buyer spec/G21 notes; no API/schema/dependency changes.
- Verification: 13 new B10 regressions plus 74 adjacent Order/Checkout/shipping/recovery tests pass (87 total); Flutter analyzer, bundle validator (1008 links/22 specs/19 PSGC checks), formatting and whitespace pass. Synthetic transport verifies contact-only success and specific 422 recovery. Builds, live/deployed API and installed-device acceptance were not rerun and remain open.

## 2026-10-15 — G32 Shop context and availability

- Adopted Laravel's read-only Shop context/availability contract at `1d40b5d34fac1bfa93b9c32f5ee4fb0d54f43167`: scoped existing-thread discovery, business-status labels and Shop/Product/Order context preservation. Existing-thread permissions and owned-Order vacation starts remain authoritative; uncertain endpoint/body/attachment IDs/key survive discovery and consent recovery. Definitive conflicts require explicit review. No API/schema/dependency or Courier changes.
- Verification: 67 new regressions and 186 affected messaging/media/recovery/responsive/accessibility tests pass; Flutter analyzer, changed-file formatting, web/Android release builds, bundle regression/validation and whitespace pass. Chromium passes seven layouts/nine synthetic journeys at localhost:8766; reviewed 320/1440px captures. See [G32 evidence](references/shop-context-verification.md) and ignored `build/g32-*.log` / `build/verification/shop-context/`.
- Synced affected Buyer documentation/adoption records to AISLEY. Controlled deployed/live counterpart exchange, media runtime, installed Android/TalkBack and signing gates remain open; exact-send recovery remains memory-only (G12). Historical audits and archives remain unchanged.


## 2026-10-15 — D02 complete-route guidance synchronization

- Aligned shipping contracts, Checkout spec, error/operation notes and synthetic scenarios with Laravel `33f668fd672226211accdbbb3b16052d9c48e592`: incomplete routes are omitted/rejected, placement coverage loss returns QUOTE_STALE before effects, and recovery requires refreshed reviewed intent. Historical unplanned Batch/Order DTOs/prices, holds and exact uncertain/committed replay remain valid; the standalone Buyer copy is synchronized.
- Buyer bundle validation (1018 links/22 specs/19 PSGC checks), four bundle regressions, affected JSON/links/examples, paired copies, stable operation/request/success fixtures and evidence-prefix checks pass. No Flutter/API source, test expectations or dependencies changed; earlier G25 evidence remains unchanged and revised eligibility/recovery, live/deployed commerce and installed-device acceptance remain open. See [D02 clarification](references/shipping-selection-verification.md#d02-complete-route-guidance-clarification--2026-10-15).


## 2026-10-15 — G26 real media runtime and Android acceptance

- Added test-only real-runtime/browser/Android harnesses using production media repositories/widgets/adapters, generated accounts/files and memory-only bootstrap credentials. Verified image send/replay, MP4 controls/background/temporary cleanup, Save As cancel/unavailable-picker recovery/exact export and actual bearer logout; no production source/API/schema/dependency change. Media contract adoption remains `28fc740`; inspected runtime API is `e6dc2cb4a7322dc3c5be649f467460c7e1114328`.
- Verification: 16 real local storage/worker/FFmpeg/ClamAV/relationship checks, six harness isolation tests, Laravel 17 tests/314 assertions, Buyer 64 and Courier 106 focused tests, clean analyzers, eight connected Chromium checks and six installed API 35 emulator checks per app; standard web/release APK and test builds pass. See [G26 evidence](references/private-media-runtime-verification.md).
- Synced affected canonical/portable evidence across the three repositories. The local runtime/browser/emulator slice is verified; deployed API/client pairs, Azure and production worker/scanner operations, physical Android/provider failures/TalkBack, full-app login/account switching and signing remain open. Historical audits and evidence are preserved; generated credentials/media/screenshots stay ignored.
