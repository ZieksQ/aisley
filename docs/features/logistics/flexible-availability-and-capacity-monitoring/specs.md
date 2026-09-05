---
role: Logistics
feature: Flexible Availability & Capacity Monitoring
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Logistics Web Application / Courier Availability and Network Capacity
source_coverage: Logistics.md, app.md
---
# Flexible Availability & Capacity Monitoring Specification
## 1. Purpose
Flexible Availability & Capacity Monitoring is AISLEY's Logistics monitoring feature for supporting a gig-economy Courier model without fixed rider shifts.
`Logistics.md` defines:
```text
Core Value:
Allow riders to pick their own schedules
while providing logistics teams
with data on active courier capacity.

Replaces Rider Shift Scheduling.
```
Expanded definition:
```text
A live-monitoring dashboard
reflecting the gig-economy model.

Instead of assigning shifts,
this tool tracks which Couriers
have toggled their status
to Online / Available.

It aggregates this data
to forecast whether
the current online fleet
can handle the active order queue,

allowing Logistics
to trigger surge pricing
or incentives
if demand outpaces
available riders.
```
System context:
```text
Requires a real-time status flag:

Courier.is_online

The dashboard visualizes:

active riders
versus
pending orders

to determine network health.
```
This specification defines the Logistics monitoring surface, source metrics, freshness rules, capacity interpretation, Deploy Rider integration, operational alerts, APIs, security, acceptance criteria, tests, and Open Decisions.
A separate `flow.md` is not required because the feature is primarily read/aggregation/monitoring behavior.
## 2. Primary Actor
Primary actor:
```text
LOGISTICS
```
The Logistics team uses the Logistics web application to monitor rider availability and order demand.
## 3. Related Actor
Related actor:
```text
COURIER
```
Couriers control their own availability by toggling themselves:
```text
Online / Available
```
according to the gig-economy model described in `Logistics.md`.
## 4. Core Principle
This feature replaces:
```text
Rider Shift Scheduling
```
with:
```text
Courier self-selected availability
+
live Logistics monitoring
```
AISLEY should not require fixed Logistics-assigned shifts simply to satisfy this feature.
# Feature Responsibility
## 5. Monitoring Owns
Flexible Availability & Capacity Monitoring owns:
- reading current Courier `is_online` state
- counting active/online Couriers
- reading current pending-order demand
- comparing active Courier capacity with pending demand
- displaying network-health information
- real-time or near-real-time refresh
- bounded Courier-capacity summaries
- demand/capacity trend summaries where supported
- filtering capacity by authorized Logistics scope
- providing availability data to Deploy Rider
- exposing insufficient-capacity conditions
- optionally surfacing actions for future surge/incentive workflows
## 6. Monitoring Does Not Own
It does not own:
- setting Courier work shifts
- forcing Couriers online
- approving Courier accounts
- assigning orders to Couriers
- changing Courier GPS
- route optimization
- vehicle capacity
- Zone/Territory definitions
- Waybill generation
- order-state updates
- defining surge-pricing formulas
- defining incentive payouts
- Courier earnings calculation
unless separately specified.
## 7. Read / Aggregation Boundary
The core dashboard should primarily:
```text
observe
aggregate
compare
signal
navigate
```
It should not silently perform high-impact financial or dispatch mutations.
# Gig-Economy Availability Model
## 8. Rider-Selected Schedule
The source says:
```text
allow riders to pick their own schedules
```
Therefore Logistics should not need to pre-assign working shifts.
## 9. Online / Available Toggle
The source-backed availability signal is:
```text
Courier.is_online
```
with user-facing meaning:
```text
Online / Available
```
## 10. Courier Authority
The Courier is the actor who changes their own online/available state.
The Logistics monitoring dashboard reads that state.
## 11. Logistics Cannot Force Online
This feature must not allow Logistics to silently set an offline Courier to:
```text
Online
```
unless a separate administrative capability is explicitly defined.
## 12. Online Does Not Mean Assigned
Critical rule:
```text
is_online = true
≠
Courier has an order
```
Online state only means the Courier is available for operational consideration according to current policy.
## 13. Online Does Not Guarantee Eligibility
An online Courier may still be ineligible for a specific task because of:
```text
Zone eligibility
vehicle capacity
task capacity
missing GPS
another dispatch constraint
```
Those checks belong primarily to Deploy Rider and related features.
## 14. Offline Courier
If:
```text
is_online = false
```
the Courier should not count as active online capacity for the baseline network-health metric.
# Capacity Metrics
## 15. Required Comparison
The source explicitly requires visualizing:
```text
active riders
versus
pending orders
```
## 16. Active Rider Count
Baseline:
```text
Active Rider Count
=
count of authorized Couriers
where is_online = true
```
subject to current Logistics scope.
## 17. Pending Order Count
The source requires:
```text
pending orders
```
but does not define the exact statuses included.
The pending-demand query must use an explicit, shared Logistics order-scope definition.
Open Decision.
## 18. No Invented Pending Definition
Do not arbitrarily count:
```text
all marketplace orders
```
as pending Logistics demand.
Only Logistics-actionable work should be included once the order-state policy is defined.
## 19. Dashboard Consistency
The pending-order metric should align with the Logistics Dashboard's actionable-order definition.
Avoid:
```text
Logistics Dashboard pending = 20
Capacity Monitoring pending = 35
```
because of incompatible formulas.
## 20. Shared Demand Service
Recommended:
```text
Logistics Dashboard
+
Capacity Monitoring
→ shared order-demand query/service
```
## 21. Active Rider Consistency
Deploy Rider and Capacity Monitoring should use the same authoritative availability state.
Avoid separate:
```text
online flag A
available flag B
dashboard-active flag C
```
without clear domain meaning.
# Network Health
## 22. Purpose
The active-rider vs pending-order comparison is used to:
```text
determine network health
```
## 23. Health Interpretation
The source does not define exact categories such as:
```text
HEALTHY
WARNING
CRITICAL
```
These may be introduced only as configured presentation categories.
## 24. Ratio
A simple descriptive metric may be:
```text
pending orders / active riders
```
but the source does not define this as the authoritative formula.
If displayed, label it transparently.
## 25. Zero Active Riders
If:
```text
active riders = 0
pending orders > 0
```
the dashboard must not produce:
```text
Infinity
NaN
```
Instead show a clear operational state such as:
```text
No active riders available
```
## 26. Zero Demand
If:
```text
pending orders = 0
```
the system should show actual zero demand rather than a warning.
## 27. No False Precision
Network health is an operational signal, not a guaranteed delivery-capacity prediction unless a forecasting model is separately defined.
# Forecasting
## 28. Source Forecast Requirement
The source says the dashboard should help:
```text
forecast whether
the current online fleet
can handle
the active order queue
```
## 29. Forecast Scope
The source does not define a statistical or machine-learning forecasting model.
Therefore MVP may use descriptive capacity comparison without claiming predictive accuracy.
## 30. No AI Requirement
Do not introduce:
```text
machine learning
AI demand prediction
time-series forecasting service
```
as mandatory.
## 31. Recommended MVP Forecast
A practical MVP may show:
```text
current online riders
current pending orders
orders per active rider
recent trend
```
if supported by available data.
This is a recommendation.
## 32. Historical Trend
Historical capacity trend is not explicitly required.
Open Decision.
## 33. Forecast Horizon
The source does not define:
```text
next 15 minutes
next hour
next day
```
Open Decision.
# Surge Pricing / Incentives Boundary
## 34. Source Capability
The source says Logistics may:
```text
trigger surge pricing
or incentives

if demand outpaces
available riders.
```
## 35. Undefined Business Rules
The source does not define:
- demand threshold
- capacity threshold
- surge multiplier
- incentive value
- eligible Couriers
- duration
- approval requirements
- who pays the incentive
- impact on Buyer shipping fees
- impact on Courier earnings
- whether surge/incentives are MVP
Therefore these must remain Open Decisions.
## 36. Monitoring vs Action
Recommended boundary:
```text
Capacity Monitoring
→ identifies capacity shortage

Surge/Incentive feature
→ owns financial/business action
```
## 37. No Automatic Financial Mutation
Do not implement:
```text
pending > active
→ automatically change prices
```
without explicit business rules.
## 38. Action Surface
The monitoring dashboard may eventually show:
```text
Capacity shortage detected
→ Manage Incentive / Surge
```
as navigation.
It should not hide a financial mutation inside a dashboard refresh.
# Real-Time Behavior
## 39. Source Requirement
The source calls this:
```text
live-monitoring dashboard
```
and requires a real-time:
```text
is_online
```
status flag.
## 40. Refresh Model
AISLEY may use:
```text
polling
self-hosted WebSockets
Server-Sent Events
```
or another project-supported mechanism.
## 41. No Required Realtime Vendor
A hosted realtime provider is not required.
## 42. Database Authority
Realtime events are not authoritative by themselves.
The backend/database remains authoritative for:
```text
Courier.is_online
pending order state
```
## 43. Reconnect
If realtime transport disconnects:
```text
reconnect
→ refetch authoritative metrics
```
## 44. Stale Metrics
If refresh fails:
```text
show stale/unavailable indicator
```
Do not present old metrics as guaranteed current.
## 45. Last Updated
Recommended:
```text
Last updated <timestamp>
```
## 46. Manual Refresh
The Logistics user should be able to manually refresh monitoring data.
# Courier Availability Source
## 47. Courier Entity
System context explicitly requires:
```text
Courier.is_online
```
## 48. Boolean Semantics
Baseline:
```text
true
→ Online / Available

false
→ Offline
```
## 49. Additional States
The source does not define states such as:
```text
BUSY
BREAK
UNAVAILABLE
SUSPENDED
```
Do not invent them as required.
## 50. Operational Restrictions
Account suspension/approval should remain separate from `is_online`.
An account restriction should not be represented solely by changing the online flag unless the wider Courier lifecycle defines that behavior.
## 51. Offline Persistence
Whether Couriers are automatically set offline after inactivity, logout, app close, or timeout is not defined.
Open Decision.
## 52. Heartbeat
Whether online state requires a heartbeat/presence timeout is not defined.
Open Decision.
## 53. Stale Online State
If AISLEY later uses heartbeats:
```text
stale heartbeat
→ availability policy
```
must be explicitly defined.
# Pending Demand
## 54. Logistics Demand
Pending orders should represent work that requires or will shortly require Courier capacity.
## 55. Order-State Mapping
Exact statuses are Open.
Potential source-related contexts include orders:
```text
READY_FOR_PICKUP
AT_SORTING_CENTER
awaiting assignment
```
but the final demand set must follow the authoritative Logistics order-state model.
## 56. Double Counting
An order/task must not be counted twice in the same metric because of joins or multiple status-history rows.
## 57. Multi-Package Orders
Whether one order with multiple parcels counts as:
```text
one demand unit
or
multiple delivery tasks
```
is not defined.
Open Decision.
## 58. Multi-Seller Orders
Whether one marketplace order creates multiple Logistics demand units is Open.
## 59. Task vs Order Capacity
If AISLEY introduces a separate delivery-task model:
```text
capacity demand
```
may be better measured in tasks than parent orders.
Open Decision.
# Deploy Rider Integration
## 60. Core Handoff
Deploy Rider consumes current Courier availability.
Conceptually:
```text
Capacity Monitoring / Courier state
→ online Couriers
→ Deploy Rider filters
→ Zone/Fleet/GPS/routing checks
→ dispatch candidates
```
## 61. Authority Boundary
Flexible Availability owns:
```text
network availability view
```
Deploy Rider owns:
```text
specific order-to-Courier decision
```
## 62. No Candidate Ranking
Capacity Monitoring should not independently rank Couriers by proximity.
That belongs to Deploy Rider.
## 63. Capacity Shortage
A network-level shortage does not mean no individual order can be dispatched.
Deploy Rider still evaluates specific candidates.
# Vehicle Fleet Boundary
## 64. Network Capacity vs Vehicle Capacity
Flexible Availability monitors:
```text
active rider capacity
```
Vehicle Fleet Management owns:
```text
vehicle/package capacity
```
Do not treat these as the same metric.
## 65. Advanced Capacity
A future model may weight active capacity by:
```text
vehicle type
vehicle capacity
current workload
```
but this is not required by source.
# Zone Boundary
## 66. Territory Capacity
Zone/Territory Mapping owns:
```text
Courier geographic eligibility
```
## 67. Zone-Level Monitoring
Whether active-rider and pending-order counts can be broken down by zone is not explicitly required.
Recommended future capability.
Open Decision.
## 68. Hub-Level Monitoring
If a Logistics organization has multiple hubs, whether capacity is monitored:
```text
per hub
organization-wide
both
```
is Open.
# Logistics Dashboard Boundary
## 69. Logistics Dashboard
The Logistics Dashboard already owns the main actionable parcel/order queue.
Flexible Availability & Capacity Monitoring owns the:
```text
supply vs demand
```
view.
## 70. Dashboard Preview
The Logistics Dashboard may show a small preview such as:
```text
Online Riders
Pending Orders
Capacity Status
```
with navigation into Capacity Monitoring.
## 71. No Duplication
Both features should use shared metric definitions.
# API
## 72. Monitoring Summary
Conceptual:
```http
GET /api/logistics/capacity
```
Response may include:
```text
active_rider_count
pending_order_count
generated_at
freshness/status
```
## 73. Courier Availability List
Conceptual:
```http
GET /api/logistics/capacity/couriers
```
Possible filters:
```text
online
zone
hub
search
page/cursor
```
only where those concepts are implemented.
## 74. Pending Demand Detail
Conceptual:
```http
GET /api/logistics/capacity/demand
```
or reuse the Logistics Dashboard order endpoint.
## 75. Trend API
If historical trends are added:
```http
GET /api/logistics/capacity/trends
```
Optional.
## 76. No Dashboard Mutation Requirement
Core monitoring APIs should be read-only.
## 77. Courier Online Mutation
The Courier's own mobile/app availability endpoint should be separate.
Conceptual:
```http
POST /api/courier/availability
```
Exact route is outside this Logistics monitoring feature.
# Backend Authority
## 78. Metrics
The backend calculates:
```text
active rider count
pending demand count
network-health metrics
```
The browser must not supply authoritative counts.
## 79. Logistics Scope
Counts must be scoped to the authenticated Logistics organization/context.
## 80. Exact Courier Identity
Courier records use stable IDs and role-aware identity.
Do not aggregate by email.
## 81. Exact Order/Task Identity
Demand records use stable order/task IDs.
# Authorization and Security
## 82. Authentication
Every Logistics monitoring endpoint requires:
```text
authenticated LOGISTICS
```
## 83. Role Check
Same-email Buyer/Seller/Courier/Admin accounts do not receive Logistics access.
## 84. Logistics Isolation
A Logistics account must not view another organization's:
```text
Courier availability
capacity counts
pending-order queue
```
## 85. IDOR
Knowing Courier/order IDs does not bypass scope checks.
## 86. PII Minimization
The monitoring list should expose only operationally necessary Courier data.
Do not expose:
```text
passwords
payout details
unrelated personal data
full location history
```
## 87. Courier GPS
Capacity Monitoring does not need unrestricted live GPS simply to count online Couriers.
Deploy Rider owns location-based candidate decisions.
# Error Handling
## 88. Count Failure
If active-rider count cannot be loaded:
```text
show unavailable
```
not zero.
## 89. Demand Failure
If pending-order count fails:
```text
show unavailable
```
not zero.
## 90. Partial Failure
If one metric loads and another fails, show partial state where practical.
Do not compute a misleading network-health ratio from incomplete data.
## 91. Realtime Failure
If realtime connection fails:
```text
fallback to polling/manual refresh
```
where implemented.
## 92. Stale Online State
If availability freshness cannot be confirmed, the UI should indicate uncertainty rather than claiming exact live capacity.
# Performance
## 93. Aggregate Queries
Active-rider and pending-order counts should use efficient aggregate queries.
## 94. Indexing
Likely useful indexed fields include:
```text
Courier logistics ownership
Courier.is_online
order/task Logistics ownership
order/task status
```
Exact indexes depend on schema.
## 95. Bounded Lists
Courier and demand detail lists must be paginated/bounded.
## 96. Realtime Payload
Realtime events should communicate changed availability/order context rather than broadcasting complete dashboard payloads on every event.
## 97. Cache
Very short-lived caching may be used if freshness requirements are preserved.
Exact TTL is Open.
# UI
## 98. Recommended Layout
```text
Flexible Availability & Capacity Monitoring
├── Network Health Summary
│   ├── Online / Active Riders
│   ├── Pending Orders
│   └── Capacity Indicator
├── Active Courier View
└── Pending Demand View
```
## 99. Primary Metrics
The primary visual comparison should be:
```text
Active Riders
vs
Pending Orders
```
## 100. Network Health Label
If a health label is used, its thresholds must be configurable/defined.
Do not invent a red/yellow/green threshold formula without policy.
## 101. Rider List
Recommended safe information:
```text
Courier identity
Online/Offline
assigned Zone if available
vehicle summary if useful
current task count if defined
```
## 102. Pending Demand List
May link to Logistics Dashboard or relevant order details.
Do not duplicate full order-management functionality.
## 103. Empty States
Examples:
```text
No Couriers are currently online.
No pending Logistics orders.
```
## 104. No Active Riders Warning
If:
```text
0 active riders
+
pending demand
```
show a clear operational warning.
## 105. Refresh Indicator
Show:
```text
last refreshed
live/reconnecting/stale
```
where appropriate.
## 106. Accessibility
The dashboard should:
- provide textual metric values
- not rely on color alone
- label charts/ratios accessibly
- support keyboard navigation
- expose stale/error state textually
- avoid inaccessible live-only visual updates
# Third-Party Dependencies
## 107. Core Monitoring
No new third-party provider is required.
Core functionality can use:
```text
AISLEY backend
database
Courier.is_online
Orders/delivery-task data
polling / self-hosted realtime
```
## 108. Mapbox
Mapbox is not required for basic capacity monitoring.
It belongs to routing/Deploy Rider.
## 109. Google Maps
Google Maps is not required for basic capacity monitoring.
## 110. Brevo
Brevo is not required.
## 111. SMS / Push
No SMS or mobile Push provider is required for the monitoring dashboard.
## 112. Forecasting Vendor
No external forecasting/AI vendor is required.
# Logging / Audit Boundary
## 113. Routine Monitoring
Opening/refreshing the dashboard should not create Admin System Audit Log mutation records.
## 114. Courier Availability History
Whether AISLEY stores historical Online/Offline transitions is not defined.
Open Decision.
## 115. Surge / Incentive Action History
If future surge/incentive actions are implemented, those consequential actions should preserve operational/audit history in their owning feature.
# MVP Scope
## 116. Required
- authenticated Logistics access
- exact Logistics role authorization
- Logistics-scoped Courier availability
- `Courier.is_online`
- active/online Courier count
- pending-order demand count
- active-rider vs pending-order comparison
- live or near-real-time refresh
- manual refresh
- freshness/stale behavior
- efficient bounded queries
- Logistics Dashboard metric consistency
- Deploy Rider availability consistency
- loading/empty/error states
- cross-Logistics isolation
- PII minimization
## 117. Recommended
- network-health presentation
- orders-per-active-rider descriptive metric
- active Courier list
- pending-demand drilldown
- last-updated timestamp
- reconnect/refetch behavior
- short historical trends
- zone/hub breakdown if architecture supports it
- Capacity shortage action/navigation placeholder
## 118. Not Required
- fixed rider shifts
- Logistics-controlled schedules
- forcing Couriers online
- AI/ML forecasting
- external forecasting service
- automatic surge pricing
- automatic incentive payout
- invented demand thresholds
- invented surge multiplier
- vehicle-capacity calculations
- proximity ranking
- Mapbox
- Google Maps
- Brevo
- SMS
- Push
- hosted realtime provider
# Acceptance Criteria
## 119. Access
- Guest cannot access Capacity Monitoring.
- Non-Logistics role cannot access Logistics capacity APIs.
- Same-email other-role account does not inherit access.
- Logistics sees only its own authorized Courier/demand data.
## 120. Availability
- Courier `is_online = true` contributes to active-rider count.
- Courier `is_online = false` does not contribute to baseline active count.
- Logistics monitoring does not force a Courier online.
- Online status does not automatically assign an order.
- Online status does not bypass Zone/Fleet/Deploy Rider eligibility rules.
## 121. Demand
- Pending-order count follows one explicit Logistics demand definition.
- Demand does not count unrelated marketplace orders.
- Duplicate joins/history rows do not double-count one demand unit.
- Logistics Dashboard and Capacity Monitoring use compatible demand rules.
## 122. Network Health
- Dashboard displays active riders and pending orders.
- Capacity comparison handles zero riders safely.
- Failed metrics are shown unavailable rather than misleading zero.
- Incomplete metrics do not produce a false health score.
- Any health thresholds are defined/configured rather than invented.
## 123. Real-Time
- Availability/order changes become visible through polling/realtime refresh.
- Reconnect/refetch restores authoritative state.
- Stale data is identified.
- Realtime event is not treated as more authoritative than backend state.
## 124. Deploy Rider Integration
- Deploy Rider consumes the same authoritative Courier availability state.
- Capacity Monitoring does not independently assign/rank Couriers.
- Specific dispatch still applies Zone/Fleet/GPS/routing rules.
## 125. Surge / Incentive Boundary
- Capacity shortage may be surfaced.
- Monitoring does not automatically change prices or pay incentives without explicit business rules.
- No surge multiplier or threshold is hardcoded from this source.
## 126. Security
- Cross-Logistics Courier/order data is denied.
- PII is minimized.
- Capacity monitoring does not expose unrestricted Courier GPS history.
- No credentials/payment secrets are returned.
## 127. Third-Party
- Core monitoring works without a new third-party provider.
- Mapbox/Google Maps/Brevo/SMS/Push are not required.
- No external AI/forecast provider is required.
# Tests
## 128. Backend Tests
Test:
- guest denied
- Buyer/Seller/Courier denied from Logistics monitoring APIs
- authenticated Logistics allowed
- same-email role isolation
- cross-Logistics isolation
- online Courier counted
- offline Courier excluded
- duplicate Courier rows not double-counted
- pending-order query
- non-actionable orders excluded according to policy
- duplicate order/history rows not double-counted
- zero-rider case
- zero-demand case
- count failure
- partial count failure
- freshness metadata
- pagination
- Deploy Rider uses same availability source
- no PII/security-secret leakage
## 129. Frontend Tests
Test:
- monitoring page loads
- active-rider count
- pending-order count
- network-health summary
- zero active riders
- zero pending demand
- partial/error state
- stale state
- manual refresh
- realtime/polling refresh
- reconnect
- active Courier list if implemented
- demand drilldown if implemented
- no misleading Infinity/NaN
- textual metric labels
- keyboard accessibility
- status not color-only
- responsive layout
# Open Decisions
## 130. Open Decisions
The current sources do not define:
1. exact pending-order statuses
2. order vs delivery-task demand unit
3. multi-package order counting
4. multi-Seller order counting
5. whether Courier `is_online` alone defines active capacity
6. whether busy Couriers remain in active capacity
7. active-task capacity limits
8. automatic offline timeout
9. heartbeat/presence behavior
10. stale-online threshold
11. polling/realtime implementation
12. refresh interval
13. network-health formula
14. health labels/categories
15. health thresholds
16. whether orders-per-rider ratio is shown
17. forecasting method
18. forecast horizon
19. historical trend retention
20. zone-level capacity view
21. hub-level capacity view
22. multi-hub organization aggregation
23. whether vehicle type affects network-capacity estimates
24. whether current workload weights Courier capacity
25. surge-pricing rules
26. incentive rules
27. shortage threshold
28. surge multiplier
29. incentive amount
30. duration/expiry of surge/incentives
31. whether surge/incentive is MVP
32. action authorization/approval
33. Courier availability-history retention
34. exact API routes
# Final Definition
## 131. Final Definition
AISLEY Flexible Availability & Capacity Monitoring is:
```text
a live Logistics monitoring dashboard

for a gig-economy Courier model
without fixed rider shift scheduling.
```
Its source-backed model is:
```text
Courier self-selects:
Online / Available

Logistics monitors:
active online Couriers
vs
pending Logistics orders
```
to understand:
```text
current network health
and whether available rider supply
appears sufficient
for current order demand.
```
Critical boundaries:
```text
Capacity Monitoring
= network supply/demand visibility

Deploy Rider
= specific Courier dispatch

Vehicle Fleet
= vehicle/package capacity

Zone Mapping
= geographic eligibility
```
Surge/incentive rule:
```text
capacity shortage
may justify a future action,

but pricing formulas,
thresholds,
and incentive rules
are not defined by the source.
```
Third-party rule:
```text
No new third-party provider
is required for core monitoring.
```
