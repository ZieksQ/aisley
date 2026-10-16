# Progress

Short, dated log of what's been implemented. Update after each completed feature or meaningful change. This log covers the whole app; append entries and preserve archives.

## Archive

- [Complete progress log through 2026-10-16](logs/PROGRESS-2026-10-16.md)

## 2026-10-16 — Seller warehouse picking sheets

- Added an icon-only print selection action to Order monitoring, row/current-page checkboxes, up to 50 selections across pages, a selected count, Print and Cancel. Filter changes clear selection; PDF failures preserve it. Kept compact rows, keyboard controls, light/dark contrast and mobile action wrapping.
- Added a Sanctum/active-Seller/consent-protected, rate-limited PDF read that resolves every selected Order through the authenticated Seller's Shop and rejects mixed foreign/missing selections. The A4 two-column sheet prints Order/customer-recipient snapshots, dates/status/destination, and every purchased product/variant/options/SKU/quantity with picking checkboxes and repeating page headers. Printing has no fulfillment or stock side effects; no dependency/schema/mobile-contract changes.
- Verification: Seller build/typecheck/lint, scoped Pint/PHP syntax, 13 API tests/243 assertions, 8 order-action tests and whitespace checks pass. Chromium with synthetic HTTP passes selection/pagination/50-order limits/keyboard/PDF retry/pop-up recovery, 8 selection viewport/theme checks and all 48 existing order-page checks. Reviewed final screenshots and an A4 sample; PDF text extraction preserves all 66 SKU lines in order across 14 pages. Artifacts: `node_modules/.cache/seller-operations`. API tests use isolated SQLite; live PostgreSQL/API, native PDF-viewer automation and physical-printer acceptance were not run. Existing large-bundle warnings remain.
