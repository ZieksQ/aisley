# Dashboard KPI chart variants handoff

## Implementation summary

`DashboardMetricCard` now supports tiny `bar`, `line`, and `area` charts, placed beside the KPI copy or as a low-opacity underlay. It also accepts an optional positive/negative/neutral text change tag. Chart and area/path animation honor reduced-motion preferences. The shared skeleton can match a configurable number of metric cards.

Seller's dashboard now includes an order placement KPI for the latest seven complete UTC dates and a comparison to the prior seven complete UTC dates. The API returns 14 zero-filled complete dates and excludes pending-payment orders from the placement series. Seller is the only role with a valid comparison history for this UI. Admin has current authorized queue counts and current oldest-application ages; Logistics has current sole-hub shipment statuses and pending workload counts. Neither Admin nor Logistics should show a delta or trend tag from those snapshots.

The Seller comparison card only presents its value, chart and tag when all 14 dates are valid and consecutive. Missing or gapped dates make that trend unavailable instead of showing an incomplete comparison.

## Changed files

- Shared UI: `packages/ui/src/portal/DashboardMetricCard.tsx`, `DashboardSkeleton.tsx`, `dashboard.css`, `index.ts`, and `packages/ui/README.md`.
- Shared UI checks: `packages/ui/tests/portal-browser.mjs` and `portal-fixtures.mjs` cover chart kinds and placement, accessible labels, underlay readability/layering, motion preferences, comparison tones, and invalid comparison windows.
- Role dashboards: `src/seller/src/components/dashboard/OrderActivityOverview.tsx`, `src/seller/src/types/dashboard.ts`, `src/seller/src/pages/DashboardPage.tsx`, `src/seller/src/components/ProtectedRoute.tsx`, and `src/admin/src/components/dashboard/DashboardSummary.tsx`.
- Seller API and coverage: `src/api/app/Services/Seller/DashboardOrderActivity.php` and `src/api/tests/Feature/Seller/SellerDashboardTest.php`.
- Contracts: `docs/design.md` and `docs/features/seller/dashboard/spec.md`.

## Verification status

- `php artisan test --filter=SellerDashboardTest` from `src/api`: 8 tests, 123 assertions passed.
- Seller, Admin and Logistics builds and lints passed. `node --check` passed for both portal harness files, and `git diff --check` passed.
- `node packages/ui/tests/portal-browser.mjs --serve --design-only` failed at browser startup: Brave exited with SIGTRAP after Crashpad reported `setsockopt: Operation not permitted (1)` and `read ECONNRESET`. Browser assertions and screenshots remain unverified.
