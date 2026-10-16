# Progress

Short, dated log of what's been implemented. Update after each completed feature or meaningful change. This log covers the whole app; append entries and preserve archives.

## Archive

- [Complete progress log through 2026-10-16](logs/PROGRESS-2026-10-16.md)

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
