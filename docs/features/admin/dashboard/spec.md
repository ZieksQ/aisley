---
feature: Admin Dashboard
system: AISLEY
type: Feature Specification
version: 2.0
status: Draft
scope: Admin Web Application
source_coverage: Admin.md, app.md, current AISLEY Admin feature specifications
---

# Admin Dashboard Specification

## 1. Purpose

The Admin Dashboard is the primary authenticated landing page for AISLEY administrators.
`Admin.md` defines it as:

```text
Core Value:
Overview of platform, display notification.

Expanded Definition:
A centralized command interface that aggregates
platform-wide telemetry,
key performance indicators,
and pending actionable items.

It provides the administrator
with a high-level view of system health
and alerts them to critical notifications
that require immediate attention upon login.

System Context:
Acts as the primary entry point.
Requires aggregate queries across multiple database tables
(users, transactions, reports)
and a real-time or polling mechanism
for incoming notifications.
```

The Dashboard should answer:

```text
What is happening across AISLEY?
What currently requires Admin attention?
What are the most important platform-level KPIs?
Where should the Admin go next?
```

It is an overview and navigation surface, not a replacement for the Admin modules it summarizes.
A separate `flow.md` is not required because the Dashboard is primarily read/aggregation oriented and has no meaningful business state machine of its own.

## 2. Primary User

The primary user is:

```text
ADMIN
```

The Dashboard is available only to authenticated Admin role-accounts.

## 3. Authentication

The Dashboard depends on Admin Auth.
Expected access:

```text
valid Admin session
→ Admin identity resolved
→ authorization context resolved
→ /dashboard
```

If no valid Admin session exists:

```text
/dashboard
→ unauthenticated
→ /login
```

Backend authentication is authoritative.

## 4. Permission Awareness

`app.md` states that AISLEY can add Admins with custom permissions.
Therefore not every Admin necessarily has access to every underlying feature.
The Dashboard must respect the current Admin's permissions.
If an Admin cannot access the underlying feature:

- do not expose protected widget data
- hide or appropriately restrict the widget
- do not display a misleading zero value
  Exact permission behavior is an Open Decision.

## 5. Route

Recommended:

```text
/dashboard
```

This is the default authenticated Admin landing page.

## 6. Core Dashboard Areas

Recommended structure:

```text
Admin Dashboard
├── KPI Summary
│   ├── Pending Registrations
│   ├── Seller Compliance Items
│   ├── Open Complaints / Disputes
│   └── Platform Commission
├── Platform / Order Activity
├── Action Center
└── Admin Notifications Preview
```

Additional widgets should be added only when their metric definition and business value are clear.

## 7. Goals

The Dashboard should:

- provide immediate platform overview
- surface Admin workload
- show important KPIs
- display pending actionable items
- display important Admin notifications
- summarize high-level marketplace/order activity
- summarize platform commission correctly
- link to owning Admin features
- respect Admin permissions
- minimize PII exposure
- load aggregate data efficiently
- support loading, empty, stale, and error states
- tolerate partial widget failures

## 8. Non-Goals

The Dashboard does not itself perform:

- account approval/rejection
- user suspension/restoration
- Seller compliance sanctions
- complaint/dispute decisions
- financial export generation
- announcement publishing
- policy editing
- direct messaging
- Audit Log browsing
- blocklist mutation
- Push/SMS campaign creation
- Admin profile/security changes
- Logistics dispatch
- Courier assignment
- waybill scanning
- Seller inventory management
- Buyer checkout/order management
  The Dashboard may summarize or link to these capabilities.

## 9. Mutation Boundary

Recommended MVP rule:

```text
Dashboard
    preview / summarize / navigate

Owning Feature
    perform high-impact mutation
```

Examples:

```text
Pending Registrations
→ Account Approval

Seller Compliance
→ Seller Compliance

Open Complaints
→ Complaints & Disputes

Platform Commission
→ Reports Overview
```

Do not place destructive or high-impact actions directly inside Dashboard cards unless explicitly required later.

## 10. KPI Summary

The strongest source-grounded Admin KPIs are:

```text
Pending Registrations
Seller Compliance Items
Open Complaints / Disputes
Platform Commission
```

These correspond directly to defined Admin responsibilities.

# Pending Registrations

## 11. Registration Ownership

Current AISLEY registration ownership:

```text
Buyer / Customer
    Admin approval

Seller
    Admin approval

Logistics
    Admin approval

Courier
    Logistics approval
```

Therefore Admin Dashboard registration workload must include only Admin-owned registrations.

## 12. Pending Registration Count

Recommended:

```text
Buyer PENDING
+
Seller PENDING
+
Logistics PENDING
```

Courier registration requests must not be included because Logistics owns Courier approval.

## 13. Registration States

Source-backed states:

```text
PENDING
APPROVED
REJECTED
```

Dashboard count:

```text
status = PENDING
```

for Admin-owned registration roles.

## 14. Registration Card

Recommended:

```text
Pending Registrations
<count>

optional breakdown:
Buyer
Seller
Logistics

View Registrations
```

Do not expose applicant PII or uploaded credentials/documents directly on the KPI card.

## 15. Registration Navigation

The card links to:

```text
Account Approval
```

Prefer a pending filter if the route supports it.

# Seller Compliance

## 16. Compliance Scope

`Admin.md` defines Seller Compliance around:

- product verification
- Seller audits
- warnings
- temporary suspension
- product removal
- internal reports/flags
  The Dashboard should summarize current unresolved/actionable compliance workload.

## 17. Compliance Count Definition

The source does not define the exact compliance-case state enum.
Therefore:

```text
Seller Compliance Items
```

must use the authoritative definition from Seller Compliance once implemented.
Do not invent a Dashboard-specific state model.

## 18. Compliance Card

Recommended:

```text
Seller Compliance
<count requiring Admin attention>
View Compliance
```

Optional breakdowns may be shown only if those states actually exist in the compliance implementation.

## 19. Compliance Navigation

The card should link to:

```text
Seller Compliance
```

The Dashboard itself should not:

- issue a warning
- suspend a Seller
- remove a product

# Complaints & Disputes

## 20. Complaint Scope

`Admin.md` defines Complaints & Disputes as a centralized resolution feature with:

- evidence
- ticketing/case handling
- Admin review
- binding decisions
- secure files/media
- message/action history
  The Dashboard should summarize unresolved cases requiring Admin attention.

## 21. Complaint Count Definition

Use the owning Complaints & Disputes feature's authoritative non-terminal/actionable case definition.
The source does not mandate exact status names, so the Dashboard must not create its own complaint lifecycle.

## 22. Complaints Card

Recommended:

```text
Open Complaints
<count>
View Complaints
```

Optional sub-counts may be shown only when supported by the implemented case model.

## 23. Complaint Navigation

The card links to:

```text
Complaints & Disputes
```

No binding decision should be made directly from the Dashboard in MVP.

# Platform Commission / Revenue

## 24. Source Rule

`app.md` defines:

```text
Logistics SaaS platform
    base subscription
    + ₱10 per order

Shipping fee
    default ₱50
    this is where Logistics gets their commission
```

Therefore AISLEY platform revenue is not the full shipping fee and is not the full checkout total.

## 25. Platform Revenue Formula

The source-supported formula is:

```text
AISLEY Platform Revenue
=
Logistics Base Subscription Revenue
+
Applicable ₱10 Per-Order Platform Fees
```

## 26. Shipping Fee Exclusion

Critical invariant:

```text
The default ₱50 shipping fee
belongs to Logistics
and must not be counted
as AISLEY platform revenue.
```

## 27. Reports Ownership

Reports Overview remains authoritative for detailed financial reporting.
Recommended:

```text
Dashboard
    consumes shared platform revenue calculation

Reports Overview
    provides detailed reporting
```

Do not duplicate financial formulas independently in the Dashboard.

## 28. Commission Card

Recommended:

```text
Platform Commission
<amount>
<period>
```

Optional sub-values:

```text
Subscription Revenue
Per-Order Fees
```

The financial period must be visible.

## 29. Financial Period

Examples:

```text
Today
This Week
This Month
```

The default period is an Open Decision.

## 30. Logistics Approval Boundary

AISLEY Logistics flow is:

```text
register
→ Admin approval
→ email
→ sign in
→ subscription
```

Therefore:

```text
APPROVED Logistics
≠
paid subscription revenue
```

Use actual subscription/revenue data.

## 31. Seller Financial Boundary

Seller reports may include:

```text
gross sales
net profits
platform fees
```

These are Seller-specific metrics.
Do not display Seller gross sales as AISLEY platform commission.

## 32. Courier Financial Boundary

Courier earnings and tips are not AISLEY platform revenue.

## 33. Buyer Payment Boundary

The Buyer's total payment is not automatically platform revenue.
Do not use total checkout value as the Platform Commission KPI.

# Platform / Order Activity

## 34. Order Telemetry

`Admin.md` says the Dashboard aggregates platform telemetry.
`app.md` defines the order lifecycle conceptually:

```text
customer order
→ seller approved
→ seller packed
→ logistics flow
→ delivered
```

The Dashboard may show high-level order activity using actual order states.

## 35. Possible Order KPIs

Examples that may be useful if supported:

```text
orders today
orders in progress
orders delivered
```

The exact order KPI set is Open.

## 36. Existing States Only

The Dashboard must not invent new order states.
It should aggregate the order domain's authoritative statuses.

## 37. Order Detail Boundary

The Dashboard is not:

- a Seller order-management page
- a Logistics dispatch console
- a Courier task board
- a Buyer order tracker
  It should remain high-level.

## 38. Platform Health Meaning

`Admin.md` mentions high-level system health.
Current sources do not explicitly define technical infrastructure metrics such as:

```text
CPU
memory
database latency
API uptime
queue health
```

Therefore Dashboard "health" should primarily mean business/operational state unless observability requirements are added later.

# Action Center

## 39. Action Center Purpose

The Dashboard should surface pending Admin work.
Primary sources:

```text
Pending Registrations
Seller Compliance Items
Open Complaints / Disputes
```

## 40. Action Center Item

Recommended fields:

- category/feature
- safe summary
- count or short preview
- timestamp if useful
- priority only if source-backed
- link to owning feature

## 41. Priority

The source says critical notifications requiring immediate attention should be surfaced.
However, no exact priority-scoring model exists.
Do not invent arbitrary severity formulas.

## 42. Action Center Source of Truth

Action items should derive from authoritative domain records.
Do not create a separate editable "Admin task" system unless future requirements explicitly request it.

## 43. KPI vs Action Item

Recommended distinction:

```text
KPI
    total workload count

Action Center
    selected items requiring attention
```

Avoid confusing duplicate content.

# Admin Notifications Preview

## 44. Notification Ownership

Admin Notifications is the authoritative inbound notification feature.
Recommended:

```text
Admin Notifications
    full inbox/history/unread state

Dashboard
    bounded preview
```

## 45. Notification Preview

Recommended:

```text
Notifications
- recent/high-priority items
- unread count
- timestamp
- safe preview
- View All
```

## 46. Notification Sources

Possible sources already defined by Admin Notifications:

- pending registration
- Seller Compliance case/report
- complaint/dispute
- user reply to Admin Chat
- report export completion/failure
- Courier SOS where Admin is an intended recipient
  The exact event list belongs to Admin Notifications.

## 47. Flood Prevention

Do not flood Dashboard Notifications with routine role-specific events such as:

- every Logistics status update
- Seller low-stock alerts
- Buyer wishlist alerts
- Product Q&A alerts
- every Audit Log entry
  Only Admin-relevant events should appear.

## 48. Real-Time or Polling

`Admin.md` explicitly allows:

```text
real-time or polling
```

Either is acceptable.
Realtime is not required for every KPI.

## 49. Notification Read State

Recommended:

```text
Dashboard load
does not automatically mark
all preview notifications read
```

Read behavior remains owned by Admin Notifications.

# Data and API

## 50. Dashboard API

Recommended conceptual endpoint:

```http
GET /api/admin/dashboard
```

It may return the main bounded Dashboard aggregates in one response.
Separate widget endpoints are also acceptable if independent loading is preferred.

## 51. Conceptual Response

```json
{
  "kpis": {
    "pending_registrations": 0,
    "seller_compliance_items": 0,
    "open_complaints": 0,
    "platform_commission": {
      "amount": 0,
      "period": "..."
    }
  },
  "order_activity": {},
  "action_center": [],
  "notifications": []
}
```

Exact shape is implementation-defined.

## 52. Backend Aggregation

The Dashboard should query owning domains/services rather than duplicate business logic.
Conceptually:

```text
AccountApprovalQuery
SellerComplianceQuery
ComplaintQuery
PlatformRevenueService
OrderActivityQuery
AdminNotificationService
```

Names are illustrative only.

## 53. Shared Revenue Logic

Critical architecture rule:

```text
Dashboard platform commission
and
Reports Overview platform commission

must use the same
authoritative revenue calculation.
```

This prevents formula drift.

## 54. Aggregate Query Efficiency

`Admin.md` explicitly notes aggregate queries across multiple tables.
Avoid:

- loading all records into memory
- N+1 queries
- unindexed full scans where avoidable
- repeated expensive recomputation without need
  Use indexed counts, aggregates, cache, summary tables, or reporting services where justified.

## 55. Caching

Caching may be used for:

- financial aggregates
- order counts
- large platform counts
  Exact TTL and invalidation behavior are Open Decisions.

## 56. Freshness

Different widgets may have different freshness:

```text
notifications
    near-real-time / polling

pending counts
    current aggregate or cached

financial metrics
    reporting/ledger freshness
```

Do not imply all Dashboard data is perfectly real-time.

## 57. Last Updated

Optional:

```text
Last updated: <time>
```

Useful when data is cached or periodically refreshed.

# Loading and Failure States

## 58. Loading State

Recommended:

```text
Dashboard shell
+ widget skeletons/loading states
```

Avoid a blank screen if sections can load independently.

## 59. Partial Failure

Recommended behavior:

```text
Pending Registrations     14
Seller Compliance          6
Open Complaints            3
Platform Commission        Unable to load
```

One failed widget should not necessarily break the entire Dashboard.

## 60. Full Failure

If Dashboard data fails completely:

- show clear error
- offer retry
- preserve navigation shell when possible
- do not present stale values as fresh without indication

## 61. Empty State

Zero is valid:

```text
Pending Registrations
0
No pending registrations.
```

Do not treat zero as an error.

## 62. Permission-Limited State

Do not show unauthorized data as:

```text
0
```

because zero implies no workload.
Hide the widget or show an appropriate access-limited state.

# Privacy and Security

## 63. PII Minimization

Use aggregate counts and safe previews.
Do not expose unnecessary:

- Buyer addresses
- Seller payout data
- Courier license details
- phone numbers
- payment credentials
- complaint evidence
  Detailed PII belongs to owning features.

## 64. Complaint Privacy

Use safe summaries such as:

```text
Complaint #123 requires review
```

Do not copy full evidence into Dashboard previews.

## 65. Registration Privacy

Do not show full applicant credentials/documents on the Dashboard.

## 66. Compliance Privacy

Do not expose full internal compliance reports or sensitive internal notes on the Dashboard.

## 67. Security Requirements

Dashboard APIs must:

- authenticate Admin
- enforce permissions
- minimize PII
- avoid over-fetching
- sanitize text previews
- avoid secrets
- avoid unauthorized cross-feature data exposure

## 68. XSS Safety

Notification/action text may include user-generated content.
Render safely and never execute raw untrusted HTML.

## 69. No Mutation from GET

The main Dashboard read request must not:

- approve accounts
- resolve complaints
- alter compliance state
- modify financial records
- mark unrelated records complete
  The Dashboard is primarily read-only.

## 70. Audit Logs

Routine Dashboard reads should not create System Audit Log entries by default.
High-volume page-view logging would flood the immutable Admin action ledger.

# UX

## 71. Navigation

Recommended links:

```text
Pending Registrations
→ Account Approval

Seller Compliance
→ Seller Compliance

Open Complaints
→ Complaints & Disputes

Platform Commission
→ Reports Overview

Notifications
→ Admin Notifications
```

## 72. Deep-Link Filters

Where supported:

```text
Account Approval?status=PENDING
Complaints?status=open
Notifications?filter=unread
```

Exact routes depend on implementation.

## 73. Metric Naming

Use stable labels:

```text
Pending Registrations
Seller Compliance
Open Complaints
Platform Commission
```

Avoid ambiguous terms like:

```text
Users
Issues
Revenue
Problems
```

without clear definitions.

## 74. Financial Period Label

Bad:

```text
Platform Commission
₱125,000
```

Better:

```text
Platform Commission — This Month
₱125,000
```

Always show the period.

## 75. Charts

Charts are not source-required.
They may be added for:

- order trends
- platform commission trends
  only if the metric/time-series definition exists.
  Do not add decorative charts with unclear data.

## 76. Date Range

A Dashboard-wide date selector is not source-required.
If added later, every affected metric must define how the selected period applies.

## 77. Accessibility

The Dashboard should:

- use semantic headings
- expose KPI labels and values
- make cards/links keyboard accessible
- not rely on color alone
- announce loading/error states
- provide accessible chart labels if charts are added

## 78. Responsive Behavior

On narrower screens:

```text
KPI cards stack/reflow
Action Center remains readable
Notifications remain accessible
```

Do not require horizontal page scrolling for core Dashboard content.

# Consistency

## 79. Count Consistency

Dashboard counts should match owning features when the same filter/freshness applies.
Example:

```text
Dashboard Pending Registrations = 12
Account Approval PENDING view = 12
```

Minor differences are acceptable only when caused by clearly defined caching/freshness.

## 80. Registration Refresh

Account Approval changes should eventually invalidate/refetch the Dashboard pending count.
Possible implementation:

- query invalidation
- refetch on return
- polling
- domain-event refresh
  Exact mechanism is implementation-specific.

## 81. Complaint Refresh

Complaint changes should eventually update the Dashboard complaint count.

## 82. Compliance Refresh

Compliance changes should eventually update the Dashboard compliance count.

## 83. Financial Refresh

Financial metrics should follow the shared Reports/ledger freshness policy.
Do not recompute historical revenue from current settings if historical charged amounts are stored.

# MVP

## 84. Required

- authenticated `/dashboard`
- permission-aware content
- Pending Registrations KPI
- Seller Compliance KPI
- Open Complaints KPI
- Platform Commission KPI
- correct AISLEY revenue formula
- exclusion of ₱50 Logistics shipping fee from platform revenue
- high-level order/platform activity
- Action Center
- Admin Notifications preview
- links to owning features
- backend aggregate queries
- loading states
- empty states
- partial-error handling
- PII minimization
- safe rendering
- responsive/accessibility basics

## 85. Recommended

- bounded `GET /api/admin/dashboard`
- shared platform revenue service with Reports
- bounded notification preview
- deep links with filters
- independent widget errors
- polling/realtime notification refresh
- query invalidation after feature mutations
- optional last-updated indicator

## 86. Not Required

- inline approval/rejection
- inline Seller suspension
- inline complaint decisions
- blocklist actions
- Push/SMS campaign actions
- charts
- Dashboard customization
- drag-and-drop widgets
- saved layouts
- Dashboard exports
- full notification inbox
- technical infrastructure monitoring

# Acceptance Criteria

## 87. AC-01 — Authenticated Access

An authenticated Admin can access the Dashboard.

## 88. AC-02 — Guest Denied

An unauthenticated request cannot access Dashboard data.

## 89. AC-03 — Non-Admin Denied

Authenticated non-Admin role-accounts cannot access Admin Dashboard APIs.

## 90. AC-04 — Permission Awareness

The Dashboard does not expose feature data the Admin is not authorized to view.

## 91. AC-05 — Pending Registration Count

Pending Registrations counts only Admin-owned PENDING Buyer/Seller/Logistics registrations.

## 92. AC-06 — Courier Exclusion

Courier registration requests are not counted as Admin Account Approval workload.

## 93. AC-07 — Registration Navigation

Pending Registrations links to Account Approval.

## 94. AC-08 — Compliance Count

Seller Compliance uses the owning feature's authoritative actionable definition.

## 95. AC-09 — Compliance Navigation

The compliance card links to Seller Compliance rather than performing sanctions inline.

## 96. AC-10 — Complaint Count

Open Complaints uses the owning complaint feature's authoritative non-terminal/actionable definition.

## 97. AC-11 — Complaint Navigation

The complaints card links to Complaints & Disputes.

## 98. AC-12 — Revenue Formula

Platform Commission uses Logistics subscription revenue plus applicable ₱10/order fees.

## 99. AC-13 — Shipping Fee Exclusion

The default ₱50 shipping fee is not counted as AISLEY platform revenue.

## 100. AC-14 — Logistics Subscription Boundary

An APPROVED Logistics account is not automatically counted as subscription revenue.

## 101. AC-15 — Seller Financial Boundary

Seller gross sales/net profit are not used as AISLEY platform commission.

## 102. AC-16 — Courier Financial Boundary

Courier earnings/tips are excluded from platform revenue.

## 103. AC-17 — Buyer Payment Boundary

Buyer checkout total is not treated as platform revenue.

## 104. AC-18 — Shared Revenue Logic

Dashboard and Reports Overview use the same authoritative platform-revenue calculation.

## 105. AC-19 — Order Telemetry

Order activity uses existing order states and does not invent new statuses.

## 106. AC-20 — Notifications Preview

Dashboard shows a bounded Admin Notifications preview.

## 107. AC-21 — Notification Ownership

Dashboard does not maintain a second independent notification history model.

## 108. AC-22 — No Auto-Read

Loading Dashboard does not automatically mark all notifications read unless explicitly defined later.

## 109. AC-23 — Action Center

Action items link to authoritative owning features.

## 110. AC-24 — No High-Impact Inline Mutation

MVP Dashboard cards do not directly approve, suspend, resolve, ban, or send campaigns.

## 111. AC-25 — PII Minimization

Dashboard cards/previews do not unnecessarily expose sensitive user/evidence data.

## 112. AC-26 — Partial Failure

A failed widget does not necessarily prevent healthy widgets from rendering.

## 113. AC-27 — Zero State

Zero counts render as valid empty states.

## 114. AC-28 — Loading State

The UI indicates unresolved widget data.

## 115. AC-29 — Safe Rendering

Notification/action previews cannot execute untrusted scripts.

## 116. AC-30 — Bounded Preview

Notifications/action previews do not load unlimited records.

## 117. AC-31 — Backend Aggregate Authority

KPI values come from backend/domain aggregates, not client-side counting of partial datasets.

## 118. AC-32 — Read-Only Dashboard Load

Loading Dashboard does not perform core business mutations.

# Tests

## 119. Backend Tests

Test:

- guest denied
- Buyer denied
- Seller denied
- Logistics denied
- Courier denied
- Admin can load Dashboard
- permission-limited Admin does not receive unauthorized data
- pending count includes Buyer PENDING
- pending count includes Seller PENDING
- pending count includes Logistics PENDING
- pending count excludes Courier
- approved/rejected registrations excluded
- compliance count uses owning service/query
- complaint count uses owning service/query
- platform revenue includes subscription revenue
- platform revenue includes applicable ₱10/order fee
- platform revenue excludes ₱50 shipping fee
- approved Logistics without subscription is not revenue
- Seller gross sales excluded
- Courier earnings/tips excluded
- Buyer payment total excluded
- Dashboard and Reports share revenue logic
- order telemetry uses existing states
- notification preview is bounded
- Dashboard load does not auto-read all notifications
- Dashboard GET does not mutate business state
- aggregate cards omit sensitive PII
- partial widget failure is handled according to architecture

## 120. Frontend Tests

Test:

- Dashboard loading state
- KPI cards render
- zero states render
- registration link works
- compliance link works
- complaint link works
- Reports link works
- Notifications link works
- unauthorized widget is not shown as zero
- financial period label is visible
- partial widget error does not break healthy widgets
- notification preview is bounded
- unsafe preview HTML does not execute
- narrow layout remains usable
- keyboard navigation works
- cards/links have accessible names
- status is not communicated by color alone

# Open Decisions

## 121. Open Decisions

The current source does not define:

1. exact Dashboard layout
2. exact component order
3. exact permission behavior for hidden/restricted widgets
4. one Dashboard endpoint vs separate widget endpoints
5. exact response shape
6. default financial period
7. Dashboard date-range selector
8. exact order activity KPIs
9. exact Seller Compliance actionable-state definition
10. exact complaint open/actionable-state definition
11. Action Center selection rules
12. Action Center priority model
13. notification preview size
14. notification polling interval
15. WebSocket/SSE provider
16. aggregate cache strategy
17. cache TTL
18. last-updated display
19. financial refresh interval
20. chart requirements/types
21. technical system-health widgets
22. total/active user KPIs
23. active Seller count
24. active Logistics count
25. order-volume trends
26. Dashboard customization
27. saved layouts
28. widget reordering
29. deep-link query naming
30. refresh-on-return behavior
31. partial API payload vs separate endpoint error handling
32. exact stale-data behavior
33. unread-only vs recent notification preview

# Final Definition

## 122. Final Definition

AISLEY Admin Dashboard is:

```text
the primary authenticated Admin landing page

providing:
    platform overview
    Admin workload KPIs
    high-level order telemetry
    platform commission snapshot
    pending action previews
    Admin notification preview
    links to owning Admin features
```

Core workload KPIs:

```text
Pending Registrations
Seller Compliance Items
Open Complaints / Disputes
```

Core financial rule:

```text
AISLEY Platform Revenue
=
Logistics Base Subscription Revenue
+
Applicable ₱10 Per-Order Platform Fees
```

And:

```text
The default ₱50 shipping fee
belongs to Logistics
and is not AISLEY platform revenue.
```

Central Dashboard boundary:

```text
Dashboard summarizes and navigates.

Owning Admin features
perform the authoritative business actions.
```
