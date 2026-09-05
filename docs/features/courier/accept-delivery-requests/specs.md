---
role: Courier/Rider
feature: Accept Delivery Requests
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Flutter Courier Mobile Application / Delivery Task Acceptance
source_coverage: Courier.md, Logistics.md, app.md
---
# Accept Delivery Requests Specification
## 1. Purpose
Accept Delivery Requests is AISLEY's Courier workflow for reviewing an available delivery task and accepting responsibility for it.
`Courier.md` defines the Core Value as:
```text
Review Pickup and Delivery Details
Accept Delivery Request
```
Its Expanded Definition describes a job-confirmation interface where the Courier can evaluate a request before taking it.
Source-backed evaluation context includes:
```text
pickup location
delivery location
distance
route
package size
```
The source further states that acceptance:
```text
changes task status
to ACCEPTED

and assigns the task
to the specific courier_id
```
This feature therefore owns the first explicit Courier-side commitment in the delivery lifecycle.
A separate `flow.md` is required because the feature has a meaningful stateful sequence:
```text
available request
→ review
→ accept
→ revalidate
→ persist ACCEPTED / courier_id
→ continue to pickup
```
## 2. Primary Actor
Primary actor:
```text
COURIER / RIDER
```
The Courier uses the Flutter mobile application.
## 3. Authentication
Courier mobile authentication follows `app.md`:
```text
credentials + device_name
→ /login

Laravel createToken()
→ personal access token

Flutter:
stores token in flutter_secure_storage

Requests:
Authorization: Bearer <token>
```
Every acceptance request must resolve:
```text
authenticated user_id
+
COURIER role
```
## 4. Identity Rule
AISLEY account uniqueness is:
```text
unique(email, role)
```
A same-email Buyer/Seller/Logistics account is a separate role-account.
Acceptance must use the authenticated Courier `user_id`, not email.
# Feature Responsibility
## 5. Accept Delivery Requests Owns
This feature owns:
- opening an available delivery request
- presenting pickup and delivery details
- presenting route/distance context
- presenting package-size context
- letting the Courier explicitly accept
- revalidating request availability at commit time
- transitioning the delivery task to `ACCEPTED`
- assigning `courier_id` according to the source model
- preventing duplicate/conflicting acceptance
- returning the newly accepted task state
- handing off to Pick Up Order
## 6. Does Not Own
This feature does not own:
- Logistics candidate ranking
- Logistics Deploy Rider
- parcel pickup confirmation
- changing parcel/order state to `IN_TRANSIT`
- navigation execution
- Proof of Delivery
- marking Order `DELIVERED`
- delivery history
- earnings calculation
- chat persistence
- incident reporting
## 7. Core Boundary
Acceptance means:
```text
Courier agrees to take the task
```
It does not mean:
```text
parcel has been physically picked up
```
# Source Request Review
## 8. Pickup Details
The Courier must be able to review the pickup location/context.
Source-backed pickup origins elsewhere in `Courier.md` include:
```text
sorting center
Seller location
```
## 9. Delivery Details
The Courier must be able to review the delivery destination/details needed to evaluate the request.
Only operationally necessary Buyer information should be exposed.
## 10. Distance
The source says the Courier can review:
```text
distance
```
before accepting.
## 11. Route
The source says the Courier can review:
```text
route
```
before accepting.
## 12. Package Size
The source says the Courier can review:
```text
package size
```
before accepting.
## 13. No Invented Acceptance Criteria
The source does not define:
```text
minimum earnings
maximum route distance
required vehicle class
rating threshold
acceptance score
```
Do not invent these as mandatory acceptance rules.
# Logistics Handoff Ambiguity
## 14. Logistics Source
`Logistics.md` says Logistics may:
```text
manually assign tasks
```
or oversee automated dispatch.
## 15. Courier Source
`Courier.md` says Courier acceptance:
```text
changes task status to ACCEPTED
and assigns task to courier_id
```
## 16. Ambiguity
These descriptions do not fully define whether Logistics:
```text
offers a task
```
or:
```text
already assigns the task
```
before Courier acceptance.
## 17. Recommended Model
Recommended for consistency with `Courier.md`:
```text
Logistics dispatches/offers task
→ Courier reviews request
→ Courier accepts
→ task = ACCEPTED
→ courier_id finalized
```
This is a recommendation, not a finalized source rule.
## 18. Alternative Model
Possible alternative:
```text
Logistics assigns courier_id first
→ Courier receives assigned task
→ Courier acceptance confirms responsibility
```
If adopted, the source wording around `courier_id` assignment must be reconciled in the shared delivery-task model.
# Request State
## 19. Source-Backed Accepted State
The explicit accepted state is:
```text
ACCEPTED
```
## 20. Pre-Acceptance State
The source does not provide the exact state name for an available request.
Possible conceptual states:
```text
AVAILABLE
OFFERED
PENDING
```
Open Decision.
## 21. No Full Invented State Machine
Do not create a large dispatch state enum from this source alone.
The complete lifecycle spans:
```text
Logistics Deploy Rider
Courier Accept Delivery Requests
Pick Up Order
Deliver Order
Complete Delivery
```
# Request Availability
## 22. Backend Authority
The backend delivery-task/dispatch system is authoritative for whether a request is still available.
## 23. Stale Request
A request may become unavailable because:
```text
another Courier accepted it
Logistics changed assignment
order/task state changed
```
according to the final dispatch model.
## 24. Revalidation
At acceptance time, the backend must revalidate:
```text
task still available
Courier still eligible
Courier still authorized
```
## 25. No Client-Side Authority
The mobile app must not decide availability from cached UI state alone.
# Courier Eligibility
## 26. Authorized Courier
The authenticated Courier must be allowed to operate under the relevant Logistics organization.
## 27. Online / Available
`Logistics.md` defines Courier:
```text
Online / Available
```
via:
```text
Courier.is_online
```
Whether being online is strictly required at the exact acceptance transaction is not explicitly stated.
Recommended:
```text
acceptance should require current operational availability
```
Open Decision.
## 28. Zone Eligibility
If Zone/Territory Mapping is implemented, the backend may already have filtered the request to eligible Couriers.
Acceptance should not trust the client to assert zone eligibility.
## 29. Vehicle Capacity
If Vehicle Fleet Management is implemented, the backend may already have used capacity to filter the task.
Acceptance should revalidate current hard eligibility where needed.
## 30. GPS
The source does not require live GPS to accept the task itself, only to support delivery/routing operations.
Whether recent GPS is mandatory for acceptance is Open.
# Route Integration
## 31. Mapbox
`app.md` explicitly selects:
```text
Mapbox Matrix and Optimization
```
for route optimization for:
```text
Logistics and Riders
```
## 32. Route Preview
The request review may consume route/distance data generated from Mapbox.
## 33. Mapbox Boundary
Mapbox provides:
```text
route/distance/travel-time context
```
AISLEY decides:
```text
task availability
Courier eligibility
acceptance
courier_id assignment
```
## 34. Provider Failure
If route preview cannot load, acceptance behavior is not defined.
Open Decision.
Possible safe options:
```text
block acceptance
allow acceptance with route unavailable
retry route calculation
```
# Package Size Integration
## 35. Source Requirement
The Courier should be able to review:
```text
package size
```
## 36. Fleet Authority
Vehicle Fleet Management owns:
```text
vehicle capacity
```
If size/capacity compatibility is a hard dispatch rule, the backend should have enforced it before acceptance.
## 37. Missing Package Size
Behavior is Open.
Do not invent a default size.
# Acceptance Action
## 38. Explicit User Action
Acceptance must require a deliberate Courier action.
Recommended:
```text
Accept Delivery
```
button.
## 39. Confirmation
Because acceptance is consequential, a confirmation step is recommended.
Example summary:
```text
Pickup
Drop-off
Distance
Package
```
## 40. No Accidental Acceptance
Opening or scrolling a request does not accept it.
## 41. Double Tap Protection
Repeated tap/network retry must not create duplicate acceptance events.
# Atomicity
## 42. Atomic Commit
Recommended operation:
```text
validate current task state
+
validate Courier
+
set task = ACCEPTED
+
assign courier_id
→ commit atomically
```
## 43. Conflict
If another Courier wins first:
```text
reject acceptance
→ return current authoritative state
```
## 44. Idempotency
If the same Courier repeats the same acceptance request after success:
```text
return existing accepted state
```
or equivalent idempotent behavior.
## 45. No Silent Substitution
If acceptance fails:
```text
do not assign a different task
```
# Post-Acceptance Handoff
## 46. Next Feature
After successful acceptance:
```text
Accept Delivery Request
→ Pick Up Order
```
## 47. Pickup Status
Acceptance does not set:
```text
IN_TRANSIT
```
## 48. Pickup Confirmation
`Courier.md` reserves physical handover confirmation for Pick Up Order.
## 49. Dashboard Refresh
After acceptance:
```text
available request
→ removed from available queue
→ appears as active/current task
```
according to Dashboard design.
# Decline / Ignore
## 50. Decline
The source does not explicitly define:
```text
Decline Delivery Request
```
Open Decision.
## 51. Ignore
A Courier may potentially leave a request unaccepted.
Behavior/expiry is Open.
## 52. Offer Timeout
Not defined.
Open Decision.
## 53. Acceptance Window
Not defined.
Open Decision.
# API
## 54. Request Detail
Conceptual:
```http
GET /api/courier/delivery-requests/{taskId}
```
## 55. Accept
Conceptual:
```http
POST /api/courier/delivery-requests/{taskId}/accept
```
No client-supplied `courier_id` should be authoritative.
## 56. Response
Recommended:
```text
task_id
status = ACCEPTED
courier_id
accepted_at
safe pickup/delivery summary
```
## 57. Decline Endpoint
Only if decline is later specified:
```http
POST /api/courier/delivery-requests/{taskId}/decline
```
Not MVP-required by current source.
# Authorization
## 58. Bearer Token
Every request requires a valid Courier Bearer token.
## 59. Exact Role
Backend verifies:
```text
role = COURIER
```
## 60. Request Visibility
The Courier may accept only a request the backend has made available/authorized to them.
## 61. IDOR
Knowing:
```text
task_id
order_id
package_id
```
must not permit acceptance of an unauthorized task.
## 62. Logistics Scope
The request must belong to the Courier's permitted Logistics relationship.
# Security and Privacy
## 63. Buyer Information
Before acceptance, reveal only the delivery information necessary to evaluate the task.
Exact disclosure is Open.
## 64. Seller Information
Reveal only the pickup information necessary to evaluate the task.
## 65. Payment Data
Never expose Buyer payment credentials.
## 66. Bearer Token
Never expose/log the personal access token in responses or telemetry.
## 67. Route Data
Route data should not expose unrelated user locations.
# Offline Behavior
## 68. Offline Mode Boundary
`Courier.md` defines Offline Mode separately.
Acceptance changes assignment state and therefore normally requires current server coordination.
## 69. Offline Acceptance
Whether a request can be accepted offline is not source-defined.
Recommended:
```text
acceptance requires connectivity
```
because request availability is highly concurrent.
## 70. Cached Request
A cached request must not be considered accept-able without server revalidation.
# Realtime Behavior
## 71. Dashboard Source
Courier Dashboard uses:
```text
polling
or
WebSockets
```
to receive live request data.
## 72. Acceptance Update
After one Courier accepts, other Courier clients should eventually receive/refetch:
```text
request no longer available
```
## 73. No Realtime Authority
Realtime events do not replace backend transaction checks.
# Notifications
## 74. In-App Result
The accepting Courier should receive immediate in-app success/failure feedback.
## 75. Logistics Visibility
After acceptance, Logistics should be able to see the current accepted/assigned Courier state.
Exact notification transport is Open.
## 76. Email
Brevo email is not required.
## 77. Push
No mobile Push provider is required for the acceptance transaction itself.
# Logging / History
## 78. Operational History
Acceptance should preserve operational history sufficient to answer:
```text
which task
which Courier
when accepted
previous state
result
```
## 79. Actor
The actor is the authenticated Courier.
## 80. Admin Audit Boundary
Do not duplicate every Courier acceptance into Admin System Audit Logs unless AISLEY later generalizes cross-role audit logging.
# Performance
## 81. Request Detail
Request detail should load only necessary task/order/package relations.
## 82. Route Preview
If Mapbox is used, route requests should be bounded and cached where appropriate.
## 83. Acceptance Latency
Acceptance should use a direct, transactional backend path.
Do not wait for unrelated external notifications before returning committed state.
# UX
## 84. Recommended Review Screen
```text
Delivery Request
├── Pickup
├── Drop-off
├── Distance / Route
├── Package Size
└── Accept Delivery
```
## 85. Pickup
Show a clear origin label:
```text
Seller Location
Sorting Center
```
where applicable.
## 86. Delivery
Show safe destination context.
## 87. Route
Use map/route preview where available, but also show textual route/distance data.
## 88. Package Size
Show source-backed package-size information where available.
## 89. Accept Button
Use a clear primary action:
```text
Accept Delivery
```
## 90. Loading
While acceptance is processing:
```text
disable duplicate submission
show progress
```
## 91. Success
On success:
```text
Delivery accepted
→ navigate/show current task
```
## 92. Conflict
Example:
```text
This request is no longer available.
```
## 93. Error
Network/server failure should not claim success.
## 94. Accessibility
The mobile screen should:
- support screen readers
- provide large touch targets
- expose pickup/delivery text
- not rely on map/color alone
- announce acceptance result
# Third-Party Dependencies
## 95. Core Acceptance
No new third-party provider is required.
Core uses:
```text
AISLEY backend
delivery-task database
Courier Bearer authentication
```
## 96. Mapbox
Mapbox is an existing selected routing integration for route/distance preview.
## 97. Brevo
Not required.
## 98. SMS / Push
Not required for acceptance transaction.
# MVP Scope
## 99. Required
- authenticated Courier access
- exact Courier role authorization
- request detail
- pickup details
- delivery details
- distance/route context
- package-size context
- explicit Accept action
- backend availability revalidation
- backend Courier eligibility validation
- atomic `ACCEPTED` mutation
- `courier_id` assignment according to selected model
- conflict handling
- idempotency
- Dashboard update/handoff
- Pick Up Order handoff
- Bearer-token security
- PII minimization
- loading/success/error/conflict states
## 100. Recommended
- confirmation step
- route preview via Mapbox
- accepted-at timestamp
- operational acceptance history
- current availability revalidation
- Fleet/Zone hard-rule revalidation
- immediate Dashboard reconciliation
## 101. Not Required
- decline action
- timeout/expiry system
- offline acceptance
- email
- SMS
- Push
- earnings preview
- automatic pickup state
- Proof of Delivery
- arbitrary scoring formula
- new third-party provider
# Acceptance Criteria
## 102. Access
- Guest cannot open/accept Courier delivery requests.
- Non-Courier token cannot accept.
- Same-email other-role account does not inherit Courier access.
- Acceptance uses authenticated Courier identity.
## 103. Review
- Courier can review pickup details.
- Courier can review delivery details.
- Courier can review distance/route context.
- Courier can review package-size context.
- Only necessary PII is exposed.
## 104. Acceptance
- Opening request does not accept it.
- Explicit Accept action is required.
- Backend revalidates request availability.
- Backend revalidates Courier eligibility.
- Successful acceptance changes task state to `ACCEPTED`.
- Successful acceptance assigns `courier_id` according to the selected delivery-task model.
- Acceptance does not mark parcel `IN_TRANSIT`.
## 105. Concurrency
- Two Couriers cannot both acquire the same exclusive request.
- A stale request produces conflict/no acceptance.
- Duplicate acceptance submissions are idempotent/safely constrained.
## 106. Handoff
- Accepted request leaves available queue.
- Accepted task becomes current/active work.
- Courier can continue to Pick Up Order.
- Logistics can eventually observe accepted/assigned state.
## 107. Security
- Unauthorized task IDs cannot be accepted.
- Cross-Logistics requests are denied.
- Bearer token is protected.
- Payment/security secrets are never exposed.
## 108. Third-Party
- Core acceptance works without new third-party service.
- Mapbox may provide route context.
- Brevo/SMS/Push are not required.
# Tests
## 109. Backend Tests
Test:
- missing/invalid token denied
- Buyer/Seller/Logistics token denied
- Courier token allowed
- same-email role isolation
- authorized request detail
- unauthorized request denied
- pickup/delivery data
- route/distance data
- package-size data
- request still available
- stale request
- two-Courier concurrency
- Courier eligibility revalidation
- Zone/Fleet validation where enabled
- successful `ACCEPTED`
- correct `courier_id`
- duplicate acceptance idempotency
- accepted request removed from availability
- no `IN_TRANSIT` mutation
- safe PII
- no token/payment-secret leakage
## 110. Flutter Tests
Test:
- request detail screen
- pickup summary
- delivery summary
- route/distance
- package size
- Accept button
- confirmation if implemented
- loading/disabled duplicate tap
- success state
- conflict state
- network error
- navigation to Pick Up Order
- Dashboard reconciliation
- accessibility labels
- touch target size
- usable textual route without map
# Open Decisions
## 111. Open Decisions
The current sources do not define:
1. exact pre-acceptance delivery-task state
2. Logistics offer vs immediate assignment model
3. exact meaning of `courier_id` before acceptance
4. whether one request is exclusive to one Courier
5. whether Courier must be `is_online = true` at acceptance
6. whether recent GPS is required
7. exact Zone/Fleet revalidation rules
8. exact pickup fields
9. exact delivery-address disclosure before acceptance
10. distance metric
11. route metric
12. package-size representation
13. Mapbox failure behavior
14. acceptance confirmation UX
15. request expiration
16. acceptance window
17. decline support
18. ignore/timeout behavior
19. multiple active-task support
20. acceptance operational-history schema
21. whether Logistics receives a realtime acceptance event
22. offline acceptance policy
23. exact API route names
# Final Definition
## 112. Final Definition
AISLEY Accept Delivery Requests is:
```text
the Courier-side job confirmation workflow
```
where the Rider reviews:
```text
pickup
delivery
distance / route
package size
```
then explicitly accepts the delivery task.
Source-backed commit:
```text
accept
→ task status = ACCEPTED
→ courier_id assigned
```
Critical boundary:
```text
ACCEPTED
≠
IN_TRANSIT
```
Physical possession begins later in:
```text
Pick Up Order
```
Dispatch handoff remains an Open Decision because `Logistics.md` and `Courier.md` describe assignment timing differently.
