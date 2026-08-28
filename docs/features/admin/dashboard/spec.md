---
feature: Admin Dashboard
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Admin Web Application
---

# Admin Dashboard Specification

## 1. Purpose

This document defines the feature requirements for the **AISLEY Admin Dashboard**.

The Admin Dashboard is the primary authenticated landing page for platform administrators. Its purpose is to give an administrator a concise, platform-wide operational overview, surface important notifications and pending actions, and provide direct entry points into the Admin modules responsible for resolving those items.

This specification is grounded in the current AISLEY project documents:

- `app.md`
- `Admin.md`
- `Buyer.md`
- `Seller.md`
- `Logistics.md`
- `Courier.md`

The Dashboard must remain an **overview and command interface**. It must not duplicate the full functionality of the registration, user-management, seller-compliance, complaints, reports, logistics, messaging, or other dedicated modules.

Where the source documents do not define an exact metric, threshold, schema, or business rule, this specification leaves it configurable or marks it as an open decision instead of inventing one.

---

# 2. Source-Derived Definition

`Admin.md` defines the Admin Dashboard as:

- an overview of the platform
- a place to display notifications
- a centralized command interface
- an aggregation of platform-wide telemetry
- a display of key performance indicators
- a display of pending actionable items
- the primary Admin entry point
- a consumer of aggregate data across users, transactions, and reports
- a consumer of real-time or polling-based notifications

The Dashboard therefore answers:

```text
What is happening across AISLEY?
What currently requires Admin attention?
How is the platform performing at a high level?
Where should the Admin go next?
```

It must not attempt to answer every detailed operational question directly.

---

# 3. Relationship to Authentication

The Admin Dashboard is an authenticated Admin-only page.

Expected entry flow:

```text
Admin signs in
    ↓
authenticated Admin session established
    ↓
Admin identity and permissions resolved
    ↓
/dashboard
    ↓
Dashboard data loaded
```

If no valid Admin session exists:

```text
/dashboard
    ↓
authentication fails
    ↓
redirect to /login
```

The Dashboard must use the Admin authentication and authorization behavior defined by the Admin Auth specification.

The backend remains the security boundary.

---

# 4. Dashboard Goals

The Dashboard must:

1. provide a platform-wide overview immediately after Admin login
2. surface items requiring Admin attention
3. summarize account-registration workload
4. summarize seller-compliance workload
5. summarize complaints/disputes workload
6. summarize high-level platform financial performance
7. summarize high-level marketplace/order activity
8. display important Admin notifications
9. provide fast navigation into the related Admin modules
10. respect the authenticated Admin's permissions
11. avoid exposing sensitive PII in overview widgets
12. avoid duplicating Logistics, Seller, Buyer, or Courier operational dashboards
13. load aggregate data efficiently
14. represent empty, loading, partial-failure, and stale-data states clearly

---

# 5. Non-Goals

The Dashboard itself does not implement:

- approving or rejecting registrations inline
- full user CRUD
- seller/product moderation workflows
- complaint/dispute adjudication
- detailed transaction reports
- financial export generation
- platform policy editing
- announcement authoring
- full chat/messaging
- Admin account settings
- audit-log browsing
- blocklist management
- push-notification campaign creation
- rider dispatch
- parcel sorting
- waybill scanning
- seller inventory management
- courier task management

The Dashboard may summarize or link to these capabilities where the source documents support them.

---

# 6. User

## 6.1 Primary User

```text
Admin
```

The Admin role manages platform-level workflows including:

- account approvals
- user accounts
- seller compliance
- complaints and disputes
- reports
- platform settings
- messaging/support
- Admin account settings
- audit logs
- blocklist/security management
- push notification management

## 6.2 Permission-Aware Admins

The AISLEY system flow states:

```text
initial Admin
    ↓
create partners
    ↓
add Admins with custom permissions
```

Therefore, the Dashboard must be compatible with multiple Admin accounts that may not all have identical access.

A Dashboard widget or shortcut whose underlying feature is not available to the authenticated Admin should not expose privileged data or unusable actions.

Exact permission names are outside the current source documents.

Implementation must use the repository's eventual/existing Admin permission model rather than inventing a separate Dashboard-specific authorization system.

---

# 7. Route

Primary route:

```text
/dashboard
```

This is the default authenticated Admin landing page.

---

# 8. Information Architecture

The Dashboard should be composed of the following source-backed areas:

```text
Admin Dashboard
│
├── Overview / KPI Summary
│   ├── Pending Registrations
│   ├── Open Complaints / Disputes
│   ├── Seller Compliance Items
│   └── Platform Commission / Financial Summary
│
├── Platform Activity
│   └── High-level marketplace/order telemetry
│
├── Action Center
│   └── Pending Admin work requiring attention
│
├── Notifications
│   └── Important Admin alerts
│
└── Financial Snapshot
    └── Platform commission trend / summary
```

The precise visual arrangement may vary by screen size.

---

# 9. Dashboard Header

The Dashboard page header should provide:

- page title: `Dashboard`
- concise context such as `Platform overview`
- authenticated Admin identity through the application shell
- access to Admin account/profile controls through the application shell
- notification access if the global shell provides it

The Dashboard header should not become a second navigation system.

---

# 10. KPI Summary

The first dashboard region should provide a small number of high-value summary cards.

The values must be real aggregate data.

Do not display fabricated demo numbers in production.

Recommended source-backed cards are:

1. Pending Registrations
2. Open Complaints / Disputes
3. Seller Compliance Items
4. Platform Commission

These metrics correspond directly to documented Admin responsibilities.

---

# 11. KPI — Pending Registrations

## 11.1 Purpose

Show the number of account applications currently waiting for Admin review.

AISLEY's documented auth flow is:

```text
Customer / Buyer
register → Admin approval → email → sign in

Seller
register → Admin approval → email → sign in

Logistics
register → Admin approval → email → sign in
```

Courier registration is different:

```text
Courier
search Logistics hub
    ↓
register for that Logistics
    ↓
Logistics Admin approval
    ↓
sign in
```

Therefore, the Admin Dashboard's pending-registration KPI should cover registrations for:

- Buyer / Customer
- Seller
- Logistics

It should not treat Courier approvals as normal AISLEY Admin registration approvals unless the system requirements later change.

## 11.2 Metric

Conceptually:

```text
count(accounts)
where registration_status = PENDING
and role in [BUYER, SELLER, LOGISTICS]
```

Exact table/model names must follow the repository.

## 11.3 Display

Card should show:

- total pending count
- optionally a small role breakdown if inexpensive and visually useful

Example:

```text
Pending Registrations
24

Buyer       11
Seller       9
Logistics    4
```

The role breakdown is optional.

## 11.4 Action

Primary card action:

```text
View registrations
```

Destination should be the Manage Account Registrations module.

No approve/reject mutation should occur directly from the KPI card.

---

# 12. KPI — Open Complaints / Disputes

## 12.1 Purpose

Show unresolved user reports, complaints, and disputes that require administrative review.

`Admin.md` defines this capability as a centralized resolution center where Admins:

- review user-submitted reports
- examine supporting evidence
- make binding resolution decisions
- maintain an audit trail of actions and messages

## 12.2 Metric

Conceptually:

```text
count(complaints_or_disputes)
where status is unresolved / open
```

The current source documents do not define the exact dispute status state machine.

The Dashboard must use whatever open/unresolved states are defined by the complaint/dispute feature.

## 12.3 Display

Card should show:

- open/unresolved total
- optional overdue/priority count only if those concepts are defined by the dispute module

Do not invent SLA or severity thresholds in the Dashboard.

## 12.4 Action

```text
Review complaints
```

Destination:

```text
Manage Complaints and Disputes
```

---

# 13. KPI — Seller Compliance Items

## 13.1 Purpose

Show seller or product compliance items requiring Admin review.

`Admin.md` defines Seller Compliance as:

- product verification/moderation
- seller activity auditing
- policy enforcement
- warnings
- temporary seller suspension
- permanent removal of non-compliant listings

The Dashboard should surface the **queue size**, not perform moderation itself.

## 13.2 Metric

Conceptually:

```text
count(compliance_items)
where status requires Admin review
```

Possible sources may include:

- reported products
- flagged listings
- seller compliance cases

The exact data model is not defined by the source documents.

## 13.3 Display

Show:

- total items awaiting review

Optional sub-counts may be shown only when the compliance feature formally defines them.

## 13.4 Action

```text
Review compliance
```

Destination:

```text
Monitor Seller Compliance
```

---

# 14. KPI — Platform Commission

## 14.1 Purpose

Provide a concise financial indicator representing revenue attributable to the AISLEY platform.

`Admin.md` defines the Reports Overview as calculating platform commission and supporting temporal financial analysis.

`app.md` defines the current Admin/platform commission model as:

```text
Logistics SaaS platform
= base subscription + ₱10 per order
```

`app.md` separately states:

```text
Shipping fee
= default ₱50
```

and identifies the shipping fee as where Logistics receives its commission.

Therefore, the Dashboard must not automatically treat the entire shipping fee as AISLEY/Admin commission.

## 14.2 Metric

The KPI should derive from the authoritative transaction/commission ledger or equivalent financial source used by the Reports module.

Conceptually:

```text
platform_commission =
    applicable logistics subscription revenue
    + applicable per-order platform fees
```

The currently documented per-order component is:

```text
₱10 per applicable order
```

The base subscription amount is not defined in the current source documents.

It must come from the system's configured billing/subscription data and must not be invented in Dashboard code.

## 14.3 Time Range

The Reports feature explicitly supports:

- daily
- weekly
- monthly

The Dashboard may default to one period, but the displayed period must be clear.

Recommended Dashboard behavior:

```text
Platform Commission
₱X,XXX
This month
```

A full date-range reporting interface belongs in Reports Overview.

## 14.4 Action

```text
View reports
```

Destination:

```text
Reports Overview
```

---

# 15. Platform Activity Section

## 15.1 Purpose

`Admin.md` describes the Dashboard as an aggregation of platform-wide telemetry.

AISLEY's core marketplace lifecycle is:

```text
customer order
    ↓
seller approved
    ↓
seller packed
    ↓
logistics flow
    ↓
order delivered
```

The Logistics lifecycle includes:

```text
courier door-to-door pickup
    ↓
Logistics receives order
    ↓
waybill
    ↓
sorted
    ↓
transfer
    ↓
dispatch
    ↓
Logistics assigns delivery courier
    ↓
rider picks up for delivery
    ↓
delivered
```

The Admin Dashboard may therefore show a **high-level order pipeline summary** as platform telemetry.

It must not turn into the Logistics dispatch console.

## 15.2 Recommended Activity Metrics

Use broad platform-level counts such as:

- Orders Placed
- Awaiting Seller Processing
- In Logistics / In Transit
- Delivered

Exact mapping must follow the actual order state machine.

The source documents use several conceptual state labels across features but do not define one canonical complete enum.

Do not create a new status enum purely for the Dashboard.

## 15.3 Presentation

Recommended presentation:

```text
Platform Activity
[Placed] → [Seller Processing] → [Logistics / Transit] → [Delivered]
```

or a compact chart/summary.

The purpose is to reveal platform flow, not individual parcel details.

## 15.4 Drill-Down

If a future Admin order-monitoring page exists, the activity section may link to it.

The current `Admin.md` does not define a dedicated Admin Order Management module.

Therefore, the Dashboard must not invent a full Admin order-management workflow.

---

# 16. Action Center

## 16.1 Purpose

The Dashboard should group actionable Admin workload into one scannable area.

The Action Center is not a separate business domain.

It is a read-only aggregation of work already owned by documented Admin modules.

## 16.2 Eligible Items

Source-backed categories include:

- pending account registrations
- unresolved complaints/disputes
- seller compliance cases

Additional categories may be added when their originating feature formally defines an actionable state.

## 16.3 Item Structure

An action row may contain:

```text
type
summary
created/received time
status or priority if defined
link to source module
```

Example:

```text
Registration
Seller application awaiting review
Received 12 minutes ago
View
```

Do not expose unnecessary applicant/customer PII in the overview.

## 16.4 Ordering

Items requiring attention should be ordered predictably.

Recommended baseline:

```text
newest actionable items first
```

If the source module later defines severity or SLA rules, those can take precedence.

The Dashboard itself must not invent urgency classifications.

## 16.5 Mutations

The Action Center should navigate the Admin to the owning module.

For MVP, avoid performing high-impact actions such as:

- approve account
- reject account
- suspend seller
- remove product
- resolve dispute

directly from the Dashboard.

Those actions require the full context and evidence provided by their dedicated modules.

---

# 17. Notifications

## 17.1 Purpose

Notification display is explicitly part of the Admin Dashboard's core value.

The Dashboard must expose important notifications that help the Admin identify changes or required action.

## 17.2 Delivery

`Admin.md` requires:

```text
real-time or polling mechanism for incoming notifications
```

Either approach is acceptable.

Implementation should use the project's existing notification architecture when available.

Do not introduce WebSockets solely for this feature if polling is already the project standard and satisfies the required freshness.

## 17.3 Notification Sources

The Dashboard may receive notifications generated by documented Admin-relevant events such as:

- a new registration requiring Admin approval
- a new complaint/dispute
- a new seller compliance/report item
- relevant platform/security events once those modules define them

The Dashboard must not invent notification event types unsupported by their source feature.

## 17.4 Notification Item

Recommended fields:

```text
id
type
title
summary
created_at
read/unread state
target/link
```

Use existing notification schema if one already exists.

## 17.5 Read State

If the notification system supports read state, the Dashboard should distinguish unread from read notifications.

The exact retention, archival, and read-receipt rules are not defined by the source documents.

## 17.6 Empty State

Example:

```text
No new notifications.
```

Do not fill the panel with fake notification data in production.

---

# 18. Financial Snapshot

## 18.1 Purpose

The KPI card gives a single commission figure.

A secondary financial visualization may show the recent trend of platform commission revenue.

This is supported by the Reports feature's temporal reporting requirement.

## 18.2 Supported Periods

Source-backed periods:

- daily
- weekly
- monthly

Dashboard scope should remain lightweight.

Recommended MVP:

- one default trend period
- one concise chart
- link to Reports for detailed filtering/export

## 18.3 Data Source

Use the same authoritative commission logic as the Reports module.

The Dashboard must not independently reimplement financial business rules if a shared reporting/commission service exists.

This prevents inconsistent totals between:

```text
Dashboard
vs.
Reports Overview
```

---

# 19. User / Account Overview

## 19.1 Purpose

The Admin Dashboard may present a high-level user/account summary because:

- the Admin Dashboard aggregates `users`
- Admins manage user registrations
- Admins manage user account status

## 19.2 Recommended Scope

If included, keep this section high-level, such as:

```text
Approved Buyers
Approved Sellers
Approved Logistics Accounts
```

or a total role distribution.

## 19.3 Exclusion

Courier accounts are registered under Logistics and approved by Logistics according to `app.md`.

They may be included in a platform population statistic if useful, but they must not be presented as Admin-managed pending registrations.

## 19.4 PII

The Dashboard should show aggregate counts, not sensitive user-profile data.

Detailed profiles belong in Manage User Accounts.

---

# 20. Seller / Logistics / Courier Boundary

AISLEY includes dedicated dashboards for Seller, Logistics, and Courier.

The Admin Dashboard must respect those domain boundaries.

## 20.1 Seller Dashboard Owns

Seller-specific operational detail such as:

- store revenue
- seller order volume
- shop traffic
- inventory
- new-order detail
- fulfillment work

Admin Dashboard should not reproduce a seller's private merchant analytics.

## 20.2 Logistics Dashboard Owns

Logistics-specific operational detail such as:

- seller-confirmed order queue
- rider deployment
- parcel sorting/assignment
- live courier capacity
- waybill operations

Admin Dashboard may consume aggregated platform telemetry but must not become a dispatch interface.

## 20.3 Courier Dashboard Owns

Courier-specific detail such as:

- pickup requests
- assigned delivery work
- delivery notifications
- earnings
- delivery performance

Admin Dashboard should not become a courier operations console.

## 20.4 Admin Dashboard Owns

Platform-level concerns:

```text
approval workload
compliance workload
complaints/disputes
financial commission overview
high-level platform health/activity
Admin notifications
```

---

# 21. Navigation Integration

The Dashboard should provide navigation to the documented Admin feature set.

Expected Admin navigation destinations include:

```text
Dashboard
Manage Account Registrations
Manage User Accounts
Monitor Seller Compliance
Manage Complaints and Disputes
Reports Overview
Manage Platform Settings
Chat / Messaging
Account Management
System Audit Logs
Global Ban / Blocklist Management
Push Notification Management
```

The Dashboard page does not need to implement these modules.

Navigation labels and route naming should follow project conventions.

---

# 22. Data Freshness

Different Dashboard data has different freshness needs.

## 22.1 Near-Real-Time

Notifications and actionable queue counts should be refreshed through:

- existing real-time mechanism, or
- reasonable polling

The source does not define an exact polling interval.

Do not hardcode a business-critical freshness requirement without a source requirement.

## 22.2 Aggregate Analytics

Financial and platform-wide aggregate metrics do not necessarily require second-by-second updates.

They may be loaded on page request and refreshed when the Dashboard refreshes.

If the backend later uses cached aggregates or background jobs, the Dashboard should display the latest available authoritative value.

---

# 23. Dashboard Data API

The Dashboard should avoid forcing the frontend to orchestrate a large number of expensive independent aggregate queries.

A purpose-built Dashboard summary endpoint is recommended.

Example:

```http
GET /api/admin/dashboard
```

This route name is recommended only; existing repository conventions take precedence.

Possible response shape:

```json
{
  "registrations": {
    "pending_total": 0,
    "by_role": {
      "buyer": 0,
      "seller": 0,
      "logistics": 0
    }
  },
  "complaints": {
    "open_total": 0
  },
  "compliance": {
    "pending_total": 0
  },
  "commission": {
    "amount": 0,
    "currency": "PHP",
    "period": "month"
  },
  "orders": {
    "placed": 0,
    "seller_processing": 0,
    "in_logistics": 0,
    "delivered": 0
  }
}
```

This is a conceptual DTO, not a mandated database schema.

The API should adapt to the actual domain models.

Notifications may be loaded separately if the notification system already has its own API.

---

# 24. Backend Aggregation Requirements

The Dashboard backend should:

- aggregate data server-side
- avoid N+1 queries
- avoid returning full entity collections when only counts are needed
- reuse existing domain/reporting services
- apply Admin authorization
- apply permission-specific filtering where required
- avoid returning sensitive PII
- return deterministic numeric values for KPI cards
- use appropriate indexes for count/filter queries
- support caching if aggregate cost becomes significant

`Admin.md` explicitly notes aggregate queries across:

```text
users
transactions
reports
```

Order/transaction aggregation should follow the actual schema.

---

# 25. Permission-Aware Dashboard Data

Backend authorization must control the data itself.

Example behavior:

```text
Admin can access Registration Management
    ↓
pending-registration metric returned

Admin cannot access Registration Management
    ↓
registration metric omitted or marked unavailable
```

The exact response pattern should be consistent across the API.

The frontend must not receive privileged detailed data and merely hide it visually.

The initial Admin may have full access if that is how the eventual permission system defines the bootstrap administrator.

---

# 26. Empty States

Every Dashboard region must have a meaningful empty state.

Examples:

### Registrations

```text
No pending registrations.
```

### Complaints

```text
No open complaints or disputes.
```

### Compliance

```text
No seller compliance items awaiting review.
```

### Notifications

```text
No new notifications.
```

### Platform Activity

```text
No activity for this period.
```

### Financial Snapshot

```text
No commission data for this period.
```

Zero is valid data and must not be rendered as a loading failure.

---

# 27. Loading States

The Dashboard should not appear blank while data is loading.

Recommended behavior:

- page shell renders
- Dashboard sections show skeleton/loading state
- loaded regions become interactive
- notification state resolves independently if loaded separately

Avoid using fake numbers as loading placeholders.

---

# 28. Error States

The Dashboard must handle:

- summary API failure
- notification API failure
- expired Admin session
- permission denial
- partial data failure
- temporary backend unavailability

## 28.1 Session Failure

```text
401 / unauthenticated
    ↓
resolve as signed out
    ↓
redirect /login
```

## 28.2 Permission Failure

```text
403
    ↓
do not expose protected data
    ↓
hide/disable corresponding feature region
```

## 28.3 Partial Failure

If notifications fail but KPI summary loads, the Dashboard should still show the successful KPI data.

Do not turn one non-critical widget failure into a completely unusable Dashboard unless the architecture returns all data atomically.

---

# 29. Refresh Behavior

The Dashboard should support receiving current information without requiring the Admin to repeatedly navigate away and back.

At minimum:

- data refreshes on Dashboard load
- actionable/notification data follows the chosen polling or real-time mechanism

A manual refresh action is optional.

The exact refresh interval is an implementation/configuration decision because the source docs do not define one.

---

# 30. Responsive Behavior

The Admin Dashboard is part of the web Admin application.

It should remain usable on different web viewport sizes.

Recommended behavior:

## Desktop

- KPI cards in a compact row/grid
- primary action center and notifications visible without excessive scrolling
- financial/activity visualization uses available width

## Tablet

- KPI cards wrap into fewer columns
- sections remain readable
- no horizontal overflow

## Narrow Viewport

- cards stack
- tables/action lists adapt to compact rows
- charts remain readable or simplify gracefully

The Dashboard remains an Admin operations interface rather than a mobile-first Courier interface.

---

# 31. Accessibility

The Dashboard should:

- use semantic heading hierarchy
- expose chart values in accessible text where charts are used
- not rely on color alone to communicate status
- provide accessible labels for controls
- maintain keyboard navigation
- maintain sufficient contrast
- expose loading and error states appropriately to assistive technology

---

# 32. Notification and Action Semantics

Visual severity should reflect a severity or status defined by the owning domain.

The Dashboard must not infer that every pending item is an emergency.

For example:

```text
pending registration ≠ critical security alert
```

If the platform later defines:

- priority
- severity
- SLA
- overdue state

the Dashboard may visualize those fields directly.

---

# 33. Time and Currency

## 33.1 Currency

AISLEY's documented fees are denominated in Philippine pesos.

Financial values should therefore use:

```text
PHP / ₱
```

unless the platform's financial configuration later supports additional currencies.

## 33.2 Time

Dashboard timestamps should be rendered consistently with the application's configured timezone strategy.

The source documents do not define the canonical persisted timezone.

Do not create Dashboard-specific timezone semantics.

---

# 34. Audit Considerations

`Admin.md` defines immutable System Audit Logs for administrative actions.

The Dashboard itself is primarily read-only.

Navigating from the Dashboard does not need to create a business audit record unless the audit specification later requires view tracking.

Any mutation performed in a destination Admin module must follow that module's audit requirements.

If future Dashboard quick actions are introduced, those actions must participate in the same audit mechanism as the full module.

---

# 35. Security and Privacy

The Dashboard must:

- require authenticated Admin access
- respect Admin permissions
- expose aggregate data only as needed
- avoid sensitive PII in overview cards
- avoid exposing internal authentication/session data
- use backend authorization for every Admin endpoint
- use existing CSRF/session protections for any state-changing requests
- safely escape notification/action text
- treat linked evidence and user data as protected resources
- avoid embedding secrets or financial formulas only on the client

---

# 36. Performance

Because the Dashboard is the primary Admin entry point, it must not execute unbounded scans on each page load.

Recommended implementation principles:

- use indexed status/role/time filters
- aggregate counts at the database layer
- reuse commission/reporting services
- cache expensive aggregate results when justified
- keep notification payload bounded
- paginate or limit action-center previews
- lazy-load heavy charts if needed
- fetch full records only after navigating to the owning module

Exact latency targets are not defined in the current project docs.

---

# 37. MVP Dashboard

For the first complete Dashboard implementation, include:

## Required

- authenticated `/dashboard`
- Dashboard header/context
- Pending Registrations KPI
- Open Complaints / Disputes KPI
- Seller Compliance KPI
- Platform Commission KPI
- high-level Platform Activity / order lifecycle summary
- Action Center preview
- Notifications panel
- navigation/drill-down into owning Admin modules
- loading states
- empty states
- error states
- permission-aware data exposure

## Optional for MVP

- role breakdown under pending registrations
- user/account aggregate section
- commission trend chart
- auto-refresh indicator
- manual refresh control

These optional items remain source-compatible but are not necessary to satisfy the core Dashboard definition.

---

# 38. Do Not Add to MVP Without Separate Specification

Do not add the following merely to make the Dashboard appear more feature-rich:

- arbitrary conversion rate
- gross merchandise value if not formally defined
- fake "system health" percentage
- invented seller score
- invented fraud score
- invented dispute SLA
- invented delivery SLA
- active-user analytics without a defined measurement
- profit calculations that conflict with Reports
- shipping-fee-as-platform-revenue calculation
- map-based rider tracking
- direct rider dispatch
- inline seller suspension
- inline registration approval/rejection
- inline dispute resolution
- marketing campaign creation

These require their own business definitions or belong to dedicated modules.

---

# 39. Suggested Page Structure

Conceptually:

```text
/dashboard

┌──────────────────────────────────────────────────────────────┐
│ Dashboard                              Admin / Notifications  │
│ Platform overview                                           │
├──────────────────────────────────────────────────────────────┤
│ Pending       │ Open          │ Compliance    │ Platform     │
│ Registrations │ Complaints    │ Items         │ Commission   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Platform Activity                                             │
│ Order lifecycle / high-level telemetry                        │
│                                                              │
├─────────────────────────────────┬────────────────────────────┤
│ Action Center                   │ Notifications              │
│                                 │                            │
│ Registration awaiting review    │ New registration          │
│ Compliance case                 │ New complaint             │
│ Complaint / dispute             │ Compliance alert          │
│                                 │                            │
├─────────────────────────────────┴────────────────────────────┤
│ Financial Snapshot / Commission Trend (optional MVP)         │
└──────────────────────────────────────────────────────────────┘
```

This is an information hierarchy, not a pixel-perfect UI mandate.

---

# 40. Functional Acceptance Criteria

## AC-01 — Authenticated Entry

Given a valid authenticated Admin session, when the Admin opens `/dashboard`, the Dashboard loads as the primary Admin entry page.

## AC-02 — Guest Protection

Given no valid Admin session, when `/dashboard` is requested, protected Dashboard content is not exposed and the user is directed to Admin login.

## AC-03 — Permission Protection

Given an authenticated Admin lacks permission for a protected Admin feature, the Dashboard does not expose unauthorized feature data or actionable controls for that feature.

## AC-04 — Pending Registration Count

Given Buyer, Seller, and Logistics registrations are pending Admin approval, the Dashboard displays an aggregate pending-registration count derived from those Admin-managed registration types.

## AC-05 — Courier Approval Boundary

Given Courier registrations are pending Logistics approval, they are not counted as normal Admin pending registrations.

## AC-06 — Registration Drill-Down

Given pending registrations exist, when the Admin selects the registration KPI/action, the Admin is taken to the registration-management workflow.

## AC-07 — Complaint Count

Given unresolved complaints/disputes exist, the Dashboard displays their aggregate unresolved count.

## AC-08 — Compliance Count

Given seller compliance cases require Admin review, the Dashboard displays the applicable pending compliance count.

## AC-09 — Platform Commission

Given authoritative commission transaction data exists, the Dashboard displays platform commission for its stated period using the same business logic as the Reports module.

## AC-10 — Shipping Fee Boundary

Given the default shipping fee is ₱50 and is documented as Logistics commission, the Dashboard does not automatically count the full shipping fee as AISLEY platform commission.

## AC-11 — Per-Order Platform Fee

Given applicable orders are subject to the documented AISLEY Logistics SaaS per-order fee, the commission calculation can include the documented ₱10 per-order platform fee through the authoritative financial/reporting logic.

## AC-12 — Subscription Amount

Given the base Logistics subscription amount is not defined in the source documents, the Dashboard obtains it from authoritative system configuration/billing data and does not hardcode an invented amount.

## AC-13 — Platform Activity

Given orders exist in multiple stages of the AISLEY order/logistics lifecycle, the Dashboard can summarize them into high-level lifecycle telemetry using the canonical order statuses already defined by the application.

## AC-14 — No Dispatch Duplication

Given Logistics has its own dispatch dashboard, the Admin Dashboard does not expose rider deployment controls or sorting-center operational controls.

## AC-15 — Action Center

Given actionable Admin-owned items exist, the Dashboard previews them and provides navigation to their owning Admin modules.

## AC-16 — High-Impact Actions

Given an actionable registration/compliance/dispute item appears on the Dashboard, the MVP Dashboard does not perform the final approval, suspension, deletion, or dispute resolution directly from the overview.

## AC-17 — Notifications

Given an Admin-relevant notification arrives, the Dashboard receives it through the system's supported polling or real-time notification mechanism.

## AC-18 — Empty State

Given a Dashboard metric has no matching records, the Dashboard displays a valid zero/empty state rather than treating the result as an error.

## AC-19 — Partial Failure

Given one independently loaded Dashboard region fails while another succeeds, the successfully loaded data remains usable where architecture permits.

## AC-20 — No Fake Production Data

Given the Dashboard is running against production/real application data, KPI cards and charts do not display hardcoded fake metrics.

## AC-21 — PII Minimization

Given Dashboard overview data is requested, the API returns only the aggregate or preview information required for the overview and avoids unnecessary sensitive user profile information.

## AC-22 — Reports Consistency

Given a Dashboard commission figure and a Reports Overview figure represent the same period and scope, they derive from the same authoritative financial rules and should reconcile.

---

# 41. Suggested Backend Tests

Test:

- guest cannot access Dashboard API
- non-Admin cannot access Dashboard API
- authorized Admin can access permitted Dashboard data
- permission-restricted Admin cannot receive unauthorized Dashboard data
- pending registration count includes Buyer/Seller/Logistics pending applications
- pending registration count excludes Courier approvals managed by Logistics
- complaint aggregate counts only the appropriate unresolved states
- seller-compliance aggregate counts the appropriate review states
- platform commission uses authoritative commission logic
- platform commission does not classify Logistics shipping commission as platform revenue
- Dashboard order counts map from canonical order state
- aggregate API returns zero rather than null/error when no records exist
- Dashboard endpoint does not expose password/session/sensitive fields
- queries do not load entire datasets merely to calculate counts

---

# 42. Suggested Frontend Tests

Where frontend testing infrastructure exists, test:

- authenticated Admin sees Dashboard
- unauthenticated visitor is redirected to login
- loading skeleton/state appears before summary resolution
- zero-state renders correctly
- KPI values render from API response
- KPI links navigate to correct Admin modules
- permission-hidden widgets/actions are not shown
- notification list displays returned notifications
- notification empty state renders correctly
- one widget failure does not incorrectly display fake values
- financial values use PHP/₱ formatting
- narrow viewport does not overflow horizontally

---

# 43. Open Decisions

The current source documents do not define:

1. exact Dashboard API route names
2. exact canonical order status enum
3. exact complaint/dispute status enum
4. exact seller-compliance case schema/statuses
5. exact notification event types
6. notification polling interval
7. whether Dashboard notifications use polling, SSE, or WebSockets
8. exact custom Admin permission model
9. exact Logistics base subscription amount
10. exact Dashboard default financial reporting period
11. whether financial trend chart is required for MVP
12. whether user-role totals are required for MVP
13. whether Dashboard metrics are cached
14. cache lifetime if caching is used
15. whether there is a dedicated Admin order-monitoring page
16. whether Admins should receive Courier SOS events directly or only through Logistics
17. exact definition of "platform health"
18. exact definition of active/inactive user analytics
19. notification retention/read-state rules
20. exact threshold or severity rules for critical notifications

These must not be silently invented during Dashboard implementation.

---

# 44. Source Traceability

## From `Admin.md`

The Dashboard derives:

- platform overview
- notifications
- centralized command interface
- KPIs
- pending actionable items
- aggregate queries
- primary Admin entry point
- real-time or polling notifications
- registration management
- seller compliance
- complaints/disputes
- commission reports
- custom Admin-adjacent modules through navigation

## From `app.md`

The Dashboard derives:

- Admin's role in account approvals
- Buyer/Seller/Logistics Admin approval flow
- Courier approval being owned by Logistics
- initial/additional Admin model
- order lifecycle
- integrated Logistics lifecycle
- Logistics SaaS commission model
- ₱10 per-order platform fee
- default ₱50 shipping fee as Logistics commission

## From `Buyer.md`

The Dashboard respects:

- Buyer ordering lifecycle
- Buyer order tracking
- Buyer complaints/support context through Admin-owned dispute workflows

Buyer-specific shopping and account features remain outside the Admin Dashboard.

## From `Seller.md`

The Dashboard respects:

- Seller order fulfillment responsibilities
- Seller's own sales/statistics Dashboard
- order notifications and preparation
- seller compliance as a separate Admin concern

Seller-private merchant analytics remain in the Seller application.

## From `Logistics.md`

The Dashboard respects:

- Logistics' seller-confirmed-order queue
- rider deployment
- status updates
- waybill workflow
- live courier-capacity monitoring

These operational controls remain in the Logistics application.

## From `Courier.md`

The Dashboard respects:

- Courier delivery request flow
- pickup/delivery lifecycle
- delivery completion
- incident reporting
- SOS/emergency events
- Courier-specific earnings/performance dashboards

Courier operations remain in the Courier application unless a future Admin requirement explicitly introduces a platform-level escalation view.

---

# 45. Final Dashboard Definition

The AISLEY Admin Dashboard is:

```text
an authenticated,
permission-aware,
platform-level command overview

that combines:

    Admin workload
        ├── pending registrations
        ├── seller compliance
        └── complaints/disputes

    platform performance
        ├── commission summary
        └── high-level order/activity telemetry

    attention signals
        ├── notifications
        └── actionable-item preview

while routing detailed work
to the dedicated Admin modules
and preserving Seller,
Logistics,
Buyer,
and Courier domain boundaries.
```

The Dashboard should optimize for one outcome:

```text
An Admin should be able to sign in,
understand the current state of AISLEY,
identify what needs attention,
and reach the correct management workflow quickly.
```
