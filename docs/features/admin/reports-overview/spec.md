---
feature: reports-overview
title: Admin Reports Overview
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Admin
scope: Admin Web Application
---

# Admin Reports Overview
## WHAT
- **Purpose:** Give authorized Admins a financial overview of AISLEY platform revenue, with emphasis on commission fees earned from platform transactions.
- **Primary actor:** Authenticated `ADMIN`.
- **Source-defined capabilities:**
  - calculate platform commission totals
  - aggregate financial performance from transaction/order data
  - filter results by time period
  - support daily, weekly, and monthly views
  - optionally generate large CSV/PDF exports asynchronously
- **Architecture:**
  - Next.js/React owns report filters, KPI cards, tables/charts, export controls, and UI states.
  - Laravel owns authorization, date validation, financial aggregation, commission calculations, report DTOs, export jobs, storage, and audit records where required.
  - Database/ledger data returned by Laravel is authoritative.
- **Primary report question:**
```text
How much commission/revenue did the AISLEY platform earn
for the selected reporting period?
```
- **Recommended report sections:**
  - total platform commission
  - transaction/order count contributing to the report
  - period-over-period or time-bucket breakdown when useful
  - optional detailed commission ledger/table
- **Source limitation:** the available Admin source does not define:
  - commission percentage
  - commission formula
  - currency
  - refund/cancellation treatment
  - payout settlement model
  - exact transaction statuses included
- Reports must consume authoritative commission/payment/order rules from the implemented commerce domain rather than invent them.
- **Feature boundaries:**
  - Dashboard may display a compact financial KPI from this report domain.
  - Seller Generate Report is seller-scoped and must not be reused as the Admin's platform-wide authorization scope.
  - Reports Overview is read-oriented and does not modify orders, payments, commissions, or payouts.
- **Recommended route:**
```text
/reports
```
- **Non-goals:**
  - changing commission rates
  - modifying transactions
  - initiating payouts/refunds
  - accounting/tax filing
  - profit forecasting
  - seller-specific bookkeeping replacement
  - inventing financial values from frontend data
  - hard-coding a commission rate not established by the commerce domain
## MUST
### Access control
- Every report endpoint requires:
  - authenticated session
  - persisted role = `ADMIN`
  - Reports Overview permission where custom Admin permissions exist
- Laravel authorization is authoritative.
- React-hidden report controls are not authorization.
- Direct API requests cannot bypass permissions.
- Use project-standard:
  - `401` unauthenticated
  - `403` forbidden
  - `422` invalid filters/date ranges
  - `404` export not found/scoped out where applicable
### Financial source of truth
- Report totals must derive from persisted authoritative order/transaction/commission data.
- Do not calculate authoritative commission totals from partially loaded frontend records.
- Do not infer commission by multiplying order totals by a hard-coded percentage unless the commerce domain explicitly defines that as its source of truth.
- Prefer recorded commission amounts/ledger entries when the payment/order domain persists them.
- If commission is calculated dynamically, use one shared server-side commission rule used consistently by checkout/payment/reporting.
- Exact commission source/model is an Open Question until the real transaction schema is available.
### Included transaction state
- Reports must define which transaction/order states contribute to financial totals.
- Do not count all orders blindly.
- Cancelled, rejected, failed, refunded, returned, or partially refunded activity must follow the actual financial-domain rule.
- Existing order lifecycle includes terminal/exception states, but current sources do not define their exact commission accounting treatment.
- The report query must reuse authoritative financial status semantics rather than creating a report-only interpretation.
- Report documentation/code must make inclusion rules reproducible and testable.
### Money precision
- All monetary calculations must use fixed precision.
- Follow the project-wide rule:
  - fixed-precision decimal values, or
  - documented integer minor units
- Never calculate authoritative money with JavaScript floating point.
- API money values should be serialized as decimal strings or the project's approved representation.
- Currency must be explicit where the platform can support more than one currency.
- Do not sum values across different currencies without an explicit conversion/accounting rule.
- Current source does not define multi-currency behavior; treat it as an Open Question if relevant.
### Report periods
- Source requires:
```text
DAILY
WEEKLY
MONTHLY
```
- Laravel determines date boundaries.
- Store timestamps in UTC according to the project contract.
- Date grouping must use one documented reporting timezone.
- Render period labels in the Admin's locale where appropriate.
- Do not let browser-local date conversion silently change which transactions belong to a period.
- Exact reporting timezone is an Open Question.
- Week-start convention is an Open Question.
- Month means calendar month unless the project later defines fiscal periods.
### Filter validation
- Allow-list supported period values.
- Reject arbitrary grouping expressions/SQL fields from the client.
- Validate any supplied start/end dates.
- If custom range is later supported:
  - start must be on/before end
  - enforce a maximum range where needed for performance
- Custom from/to filtering is not mandatory from the current Admin source.
### Report summary
- The report response must expose server-computed financial summary values.
- Recommended conceptual fields:
```json
{
  "period": "monthly",
  "range": {
    "start": "ISO-8601",
    "end": "ISO-8601"
  },
  "currency": "PHP",
  "totalCommission": "0.00",
  "transactionCount": 0,
  "buckets": []
}
```
- Field names are conceptual and follow repository conventions.
- Currency value above is an example only; use actual platform currency configuration.
- Do not return fake zero when aggregation fails.
- Empty period and failed query must be distinguishable.
### Time-series breakdown
- Daily/weekly/monthly reports may return time buckets.
- Each bucket should contain only necessary aggregates, such as:
  - period start/end
  - commission total
  - contributing transaction count
- Bucket totals must use the same inclusion rules as overall totals.
- The sum of buckets should reconcile with the summary when grouping rules allow it.
- Missing periods may be returned as:
  - explicit zero buckets, or
  - omitted buckets filled by frontend presentation logic
- Choose one consistent API convention.
### Detailed ledger/table
- A detailed transaction/commission table is recommended when Admin needs to reconcile totals.
- If included:
  - paginate it
  - use allow-listed filters/sorts
  - avoid embedding all rows inside the summary endpoint
- Safe fields may include:
  - transaction/order reference
  - transaction timestamp
  - seller reference
  - gross/order amount where authorized
  - commission amount
  - relevant financial status
- Do not expose:
  - full payment credentials
  - unnecessary buyer PII
  - provider secrets
  - unrelated seller banking data
- Exact ledger columns are Open Questions until the financial schema is available.
### Aggregation queries
- Perform aggregates in the database where practical.
- Laravel Query Builder supports database-side aggregate methods such as:
  - `count`
  - `sum`
  - `avg`
  - `min`
  - `max`
- Avoid loading every transaction into PHP merely to sum/count it.
- Avoid loading large result sets into Next.js for calculation.
- Apply indexes to actual report filter/group columns where measured query plans require them.
- Likely candidates include transaction timestamp, status, seller, and commission/transaction relationships, depending on schema.
### Dashboard integration
- Admin Dashboard may consume a compact Reports Overview KPI such as current-period commission.
- Dashboard and Reports Overview must use the same financial calculation service/query semantics.
- Do not maintain competing formulas.
- Reports Overview remains the detailed financial analysis surface.
### Charts
- Charts are optional presentation.
- If used:
  - Laravel provides authoritative time-bucket data
  - React only visualizes returned values
  - labels include units/currency and reporting period
  - empty/partial data is clear
- Do not select a chart library in this spec unless the repository already contains one.
- A chart is not required for financial correctness.
### CSV export
- `Admin.md` says large financial exports may include CSV/PDF.
- CSV export is optional unless project scope explicitly requires it.
- If implemented:
  - use the same validated report filters and commission rules
  - export only authorized fields
  - include explicit currency and timestamps
  - avoid exposing sensitive payment/PII data
- Small exports may use a streamed response.
- Laravel supports streamed downloads to reduce memory use.
- Large exports should be queued/generated asynchronously.
- CSV cells containing untrusted user-controlled content must be protected against spreadsheet formula injection.
- Do not assume quoting alone is sufficient for all spreadsheet clients.
### PDF export
- PDF export is optional.
- Laravel does not provide a built-in business-report PDF renderer; use an existing repository dependency or intentionally selected library if PDF becomes required.
- Do not add a PDF dependency solely because the source says exports may include PDF unless the implementation needs it.
- Generated PDF must use the same authoritative report dataset as screen/CSV output.
### Asynchronous export
- Large export generation must not block the normal HTTP request.
- Recommended flow:
```text
Admin requests export
→ validate + authorize
→ create export record/job
→ queue generation
→ generate file
→ store privately
→ mark READY
→ Admin downloads through authorized temporary link
```
- Queue retries must not create duplicate export records/files.
- Export status should distinguish:
  - queued
  - processing
  - ready
  - failed
- Exact status names follow repository conventions.
- Do not mark export ready until file creation completes successfully.
### Export storage
- Generated financial reports are private.
- Store them using configured private/object storage.
- Do not place financial exports in a publicly guessable web directory.
- Provide an authorized download endpoint or temporary signed URL.
- Laravel filesystem supports temporary URLs on supported storage drivers.
- Export download must re-authorize the requesting Admin.
- Exact export retention/cleanup duration is an Open Question.
### Export idempotency
- Duplicate export requests may occur.
- Protect creation with the project's idempotency strategy or a stable request fingerprint where appropriate.
- Retrying the generation job must not change report criteria unexpectedly.
- Persist the normalized report filters used for the export.
### Audit
- Viewing aggregate reports does not necessarily require immutable Admin Audit Logs unless policy requires view tracking.
- Exporting sensitive financial reports may be auditable.
- If export auditing is enabled, safe metadata includes:
  - Admin ID
  - export/report ID
  - date/period filters
  - format
  - timestamp
- Never log payment credentials or full report contents in the audit entry.
### Caching
- Frequently requested aggregate periods may be cached if report freshness permits.
- Database remains authoritative.
- Cache keys must include all filters affecting the result.
- Do not cache permission decisions as report access.
- Do not serve stale values without a defined freshness policy.
- Actionable/recent financial totals may need a shorter TTL than historical closed periods.
- Cache strategy is optional until query cost is measured.
### Error and empty states
- Frontend must distinguish:
  - loading
  - loaded
  - no transactions for period
  - invalid filter
  - forbidden
  - report query failure
  - export queued/processing/ready/failed
- A backend error must not display as `₱0.00`/zero revenue.
- Empty-period zero is valid only when query succeeds and no qualifying transactions exist.
### Accessibility
- Period controls require semantic labels.
- Financial values must not rely on charts/color alone.
- Tables need proper headers.
- Export progress/status must have textual equivalents.
- Charts, if used, need accessible summary/tabular equivalents.
### Acceptance criteria
- [ ] Guest cannot access Reports Overview.
- [ ] Non-Admin cannot access Admin financial reports.
- [ ] Custom Reports permission is enforced.
- [ ] Daily, weekly, and monthly filters are server-validated.
- [ ] Laravel determines report date boundaries.
- [ ] Report uses authoritative financial/commission data.
- [ ] Commission rate/formula is not hard-coded only in React/report UI.
- [ ] Invalid/failed/refunded/cancelled state treatment follows financial-domain rules.
- [ ] Monetary arithmetic uses fixed precision.
- [ ] Report response includes explicit currency where required.
- [ ] Summary and bucket calculations use identical inclusion rules.
- [ ] Database performs aggregate calculations where practical.
- [ ] Detailed rows, when provided, are paginated.
- [ ] Sensitive payment/PII data is absent from report DTOs.
- [ ] Dashboard financial KPI reuses Reports Overview semantics.
- [ ] Query failure is not presented as legitimate zero.
- [ ] Large export, when supported, runs asynchronously.
- [ ] Private exports require authorized/temporary download access.
- [ ] Export generation uses the same filters/calculation rules as on-screen reports.
- [ ] CSV export protects user-controlled text from formula injection.
- [ ] UI handles empty, invalid, forbidden, query-error, and export states.
## HOW
### Project findings
- `Admin.md` defines Reports Overview as a financial analytics module for platform commission revenue with daily/weekly/monthly filtering. fileciteturn20file0
- Its system context expects aggregation over `Transactions` or `Orders` and says large CSV/PDF exports may require background processing. fileciteturn20file1
- Seller reporting is separately seller-scoped and includes gross sales, profits, and platform fees; Admin Reports must remain platform-scoped. fileciteturn20file4
- `README.md` makes Laravel authoritative for report totals, requires timezone-aware report boundaries, fixed-precision money, queued exports, and authorized private export URLs. fileciteturn20file14turn20file17
- The available sources do not define the commission percentage/formula, actual transaction schema, currency model, refund accounting rules, or exact export requirements.
### Laravel report service
- Prefer a dedicated read/query service such as:
```text
GetAdminCommissionReport
```
- Input:
  - validated period
  - normalized time range
  - optional supported filters
- Output:
  - summary DTO
  - time buckets
  - optional paginated ledger query
- Keep controllers thin.
- Do not duplicate financial formulas across:
  - Dashboard
  - Reports Overview
  - exports
### Laravel API
Conceptual endpoints:
```http
GET  /api/admin/reports/commission
GET  /api/admin/reports/commission/transactions
POST /api/admin/reports/commission/exports
GET  /api/admin/reports/exports/{export}
GET  /api/admin/reports/exports/{export}/download
```
- Export endpoints exist only if exports are in MVP.
- Use Form Requests/query validators and Policies/Gates.
- Return API Resources/DTOs with decimal-string money values.
### Query implementation
- Build one base financial query containing authoritative inclusion rules.
- Clone/compose it for:
  - total commission
  - transaction count
  - period buckets
  - detailed ledger
- Use database-side aggregate functions.
- Laravel Query Builder exposes `sum`, `avg`, `min`, `max`, and aggregate primitives. citeturn959783search2
- Use database-specific date-grouping carefully so timezone boundaries remain correct.
- Test period-boundary transactions explicitly.
### Export implementation
- For small CSV:
  - Laravel `response()->streamDownload()` can stream generated data without first writing the entire file to disk. citeturn381412search2
- For large exports:
  - create a queued job implementing the repository queue conventions
  - store normalized filters on the export record
  - generate from the same report service
  - write to private configured storage
  - update export status
- Laravel queues are intended for time-consuming work that should not block the request. citeturn381412search0
- Use `afterCommit()`/configured after-commit behavior when the export job depends on a newly persisted export record. citeturn381412search0
### Export security
- Generate private download links only for authorized Admins.
- Laravel filesystem adapters can generate temporary URLs where supported. citeturn959783search0
- Sanitize CSV output intended for spreadsheet programs against formula injection when cells contain user-controlled values. OWASP documents formula execution risks for cells beginning with formula-triggering characters. citeturn381412search1
- Keep financial exports out of public paths.
### Next.js / React
- Build:
  - Reports Overview page
  - period selector
  - KPI summary cards
  - optional chart
  - optional paginated ledger
  - export controls/status
- Fetch only through the shared Laravel API client.
- Use server-returned decimal strings; format for display without recalculating authoritative totals.
- Keep the selected report period in URL/search params if that matches repository conventions so the view is shareable/reloadable.
- Refetch when filters change.
- Poll export status or use existing notifications/broadcast infrastructure if export completion needs live updates.
### Tests
- **Laravel:** auth/permission denial; daily/weekly/monthly validation; boundary timestamps; financial-state inclusion/exclusion; fixed-precision commission totals; bucket reconciliation; safe DTO; pagination; export authorization; queued generation; failed export; temporary download; CSV formula-injection handling.
- **Frontend:** period switching; loading/empty/error/forbidden states; money formatting; chart/table consistency; pagination; export queued/ready/failed; invalid-filter errors; accessibility.
### Research-backed recommendations
- Aggregate in the database instead of loading all transaction rows into PHP/React. citeturn959783search2
- Queue large export generation rather than blocking report requests. citeturn381412search0
- Stream small CSV exports when appropriate. citeturn381412search2
- Store generated reports privately and use temporary/authorized downloads. citeturn959783search0
- Treat CSV formula injection as an export-security concern when user-provided strings are included. citeturn381412search1
### Risks
- **Incorrect commission:** duplicated/hard-coded formulas can disagree with checkout/payment records.
- **Refund mismatch:** unclear refund/return accounting can overstate platform revenue.
- **Timezone boundaries:** transactions near midnight/week/month boundaries may appear in the wrong period.
- **Floating-point drift:** JavaScript/PHP floats can corrupt financial totals.
- **Slow aggregation:** unindexed large transaction tables can make reports expensive.
- **Export memory/timeouts:** generating large files synchronously can exhaust request resources.
- **Data leakage:** exports may expose sensitive transaction/user information.
- **CSV injection:** untrusted spreadsheet cells may execute formulas.
- **Stale cache:** cached financial results may be mistaken for current values.
### Open questions
- Authoritative commission formula/rate and where it is persisted.
- Platform currency/multi-currency behavior.
- Which financial/order states earn commission.
- Refund, partial-refund, cancellation, return, and chargeback treatment.
- Reporting timezone and week-start day.
- Whether custom from/to date ranges are needed.
- Whether detailed transaction ledger is MVP.
- Whether charts are required.
- Whether CSV export is required.
- Whether PDF export is required and which existing library/provider is used.
- Maximum synchronous export size before queueing.
- Export retention/cleanup period.
- Whether exports are recorded in System Audit Logs.
- Historical-period caching/freshness policy.
- Exact Dashboard KPI/report integration.
### Sources
- Project feature-spec rules: `SKILL.md`
- AISLEY architecture/system-flow contract: `README.md`
- Admin feature model: `Admin.md`
- Seller feature model: `Seller.md`
- Laravel Query Builder aggregates: https://api.laravel.com/docs/12.x/Illuminate/Database/Query/Builder.html
- Laravel Queues: https://laravel.com/docs/12.x/queues
- Laravel HTTP Responses / streamed downloads: https://laravel.com/docs/12.x/responses
- Laravel Filesystem temporary URLs: https://api.laravel.com/docs/12.x/Illuminate/Filesystem/FilesystemAdapter.html
- OWASP CSV Injection: https://owasp.org/www-community/attacks/CSV_Injection
