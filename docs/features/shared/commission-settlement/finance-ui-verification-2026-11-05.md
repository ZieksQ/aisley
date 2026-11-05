# Finance portal refresh verification — 2026-11-05

## Implemented behavior

Admin, Seller and Logistics Finance now share period controls, role-themed surfaces, readable KPI cards, chart/ledger layouts and consistent payment/detail/settings sections. Reporting defaults to This month in Asia/Manila. Preset and custom ranges apply on the server to revenue, costs, profit, credit breakdown, daily series, ledger and CSV. Current balances, remittance status totals and unpaid payout obligations remain explicitly current; next-30-day forecasts keep their existing server calculation.

History/queue controls name their date basis: invoice/obligation delivery, payout/remittance submission, hold placement, cash receipt reception, and sandbox record creation. Settings/details have no picker. Dates persist in URLs; date changes reset ordinary selections/pagination. Busy or uncertain money actions retain their original selection/idempotency identity. Seller Shop and Logistics organization lifetime keys prevent reuse across ownership changes; Admin keys include permissions.

## Stitch references

Project: [AISLEY Finance Portals](https://stitch.withgoogle.com/projects/18092453032071230043).

- Overview: `ff88dad59c34409da2866e0a0bdb7fa2`.
- Admin invoice details: `b04480a4edae438fbe4e9e5e3e30fc8e`.
- Automation settings: `3dba1d85dd3b493a892b16da58b1b503`.
- Logistics mobile dark remittances: `f338aa29c63f4199ae58a4429de4b76e`.
- Seller payouts: `f5e71f1ae0244bf9ac7bf49d26f9a693`.

Stitch's sample bank details, regulatory claims, new controls, extra accounting metrics and unsupported export claims were excluded. The repository design contract governs typography, role palettes and workflows. No generated HTML was installed as application code.

## Executed checks

- Laravel SQLite: `php artisan test --compact tests/Feature/Finance tests/Feature/Logistics/CourierCashRemittanceTest.php` — **57 passed, 568 assertions**. Covers Manila date edges, invalid/partial/future/empty ranges, period versus current metrics, closed-month profit labels, matching ledger/CSV filters, bounded export pages, formula-safe CSV cells, role/tenant boundaries, invoices/history/holds/sandbox/cash date filters and existing payment/approval/reconciliation regressions.
- Admin, Seller and Logistics TypeScript and Vite production builds pass. Vite reports large output chunks; no dependency or unrelated bundle refactor was introduced.
- Scoped frontend Oxlint and changed PHP files through Laravel Pint pass; `git diff --check` passes.
- Chromium fixture: **114 combinations** across three roles, light/dark themes, 390/768/1440px and all existing Finance screen families, including hold review. Checks date presets/custom validation/Cancel, URL preservation/history, ledger pagination/CSV filters, late-response cancellation, account changes, denied reads, failures/retry, real zero/empty states, keyboard focus, theme colors and contained overflow. Test runner: `node packages/ui/tests/finance-browser.mjs`; fixture server: `node packages/ui/tests/finance/server.mjs`.
- Additional browser flows cover bounded CSV download failure/recovery, payout/remittance/cash actions, Admin settings, read-only Seller settings, invoice/payout PDFs, hold reconciliation, permission changes and uncertain payment retries with the exact same key/selection.
- Taste real-browser inspection passes Admin light and Logistics dark at 1440/768/390px. Screenshots reviewed in addition to measurements. The `edge-text` allowance addresses SVG tick DOM ranges measured at x=0 despite visible text rendering inside the chart. Remaining warnings are 11–12px chart ticks/captions (per the design contract), and content-height differences between truthful operational panels rather than artificial filler rows. The fixture includes the shell's h1; Finance content retains h2 beneath it.

Reproduction from the repository root (the test runner starts/stops its own local fixture):

```sh
node packages/ui/tests/finance-browser.mjs
```

Screenshots/reports/downloads are local ignored artifacts under `node_modules/.cache/finance-browser` and `node_modules/.cache/finance-taste`.

## Limits and deployment

- Browser APIs/auth/data and file bytes are synthetic; real role components, hooks, clients and styles render in Chromium. The browser frame represents the existing portal shell; deployed navigation/auth/session behavior still needs environment acceptance.
- PostgreSQL integration, production-volume/all-time aggregation profiling, deployed storage/PDF/email, real scheduler/gateway/network failure behavior and live acceptance were not certified by these checks. Collection-based reporting remains the existing aggregation approach; long all-time daily histories should be profiled before introducing indexes/precomputation.
- Existing broader accounting gaps, including allocation-safe Seller mixed-Shop remittance totals and comprehensive correction/reversal semantics, remain outside this UI/date-filter change; earlier unchecked criteria remain unchecked.
- Deploy the API and three portal builds together for date filtering. Existing callers omitting dates retain unfiltered API behavior. No migrations, accounting write changes, new libraries, Customer screens, Courier web screens or external Flutter documentation changes are required.
