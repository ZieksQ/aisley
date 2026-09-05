---
role: Logistics
feature: Dashboard
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Logistics Web Application
source_coverage: Logistics.md, app.md
---
# Logistics Dashboard Specification
## 1. Purpose
The Logistics Dashboard is the primary command and control interface for a Logistics user.
`Logistics.md` defines its core value as:
```text
View seller confirmed orders.
```
Its expanded definition is:
```text
A centralized command and control interface
for logistics dispatchers.

It aggregates and displays a real-time queue
of all parcels that have been processed by sellers
and are currently awaiting assignment
or sorting center processing.
```
The source further states that the Dashboard requires:
```text
real-time data fetching
through polling or WebSockets
from the Orders table
```
with Logistics-relevant statuses such as:
```text
READY_FOR_PICKUP
AT_SORTING_CENTER
```
This specification defines the Dashboard's data scope, queue behavior, status presentation, navigation boundaries, security, APIs, performance expectations, acceptance criteria, tests, and Open Decisions.
A separate `flow.md` is not required because the Dashboard is primarily a read/aggregation feature.
## 2. Primary Actor
The primary actor is:
```text
LOGISTICS
```
The Logistics user operates through the Logistics web application.
## 3. System Role
From `app.md`:
```text
Logistics
- is a company that ships orders
- manages order shipment
- performs route optimization
- manages courier/riders
- manages dispatching
```
The Dashboard provides the Logistics user with a current operational view of shipment work that requires Logistics processing.
## 4. Application Context
From `app.md`:
```text
Web:
Admin
Storefront
Seller
Logistics
```
The Logistics Dashboard belongs to the dedicated Logistics web domain/application.
## 5. Authentication
The Logistics web application uses:
```text
Laravel Sanctum
stateful HttpOnly session cookie
```
Login flow:
```text
GET /sanctum/csrf-cookie
POST /login
→ encrypted HttpOnly session cookie
```
Dashboard access requires an authenticated Logistics role-account.
## 6. Logistics Registration Context
From `app.md`:
```text
Logistics
register
→ Admin approved
→ email
→ sign in
→ subscription
```
Therefore:
```text
registration approval
≠
subscription
```
Whether subscription state restricts Dashboard access is not defined by the Dashboard source and remains an Open Decision.
## 7. Identity Rule
AISLEY stores all roles in the same `users` table.
Identity uniqueness is:
```text
unique(email, role)
```
Therefore Logistics authentication and Dashboard access must resolve the exact:
```text
user_id + LOGISTICS role
```
not email alone.
## 8. Core Responsibility
The Dashboard owns:
- Logistics operational overview
- seller-confirmed parcel/order queue
- current Logistics-relevant order status display
- real-time or near-real-time refresh
- bounded order summaries
- queue counts
- queue filtering
- queue sorting
- navigation to owning Logistics features
- loading, empty, stale, and error states
It does not own the underlying business mutations performed by those features.
## 9. Main Dashboard Question
The Dashboard should answer:
```text
Which seller-confirmed parcels currently require
Logistics attention or processing?
```
## 10. Source Order Scope
The source says the Dashboard displays parcels that:
```text
have been processed by sellers
```
and are:
```text
awaiting assignment
or
sorting center processing
```
The Dashboard must not become a generic list of every marketplace order.
## 11. Seller-Confirmed Boundary
From `app.md`:
```text
customer order
→ seller approved
→ seller packed
→ logistics flow
→ order delivered
```
The Logistics Dashboard begins after Seller-side processing reaches the Logistics handoff.
## 12. Logistics Flow Context
From `app.md`:
```text
courier door to door pick up
→ transfer & dispatch flow
→ logistics assigned courier for delivery
→ rider picks up for delivery
```
## 13. Transfer and Dispatch Context
From `app.md`:
```text
logistics receives order
→ waybill
→ sorted
→ transfer
→ dispatch
```
Transfer and dispatch may use:
```text
waybill QR
or
reference number
```
to automate status changes.
The Dashboard should reflect these operational states but should not own their mutation logic.
# Dashboard Data Scope
## 14. Primary Queue
The primary Dashboard data structure is:
```text
Logistics Order / Parcel Queue
```
It should represent currently actionable Logistics parcels.
## 15. Source Status Examples
`Logistics.md` explicitly names statuses such as:
```text
READY_FOR_PICKUP
AT_SORTING_CENTER
```
These are source-backed Logistics Dashboard filters.
## 16. Status List Is Not Exhaustive
The source says:
```text
statuses such as
READY_FOR_PICKUP
or
AT_SORTING_CENTER
```
Therefore these examples should not be interpreted as a complete final order-state machine.
The Dashboard should consume the authoritative Logistics-relevant status definitions from the order domain.
## 17. Order-State Authority
The Dashboard does not define the global order-state machine.
It reads the current authoritative order state.
## 18. Queue Inclusion Rule
Conceptually:
```text
order is Seller-processed
+
order is in Logistics-relevant state
+
order belongs to / is serviceable by this Logistics context
→ show in Dashboard queue
```
The exact Logistics ownership/assignment relation is an Open Decision.
## 19. Queue Exclusion
Do not include orders that are clearly outside the current Logistics operational scope.
Examples may include:
```text
unconfirmed Buyer cart
Seller-unapproved order
Seller-not-packed order
completed historical order
cancelled order
```
only where the authoritative order state confirms they are not actionable.
## 20. Historical Orders
Historical/completed orders should not dominate the primary operational queue.
If needed, they belong in:
```text
Order History
Shipment History
Reports
```
or a separate filtered view.
## 21. Current Queue Priority
The Dashboard should prioritize active operational work over historical reporting.
# Queue Summary
## 22. Recommended Summary
At minimum, the Dashboard should show a concise count of:
```text
Seller-confirmed / Logistics-actionable orders
```
Recommended breakdowns based on source-backed statuses:
```text
READY_FOR_PICKUP
AT_SORTING_CENTER
```
Additional status counts should be added only when the authoritative Logistics workflow defines them.
## 23. Count Consistency
A status count must use the same inclusion rule as the corresponding queue filter.
Example:
```text
READY_FOR_PICKUP count = 12
```
should correspond to:
```text
12 queue records
```
subject to pagination and real-time freshness.
## 24. No Misleading Zero
If a count fails to load:
```text
show unavailable/error
```
not:
```text
0
```
unless zero is actually known.
## 25. Summary Is Read-Only
Dashboard summary cards should primarily:
```text
preview
filter
navigate
```
They should not perform high-impact mutations directly.
# Queue Item
## 26. Order Identity
Every queue item should expose a stable order reference.
Recommended:
```text
order ID
order reference number
```
depending on implemented order schema.
## 27. Waybill Reference
Where a waybill already exists, the queue may display:
```text
waybill reference
```
The Waybill feature owns generation/printing behavior.
## 28. Seller Context
The queue should display enough Seller context to identify pickup origin.
Recommended safe summary:
```text
Seller / Shop
```
Exact fields depend on the Seller/order schema.
## 29. Buyer Context
The Dashboard may display enough delivery context to understand destination.
Avoid exposing unnecessary Buyer PII in the main queue.
## 30. Pickup Information
Recommended queue data may include:
```text
pickup location summary
```
if available and operationally required.
## 31. Delivery Information
Recommended queue data may include:
```text
delivery area / destination summary
```
Detailed address handling should follow privacy and dispatch requirements.
## 32. Current Status
Every queue item should clearly show:
```text
current order/logistics status
```
## 33. Status Timestamp
Recommended:
```text
status updated at
```
or equivalent latest operational timestamp.
## 34. Courier Assignment
If a courier is already assigned, the queue may show:
```text
assigned courier
```
The Deploy Rider feature owns assignment.
## 35. Assignment State
If no courier is assigned:
```text
Unassigned
```
may be shown.
The Dashboard does not itself define dispatch eligibility.
## 36. Sorting Center Context
For:
```text
AT_SORTING_CENTER
```
the Dashboard may show the relevant Logistics hub/sorting-center context if available.
## 37. Item Count
Whether product/item count is shown is optional and depends on useful operational context.
## 38. Weight / Volume
Weight/volumetric information may be operationally useful for Fleet/Deploy Rider.
However, it is not explicitly required by the Dashboard source.
Open Decision.
# Real-Time Behavior
## 39. Source Requirement
`Logistics.md` requires:
```text
real-time data fetching
```
with:
```text
polling
or
WebSockets
```
## 40. No Mandatory Third-Party
Real-time Dashboard updates do not inherently require a third-party provider.
AISLEY may use:
```text
polling
self-hosted WebSockets
SSE
```
or another project-supported mechanism.
## 41. Polling
Polling is source-supported.
If used:
```text
Dashboard
→ periodically refetch queue/counts
```
Exact interval is Open.
## 42. WebSockets
WebSockets are also source-supported.
If used:
```text
order state changes
→ realtime signal
→ Dashboard refresh/update
```
Exact infrastructure is Open.
## 43. Database Authority
Realtime events are not the authoritative state.
The authoritative state remains:
```text
Orders / shipment domain in backend/database
```
## 44. Reconnect
If realtime transport disconnects:
```text
reconnect
→ refetch authoritative queue
```
to recover missed updates.
## 45. Stale Data
If the Dashboard cannot refresh:
```text
show stale/error indication
```
rather than silently presenting outdated operational data as current.
## 46. No Duplicate Rows
Polling/realtime updates must not create duplicate queue rows for the same order.
# Filters
## 47. Status Filter
Required/recommended based on source:
```text
READY_FOR_PICKUP
AT_SORTING_CENTER
```
Additional Logistics-relevant statuses may be included when defined.
## 48. Assignment Filter
Recommended if assignment data exists:
```text
All
Unassigned
Assigned
```
This supports dispatch triage but is not explicitly source-required.
## 49. Date Filter
Optional:
```text
created date
seller-confirmed date
status-updated date
```
Exact date semantics are Open.
## 50. Seller Filter
Optional:
```text
Seller / Shop
```
useful for pickup coordination.
## 51. Search
Recommended search:
```text
order ID
order reference
waybill reference
Seller/shop
```
Exact search fields depend on schema.
## 52. Pagination
The queue must be bounded/paginated.
Do not load every active parcel into the browser.
## 53. Sorting
Recommended:
```text
oldest waiting first
newest first
latest status update
```
Exact default is Open.
## 54. Queue Aging
Displaying:
```text
time waiting
```
may help Logistics prioritize work.
This is recommended, not source-required.
# Dashboard Navigation
## 55. Deploy Rider Handoff
For an order requiring rider assignment:
```text
Dashboard
→ Deploy Rider
→ exact order
```
Deploy Rider owns:
- courier selection
- proximity calculation
- assignment
- automated/manual dispatch
## 56. Update Status Handoff
For an order requiring manual state correction/update:
```text
Dashboard
→ Update Status
→ exact order
```
Update Status owns the mutation.
## 57. Waybill Handoff
Where a parcel requires a waybill:
```text
Dashboard
→ Waybill
→ exact order
```
Waybill owns generation/printing.
## 58. Chat Handoff
Recommended:
```text
Dashboard
→ Chat / Messaging
→ order-linked thread
```
for pickup/delivery coordination.
## 59. Fleet Handoff
Vehicle Fleet Management is not a Dashboard mutation.
Deploy Rider may consume Fleet information during assignment.
## 60. Zone Mapping Handoff
Zone/Territory Mapping owns geographic zone configuration.
Dashboard may display zone labels later if helpful.
## 61. Capacity Monitoring Boundary
Flexible Availability & Capacity Monitoring is its own Logistics feature.
It owns:
```text
active rider count
online/available rider capacity
pending-order vs rider capacity
```
The main Dashboard should not silently duplicate the entire capacity-monitoring feature.
## 62. Capacity Preview
A small capacity summary/link may be added later if desired.
This is an Open Decision.
# Deploy Rider Boundary
## 63. Dispatch Responsibility
`Logistics.md` defines Deploy Rider separately.
Therefore Dashboard should not contain independent rider-selection logic.
## 64. Distance Calculation
Geospatial distance calculation belongs to Deploy Rider.
Dashboard may show assignment result but should not calculate rider proximity independently.
## 65. Mapbox Integration
`app.md` specifies:
```text
Mapbox Matrix and Optimization
```
for optimal routing for Logistics and Riders.
This external API is relevant primarily to routing/Deploy Rider.
The Dashboard does not require Mapbox simply to display the parcel queue.
# Update Status Boundary
## 66. Status Mutation
`Logistics.md` defines Update Status as:
```text
Update order status once rider pick up order.
```
The Dashboard reads status.
Update Status changes status.
## 67. No Inline Mutation Requirement
The source does not require Dashboard cards/rows to mutate status inline.
Recommended:
```text
Dashboard
→ open Update Status action/page
```
## 68. Scan Automation
`app.md` says status can be automated through:
```text
waybill QR scan
or
reference number
```
The Dashboard should reflect the resulting state after refresh.
It does not own scanner behavior.
# Waybill Boundary
## 69. Waybill Ownership
Waybill is a separate Logistics feature.
It owns:
```text
order details document
print
barcode / QR
```
## 70. Dashboard Waybill Display
Dashboard may display:
```text
waybill generated?
waybill reference
```
if operationally useful.
## 71. No PDF Requirement for Dashboard
The Dashboard itself does not require a PDF library.
That dependency belongs to Waybill.
# Chat Boundary
## 72. Logistics Messaging
`Logistics.md` defines Chat/Messaging separately for communication with:
```text
couriers
buyers
sellers
```
## 73. Dashboard Chat Entry
Dashboard may provide:
```text
Message
```
navigation for the selected order.
## 74. No Message Storage Duplication
Dashboard must not duplicate conversation history into Dashboard-specific records.
# Security
## 75. Authentication Requirement
Every Dashboard API requires an authenticated Logistics account.
## 76. Role Authorization
A Buyer, Seller, Courier, or Admin session must not be accepted as Logistics solely because the email matches.
Verify:
```text
role = LOGISTICS
```
## 77. Logistics Scope Authorization
A Logistics account should see only orders it is authorized to process.
Exact order-to-Logistics ownership assignment is not defined in the sources.
Open Decision.
## 78. IDOR Protection
Knowing an order ID must not allow a Logistics account to view an order outside its authorized Logistics scope.
## 79. PII Minimization
The Dashboard should expose only operationally needed Buyer/Seller data.
Avoid broad display of:
- unnecessary phone numbers
- full personal profile data
- payment credentials
- account security details
## 80. Payment Data
Never display:
```text
card number
CVV
payment token secret
bank credential
```
on the Logistics Dashboard.
## 81. XSS Safety
Seller names, Buyer names, address labels, and other user-generated text must be safely rendered.
# API
## 82. Recommended Dashboard API
Conceptual:
```http
GET /api/logistics/dashboard
```
It may return:
```text
queue summary
status counts
bounded queue records
freshness metadata
```
## 83. Alternative API Shape
The Dashboard may instead compose:
```http
GET /api/logistics/orders
GET /api/logistics/orders/counts
```
Exact API shape is Open.
## 84. Dashboard Is Read-Only
Dashboard GET endpoints must not mutate order state.
## 85. Query Parameters
Recommended:
```text
status
assignment_state
search
sort
page/cursor
```
Only implemented filters should be accepted.
## 86. Response Metadata
Recommended:
```text
generated_at
last_refreshed_at
pagination
```
to support freshness handling.
## 87. Order DTO
Conceptual safe queue record:
```json
{
  "order_id": "order-id",
  "reference": "ORDER-REF",
  "status": "READY_FOR_PICKUP",
  "seller": {},
  "pickup_summary": {},
  "delivery_summary": {},
  "assigned_courier": null,
  "waybill_reference": null,
  "status_updated_at": "..."
}
```
Exact schema must follow the implemented order domain.
# Performance
## 88. Query Efficiency
The Dashboard is an operational queue and should load quickly.
Avoid:
```text
N+1 Seller query
N+1 Buyer query
N+1 Courier query
```
## 89. Indexing
Likely useful indexed fields include:
```text
order status
Logistics ownership/assignment
updated_at
Seller reference
```
Exact indexes depend on schema.
## 90. Bounded Response
Do not return all actionable orders in one response.
Use:
```text
pagination
cursor
bounded page size
```
## 91. Summary Queries
Status counts should use efficient aggregate queries.
## 92. Cache
Short-lived caching may be used if operational freshness remains acceptable.
Exact cache TTL is Open.
## 93. Cache Invalidation
If caching is used, order status changes should become visible promptly.
## 94. Real-Time Load
If WebSockets are used, avoid broadcasting entire Dashboard payloads for every order update.
Recommended:
```text
signal affected order/status
→ client refetches or patches bounded data
```
# Reliability
## 95. Partial Failure
If one Dashboard section fails:
```text
show the other available data
```
where architecture permits.
## 96. Queue Failure
If the order queue fails to load:
```text
show explicit error
```
do not silently show an empty queue.
## 97. Count Failure
If summary counts fail:
```text
mark unavailable
```
rather than inventing zero.
## 98. Realtime Failure
If realtime transport fails:
```text
fallback to polling/refetch
```
if supported.
## 99. Refresh
The Admin/Logistics user should be able to manually refresh the Dashboard.
# UX
## 100. Recommended Layout
Conceptually:
```text
Logistics Dashboard
├── Queue Summary
│   ├── READY_FOR_PICKUP
│   └── AT_SORTING_CENTER
├── Filters / Search
└── Operational Order Queue
```
## 101. Queue Priority
The operational queue should be visually dominant.
The Dashboard should not be overloaded with unrelated analytics.
## 102. Summary Cards
Summary cards should be:
```text
clickable filters
or
navigation aids
```
rather than mutation buttons.
## 103. Order Row Action
Recommended actions may include:
```text
View
Deploy Rider
Update Status
Waybill
Message
```
Each routes to its owning feature.
## 104. Status Labels
Use human-readable labels while preserving machine statuses internally.
Example:
```text
READY_FOR_PICKUP
→ Ready for Pickup
```
## 105. Assignment Label
Clearly show:
```text
Assigned
Unassigned
```
where available.
## 106. Freshness
Recommended:
```text
Last updated <time>
```
if polling/realtime freshness can become uncertain.
## 107. Loading
Use:
```text
skeleton
spinner
bounded loading indicator
```
without blocking the entire application shell.
## 108. Empty State
Example:
```text
No Logistics orders currently require attention.
```
## 109. Filtered Empty State
Example:
```text
No orders match the selected filters.
```
## 110. Error State
Provide:
```text
Retry
```
for recoverable Dashboard errors.
## 111. Responsive Behavior
The Logistics Dashboard should remain usable across practical web viewport sizes.
The source specifies Logistics as a web application.
## 112. Accessibility
The Dashboard should:
- use semantic headings
- expose status in text
- support keyboard navigation
- provide accessible table/list labels
- not rely on color alone
- announce refresh/error state appropriately
# Data Freshness
## 113. Operational Freshness
Because the source describes a:
```text
real-time queue
```
the Dashboard should refresh frequently enough for dispatch operations.
Exact latency/SLO is Open.
## 114. Server Timestamp
Use server-generated timestamps for order/status freshness.
## 115. Client Clock
Do not rely on the browser clock as the authoritative order event timestamp.
# Third-Party Dependencies
## 116. Dashboard Core
The Logistics Dashboard itself does not require a third-party provider.
It can operate with:
```text
AISLEY backend
Orders database
polling or self-hosted realtime
```
## 117. Mapbox Boundary
`app.md` selects:
```text
Mapbox Matrix and Optimization
```
for route optimization.
This is not required for the basic Dashboard queue.
It becomes relevant when the user enters:
```text
Deploy Rider / routing
```
## 118. Google Maps Boundary
`app.md` also lists Maps JavaScript/Places for address completion.
The Dashboard may render existing address/location data without requiring a new address-completion call.
## 119. Brevo Boundary
Brevo is used for email.
The Logistics Dashboard does not need Brevo merely to display the operational queue.
# Audit
## 120. Read-Only Dashboard
Routine Dashboard viewing should not create System Audit Log mutation events.
## 121. Linked Mutations
If the user navigates to:
```text
Deploy Rider
Update Status
Waybill
```
those features own any necessary audit/history events.
# MVP Scope
## 122. Required
- authenticated Logistics Dashboard
- exact Logistics role authorization
- seller-confirmed Logistics order queue
- Logistics-relevant order filtering
- `READY_FOR_PICKUP` visibility
- `AT_SORTING_CENTER` visibility
- real-time or polling refresh
- order reference
- current status
- Seller/shop context
- operational pickup/destination summary where available
- assigned/unassigned courier indicator where available
- search/filter
- pagination
- loading state
- empty state
- error state
- freshness handling
- navigation to owning Logistics features
- PII minimization
- IDOR protection
## 123. Recommended
- queue summary counts
- clickable status cards
- manual refresh
- waybill reference
- status timestamp
- queue aging indicator
- assignment filter
- seller filter
- bounded Dashboard API
- reconnect/refetch behavior
## 124. Not Required
- inline rider assignment logic
- geospatial proximity calculation
- route optimization
- vehicle capacity matching
- order status mutation
- waybill PDF generation
- barcode/QR generation
- full chat history
- Fleet management
- zone editor
- full rider-capacity monitoring
- financial reporting
- third-party realtime provider
# Acceptance Criteria
## 125. AC-01 — Authentication
Unauthenticated users cannot access the Logistics Dashboard.
## 126. AC-02 — Role
A non-Logistics role cannot access Logistics Dashboard APIs solely because it shares the same email.
## 127. AC-03 — Exact Identity
Dashboard authorization resolves the exact Logistics role-account.
## 128. AC-04 — Queue Scope
The Dashboard does not return arbitrary marketplace orders outside Logistics processing scope.
## 129. AC-05 — Seller-Processed
Orders shown in the primary queue have reached the Seller-to-Logistics handoff according to authoritative order state.
## 130. AC-06 — Ready for Pickup
Orders in `READY_FOR_PICKUP` can appear in the relevant Dashboard view.
## 131. AC-07 — Sorting Center
Orders in `AT_SORTING_CENTER` can appear in the relevant Dashboard view.
## 132. AC-08 — Authoritative State
The Dashboard reads current order status from the backend/order domain.
## 133. AC-09 — Read-Only
Loading or filtering the Dashboard does not mutate order status.
## 134. AC-10 — Count Consistency
Status summary counts use the same queue inclusion rules as their filters.
## 135. AC-11 — Pagination
The queue is bounded/paginated.
## 136. AC-12 — Search
Configured order/waybill/Seller search operates only within the authorized Logistics scope.
## 137. AC-13 — Realtime/Polling
The Dashboard can receive/refetch updated order state without requiring a full user re-login.
## 138. AC-14 — Reconnect
After a realtime disconnect, the client can refetch authoritative queue data.
## 139. AC-15 — No Duplicate
Refresh/realtime updates do not create duplicate order rows.
## 140. AC-16 — Error Accuracy
A failed queue request is not shown as a valid empty queue.
## 141. AC-17 — Count Error Accuracy
A failed count is not represented as zero.
## 142. AC-18 — Deploy Rider Boundary
Rider assignment is performed by Deploy Rider, not by independent Dashboard logic.
## 143. AC-19 — Update Status Boundary
Order status mutation is owned by Update Status/scan workflow.
## 144. AC-20 — Waybill Boundary
Dashboard does not implement independent PDF/barcode generation.
## 145. AC-21 — Capacity Boundary
Flexible Availability & Capacity Monitoring remains a separate feature.
## 146. AC-22 — PII
Dashboard responses do not expose unnecessary Buyer/Seller private data or payment secrets.
## 147. AC-23 — IDOR
A Logistics user cannot fetch another unauthorized Logistics scope's order by guessing its ID.
## 148. AC-24 — No Dashboard Third Party
The basic Dashboard does not require a new external provider.
# Tests
## 149. Backend Tests
Test:
- guest denied
- Buyer denied
- Seller denied
- Courier denied
- authenticated Logistics allowed
- same-email non-Logistics account does not gain access
- exact Logistics scope enforced
- seller-confirmed actionable order appears
- pre-Logistics order excluded
- READY_FOR_PICKUP filtering
- AT_SORTING_CENTER filtering
- status count consistency
- order reference returned
- Seller/shop safe context returned
- unauthorized PII absent
- payment secrets absent
- assignment indicator returned where applicable
- pagination
- sorting
- search
- stale/invalid order ID authorization
- Dashboard GET does not mutate order
- efficient query behavior
- no duplicate order from joins
## 150. Frontend Tests
Test:
- Dashboard loads
- queue summary renders
- READY_FOR_PICKUP filter
- AT_SORTING_CENTER filter
- search
- pagination
- loading state
- empty state
- filtered empty state
- queue error state
- count error state
- manual refresh if implemented
- realtime/polling refresh
- reconnect/refetch
- duplicate rows avoided
- order status label
- Seller/shop context
- assigned/unassigned indicator
- Deploy Rider navigation
- Update Status navigation
- Waybill navigation
- Message navigation
- responsive layout
- keyboard accessibility
- status not color-only
# Open Decisions
## 151. Open Decisions
The current sources do not define:
1. exact Logistics Dashboard route
2. exact Dashboard API shape
3. exact order-to-Logistics ownership relation
4. whether subscription status gates Dashboard access
5. full Logistics order-state list
6. whether `READY_FOR_PICKUP` and `AT_SORTING_CENTER` are final enum names
7. default queue sort
8. page size
9. polling interval
10. WebSocket vs polling selection
11. realtime infrastructure
12. cache strategy/TTL
13. exact queue summary cards
14. whether assignment filter is MVP
15. Seller/shop search behavior
16. date filter semantics
17. queue aging threshold/display
18. exact Buyer destination fields shown
19. exact Seller pickup fields shown
20. whether phone numbers are visible in queue
21. waybill-reference visibility
22. weight/volume display
23. sorting-center/hub display
24. zone label display
25. capacity preview on main Dashboard
26. active rider preview on main Dashboard
27. whether completed/history tab exists
28. exact row actions
29. realtime freshness target/SLO
30. whether Dashboard allows any safe inline action in future
# Final Definition
## 152. Final Definition
AISLEY Logistics Dashboard is:
```text
a real-time operational queue
for seller-confirmed parcels
that currently require Logistics processing.
```
Primary source-backed states include:
```text
READY_FOR_PICKUP
AT_SORTING_CENTER
```
The Dashboard is primarily:
```text
view
aggregate
filter
search
refresh
navigate
```
It does not own:
```text
rider assignment
order-state mutation
waybill generation
vehicle management
zone configuration
capacity monitoring
```
Central architecture rule:
```text
Orders / shipment domain
= authoritative state

Logistics Dashboard
= operational read model
```
Third-party rule:
```text
No new third-party provider
is required for the basic Logistics Dashboard.
```
