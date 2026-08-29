---
feature: generate-report
title: Seller Generate Report
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Generate Report
## WHAT
- **Purpose:** Give Sellers detailed, date-bounded financial, sales, and performance reports that can be inspected in the web app and exported as CSV/PDF.
- **Canonical role:** `SELLER`.
- `Seller.md` explicitly requires:
  - financial/profit reporting
  - From/To date picker
  - sales tracking
  - performance tracking
  - detailed gross sales/net profit/platform-fee style reporting
  - Seller-scoped aggregation over `Transactions`
  - downloadable CSV/PDF output, potentially through background jobs. fileciteturn81file0turn81file1
- **Dedicated Seller report flow additionally requires:**
  - timezone
  - grouping
  - optional Product/Order/status filters
  - gross sales
  - discounts
  - refunds
  - platform fees
  - net proceeds
  - profit only when cost data exists
  - Order/Product performance
  - drill-down to contributing Seller-owned records
  - export using the exact same filters
  - asynchronous large exports
  - expiring Seller-authorized downloads
- **Recommended route:**
```text
/seller/reports
```
- **Recommended flow:**
```text
Seller selects:
- From
- To
- timezone
- grouping
- optional filters

→ Laravel validates period/filters
→ applies Seller scope first
→ calculates financial/performance sections
→ returns report + data_as_of
→ Seller drills into contributing rows

EXPORT
→ same normalized report definition
→ small export may stream directly
→ large export queues
→ CSV/PDF generated privately
→ Seller receives expiring authorized download
```
- **Architecture:**
  - Next.js/React owns report controls, cards/tables/charts, drill-down UI, export request/progress/download states.
  - Laravel owns Seller scope, date boundaries, financial definitions, aggregation, filters, grouping, export jobs, and authorization.
  - Orders/Transactions/ledger/Product records remain authoritative.
- **Boundary with Dashboard:**
  - Dashboard = high-level operational overview.
  - Generate Report = deeper analysis, arbitrary selected period, traceable breakdowns, and exports.
  - Shared financial definitions must be reused so Dashboard and Reports reconcile.
- **Non-goals:**
  - platform-wide Admin commission reporting
  - changing Orders/Transactions
  - payout execution
  - inventing accounting values not represented by authoritative records
  - calling net proceeds "profit" when Product cost is unavailable
  - allowing CSV/PDF exports to use different calculations from the web report
## MUST
### Authentication and Seller scope
- Reports require authenticated `SELLER`.
- Apply Seller/shop scope before aggregation.
- Never trust client-submitted `seller_id` for authorization.
- Seller must never see:
  - another Seller's Orders
  - another Seller's Transactions
  - another Seller's Product performance
  - platform-wide confidential financial totals
- Export jobs/files must retain Seller ownership.
- Seller authorization must be rechecked when downloading a generated file.
### Report request
- Conceptual endpoint:
```http
GET /api/seller/reports
    ?from=2026-08-01
    &to=2026-08-31
    &timezone=Asia/Manila
    &group_by=day
```
- Laravel validates:
  - `from`
  - `to`
  - `from <= to`
  - timezone
  - maximum range
  - grouping
  - allow-listed filters
- Exact maximum report range is Open.
- Invalid date/filter requests return `422`.
### Date/timezone semantics
- Seller chooses From/To dates as required by source.
- Interpret local date boundaries using the selected Seller timezone.
- Convert to UTC query boundaries before database aggregation.
- Recommended interval:
```text
[from_inclusive, to_exclusive)
```
- Use one normalized period object across every report section and export.
- Store timestamps in UTC; render/output selected timezone. fileciteturn81file18
### Grouping
- Source flow requires grouping.
- Recommended allow-list:
```text
day
week
month
```
- Exact supported groups are Open.
- Laravel controls grouping expressions; never pass arbitrary SQL fragments from client input.
- Grouping must use the same selected timezone/date boundaries.
### Optional filters
- Dedicated flow allows Product/Order/status filters.
- Potential allow-list:
  - Product
  - Product/SKU
  - canonical Order status
  - payment/settlement state when modeled
- Exact filter set follows actual schema.
- All identifiers must resolve within Seller scope.
- Invalid/unowned filter IDs do not expose existence of another Seller's resources.
### Report metadata
- Include `from`, `to`, timezone, grouping, currency, filters, and `data_as_of`.
- Cached/materialized data must expose freshness; exports embed the same metadata.
### Money
- Use fixed-precision values with explicit currency; React never owns financial math. fileciteturn81file18
- Multi-currency aggregation requires an explicit conversion model and remains Open.
### Authoritative financial source
- Prefer Transaction/financial-ledger records for payment/refund/settlement facts when available.
- Orders may provide commercial/order snapshots but should not replace a financial ledger when one exists.
- Seller source specifically references aggregation over `Transactions`. fileciteturn81file0
- Exact table relationships depend on repository schema.
### Gross sales
- Define `gross_sales` once; recommended as Seller-attributable paid item/order value before discounts/refunds/platform fees.
- Exclude failed/unpaid Transactions.
- Shipping/tax inclusion is Open; Dashboard reuses the same definition.
### Discounts
- Report applied discounts separately and distinguish Seller-funded vs platform-funded only when authoritative data supports it.
### Refunds / reversals
- Preserve original sale plus refund/reversal ledger entries; never erase the sale.
- Refund attribution by refund date/original sale date is Open but must be explicit/consistent.
### Platform fees
- Use recorded Seller-attributable fees; never hard-code a commission rate or recompute historical fees from today's configuration.
### Net proceeds
- Recommended:
```text
net_proceeds
= gross paid Seller amount
- Seller-funded discounts where applicable
- refunds/reversals
- platform fees
± other explicitly modeled Seller financial adjustments
```
- Exact formula must match authoritative financial schema.
- Never silently subtract an unmodeled cost/fee.
### Profit
- Dedicated source rule:
  - if Product cost/COGS exists → a profit metric may be calculated
  - if cost data does not exist → label financial remainder `net proceeds`, **not profit**
- Do not invent Product cost.
- If profit is implemented:
```text
profit = net_proceeds - attributable COGS - other explicitly modeled Seller costs
```
- Exact formula must be documented.
### Pending vs settled
- Keep pending and settled separate; only finance/payout records define settlement state.
- `DELIVERED` may start eligibility but does not itself mean settled.
### Order performance
- Show Order count/status performance using canonical lifecycle; no report-only persisted statuses. fileciteturn81file18
- Exact presentation groups are Open.
### Product performance
- Supported metrics may include quantity sold, gross sales, net proceeds, Order-line count, and refunds/returns by Product.
- Do not invent traffic/conversion metrics; SKU breakdown is optional.
### Traceability / drill-down
- Every major total should be traceable to contributing Seller-owned records.
- Conceptual:
```text
Gross Sales card
→ filtered Transactions/Order Items

Refunds card
→ refund/reversal ledger entries

Product performance row
→ contributing Order Items
```
- Drill-down applies the same normalized report period/filters.
- Seller must never drill into another Seller's rows in a mixed-Seller parent Order.
### Reconciliation
- For identical scope/filters:
  - summary = sum of contributing rows
  - chart buckets = same authoritative total across buckets
  - export = web report
  - Dashboard financial cards = same underlying definitions
- Differences caused by different freshness/as-of times must be explicitly shown.
- Automated tests should assert reconciliation.
### Report queries
- Aggregate in Laravel/database, not by fetching all Transactions into React.
- Laravel Query Builder supports `sum`, `avg`, generic aggregates, and `groupBy`. citeturn911305search2
- Use indexes suited to:
  - `seller_id`
  - timestamps
  - transaction/payment state
  - Order/Product foreign keys
- Exact indexes depend on query plans/schema.
### Report response
- Return period, financial/order summaries, Product performance, time series, and `data_as_of`.
- Detailed contributing lists are separately paginated.
### Time series
- Server returns authoritative grouped buckets such as `bucket_start`, gross sales, refunds, and net proceeds.
- Normalize missing buckets to zero only when they truly mean no activity.
### Pagination
- Drill-down tables must be paginated.
- Enforce maximum page size.
- Allow-list sort/filter columns.
- Do not return an entire long ledger in one API call.
### CSV export
- Source explicitly supports CSV export.
- CSV must use the same normalized:
  - Seller scope
  - period
  - timezone
  - grouping
  - filters
  - financial definitions
as the web report.
- Export may contain:
  - report metadata
  - summary
  - detailed rows depending on selected export type
- Exact CSV columns are Open.
- Properly escape spreadsheet-dangerous Seller/user-controlled text.
### PDF export
- PDF is a human-readable snapshot with Seller/shop, period/timezone, currency, summaries/breakdowns, and generation/data-as-of time.
- PDF library is Open; avoid making browser screenshots the authoritative generator by default.
### Export request
- Conceptual:
```http
POST /api/seller/report-exports
```
Body contains normalized report intent:
```text
format
from
to
timezone
grouping
filters
```
- Server revalidates everything.
- Never accept a client-submitted precomputed total to place into the export.
### Small export
- Bounded CSV exports may use streamed downloads.
- Laravel supports `streamDownload()` without first writing the whole generated response to disk. citeturn379183search0
- Exact synchronous threshold is Open.
- PDF or large datasets may still require queued generation.
### Large export
- Large CSV/PDF exports run asynchronously so report HTTP requests are not held open for long generation.
- Laravel queues are intended for time-intensive work and support job batches/progress metadata. citeturn379183search1
- Recommended state:
```text
QUEUED
PROCESSING
READY
FAILED
EXPIRED
```
- Exact threshold and progress model are Open.
### Export snapshot consistency
- Define request-time vs generation-time snapshot semantics.
- Store normalized parameters/`requested_at`; generated file records `data_as_of`.
- Strict reproducibility may require a stable ledger boundary; exact model is Open.
### Export idempotency
- Repeated submission/retry of the same export request should not create uncontrolled duplicate jobs/files.
- Use request idempotency or dedupe where practical.
- Queue retry of one export job must not generate multiple active records for the same export ID.
### Export authorization
- Generated export belongs to one Seller.
- Seller can access only their own generated files/status records.
- Download authorization is rechecked at request time.
- Never expose a raw permanent public object-storage URL.
### Private output storage
- Large generated files should be private.
- Use configured object/file storage.
- Store asset/file reference, not application-server path.
- Laravel filesystem supports temporary expiring URLs where the configured driver supports them. citeturn911305search0turn911305search1
- Exact expiry/retention period is Open.
### Export retention
- Generated files expire/prune by policy; expired files cannot download.
- Metadata may outlive files; exact retention is Open.
### Failure handling
- Web report:
  - validation failure → `422`
  - unavailable dependent financial source → explicit unavailable/error state
  - never substitute failed financial query with zero
- Export:
  - queued generation failure marks export `FAILED`
  - Seller can retry/request again
  - failure does not alter financial records
### Data freshness
- Include `data_as_of`; long-running exports must state their snapshot/query boundary.
- Do not label reports realtime unless freshness supports it.
### Caching
- Optional cache keys include Seller, period, timezone, grouping, filters, and report-definition version.
- Ledger/database remains authoritative; prioritize traceability over stale caching. TTL is Open.
### Security/privacy
- Never expose Buyer payment credentials, unnecessary private Buyer identity, another Seller's allocation, or platform secrets.
- CSV/PDF downloads stay Seller-authorized; logs keep IDs/safe filters, not sensitive rows.
### Frontend states
- Report: idle/loading/loaded/empty/invalid/unavailable/error.
- Export: requesting/queued/processing/ready/failed/expired.
- UI distinguishes generation from file readiness.
### Accessibility
- Label date/group/filter controls; use keyboard access, descriptive currency values, non-visual chart summaries, table headers, and textual export status.
### Acceptance criteria
- [ ] Seller can report only on Seller-owned data.
- [ ] From/To/timezone/grouping/filter inputs are server-validated.
- [ ] Gross sales, discounts, refunds, platform fees, pending, settled, and net proceeds have documented authoritative definitions.
- [ ] Profit is displayed only if authoritative Product cost data exists.
- [ ] Report totals reconcile to contributing Seller-owned records.
- [ ] Product/Order performance uses the same period/scope.
- [ ] Drill-down cannot expose another Seller's records.
- [ ] Dashboard and Generate Report reuse financial definitions.
- [ ] CSV/PDF exports use the exact normalized report filters/definitions.
- [ ] Large exports run asynchronously.
- [ ] Generated files are private and Seller-authorized.
- [ ] Expiring download/retention behavior is enforced.
- [ ] Export retries do not mutate or duplicate financial records.
- [ ] `data_as_of`, timezone, currency, and selected period are included in web/export output.
- [ ] Historical fee/refund values come from authoritative recorded facts, not today's configuration.
## HOW
### Project findings
- `Seller.md` explicitly defines Generate Report around Seller financial/profit reporting, From/To dates, sales/performance tracking, `Transactions`, and CSV/PDF exports. fileciteturn81file0turn81file1
- Dedicated Seller report flow defines from/to timezone/grouping/optional filters; gross sales, discounts, refunds, platform fees, net proceeds, Order/Product performance; drill-down; asynchronous large export; expiring Seller-authorized downloads.
- Dedicated flow also resolves a terminology problem: without Product cost data the value must be **net proceeds**, not profit.
- Dashboard should reuse these financial definitions rather than duplicate formulas.
- AISLEY global rules require tenant scoping, UTC timestamps, pagination, fixed-precision money, authorized file access, and Laravel business authority. fileciteturn81file18
- Sources do not define fee rate, Product cost schema, exact refund attribution, multi-currency conversion, CSV/PDF layout, export limits, or retention.
### Recommended Laravel API
```http
GET  /api/seller/reports
GET  /api/seller/reports/transactions
GET  /api/seller/reports/products

POST /api/seller/report-exports
GET  /api/seller/report-exports/{export}
GET  /api/seller/report-exports/{export}/download
```
- Use Form Requests, Seller-scoped query services, API Resources/DTOs, pagination, and authorized export records.
### Normalized report query
Recommended value object:
```text
SellerReportQuery
- seller_id           # server-derived
- from_utc
- to_utc_exclusive
- timezone
- grouping
- product_ids[]
- order_statuses[]
- financial_statuses[]
```
- Build this once from validated input and reuse it across summary, charts, drill-down, and export.
### Recommended services
```text
BuildSellerFinancialReport
BuildSellerOrderPerformance
BuildSellerProductPerformance
GetSellerReportLedger
CreateSellerReportExport
GenerateSellerCsvReport
GenerateSellerPdfReport
```
- Shared finance calculation service should also feed Dashboard headline financial cards.
### Query approach
- Use database aggregate/group queries for summary/time series.
- Laravel Query Builder provides `sum`, `avg`, `aggregate`, and `groupBy`. citeturn911305search2
- Drill-down uses paginated Seller-scoped rows.
- Avoid application-memory aggregation over full financial history.
### Export model
```text
seller_report_exports
- id
- seller_id
- format
- normalized_query_json
- status
- requested_at
- data_as_of nullable
- asset_id nullable
- error_code nullable
- expires_at nullable
- created_at
- updated_at
```
- Do not persist arbitrary SQL/query strings.
- Normalize/filter stored parameters.
### Export worker
```text
Create export record
→ queue GenerateSellerReportExport
→ rebuild report with stored normalized parameters
→ generate CSV/PDF
→ private storage
→ set asset/data_as_of/expires_at
→ READY
```
- Large multi-part exports may use Laravel job batches and expose progress. citeturn379183search1
### CSV recommendation
- For bounded exports, `streamDownload()` can generate a download without materializing the whole output file first. citeturn379183search0
- For queued large exports, write incrementally/stream to private storage where the selected implementation supports it.
- Ensure proper quoting/encoding and neutralize formula-injection-prone text.
### PDF recommendation
- Select a maintained Laravel/PHP PDF library based on deployment constraints.
- Render from an export-specific server template/DTO that uses the same calculated report values.
- Do not create a second set of financial formulas inside the PDF template.
### Download
- Authorize Seller first.
- If private storage supports it, create a short-lived temporary URL; Laravel's filesystem API supports `temporaryUrl()` on supported disks. citeturn911305search0turn911305search1
- Otherwise stream through an authorized Laravel endpoint.
- Never send a permanent public URL.
### Next.js / React
```text
/seller/reports
├── ReportFilters
├── FinancialSummary
├── FinancialTrendChart
├── OrderPerformance
├── ProductPerformance
├── ReportDrilldownTable
└── ExportControls
```
- Export job panel:
```text
ExportHistory
└── queued / processing / ready / failed / expired
```
- Next.js uses shared Laravel API client; it does not recompute authoritative totals.
### Tests
- **Laravel:** Seller isolation; date/timezone boundaries; allow-listed filters; gross/discount/refund/fee/net formulas; profit-with/without cost; pending/settled; Product/Order performance; drill-down reconciliation; export ownership; queued success/failure; expiration.
- **Reconciliation:** web summary = detail rows = CSV/PDF = Dashboard definitions for identical query/as-of.
- **Security:** another Seller cannot retrieve report/export; private download expires; CSV dangerous cells are neutralized.
- **Frontend:** filter/date states; empty/report/error; drill-down; export queue/progress/ready/failure/expiry; accessibility.
### Observability
- Track:
  - report query duration
  - slow aggregation sections
  - export queue duration/failure
  - output row count/file size
  - authorization failures
  - expired/pruned assets
- Log Seller/report/export IDs and safe filter metadata, not full financial row payloads.
### Risks
- **Financial ambiguity/reconciliation drift:** duplicated or undefined formulas can misstate Seller bookkeeping.
- **Tenant/file leakage:** missing Seller scope or permanent export URLs can expose financial data.
- **Historical/timezone error:** today's fee rules or inconsistent boundaries can alter prior totals.
- **Scale:** large unindexed ranges/exports can time out or exhaust memory.
### Open questions
- Financial ledger schema; gross-sales shipping/tax treatment; refund-date semantics.
- Discount funding; Product cost/COGS/profit formula; pending/settled model.
- Multi-currency and available filters.
- Max range/grouping.
- CSV/PDF layout, queue threshold, PDF package.
- Export retention/link duration and snapshot semantics.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture: `README.md`
- Seller source: `Seller.md`
- Seller flow: `feature-system-flows/seller/generate-report.md`
- Seller flow: `feature-system-flows/seller/dashboard.md`
- Laravel 12 Query Builder API: https://api.laravel.com/docs/12.x/Illuminate/Database/Query/Builder.html
- Laravel 12 Queues: https://laravel.com/docs/12.x/queues
- Laravel 12 Responses: https://laravel.com/docs/12.x/responses
- Laravel Filesystem: https://laravel.com/docs/filesystem
