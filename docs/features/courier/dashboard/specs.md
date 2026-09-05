---
role: Courier/Rider
feature: Dashboard
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Flutter Courier Mobile Application
source_coverage: Courier.md, app.md
---
# Courier / Rider Dashboard Specification
## 1. Purpose
The Courier / Rider Dashboard is the primary mobile operations hub for AISLEY Couriers.
`Courier.md` defines the Dashboard Core Value as:
```text
check delivery notifications
view available pickup requests
```
Its Expanded Definition states:
```text
The central hub for courier operations.

It displays real-time alerts
for new job allocations

and allows the driver
to browse a queue
of available packages
waiting for pickup

at sorting centers
or seller locations.
```
Its System Context states:
```text
Requires polling
or persistent connections
like WebSockets

connected to a logistics dispatch system

to stream live request data.
```
This specification defines the Courier Dashboard as a mobile read/aggregation surface that exposes current delivery opportunities and assigned operational work while routing stateful actions into their owning Courier features.
A separate `flow.md` is not required because the Dashboard itself is primarily a live read/aggregation and navigation surface.
## 2. Primary Actor
Primary actor:
```text
COURIER / RIDER
```
The Courier accesses the Dashboard through the dedicated Flutter mobile application.
## 3. Application Context
From `app.md`:
```text
Mobile App:
- Rider
- Storefront
```
Therefore the Courier Dashboard is a mobile-first feature.
## 4. Authentication Context
From `app.md`, Flutter uses:
```text
stateless Bearer tokens
personal_access_tokens
```
Login flow:
```text
Flutter sends:
credentials
+
device_name
→ /login

Laravel:
createToken()
→ returns plain-text token

Flutter:
stores token in flutter_secure_storage

Future requests:
Authorization: Bearer <token>
```
The Dashboard must use this existing mobile-authentication model.
## 5. Token Storage Rule
The Courier mobile app must store the Bearer token using:
```text
flutter_secure_storage
```
Do not use browser-cookie assumptions for the Courier mobile application.
## 6. Role Identity
AISLEY identity uniqueness is:
```text
unique(email, role)
```
Therefore the Dashboard must resolve the authenticated:
```text
user_id + COURIER role
```
and not email alone.
A same-email Buyer/Seller/Logistics account is a separate logical account.
# Courier Account Lifecycle Context
## 7. Registration Flow
From `app.md`:
```text
Courier
→ search for Logistics hubs
→ register for that Logistics
→ Logistics Admin approved
→ sign in
```
Therefore Dashboard access occurs after the Courier account is approved and able to sign in.
## 8. Approval Boundary
Courier account approval belongs to Logistics.
The Dashboard does not:
```text
approve itself
change registration state
switch Logistics organization arbitrarily
```
## 9. Logistics Relationship
The Courier is registered under a Logistics organization.
Dashboard data must be scoped to the Courier's authorized Logistics relationship.
# Core Responsibility
## 10. Dashboard Owns
The Courier Dashboard owns:
- delivery/job notification summary
- available pickup-request queue
- current assigned/accepted delivery-task summaries where applicable
- real-time or near-real-time refresh
- bounded request/task cards
- unread/new allocation indicators
- loading/empty/error/reconnect states
- navigation to stateful Courier features
- safe operational order/package summaries
- mobile-friendly queue presentation
## 11. Dashboard Does Not Own
The Dashboard does not independently own:
- accepting a delivery request
- changing task status to `ACCEPTED`
- parcel pickup confirmation
- barcode/package scanning
- changing state to `IN_TRANSIT`
- navigation/routing
- proof of delivery
- marking an Order `DELIVERED`
- chat-message persistence
- incident creation
- SOS alert creation
- earnings calculation
- delivery-history persistence
Those belong to their corresponding Courier features.
## 12. Main Dashboard Question
The Dashboard should answer:
```text
What delivery work
is available or assigned to me now?
```
# Source-Backed Dashboard Content
## 13. Delivery Notifications
The source explicitly requires:
```text
check delivery notifications
```
The Dashboard should expose current delivery/job allocation alerts.
## 14. Available Pickup Requests
The source explicitly requires:
```text
view available pickup requests
```
The Dashboard should provide a queue of pickup opportunities available to the Courier according to dispatch rules.
## 15. New Job Allocations
The source states:
```text
real-time alerts
for new job allocations
```
A new allocation should become visible without requiring the Courier to restart or reauthenticate the app.
## 16. Pickup Origins
The source explicitly says available packages may wait at:
```text
sorting centers
or
seller locations
```
Therefore request summaries should distinguish the pickup origin/context where available.
## 17. Available Packages
The Dashboard may display the package/task summary required for the Courier to decide whether to open the request.
The Dashboard should not expose unnecessary Buyer/Seller private data.
# Relationship to Accept Delivery Requests
## 18. Accept Feature Boundary
`Courier.md` separately defines:
```text
Accept Delivery Requests
```
as the job-confirmation interface.
Therefore the Dashboard should not duplicate full acceptance logic.
## 19. Dashboard Handoff
Recommended:
```text
Dashboard
→ select available request
→ Accept Delivery Request
```
## 20. Request Review
The Dashboard may show a compact preview.
Detailed review of:
```text
pickup
delivery
distance
route
package size
```
belongs primarily to Accept Delivery Requests.
## 21. Acceptance State Mutation
`Courier.md` states acceptance:
```text
changes delivery task status
to ACCEPTED

and assigns the task
to courier_id
```
The Dashboard must not perform this mutation merely because a request card was opened.
## 22. Source Ambiguity with Logistics Deploy Rider
`Logistics.md` states Logistics may manually assign tasks, while `Courier.md` states Courier acceptance assigns `courier_id`.
The exact dispatch-offer/final-assignment model remains an Open Decision.
The Dashboard should reflect the model selected by the delivery-task domain.
# Available Request Queue
## 23. Queue Purpose
The queue represents currently available delivery/pickup opportunities visible to the Courier.
## 24. Queue Authority
The Logistics dispatch/delivery-task system is authoritative for which requests are available.
The mobile app must not infer availability from cached order data alone.
## 25. Request Eligibility
The exact eligibility rules are not defined in `Courier.md`.
The Dashboard should consume already-authorized request results from the backend.
Do not reimplement:
```text
Zone eligibility
vehicle capacity
routing eligibility
Logistics ownership
```
on the client.
## 26. Request Disappearance
A request may cease to be available because:
```text
another Courier accepted it
Logistics reassigned it
task state changed
order state changed
```
according to the final dispatch model.
The Dashboard must handle this gracefully.
## 27. Stale Request
If the Courier opens a request that is no longer available:
```text
show current authoritative state
```
and do not present it as still accept-able.
## 28. Queue Pagination
The request queue should be bounded.
Do not load an unbounded list of available tasks into mobile memory.
## 29. Sorting
The source does not define default request ordering.
Open Decision.
Possible options may include:
```text
nearest
newest
oldest waiting
Logistics priority
```
but these must not be invented as authoritative without policy.
## 30. Search
Search is not source-required for the live pickup queue.
Open Decision.
## 31. Filters
Potential filters are not defined.
Do not require them for MVP unless operationally necessary.
# Request Card
## 32. Stable Task Identity
Every request should use a stable:
```text
delivery_task_id
```
or equivalent domain identifier.
Exact schema is Open.
## 33. Order Reference
A safe order/package reference may be displayed.
## 34. Pickup Context
Source-backed pickup locations include:
```text
sorting center
seller location
```
The card should identify the relevant origin.
## 35. Delivery Context
The card may show a safe destination summary needed for decision-making.
Detailed private Buyer information should be deferred until authorized/necessary.
## 36. Package Summary
Since Accept Delivery Requests evaluates:
```text
package size
```
the Dashboard may show a concise package summary if available.
## 37. Distance
Detailed route/distance evaluation belongs to Accept Delivery Requests.
A compact route metric may be shown if the backend already provides it.
## 38. Current State
The request card should show the current delivery-task/request state in human-readable form where useful.
## 39. Timestamp
Recommended:
```text
request created/allocated at
```
or similar timing information.
Exact field is Open.
# Assigned / Accepted Work
## 40. Accepted Task Context
Once a task reaches:
```text
ACCEPTED
```
it is no longer merely an available request.
The Dashboard may surface it as:
```text
current task
active delivery
```
## 41. Dashboard Operational Hub
Because the source calls the Dashboard:
```text
central hub for courier operations
```
it is reasonable for the Dashboard to summarize currently accepted/active work in addition to available requests.
This is an inference from the source framing, not a separate explicit Core Value.
## 42. Active Task Handoffs
Depending on current state, Dashboard navigation may route to:
```text
Pick Up Order
Deliver Order
Complete Delivery
Chat / Messaging
Incident Reporting
SOS
```
## 43. No Duplicate State Logic
The Dashboard should read the task's state and choose the relevant navigation target.
The owning feature performs the mutation.
# Pick Up Order Boundary
## 44. Pick Up Order Source
`Courier.md` defines Pick Up Order as:
```text
Proceed to sorting center
Verify Order Information
Confirm Item Pickup
```
with:
```text
camera/barcode scanning
→ validate Order/Package ID
→ state = IN_TRANSIT
```
## 45. Dashboard Handoff
An accepted pickup task may show:
```text
Proceed to Pickup
```
routing to Pick Up Order.
## 46. No Pickup Mutation
Opening the Dashboard must not mark a parcel:
```text
IN_TRANSIT
```
# Deliver Order Boundary
## 47. Deliver Order Source
Deliver Order provides:
```text
task tracking
navigational context
```
during active transit.
## 48. Dashboard Handoff
An active `IN_TRANSIT` task may route to:
```text
Deliver Order
```
## 49. Mapbox
From `app.md`:
```text
Mapbox Matrix and Optimization
```
is selected for route optimization for Logistics and Riders.
The Dashboard itself does not need to calculate routes independently.
# Complete Delivery Boundary
## 50. Complete Delivery Source
Complete Delivery performs the final order state change to:
```text
DELIVERED
```
and triggers Buyer/Seller notifications.
## 51. Dashboard Handoff
When a task is eligible for completion:
```text
Dashboard
→ Complete Delivery
```
## 52. No Completion Mutation
The Dashboard must never mark an order delivered merely because the task card is viewed.
# Proof of Delivery Boundary
## 53. e-POD
Proof of Delivery owns:
```text
photo
e-signature
QR verification
```
where required.
## 54. Dashboard Preview
Dashboard may show whether proof is pending/complete if that state exists.
It does not capture evidence itself.
# Delivery History Boundary
## 55. Historical Work
Delivery History owns:
```text
completed delivery requests
```
filtered by active `courier_id` where status is:
```text
COMPLETED
```
## 56. Dashboard Link
Dashboard may link to Delivery History.
Historical jobs should not dominate the live operations view.
# Earnings Boundary
## 57. Profit Dashboard
Profit Dashboard owns Courier earnings aggregation.
## 58. Earnings & Goal Tracker
Earnings & Goal Tracker owns personal financial goal visualization.
## 59. Dashboard Preview
A small earnings preview is not source-required for the Courier Dashboard.
Open Decision.
Do not duplicate earnings calculations inside Dashboard if later added.
# Chat Boundary
## 60. Courier Chat
Courier Chat allows communication with:
```text
Buyer
Seller
Logistics
```
for active-order delivery coordination.
## 61. Dashboard Handoff
An active task may provide:
```text
Message
```
navigation.
Dashboard does not store conversation history.
# Incident Reporting Boundary
## 62. Incident Reporting
Incident Reporting owns creation of delivery blockers such as:
```text
vehicle breakdown
accident
inaccessible address
```
## 63. Dashboard Handoff
Active task may provide:
```text
Report Incident
```
navigation.
# SOS Boundary
## 64. Emergency Feature
SOS/Emergency Button is a separate safety feature.
## 65. Dashboard Access
Because the feature is described as:
```text
quick-access
```
the Rider application may make SOS easily reachable from the Dashboard/app shell.
Exact UI placement is a design decision.
The Dashboard does not own SOS business logic.
# Real-Time Behavior
## 66. Source Requirement
The Dashboard requires:
```text
polling
or
persistent connections
like WebSockets
```
to receive live request data.
## 67. Real-Time Purpose
Realtime/near-realtime updates should cover at least:
```text
new job allocation
request removed/unavailable
task state changes
```
where supported.
## 68. No Required Third-Party Realtime Provider
The source does not require a hosted realtime provider.
AISLEY may use:
```text
polling
WebSockets
```
or another project-supported mechanism.
## 69. Server Authority
Realtime signals are not the authoritative state.
The backend delivery-task system remains authoritative.
## 70. Reconnect
After a persistent-connection failure:
```text
reconnect
→ refetch authoritative Dashboard data
```
## 71. Polling Fallback
If persistent connection is unavailable:
```text
polling
```
may be used.
Exact interval is Open.
## 72. Stale State
If Dashboard data cannot refresh:
```text
show stale/offline/error condition
```
instead of silently presenting old requests as current.
# Mobile Connectivity
## 73. Mobile Environment
The Courier operates through a mobile app and may experience variable connectivity.
## 74. Dashboard Offline Mode Boundary
`Courier.md` separately defines:
```text
Offline Mode
```
for pre-cached active job data and synchronization.
Therefore full offline behavior is not owned by Dashboard.
## 75. Online Queue Requirement
Available pickup requests should generally require current server connectivity because availability can change quickly.
## 76. Cached Active Task
If Offline Mode is later implemented, Dashboard may show cached active-task information.
That belongs to Offline Mode's sync policy.
# Notifications
## 77. Delivery Notifications
The Dashboard Core Value requires:
```text
check delivery notifications
```
## 78. In-App Operational Alert
At minimum, the Dashboard must visibly surface new job allocations inside the Courier app.
## 79. Mobile Push
`Courier.md` does not explicitly require a mobile Push provider for Dashboard.
A new request can be surfaced via:
```text
persistent connection
polling
```
while the app is active.
Whether background Push notifications are added is Open.
## 80. No Email Requirement
Brevo email is not required for Rider Dashboard delivery notifications.
## 81. Notification Read State
Whether job notifications have persistent:
```text
READ / UNREAD
```
state is not defined.
Open Decision.
## 82. Allocation vs Request
The exact difference between:
```text
new job allocation
available pickup request
```
depends on the final Deploy Rider / Courier acceptance model.
Open Decision.
# API
## 83. Dashboard Endpoint
Conceptual:
```http
GET /api/courier/dashboard
```
Recommended response sections:
```text
notifications
available_requests
active_tasks
freshness metadata
```
Only implemented sections should be included.
## 84. Available Requests
Alternative conceptual endpoint:
```http
GET /api/courier/delivery-requests
```
## 85. Active Tasks
Alternative:
```http
GET /api/courier/delivery-tasks/active
```
## 86. Notification Feed
Possible:
```http
GET /api/courier/notifications
```
if persistent notification state exists.
Exact route structure is Open.
## 87. Dashboard Is Read-Oriented
Dashboard retrieval must not mutate task/order state.
## 88. Pagination
Available requests and other lists should support:
```text
page
cursor
bounded limit
```
## 89. Response Metadata
Recommended:
```text
generated_at
last_updated_at
pagination
```
# Authorization and Security
## 90. Bearer Authentication
Courier Dashboard APIs require a valid Courier Bearer token.
## 91. Exact Role
Backend verifies:
```text
role = COURIER
```
## 92. Courier Scope
Only requests/tasks authorized for the Courier and their Logistics context may be returned.
## 93. IDOR
Knowing:
```text
task_id
order_id
package_id
```
must not provide unauthorized data.
## 94. PII Minimization
Available requests should not expose more Buyer/Seller information than the Courier needs to evaluate/perform the task.
## 95. Payment Data
Never expose:
```text
card details
CVV
payment tokens
Buyer payment credentials
```
## 96. Token Protection
Never log or display:
```text
Authorization Bearer token
plain-text personal access token
```
## 97. Mobile Logs
Production mobile logs should avoid sensitive order/customer information beyond necessary diagnostics.
# Data Model / Read Model
## 98. Delivery Task
The Dashboard likely consumes a:
```text
delivery task
```
or equivalent dispatch entity.
The exact schema is not defined.
## 99. Delivery Task State
Explicit Courier source states include:
```text
ACCEPTED
IN_TRANSIT
```
Other task/order states exist in separate features.
## 100. Order State
`Complete Delivery` changes the core Order to:
```text
DELIVERED
```
`Delivery History` references completed delivery tasks with:
```text
COMPLETED
```
Therefore task state and order state may be distinct.
## 101. Do Not Collapse State Domains
Recommended:
```text
delivery_task.status
≠
order.status
```
unless the actual domain deliberately uses one state machine.
Dashboard should consume the implemented authoritative model.
# Performance
## 102. Mobile Payload
Dashboard payloads should be compact.
Avoid returning full:
```text
order history
chat history
POD media
incident history
```
during initial Dashboard load.
## 103. Bounded Lists
Return a bounded number of available requests.
## 104. Pagination
Additional results load incrementally.
## 105. Query Efficiency
Avoid N+1 queries across:
```text
orders
packages
Seller
Buyer
Logistics
```
## 106. Realtime Payload
Persistent events should be compact.
Recommended:
```text
event type
task/request ID
minimal preview/change metadata
```
then refetch authoritative detail as needed.
# UX
## 107. Recommended Dashboard Structure
Conceptually:
```text
Courier Dashboard
├── New / Delivery Notifications
├── Current / Active Task
└── Available Pickup Requests
```
Only sections supported by actual task state should appear.
## 108. Mobile Priority
The Dashboard should prioritize:
```text
current delivery work
new available requests
```
over analytics.
## 109. Notification Banner / List
New allocations should be visible and actionable.
## 110. Active Task Card
If the Courier already has active work, show a clear next-step action.
Examples depend on state:
```text
Review Request
Proceed to Pickup
Continue Delivery
Complete Delivery
```
## 111. Request Queue
Available pickup requests should be presented as touch-friendly cards/list rows.
## 112. Origin Label
Clearly distinguish:
```text
Seller Pickup
Sorting Center Pickup
```
where known.
## 113. Refresh
Provide pull-to-refresh or another mobile-appropriate manual refresh pattern.
Exact design is Open.
## 114. New Data Indicator
If new requests arrive while the Courier is viewing another part of the Dashboard, the UI may show a new-request indicator.
## 115. Loading State
Use mobile-appropriate loading indicators/skeletons.
## 116. Empty Request State
Example:
```text
No pickup requests are currently available.
```
## 117. No Active Task State
Example:
```text
You have no active delivery task.
```
## 118. Error State
Example:
```text
Unable to refresh delivery requests.
```
with retry.
## 119. Stale State
If data may be outdated:
```text
Last updated <time>
```
and stale/offline indicator may be shown.
## 120. Accessibility
The Dashboard should:
- use accessible text labels
- support screen readers
- use adequate touch targets
- not communicate state by color alone
- expose refresh/error status textually
- provide readable pickup/delivery summaries
# Third-Party Dependencies
## 121. Core Dashboard
No new third-party provider is required for the Dashboard itself.
Core can use:
```text
AISLEY backend
delivery-task system
polling / WebSockets
```
## 122. Mapbox
Mapbox is selected in `app.md` for:
```text
optimal route system
for Logistics and Riders
```
It is relevant when the Courier opens route/navigation behavior.
The basic Dashboard queue does not need independent Mapbox route calculation.
## 123. Brevo
Brevo is not required for the in-app Courier Dashboard.
## 124. Mobile Push Provider
No specific Push provider is source-mandated for this Dashboard.
If background mobile Push is later required, that becomes a separate architecture decision.
# Reliability
## 125. Partial Failure
If available requests load but another Dashboard section fails, show available data where practical.
## 126. Queue Failure
Do not show a failed request query as a legitimate empty queue.
## 127. Realtime Failure
Reconnect/refetch or polling fallback should preserve usability.
## 128. Duplicate Request Events
Realtime retries must not duplicate the same request card.
Use stable task/request IDs.
## 129. Removed Request
If a request disappears from server availability, remove/mark it after authoritative refresh.
# Logging / Audit Boundary
## 130. Dashboard Reads
Routine Dashboard views do not need to create Admin System Audit Log mutation records.
## 131. Stateful Actions
Accept/Pickup/Complete/etc. own their own operational history.
## 132. Notification Telemetry
Whether delivery-alert impressions/read events are recorded is Open.
# MVP Scope
## 133. Required
- Flutter Courier Dashboard
- valid Bearer-token authentication
- exact Courier role authorization
- Logistics-scoped request/task data
- delivery/job notification surface
- available pickup-request queue
- sorting-center/Seller pickup context
- live or near-real-time refresh
- polling or persistent connection
- bounded lists/pagination
- task/request stable identity
- loading/empty/error/reconnect states
- manual refresh
- navigation to Accept Delivery Requests
- navigation to active Courier task features
- PII minimization
- token protection
- IDOR protection
## 134. Recommended
- current/active task summary
- freshness timestamp
- compact package summary
- safe destination summary
- origin label
- new-request indicator
- pull-to-refresh
- persistent connection with refetch recovery
## 135. Not Required
- accepting requests directly from initial Dashboard fetch
- parcel scanning
- status mutation
- route optimization inside Dashboard
- POD capture
- chat persistence
- incident creation
- earnings aggregation
- delivery-history query
- AI ranking
- mobile Push provider
- Brevo
- SMS
- full Offline Mode synchronization
# Acceptance Criteria
## 136. Authentication
- Unauthenticated mobile requests cannot load the Courier Dashboard.
- A non-Courier Bearer token cannot access Courier Dashboard APIs.
- Same-email other-role accounts do not receive Courier access.
- Dashboard uses the authenticated Courier identity.
## 137. Scope
- Courier receives only authorized request/task data.
- Cross-Logistics unauthorized tasks are not exposed.
- Task/order IDs cannot bypass authorization.
## 138. Delivery Notifications
- New job allocations become visible through configured refresh/realtime behavior.
- Failed refresh is not represented as "no notifications".
- Dashboard does not require email to show an in-app allocation.
## 139. Available Pickup Requests
- Courier can view available pickup requests.
- Pickup origin can represent sorting center or Seller location where available.
- Request list is bounded/paginated.
- Request no longer available is handled as stale/current-authority conflict.
## 140. Read-Only Boundary
- Loading Dashboard does not accept a request.
- Opening a request does not set `ACCEPTED`.
- Loading Dashboard does not mark a parcel `IN_TRANSIT`.
- Loading Dashboard does not mark an Order `DELIVERED`.
## 141. Handoffs
- Request can navigate to Accept Delivery Requests.
- Accepted/current task can navigate to the appropriate pickup/delivery feature.
- Dashboard does not duplicate the owning feature's state mutation.
## 142. Realtime
- Polling or persistent connection can refresh request data.
- Reconnect results in authoritative refetch.
- Duplicate realtime events do not duplicate request rows.
- Stale data can be identified.
## 143. Mobile Security
- Token is expected to be stored via secure mobile storage.
- Bearer token is not returned in Dashboard payloads.
- PII is minimized.
- Payment/security secrets are absent.
## 144. Third-Party
- Basic Dashboard works without a new third-party provider.
- Mapbox is not required merely to list requests.
- Brevo/SMS are not required.
- A specific Push vendor is not required.
# Tests
## 145. Backend Tests
Test:
- missing token denied
- invalid token denied
- Buyer token denied
- Seller token denied
- Logistics token denied
- authenticated Courier token allowed
- same-email role isolation
- authorized available requests
- cross-Logistics request excluded
- active task query
- request pagination
- duplicate joins not duplicating requests
- stale/unavailable request handling
- safe Seller pickup data
- safe sorting-center context
- Buyer PII minimized
- payment secrets absent
- Dashboard GET does not mutate task/order state
- efficient query behavior
## 146. Mobile / Flutter Tests
Test:
- Dashboard launches after authenticated session
- token-authenticated load
- delivery notification section
- available pickup-request list
- Seller pickup origin
- sorting-center pickup origin
- active task summary if implemented
- request-card tap
- Accept Delivery Request navigation
- active task navigation
- loading state
- empty request state
- error state
- manual refresh
- realtime/polling update
- reconnect/refetch
- stale indicator
- duplicate event deduplication
- removed request update
- screen-reader labels
- touch target sizing
- state not color-only
# Open Decisions
## 147. Open Decisions
The current sources do not define:
1. exact Courier Dashboard API
2. exact delivery-task schema
3. exact available-request status/state
4. exact difference between allocation and available request
5. final Logistics-assignment vs Courier-acceptance model
6. whether Dashboard always shows an active-task section
7. whether Courier may hold multiple active tasks
8. request ordering
9. request page size
10. request search/filtering
11. exact card fields
12. exact package-size representation
13. whether route distance appears on Dashboard or only Accept screen
14. exact pickup-address disclosure
15. exact delivery-address disclosure before acceptance
16. notification READ/UNREAD persistence
17. persistent WebSocket vs polling implementation
18. polling interval
19. background mobile Push requirement
20. Push provider if background Push is later selected
21. stale-data threshold
22. active-task refresh interval
23. pull-to-refresh UX
24. whether availability Online/Offline toggle is shown on Dashboard
25. whether earnings preview appears on Dashboard
26. whether SOS is embedded in Dashboard or app shell
27. whether Incident Reporting shortcut appears on active task card
28. request expiration behavior
29. whether unavailable request remains visible with status or disappears
30. Offline Mode integration behavior
# Final Definition
## 148. Final Definition
AISLEY Courier / Rider Dashboard is:
```text
the mobile central hub
for current Courier operations
```
focused on:
```text
delivery notifications
+
new job allocations
+
available pickup requests
+
current task navigation
```
Source-backed request origins include:
```text
sorting centers
Seller locations
```
The Dashboard remains primarily:
```text
view
refresh
notify
summarize
navigate
```
while stateful actions remain in:
```text
Accept Delivery Requests
Pick Up Order
Deliver Order
Complete Delivery
Proof of Delivery
Chat
Incident Reporting
SOS
```
Realtime rule:
```text
polling
or
persistent connections such as WebSockets
→ stream/refetch live request data
```
Mobile-auth rule:
```text
Flutter
→ Bearer personal access token
→ flutter_secure_storage
```
Third-party rule:
```text
No new third-party provider
is required for the basic Courier Dashboard.
```
