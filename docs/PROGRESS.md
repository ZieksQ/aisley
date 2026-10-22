# Progress

Short, dated log of what's been implemented. Update after each completed feature or meaningful change. This log covers the whole app; append entries and preserve archives.

## Archive

- [Complete progress log through 2026-10-16](logs/PROGRESS-2026-10-16.md)

## 2026-10-15 — D02 shipping guidance and progress archive

- Archived the complete 157-line log at [PROGRESS-2026-10-15.md](logs/PROGRESS-2026-10-15.md) after correcting D02 across canonical and portable shipping guidance and the two Flutter project copies. New Orders require complete local/planned routes; historical fallback prices/DTOs/holds and exact replay remain valid. Application behavior is unchanged.
- Buyer bundle validation and all four regression tests pass; scoped documentation/JSON/example/copy checks pass. Revised Flutter recovery, live/deployed API and installed-device acceptance remain open; no application tests/builds reran. Continue app-wide entries here.

## 2026-10-15 — G26 real private-media runtime and emulator acceptance

- Added guarded opt-in source-copy/SQLite/private-storage/worker/scanner acceptance tooling with synthetic accounts/media, a real eight-second MP4, seven relationship contexts, exact replay/conflict, denied/ended history, replacement-Courier/organization privacy and token cleanup. Source secrets/storage/databases/bootstrap caches are excluded; production source/API/schema/dependencies remain unchanged.
- Fresh checks pass: 16 real runtime cases, six isolation/redirect guards, Laravel 17 tests/314 assertions including live ClamAV, Buyer 64/Courier 106 focused tests, clean analyzers, eight connected Chromium and six installed API 35 emulator checks per app, standard web/release APK and test builds. [Evidence](docs-mobile-buyer/references/private-media-runtime-verification.md) records snapshots/hashes/commands and limits; affected portable and external records are synchronized.
- The isolated local media slice of audit G26 is verified. Deployed release pairs/Azure, production worker/scanner operations, physical Android/providers/TalkBack, full-app login/account switching and signing remain open. Existing audit/history and adoption records remain intact; no ordinary database, secret file or production resource was accessed.

## 2026-10-16 — Seller warehouse picking sheets

- Added an icon-only print selection action to Order monitoring, row/current-page checkboxes, up to 50 selections across pages, a selected count, Print and Cancel. Filter changes clear selection; PDF failures preserve it. Kept compact rows, keyboard controls, light/dark contrast and mobile action wrapping.
- Added a Sanctum/active-Seller/consent-protected, rate-limited PDF read that resolves every selected Order through the authenticated Seller's Shop and rejects mixed foreign/missing selections. The A4 two-column sheet prints Order/customer-recipient snapshots, dates/status/destination, and every purchased product/variant/options/SKU/quantity with picking checkboxes and repeating page headers. Printing has no fulfillment or stock side effects; no dependency/schema/mobile-contract changes.
- Verification: Seller build/typecheck/lint, scoped Pint/PHP syntax, 13 API tests/243 assertions, 8 order-action tests and whitespace checks pass. Chromium with synthetic HTTP passes selection/pagination/50-order limits/keyboard/PDF retry/pop-up recovery, 8 selection viewport/theme checks and all 48 existing order-page checks. Reviewed final screenshots and an A4 sample; PDF text extraction preserves all 66 SKU lines in order across 14 pages. Artifacts: `node_modules/.cache/seller-operations`. API tests use isolated SQLite; live PostgreSQL/API, native PDF-viewer automation and physical-printer acceptance were not run. Existing large-bundle warnings remain.

## 2026-10-17 — Simplified warehouse picking PDF

- Reduced picking-sheet spacing and widened the product column. Each product now shows its checkbox, quantity, name, variant/options and SKU inline, wrapping long details. Order cells retain only the reference and recipient; removed placement/status/destination, heading backgrounds, document title, Shop/date, totals and footer instructions. Updated the Seller specification and removed unused PDF data preparation.
- Verification: 5 picking-sheet API tests/133 assertions, scoped Pint and whitespace checks pass. Reviewed an actual A4 PDF with short/long products, long SKUs, Unicode recipients and missing-item/SKU fallbacks; text extraction preserves all 66 SKU lines in order across 4 pages with repeating headings. Preview artifacts: `node_modules/.cache/seller-operations/simple-picking-sheet-{sample,long}.pdf`.

## 2026-10-17 — Lightweight private chat media

- Added explicit `CHAT_MEDIA_SCAN_ENABLED=false` support while retaining content/type/size checks and fail-closed scanning when enabled. New uploads/bindings accept PNG/JPG/JPEG/MP4 only, up to 8,000,000 bytes each; images have 4,096-pixel edge/8-megapixel bounds. Historical committed WebP/documents and exact send replay remain available. Updated shared picker/help, canonical contracts and only affected portable Buyer/Courier media documents without changing Flutter adoption status.
- Added the isolated `azure_chat` disk and safe `chat:prepare-storage` command. Created/verified the private `aisley-chat-media` container using the locally configured Azure account, including authenticated private ACL and temporary read/write/delete checks; existing container/disk settings were unchanged. Production defaults to a separate single media worker (128 MiB PHP/192 MiB container) and single-threaded FFmpeg; ClamAV uses its own optional profile. Documented production/development environment values and activation in `docker/README.md`; secret-bearing env files were not changed.
- Verification: 20 API/storage tests plus 5 real PNG/JPEG/MP4 inspection tests pass; the latter pass under 128 MiB PHP after a sandbox tool-probe skip in the combined run. Scoped Pint, shared-chat lint, three app builds/typechecks, Seller/Logistics lint, Docker profile resolution, changed documentation links and whitespace checks pass. Chromium passes the shared behavior/boundary fixture, 56 built-role layouts/themes and all seven short-viewport media flows with synthetic transport; reviewed screenshots under `node_modules/.cache/messages-ui`. Full Customer lint reports two pre-existing `no-assign-module-variable` errors in unchanged `tests/customer-vouchers.test.mjs`; no unrelated fixes made. No VM deployment, complete 1 GiB VM load test, live PostgreSQL/ClamAV rerun or Flutter/device acceptance is claimed.

## 2026-10-17 — Removed production ClamAV

- Removed the production ClamAV service, scanner profile and signature-volume declaration, plus obsolete scanner host/port settings in the production example. Retained the media worker, explicit disabled-scanning flag and separate optional local scanner. Updated deployment/architecture/media docs and documented targeted removal of an already-running former production scanner without deleting volumes.
- Verification: Docker Compose resolves the default and all-profile production configurations with no scanner service/image/mount/volume/dependency and the unchanged 128 MiB PHP/192 MiB media worker. Separate local scanner configuration and whitespace checks pass. No application/API/mobile contract changes; no VM deployment or running-container removal was performed from this checkout.

## 2026-10-17 — Progress log merge resolution

- Resolved the platform, Buyer and Courier progress-log conflicts by retaining every dated entry from both branches, preserving both platform archives and keeping the existing Flutter adoption and acceptance records.
- Verification: checked entry preservation, duplicate headings, relative links, log lengths, conflict markers and Git whitespace.

## 2026-10-21 — Courier mockup linehaul transfer jobs

- Added a compact assigned-transfer list and detail view to the development Courier harness using the existing bearer-authenticated, driver-scoped linehaul endpoint. Shows outbound/return routes, status guidance, company truck, schedule, parcel references, arrival/unloading evidence and lane blocks. Includes manual refresh, preserved selection, loading/empty/error states and responsive reference layout; failed refreshes remove stale details.
- Updated the canonical linehaul specification and harness README. Logistics retains departure/receiving authority; no backend, dependency or production Flutter changes.
- Verification: Courier mockup TypeScript/production build, lint and Git whitespace checks pass. Existing large-bundle warnings remain. Browser/device and live API verification were not run.

## 2026-10-21 — Courier linehaul hub route maps

- Added an assigned-driver-only, Sanctum/RBAC/approval/consent-protected linehaul route read using saved origin/destination hub pins and server-side Geoapify Routing. Uses bounded validated geometry/metrics, shared waypoint-credit guards, short timeouts and coordinate-sensitive caching; foreign trips are hidden before cache/provider access. Missing pins, quota and upstream failures preserve known hub details without fabricated road geometry or metrics.
- Added outbound/return hub maps, labelled road/direct-line fallback, drive distance/time, route reload and explicit destination-only external directions to the development mockup. Private tiles use per-map bearer fetches with browser credentials omitted. Grouped the linehaul feature files, fixed narrow status wrapping, and retained Logistics-owned approval/departure/arrival/unloading after the user chose the existing workflow. Updated canonical/location and affected portable Courier contracts; Flutter linehaul adoption stays open.
- Verification: 16 isolated SQLite API/regression tests/227 assertions, scoped Pint, Courier mockup build/typecheck/lint and whitespace checks pass. Chromium with synthetic API/raster data passes road/return selection, refresh, missing pins, quota/auth/tile/list failures, empty state, mobile overflow, directions and bearer-only GET checks. Reviewed desktop/mobile screenshots under `node_modules/.cache/linehaul-browser/`. Existing bundle warnings remain; live PostgreSQL/Geoapify/API and physical-device acceptance were not run.

## 2026-10-22 — Production demo product seeding override

- Made `ProductSeeder` honor `ALLOW_DEMO_SEEDERS_IN_PRODUCTION=true`, allowing the demo catalog and missing Product/Variant packed weights and dimensions to be seeded in production. Default production blocking, existing measurements, Seller edits, ownership guards and inventory ledgers remain preserved. Updated the product specification and production seeding instructions.
- Verification: 11 isolated SQLite seeder tests/99 assertions, scoped Pint and Git whitespace checks pass, including production opt-in, default denial and measurement repair without duplicate inventory movements. No production database was accessed or seeded.

## 2026-10-22 — Regional postal coverage and named demo lanes

- Added a researched offline postal catalogue with 2,136 locality rows / 1,992 distinct codes across all 18 regional fixtures, using PHLPost and a supplementary nationwide directory with current bundled PSGC assignments. Documented sources, corrections, regional counts and the full CSV, including NIR, Sulu in Region IX and leading-zero codes.
- Regional seeding adds missing supported codes and locality-named lanes, including `Santa Cruz Lane` / `STC-01` / `4009`. Production expansion honors `ALLOW_DEMO_SEEDERS_IN_PRODUCTION=true`; default denial remains. Reruns preserve disabled coverage, dedicated/legacy lanes, operator edits, drafts, schedules and immutable history. Shared destination lanes receive separate lanes without renaming the original physical lane; active plans gain validated successors.
- Verification: 20 distinct focused catalogue, production-upgrade, regional-network, shipping, provider and legacy-Luzon tests pass using isolated SQLite, plus scoped Pint, documentation links and whitespace checks. The initial combined regression run terminated before its summary; smaller completed batches cover every case. No production database, live carrier serviceability, PostgreSQL or physical-fulfillment verification is claimed.

## 2026-10-22 — Courier linehaul departure and arrival reports

- Added source Logistics cargo release, assigned-Courier departure and driver arrival-report APIs with Sanctum/RBAC/approval/consent gates, strict confirmation/revision validation, scoped row locks and state-idempotent retries. Reuse the existing atomic manifest/custody workflow and recheck resources, lanes and source authorization; immutable events record both the releasing Logistics authorizer and performing Courier. New nullable migration fields preserve historical evidence. Planned schedules never trigger status changes or restrict early/late departure; arrival reports do not receive cargo or free trucks.
- Added confirmed Depart/Arrived at hub controls, lost-response replay, conflict recovery and submission/job-switch locks to the mockup while preserving route maps. Logistics dispatch now exposes Release to driver (including visiting-truck returns), retains departure fallback, and shows driver reports on inbound trips. Updated canonical and portable contracts; external Flutter adoption remains open.
- Verification: 26 isolated SQLite API/action/receiving/route tests/658 assertions, scoped Pint, Courier mockup and Logistics builds/typechecks/lints, and whitespace checks pass. Synthetic Chromium checks cover action/replay/conflict/release gates, route regressions, session-versus-bearer transport and four Logistics viewport/theme layouts; reviewed screenshots in `node_modules/.cache/linehaul-browser/`. Existing bundle warnings remain. Ordinary databases were not migrated; live PostgreSQL/concurrency/provider and physical-device/Flutter acceptance were not run.

## 2026-10-22 — Registration email and private-upload contract notes

- Recorded the existing company-created Courier account-email verification contract separately from public registration, preserving pending focused-test and Flutter-adoption status. Documented the multi-hub private-write guard's configuration checks and its remote-container ACL verification boundary.
- Verification: Git whitespace checks pass. This documentation commit changes no application behavior; backend tests, cloud ACL checks and Flutter verification were not rerun.

## 2026-10-22 — Courier per-parcel last-mile decisions

- Replaced mockup bulk acceptance with individual parcel review, Accept parcel and reasoned Reject parcel. Rejection clears only its Courier and returns the Shipment to `sorted_at_hub` for Logistics scheduling, retaining lane/session, Order, custody, task/offer history and prior dispatch membership. Added a new migration permitting membership across schedules while keeping uniqueness within each schedule; rollback refuses to discard rescheduling history. Legacy bulk acceptance remains compatibility-only.
- Current Courier dispatch reads retain unaffected siblings and exclude superseded membership; advisory routes include accepted current parcels only. Fixed rejection-key replay without double release. Extracted camera POD controls with rear-camera capture, preview/retake and visible file fallback; completion is labelled **Delivered** with its existing COD declaration, intent and Logistics review behavior. Updated canonical and affected portable contracts; external Flutter per-parcel adoption remains open.
- Verification: 29 isolated SQLite API/regression tests / 656 assertions, scoped Pint, mockup build/typecheck/lint and whitespace checks pass. Synthetic Chromium checks pass independent decisions, rejection retry/key reuse, fake-camera capture/retake, multipart POD, COD-gated Delivered intent, bearer-only transport and mobile overflow; reviewed mobile/desktop screenshots under `node_modules/.cache/courier-parcel-browser/`. Existing bundle warnings remain. Migration was exercised only in isolated tests; live PostgreSQL/concurrency/API/provider, physical-camera and external Flutter acceptance were not run.

## 2026-10-22 — Courier Delivery submission and Logistics confirmation refresh

- Replaced the mockup's separate photo-upload and completion buttons with one **Delivery** action that uploads private POD and submits the matching intent. Require known payment details and explicit COD cash confirmation before submission. Preserve successful upload/intent keys across partial failures, reconcile lost receipts, and allow previously saved current proof to finish without another upload. Added the shared UI Tailwind source so the actual button styles are generated; kept Logistics approval authority and all API contracts unchanged.
- Pending Logistics confirmations now refresh on focus/visibility return and every 30 seconds while visible, preserving the workspace and pausing during active/uncertain decisions. Updated only the affected canonical specs and harness README; no external Flutter contract/adoption change.
- Verification: 18 isolated SQLite API tests / 155 assertions pass, including photo→intent→owning Logistics queue/private preview→approval/history, exact replay and foreign-tenant denial. Both app builds/typechecks/lints, scoped Pint and whitespace checks pass. Synthetic Chromium with actual Courier/Logistics components passes single-action submission, COD gating, camera/retake, saved-photo recovery, partial/lost-response retries, queue/photo visibility, focus/periodic refresh, review locks, bearer-versus-cookie transport and mobile overflow. Reviewed screenshots in `node_modules/.cache/courier-parcel-browser/`. Existing bundle warnings remain; deployed/live API/PostgreSQL/provider and physical-device/Flutter acceptance were not run. No schema change or migration is required for this fix.

## 2026-10-23 — Courier Delivered action label

- Renamed the mockup final-mile action to **Delivered**, including retry guidance, canonical specs and harness documentation. Retained the existing single-click private photo upload plus linked completion request and explicit pending Logistics confirmation state; only Logistics approval commits delivered.
- Verified localhost:5177 serves the updated action. Mockup build/typecheck/lint and Git whitespace checks pass; 8 isolated SQLite delivery submission/approval tests / 91 assertions and the synthetic Chromium parcel suite pass, including COD gating, camera capture, saved-photo/partial/lost-response recovery and Logistics queue/photo visibility. Reviewed the mobile screenshot. Existing bundle warnings remain; no specific live account/parcel or production Flutter behavior was verified. No API/schema change.
