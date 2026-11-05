---
feature: generate-report
title: Seller Finance and Reports
system: AISLEY
type: Feature Specification
version: 2.0
status: Revised; Finance reporting baseline implemented; extensions and verification gaps remain
role: Seller
scope: Seller React dashboard and Laravel Finance API
last_reconciled: 2026-11-05
---

# Seller Finance and Reports

## WHAT

### Purpose and ownership

- Let an approved active Seller inspect recognized proceeds, recorded costs, settlements, ledger entries, and the server's revenue outlook.
- This feature is the reporting slice of the existing `/finance` workspace, not a second `/reports` application.
- Persisted/API role is `seller`; the authenticated Seller owns exactly one Shop.
- `docs/features/shared/commission-settlement/spec.md` owns money definitions, recognition, remittance, settlement, costs, and forecasting.
- `docs/schema.md` owns persistence; `docs/architecture.md` owns the React Router/Laravel architecture; `docs/design.md` owns web presentation.
- Older domain/report wording that defers all Finance or proposes Next.js reporting is not the implemented baseline.

### Implemented scope and exclusions

- `src/seller/src/pages/FinancePage.tsx` composes `@aisley/finance-ui` inside the Seller layout at `/finance`.
- Current sections are summary cards, recorded/projected revenue, revenue/cost bridge, remittance/payouts, credit-account breakdown, money flow, and searchable ledger/CSV.
- Order financial drill-down, expense recording/corrections, and monthly close have APIs; the shared Finance screen has no corresponding forms or drill-down controls.
- Exclude inventory valuation reports, stock movement exports, fulfillment performance, Product/SKU rankings, and a separate operational reporting page.
- PDF, queued export jobs, stored downloads, custom group/status/Product filters, tax reporting, and live payout-provider integration are not implemented.
- Future reporting enhancements must extend the existing Finance services/package and receive an explicit contract; do not revive the old export-job schema.

## MUST

### Authorization and privacy

- Require Sanctum authentication, `seller.active`, and the existing policy-consent gate on every Seller Finance route.
- Derive `owner_type = seller` and `owner_id = Shop.id` from the authenticated account, never a client-supplied Seller/Shop ID.
- Ledger queries include only journals with owned lines and return only owned lines; Order drill-down requires `orders.shop_id` to match.
- Other roles, inactive/unapproved Sellers, foreign Orders, and unauthorized CSV reads must not expose Shop financial data.
- JSON report reads and CSV downloads use `Cache-Control: private, no-store`; never share-cache personalized Finance data.
- Keep raw storage paths, credentials, private verification evidence, and unrelated Customer/Seller information out of report projections.

### Financial meanings and current limits

- Finance monetary fields use integer centavos; `currency = PHP` and the report timezone is `Asia/Manila`.
- Recognize proceeds at confirmed delivery from the immutable Order pricing snapshot, not placement, Seller approval, pickup, or the current catalog price.
- Seller proceeds use snapshotted commission and voucher funding rules; commission does not increase Customer COD.
- Current `revenueCents` sums credits to owned `seller_liability`; it is recognized proceeds, not gross merchandise sales.
- Current `costsCents` nets debits minus credits for `operating_expense`, `product_cost`, and `delivery_cost`.
- Delivery records known `order_items.unit_cost_cents × quantity` as Product cost; an unknown cost is not proof of zero cost.
- Current `profitCents = revenueCents - costsCents`; incomplete costs mean this is provisional, not certified final profit.
- Current `availableBalanceCents` is net Seller liability credits minus debits; it is not a guaranteed immediately withdrawable amount.
- Settlement separately requires confirmed delivery aged 14 days, full cleared COD funding, and no financial hold; payouts remain explicitly sandbox.
- Summary and recorded series honor the selected reporting dates on the server. Unfiltered API summary remains all-time with the legacy 90-day series; `all_time=1` includes complete owned daily history through today.
- `revenueBreakdown` groups all positive owned credits by account; do not treat every credit account as new sales revenue.
- Remittance aging currently selects batches linked to owned Orders but sums whole batch totals; mixed-Shop allocation-safe totals remain a gap.
- Period `profitState` requires complete closures for every selected month and excludes the current month; otherwise provisional. All-time/unfiltered profit remains provisional.
- Corrections, payout reversals, and credit-account breakdowns need reconciliation tests; do not silently redefine the shared accounting model in React.

### Forecast and settlement display

- Use the server's 30-day forecast alongside recorded revenue in one chart, with clearly distinguished projection and low/high range.
- The current forecast examines the eight completed weeks before this week and counts weeks containing positive revenue credits.
- Fewer than eight usable weeks returns `state = insufficient_history`, empty forecast arrays, and `profitSuppressed = true`.
- Available forecasts average weekday revenue/costs across eight weeks, include scheduled recurring expenses, and expose 80/100/120-percent activity scenarios.
- Seller profit scenarios return `null` when delivered lines in the forecast history lack unit-cost snapshots; clients must honor `profitSuppressed`.
- These scenarios are estimates, not confidence guarantees, payment promises, or Courier route predictions.
- The API returns at most 20 recent payouts; the current panel renders six, including status and `isSandbox`.
- Money-flow nodes/edges explain the settlement process; they are not quantified transaction totals or a workflow editor.

### Ledger, CSV, and interaction

- Ledger accepts `search` up to 120 characters and `per_page` from 1–100, default 25; Laravel pagination uses `page`.
- Search matches journal event type, memo, or Order reference; it does not filter summary cards or charts.
- Journals sort by `effective_at DESC, id DESC`; date/search predicates run before pagination. Concurrent-write pagination stability remains unverified.
- CSV streams the selected page of at most 100 journals and their owned lines, not all matching history.
- CSV columns are `effective_at,event_type,order_reference,account,debit_cents,credit_cents,currency`.
- CSV preserves the applied dates/search and offers separate export-page selection, with bounded downloads and recoverable errors. Full-history exports are not provided.
- Follow `docs/design.md`: familiar Finance navigation, mobile-first layout, light/dark themes, keyboard access, readable currency, and chart-data fallback.
- Existing UI has initial loading, initial failure/retry, empty ledger/payouts, forecast insufficiency, and a refresh-error banner retaining prior data.
- Ledger page controls, export feedback, cancellation and account/access-loss cleanup are implemented in the shared workspace. Order drill-down and expense/close forms remain outside this refresh.
- Failed or forbidden reads must not be presented as authoritative zero; retries are reads and must not post accounting mutations.

### Acceptance criteria

Checked items describe inspected implementation, not a new runtime certification.

- [x] Seller `/finance` reuses the shared workspace rather than creating a parallel report route/service.
- [x] Seller scope is server-derived; ledger lines and Order drill-down queries apply Shop ownership.
- [x] Summary, recorded series, forecast, remittance, payouts, money flow, search, and bounded CSV APIs exist.
- [x] Integer-cent monetary responses, private no-store report reads, and forecast insufficiency/suppression are implemented.
- [x] Expense-summary tenant isolation and balanced/idempotent journal behavior have focused test sources.
- [ ] Mixed-Shop remittance batches cannot contribute unrelated allocation amounts to Seller totals.
- [ ] Revenue/reversal, liability versus payout eligibility, missing costs, and period-close labels reconcile correctly.
- [ ] Ledger pagination/drill-down and authenticated CSV preserve filters, handle errors, and prevent formula execution in spreadsheet cells.
- [ ] Session loss, Shop/account changes, late responses, timeout/offline recovery, and accessible responsive/theme states are verified.
- [ ] SQLite/PostgreSQL report, export, forecast, boundary, concurrency, and realistic ledger-volume checks pass.

## HOW

### Existing API contract

All paths below are relative to `/api/v1/seller/finance`; none is public.

| Method/path | Implemented request and response |
| --- | --- |
| `GET /summary` | Optional paired `date_from,date_to` or `all_time=1`; `{data: FinanceWorkspaceData}`. |
| `GET /series`, `GET /forecast`, `GET /payouts` | Currently the same complete workspace envelope, not dedicated section DTOs. |
| `GET /ledger` | Optional `date_from,date_to,all_time,search,per_page,page`; Laravel paginator with journal `data`, paging metadata, owned `lines`, and minimal `order`. |
| `GET /ledger.csv` | Validated dates/search and selected export `page`; authenticated synchronous CSV, 100 journals maximum per page. |
| `GET /orders/{order}` | Order UUID; `{data}` containing reference/status/paymentStatus, integer-cent totals/pricing, item snapshots, and status-event history. |
| `POST /costs` | `category,description,amount_cents,incurred_on`; optional recurring/correction fields; 201 expense response. |
| `POST /periods/{month}/close` | `YYYY-MM` and `costs_complete: true`; closure response; current month returns 409. |

- Workspace fields are `currency,timezone,generatedAt,summary,series,waterfall,revenueBreakdown,remittanceAging,payoutSchedule,forecast,moneyFlow`.
- Ledger rows include `id,effective_at,event_type,memo,currency,order,lines`; keep journal snake_case distinct from workspace camelCase.
- Order `items[].unitPrice` retains its decimal-string snapshot; `totals.*Cents`, cost, and commission fields are integer centavos.
- Report reads may be retried; errors include 401, role/status/consent 403, scoped 404, and ledger validation 422.
- Expense creation has no request-idempotency contract; never blindly repeat an uncertain write or assume report reads create entries.
- Costs/closures are existing Finance workflow boundaries, not new reporting endpoints or automatic report side effects.

### Components, persistence, and verification

- Role controller delegates to `AbstractFinanceController` and `FinanceReportService`; `FinanceWorkflowService` owns costs/closure.
- `FinanceLifecycleService` and `LedgerService` own delivery recognition and balanced append-only journals.
- Reuse existing pricing snapshots, Order item costs, finance journals/lines, expenses, period closures, remittance allocations, holds, and sandbox payouts.
- No report table, export queue, migration, library, or second source of accounting truth is required by this revision.
- `FinanceWorkspace` loads summary and ledger together through the Seller's existing credentialed API client; search reloads both and updates only ledger filtering.
- Preserve `packages/finance-ui` typed models, charts, text/data fallback, and Seller navigation; keep tenant authorization server-side.
- Review `FinanceAccessTest.php` and `FinanceLedgerTest.php`; they do not establish complete report/export/forecast or browser coverage.
- Extend tests for multi-Shop access, mixed remittance allocations, held/unfunded balances, reversals, costs/close, eight-week forecast boundaries, CSV paging/safety, and stale requests.
- Profile current collection-based ledger aggregation before choosing indexes, SQL aggregation, or precomputation; do not introduce report storage speculatively.
- Preserve missing-data/provisional warnings and `generatedAt`; log operational failures without raw financial payloads or Customer PII.
- Append actual verification results to `docs/PROGRESS.md`; leave unmet acceptance criteria unchecked.

## Finance portal refresh (2026-11-05)

- The shared [Finance period-reporting contract](../../shared/commission-settlement/spec.md#finance-period-reporting-and-portal-refresh-2026-11-05) defines This month defaults, preset/custom dates, period versus current metrics, forecast handling, CSV bounds and request lifetimes.
- The web refresh covers all existing Finance workflows using Stitch references and the repository design contract; role authorization and financial write semantics remain authoritative on the API.
- See [dated verification](../../shared/commission-settlement/finance-ui-verification-2026-11-05.md) for executed checks and remaining acceptance. Earlier unchecked broader accounting criteria are not automatically certified by this UI/date-filter work.
