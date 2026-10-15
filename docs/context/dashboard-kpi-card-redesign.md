# Dashboard KPI cards and chart interaction handoff

## Final design

Seller, Admin, and Logistics use separate icon-led KPI cards with bold titles and primary values plus a short explanatory sentence. Cards use `--portal-surface` and a 1px `--portal-border` in both themes, matching `.portal-panel`; they have no focus ring or outline. KPI cards contain no mini chart, comparison/change tag, or link. Seller has four status KPIs: awaiting approval, in preparation, ready for pickup, and delivered. Its valid latest-seven versus prior-seven order placement comparison remains in the Order activity chart summary/context only, based on 14 consecutive complete UTC dates.

Existing dashboard chart panels animate when their `animate` prop is enabled; reduced-motion preference disables the animation. Tooltips track the active hovered point/category. The donut chart tooltip is positioned according to the active slice so it avoids covering the donut center. Role-specific sources remain scoped: Shop/order status for Seller, permission-authorized queue/application data for Admin, and active sole-hub shipment/workload data for Logistics.

## Implementation files

- Shared cards and loading layout: `packages/ui/src/portal/DashboardMetricCard.tsx`, `DashboardSkeleton.tsx`, `dashboard.css`, and `index.ts`.
- Charts and hover tooltip: `packages/ui/src/charts/DataChart.tsx`, `DistributionChart.tsx`, and `useReducedMotion.ts`.
- Dashboard consumers: `src/seller/src/components/dashboard/OrderActivityOverview.tsx`, `CatalogSummary.tsx`, `DashboardReviews.tsx`, `src/seller/src/pages/DashboardPage.tsx`, `src/seller/src/components/ProtectedRoute.tsx`, `src/admin/src/components/dashboard/DashboardSummary.tsx`, and `src/logistics/src/components/DashboardQueueOverview.tsx`.
- Verification fixtures: `packages/ui/tests/portal-browser.mjs` and `portal-fixtures.mjs`.
- Contracts: `docs/design.md`, the three role dashboard specs, and `packages/ui/README.md`.

## Verification and limits

- QA reports all three portal lints, browser-harness syntax checks, and `git diff --check` pass. Admin and Logistics production builds pass after the final tooltip changes. Seller's build passed before final placement hardening; a final Seller build was attempted, but no active process was visible, so post-hardening Seller build status is unconfirmed.
- Browser launch failed with Brave SIGTRAP/crashpad in this environment. No final browser assertions or screenshots are available; visual browser acceptance remains open.
