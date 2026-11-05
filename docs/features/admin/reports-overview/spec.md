---
feature: reports-overview
title: Admin Finance Reports Overview
system: AISLEY
type: Feature Specification
version: 3.0
status: Revised; Finance reporting baseline implemented; extensions and verification gaps remain
role: Admin
scope: Admin React dashboard and Laravel Finance API
last_reconciled: 2026-11-05
---

# Admin Finance Reports Overview

## WHAT

### Purpose and ownership

- Let authorized Admins inspect platform commission revenue, recorded costs, provisional profit, COD remittance, payouts, and financial journal evidence.
- Reports Overview is the reporting slice of the existing Admin `/finance` workspace, not another `/reports` screen or reporting engine.
- Persisted/API role is `admin`; platform-wide access still requires explicit Finance permission.
- `docs/features/shared/commission-settlement/spec.md` owns money definitions, commission snapshots, recognition, remittance, settlement, closure, and forecasting.
- `docs/schema.md` owns persistence; `docs/architecture.md` owns the React Router/Laravel architecture; `docs/design.md` owns web presentation.
- Older Admin domain/report wording that defers the entire ledger or proposes Next.js reporting is stale, not a reason to rebuild Finance.

### Implemented scope and exclusions

- `src/admin/src/pages/FinancePage.tsx` composes `@aisley/finance-ui` at `/finance` within the existing Admin layout.
- Current sections are summary cards, recorded/projected revenue, revenue/cost bridge, remittance/payouts, credit-account breakdown, money flow, and searchable ledger/CSV.
- Dedicated Finance remittance, payout, automation, and gateway sandbox pages now provide invoice review, legacy clearing/rejection, manual payouts, timing configuration, and payment documents. Order drill-down and costs/closure remain API-only in the shared overview. See `../../shared/cod-automation/spec.md`.
- Admin Dashboard remains a separate permission-scoped registration/support/compliance overview; do not duplicate Finance charts or commission calculations there.
- Custom group/Shop/status filters, full-history report exports, report PDF, export jobs, tax reporting, live payouts, and Customer refund workflows are not implemented.
- Future enhancements extend existing Finance contracts and permission boundaries; no parallel commission ledger or new report-export schema is authorized here.

## MUST

### Access, permission, and privacy

- Require Sanctum authentication, `admin.active`, the existing policy-consent gate, and `admin.permission:finance.view` on every report read.
- Manage actions also require `finance.manage`; manage permission alone does not bypass the enclosing Finance view requirement.
- The sidebar filters the Finance link by `finance.view`; API middleware remains authoritative for direct URLs and downloads.
- Finance page routing currently has the general authenticated/consent guard, not a separate Finance permission guard; denied reads show the shared failure state.
- Derive the platform report scope on the server; client roles, beneficiary IDs, or hidden buttons cannot grant Finance access.
- Admin ledger queries select platform-owned lines from qualifying journals, not every beneficiary line; Order drill-down is platform-wide for authorized Admins.
- JSON report reads and CSV downloads use `Cache-Control: private, no-store`; never shared-cache Admin financial records.
- Project only authorized financial context; exclude credentials, private registration evidence, raw media paths, and unnecessary Customer PII.
- Read-only views and retries must never clear remittance, release holds, close periods, or trigger settlement implicitly.

### Money definitions and current limits

- Finance fields use integer centavos, `currency = PHP`, and `timezone = Asia/Manila`; do not calculate money from React table rows.
- Immutable Order pricing snapshots fix effective Seller/Logistics commissions and voucher funding; current policy edits must not reprice history.
- Confirmed delivery recognizes revenue; confirmed COD collection sets payment paid, while remittance and payout maintain separate state.
- Current `revenueCents` sums platform `commission_revenue` credits, not merchandise totals, Customer COD, or Logistics/Seller liabilities.
- Current `costsCents` nets debits minus credits for `voucher_expense,shipping_subsidy_expense,operating_expense,recorded_loss,processing_fee`.
- Platform operating profit subtracts those costs from commission revenue; beneficiary payouts settle liabilities and are not a second platform expense.
- Current `availableBalanceCents = max(0, all-time revenue - all-time costs)`; it is not actual bank cash, remittable COD, or beneficiary payout eligibility.
- Summary and daily recorded revenue/profit series honor the selected reporting dates. Unfiltered API summary remains all-time and the legacy unfiltered series remains 90 days; `all_time=1` includes complete owned daily history through today.
- Period `profitState` is actual only when every selected month is explicitly closed with complete costs and the range excludes the current month; otherwise provisional. All-time/unfiltered profit remains provisional.
- Missing expenses or unclosed coverage must not be interpreted as certified zero costs or final profit.
- `revenueBreakdown` groups all positive platform credits, including non-revenue accounts; keep it distinct from commission revenue.
- Revenue reversal/correction semantics and balance labels require targeted accounting tests; do not disguise gaps by inventing a second financial definition.

### Remittance, forecast, and money flow

- Remittance aging returns submitted/cleared batch totals and `oldestSubmittedAt`; it is not a dated cash-flow statement or per-batch review queue.
- Verified gateway payments automatically clear COD; legacy manual receipts require Admin clearing. Seller/Logistics eligibility defaults to separate 14-day/24-hour delivery waits, full funding, and no hold; timing and early manual Logistics payouts follow the COD automation spec.
- The API returns at most 20 recent payouts across beneficiaries; the current panel renders six, with status and explicit `isSandbox`.
- Sandbox results, callbacks, beneficiaries, and payout amounts must never be represented as real transfers.
- Recorded revenue and the server's 30-day outlook share one chart, with distinguished forecast styling and an accessible data table.
- Forecast uses weekday averages from the eight completed weeks before this week; current usability counts weeks with positive revenue credits.
- Insufficient history returns `state = insufficient_history`, empty projection/scenario arrays, and suppressed profit.
- Available projections include recurring expenses and low/base/high activity at 80/100/120 percent; React must not recalculate forecasts.
- Current platform profit coverage requires at least two complete monthly closures in the history window; incomplete coverage returns `profitSuppressed` and null scenario profits.
- Money-flow nodes/edges are a qualitative explanation of Customer COD clearing and beneficiary settlement, not quantified fund balances or editable routes.

### Ledger, CSV, and web behavior

- Ledger accepts `search` up to 120 characters and `per_page` from 1–100, default 25; Laravel pagination uses `page`.
- Search matches event type, memo, or Order reference; it changes ledger rows, not summary/chart reporting periods.
- Journals sort by `effective_at DESC, id DESC`; date/search predicates run before pagination. Concurrent-write pagination stability remains unverified.
- CSV streams one selected page of at most 100 journals and their platform-owned lines, not a full ledger dump.
- CSV columns are `effective_at,event_type,order_reference,account,debit_cents,credit_cents,currency`.
- CSV downloads preserve dates and ledger search, offer explicit export-page selection, escape formula-like text cells, and show recoverable download errors. Each page contains at most 100 journals.
- Follow `docs/design.md`: familiar Finance navigation, mobile-first layout, both themes, keyboard access, contained tables, and text/chart-data alternatives.
- Current UI provides initial loading/failure/retry, empty ledger/payouts, forecast insufficiency, and a refresh-error banner retaining prior data.
- Ledger pagination, cancellation, account/permission lifetime, access-loss clearing and structured CSV failures are implemented in the shared workspace. Overview Order drill-down, expense/close forms and request deadlines remain outside this refresh.
- A failed, forbidden, expired-session, or consent-blocked read must not appear as an authoritative financial zero.

### Acceptance criteria

Checked items describe inspected implementation, not a new runtime certification.

- [x] Admin `/finance` reuses the shared workspace and existing financial services instead of designing another reporting system.
- [x] Reports require an active Admin and `finance.view`; nested management routes additionally require `finance.manage`.
- [x] Workspace, ledger, bounded CSV, and financial Order drill-down APIs exist with private no-store report responses.
- [x] Summary uses commission credits and platform cost accounts; sandbox payout data stays explicitly marked.
- [x] Shared recorded/projected chart, low/base/high outlook, text fallback, and insufficient-history states exist.
- [x] Focused test sources cover explicit Admin view permission and balanced/idempotent journal posting.
- [ ] Corrections/reversals, cash versus profit/balance labels, period completeness, and recurring-cost projections reconcile to authoritative ledger evidence.
- [ ] Ledger paging/drill-down and authenticated CSV retain filters, prevent spreadsheet formula execution, and handle scoped permission/errors safely.
- [ ] Finance manage permissions, role/consent denial, changed-account/permission races, timeout/offline recovery, and privacy are tested.
- [ ] SQLite/PostgreSQL forecasts, report/export boundaries, concurrency, ledger-volume performance, and responsive/theme/accessibility checks pass.

## HOW

### Existing reporting API contract

All paths below are relative to `/api/v1/admin/finance` and require `finance.view`.

| Method/path | Implemented request and response |
| --- | --- |
| `GET /summary` | Optional paired `date_from,date_to` or `all_time=1`; `{data: FinanceWorkspaceData}`. |
| `GET /series`, `GET /forecast`, `GET /payouts` | Currently the same complete workspace envelope, not dedicated section DTOs. |
| `GET /ledger` | Optional `date_from,date_to,all_time,search,per_page,page`; Laravel paginator of journals, minimal Order reference, and platform-owned lines. |
| `GET /ledger.csv` | Validated dates/search and selected export `page`; authenticated synchronous CSV, 100 journals maximum per page. |
| `GET /orders/{order}` | Order UUID; `{data}` with reference/status/paymentStatus, totals/pricing, item snapshots, and status-event history. |
| `POST /costs` | Additionally `finance.manage`; category/description/integer amount/date, optional recurring/correction fields; 201 expense. |
| `POST /periods/{month}/close` | Additionally `finance.manage`; `YYYY-MM`, `costs_complete: true`; closure response; current month 409. |

- Workspace keys are `currency,timezone,generatedAt,summary,series,waterfall,revenueBreakdown,remittanceAging,payoutSchedule,forecast,moneyFlow`.
- Ledger rows retain `id,effective_at,event_type,memo,currency,order,lines`; `lines` contain integer debit/credit fields.
- Order `totals.*Cents` and pricing/cost fields use integer centavos; `items[].unitPrice` retains its decimal-string Order snapshot.
- Read failures include 401, role/status/permission/consent 403, unknown Order 404, and ledger validation 422; no speculative report error-code taxonomy.
- `GET /api/v1/admin/commission-policies` and `GET /api/v1/admin/shipping-rates` inspect configuration under Finance permission.
- Publishing commission/rate versions, clearing remittance, placing/releasing holds, and sandbox account/run/callback actions remain owned by existing Finance workflow/configuration controllers.
- Do not assume these mutation APIs are exposed by the current Finance UI or safely replayable as report refreshes.

### Implementation and verification

- `Admin\FinanceController` delegates to `AbstractFinanceController` and `FinanceReportService`; derive `owner_type = platform` without a client owner selector.
- `FinanceLifecycleService`, `LedgerService`, `FinanceWorkflowService`, and `SandboxSettlementService` retain recognition, journal, closure, and settlement ownership.
- Reuse existing pricing snapshots, commissions, journals/lines, expenses, remittance/allocations, financial holds, closures, and payout records.
- Reporting still uses the existing ledger and workspace envelope. The separate COD automation feature adds invoice/payment persistence and documents using the already installed PDF renderer.
- Shared `FinanceWorkspace` loads summary/ledger together through the Admin's existing credentialed API client; retain role-specific labels and permission-filtered navigation.
- Review `FinanceAccessTest.php` and `FinanceLedgerTest.php`; current tests do not establish complete Finance manage/export/forecast or browser coverage.
- Add targeted regressions for permission combinations, recognition/reversals, cost/closure boundaries, held/unfunded payouts, eight-week history, CSV paging/safety, and cross-account stale responses.
- Profile collection-based aggregation before introducing SQL summaries/indexes or precomputation; log failures without raw financial payloads.
- Document any approved enhancement in this spec and the shared Finance contract; preserve separate Admin Dashboard and accounting workflow responsibilities.
- Append actual verification results to `docs/PROGRESS.md`; leave unmet acceptance criteria unchecked.

## Finance portal refresh (2026-11-05)

- The shared [Finance period-reporting contract](../../shared/commission-settlement/spec.md#finance-period-reporting-and-portal-refresh-2026-11-05) defines This month defaults, preset/custom dates, period versus current metrics, forecast handling, CSV bounds and request lifetimes.
- The web refresh covers all existing Finance workflows using Stitch references and the repository design contract; role authorization and financial write semantics remain authoritative on the API.
- See [dated verification](../../shared/commission-settlement/finance-ui-verification-2026-11-05.md) for executed checks and remaining acceptance. Earlier unchecked broader accounting criteria are not automatically certified by this UI/date-filter work.
