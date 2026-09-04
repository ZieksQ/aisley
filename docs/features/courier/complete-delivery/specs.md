---
role: Courier/Rider
feature: Complete Delivery
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Flutter Courier Mobile Application / Final Delivery Completion
source_coverage: Courier.md, app.md
---
# Complete Delivery Specification
## 1. Purpose
Complete Delivery is AISLEY's Courier finalization workflow for marking a successfully fulfilled parcel/order as delivered.
`Courier.md` defines:
```text
Core Value:
Complete delivery.
```
Expanded definition:
```text
The finalization of the task.

It marks the successful end
of the logistics lifecycle
for a specific parcel.
```
System context:
```text
Triggers the final state change
in the core database
(e.g., Orders table)

to DELIVERED,

which cascades
automated notifications
to both the Buyer and Seller.
```
This feature therefore owns the final Courier-side completion action after the parcel has reached the Buyer's destination.
A separate `flow.md` is required because Complete Delivery performs a consequential state transition and downstream notification/history handoffs.
## 2. Primary Actor
Primary actor:
```text
COURIER / RIDER
```
The Courier completes delivery through the Flutter mobile application.
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
Every completion request must resolve:
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
Therefore a same-email Buyer/Seller/Logistics account is a separate role-account.
Completion must use the exact authenticated Courier identity.
# Feature Responsibility
## 5. Complete Delivery Owns
This feature owns:
- loading the active delivery ready for finalization
- verifying that the Courier is authorized for the task
- verifying that the task/order is completion-eligible
- presenting final delivery summary
- explicitly confirming successful delivery
- transitioning the core Order to `DELIVERED`
- preventing duplicate/conflicting finalization
- preserving completion history
- creating/cascading Buyer and Seller notification events
- handing completed work to Delivery History
- making completed delivery available to earnings/metrics features
## 6. Complete Delivery Does Not Own
It does not own:
- delivery-request acceptance
- parcel pickup confirmation
- route/navigation
- Courier assignment
- Proof of Delivery evidence capture
- Buyer Address Book changes
- chat persistence
- incident creation
- payout calculation
- profit aggregation
- feedback/tipping
- notification campaign management
## 7. Core Boundary
Complete Delivery means:
```text
the parcel has been successfully delivered
and the core order can be finalized
```
It does not mean:
```text
the Courier merely reached
the destination coordinates
```
# Lifecycle Context
## 8. Previous Phases
Source-backed Courier lifecycle:
```text
Accept Delivery Request
→ ACCEPTED

Pick Up Order
→ IN_TRANSIT

Deliver Order
→ active transit
```
## 9. Final Order State
Complete Delivery explicitly changes the core Order to:
```text
DELIVERED
```
## 10. Logistics Lifecycle End
The source describes this as:
```text
successful end
of the logistics lifecycle
for a specific parcel
```
## 11. No Premature Completion
A task that has not completed the required prior delivery phases must not be arbitrarily marked:
```text
DELIVERED
```
## 12. State-Machine Authority
The backend order/task state machine is authoritative for whether completion is valid.
The mobile client must not decide this alone.
# Order vs Delivery Task State
## 13. Order State
Source-backed final Order state:
```text
DELIVERED
```
## 14. Delivery History State
`Courier.md` defines Delivery History as a read-only query where delivery-task status equals:
```text
COMPLETED
```
## 15. Distinct State Domains
This suggests AISLEY may have:
```text
Order.status = DELIVERED

delivery_task.status = COMPLETED
```
rather than one shared status field.
## 16. Exact Coupling
The source does not explicitly state that Complete Delivery must set both fields in the same transaction.
Open Decision.
## 17. Recommended Coupling
Recommended for consistency:
```text
successful Complete Delivery
→ Order = DELIVERED
→ delivery task = COMPLETED
```
atomically where both state domains exist.
This recommendation should be confirmed against the final data model.
## 18. No Status Collapse
Do not assume:
```text
DELIVERED = COMPLETED
```
as one enum value unless the implementation explicitly uses one state machine.
# Completion Preconditions
## 19. Authorized Task
The delivery task must belong to the authenticated Courier.
## 20. Active Delivery
The task must have completed the active-transit phase and be eligible for finalization.
The exact required task state immediately before completion is not explicitly named.
Open Decision.
## 21. Order Eligibility
The Order must not already be:
```text
DELIVERED
```
or otherwise terminal in a conflicting way.
## 22. Courier Assignment
The current Courier relationship must still match the authenticated Courier at commit time.
## 23. Delivery Destination
The order must be associated with the intended delivery destination.
Reaching that destination may support the workflow, but destination proximity is not source-defined as a mandatory technical precondition.
# Proof of Delivery Relationship
## 24. Separate e-POD Feature
`Courier.md` defines Proof of Delivery separately.
Its Core Value includes:
```text
upload photos of delivered parcel
collect e-signatures
or scan QR codes
upon successful drop-off
```
## 25. e-POD Purpose
The source describes e-POD as:
```text
a strict verification mechanism
designed to prevent delivery disputes
```
and says it:
```text
mandates that the Courier captures
undeniable digital evidence
that the parcel was safely handed over
or placed at the correct destination.
```
## 26. Source Coupling Ambiguity
The source clearly mandates evidence in the e-POD feature, but does not explicitly state:
```text
Complete Delivery endpoint
must reject unless POD record exists
```
Therefore technical enforcement coupling is not fully defined.
## 27. Recommended Enforcement
For consistency with the e-POD source:
```text
if POD is required for the delivery
→ valid POD must exist
→ Complete Delivery may proceed
```
## 28. POD Methods
Source-supported evidence methods:
```text
photo
e-signature
QR verification
```
The exact required method(s) are defined by the e-POD feature.
## 29. No POD Capture Here
Complete Delivery should consume:
```text
POD verified / evidence reference
```
rather than implementing camera/signature/QR capture itself.
## 30. POD Storage Boundary
Proof of Delivery owns secure media/evidence storage.
Complete Delivery does not manage media upload providers.
# Final Confirmation
## 31. Explicit Action
Completion must require an explicit Courier action.
Recommended:
```text
Complete Delivery
```
or:
```text
Confirm Delivered
```
## 32. Consequential Mutation
The UI should clearly communicate that this action finalizes the delivery.
## 33. Delivery Summary
Before confirmation, show a safe summary such as:
```text
Order / Task Reference
Delivery Destination
Current Delivery State
POD Status where applicable
```
## 34. No Auto-Completion from Screen Open
Opening the completion screen must not change state.
## 35. No Auto-Completion from GPS
Reaching the destination or entering a geofence must not automatically mark:
```text
DELIVERED
```
unless future explicit policy defines it.
# State Transition
## 36. Core Mutation
Source-backed:
```text
Order
→ DELIVERED
```
## 37. Backend Revalidation
Before commit, the backend should verify:
```text
task ownership
current task/order state
completion eligibility
POD requirement if enforced
Courier assignment
```
## 38. Atomic Finalization
Recommended:
```text
revalidate
→ Order = DELIVERED
→ delivery task = COMPLETED if applicable
→ completion history
→ durable Buyer/Seller notification events
→ commit
```
## 39. No Partial Finalization
Avoid:
```text
Order = DELIVERED
but completion history missing
```
or:
```text
task = COMPLETED
but Order remains active
```
where both are meant to change together.
## 40. Transaction Boundary
State and required internal history/event records should commit atomically where practical.
# Notifications
## 41. Source Requirement
Successful completion cascades:
```text
automated notifications
to Buyer and Seller
```
## 42. Recipients
Required recipients:
```text
BUYER
SELLER
```
## 43. Notification Timing
Recommended:
```text
delivery state commits
→ notification event becomes eligible for delivery
```
Do not notify:
```text
Order delivered
```
before the database transition commits.
## 44. Notification Channel
The source does not define whether these notifications use:
```text
in-app
email
mobile Push
SMS
```
Open Decision.
## 45. Brevo
`app.md` selects:
```text
Brevo
```
for email.
If Buyer/Seller completion notifications are sent by email, AISLEY can reuse Brevo.
Brevo is not required for the core `DELIVERED` mutation itself.
## 46. Notification Failure
If Order finalization commits but external delivery of a notification fails:
```text
Order remains DELIVERED
```
Do not roll back physical delivery because an email/push notification failed.
## 47. Retry
Notification retry/recovery belongs to the shared transactional-notification infrastructure.
## 48. Duplicate Notification Protection
Repeated completion retries should not produce uncontrolled duplicate Buyer/Seller notifications.
Use event/idempotency semantics.
# Delivery History Handoff
## 49. Delivery History Source
`Courier.md` says Delivery History queries:
```text
historical delivery tasks
filtered by active courier_id
where status = COMPLETED
```
## 50. Completed Task Visibility
After successful finalization, the task should become eligible for Delivery History according to the chosen state model.
## 51. Historical Data
History may expose:
```text
route
date
delivery specifics
```
but Delivery History owns that read model.
## 52. Dashboard Removal
Completed delivery should no longer appear as an active/current delivery task.
# Profit Dashboard Handoff
## 53. Profit Dashboard Source
Profit Dashboard aggregates earnings:
```text
strictly tied
to the Courier's completed deliveries
```
## 54. Completion as Earnings Input
Complete Delivery provides the completed-delivery event/state that future earnings logic may consume.
## 55. No Earnings Calculation Here
Complete Delivery must not invent:
```text
delivery fee
Courier payout
bonus
tip
```
calculations.
Those belong to financial features.
# Performance Metrics Handoff
## 56. Performance Metrics
Performance Metrics may use:
```text
successful delivery rates
average completion times
```
## 57. Completion Timestamp
A completion timestamp is therefore useful and recommended.
## 58. Metrics Boundary
Complete Delivery records authoritative event/time data.
Performance Metrics owns aggregation.
# Digital Tipping / Feedback Handoff
## 59. Source Context
Digital Tipping & Feedback occurs:
```text
after a successful delivery
```
## 60. Completion Trigger
A completed delivery may make Buyer tipping/feedback available.
Exact timing/payment behavior belongs to that feature.
# Incident Boundary
## 61. Incident Reporting
An unresolved blocker may make a task ineligible for normal completion depending on policy.
## 62. Incident Enforcement
The source does not define whether:
```text
open incident
→ block Complete Delivery
```
Open Decision.
## 63. No Silent Incident Closure
Completing the delivery should not silently delete Incident records.
# Chat Boundary
## 64. Active Chat
Chat is order-linked communication during delivery.
## 65. Post-Completion Chat
Whether the temporary chat closes immediately or remains available for a support window is a Chat policy decision.
Complete Delivery may emit an order-terminal event for Chat to consume.
# Offline Mode Integration
## 66. Source Requirement
Offline Mode allows Couriers to:
```text
continue scanning
and marking deliveries

even when entering
mobile dead zones
```
and later synchronizes queued payloads to the server.
## 67. Offline Completion
This indicates a future Offline Mode may support recording delivery-completion intent while disconnected.
## 68. Ownership
Offline synchronization/conflict resolution belongs to:
```text
Offline Mode
```
not Complete Delivery alone.
## 69. Cached Mutation Is Not Server-Authoritative
While offline:
```text
local completion
≠ confirmed server DELIVERED
```
until synchronization succeeds.
## 70. Recommended Initial Implementation
If Offline Mode is not yet implemented:
```text
Complete Delivery requires connectivity
```
## 71. Offline Conflict
Potential conflict:
```text
Courier marks delivery complete offline
→ server state changes
→ device reconnects
```
Resolution policy must be defined by Offline Mode.
# API
## 72. Completion Detail
Conceptual:
```http
GET /api/courier/delivery-tasks/{taskId}/complete
```
May return:
```text
order/task reference
current status
destination summary
POD requirement/status
completion eligibility
```
## 73. Complete Endpoint
Conceptual:
```http
POST /api/courier/delivery-tasks/{taskId}/complete
```
## 74. Request Body
The request should not need authoritative:
```text
courier_id
order_status
task_status
```
from the client.
The backend derives these.
## 75. POD Reference
If completion requires POD, the backend may resolve POD by task/order relation rather than trusting an arbitrary client media URL.
## 76. Response
Recommended:
```text
task_id
order_id/reference
order_status = DELIVERED
task_status = COMPLETED if applicable
delivered_at
```
## 77. Idempotent Response
If the same Courier retries after successful completion:
```text
return existing final state
```
or equivalent safe result.
# Authorization
## 78. Bearer Token
All Complete Delivery endpoints require a valid Courier Bearer token.
## 79. Exact Role
Backend verifies:
```text
role = COURIER
```
## 80. Task Ownership
The task must belong to the authenticated Courier.
## 81. IDOR
Knowing:
```text
task_id
order_id
POD ID
```
must not allow another Courier to complete the delivery.
## 82. Logistics Scope
The task/order must belong to the Courier's authorized Logistics relationship.
# Security and Privacy
## 83. Buyer PII
Completion screen should expose only necessary Buyer/destination information.
## 84. Seller PII
No unrelated Seller account data is needed.
## 85. Payment Data
Never expose:
```text
card details
CVV
payment tokens
Buyer credentials
```
## 86. Bearer Token
Never log or return the Courier's personal access token.
## 87. POD Security
If POD evidence exists, use secure evidence references.
Do not expose public object-storage URLs unless architecture explicitly supports safe access.
# Concurrency
## 88. Duplicate Completion
Repeated submissions must not create multiple final transitions.
## 89. Courier Retry
Network timeout after commit may cause the Courier to retry.
The backend should return the existing final result.
## 90. Concurrent Logistics Mutation
A Logistics recovery/status action may race with Courier completion.
The authoritative state machine determines the winner/valid result.
## 91. Stale Screen
If current state changed since screen load:
```text
revalidate
→ return current authoritative state
```
## 92. Reassignment Race
If task assignment changes before completion:
```text
old Courier completion
→ reject
```
according to assignment policy.
# Idempotency
## 93. Completion Key
The system should use task/state uniqueness or an explicit idempotency mechanism.
## 94. Notification Idempotency
A duplicate completion retry must not create repeated:
```text
Buyer delivered notification
Seller delivered notification
```
without control.
## 95. History Idempotency
Completion history should represent one logical successful finalization.
# Failure Handling
## 96. Invalid State
If Order/task is not completion-eligible:
```text
reject
→ no final mutation
```
## 97. Already Delivered
If:
```text
Order = DELIVERED
```
and the same valid Courier retries:
```text
return final state
```
where safe.
## 98. Wrong Courier
```text
deny
→ no mutation
```
## 99. Missing POD
If POD is enforced and required evidence is missing:
```text
block completion
→ route Courier to e-POD
```
## 100. POD Invalid
If POD is required but invalid/incomplete:
```text
do not finalize
```
## 101. Network Failure
If request does not reach server:
```text
do not claim server-confirmed delivery
```
unless Offline Mode explicitly queues it.
## 102. Database Failure
If final transaction fails:
```text
do not report success
```
## 103. Notification Failure
If notification delivery fails after commit:
```text
keep final delivery state
→ retry notification
```
# Device Context
## 104. Camera
Complete Delivery itself does not require camera access.
Camera belongs to e-POD when photo/QR evidence is used.
## 105. Location
Complete Delivery source does not require current GPS/geofence.
Do not require location permission solely for finalization unless future policy adds it.
## 106. Signature
Signature capture belongs to e-POD.
## 107. Storage
Media storage permissions belong to e-POD, not core completion.
# Logging and History
## 108. Completion History
Successful completion should record:
```text
Order/task
Courier actor
previous state
final state
delivered_at
```
## 109. POD Link
If applicable, preserve a relationship to the POD record/evidence.
## 110. Notification Event
Store durable notification-event identity where the architecture uses event/outbox delivery.
## 111. Admin Audit Boundary
Do not automatically duplicate every Courier completion into Admin System Audit Logs unless the audit architecture becomes cross-role.
# Performance
## 112. Finalization Path
Complete Delivery should use a short transactional backend path.
## 113. External Notification Delivery
Do not block the completion response waiting for full external notification delivery.
## 114. POD Media
Do not re-download/re-upload large POD media during completion if the evidence was already persisted by e-POD.
## 115. Query Scope
Load only the task/order/POD relationships necessary to validate completion.
# UX
## 116. Recommended Screen
```text
Complete Delivery
├── Delivery Summary
├── Destination
├── Proof of Delivery Status
└── Confirm Delivery
```
## 117. Final Action
Recommended label:
```text
Confirm Delivered
```
or:
```text
Complete Delivery
```
## 118. Warning
Make clear that completion finalizes the delivery.
## 119. POD Required State
If applicable:
```text
Proof of Delivery required
→ Capture Proof
```
before enabling final completion.
## 120. Success State
Example:
```text
Delivery completed.
Order status: DELIVERED.
```
## 121. History Handoff
After success:
```text
View Delivery History
```
may be offered.
## 122. Dashboard Handoff
Active task should disappear/transition out of current-work section after authoritative refresh.
## 123. Duplicate Tap
Disable repeated submission while the request is in progress.
## 124. Error State
Provide:
```text
retry
current authoritative state
next required action
```
where possible.
## 125. Accessibility
The Flutter UI should:
- expose final action clearly to screen readers
- use large touch targets
- not rely on color alone
- announce completion success/failure
- show POD requirement textually
# Third-Party Dependencies
## 126. Core Completion
No new third-party provider is required for the core `DELIVERED` state transition.
Core uses:
```text
AISLEY backend
Orders/delivery-task database
Courier Bearer authentication
```
## 127. Brevo
If email is chosen for Buyer/Seller completion notifications:
```text
Brevo
```
is the existing AISLEY email provider.
## 128. Push / SMS
The source does not require a Push or SMS provider for completion notifications.
## 129. POD Storage
Proof of Delivery separately requires secure cloud/media storage.
`Courier.md` gives:
```text
AWS S3
```
as an example.
This is not a mandatory provider for Complete Delivery itself.
## 130. Maps
Mapbox is not required to perform the final database transition.
It belongs to Deliver Order routing.
# MVP Scope
## 131. Required
- authenticated Courier access
- exact Courier role authorization
- authorized active delivery task
- completion eligibility validation
- explicit final confirmation
- backend state revalidation
- core Order transition to `DELIVERED`
- atomic/idempotent finalization
- completion timestamp/history
- Buyer notification event
- Seller notification event
- Dashboard/current-task reconciliation
- Delivery History handoff
- security/PII protection
- loading/success/error/conflict states
## 132. Conditionally Required
If final data model uses a separate delivery task:
```text
task → COMPLETED
```
should be finalized consistently with Order `DELIVERED`.
If POD is enforced:
```text
valid e-POD
→ required before completion
```
## 133. Recommended
- task `COMPLETED` transition
- POD precondition consistent with e-POD specification
- notification outbox/event
- idempotency key or equivalent uniqueness constraint
- durable completion history
- delayed/asynchronous notification delivery
- retry-safe completion response
## 134. Not Required
- route calculation
- live GPS
- geofence completion
- photo capture inside this feature
- signature capture inside this feature
- QR capture inside this feature
- earnings calculation
- tipping
- performance aggregation
- new email provider
- SMS
- mobile Push
- direct external notification dependency during DB transaction
# Acceptance Criteria
## 135. Access
- Missing/invalid token cannot complete delivery.
- Non-Courier token cannot complete Courier delivery.
- Same-email other-role account does not inherit Courier access.
- Courier can complete only their authorized task.
## 136. Eligibility
- Backend validates current state before completion.
- Stale/reassigned task cannot be finalized by the wrong Courier.
- Opening the screen does not change state.
- Destination arrival alone does not automatically complete delivery.
## 137. Core Finalization
- Successful completion changes the core Order to `DELIVERED`.
- Finalization is idempotent.
- Duplicate retry does not create duplicate logical completion.
- Completion timestamp/history is preserved.
- Task status is handled consistently with the selected task-state model.
## 138. POD
- Complete Delivery does not capture POD evidence itself.
- If POD is required by policy, missing/invalid POD blocks finalization.
- Valid POD may be consumed as a precondition/reference.
- Exact enforcement policy remains aligned with e-POD specification.
## 139. Notifications
- Successful finalization creates notification events for Buyer and Seller.
- Notifications are not emitted as successful before state commit.
- Notification-delivery failure does not roll back a committed physical delivery.
- Duplicate completion retries do not create uncontrolled duplicate notifications.
## 140. Handoffs
- Completed task no longer appears as active work after refresh.
- Completed task becomes eligible for Delivery History according to task-state model.
- Completed delivery can feed Profit Dashboard/Performance Metrics later without those calculations living here.
## 141. Security
- Task/Order/POD IDs cannot bypass authorization.
- Bearer token is protected.
- PII is minimized.
- Payment/security secrets are absent.
## 142. Third-Party
- Core completion works without a new third-party provider.
- Brevo may be reused only if Email is chosen for Buyer/Seller notifications.
- Mapbox is not required for finalization.
- POD storage provider belongs to e-POD.
# Tests
## 143. Backend Tests
Test:
- missing token denied
- invalid token denied
- Buyer/Seller/Logistics token denied
- authenticated Courier allowed
- same-email role isolation
- authorized task
- wrong Courier denied
- stale/reassigned task
- invalid state
- successful Order → DELIVERED
- task → COMPLETED if model uses it
- atomic finalization
- duplicate completion idempotent
- delivered_at recorded
- completion history created
- POD missing blocked if required
- POD valid accepted if required
- unrelated POD rejected
- Buyer notification event created
- Seller notification event created
- notification failure does not roll back Order
- duplicate retry does not duplicate notifications
- active-task query excludes completed task
- Delivery History includes task according to state model
- no PII/security-secret leakage
## 144. Flutter Tests
Test:
- Complete Delivery screen loads
- final delivery summary
- destination summary
- POD status if implemented
- Capture Proof navigation if required
- Complete/Confirm button
- duplicate button disabled while loading
- success state
- `DELIVERED` display
- invalid-state conflict
- wrong/stale task response
- network error
- Dashboard reconciliation
- Delivery History navigation
- screen-reader labels
- touch-target sizing
- success/error announced accessibly
# Open Decisions
## 145. Open Decisions
The current sources do not define:
1. exact task state immediately before completion
2. exact state field owning `IN_TRANSIT`
3. whether `delivery_task.status = COMPLETED` is set by Complete Delivery
4. whether Order `DELIVERED` and task `COMPLETED` must commit atomically
5. whether every delivery requires e-POD before finalization
6. which POD method is required per order
7. whether multiple POD methods may be required
8. whether current GPS is required at finalization
9. whether destination geofence is ever used
10. whether open Incident blocks completion
11. reassignment rules during active transit
12. cancellation behavior before completion
13. exact Buyer notification channel
14. exact Seller notification channel
15. whether notification preferences can suppress transactional delivered notices
16. notification retry policy
17. notification-event/outbox schema
18. completion-history schema
19. offline completion queue behavior
20. offline conflict-resolution policy
21. exact delivered timestamp source
22. whether post-delivery Chat remains open
23. whether Buyer tipping/feedback becomes available immediately
24. exact API routes
25. whether completion action requires an extra confirmation dialog
# Final Definition
## 146. Final Definition
AISLEY Complete Delivery is:
```text
the Courier-side finalization workflow
for a successfully delivered parcel.
```
Source-backed final mutation:
```text
core Order
→ DELIVERED
```
Source-backed downstream behavior:
```text
DELIVERED
→ automated Buyer notification
→ automated Seller notification
```
Related delivery-task state:
```text
Delivery History expects:
delivery_task.status = COMPLETED
```
so the recommended model is:
```text
successful finalization
→ Order = DELIVERED
→ delivery task = COMPLETED
```
where AISLEY maintains separate Order and delivery-task state machines.
Critical boundary:
```text
Deliver Order
→ active transit

Proof of Delivery
→ delivery evidence

Complete Delivery
→ final state mutation
```
Offline rule:
```text
Offline Mode may later queue
mark-delivered actions,

but local offline completion
is not server-authoritative
until synchronization succeeds.
```
Third-party rule:
```text
No new third-party provider
is required for core Complete Delivery.
```
