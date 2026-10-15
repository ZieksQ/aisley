# Dashboard KPI card redesign handoff

## Goal and design contract

Redesign the reusable KPI cards used by the Seller, Admin, and Logistics dashboards. Cards are separate and icon-free, with a bold title and primary value, a short explanation, a tiny truthful chart on the right, and a text link to the owning workspace. The card itself has no hover treatment, border, outline, or focus ring; links retain visible keyboard focus. Chart animation starts from readable content and respects `prefers-reduced-motion`.

The shared visual contract is in [docs/design.md](../design.md), component guidance in [packages/ui/README.md](../../packages/ui/README.md), and role data/access rules in the three dashboard specs. Seller visuals use Shop-scoped current order statuses; Admin visuals use authorized queue counts/oldest-first applications; Logistics visuals use current sole-hub shipment statuses or the explicitly overlapping pending workloads. No role should imply unsupported history, growth, targets, finance, capacity, or revenue.

## Implementation

- `packages/ui/src/portal/DashboardMetricCard.tsx` and `DashboardSkeleton.tsx` now render bold copy, animated mini bars, text links, and matching loading geometry; card decoration was removed and reduced motion disables bar motion.
- `src/seller/src/components/dashboard/OrderActivityOverview.tsx`, `src/admin/src/components/dashboard/DashboardSummary.tsx`, and `src/logistics/src/components/DashboardQueueOverview.tsx` supply source-backed charts and role-owned text destinations.
- `packages/ui/src/portal/dashboard.css` contains the responsive card layout and animation. `packages/ui/tests/portal-browser.mjs` was updated for the new presentation.

## Verification and limits

- QA reports that Seller, Admin, and Logistics production builds and linters pass.
- Browser verification and new screenshots were blocked: Chromium/Brave terminated with SIGTRAP (`setsockopt: Operation not permitted`). Do not treat this task as visually browser-accepted; rerun the portal browser check when the runtime permits it.
- No API, database, dependency, Courier, or Flutter contract changes were reported.
