---
role: Courier/Rider
feature: Delivery History
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Flutter Courier Mobile Application / Completed Delivery Archive
source_coverage: Courier.md, app.md
---
# Delivery History Specification
## 1. Purpose
Delivery History is AISLEY's Courier archival feature for reviewing previously completed delivery work.
`Courier.md` defines:
```text
Core Value:
Views completed delivery requests.
```
Expanded definition:
```text
An archival log
of all past jobs.

It allows couriers
to review previous routes,
dates,
and specifics
of successfully fulfilled deliveries

for personal record-keeping
or dispute resolution.
```
System context:
```text
A read-only query
against historical delivery tasks,

filtered by
the active courier_id

where the status equals
COMPLETED.
```
This feature is therefore a read-only historical view.
A separate `flow.md` is not required because Delivery History does not own a business-state lifecycle; it reads completed records, filters them, and navigates to historical detail.
## 2. Primary Actor
Primary actor:
```text
COURIER / RIDER
```
The Courier uses the Flutter mobile application.
## 3. Application Context
From `app.md`:
```text
Mobile App:
Rider
Storefront
```
Delivery History is therefore designed for the Courier mobile application.
## 4. Authentication
Courier mobile authentication follows `app.md`:
```text
Flutter sends:
credentials + device_name
→ /login

Laravel:
createToken()
→ personal access token

Flutter:
stores token in flutter_secure_storage

Future requests:
Authorization: Bearer <token>
```
Every Delivery History request must resolve:
```text
authenticated user_id
+
COURIER role
```
## 5. Identity Rule
AISLEY identity uniqueness is:
```text
unique(email, role)
```
Therefore historical deliveries must be scoped by:
```text
authenticated courier_id
```
and never by email alone.
A same-email account under another role is a separate logical account.
# Feature Responsibility
## 6. Delivery History Owns
Delivery History owns:
- reading completed delivery-task records
- filtering records by authenticated `courier_id`
- filtering records where task status is `COMPLETED`
- presenting an archival delivery list
- presenting historical delivery detail
- presenting previous route information where available
- presenting delivery dates/timestamps
- presenting delivery-specific operational details
- pagination/bounded loading
- date filtering where implemented
- search/filtering where useful
- safe links to related completed-delivery artifacts
- historical record visibility for personal record-keeping
- historical record visibility useful for dispute resolution
## 7. Delivery History Does Not Own
Delivery History does not own:
- accepting delivery requests
- pickup confirmation
- route execution
- live GPS tracking
- final delivery completion
- changing `DELIVERED`
- changing `COMPLETED`
- editing historical delivery state
- changing Buyer/Seller data
- modifying Proof of Delivery evidence
- creating Incident records
- calculating Courier earnings
- editing payout details
- resolving disputes itself
## 8. Core Boundary
Delivery History answers:
```text
What deliveries
have I already completed?
```
It does not answer:
```text
What should I deliver now?
```
or mutate:
```text
What happened historically?
```
# Source Query Rule
## 9. Read-Only Query
The source explicitly defines Delivery History as:
```text
read-only
```
Therefore historical delivery APIs should not offer status mutation through this feature.
## 10. Courier Filter
Required filter:
```text
delivery_task.courier_id
=
authenticated Courier
```
or equivalent assignment relation.
## 11. Completion Filter
Required filter:
```text
delivery_task.status
=
COMPLETED
```
## 12. Source-Backed Baseline Query
Conceptually:
```sql
SELECT historical delivery tasks
WHERE courier_id = authenticated_courier_id
AND status = 'COMPLETED'
```
with appropriate joins and pagination.
## 13. No Client Courier Authority
The mobile app must not determine ownership using:
```text
?courier_id=<arbitrary value>
```
The backend derives the Courier from the Bearer token.
## 14. No Client Completion Authority
The client must not be able to change a task into:
```text
COMPLETED
```
through a Delivery History endpoint.
# Completed State
## 15. Source-Backed Task State
Delivery History explicitly expects:
```text
COMPLETED
```
on historical delivery tasks.
## 16. Complete Delivery Relationship
`Courier.md` Complete Delivery defines the core Order transition as:
```text
Order → DELIVERED
```
## 17. Separate State Domains
The sources therefore support the possibility that:
```text
Order.status = DELIVERED

delivery_task.status = COMPLETED
```
are distinct state values on distinct domain records.
## 18. Recommended Model
Where AISLEY maintains both models:
```text
Complete Delivery
→ Order = DELIVERED
→ delivery task = COMPLETED
```
then:
```text
Delivery History
→ queries COMPLETED delivery tasks
```
## 19. Exact Coupling
The exact transaction coupling between Order `DELIVERED` and task `COMPLETED` remains an Open Decision.
## 20. No State Collapse
Delivery History should not assume:
```text
DELIVERED
=
COMPLETED
```
unless the implementation deliberately uses one shared state field.
# Historical List
## 21. Primary List
The main screen should show completed delivery tasks belonging to the authenticated Courier.
## 22. Recommended Row Content
Source-backed/recommended information:
```text
Delivery / Task Reference
Completion Date
Pickup Context
Delivery Destination Summary
Route Summary where available
```
Exact fields depend on the data model.
## 23. Completion Date
The source explicitly mentions:
```text
dates
```
A clear completion date/time should therefore be available where stored.
## 24. Route
The source explicitly mentions:
```text
previous routes
```
The feature may show historical route information where such data exists.
## 25. Delivery Specifics
The source explicitly mentions:
```text
specifics
of successfully fulfilled deliveries
```
These may include safe operational delivery details.
Exact fields are Open.
## 26. No Sensitive Expansion
Do not expose unrelated Buyer/Seller profile data merely because the task is historical.
# Historical Detail
## 27. Detail Screen
A Courier may open one completed task to review its historical detail.
## 28. Recommended Sections
Conceptually:
```text
Completed Delivery
├── Delivery Reference
├── Completion Date/Time
├── Pickup
├── Drop-off
├── Route Summary
├── Package / Order Summary
└── Related Historical Artifacts
```
Only source-supported/implemented fields should appear.
## 29. Read-Only Presentation
Historical detail must not include controls that silently mutate:
```text
status
Courier assignment
Buyer address
Seller pickup details
POD
incident state
```
## 30. Historical Snapshot
Where order addresses/details may later change in other profile/address systems, Delivery History should prefer the historical delivery/order snapshot associated with that completed task.
Do not silently substitute a newly edited Buyer Address Book entry.
# Route History
## 31. Source Requirement
Delivery History supports review of:
```text
previous routes
```
## 32. Route Data Availability
The source does not define exactly what route history AISLEY stores.
Open Decision.
Possible data may include:
```text
origin
destination
route distance
duration
optimized route summary
```
where stored.
## 33. Full GPS Trail
The source does not explicitly require storing or replaying the Courier's full GPS trail.
Do not make:
```text
every historical GPS point
```
an MVP requirement.
## 34. Mapbox
`app.md` selects:
```text
Mapbox Matrix and Optimization
```
for Rider/Logistics routing.
Mapbox may have been used to calculate route context during Deliver Order.
Delivery History does not need to call Mapbox again merely to display already stored historical route facts.
## 35. Route Reconstruction
If route geometry was not stored, the source does not require reconstructing the exact historic route later.
Open Decision.
## 36. Map Display
A static or interactive route map is optional.
The source requires route review, not necessarily a full map visualization.
# Date and Time
## 37. Completion Time
A historical task should expose an authoritative completion timestamp such as:
```text
completed_at
```
where modeled.
## 38. Delivered Time
If the Order has:
```text
delivered_at
```
and the task has:
```text
completed_at
```
the relationship between those timestamps must be defined.
Open Decision.
## 39. Display Timezone
Historical dates should use a consistent user/business timezone policy.
Exact policy is Open.
## 40. Sorting
Recommended default:
```text
most recently completed first
```
This is a recommendation, not source-defined.
# Personal Record-Keeping
## 41. Source Purpose
The source explicitly allows use for:
```text
personal record-keeping
```
## 42. Historical Stability
Completed records should remain stable enough for a Courier to understand previous work.
## 43. No Silent Historical Rewrite
Later updates to:
```text
current Buyer profile
current Seller profile
current route settings
```
should not silently rewrite historical delivery facts if the system stores historical snapshots.
## 44. Export
CSV/PDF export is not source-required.
Open Decision.
# Dispute Resolution
## 45. Source Purpose
The source explicitly says Delivery History may support:
```text
dispute resolution
```
## 46. Historical Evidence
The feature may provide references to:
```text
delivery dates
route information
delivery specifics
Proof of Delivery
Incident records
```
where those records exist and are authorized.
## 47. No Dispute Mutation
Delivery History does not:
```text
open dispute
resolve dispute
refund order
sanction user
```
unless another feature handles those actions.
## 48. POD Relationship
Proof of Delivery may be highly relevant to a completed historical task.
Delivery History may show:
```text
POD available
```
and navigate to authorized evidence/detail.
## 49. POD Editing
Historical POD evidence must remain read-only from Delivery History.
## 50. Incident Relationship
If an Incident occurred during the task, historical detail may expose a safe incident summary/reference.
Incident Reporting owns the record itself.
# Profit Dashboard Integration
## 51. Profit Dashboard
Profit Dashboard aggregates:
```text
Courier earnings
strictly tied to completed deliveries
```
## 52. Shared Task Identity
A Profit Dashboard earning entry may link to:
```text
delivery_task_id
```
## 53. Delivery History Link
The Rider may navigate:
```text
Profit Dashboard earning entry
→ Delivery History detail
```
## 54. Earnings Display
Whether Delivery History itself shows the Courier's earnings for that delivery is not source-required.
Open Decision.
## 55. No Earnings Calculation
Delivery History must not derive payout values.
Profit Dashboard/earnings ledger remains authoritative.
# Performance Metrics Integration
## 56. Performance Metrics
Performance Metrics uses timestamps on delivery tasks for:
```text
average completion times
successful delivery rates
```
## 57. Historical Source
Completed delivery-task records are a natural source for those metrics.
## 58. No Aggregation Here
Delivery History shows historical tasks.
Performance Metrics owns cross-task aggregation.
# Tipping / Feedback Boundary
## 59. Digital Tipping & Feedback
Tipping/feedback may occur after successful delivery.
## 60. Historical Display
Whether historical delivery detail displays:
```text
tip
feedback
rating
```
is not explicitly required.
Open Decision.
## 61. No Feedback Mutation
Delivery History does not create or edit Buyer feedback.
# Chat Boundary
## 62. Historical Chat
Whether Chat remains accessible after delivery completion is governed by Chat/Messaging policy.
## 63. No Chat Ownership
Delivery History must not duplicate or modify chat persistence.
A historical task may show a link if policy allows access.
# Account Management Boundary
## 64. Courier Profile Changes
Current Courier profile/vehicle information may change over time.
## 65. Historical Assignment
Delivery History should preserve the historical task's Courier identity even after current Account Management changes.
## 66. Vehicle History
Whether the vehicle used for a completed delivery is displayed is not source-required.
Open Decision.
# API
## 67. History List Endpoint
Conceptual:
```http
GET /api/courier/delivery-history
```
Backend implicitly applies:
```text
courier_id = authenticated Courier
status = COMPLETED
```
## 68. Filters
Possible query parameters:
```text
from
to
page/cursor
search
```
only where implemented.
## 69. History Detail
Conceptual:
```http
GET /api/courier/delivery-history/{taskId}
```
## 70. Read-Only Contract
Delivery History routes should use read operations only.
Do not create:
```http
PATCH /api/courier/delivery-history/{taskId}
```
for state editing.
## 71. Pagination
List endpoint must support bounded pagination/cursoring.
## 72. Safe References
API may return:
```text
delivery_task_id
order reference
public task reference
```
as needed for authorized navigation.
# Backend Query
## 73. Baseline Query
Conceptually:
```text
DeliveryTask
WHERE courier_id = auth.courier_id
AND status = COMPLETED
ORDER BY completed_at DESC
```
subject to final schema.
## 74. Authorization in Query
Ownership filtering should happen server-side.
Do not fetch all completed tasks and filter in Flutter.
## 75. Join Safety
Joining:
```text
orders
POD
incidents
earnings
```
must not duplicate historical task rows.
## 76. Count Safety
Pagination totals/counts must count distinct historical tasks according to the data model.
# Search and Filters
## 77. Date Filter
Because the source emphasizes dates, date filtering is recommended.
## 78. Date Range
Possible:
```text
from
to
```
Open Decision.
## 79. Search
Search by:
```text
delivery reference
order reference
```
may be useful.
Not source-required.
## 80. Location Search
Search by destination/pickup location is not source-required.
Open Decision.
## 81. Status Filter
The baseline history already requires:
```text
status = COMPLETED
```
A status filter is unnecessary unless future history includes non-completed historical attempts.
## 82. Sort
Recommended:
```text
Newest
Oldest
```
Open Decision.
# Data Privacy
## 83. Historical Buyer Data
Completed tasks may include Buyer delivery information.
Expose only the minimum needed for the Courier's legitimate record/dispute use.
## 84. Historical Seller Data
Expose only operationally necessary Seller/pickup information.
## 85. Payment Information
Never expose:
```text
card data
CVV
payment credentials
Buyer payment tokens
```
## 86. Contact Information
Whether historical phone numbers remain visible is not defined.
Open Decision.
A privacy-minimizing policy is recommended.
## 87. Location Privacy
Historical route/location information should be limited to the authenticated Courier's completed jobs and authorized related context.
# Security
## 88. Bearer Authentication
All Delivery History endpoints require a valid Courier Bearer token.
## 89. Exact Role
Backend verifies:
```text
role = COURIER
```
## 90. Own History Only
Courier may read only their own completed task history.
## 91. IDOR
Knowing another:
```text
task_id
order_id
POD ID
incident ID
```
must not expose another Courier's delivery history.
## 92. Bearer Token Protection
Never expose/log the Courier access token in historical responses.
## 93. Related-Artifact Authorization
Opening:
```text
POD
incident
earning detail
```
from history must re-check authorization.
Do not assume access merely because a link appears in the client.
# Immutability
## 94. Historical State
Delivery History is read-only.
## 95. No Status Mutation
The Courier cannot use Delivery History to change:
```text
COMPLETED
DELIVERED
IN_TRANSIT
```
## 96. No Address Editing
Historical destination/pickup data cannot be changed from the history screen.
## 97. No POD Replacement
Historical POD evidence cannot be replaced through Delivery History.
## 98. No Earnings Editing
Historical earnings cannot be edited through Delivery History.
# Error Handling
## 99. Empty History
If the Courier has no completed deliveries:
```text
show empty state
```
not an error.
## 100. Query Failure
If history cannot load:
```text
show error/retry
```
Do not present the failure as zero completed work.
## 101. Detail Not Found
If the task does not exist or is unauthorized:
```text
show not found/denied
→ no data leak
```
## 102. Not Completed
If the Courier tries to access a non-`COMPLETED` task through Delivery History:
```text
reject/not part of history
```
The active task belongs in Dashboard/active-delivery features.
## 103. Related Artifact Missing
If POD/incident/earning link no longer exists or is unavailable:
```text
show unavailable
```
without breaking the historical delivery record.
# Performance
## 104. Pagination
Historical lists may grow indefinitely.
Pagination/cursoring is required.
## 105. Initial Page
Load only a bounded recent set.
Exact page size is Open.
## 106. Indexing
Useful indexes likely include:
```text
courier_id
status
completed_at
```
subject to schema.
## 107. Composite Index
A query pattern such as:
```text
(courier_id, status, completed_at)
```
may benefit from a composite index.
This is an implementation recommendation.
## 108. Avoid Large Joins
Do not load:
```text
full POD media
full chat transcript
full route GPS trail
all incident attachments
```
for every history-row query.
## 109. Detail-on-Demand
Load large related artifacts only when the Courier opens the relevant detail.
# Offline Mode
## 110. Offline Mode Boundary
`Courier.md` separately defines Offline Mode for active delivery resilience.
## 111. Historical Cache
Caching recent Delivery History locally is not source-required.
Open Decision.
## 112. Cached History
If later cached:
```text
show last synchronized state
```
## 113. No Offline Mutation
Delivery History remains read-only whether online or offline.
# Realtime
## 114. Realtime Requirement
Delivery History does not require WebSockets/persistent updates.
## 115. Refresh After Completion
After Complete Delivery succeeds:
```text
history refresh
→ newly completed task appears
```
according to task-state synchronization.
## 116. Manual Refresh
A standard refresh action is sufficient for MVP.
# UI
## 117. Recommended Screen
```text
Delivery History
├── Date / Search Controls
└── Completed Deliveries
    ├── Reference
    ├── Completion Date
    ├── Route / Location Summary
    └── Delivery Specifics
```
## 118. Mobile List
Use a touch-friendly list/card layout.
## 119. Completion Label
Every baseline record is already:
```text
COMPLETED
```
so avoid visually overloading each row with redundant status badges unless useful.
## 120. Row Summary
Recommended row hierarchy:
```text
Delivery Reference
Completion Date
Pickup → Destination Summary
```
## 121. Detail Navigation
Tap a historical item to open read-only detail.
## 122. Date Filter UI
If implemented, use a mobile-friendly date range selector.
## 123. Empty State
Example:
```text
No completed deliveries yet.
```
## 124. Error State
Example:
```text
Unable to load delivery history.
```
with retry.
## 125. Loading
Use skeleton/progress UI.
## 126. Route Representation
If route map is unavailable, provide textual origin/destination/distance where available.
## 127. Accessibility
The Flutter UI should:
- expose references/dates as text
- support screen readers
- use large touch targets
- not rely on map/color alone
- announce empty/error states
- provide readable historical route summaries
# Third-Party Dependencies
## 128. Core History
No new third-party provider is required.
Core uses:
```text
AISLEY backend
historical delivery-task records
Orders/shipment data
```
## 129. Mapbox
Mapbox is not required merely to query history.
If historical route visualization is added, AISLEY may reuse stored route information or existing Mapbox integration as appropriate.
## 130. Brevo
Not required.
## 131. SMS / Push
Not required.
## 132. Cloud Storage
Delivery History itself does not require a cloud storage provider.
If it links to e-POD media, Proof of Delivery owns that storage.
# Logging / Audit
## 133. Read Activity
Routine history viewing does not need to create Admin System Audit mutation records.
## 134. Sensitive Artifact Access
Whether access to POD evidence or dispute-sensitive artifacts is separately logged is Open.
## 135. Historical Integrity
The backend should preserve authoritative completed-delivery data according to overall data-retention policy.
# Retention
## 136. Source Requirement
The source calls Delivery History an:
```text
archival log
of all past jobs
```
## 137. Retention Duration
The exact retention duration is not defined.
Open Decision.
## 138. Deletion
Whether Couriers may delete their Delivery History is not defined.
Recommended:
```text
no self-service deletion
```
for operational/dispute integrity.
This is a recommendation.
## 139. Account Deactivation
What happens to Delivery History after Courier account deactivation is not defined.
Open Decision.
# MVP Scope
## 140. Required
- authenticated Courier access
- exact Courier role authorization
- server-side `courier_id` filter
- server-side `status = COMPLETED` filter
- read-only completed-delivery list
- completed-delivery detail
- delivery reference
- completion date/time
- previous route information where available
- delivery specifics where available
- bounded pagination
- authorization/IDOR protection
- loading/empty/error states
- historical PII minimization
- no history mutation controls
## 141. Recommended
- newest-first sorting
- date range filtering
- search by delivery/order reference
- historical pickup/destination snapshot
- POD availability/link
- incident reference
- Profit Dashboard earning-detail link
- efficient composite indexing
- detail-on-demand related artifact loading
- manual refresh
## 142. Not Required
- history state editing
- reopening delivery
- changing `COMPLETED`
- changing Order `DELIVERED`
- full GPS trail replay
- historical live tracking
- route reconstruction
- export/PDF
- payout calculation
- dispute-resolution workflow
- Brevo
- SMS
- Push
- new mapping provider
- new cloud-storage provider
# Acceptance Criteria
## 143. Access
- Missing/invalid token cannot access Delivery History.
- Non-Courier token cannot access Courier history.
- Same-email other-role account does not inherit Courier history.
- Courier sees only their own completed tasks.
## 144. Query Rules
- Backend applies authenticated `courier_id`.
- Backend applies `status = COMPLETED`.
- Non-completed active tasks do not appear.
- Client cannot override Courier scope.
- Duplicate joins do not duplicate history rows.
## 145. List
- Completed deliveries load in a bounded page.
- Each item exposes a stable historical reference.
- Completion date is shown.
- Route/delivery specifics are shown where available.
- Empty history is represented correctly.
- Query failure is not shown as an empty successful result.
## 146. Detail
- Courier can open an authorized completed-delivery detail.
- Another Courier's task is denied.
- A non-completed task cannot be accessed as Delivery History.
- Historical detail is read-only.
- Historical address/task facts are not silently replaced with unrelated current profile data.
## 147. State Boundary
- Delivery History cannot mark a task `COMPLETED`.
- Delivery History cannot change Order `DELIVERED`.
- Delivery History cannot reassign the Courier.
- Delivery History cannot edit POD/incident/earnings data.
## 148. Related Features
- Completed delivery may link to POD if authorized.
- Completed delivery may reference Incident data if present.
- Profit Dashboard may link to Delivery History detail.
- Performance Metrics may aggregate completed records independently.
## 149. Security
- Task/Order/POD/Incident IDs cannot bypass ownership.
- Historical PII is minimized.
- Payment credentials are absent.
- Bearer token is protected.
## 150. Third-Party
- Core Delivery History works without a new third-party provider.
- Mapbox is optional only for route presentation if needed.
- Brevo/SMS/Push are not required.
- POD storage remains owned by Proof of Delivery.
# Tests
## 151. Backend Tests
Test:
- missing token denied
- invalid token denied
- Buyer/Seller/Logistics token denied
- authenticated Courier allowed
- same-email role isolation
- own completed tasks returned
- another Courier task excluded
- ACCEPTED task excluded
- IN_TRANSIT task excluded
- COMPLETED task included
- pagination
- newest-first if adopted
- date filter if implemented
- reference search if implemented
- duplicate join does not duplicate row
- detail authorization
- non-completed detail rejected
- safe historical Buyer data
- safe historical Seller data
- no payment/token leakage
- POD relation authorization
- Incident relation authorization
- Profit entry relation authorization
- read-only API methods
## 152. Flutter Tests
Test:
- Delivery History screen
- completed list
- completion dates
- route summary
- delivery-specific summary
- pagination/load more
- date filter if implemented
- search if implemented
- detail screen
- POD link if implemented
- incident summary/link if implemented
- Profit link if implemented
- empty state
- loading
- error/retry
- non-completed task not shown
- no edit/status action
- screen-reader labels
- touch-target sizing
- route readable without map
# Open Decisions
## 153. Open Decisions
The current sources do not define:
1. exact delivery-task schema
2. exact relation between Order `DELIVERED` and task `COMPLETED`
3. exact completion timestamp field
4. exact Delivery History API routes
5. default page size
6. default sort order
7. date filtering
8. custom date range
9. reference search
10. exact row fields
11. exact historical-detail fields
12. historical Buyer contact visibility
13. historical Seller contact visibility
14. whether package/product specifics are shown
15. whether route geometry is stored
16. whether route distance/duration is stored
17. whether a map is shown
18. whether full GPS trails are retained
19. historical GPS retention
20. POD evidence link behavior
21. Incident display behavior
22. historical Chat availability
23. whether earnings appear in Delivery History
24. whether Buyer rating/tip is shown
25. CSV/PDF export
26. archive retention duration
27. account-deactivation history access
28. Courier self-service deletion
29. cached/offline history
30. audit logging for sensitive artifact views
# Final Definition
## 154. Final Definition
AISLEY Delivery History is:
```text
a read-only Courier archive
of successfully completed delivery jobs
```
with the source-backed query rule:
```text
delivery_task.courier_id
=
authenticated Courier

AND

delivery_task.status
=
COMPLETED
```
It allows the Courier to review:
```text
previous routes
dates
delivery specifics
```
for:
```text
personal record-keeping
or
dispute resolution
```
Critical state boundary:
```text
Complete Delivery
→ creates/finalizes completed work

Delivery History
→ only reads historical completed work
```
Related status distinction:
```text
Order
→ DELIVERED

delivery task
→ COMPLETED
```
where AISLEY uses separate order/task state machines.
Third-party rule:
```text
No new third-party provider
is required for core Delivery History.
```
