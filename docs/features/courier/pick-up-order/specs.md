---
role: Courier/Rider
feature: Pick Up Order
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Flutter Courier Mobile Application / Physical Parcel Pickup
source_coverage: Courier.md, app.md
---
# Pick Up Order Specification
## 1. Purpose
Pick Up Order is AISLEY's Courier workflow for confirming the physical handover of a parcel from its pickup origin to the Courier.
`Courier.md` defines the Core Value as:
```text
Proceed to sorting center
Verify Order Information
Confirm Item Pickup
```
Its Expanded Definition states:
```text
The physical handover phase.

The courier navigates
to the origin point,

validates the physical parcel
against digital manifests,

and formally logs
the successful possession
of the item
into the system.
```
Its System Context states:
```text
Integrates with
device camera/barcode scanning modules

to validate
the Order or Package ID,

subsequently updating
the system state
to IN_TRANSIT.
```
This feature therefore owns the physical possession confirmation that occurs after a Courier has accepted a delivery request.
A separate `flow.md` is required because Pick Up Order has a meaningful stateful lifecycle:
```text
ACCEPTED task
→ proceed to pickup origin
→ identify parcel
→ validate Order/Package ID
→ confirm physical possession
→ IN_TRANSIT
```
## 2. Primary Actor
Primary actor:
```text
COURIER / RIDER
```
The Courier performs pickup through the Flutter mobile application.
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
Every pickup request must resolve:
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
Therefore pickup authorization must use the exact authenticated Courier account.
A same-email Buyer/Seller/Logistics account is a separate logical account.
# Feature Responsibility
## 5. Pick Up Order Owns
This feature owns:
- opening an accepted delivery task for pickup
- presenting pickup-origin context
- showing the digital parcel/order manifest required for verification
- scanning an Order or Package identifier
- validating the scanned identifier against the active delivery task
- allowing the Courier to confirm physical possession
- revalidating task ownership/state before commit
- transitioning the applicable delivery/shipment state to `IN_TRANSIT`
- recording pickup time/actor where modeled
- preventing duplicate/conflicting pickup transitions
- handing off to Deliver Order
## 6. Pick Up Order Does Not Own
This feature does not own:
- accepting a delivery request
- Logistics rider deployment
- changing Courier assignment
- route optimization policy
- Waybill generation
- Seller packing
- sorting-center transfer logic
- Proof of Delivery
- marking the final Order `DELIVERED`
- delivery-history aggregation
- earnings calculation
- incident-resolution logic
## 7. Core Boundary
Pick Up Order means:
```text
Courier has physically received
the correct parcel
```
It does not mean:
```text
parcel has been delivered
```
# Lifecycle Context
## 8. Previous State
`Courier.md` explicitly states that Accept Delivery Requests changes the delivery task to:
```text
ACCEPTED
```
## 9. Pickup Transition
Pick Up Order then performs:
```text
verify parcel
→ confirm possession
→ IN_TRANSIT
```
## 10. Required Sequence
Recommended source-consistent sequence:
```text
AVAILABLE / OFFERED
→ ACCEPTED
→ IN_TRANSIT
→ DELIVERED
```
Only:
```text
ACCEPTED
→ IN_TRANSIT
```
is owned by this feature.
The exact pre-acceptance state name is Open.
## 11. No Acceptance Bypass
A Courier should not use Pick Up Order on a request they have not validly accepted/been assigned according to the final delivery-task model.
## 12. No Delivery Completion
Pick Up Order must not transition the core Order directly to:
```text
DELIVERED
```
That belongs to Complete Delivery.
# Pickup Origin
## 13. Sorting Center
The Core Value explicitly says:
```text
Proceed to sorting center
```
Therefore sorting-center pickup is a source-backed origin.
## 14. Seller Location
Courier Dashboard also states packages may be waiting for pickup at:
```text
sorting centers
or seller locations
```
Therefore Seller-origin pickup may also be supported where the active delivery task uses that origin.
## 15. Origin Authority
Pickup origin must come from the authoritative delivery task/order/shipment.
The mobile app must not invent or freely replace the pickup location.
## 16. Origin Details
Recommended pickup information:
```text
pickup type
pickup address/summary
contact/context where operationally necessary
order/package reference
```
Exact fields are Open.
## 17. Pickup Navigation
Proceeding to the pickup location may use route/navigation context.
Detailed navigation behavior belongs primarily to Deliver Order/shared routing.
# Digital Manifest
## 18. Source Requirement
The Courier must:
```text
validate the physical parcel
against digital manifests
```
## 19. Manifest Purpose
The digital manifest helps answer:
```text
Is this physical parcel
the parcel assigned to this delivery task?
```
## 20. Manifest Data
Recommended safe manifest summary:
```text
Order/Package reference
pickup origin
package summary
destination summary
```
Only implemented and necessary fields should be displayed.
## 21. No Arbitrary Manifest Editing
The Courier must not edit authoritative order/package identity from this screen.
## 22. Seller/Buyer Privacy
The manifest should expose only operational information required for pickup verification.
# Order / Package Identifier
## 23. Source Identifier
`Courier.md` explicitly requires validation of:
```text
Order
or
Package ID
```
## 24. Identifier Scope
The exact identifier format is not defined.
Possible implementation values may be:
```text
Order reference
Package reference
Waybill reference
QR/barcode payload
```
but only identifiers actually mapped by the backend should be accepted.
## 25. Waybill Relationship
`app.md` separately defines a Logistics Waybill flow and scan-based parcel status automation.
Waybill may be one implementation source for parcel identity, but Pick Up Order must not assume every Courier scan is necessarily the same Logistics transfer/dispatch Waybill event.
## 26. Stable Mapping
A scanned identifier must resolve to the intended authoritative Order/Package record.
## 27. No Client Trust
The client must not submit:
```text
"this package matches"
```
as authoritative.
The backend validates the scanned/reference identifier against the active task.
# Camera / Barcode Scanning
## 28. Source Requirement
Pick Up Order integrates with:
```text
device camera/barcode scanning modules
```
## 29. Camera Permission
If camera scanning is used, the mobile app must request device camera permission according to platform requirements.
## 30. Permission Denied
If the user denies camera permission:
```text
do not crash
do not falsely confirm pickup
```
Provide an appropriate error/fallback if the project defines one.
## 31. Barcode / QR Formats
`Courier.md` does not define the exact symbology.
Do not invent a mandatory format here.
The Waybill source elsewhere mentions:
```text
Code 128
or
QR
```
for Logistics Waybill labels.
If Courier pickup scans Waybills, it may reuse the same compatible format.
## 32. Scanner Library
A mobile barcode/camera library is required as an application dependency.
This does not require a hosted third-party provider.
## 33. Scan Result
A successful scan should produce a bounded identifier payload.
## 34. Scan Validation
The backend should validate:
```text
identifier resolves
+
identifier belongs to active task
+
task belongs to authenticated Courier
+
task is pickup-eligible
```
## 35. Wrong Parcel
If the scanned Order/Package ID does not match:
```text
reject pickup
→ show mismatch
```
## 36. Unknown Parcel
Unknown identifier:
```text
reject
→ no task mutation
```
## 37. Duplicate Scan
Repeated scans of the same correct parcel must not cause multiple state transitions.
# Manual Identifier Entry
## 38. Source Boundary
`app.md` explicitly says Logistics can automate status by scanning or manually entering a Waybill QR/reference number.
It does not explicitly say the Courier Pick Up Order feature supports manual identifier entry.
Therefore manual entry for Rider pickup is:
```text
Open Decision
```
and must not be treated as a source requirement.
## 39. Recommended Fallback
If operationally needed, manual entry may be added as a fallback after explicit project decision.
## 40. Same Validation
If manual entry is later enabled, it must use the same backend validation as camera scanning.
# Physical Possession Confirmation
## 41. Source Requirement
Core Value explicitly requires:
```text
Confirm Item Pickup
```
## 42. Two-Step Principle
Recommended:
```text
scan/validate identity
→ Courier explicitly confirms possession
```
A successful scan alone should not necessarily mutate state unless the UX intentionally combines validation and confirmation.
## 43. Confirmation Action
Recommended primary action:
```text
Confirm Pickup
```
## 44. Consequential Action
Confirmation is a consequential state mutation.
The UI should make the order/package identity clear before submission.
## 45. No Accidental Pickup
Opening the screen, viewing the manifest, or scanning a wrong item must not mark the task `IN_TRANSIT`.
# State Mutation
## 46. Source-Backed State
Successful pickup changes system state to:
```text
IN_TRANSIT
```
## 47. State Domain Ambiguity
The source does not explicitly say whether `IN_TRANSIT` belongs to:
```text
delivery_task.status
Order.status
shipment.status
```
Open Decision.
## 48. Shared State Service
Recommended:
```text
Courier Pick Up Order
+
Logistics scanner
+
Update Status
→ shared Order/Shipment Transition Service
```
where the same physical parcel state is being mutated.
## 49. No Conflicting State Logic
Avoid separate rules where:
```text
Courier app says ACCEPTED → IN_TRANSIT is valid
but Logistics Update Status says it is not
```
The backend transition policy should be authoritative.
## 50. Transition Validation
Conceptually:
```text
current state = pickup-eligible
+
actor = authenticated Courier
+
matching parcel
→ IN_TRANSIT allowed
```
## 51. Invalid Transition
If the task is already:
```text
IN_TRANSIT
DELIVERED
COMPLETED
```
or otherwise no longer pickup-eligible:
```text
do not apply a new pickup transition
```
# Task Ownership
## 52. Courier Assignment
The active task must belong to the authenticated Courier according to the accepted assignment model.
## 53. IDOR
Knowing an:
```text
task_id
order_id
package_id
```
must not permit another Courier to confirm pickup.
## 54. Reassignment Race
If Logistics reassigns the task before pickup:
```text
backend revalidation
→ old Courier cannot confirm possession
```
according to final reassignment policy.
## 55. Current Courier
At commit time:
```text
task.courier_id
```
or equivalent assignment relation must match the authenticated Courier where the model uses final assignment.
# Concurrency and Idempotency
## 56. Concurrent Pickup
Two clients must not both transition the same parcel from pickup-ready to `IN_TRANSIT`.
## 57. Atomic Commit
Recommended transaction:
```text
revalidate task
→ validate scanned parcel
→ validate Courier ownership
→ transition to IN_TRANSIT
→ create pickup/status history
→ commit
```
## 58. Duplicate Submission
Repeated Confirm Pickup requests caused by:
```text
double tap
network retry
mobile retry
```
must be idempotent or uniqueness-constrained.
## 59. Already Picked Up
If the same Courier retries after successful commit:
```text
return current IN_TRANSIT state
```
or equivalent safe result.
## 60. Stale Screen
If task state changed while the pickup screen was open:
```text
reject stale mutation
→ show current authoritative state
```
# Handoff to Deliver Order
## 61. Next Feature
After successful pickup:
```text
Pick Up Order
→ Deliver Order
```
## 62. Active Transit
`Courier.md` defines Deliver Order as:
```text
the active transit phase
```
## 63. Dashboard Update
After pickup:
```text
task = IN_TRANSIT
→ Dashboard/current task refreshes
→ next action = Deliver Order
```
## 64. Routing
Detailed route/navigation belongs to Deliver Order.
Pick Up Order may navigate to that feature after success.
# Logistics Update Status Boundary
## 65. Manual Recovery
`Logistics.md` says Logistics may manually advance parcel state when automated rider scanning fails.
Therefore:
```text
Courier pickup scan/confirmation
= normal Courier path

Logistics Update Status
= authorized manual recovery path
```
## 66. Shared Transition Rules
Both paths should use the same authoritative transition policy where they mutate the same state.
## 67. Recovery Does Not Duplicate Pickup
If Logistics has already validly recovered the parcel to `IN_TRANSIT`, a late Courier pickup submission must not create another transition.
# Waybill Boundary
## 68. Waybill Feature
Waybill owns:
```text
printable/scannable parcel identity
```
## 69. Pickup Scan
Pick Up Order consumes:
```text
Order/Package identifier
```
and may reuse Waybill QR/barcode when the architecture chooses that mapping.
## 70. No Waybill Generation
Courier does not generate the Logistics Waybill during Pick Up Order.
# Notifications
## 71. Source Requirement
`Courier.md` does not explicitly require Buyer/Seller notification at pickup.
Do not invent a notification channel as mandatory.
## 72. Event Support
The platform may emit a transactional event when state becomes:
```text
IN_TRANSIT
```
if the shared order-notification policy requires it.
This remains outside the strict Pick Up Order source requirement.
## 73. Brevo
Brevo email is not required merely to confirm pickup.
## 74. Push / SMS
No Push or SMS provider is required by this feature.
# Offline Behavior
## 75. Offline Mode Boundary
`Courier.md` defines Offline Mode separately.
## 76. Pickup Mutation Offline
Whether `IN_TRANSIT` can be queued offline is not defined.
Open Decision.
## 77. Concurrency Risk
Because pickup mutates assignment/order state, delayed offline submission may conflict with server changes.
Any offline implementation must follow the Offline Mode conflict policy.
## 78. Recommended MVP
Recommended for initial MVP:
```text
pickup confirmation requires server connectivity
```
unless Offline Mode is implemented deliberately.
## 79. Cached Manifest
Offline Mode may later cache the active task manifest for reference.
This does not make cached state authoritative.
# API
## 80. Pickup Detail
Conceptual:
```http
GET /api/courier/delivery-tasks/{taskId}/pickup
```
## 81. Validate Scan
Possible conceptual endpoint:
```http
POST /api/courier/delivery-tasks/{taskId}/pickup/validate
```
Example:
```json
{
  "identifier": "scanned-value"
}
```
Whether validation and confirmation are one or two backend calls is Open.
## 82. Confirm Pickup
Conceptual:
```http
POST /api/courier/delivery-tasks/{taskId}/pickup/confirm
```
Possible request:
```json
{
  "identifier": "validated-package-id"
}
```
## 83. Backend Actor
No client-supplied:
```text
courier_id
```
is authoritative.
## 84. Response
Recommended:
```text
task_id
order/package reference
status = IN_TRANSIT
picked_up_at
next_action
```
where these fields exist.
# Security
## 85. Bearer Authentication
All pickup endpoints require a valid Courier Bearer token.
## 86. Role
Backend verifies:
```text
role = COURIER
```
## 87. Task Scope
The active task must belong to the authenticated Courier.
## 88. Parcel Scope
The scanned Order/Package ID must belong to the active task.
## 89. PII Minimization
Pickup manifest must expose only operationally necessary Buyer/Seller/order data.
## 90. Token Protection
Bearer tokens must never appear in:
```text
screenshots
logs
API payloads
scanner payloads
```
## 91. Scanner Payload Safety
The scanner should treat scanned content as untrusted input.
Do not execute arbitrary URI/script content.
# Device Permissions
## 92. Camera
Camera access is required only if the user uses camera scanning.
## 93. Permission Prompt
Request permission at the point the feature needs scanning, according to mobile platform conventions.
## 94. Denied Permission
Provide clear guidance/error.
Do not block unrelated app functions unnecessarily.
## 95. Storage Permission
Pick Up Order source does not require file/media storage permission.
Do not request it merely for barcode scanning unless the chosen scanner implementation truly needs it.
# Error Handling
## 96. Invalid Task
```text
task not found / unauthorized
→ no pickup mutation
```
## 97. Wrong Package
```text
scan mismatch
→ show mismatch
→ remain pre-pickup
```
## 98. Unknown Identifier
```text
not found
→ no mutation
```
## 99. Scanner Error
```text
camera/scanner failure
→ allow retry
→ no mutation
```
## 100. Camera Denied
```text
show permission state
→ do not claim pickup
```
## 101. Network Failure
```text
confirmation request fails
→ do not claim IN_TRANSIT
```
unless an Offline Mode queue explicitly takes ownership.
## 102. Concurrent State Change
```text
server reports task no longer pickup-eligible
→ show current state
→ stop duplicate pickup
```
# Operational History
## 103. Pickup History
Successful pickup should preserve enough history to answer:
```text
which task
which parcel
which Courier
previous state
new state
pickup time
```
## 104. Scan Metadata
Whether to record:
```text
scanner type
raw barcode value
device metadata
```
is not defined.
Avoid storing unnecessary raw scanner/PII data.
## 105. Actor
Actor is the authenticated Courier.
## 106. Admin Audit Boundary
Do not automatically copy every pickup event into the Admin-specific System Audit Logs ledger unless audit architecture is broadened.
# Performance
## 107. Pickup Detail
Load only the active task and parcel/order data needed for verification.
## 108. Scan Validation
Identifier resolution should use indexed/reference lookup.
## 109. No Large History
Do not load entire order status history merely to display the pickup screen.
## 110. Commit Latency
Pickup confirmation should use a direct transactional backend path.
# UX
## 111. Recommended Screen
```text
Pick Up Order
├── Pickup Location
├── Order / Package Manifest
├── Scan Order / Package ID
├── Verification Result
└── Confirm Pickup
```
## 112. Pickup Origin
Clearly display:
```text
Sorting Center
or
Seller Location
```
where applicable.
## 113. Manifest
Show enough data for the Courier to visually compare the physical parcel.
## 114. Scan Action
Recommended:
```text
Scan Package
```
## 115. Verification Result
Clear outcomes:
```text
Matched
Mismatch
Not Found
```
Use text, not color alone.
## 116. Confirm Pickup
Enable the consequential confirmation only when the required validation conditions are met.
Exact UX is Open.
## 117. Success
On success:
```text
Pickup confirmed
Status: IN_TRANSIT
→ Continue Delivery
```
## 118. Already Picked Up
If server says task is already `IN_TRANSIT`, show current state rather than a generic error where safe.
## 119. Accessibility
The Flutter UI should:
- expose scanner controls to screen readers where possible
- provide textual scan results
- use adequate touch targets
- not rely on camera preview alone
- provide accessible error/retry actions
# Third-Party Dependencies
## 120. Core Pickup
No new hosted third-party provider is required.
Core uses:
```text
Flutter device camera
barcode/QR scanning library
AISLEY backend
delivery-task/order database
```
## 121. Scanner Library
A barcode/camera scanning package may be used.
This is an application dependency, not a hosted service requirement.
## 122. Mapbox
Mapbox may be used to navigate to/from pickup as part of Rider routing.
It is not required to validate parcel identity.
## 123. Brevo
Not required.
## 124. SMS / Push
Not required for core pickup confirmation.
# MVP Scope
## 125. Required
- authenticated Courier access
- exact Courier role authorization
- accepted/current delivery task
- pickup-origin display
- digital manifest
- camera/barcode scanning integration
- Order or Package ID validation
- backend parcel/task matching
- explicit Confirm Pickup
- backend state revalidation
- atomic transition to `IN_TRANSIT`
- Courier ownership validation
- duplicate/idempotent handling
- Pick Up → Deliver Order handoff
- loading/success/error/conflict states
- camera permission handling
- PII minimization
- token protection
## 126. Recommended
- two-step Scan then Confirm
- clear mismatch UI
- pickup timestamp
- operational transition history
- shared state-transition service with Logistics Update Status
- reuse Waybill-compatible QR/barcode where architecture supports it
- server connectivity requirement for MVP
## 127. Not Required
- Proof of Delivery
- final `DELIVERED` mutation
- manual identifier entry
- offline pickup queue
- signature at pickup
- pickup photo
- new email provider
- SMS
- Push
- external scanning service
- arbitrary inspection checklist
- invented package-condition workflow
# Acceptance Criteria
## 128. Access
- Guest/invalid token cannot access pickup.
- Non-Courier token cannot confirm pickup.
- Same-email other-role account does not inherit Courier access.
- Courier can act only on their authorized task.
## 129. Manifest
- Pickup screen shows authoritative task/parcel information.
- Courier cannot edit authoritative Order/Package identity.
- PII is minimized.
## 130. Scan
- Device camera/barcode scanning can obtain an identifier.
- Backend validates identifier against the active task.
- Matching identifier can proceed.
- Wrong identifier is rejected.
- Unknown identifier is rejected.
- Scan alone does not accidentally complete delivery.
## 131. Confirmation
- Explicit pickup confirmation is required according to configured UX.
- Backend revalidates task/Courier/parcel.
- Successful pickup changes state to `IN_TRANSIT`.
- Pickup does not mark the final Order `DELIVERED`.
- Pickup does not reassign the Courier.
## 132. Concurrency
- Reassigned/invalid task cannot be picked up by prior Courier.
- Duplicate confirm requests do not create multiple transitions.
- Stale task state returns authoritative conflict/current state.
## 133. Handoff
- Successful pickup updates Dashboard/current task.
- Successful pickup can proceed to Deliver Order.
- Logistics Update Status can recover failed scanning through its own authorized workflow without duplicating state transitions.
## 134. Device / Security
- Camera denial is handled safely.
- Scanner input is treated as untrusted.
- Bearer token is protected.
- Task/package IDs cannot bypass authorization.
- Payment/security secrets are absent.
## 135. Third-Party
- Core pickup works without a hosted third-party provider.
- Mobile scanning may use a Flutter/local library.
- Mapbox/Brevo/SMS/Push are not required for parcel validation.
# Tests
## 136. Backend Tests
Test:
- missing token denied
- invalid token denied
- Buyer/Seller/Logistics token denied
- Courier token allowed
- same-email role isolation
- authorized accepted task
- unauthorized task denied
- wrong Courier denied
- authoritative manifest
- correct Order ID validation
- correct Package ID validation
- wrong package rejected
- unknown identifier rejected
- valid ACCEPTED → IN_TRANSIT
- invalid state transition rejected
- task already IN_TRANSIT idempotent/safe
- task DELIVERED rejected
- reassignment race
- duplicate confirm
- operational history
- PII minimized
- token/payment secrets absent
## 137. Flutter Tests
Test:
- pickup screen loads
- pickup origin
- manifest
- Scan Package action
- camera permission granted
- camera permission denied
- scanner success
- scanner failure
- correct match
- mismatch
- unknown identifier
- Confirm Pickup
- loading/disabled duplicate tap
- success state IN_TRANSIT
- conflict state
- network error
- Continue Delivery navigation
- screen-reader labels
- textual verification status
- touch-target accessibility
# Open Decisions
## 138. Open Decisions
The current sources do not define:
1. exact pickup-eligible task state beyond accepted-flow context
2. whether `IN_TRANSIT` is task, shipment, or Order status
3. exact Order/Package identifier format
4. whether Courier scans Waybill QR specifically
5. QR vs Code 128 vs other barcode support
6. whether manual identifier entry is allowed
7. exact manifest fields
8. Buyer/Seller contact disclosure
9. whether scan automatically confirms or requires separate Confirm Pickup
10. whether pickup requires current GPS
11. whether pickup requires geofence/proximity to origin
12. whether package condition must be checked
13. whether pickup photo/signature is ever required
14. multiple-package task behavior
15. partial pickup behavior
16. reassign-after-accept behavior
17. offline pickup support
18. scanner library/package
19. scanner payload retention
20. pickup notification policy
21. exact transition-history schema
22. exact API routes
# Final Definition
## 139. Final Definition
AISLEY Pick Up Order is:
```text
the physical parcel handover workflow
for an accepted Courier delivery task.
```
Core source-backed flow:
```text
ACCEPTED task
→ proceed to sorting center / pickup origin
→ compare physical parcel with digital manifest
→ scan Order or Package ID
→ validate match
→ confirm possession
→ IN_TRANSIT
```
Critical state boundary:
```text
Accept Delivery Request
→ ACCEPTED

Pick Up Order
→ IN_TRANSIT

Complete Delivery
→ DELIVERED
```
Device integration:
```text
Flutter camera/barcode scanning module
→ Order/Package validation
```
Third-party rule:
```text
No hosted third-party provider
is required for core pickup verification.
```
