# Courier Flutter Progress

Short, dated implementation log. Append entries; archive complete logs after 150 physical lines. Preserve historical reports and distinguish local verification from deployed/device acceptance.

## Current status

- Auth v2.6 handling, account/vehicle/policy, inbox and targeted notifications, first-mile pickup/filtering, batch acceptance/hub handoff, photo POD/COD intent, failed attempts, exact-reference history, dashboard v2 with default-v1 fallback, read-only MapLibre routes and private chat images/received MP4/documents are implemented locally. Recovery UI and linehaul screens remain unadopted.
- Historical adoption slices: Auth 4c3f504; earlier operations d7df220; maps 51d9694; failed attempts 4d8bfef; media 28fc740. Inspected source: Laravel `240eefddd4e2e2eea2f9558beec0292efa2121fe`, Courier `177eac1d1d132916cef25054cfc959e223fa409c`. Inspection does not promote every contract to client adoption; deployed revision remains unidentified.
- Live authenticated/deployed API, private-media runtime and installed Android/accessibility acceptance remain open. Media video/document upload remains outside the current mobile release.
- Historical application test/build/browser results are in the archives and verification reports. This sync runs documentation validation only.

## Historical progress

- [Platform history](logs/PROGRESS-2026-10-12.md): original dated results with their own execution scope.
- [Client history](logs/PROGRESS-2026-10-12-2.md): original dated results with their own execution scope.

## 2026-10-12 — Three-project documentation synchronization

- Reconciled server contracts with current Flutter sources, imported newer client evidence, corrected status summaries and retained explicit adoption/release gaps. Archived the two complete role histories separately with attribution; existing archives remain unchanged.
- Validated portable links/anchors, JSON/examples, endpoint inventory, spec bounds, synchronized copies, preserved archive prefixes and PSGC bytes, plus Git whitespace. See [audit and validation](references/synchronization-2026-10-12.md). No application tests/builds or live/device checks were rerun.

## 2026-10-14 — Email-verified account password changes

- Added password-code requests and the account email-verification dialog before Courier password changes. Typed API fields, resend/expiry and Retry-After, account cleanup, uncertain outcomes, unsaved-profile warnings and the existing all-device sign-out are preserved. Adopted the new password-code API contract and updated only affected documentation.
- Verification: 44 account/widget tests, Flutter analyzer, web build and Android release APK pass, including existing 320/390px light/dark and 1×/2× accessibility checks. Live SMTP/deployed API and installed-device acceptance remain open.

## 2026-10-14 — Email-first registration OTP

- Adopted registration-email contract v1 (2026-10-14): public code/verify APIs, six-digit OTP, required role/email-bound proof, resend/expiry/Retry-After, memory-only secrets, retained registration drafts and existing approval gates. Existing accounts keep their login behavior. Updated typed API models/repositories and native registration UI; no new dependencies.
- Verification: 190 auth checks, 7 app checks and targeted registration-success cleanup, Flutter analyzer, web build and Android release APK pass. Laravel registration/mail enforcement and isolated PostgreSQL concurrency checks pass independently; live SMTP/deployed API and installed-device acceptance remain open. API enforcement requires coordinated client release and the new backend migration/workers.


## 2026-10-15 — D02 shipping context clarification

- Corrected only copied requirements, workspace and schema shipping passages against Laravel `33f668fd672226211accdbbb3b16052d9c48e592`: new Orders require complete local/planned routes; unavailable quote/placement recovery uses SHIPPING_COVERAGE_UNAVAILABLE/QUOTE_STALE. Historical unplanned prices, fulfillment/Finance holds and exact replay remain valid. Synchronized these passages to the Courier project's matching guides.
- Checked affected links, copies and whitespace; Courier source, workflows, API/DTOs, adopted revisions and prior implementation/device status remain unchanged. No Flutter tests/builds, live/deployed API or installed-device checks were rerun for this documentation-only correction.


## 2026-10-15 — G26 real media runtime and Android acceptance

- Added test-only runtime/browser/Android fixtures using production repositories/media widgets/native adapters and memory-only generated credentials. Image send/replay, MP4 seek/background/temporary cleanup, Save As cancel/picker-failure recovery/exact export and actual bearer logout pass. Production source/API/schema/dependencies and media adoption `28fc740` are unchanged; real runtime API source is `e6dc2cb4a7322dc3c5be649f467460c7e1114328`.
- Fresh verification: Courier 106 and Buyer 64 focused tests, clean analyzers, Laravel 17 tests/314 assertions, six isolation guards, 16 real storage/queue/FFmpeg/ClamAV/relationship checks, eight connected Chromium and six installed API 35 emulator checks per app; standard web/release APK and test builds pass. See [G26 evidence](references/private-media-runtime-verification.md).
- Synchronized canonical/portable evidence. Isolated local media acceptance is verified; deployed API/client pairs/Azure and production scanner/worker operations, physical devices/provider write failures/TalkBack, full-app login/account switching and signing remain open. Historical evidence is preserved; generated artifacts remain ignored.
