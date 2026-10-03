---
role: Courier/Rider
feature: Profit Dashboard
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Flutter Courier Mobile Application / Courier Earnings Overview
source_coverage: Courier.md, app.md
---
# Profit Dashboard Specification
## 1. Purpose
Profit Dashboard is AISLEY's Courier financial-overview feature for showing earnings generated from completed delivery work.
`Courier.md` defines:
```text
Core Value:
Displays profit.
```
Expanded definition:
```text
A financial overview
tailored for the rider.

It aggregates earnings
derived from delivery fees,

providing transparency
on the courier's generated income
over specific periods.
```
System context:
```text
Queries a dedicated ledger
or earnings table,

calculating sums
of transaction values

strictly tied
to the courier's completed deliveries.
```
This specification treats Profit Dashboard as a read/aggregation surface over authoritative Courier earnings data.
A separate `flow.md` is not required because this feature does not own a payout or settlement lifecycle.
## 2. Primary Actor
Primary actor:
```text
COURIER / RIDER
```
The Courier views the Profit Dashboard through the Flutter mobile application.
## 3. Authentication
Courier mobile authentication follows `app.md`:
```text
credentials + device_name
→ /login

Laravel:
createToken()
→ personal access token

Flutter:
stores token in flutter_secure_storage

Requests:
Authorization: Bearer <token>
```
Every Profit Dashboard request must resolve:
```text
authenticated user_id
+
COURIER role
```
## 4. Identity Rule
AISLEY uses:
```text
unique(email, role)
```
Therefore a same-email Buyer/Seller/Logistics account is a separate logical account.
Profit data must be filtered using the authenticated Courier identity, not email alone.
# Feature Responsibility
## 5. Profit Dashboard Owns
Profit Dashboard owns:
- reading authoritative Courier earnings data
- aggregating earnings by selected period
- showing total generated income
- showing completed-delivery-linked earnings
- presenting earnings summaries/trends where implemented
- showing bounded earning transaction/delivery breakdowns
- filtering strictly by authenticated Courier
- date-range filtering
- loading/empty/error states
- transparency around included earning values
## 6. Profit Dashboard Does Not Own
It does not own:
- setting Courier payout formulas
- shipping-fee configuration
- changing Admin commission
- changing Logistics revenue
- payment settlement
- bank/e-wallet transfer
- payout-method CRUD
- tips
- incentive calculation
- delivery completion
- delivery-task state mutation
- Buyer refunds
- Seller payments
- accounting/tax reporting
unless separately specified.
## 7. Read-Only Boundary
The core feature should:
```text
read
aggregate
summarize
filter
explain
```
It should not mutate delivery or financial settlement state.
# Source Financial Model
## 8. Courier Earnings Source
`Courier.md` states Profit Dashboard should query:
```text
a dedicated ledger
or earnings table
```
## 9. Completed Delivery Constraint
The source explicitly says transaction values are:
```text
strictly tied
to the courier's completed deliveries
```
Therefore baseline earnings should not include unfinished tasks.
## 10. Completed Task Reference
`Courier.md` Delivery History defines completed delivery tasks as:
```text
status = COMPLETED
```
Therefore a Courier earning entry should be traceable to a completed delivery/task where applicable.
## 11. Core Order State
Complete Delivery source uses:
```text
Order = DELIVERED
```
If AISLEY maintains both:
```text
Order.status = DELIVERED
delivery_task.status = COMPLETED
```
the earnings ledger should use the final domain relation selected by implementation.
## 12. No Direct Order-Sum Assumption
Do not calculate Rider earnings merely by summing arbitrary Order totals.
Courier earnings should come from a dedicated financial/earnings record or authoritative earnings calculation service.
# Shipping Fee Boundary
## 13. app.md Shipping Fee
`app.md` defines:
```text
Shipping fee
→ default ₱50
→ where Logistics gets their commission
```
## 14. Courier.md Earnings Wording
`Courier.md` says Courier earnings are:
```text
derived from delivery fees
```
## 15. Important Distinction
Do not assume:
```text
Courier earnings
=
full shipping fee
```
because `app.md` explicitly assigns the default shipping fee revenue to Logistics.
## 16. Recommended Financial Model
Recommended:
```text
completed delivery
→ authoritative Courier earning transaction
→ Profit Dashboard aggregates it
```
The Courier earning amount may be calculated from delivery economics elsewhere.
## 17. Payout Formula
The source does not define:
- Rider base rate
- per-kilometer rate
- per-package rate
- percentage of shipping fee
- fixed delivery payout
- fuel allowance
- surge multiplier
- incentive bonus
- deductions
- penalties
All remain Open Decisions.
## 18. Shipping Fee Display
Whether the dashboard shows:
```text
customer shipping fee
```
separately from:
```text
Courier earning
```
is Open.
If shown, they must be labeled clearly and not conflated.
# Earnings Ledger
## 19. Ledger Requirement
The source permits:
```text
dedicated ledger
or earnings table
```
## 20. Recommended Authority
Recommended:
```text
courier_earnings
```
or equivalent as the authoritative read source for the dashboard.
Exact table/entity name is Open.
## 21. Earnings Record
Conceptual fields may include:
```text
id
courier_id
delivery_task_id
amount
currency
earning_type
earned_at
created_at
```
Exact schema is Open.
## 22. Delivery Link
Where an earning comes from a delivery:
```text
earning record
→ delivery_task_id
```
or equivalent stable relation.
## 23. Immutable Financial History
Recommended:
```text
posted earning record
→ not silently overwritten
```
Corrections should use an explicit adjustment model if required.
Adjustment behavior is Open.
## 24. No Client Authority
The Flutter app must not submit authoritative:
```text
earning amount
profit total
payout formula
```
for dashboard calculations.
# Meaning of "Profit"
## 25. Source Label
The feature is named:
```text
Profit Dashboard
```
and its Core Value says:
```text
Displays profit
```
## 26. Source Calculation
The source actually describes aggregating:
```text
earnings
generated income
transaction values
```
## 27. Profit vs Earnings
Strict accounting profit normally requires expenses/costs.
`Courier.md` does not define Rider expenses.
Therefore this feature should avoid claiming:
```text
net profit
```
unless expenses are actually modeled.
## 28. Recommended UI Terminology
Recommended:
```text
Earnings
Total Earnings
Delivery Earnings
```
within the feature titled Profit Dashboard.
This avoids implying expense-adjusted net profit.
## 29. Expense Tracking
The source does not require:
```text
fuel
maintenance
mobile data
vehicle depreciation
taxes
```
as Rider expenses.
Do not subtract invented costs.
# Period Aggregation
## 30. Source Requirement
The source says income is shown:
```text
over specific periods
```
## 31. Suggested Periods
Reasonable presentation periods may include:
```text
Today
This Week
This Month
Custom Range
```
but exact period presets are not source-defined.
## 32. Backend Date Range
Date filtering should be performed using authoritative earning timestamps.
## 33. Timezone
Date aggregation should use the project's configured/user-facing timezone consistently.
Exact timezone-storage/display policy is Open.
## 34. Inclusive Boundaries
Date-range boundaries should be explicitly defined to avoid double counting.
## 35. Future Earnings
Future-dated ledger entries should not be included in current realized earning periods unless intentionally modeled.
# Core Metrics
## 36. Total Earnings
Required baseline metric:
```text
sum of authoritative Courier earning transactions
for the selected period
```
## 37. Completed Deliveries
Recommended supporting metric:
```text
count of completed deliveries
represented by the earnings period
```
## 38. Average Earnings per Completed Delivery
Optional descriptive metric:
```text
total earnings / completed deliveries
```
if denominator semantics are clear.
## 39. Zero Deliveries
If:
```text
completed deliveries = 0
```
do not display:
```text
NaN
Infinity
```
for averages.
## 40. Tips
Digital Tipping & Feedback is a separate feature.
Whether tips are included in Profit Dashboard total is Open.
## 41. Incentives
Performance/incentive structures are not defined.
Whether future incentives are included in earnings totals is Open.
## 42. Adjustments
Whether deductions/adjustments appear is Open.
# Currency
## 43. Currency Context
`app.md` uses Philippine peso amounts such as:
```text
₱10
₱50
```
which indicates current financial examples use PHP.
## 44. Ledger Currency
Earning records should store a currency or use one clearly defined platform currency.
Exact multi-currency support is Open.
## 45. Money Storage
Recommended:
```text
integer minor units
```
or another precise decimal-money representation.
Do not use binary floating point for authoritative financial calculations.
## 46. Formatting
Display money consistently:
```text
₱1,250.00
```
or according to selected product formatting rules.
# Completed Delivery Integration
## 47. Completion Trigger
Complete Delivery provides the final operational state that makes a delivery eligible for Courier earnings processing.
## 48. Earning Creation Timing
The source does not define whether the earning record is created:
```text
at DELIVERED
at delivery_task COMPLETED
after verification
after settlement
```
Open Decision.
## 49. Recommended Separation
Recommended:
```text
Complete Delivery
→ completion event

Earnings service
→ calculates/posts Courier earning

Profit Dashboard
→ reads earning ledger
```
## 50. No Profit Dashboard Posting
Profit Dashboard should not create earning entries while rendering the page.
# Delivery History Integration
## 51. Delivery History
Delivery History owns:
```text
historical completed jobs
```
## 52. Profit Dashboard Link
An earning row may link to:
```text
Delivery History / completed task detail
```
## 53. Shared Identity
Both features should use the same stable:
```text
delivery_task_id
```
or equivalent.
## 54. Metric Consistency
If Profit Dashboard says:
```text
10 earning-producing completed deliveries
```
but Delivery History shows a different count for the same exact filter, the difference should be explainable by earning eligibility rules.
# Earnings & Goal Tracker Boundary
## 55. Separate Feature
`Courier.md` defines Earnings & Goal Tracker separately.
It allows Couriers to:
```text
set daily or weekly income goals
```
## 56. Profit Dashboard Boundary
Profit Dashboard owns:
```text
actual earnings overview
```
Earnings & Goal Tracker owns:
```text
personal target
progress against target
```
## 57. Shared Earnings Source
Both should consume the same authoritative earnings aggregation.
Avoid duplicated formulas.
# Digital Tipping Boundary
## 58. Tipping Feature
Digital Tipping & Feedback is separate.
## 59. Tip Inclusion
If tips eventually become Courier income, they may appear as:
```text
tip earning type
```
in the ledger.
Exact policy is Open.
## 60. No Tip Processing Here
Profit Dashboard does not process the Buyer payment.
# Performance Metrics Boundary
## 61. Performance Metrics
Performance Metrics owns:
```text
ratings
success rates
average completion times
```
## 62. Financial Metrics
Profit Dashboard owns:
```text
earnings aggregates
```
Do not merge operational performance scores into financial totals.
# Account Management Boundary
## 63. Payout Methods
`Courier.md` Account Management includes:
```text
payout methods
```
## 64. Profit Dashboard
Profit Dashboard may show:
```text
earnings
```
but does not edit payout accounts.
## 65. Payout Status
Whether earnings ledger distinguishes:
```text
earned
pending
payable
paid
```
is not defined.
Open Decision.
# API
## 66. Profit Summary
Conceptual:
```http
GET /api/courier/profit
```
Query example:
```text
?period=this_week
```
## 67. Custom Range
Possible:
```http
GET /api/courier/profit?from=YYYY-MM-DD&to=YYYY-MM-DD
```
## 68. Earnings List
Conceptual:
```http
GET /api/courier/earnings
```
with:
```text
page/cursor
date filters
earning type filters where implemented
```
## 69. Delivery Breakdown
Possible:
```http
GET /api/courier/earnings/{earningId}
```
or navigate through Delivery History.
## 70. Read-Only API
Profit Dashboard core endpoints should be:
```text
GET / read-only
```
## 71. Server Aggregation
The backend computes totals.
The mobile client may format/display values but should not be authoritative for sums.
# Authorization
## 72. Bearer Authentication
Every Profit Dashboard endpoint requires a valid Courier Bearer token.
## 73. Exact Role
Backend verifies:
```text
role = COURIER
```
## 74. Courier Scope
All earnings queries must include the authenticated Courier scope.
## 75. IDOR
Knowing:
```text
earning_id
delivery_task_id
courier_id
```
must not expose another Rider's financial data.
## 76. No Client Courier Filter Authority
Do not accept an arbitrary client:
```text
courier_id
```
as the authoritative filter for a self-service dashboard.
# Financial Privacy
## 77. Sensitive Data
Courier earnings are private financial information.
Only the authenticated Courier and explicitly authorized internal roles/services should access them.
## 78. Payout Credentials
Do not return:
```text
bank account credentials
e-wallet secrets
payment tokens
```
in Profit Dashboard responses.
## 79. Payout Display
If payout destination is ever displayed, use appropriately masked information and Account Management ownership.
## 80. Logs
Avoid placing full financial payloads in production logs.
# Calculation Integrity
## 81. Database Authority
Financial totals must be derived from authoritative records.
## 82. Precision
Use precise money arithmetic.
## 83. Duplicate Earning Records
A single delivery should not accidentally generate duplicate earning transactions because of retries.
## 84. Idempotent Posting Boundary
The earnings-posting service should enforce idempotency.
Profit Dashboard should surface authoritative results, not attempt to deduplicate heuristically on the client.
## 85. Reversal / Correction
If a posted earning is corrected later, use explicit ledger semantics.
Exact adjustment/reversal model is Open.
## 86. Negative Values
Whether negative ledger adjustments are permitted is Open.
If supported, they must be clearly labeled.
# Data Freshness
## 87. Refresh
Earnings should refresh when the user revisits or manually refreshes the dashboard.
## 88. Realtime Requirement
`Courier.md` does not require real-time streaming for Profit Dashboard.
Polling/WebSocket is not mandatory.
## 89. Completion Delay
If earnings are posted asynchronously after delivery completion, the UI should avoid falsely promising immediate availability.
Exact timing is Open.
## 90. Last Updated
Optional:
```text
Last updated <time>
```
# Error Handling
## 91. Summary Failure
If earnings cannot be loaded:
```text
show unavailable/error
```
Do not display:
```text
₱0
```
as if it were authoritative zero.
## 92. Empty State
If valid query returns no earnings:
```text
₱0 earnings
No completed earning entries for this period
```
is appropriate.
## 93. Partial Failure
If total loads but transaction list fails:
```text
show total
+
list error/retry
```
where practical.
## 94. Invalid Date Range
Reject:
```text
from > to
invalid date
excessive range
```
according to API policy.
## 95. Currency Mismatch
If multi-currency is later supported, do not sum currencies without explicit conversion policy.
# Performance
## 96. Aggregate Queries
Use database/server aggregation for sums and counts.
## 97. Indexing
Likely useful indexes:
```text
courier_id
earned_at
delivery_task_id
earning status/type
```
depending on schema.
## 98. Pagination
Earning transaction lists should be paginated/bounded.
## 99. No Full Ledger Download
Initial dashboard load should not fetch the Courier's entire lifetime ledger.
## 100. Cache
Short-lived server caching may be used if financial freshness and authorization remain correct.
# UI
## 101. Recommended Layout
```text
Profit Dashboard
├── Period Selector
├── Total Earnings
├── Completed Deliveries
├── Average per Delivery
└── Earnings Breakdown
```
Optional sections should appear only if implemented.
## 102. Primary Value
The most prominent number should be:
```text
Total Earnings
```
for the selected period.
## 103. Terminology
Prefer:
```text
Earnings
```
over:
```text
Net Profit
```
unless expense accounting is implemented.
## 104. Period Selector
Potential controls:
```text
Today
Week
Month
Custom
```
Exact presets are Open.
## 105. Earnings Breakdown
Recommended row fields:
```text
delivery reference
completion date
earning amount
earning type where applicable
```
## 106. Completed Deliveries
A supporting count helps explain the earning total.
## 107. Trend Chart
A simple earnings-over-time chart is optional.
Not source-required.
## 108. No Misleading Chart
If chart data is incomplete, do not imply full-period coverage.
## 109. Empty State
Example:
```text
No earnings for this period yet.
```
## 110. Error State
Example:
```text
Unable to load earnings.
```
with Retry.
## 111. Accessibility
The Flutter UI should:
- expose totals as text
- not rely on charts alone
- provide screen-reader labels for values
- use accessible date controls
- show currency explicitly
- announce load/error states
# Third-Party Dependencies
## 112. Core Profit Dashboard
No new third-party provider is required.
Core uses:
```text
AISLEY backend
Courier earnings/ledger table
completed delivery relationships
```
## 113. Mapbox
Not required.
## 114. Google Maps
Not required.
## 115. Brevo
Not required.
## 116. SMS / Push
Not required.
## 117. Payment Provider
Profit Dashboard itself does not require a payment/payout provider merely to display earnings.
# Logging / Audit Boundary
## 118. Dashboard Views
Viewing financial summaries should not create delivery-state audit mutations.
## 119. Financial Ledger
Actual earning-posting/correction events should preserve appropriate financial history in the owning ledger service.
## 120. Admin Audit Boundary
Do not automatically dump every dashboard read into Admin System Audit Logs.
# MVP Scope
## 121. Required
- authenticated Courier access
- exact Courier role authorization
- Courier-scoped earnings
- authoritative ledger/earnings source
- completed-delivery linkage
- selected-period aggregation
- total earnings
- completed-delivery count or explainable breakdown
- earning transaction/breakdown list
- date filtering
- precise money arithmetic
- pagination/bounded lists
- loading/empty/error states
- financial privacy
- IDOR protection
- Bearer-token protection
## 122. Recommended
- Today / Week / Month filters
- custom date range
- average earning per completed delivery
- delivery-history links
- clear distinction between Courier earning and shipping fee
- ledger adjustments/reversal-ready design
- last-updated timestamp
- earnings trend visualization
## 123. Not Required
- expense tracking
- true net-profit calculation
- payout processing
- payout-method editing
- shipping-fee editing
- Admin commission logic
- Logistics revenue calculation
- tips
- incentives
- financial goals
- Mapbox
- Google Maps
- Brevo
- SMS
- Push
- new third-party provider
# Acceptance Criteria
## 124. Access
- Missing/invalid token cannot access Profit Dashboard.
- Non-Courier token cannot access Courier earnings.
- Same-email other-role account does not inherit Courier financial access.
- Courier sees only their own earnings.
## 125. Data Source
- Dashboard reads from an authoritative earnings/ledger source.
- Earning values are linked to completed deliveries according to the selected model.
- Mobile client does not authoritatively calculate/post payout amounts.
- Unfinished deliveries are excluded from baseline completed-delivery earnings.
## 126. Aggregation
- Total earnings correctly sum authoritative earning records for the selected period.
- Date filters apply consistently.
- Duplicate joins do not double-count earnings.
- Zero-delivery average does not produce NaN/Infinity.
- Currency values use precise arithmetic.
## 127. Shipping Fee Boundary
- UI does not claim Courier receives the full default ₱50 shipping fee.
- Courier earning and Logistics shipping-fee revenue are not silently conflated.
- Any payout formula remains owned by the financial/earnings service.
## 128. Read-Only Behavior
- Opening Profit Dashboard does not change delivery state.
- Dashboard does not post/settle payouts.
- Dashboard does not edit payout methods.
## 129. Security
- Another Courier's earning IDs cannot be accessed through IDOR.
- Payout credentials are not exposed.
- Bearer token is protected.
- Financial logs avoid unnecessary sensitive payloads.
## 130. Third-Party
- Core Profit Dashboard works without a new third-party provider.
- Mapbox/Google Maps/Brevo/SMS/Push are not required.
- No payout provider is required just to display earnings.
# Tests
## 131. Backend Tests
Test:
- missing token denied
- invalid token denied
- Buyer/Seller/Logistics token denied
- Courier token allowed
- same-email role isolation
- own earnings only
- cross-Courier earning denied
- completed delivery earning included
- unfinished delivery excluded
- selected period sum
- custom date range
- invalid date range
- duplicate row protection
- zero earnings
- zero deliveries
- average calculation if implemented
- precise decimal/minor-unit arithmetic
- earning list pagination
- shipping fee not assumed as Courier payout
- payout credentials absent
- token/security-secret leakage absent
## 132. Flutter Tests
Test:
- Profit Dashboard loads
- total earnings
- completed delivery count
- period selector
- Today filter if implemented
- Week filter if implemented
- Month filter if implemented
- custom range if implemented
- earning breakdown
- Delivery History navigation if implemented
- zero earnings
- loading state
- error state
- retry
- currency formatting
- screen-reader labels
- totals available without chart
- responsive mobile layout
# Open Decisions
## 133. Open Decisions
The current sources do not define:
1. exact earnings table/ledger schema
2. exact Courier payout formula
3. relationship between shipping fee and Rider earning
4. when an earning is posted
5. whether earning posts at `DELIVERED` or task `COMPLETED`
6. whether earning may be pending before becoming payable
7. payout status model
8. whether tips are included
9. whether incentives are included
10. whether deductions are supported
11. adjustment/reversal model
12. whether negative ledger entries are supported
13. exact period presets
14. custom date-range maximum
15. timezone used for period boundaries
16. default currency
17. multi-currency support
18. whether shipping fee is displayed separately
19. whether average earning per delivery is shown
20. whether route/distance affects payout
21. whether vehicle type affects payout
22. whether earnings trend chart is MVP
23. whether earnings update immediately after completion
24. whether completed-delivery count includes zero-earning deliveries
25. exact API routes
26. ledger retention rules
27. export/download requirements
28. tax/reporting requirements
29. whether "Profit Dashboard" should be labeled "Earnings" in the UI
# Final Definition
## 134. Final Definition
AISLEY Profit Dashboard is:
```text
a Courier financial overview
that aggregates authoritative earnings
from completed deliveries
over selected periods.
```
Core model:
```text
completed delivery
→ authoritative Courier earning transaction
→ Courier earnings ledger
→ Profit Dashboard aggregate
```
The dashboard should display:
```text
Total Earnings
+
completed-delivery-linked breakdown
+
period filtering
```
Important AISLEY revenue boundary:
```text
app.md default shipping fee = ₱50
→ Logistics revenue/commission context

Courier earnings
→ must come from an authoritative
Courier earning/payout calculation
```
Therefore:
```text
Courier earning
≠ automatically the full shipping fee
```
Terminology rule:
```text
source feature name = Profit Dashboard

but displayed values are best labeled
Earnings / Generated Income

unless Rider expenses are modeled.
```
Third-party rule:
```text
No new third-party provider
is required for the core Profit Dashboard.
```
