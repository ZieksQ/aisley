---
feature: Reports Overview
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Admin Web Application
source_coverage: Current AISLEY project requirements; may be updated as financial rules evolve
---

# Reports Overview Specification

## 1. Purpose

This document defines the **AISLEY Admin Reports Overview** feature.

Reports Overview is the platform-level financial analytics and reporting module for administrators. Its primary responsibility is to calculate, aggregate, present, filter, and export revenue earned by AISLEY from the platform's documented commission model.

This specification is grounded in the current AISLEY project documents:

- `app.md`
- `Admin.md`
- `Buyer.md`
- `Seller.md`
- `Logistics.md`
- `Courier.md`

The source documents explicitly establish that:

- Admin Reports Overview calculates platform commission.
- Admin should be able to determine how much commission the platform has earned.
- Reports require temporal filtering such as daily, weekly, and monthly views.
- Financial reporting may aggregate data from `Transactions` or `Orders`.
- Large CSV/PDF exports may require background processing.
- AISLEY earns from its Logistics SaaS model through:
  - a base subscription, plus
  - **₱10 per order**.
- The default **₱50 shipping fee is Logistics commission**, not AISLEY platform commission.
- Seller financial reporting is seller-scoped and includes seller sales/profit/platform fees.
- Courier financial reporting is courier-scoped and reflects earnings from delivery fees.
- These seller/courier financial views are separate from the Admin platform-commission report.

Where the source documents do not define accounting recognition rules, refund adjustments, subscription pricing, tax treatment, settlement timing, canceled-order handling, or payment gateway fees, this specification marks those as open decisions rather than inventing financial rules.

---

# 2. Core Value

`Admin.md` defines Reports Overview as:

```text
Calculate platform commission reports,
e.g. how much total did that admin got for the commission.
```

Expanded intent:

```text
platform transactions / orders / subscriptions
        ↓
authoritative financial rules
        ↓
calculate AISLEY platform revenue
        ↓
aggregate by time period
        ↓
Admin views financial performance
        ↓
Admin may export report
```

Reports Overview answers questions such as:

```text
How much platform commission did AISLEY generate?

How much came from the per-order platform fee?

How much came from Logistics subscriptions?

How did platform commission change by day, week, or month?

Which underlying transactions/orders contributed to the total?
```

---

# 3. Goals

Reports Overview must:

1. calculate AISLEY platform commission using authoritative business rules
2. separate AISLEY revenue from Seller revenue
3. separate AISLEY revenue from Logistics shipping commission
4. separate AISLEY revenue from Courier earnings
5. support daily financial reporting
6. support weekly financial reporting
7. support monthly financial reporting
8. support custom date filtering if consistent with the eventual reporting implementation
9. provide summary totals
10. provide a temporal trend view
11. provide an auditable breakdown of commission sources
12. allow the Admin to drill down from aggregate totals to contributing records
13. use authoritative Orders/Transactions/subscription data
14. keep Dashboard commission values consistent with Reports Overview
15. support CSV export
16. support PDF export if implemented according to `Admin.md`
17. generate large exports without blocking interactive Admin requests
18. enforce Admin authentication and permissions
19. avoid exposing unnecessary Buyer/Seller/Courier PII
20. avoid double-counting fees or revenue
21. clearly identify the reporting period and currency
22. represent zero-data and partial-data states correctly

---

# 4. Non-Goals

Reports Overview does not define:

- Seller bookkeeping/report implementation
- Courier earnings calculation
- Logistics internal profit reporting
- Buyer spending reports
- accounting general ledger
- tax accounting
- VAT calculation
- tax filing
- invoice generation unless separately specified
- refunds
- partial refunds
- chargebacks
- payment gateway settlement
- payment gateway fees
- seller payout calculation
- courier payout processing
- Logistics payout processing
- bank reconciliation
- subscription billing provider
- subscription plan pricing
- subscription collection workflow
- revenue recognition accounting policy
- foreign exchange
- multi-currency accounting
- expense reporting
- profitability/net income
- fraud loss accounting
- manual financial adjustments
- financial approval workflow
- financial audit certification
- scheduled emailed reports
- forecasting
- budgeting

These require separate financial/business specifications.

---

# 5. Primary Actor

## 5.1 Admin

Reports Overview is an Admin-only platform feature.

An authorized Admin can:

```text
view platform commission
select reporting period
inspect commission breakdown
inspect contributing transactions/orders
view trends
generate/download exports
```

If AISLEY's custom Admin permission system restricts financial reporting, the backend must enforce the appropriate permission.

---

# 6. Financial Scope

Reports Overview is **platform-scoped**, not merchant-scoped.

The report must represent:

```text
AISLEY platform revenue / commission
```

It must not present unrelated amounts as AISLEY revenue.

---

# 7. Source-Defined AISLEY Commission Model

`app.md` defines:

```text
Admin Commission Flow

Logistics SaaS platform:
base subscription + 10 pesos per order

Shipping fee:
default 50 pesos
(this is where logistics get their commission)
```

Therefore, the currently documented platform commission model is:

```text
AISLEY Platform Revenue
    =
    Logistics Base Subscription Revenue
    +
    Applicable Per-Order Platform Fees
```

with:

```text
Per-Order Platform Fee = ₱10 per applicable order
```

The base subscription price is **not specified** in the current documents.

It must come from authoritative subscription/billing configuration or records.

---

# 8. Shipping Fee Boundary

The source explicitly states:

```text
Shipping fee = default ₱50
this is where Logistics get their commission
```

Therefore:

```text
₱50 shipping fee
    ≠
AISLEY platform commission
```

Reports Overview must not add the full shipping fee to AISLEY platform revenue.

Example:

```text
Order:
Shipping fee              ₱50
AISLEY per-order fee      ₱10

Admin Reports Overview:
Platform commission       ₱10
not ₱60
```

unless a future business rule changes the platform's revenue share.

---

# 9. Base Subscription Revenue

AISLEY's Logistics SaaS model includes:

```text
base subscription
```

but the source does not define:

- amount
- billing interval
- plan tiers
- discounts
- free trials
- proration
- tax
- failed-payment handling
- subscription start/end recognition
- cancellation rules

Reports Overview must therefore read subscription revenue from the authoritative subscription/billing system rather than hardcoding a guessed amount.

---

# 10. Per-Order Platform Fee

The documented per-order platform fee is:

```text
₱10 per order
```

The source does not define exactly **when an order becomes billable** for this fee.

Possible accounting triggers could include:

```text
order placed
seller confirmed
picked up
entered Logistics
delivered
transaction settled
```

but none is explicitly specified.

Therefore, implementation must not silently choose a recognition event as a permanent business rule without a product decision.

The report architecture should support whichever authoritative billable-order rule is later defined.

---

# 11. Financial Source of Truth

`Admin.md` says Reports Overview may use:

```text
Transactions
or
Orders
```

and requires complex aggregation queries.

Recommended principle:

```text
financial ledger / transaction record
    is preferred when available

Orders
    provide operational context
```

Do not recalculate historical commission solely from mutable current configuration if historical charged amounts have already been recorded.

Example:

```text
current fee = ₱10

historical order charged = ₱8
```

If the platform later changes the fee, historical reporting should use the amount actually recorded for that transaction rather than retroactively treating old orders as ₱10.

The current documents do not yet define a fee-versioning model, so this is an architectural consistency requirement rather than a source-specified schema.

---

# 12. Recommended Commission Ledger

A durable financial implementation should preserve the amount that was actually charged.

Conceptually:

```text
platform_revenue_entries

id
source_type
source_id
revenue_type
amount
currency
recognized_at
created_at
```

Possible revenue types based on current source requirements:

```text
LOGISTICS_SUBSCRIPTION
PER_ORDER_PLATFORM_FEE
```

This is a recommended logical model, not a mandated database table.

If the repository already has a suitable `Transactions` ledger, reuse it.

---

# 13. Revenue Categories

For the current source-defined model, Reports Overview should distinguish:

## 13.1 Logistics Subscription Revenue

```text
revenue_type = subscription
```

## 13.2 Per-Order Platform Fee Revenue

```text
revenue_type = order_fee
amount = documented charged amount
```

Currently documented default business rule:

```text
₱10 per applicable order
```

## 13.3 Total Platform Commission / Revenue

```text
subscription revenue
+
per-order platform fee revenue
```

No other revenue categories should be invented without a defined business rule.

---

# 14. Excluded Financial Amounts

The Admin report must not automatically classify the following as AISLEY platform revenue:

```text
Seller gross sales
Seller net profit
Product subtotal
Buyer order subtotal
default ₱50 shipping fee
Courier delivery earnings
Courier tips
Seller discounts
Buyer voucher savings
Logistics internal earnings
```

Some of these may be useful contextual values, but they are not the documented AISLEY commission.

---

# 15. Seller Financial Boundary

`Seller.md` defines Seller Generate Report as a merchant bookkeeping feature that can report:

```text
gross sales
net profits
platform fees
shop performance
```

filtered by:

```text
seller_id
timestamp ranges
```

That report is seller-scoped.

Admin Reports Overview must not reuse Seller revenue as if it were platform revenue.

Relationship:

```text
Seller Report
    seller economics

Admin Reports Overview
    platform economics
```

The same transaction may contribute different values to each report.

Example:

```text
Buyer purchases product

Seller Report:
gross sale / seller economics

Admin Report:
platform fee attributable to transaction
```

---

# 16. Courier Financial Boundary

`Courier.md` defines Courier Profit Dashboard / Earnings as:

```text
earnings derived from delivery fees
```

and includes:

```text
digital tips
courier delivery earnings
```

These are Courier-scoped earnings.

They must not be automatically added to Admin platform commission.

---

# 17. Logistics Financial Boundary

Logistics earns the documented shipping commission.

Current source:

```text
default shipping fee = ₱50
```

Reports Overview may display shipping-fee context if useful for reconciliation, but it must clearly distinguish:

```text
Logistics shipping revenue
```

from:

```text
AISLEY platform revenue
```

The main platform commission total must exclude Logistics-owned shipping revenue unless a later rule defines a platform share.

---

# 18. Buyer Payment Boundary

Buyer checkout calculates:

```text
items
vouchers
discounts
shipping
payment method
final order total
```

A Buyer's total payment is not equal to AISLEY revenue.

Reports must not calculate:

```text
platform revenue = buyer order total
```

Instead, platform revenue must be derived only from the applicable platform revenue components.

---

# 19. Order Relationship

Every applicable per-order platform fee should be traceable to its source Order.

Recommended relationship:

```text
platform revenue entry
    ↓
order_id
```

This allows the Admin to reconcile:

```text
commission total
    ↓
contributing orders
```

without exposing unnecessary Buyer information.

---

# 20. Subscription Relationship

Every subscription revenue entry should be traceable to its Logistics account/subscription record.

Recommended relationship:

```text
subscription revenue entry
    ↓
logistics_account_id / subscription_id
```

This supports financial drill-down and reconciliation.

---

# 21. Report Periods

`Admin.md` explicitly requires temporal filtering:

```text
daily
weekly
monthly
```

These are required report periods.

---

# 22. Daily View

Daily reports should aggregate recognized platform revenue by calendar day.

Conceptually:

```text
date
subscription revenue
per-order revenue
total platform revenue
```

The timezone used to define a day must follow the application's canonical timezone/accounting convention.

The source does not define that timezone.

---

# 23. Weekly View

Weekly reports should aggregate platform revenue into consistent calendar/business weeks.

The definition of week start:

```text
Sunday
or
Monday
```

is not specified.

Use the application's/reporting convention once defined.

The UI must make date ranges clear enough that the Admin is not required to infer the week boundaries.

---

# 24. Monthly View

Monthly reports should aggregate platform revenue by calendar month unless another financial calendar is later defined.

Example:

```text
August 2026
```

with:

```text
subscription revenue
per-order fee revenue
total platform revenue
```

---

# 25. Custom Date Range

`Admin.md` explicitly mentions daily/weekly/monthly and does not explicitly require custom ranges.

However, financial reporting and Seller reporting both use temporal parameters.

A custom date range is recommended but optional unless the project explicitly decides to include it.

If implemented:

```text
From
To
```

must follow one consistent inclusive/exclusive date convention on the backend.

---

# 26. Default Report Period

The source does not define the default.

Recommended Admin UX:

```text
This Month
```

because it provides useful platform-level financial context upon entering Reports.

However, the chosen default is a product decision.

---

# 27. Reports Overview Page

Recommended route:

```text
/reports
```

or:

```text
/reports/overview
```

Exact naming should follow Admin route conventions.

Navigation label:

```text
Reports Overview
```

---

# 28. Page Information Architecture

Recommended structure:

```text
Reports Overview

[Date / Period Controls]                    [Export]

[Total Platform Commission]
[Subscription Revenue]
[Per-Order Platform Fees]
[Applicable/Billable Orders]

Commission Trend

Revenue Breakdown

Commission Transactions / Ledger
```

This is an information hierarchy, not a pixel-perfect layout requirement.

---

# 29. Primary KPI — Total Platform Commission

Primary value:

```text
Total Platform Commission
```

Formula for the currently documented model:

```text
Total Platform Commission
    =
    recognized Logistics subscription revenue
    +
    recognized per-order platform fee revenue
```

The UI must display the selected period.

Example:

```text
Total Platform Commission
₱125,430.00
This Month
```

Do not display hardcoded sample values in production.

---

# 30. KPI — Subscription Revenue

Show:

```text
Logistics Subscription Revenue
```

for the selected reporting period.

This value must come from authoritative subscription billing records.

Do not calculate it as:

```text
number of Logistics accounts × guessed subscription price
```

unless the system's billing model explicitly guarantees that calculation.

---

# 31. KPI — Per-Order Platform Fees

Show:

```text
Per-Order Platform Fees
```

for the selected reporting period.

This should sum the platform fee actually recognized/recorded for qualifying orders.

Current source-defined fee:

```text
₱10 per applicable order
```

---

# 32. KPI — Applicable / Billable Orders

A supporting metric may show the number of orders that contributed a platform order fee.

This is useful for reconciling:

```text
order count × fee
```

when the fee is fixed.

However, label the count according to the final billing rule:

```text
Billable Orders
Commissioned Orders
Applicable Orders
```

rather than simply:

```text
All Orders
```

if not all orders are fee-bearing.

---

# 33. Reconciliation Check

If every applicable order in the selected period has the same recorded fee:

```text
per-order fee revenue
=
billable order count × ₱10
```

But the system must favor stored charged amounts over a UI-side multiplication.

This accommodates future:

- fee changes
- waived fees
- special plans
- corrections

without corrupting historical reports.

---

# 34. Trend Chart

Reports Overview should present a time-series visualization of platform commission.

For example:

```text
Daily view:
one point/bar per day

Weekly view:
one point/bar per week

Monthly view:
one point/bar per month
```

Recommended series:

```text
Total Platform Commission
```

Optional additional series:

```text
Subscription Revenue
Per-Order Fees
```

Avoid adding unrelated financial series without need.

---

# 35. Chart Accessibility

Charts must not be the only representation of financial values.

Provide:

- labels/tooltips
- accessible textual summary
- tabular or list representation where appropriate

Do not rely solely on color.

---

# 36. Revenue Breakdown

Reports should make the composition of platform revenue explicit.

Example:

```text
Revenue Breakdown

Logistics Subscriptions      ₱X
Per-Order Platform Fees      ₱Y
--------------------------------
Total Platform Revenue       ₱Z
```

This prevents the Admin from mistaking shipping revenue for platform commission.

---

# 37. Shipping Fee Context

If shipping fee values are displayed anywhere in the report, they must be visually and semantically separated.

Example:

```text
Context / Non-Platform Revenue
Logistics Shipping Fees      ₱X
```

or omit them entirely.

Never include them in:

```text
Total Platform Commission
```

under the current documented business model.

---

# 38. Financial Ledger / Transaction Table

Reports Overview should provide drill-down into the records contributing to the aggregate.

Recommended columns:

```text
Date
Reference
Revenue Type
Source
Amount
Currency
```

Possible source displays:

```text
Order #...
Logistics Subscription #...
```

Optional:

```text
related Logistics organization
```

where authorized and useful.

---

# 39. Transaction Detail

Selecting a financial entry may show:

```text
financial entry/reference
revenue type
recognized amount
recognized date
source order/subscription reference
related Logistics account where applicable
created timestamp
```

Do not expose unrelated sensitive Buyer payment credentials.

---

# 40. Order Fee Drill-Down

For a per-order fee entry, useful context includes:

```text
Order reference
fee amount
order date/status
related Logistics provider
fee recognized timestamp
```

Whether Buyer/Seller names need to appear is a product/PII decision.

They are not required to understand platform commission.

---

# 41. Subscription Drill-Down

For a subscription revenue entry:

```text
subscription reference
Logistics account
recognized amount
billing period/reference
recognized timestamp
```

Exact fields depend on the future subscription system.

---

# 42. Search

A report ledger may support server-side search for:

```text
financial reference
order reference
subscription reference
Logistics organization
```

Search fields must be limited to fields actually present.

---

# 43. Filters

Required:

```text
daily / weekly / monthly temporal control
```

Recommended additional filters if supported:

```text
date range
revenue type
Logistics organization
```

Do not invent:

```text
tax status
payment processor
settlement status
refund status
```

until those domains are defined.

---

# 44. Revenue-Type Filter

Recommended:

```text
ALL
LOGISTICS_SUBSCRIPTION
PER_ORDER_PLATFORM_FEE
```

These are the only two source-defined AISLEY revenue sources.

---

# 45. Logistics Filter

Because both documented platform revenue streams involve Logistics, an Admin may benefit from filtering by Logistics organization.

This is recommended, not explicitly required by `Admin.md`.

If included, it should use the authoritative Logistics account relation.

---

# 46. Sorting

Recommended default financial ledger sort:

```text
recognized_at descending
```

Newest financial entries first.

Allow sorting consistent with existing Admin table conventions.

---

# 47. Pagination

The ledger must be paginated or cursor-based.

Do not return all financial entries for large reporting periods in one interactive request.

---

# 48. Currency

The documented amounts are Philippine pesos:

```text
₱10
₱50
```

Therefore, current reports should format monetary values in:

```text
PHP
₱
```

unless AISLEY later introduces multi-currency settlement.

Store numeric money values using a safe decimal/integer representation.

Do not use binary floating point for authoritative monetary calculations.

---

# 49. Money Storage

Recommended:

```text
integer minor units
```

or:

```text
fixed decimal database type
```

according to the repository's established financial convention.

Example:

```text
₱10.00
```

must remain exact.

---

# 50. Rounding

The source does not define rounding rules because current fees are whole pesos.

Future percentages/taxes may require explicit rounding.

Do not introduce report-specific rounding that conflicts with the financial ledger.

---

# 51. Dashboard Integration

The Admin Dashboard includes:

```text
Platform Commission
```

as a KPI.

Dashboard and Reports Overview must use the same authoritative calculation.

Conceptually:

```text
shared PlatformRevenueService
        ├── Dashboard
        └── Reports Overview
```

Do not implement two independent formulas.

---

# 52. Dashboard Drill-Down

Expected interaction:

```text
Dashboard
Platform Commission
        ↓
View Reports
        ↓
Reports Overview
```

Where possible, the report should open with the same period represented by the Dashboard KPI.

---

# 53. Dashboard Consistency

Given the same:

```text
time period
scope
recognition rules
```

the Dashboard's commission total and Reports Overview's total must reconcile.

Differences caused by different freshness/caching must be clearly minimized or explained.

---

# 54. Seller Report Relationship

Seller Generate Report may show:

```text
platform fees
```

from the Seller's perspective.

Where the same fee is represented in both systems, the values should reconcile where their accounting scopes overlap.

But:

```text
Seller Report
    filtered by seller_id

Admin Report
    platform-wide
```

Therefore, totals are not expected to match globally.

---

# 55. Courier Earnings Relationship

Courier earnings should not be included in Admin platform revenue.

If future reports expose operational cost/context, courier earnings must be clearly labeled as a different financial dimension.

MVP does not require this.

---

# 56. Logistics Shipping Revenue Relationship

The default shipping fee is Logistics commission.

If a future Logistics financial report exists:

```text
Logistics Report
    shipping revenue

Admin Report
    SaaS/platform fee revenue
```

These financial scopes must remain separate.

---

# 57. Orders and Transactions

`Admin.md` allows aggregation over:

```text
Transactions
or
Orders
```

Recommended approach:

```text
Transactions / financial entries
    authoritative monetary amounts

Orders
    operational source/context
```

If the repository currently lacks a financial ledger, the report may aggregate from Orders as an interim implementation, but the business rule must be centralized.

---

# 58. Canceled Orders

The source documents define Buyer cancellation before seller processing but do not state whether a canceled order incurs the ₱10 platform fee.

Therefore:

```text
canceled-order commission treatment
```

is an open financial rule.

Reports must not assume that every created Order earns ₱10.

---

# 59. Failed Orders

The source does not define failed-payment or failed-order commission treatment.

Do not count failed transactions as recognized platform revenue without a defined rule.

---

# 60. Returned / Refunded Orders

Refund and return rules are not currently defined.

Therefore, Reports Overview must not invent:

```text
negative commission adjustment
commission clawback
```

unless a refund/financial ledger feature defines it.

The architecture should be compatible with future adjustment entries.

---

# 61. Delivered Orders

The order lifecycle ends at:

```text
DELIVERED
```

but the source does not explicitly say that delivery is the commission recognition trigger.

Do not assume it unless confirmed by the business rule.

---

# 62. Fee Changes

The current documented order fee is:

```text
₱10
```

If AISLEY changes it later, historical reports should retain the fee actually charged/recognized at the time.

Recommended:

```text
store financial amount per entry
```

rather than:

```text
recalculate historical records using current config
```

---

# 63. Subscription Price Changes

Likewise, subscription revenue should reflect actual billing records.

Do not retroactively recalculate old subscription revenue from the current plan price.

---

# 64. Financial Adjustments

The source does not define manual adjustments.

If introduced later, adjustments should be explicit ledger entries such as:

```text
CREDIT_ADJUSTMENT
DEBIT_ADJUSTMENT
```

rather than editing historical revenue rows invisibly.

This is future-facing architecture, not MVP scope.

---

# 65. Data Freshness

Financial reports do not require real-time WebSocket updates according to the source.

Recommended behavior:

```text
load authoritative report on request
```

with optional caching for aggregate performance.

If new commission entries arrive while the Admin is viewing the page, the page may refresh manually or according to application convention.

---

# 66. Caching

Aggregate financial reporting can become expensive.

Caching is permitted where needed, but must:

- be scoped by report parameters
- have clear invalidation/freshness behavior
- not cause persistent mismatch with the financial ledger
- not mix data across Admin scopes

Exact cache duration is not defined.

---

# 67. Large Reports

`Admin.md` explicitly says large financial exports may require:

```text
background job processing
```

to avoid blocking the main request.

Therefore, export generation should be designed so large report creation can run asynchronously.

---

# 68. Export Formats

`Admin.md` gives examples:

```text
CSV
PDF
```

Therefore, Reports Overview may support:

```text
CSV export
PDF export
```

These are source-supported formats.

---

# 69. CSV Export

CSV is appropriate for machine-readable detailed financial data.

Recommended contents:

```text
report period
financial entry date
reference
revenue type
source reference
amount
currency
```

Optional safe related entity fields may be included.

Do not export unnecessary PII.

---

# 70. PDF Export

PDF is appropriate for human-readable financial summary/reporting.

Recommended sections:

```text
AISLEY Reports Overview
report period
generated timestamp
summary totals
revenue breakdown
trend/table summary
```

A detailed ledger may be included if practical.

---

# 71. Export Scope

An export should reflect the Admin's current report filters.

Example:

```text
Monthly
August 2026
Revenue Type: Per-Order Platform Fee
```

Export should not silently switch to all-time/all-revenue data.

---

# 72. Export Authorization

Creating or retrieving a financial export must require Admin authorization.

If generated files are stored temporarily:

- use protected/private storage
- use authorized/signed retrieval
- avoid public permanent URLs
- expire files according to the application's retention policy

---

# 73. Export Job Model

Recommended conceptual lifecycle:

```text
REQUESTED
PROCESSING
COMPLETED
FAILED
```

The exact state names are implementation decisions.

---

# 74. Export Workflow

Conceptually:

```text
Admin selects Export
        ↓
backend validates permissions + filters
        ↓
small report?
    ├── yes → generate directly if safe
    └── no  → queue export job
                  ↓
              generate file
                  ↓
              mark completed
                  ↓
              make protected download available
```

`Admin.md` specifically supports background processing for large exports.

---

# 75. Export File Integrity

An export should preserve:

```text
selected date period
selected filters
generation timestamp
currency
```

so the file remains understandable outside the browser.

---

# 76. Export Naming

Recommended human-readable pattern:

```text
aisley-platform-report-YYYY-MM-DD.csv
aisley-platform-report-YYYY-MM.pdf
```

Exact naming is implementation-defined.

Avoid including sensitive user data in filenames.

---

# 77. Export Failure

If an export job fails:

```text
report page remains usable
export status = failed
Admin may retry
```

A failed export must not invalidate the underlying financial report.

---

# 78. Export Retention

The source does not define how long generated report files remain downloadable.

Use project storage policy or make it configurable.

Do not retain sensitive exports indefinitely without a policy.

---

# 79. Admin Permissions

Reports Overview should be compatible with custom Admin permissions.

Conceptual capabilities:

```text
view financial reports
view report ledger
export financial reports
```

These are conceptual only.

Exact permission keys belong to the shared Admin authorization model.

---

# 80. Read-Only Nature

Reports Overview is primarily read-only.

Normal report viewing must not mutate:

```text
Orders
Transactions
subscriptions
commission values
```

Generating an export may create an export-job record, but does not change financial state.

---

# 81. System Audit Logs

`Admin.md` defines System Audit Logs for Admin operations.

Financial report viewing is read-only, while report export creation is an Admin operation.

Possible audit events:

```text
FINANCIAL_REPORT_EXPORTED
```

Whether ordinary report views are audited is not defined.

Do not require logging every page view unless the security policy says so.

---

# 82. Financial Data Privacy

Reports may reference commercial and user transaction data.

The report must avoid unnecessarily exposing:

```text
full Buyer address
payment credentials
card/bank data
passwords
auth tokens
unrelated Seller PII
Courier private information
```

Use references and aggregate values wherever sufficient.

---

# 83. Transaction Reference Safety

The UI should show platform-safe references:

```text
Order reference
Transaction reference
Subscription reference
```

not payment processor secrets or raw tokens.

---

# 84. Recommended Summary API

Conceptual:

```http
GET /api/admin/reports/overview
```

Possible parameters:

```text
period=daily|weekly|monthly
from
to
revenue_type
logistics_id
```

Exact route/query conventions should follow the repository.

---

# 85. Recommended Summary Response

Conceptual only:

```json
{
  "period": {
    "type": "monthly",
    "from": "2026-08-01",
    "to": "2026-08-31"
  },
  "currency": "PHP",
  "totals": {
    "platform_revenue": 0,
    "subscription_revenue": 0,
    "per_order_fee_revenue": 0,
    "billable_orders": 0
  },
  "series": []
}
```

Do not force this exact schema if the repository uses another convention.

---

# 86. Recommended Trend Point

Conceptual:

```json
{
  "period_start": "2026-08-01",
  "period_end": "2026-08-01",
  "subscription_revenue": 0,
  "per_order_fee_revenue": 0,
  "platform_revenue": 0
}
```

---

# 87. Recommended Ledger API

Conceptual:

```http
GET /api/admin/reports/revenue
```

Possible parameters:

```text
from
to
revenue_type
logistics_id
search
page
per_page
sort
```

Response should be paginated.

---

# 88. Recommended Ledger Row

Conceptual:

```json
{
  "id": "revenue-entry-id",
  "reference": "REV-...",
  "revenue_type": "PER_ORDER_PLATFORM_FEE",
  "source": {
    "type": "ORDER",
    "id": "order-id",
    "reference": "ORDER-..."
  },
  "amount": "10.00",
  "currency": "PHP",
  "recognized_at": "timestamp"
}
```

For subscriptions:

```json
{
  "revenue_type": "LOGISTICS_SUBSCRIPTION",
  "source": {
    "type": "SUBSCRIPTION",
    "id": "subscription-id"
  }
}
```

---

# 89. Recommended Export API

Conceptual:

```http
POST /api/admin/reports/exports
```

Payload:

```json
{
  "format": "CSV",
  "period": "monthly",
  "from": "2026-08-01",
  "to": "2026-08-31",
  "filters": {}
}
```

Backend:

```text
authorize
validate filters
create export job
generate sync/async as appropriate
store protected file
return export status/reference
```

---

# 90. Export Status API

Conceptual:

```http
GET /api/admin/reports/exports/{exportId}
```

Returns:

```text
status
format
requested filters
created time
completed time
protected download availability
failure message if safe
```

---

# 91. Aggregate Query Requirements

The report should aggregate at the database/service layer.

Avoid:

```text
fetch thousands of transactions
calculate totals in React
```

Prefer:

```text
SUM(...)
COUNT(...)
GROUP BY period/revenue type
```

or reporting ledger/service equivalents.

---

# 92. Indexing

Frequent report filters suggest indexes on fields such as:

```text
recognized_at
revenue_type
source_type
logistics_id
order_id
subscription_id
```

depending on final schema.

Do not add redundant indexes without reviewing existing database design.

---

# 93. Query Consistency

All report components for a request should use the same period boundaries.

For example:

```text
KPI total
trend
breakdown
ledger
```

must not use subtly different timezone/date interpretations.

---

# 94. Timezone

The source does not define the accounting/reporting timezone.

The system must establish one canonical interpretation for:

```text
day
week
month
```

and use it consistently.

Do not let browser locale silently change financial totals.

---

# 95. Period Boundary Example

If a reporting timezone is defined, a monthly report should use that timezone consistently:

```text
2026-08-01 00:00
through
2026-08-31 23:59:59...
```

or an equivalent half-open interval:

```text
[2026-08-01, 2026-09-01)
```

Half-open ranges are recommended internally to avoid boundary duplication.

---

# 96. Zero Data

If there is no platform revenue in the selected period:

```text
Total Platform Commission   ₱0.00
Subscription Revenue        ₱0.00
Per-Order Platform Fees     ₱0.00
Billable Orders             0
```

This is valid financial data, not an error.

---

# 97. Partial Data Failure

If the summary loads but the detailed ledger fails:

- preserve the summary
- show a local ledger error
- allow retry

If the financial source of truth is unavailable, do not render guessed totals.

---

# 98. Loading State

While reports load:

- render Admin shell
- show skeletons/placeholders
- preserve selected filters
- do not show fake financial numbers

---

# 99. Error State

Handle:

```text
report summary failure
trend failure
ledger failure
export failure
expired session
forbidden permission
invalid date range
invalid period
missing financial source
```

Errors must not reveal SQL, payment secrets, or sensitive ledger internals.

---

# 100. Stale Data

If reporting uses cached or asynchronously aggregated data, the UI should be capable of indicating:

```text
last updated
```

when necessary.

The source does not explicitly require a stale-data timestamp, so this is optional unless caching creates noticeable delay.

---

# 101. Report Freshness

Reports should represent the latest authoritative recognized financial entries available at query time.

Do not include uncommitted/failed transactions as revenue.

The exact definition of "recognized" remains an open accounting rule.

---

# 102. Subscription Flow Relationship

`app.md` defines Logistics auth flow:

```text
register
→ Admin approved
→ email
→ sign in
→ subscription
```

Therefore:

```text
Logistics registration APPROVED
    ≠
subscription revenue
```

Reports must only record subscription revenue when the subscription/billing system has actually recognized a charge/payment according to its future rules.

---

# 103. Account Approval Boundary

Reports Overview must not infer subscription revenue merely from:

```text
Logistics account approved
```

Account Approval and subscription billing are separate stages.

---

# 104. Order Flow Relationship

AISLEY order flow:

```text
customer order
→ seller approved
→ seller packed
→ Logistics
→ delivered
```

Reports Overview may use Order status for commission recognition if the final financial rule requires it.

The reporting module itself must not change the Order state.

---

# 105. Logistics Transfer/Dispatch Boundary

Operational scanning:

```text
waybill
sorted
transfer
dispatch
```

belongs to Logistics.

Reports Overview may reference these stages only if required to determine a defined billable event.

It must not become a Logistics operations dashboard.

---

# 106. Per-Order Fee Double-Counting Protection

An order should not create multiple identical platform fees merely because it passes through multiple Logistics states.

Recommended invariant:

```text
one billable fee event per applicable order
```

under the current documented model.

The exact uniqueness key should align with the final billing rule.

---

# 107. Subscription Double-Counting Protection

Each recognized subscription charge should contribute once.

Do not count:

```text
subscription active state
```

on every report query as repeated revenue.

Use actual billing/recognized entries.

---

# 108. Multi-Seller Orders

The source docs describe a multi-vendor marketplace but do not define whether one checkout can create:

```text
one platform Order
multiple seller Orders/suborders
```

This matters to:

```text
₱10 per order
```

The meaning of "order" must be clarified before billing implementation.

Reports Overview must use the same order unit as the authoritative commission engine.

---

# 109. Logistics Assignment

If one order changes Logistics provider, the source does not define which provider's SaaS/order fee relationship applies.

This is an open business rule.

The report should reflect the authoritative charged ledger entry rather than attempting to infer from current assignment.

---

# 110. Vouchers and Discounts

Buyer checkout supports:

```text
vouchers
discounts
```

The source does not say these affect the fixed ₱10 platform fee.

Do not reduce/increase platform fee based on voucher value unless a business rule explicitly does so.

---

# 111. Shipping Discounts

Seller features mention promotions and possibly free-shipping incentives.

The source does not define how such promotions affect:

```text
Logistics shipping commission
AISLEY platform fee
```

Reports Overview must use recorded authoritative amounts.

---

# 112. Admin-Wide Vouchers

`app.md` says Admin creates app-wide vouchers.

The source does not define whether AISLEY absorbs voucher cost and whether that should appear in financial reports.

Therefore, voucher subsidy/cost is outside current Reports Overview commission calculations.

---

# 113. Gross Marketplace Volume

Admin Dashboard may eventually want marketplace activity metrics.

But `Admin.md` Reports Overview specifically focuses on:

```text
platform commission / revenue
```

Gross Merchandise Value (GMV) is not explicitly required.

Do not treat GMV as required for MVP.

It can be added later with a formal definition.

---

# 114. Profit

The report calculates platform revenue/commission, not net profit.

Do not label:

```text
Platform Commission
```

as:

```text
Net Profit
```

without expenses/taxes/cost rules.

---

# 115. Commission Terminology

The source uses:

```text
platform commission
revenue generated by platform
commission fees
```

Use these terms consistently.

Recommended UI terminology:

```text
Platform Commission
Subscription Revenue
Per-Order Platform Fees
```

Avoid ambiguous:

```text
Admin Earnings
```

because the money belongs to the platform/business, not personally to the logged-in Admin.

---

# 116. Admin Identity

The phrase in `Admin.md`:

```text
how much total did that admin got for the commission
```

should be interpreted in system context as:

```text
how much commission the platform generated
```

not commission personally earned by an individual Admin account.

No source rule defines individual Admin compensation.

---

# 117. Report Ownership

Reports are platform-wide unless Admin permissions later scope them.

Do not filter commission by:

```text
logged-in Admin user id
```

unless the future partner/admin permission model explicitly assigns financial scopes.

---

# 118. Partner / Scoped Admin Future Support

`app.md` says the initial Admin can:

```text
create partners
add Admins with custom permissions
```

The exact financial data scope for partner Admins is undefined.

The report API should be authorization-ready so future policies can restrict data if needed.

---

# 119. Report Export Auditability

Exports may contain sensitive commercial data.

Recommended record:

```text
requested_by
requested_at
filters
format
status
file reference
```

This supports traceability without altering financial entries.

---

# 120. Export PII Minimization

Detailed exports should use identifiers and business references rather than dumping full user profiles.

Examples:

```text
Order #12345
Logistics: Company Name
Revenue Type: PER_ORDER_PLATFORM_FEE
Amount: ₱10.00
```

No need for Buyer address or Courier phone number.

---

# 121. CSV Numerical Integrity

CSV monetary values should be exported in an unambiguous decimal form.

Example:

```text
10.00
```

with a currency column:

```text
PHP
```

Avoid locale-specific formatting that makes machine import ambiguous.

---

# 122. PDF Numerical Formatting

PDF human-readable values may use:

```text
₱10.00
₱1,234.56
```

consistent with platform formatting.

---

# 123. Report Metadata

Every export should include or imply:

```text
system: AISLEY
report type
report period
generated timestamp
currency
applied filters
```

---

# 124. Report Versioning

The source does not require versioned report formats.

If financial rules change, generated historical exports should remain unchanged rather than regenerating silently with new formulas.

---

# 125. Security Requirements

All financial report endpoints must:

- require authenticated Admin session
- enforce financial-report permissions
- use backend aggregation
- protect transaction/subscription data
- avoid exposing payment secrets
- validate date filters
- validate pagination bounds
- validate revenue types
- prevent IDOR on transaction/export detail
- protect generated export files
- use CSRF protection for export creation if it is a state-changing web request
- avoid client-side authoritative financial calculation
- avoid trusting client-supplied commission amounts
- avoid exposing raw SQL/errors
- use safe money types

---

# 126. Frontend Security

The frontend must not:

- calculate authoritative platform revenue from arbitrary displayed values
- accept a user-edited fee amount as truth
- expose protected export URLs permanently
- cache sensitive financial reports in insecure persistent browser storage unnecessarily
- reveal hidden financial fields through client payloads when permission is absent

---

# 127. Backend Calculation Ownership

Authoritative calculation belongs on the backend/domain layer.

Conceptually:

```text
PlatformRevenueService
    calculateSummary(...)
    calculateSeries(...)
    queryLedger(...)
```

The React/Next.js frontend formats and visualizes returned values.

---

# 128. Shared Financial Logic

Avoid duplicate formulas across:

```text
Dashboard
Reports Overview
exports
future scheduled reports
```

All should call shared financial services or query the same authoritative ledger.

---

# 129. Testing Money

Use exact assertions.

Example:

```text
3 applicable orders × ₱10
= ₱30
```

Do not use approximate floating-point comparisons for exact currency logic.

---

# 130. MVP Scope

## Required for MVP

- authenticated Admin-only Reports Overview
- `status: Draft` specification-compatible implementation
- daily reporting
- weekly reporting
- monthly reporting
- Total Platform Commission
- Logistics Subscription Revenue
- Per-Order Platform Fee Revenue
- billable/applicable order count if billing unit is defined
- platform revenue breakdown
- temporal commission trend
- paginated detailed platform-revenue ledger
- date/period filtering
- Revenue Type filtering
- PHP/₱ formatting
- Dashboard commission integration
- authoritative shared calculation logic
- shipping-fee exclusion from platform commission
- Seller/Courier revenue scope separation
- CSV export
- PDF export if current implementation scope includes both source-supported formats
- background export generation for large files
- loading states
- zero-data states
- error states
- authorization
- PII minimization
- tests for financial boundaries

## Not Required for MVP

- GMV
- net platform profit
- tax/VAT reports
- expenses
- forecasting
- budgets
- refunds
- chargebacks
- payout reconciliation
- seller payouts
- courier payouts
- Logistics payouts
- bank reconciliation
- payment processor reconciliation
- multi-currency
- scheduled email reports
- partner-specific financial scopes
- financial adjustments UI
- accounting journal
- invoices
- subscription plan management

---

# 131. Functional Acceptance Criteria

## AC-01 — Admin Access

Given an authorized authenticated Admin, when Reports Overview is opened, the Admin can view platform financial reporting.

## AC-02 — Guest Denied

Given no valid Admin session exists, financial report endpoints are inaccessible.

## AC-03 — Permission Denied

Given an authenticated Admin lacks financial report permission, the backend denies protected report data regardless of frontend visibility.

## AC-04 — Daily Report

Given recognized platform revenue exists, the Admin can view platform commission aggregated for a daily reporting period.

## AC-05 — Weekly Report

Given recognized platform revenue exists, the Admin can view platform commission aggregated for a weekly reporting period.

## AC-06 — Monthly Report

Given recognized platform revenue exists, the Admin can view platform commission aggregated for a monthly reporting period.

## AC-07 — Platform Total

Given subscription and per-order revenue entries exist in the selected period, Total Platform Commission equals their authoritative recognized sum.

## AC-08 — Subscription Revenue

Given recognized Logistics subscription revenue exists, it is included in the Subscription Revenue component.

## AC-09 — Per-Order Fee

Given an order has an authoritative recognized AISLEY order-fee entry, its recorded platform fee contributes to Per-Order Platform Fee Revenue.

## AC-10 — Documented Order Fee

Given the current business rule charges ₱10 for an applicable order, a recognized applicable order can contribute ₱10 to platform fee revenue.

## AC-11 — Shipping Fee Excluded

Given an order contains the default ₱50 shipping fee, Reports Overview does not add that ₱50 to AISLEY Platform Commission under the current documented model.

## AC-12 — Logistics Shipping Revenue Separation

Given shipping fees are displayed as context, they are explicitly separated from platform commission.

## AC-13 — Seller Sales Excluded

Given Seller gross sales exist, the Admin platform commission total does not treat the Seller's gross product sales as AISLEY revenue.

## AC-14 — Courier Earnings Excluded

Given Courier delivery earnings/tips exist, those values are not automatically included in AISLEY Platform Commission.

## AC-15 — Buyer Total Excluded

Given a Buyer paid an order total containing products, discounts, and shipping, the full order total is not treated as AISLEY platform revenue.

## AC-16 — Approved Logistics Not Revenue

Given a Logistics account was Admin-approved but no subscription charge has been recognized, Reports Overview does not invent subscription revenue from approval status.

## AC-17 — Subscription Amount Source

Given subscription pricing is not hardcoded by the report, subscription revenue comes from authoritative billing/subscription records.

## AC-18 — Order Fee Source

Given a historical order has a recorded charged fee, Reports Overview uses the stored financial amount rather than recalculating it from today's configuration.

## AC-19 — Historical Fee Stability

Given the configured per-order fee changes in the future, previously recognized financial entries remain historically unchanged.

## AC-20 — No Duplicate Order Fee

Given an order passes through multiple Logistics states, the same billable event does not create duplicate platform fee revenue.

## AC-21 — No Duplicate Subscription Charge

Given a subscription remains active for a period, it is not repeatedly counted as new revenue unless an actual billing/recognition event exists.

## AC-22 — Dashboard Consistency

Given Dashboard and Reports Overview use the same period and scope, their Platform Commission values reconcile.

## AC-23 — Trend

Given revenue exists across multiple time buckets, the report provides a correctly grouped temporal trend.

## AC-24 — Revenue Breakdown

Given more than one revenue category contributes to the total, the Admin can see the amount attributable to each source.

## AC-25 — Ledger

Given platform revenue entries exist, the Admin can inspect a paginated ledger of contributing entries.

## AC-26 — Ledger Source Link

Given a per-order fee entry is displayed, it can reference its source Order where authorized.

## AC-27 — Subscription Source Link

Given subscription revenue is displayed, it can reference the associated Logistics subscription/account where authorized.

## AC-28 — Zero Data

Given no recognized revenue exists in a period, the report displays ₱0.00/0 values rather than an error.

## AC-29 — CSV Export

Given an authorized Admin requests a CSV export for selected report filters, the resulting export reflects those filters and uses protected retrieval.

## AC-30 — PDF Export

Given PDF export is enabled, an authorized Admin can generate a human-readable report reflecting the selected filters.

## AC-31 — Large Export

Given an export is too large for safe synchronous generation, it can be processed through a background job without blocking the main Admin request.

## AC-32 — Export Failure

Given report export generation fails, the financial report remains usable and the export is marked failed rather than presenting an invalid file.

## AC-33 — Export Protection

Given a financial export exists, an unauthorized user cannot retrieve it by guessing its identifier or storage URL.

## AC-34 — PII Minimization

Given report data is returned, it excludes unrelated Buyer addresses, payment credentials, passwords, session identifiers, and other unnecessary sensitive fields.

## AC-35 — Server-Side Calculation

Given report data is requested, authoritative totals are calculated on the backend rather than trusted from client-provided amounts.

## AC-36 — Same Period Boundaries

Given KPI, chart, breakdown, and ledger represent the same selected period, they use consistent timezone/date boundaries.

## AC-37 — Canceled Order Rule Not Invented

Given commission behavior for canceled orders has not yet been defined, the implementation does not silently establish a permanent billing rule without the authoritative commission engine/business decision.

## AC-38 — Refund Rule Not Invented

Given refund commission behavior is undefined, Reports Overview does not create refund/clawback adjustments on its own.

## AC-39 — Report Is Read-Only

Given an Admin views or filters Reports Overview, underlying Orders/Transactions/subscriptions are not modified.

## AC-40 — Money Precision

Given monetary values are aggregated, calculations use an exact monetary representation and do not introduce binary floating-point rounding errors.

---

# 132. Suggested Backend Tests

Test:

- guest cannot access Admin reports
- non-Admin cannot access Admin reports
- permission-restricted Admin cannot access financial reports
- daily aggregation returns correct totals
- weekly aggregation returns correct totals
- monthly aggregation returns correct totals
- subscription revenue contributes to platform total
- per-order fee revenue contributes to platform total
- default ₱50 shipping fee is excluded from platform commission
- Seller gross sale is excluded from platform revenue
- Courier earnings are excluded from platform revenue
- Buyer total payment is not used as platform revenue
- Logistics approval without billing does not create subscription revenue
- historical fee records remain stable after fee config changes
- repeated Logistics state changes do not duplicate fee entry
- active subscription state does not duplicate recognized charges
- ledger is paginated
- revenue-type filter works
- date filter uses consistent boundaries
- report summary reconciles with ledger sum
- Dashboard commission reconciles with report service
- CSV export uses selected filters
- PDF export uses selected filters if enabled
- large export can queue job
- export file access requires authorization
- export failure does not corrupt financial ledger
- report endpoint does not expose payment secrets/password/session data
- monetary values preserve exact precision
- zero-data report returns zero totals
- invalid period/filter is rejected safely

---

# 133. Suggested Frontend Tests

Where frontend testing infrastructure exists, test:

- Reports Overview loads
- loading state renders
- zero-data state renders
- total commission renders
- subscription revenue renders
- per-order fee revenue renders
- period selector changes request
- daily view renders
- weekly view renders
- monthly view renders
- trend chart renders returned series
- breakdown labels platform revenue sources correctly
- shipping fee is not displayed as platform commission
- ledger pagination works
- revenue-type filter works
- report error state does not display fake totals
- CSV export action preserves filters
- PDF export action preserves filters if supported
- async export status is represented correctly
- failed export can be retried if UI supports retry
- unauthorized state hides financial data
- PHP values format consistently
- charts have accessible textual values
- narrow viewport remains usable

---

# 134. Open Decisions

The current AISLEY source documents do not define:

1. exact Logistics base subscription amount
2. subscription billing interval
3. subscription plans/tiers
4. trial period
5. subscription discounts
6. subscription proration
7. subscription cancellation behavior
8. subscription failed-payment behavior
9. exact per-order commission recognition event
10. meaning of "order" in a multi-vendor checkout/suborder architecture
11. whether canceled orders incur the ₱10 fee
12. whether failed-payment orders incur the ₱10 fee
13. whether returned orders reverse the fee
14. whether refunded orders reverse the fee
15. whether partially refunded orders adjust the fee
16. whether fee is charged on seller confirmation, pickup, delivery, or settlement
17. whether Logistics reassignment affects fee ownership
18. whether the platform fee can be waived
19. whether different Logistics plans have different per-order fees
20. whether historical fee rate/version is explicitly stored
21. tax/VAT treatment
22. payment gateway fees
23. settlement timing
24. financial recognition timezone
25. week-start convention
26. report default period
27. whether custom date range is required
28. whether Logistics organization filter is required
29. whether GMV is required
30. whether order count is a KPI
31. whether subscription count is a KPI
32. whether shipping revenue should appear as non-platform context
33. whether Seller fees should reconcile through a shared ledger
34. export size threshold for background processing
35. CSV exact columns
36. PDF exact layout
37. export retention duration
38. whether exports are audited
39. whether ordinary report views are audited
40. whether scheduled recurring reports are required
41. whether reports can be emailed automatically
42. whether reports require approval/sign-off
43. whether partner Admins have scoped financial visibility
44. exact Admin financial permission keys
45. exact report API routes
46. exact financial ledger schema
47. whether manual financial adjustments exist
48. whether adjustment/reversal entries exist
49. accounting period close behavior
50. whether historical periods can be locked
51. whether report cache is used
52. report cache lifetime
53. whether report displays `last updated`
54. whether PDF export is mandatory for MVP or deferred
55. whether generated exports use synchronous or asynchronous processing at specific sizes
56. whether subscription invoices/receipts are part of the report
57. whether Admin-wide voucher subsidies are platform costs
58. whether platform promotions reduce commission revenue
59. whether commission is recognized gross or net of discounts
60. whether the ₱50 shipping fee is configurable per Logistics organization

These should be resolved in the appropriate billing/transactions specifications before implementation treats them as fixed financial rules.

---

# 135. Source Traceability

## From `Admin.md`

Reports Overview directly derives:

```text
Core Value:
Calculate platform commission reports.

Expanded Definition:
financial analytics and reporting
calculate and aggregate revenue generated by the platform
track commission fees extracted from user transactions
daily filtering
weekly filtering
monthly filtering

System Context:
complex aggregation queries
Transactions or Orders
large financial exports
CSV/PDF
background job processing
```

Reports Overview also supplies financial data to:

```text
Admin Dashboard
```

and must respect:

```text
System Audit Logs
Admin custom permissions
```

where applicable.

---

## From `app.md`

The platform financial model derives:

```text
Admin Commission Flow

Logistics SaaS platform
    base subscription
    +
    ₱10 per order

Shipping fee
    default ₱50
    Logistics commission
```

This establishes the core financial boundary:

```text
AISLEY platform revenue
    = subscription + platform order fee

Logistics shipping commission
    = separate
```

`app.md` also establishes:

```text
Logistics approval
→ email
→ sign in
→ subscription
```

so registration approval itself must not be counted as subscription revenue.

---

## From `Seller.md`

Seller has a separate:

```text
Generate Report
```

feature for:

```text
gross sales
net profits
platform fees
shop performance
```

using seller-specific Transactions data.

This establishes that Seller financial analytics and Admin platform commission analytics are separate scopes.

Seller Dashboard also contains seller revenue/order metrics, which must not be mistaken for Admin/platform revenue.

---

## From `Courier.md`

Courier has:

```text
Profit Dashboard
Earnings & Goal Tracker
Digital Tipping & Feedback
```

based on Courier delivery earnings.

These earnings are Courier-scoped and must not be included automatically in AISLEY platform commission.

---

## From `Buyer.md`

Buyer checkout includes:

```text
product totals
vouchers
discounts
shipping
payment method
final order
```

The total Buyer payment is therefore a transaction/order amount, not automatically platform revenue.

Reports Overview must extract only the documented platform revenue components.

---

## From `Logistics.md`

Logistics owns operational fulfillment:

```text
seller-confirmed order queue
rider deployment
order status updates
waybill/manifest operations
courier capacity
```

Reports Overview may reference authoritative Order/Logistics records for revenue attribution, but it must not become an operational dispatch dashboard.

---

# 136. Final Feature Definition

AISLEY Reports Overview is:

```text
an Admin-only
platform financial reporting system

that calculates:

    Logistics Subscription Revenue
    +
    Per-Order AISLEY Platform Fees
    --------------------------------
    Total Platform Commission

while explicitly excluding:

    Seller gross sales
    Buyer order totals
    Logistics-owned shipping commission
    Courier earnings/tips

and provides:

    daily reports
    weekly reports
    monthly reports
    financial KPIs
    commission trend
    revenue breakdown
    detailed revenue ledger
    CSV/PDF export
    background processing for large exports

using:

    authoritative Transactions / Orders
    authoritative subscription billing data
    shared platform revenue logic

so that:

    Dashboard totals
    Reports Overview totals
    and generated exports

all reconcile to the same source of truth.
```

The central financial rule from the current AISLEY documentation is:

```text
AISLEY commission
    =
    Logistics base subscription
    +
    ₱10 per applicable order

while:

    default ₱50 shipping fee
    belongs to Logistics commission
    and is not AISLEY platform revenue.
```

Any change to that financial model should update the authoritative commission/billing rules first, with Reports Overview consuming those rules rather than embedding its own independent formula.
