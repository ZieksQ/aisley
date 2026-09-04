---
role: Logistics
feature: Update Status
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Logistics Web Application / Order and Parcel State Management
source_coverage: Logistics.md, Courier.md, app.md
---
# Update Status Specification
## 1. Purpose
Update Status is AISLEY's Logistics state-management feature for manually advancing the physical parcel/order lifecycle when normal scan-based automation cannot complete the transition.
`Logistics.md` defines:
```text
Core Value:
Update order status once rider pick up order.
```
Expanded definition:
```text
A state-management utility
for tracking the physical parcel.

It gives Logistics personnel authority
to manually advance an order's lifecycle state
in cases where automated rider scanning fails.
```
Example:
```text
marking a parcel
as transitioning from the hub to the rider
```
System context:
```text
Interfaces directly with
the order state machine in the database

and triggers corresponding notifications
to Buyers and Sellers
when status mutates.
```
`app.md` further states:
```text
logistics receives order
→ waybill
→ sorted
→ transfer
→ dispatch

automates the order status
by scanning
or manually entering
the waybill QR or reference number.
```
A separate `flow.md` is required because this feature owns controlled state transitions and recovery behavior.
## 2. Primary Actor
Primary actor:
```text
LOGISTICS
```
The Logistics user performs manual status recovery through the Logistics web application.
## 3. Related Actors
Status changes affect:
```text
BUYER
SELLER
COURIER
```
However, the source explicitly requires corresponding notifications to:
```text
BUYER
SELLER
```
when the order status mutates.
## 4. Authentication
The Logistics web application uses the existing Laravel Sanctum stateful authentication model.
Every Update Status request must resolve:
```text
authenticated user_id
+
LOGISTICS role
```
AISLEY identity remains:
```text
unique(email, role)
```
A matching email under another role does not grant Logistics access.
# Feature Responsibility
## 5. Update Status Owns
This feature owns:
- locating the relevant order/parcel
- reading the current authoritative state
- presenting allowed Logistics transitions
- accepting manual recovery status changes
- validating state transitions
- preventing invalid/skipped transitions
- performing atomic status mutation
- recording status history
- supporting waybill/reference-based lookup
- handling scan/manual-entry recovery
- triggering Buyer/Seller notification events after commit
- concurrency and idempotency protections
## 6. Update Status Does Not Own
This feature does not own:
- defining the entire marketplace order state machine
- Courier task acceptance
- rider deployment
- waybill generation
- barcode/QR creation
- Courier proof of delivery
- Buyer notification preferences
- Admin Notification Management campaigns
- cancellation/refund policy
- payment state
- Seller packing logic
## 7. Core Principle
Update Status is not:
```text
free-form status editing
```
It is:
```text
validated transition
from current authoritative state
to an allowed next state
```
## 8. State Machine Authority
The backend order/shipment state machine is authoritative.
The frontend must never decide independently that:
```text
CURRENT_STATUS
→ TARGET_STATUS
```
is valid.
The backend validates the transition.
# Source Lifecycle Context
## 9. Marketplace Order Flow
From `app.md`:
```text
customer order
→ seller approved
→ seller packed
→ logistics flow
→ order delivered
```
## 10. Logistics Flow
From `app.md`:
```text
courier door to door pick up
→ transfer & dispatch flow
→ logistics assigned courier for delivery
→ rider picks up for delivery
```
## 11. Transfer and Dispatch
From `app.md`:
```text
logistics receives order
→ waybill
→ sorted
→ transfer
→ dispatch
```
## 12. Source Status Examples
Across Logistics and Courier sources, explicit examples include:
```text
READY_FOR_PICKUP
AT_SORTING_CENTER
ACCEPTED
IN_TRANSIT
DELIVERED
COMPLETED
```
These come from different order/task contexts.
They must not automatically be treated as one single final enum without reconciling the implemented domain model.
## 13. Logistics Dashboard Statuses
`Logistics.md` explicitly mentions:
```text
READY_FOR_PICKUP
AT_SORTING_CENTER
```
for Logistics Dashboard filtering.
## 14. Courier Acceptance State
`Courier.md` says accepting a delivery request changes the delivery task to:
```text
ACCEPTED
```
This may be a delivery-task status rather than the same field as the parcel/order status.
Open Decision.
## 15. Courier Pickup State
`Courier.md` says successful parcel pickup updates system state to:
```text
IN_TRANSIT
```
## 16. Delivery Completion
`Courier.md` gives the core order state example:
```text
DELIVERED
```
Delivery History separately refers to delivery tasks with:
```text
COMPLETED
```
This reinforces that order and delivery-task states may be separate.
## 17. Do Not Collapse State Domains
Recommended architecture:
```text
Order / Parcel Status
≠
Delivery Task Status
≠
Courier Assignment Status
```
unless the implementation explicitly models them as one state machine.
Update Status should modify only the state field it owns.
# Manual Recovery Role
## 18. Source Intent
The source emphasizes manual state advancement:
```text
when automated rider scanning fails
```
Therefore the main use case is operational recovery.
## 19. Normal Path
Normal state progression may happen through:
```text
waybill QR scan
reference number scan/entry
Courier pickup confirmation
other workflow actions
```
## 20. Manual Fallback
If automated scan processing fails or cannot be used:
```text
Logistics identifies parcel
→ views current state
→ selects allowed next transition
→ confirms manual update
```
## 21. Manual Entry
`app.md` explicitly allows:
```text
manually entering
the waybill QR or ref number
```
Therefore the feature should support lookup by the implemented:
```text
waybill QR payload
or
reference number
```
## 22. No Arbitrary Record Selection
Knowing a reference number does not bypass Logistics authorization.
The backend must still verify the order belongs to the Logistics user's permitted scope.
# Allowed Transitions
## 23. Transition Table
The authoritative backend should maintain an explicit transition policy.
Conceptually:
```text
current status
+
actor role
+
order/task context
→ allowed next status(es)
```
## 24. Logistics-Specific Transitions
Only transitions authorized for:
```text
LOGISTICS
```
should be offered through this feature.
## 25. No Free Text Status
The client must not submit arbitrary status strings.
Target status must be chosen from backend-supported values.
## 26. No Silent Skip
The feature must not silently jump over required lifecycle stages.
Example:
```text
AT_SORTING_CENTER
→ DELIVERED
```
must be rejected unless the authoritative state machine explicitly permits it.
## 27. No Silent Rollback
Backward transitions should not be allowed unless explicitly defined by policy.
Example:
```text
IN_TRANSIT
→ READY_FOR_PICKUP
```
must not be invented as a normal recovery action.
## 28. Current-State Revalidation
The backend must re-read/revalidate current state at commit time.
This protects against stale screens and concurrent updates.
## 29. Transition Reason
Because this feature is a manual fallback, recording a reason is recommended.
Possible values should be configured, not invented.
A free-text note may also be supported.
Exact requirement is Open.
# Waybill and Scan Integration
## 30. Waybill Ownership
The Waybill feature owns:
```text
order details document
print
barcode / QR generation
```
Update Status consumes the resulting identifier.
## 31. Scan Automation
`app.md` says scanning can automate order status.
Recommended architecture:
```text
scan/reference input
→ resolve order/waybill
→ state transition service
→ validate
→ update
```
The same transition service should be reused by manual recovery.
## 32. Single Transition Authority
Avoid:
```text
scanner has one status rule
manual UI has another status rule
Courier app has another duplicate status rule
```
Recommended:
```text
shared Order/Shipment Transition Service
```
## 33. Invalid Waybill
If a QR/reference cannot be resolved:
```text
show invalid/not found
→ no mutation
```
## 34. Duplicate Scan
Repeated scanning of the same waybill must not advance the parcel multiple states unintentionally.
The operation should be idempotent for the same intended transition/event.
## 35. Wrong Logistics Scope
A valid waybill belonging to another Logistics organization must still be denied.
# Courier Boundary
## 36. Pick Up Order
Courier Pick Up Order owns the Courier-side physical handover confirmation.
`Courier.md` says:
```text
validate parcel
→ successful possession
→ state becomes IN_TRANSIT
```
## 37. Logistics Manual Recovery
Update Status may manually reproduce an otherwise valid state transition if the automated scan/Courier update failed.
It must not fabricate physical possession without an operational basis.
## 38. Courier Acceptance
Courier task acceptance belongs to:
```text
Accept Delivery Requests
```
Update Status should not arbitrarily change a delivery task to:
```text
ACCEPTED
```
unless Logistics is explicitly authorized to perform that recovery action.
## 39. Proof of Delivery
Delivery completion/proof belongs primarily to Courier delivery features.
Update Status should not be used to bypass required proof-of-delivery checks once those are implemented.
# Deploy Rider Boundary
## 40. Rider Assignment
Deploy Rider owns:
```text
which Courier receives the task
```
Update Status owns:
```text
allowed order/parcel state transition
```
## 41. Assignment Is Not Pickup
Never:
```text
Courier assigned
→ automatically mark IN_TRANSIT
```
unless the authoritative state machine explicitly defines that behavior.
# Dashboard Integration
## 42. Dashboard Handoff
The Logistics Dashboard may provide:
```text
Update Status
```
for the selected order.
Flow:
```text
Dashboard
→ exact order
→ Update Status
→ authoritative current state
→ allowed transition
```
## 43. Dashboard Refresh
After successful mutation:
```text
Dashboard
→ refetch
→ display new authoritative status
```
# Status History
## 44. History Requirement
Physical parcel state changes should preserve a history sufficient to reconstruct lifecycle progression.
Recommended fields:
```text
order_id / parcel_id
from_status
to_status
actor_type
actor_user_id
source
timestamp
reference
reason/note where supported
```
## 45. Source
Recommended source values:
```text
SCAN
MANUAL_LOGISTICS
COURIER_ACTION
SYSTEM
```
Exact enum is Open.
## 46. Manual Actor
For manual Logistics changes, record:
```text
Logistics user/account identity
```
not merely:
```text
role = LOGISTICS
```
## 47. Immutable History
Status-history records should not be editable through normal Logistics UI.
## 48. Current State vs History
The order/parcel record owns current status.
Status history records explain how it reached that state.
# Notifications
## 49. Source Requirement
`Logistics.md` explicitly says status mutation triggers corresponding notifications to:
```text
BUYERS
SELLERS
```
## 50. Notification Event Timing
Recommended:
```text
status transition commits
→ notification event created/queued
→ Buyer/Seller notification delivery
```
Do not send a success notification before the state change commits.
## 51. Notification Failure
If the status transition succeeds but notification delivery fails:
```text
status remains committed
```
Do not roll back parcel state solely because a notification channel failed.
## 52. Delivery Channel
The source does not specify whether these operational notifications are:
```text
in-app
email
mobile Push
SMS
```
Therefore the channel is an Open Decision.
## 53. Brevo
`app.md` already uses:
```text
Brevo
```
for email.
If operational status notifications are later sent by email, AISLEY should reuse the existing Brevo email integration.
Brevo is not required merely to mutate status.
## 54. Admin Notification Management Boundary
Admin Notification Management is:
```text
Admin-created role-targeted outbound email campaigns
```
Update Status notifications are:
```text
transactional events caused by a specific order-status mutation
```
They are separate concerns.
## 55. Notification Content
A Buyer/Seller notification should identify the order safely and describe the new meaningful state.
Do not expose internal Logistics-only notes unless explicitly intended.
## 56. Recipient Rules
The exact status transitions that notify:
```text
Buyer
Seller
both
```
are not defined.
Open Decision.
# API
## 57. Lookup API
Conceptual:
```http
GET /api/logistics/orders/lookup?reference=...
```
or equivalent.
The lookup may accept:
```text
order reference
waybill reference
validated QR payload
```
## 58. Status Detail
Conceptual:
```http
GET /api/logistics/orders/{orderId}/status
```
Recommended response:
```text
current status
allowed next transitions
latest status timestamp
safe order/waybill summary
```
## 59. Manual Status Update
Conceptual:
```http
POST /api/logistics/orders/{orderId}/status
```
Example:
```json
{
  "target_status": "IN_TRANSIT",
  "reason": "manual recovery"
}
```
Exact fields and enum values depend on the authoritative state machine.
## 60. Scan Transition
Automated scanning may call the same domain service through a scanner-specific endpoint.
Conceptual:
```http
POST /api/logistics/scans
```
Exact architecture is Open.
## 61. Backend Authority
The browser must not provide authoritative:
```text
current status
actor identity
status timestamp
transition validity
notification recipients
```
The backend resolves these.
# Authorization and Security
## 62. Authentication
Every Update Status endpoint requires:
```text
authenticated LOGISTICS
```
## 63. Order Scope
The Logistics user must be authorized for the target order/parcel.
## 64. IDOR Protection
Knowing an:
```text
order ID
waybill reference
QR payload
```
does not grant access.
## 65. CSRF
State-changing Logistics web requests require configured Sanctum CSRF protection.
## 66. Input Validation
Validate:
- order/reference identifiers
- QR payload
- target status
- reason/note
- current transition context
## 67. XSS
Manual notes/reasons must be safely rendered.
## 68. PII
The Update Status screen should expose only operationally necessary Buyer/Seller/order information.
## 69. Secrets
Never expose:
```text
payment credentials
session tokens
passwords
API keys
```
# Concurrency and Idempotency
## 70. Concurrent Status Mutation
A Courier action, scan, or another Logistics user may change the state while the screen is open.
At commit:
```text
expected current state
must still match
```
or equivalent state-machine validation must pass.
## 71. Conflict
If state changed concurrently:
```text
reject stale transition
→ return current authoritative state
→ require refresh/review
```
## 72. Duplicate Request
Repeated manual submission must not create multiple identical state advances.
## 73. Duplicate Scan
Repeated scan events should be idempotent.
## 74. Atomic Mutation
Recommended:
```text
validate current state
→ create history entry
→ update current state
→ create durable notification event
→ commit
```
Exact transaction/event architecture is implementation-specific.
# Failure Handling
## 75. Invalid Transition
If transition is not allowed:
```text
reject
→ no state change
```
## 76. Stale State
If current state differs from the state shown to the user:
```text
return conflict/current status
```
## 77. Order Not Found
```text
no mutation
```
## 78. Unauthorized Order
Return forbidden/not-found according to security policy without leaking cross-Logistics information.
## 79. Scanner Failure
If scan cannot be processed:
```text
allow authorized manual recovery
```
when the order can be safely resolved.
## 80. Notification Failure
```text
status remains committed
→ notification retry/recovery
```
## 81. History Failure
Status-history persistence should be part of the durable state transition.
Do not commit a manual state mutation while silently losing its required transition history.
# Performance
## 82. Lookup
Order/waybill/reference lookup should use indexed identifiers.
## 83. Current State
Status detail should be a bounded lookup, not a broad order scan.
## 84. History
Status history should be paginated if long.
## 85. Notifications
Notification delivery should not hold the status-update HTTP request open for external delivery completion.
# UX
## 86. Recommended Screen
```text
Update Status
├── Order / Waybill Lookup
├── Parcel Summary
├── Current Status
├── Allowed Next Status
├── Reason / Note
└── Confirm Update
```
## 87. Current Status
Show the authoritative current status clearly.
## 88. Allowed Next States
Only show backend-authorized transitions.
Do not show every enum value in a generic dropdown.
## 89. Confirmation
Manual state updates are consequential.
Recommended confirmation:
```text
Order <reference>
Current: <status>
Change to: <target>
```
## 90. Manual Recovery Indicator
The UI should make it clear that this is a manual Logistics action.
## 91. Success
After successful update:
```text
show new current status
show confirmation
refresh linked Dashboard/order detail
```
## 92. Conflict State
Example:
```text
This parcel was updated by another process.
Current status is now <status>.
```
## 93. Invalid Transition
Explain that the requested transition is no longer allowed.
## 94. Accessibility
The UI should:
- present statuses as text
- not rely on color alone
- support keyboard operation
- associate validation errors with inputs
- make confirmation accessible
# Third-Party Dependencies
## 95. Core Status Mutation
Update Status itself does not require a new third-party provider.
Core implementation uses:
```text
AISLEY backend
order/shipment database
waybill/reference identifiers
state-transition service
```
## 96. Notification Delivery
A delivery service is needed only if the chosen Buyer/Seller notification channel requires one.
Current source does not select a channel here.
## 97. Existing Email Option
If Email is selected:
```text
Brevo
```
is already the AISLEY email provider.
No additional email vendor is needed.
## 98. Maps
Mapbox/Google Maps are not required merely to mutate parcel status.
They belong to routing/address-related features.
# MVP Scope
## 99. Required
- authenticated Logistics access
- exact Logistics role authorization
- authorized order/parcel lookup
- waybill/reference lookup
- current authoritative status display
- backend-defined allowed next transitions
- manual Logistics status update
- atomic mutation
- concurrency protection
- idempotent duplicate handling
- status history
- scan/manual-input recovery integration
- Buyer/Seller notification event after mutation
- CSRF
- loading/success/error/conflict states
- PII/security protections
## 100. Recommended
- explicit manual-recovery reason
- shared transition service across scanner/Courier/Logistics
- durable notification event
- notification retries
- status-history source field
- Dashboard handoff
- scanner/source idempotency key
## 101. Not Required
- arbitrary status editing
- complete global state-machine redesign
- Mapbox
- Google Maps
- Firebase
- Twilio
- mobile Push
- SMS
- new email provider
- waybill generation
- rider assignment
- proof-of-delivery bypass
- automatic rollback transitions
# Acceptance Criteria
## 102. AC-01 — Authentication
Unauthenticated users cannot access Update Status.
## 103. AC-02 — Role
Non-Logistics role-accounts cannot perform Logistics status recovery.
## 104. AC-03 — Scope
Logistics cannot update an unauthorized order/parcel.
## 105. AC-04 — Lookup
A valid authorized order can be resolved through implemented order/waybill/reference lookup.
## 106. AC-05 — Current State
The system displays the authoritative current status.
## 107. AC-06 — Allowed Transition
Only state-machine-authorized Logistics transitions may be committed.
## 108. AC-07 — Arbitrary Status Rejected
Client-supplied unsupported status values are rejected.
## 109. AC-08 — No Invalid Skip
A lifecycle stage cannot be skipped unless the backend transition policy explicitly permits it.
## 110. AC-09 — No Unauthorized Rollback
Backward transitions are rejected unless explicitly defined.
## 111. AC-10 — Concurrency
A stale Logistics update cannot overwrite a newer Courier/scan/Logistics state.
## 112. AC-11 — Duplicate Scan
Repeated processing of the same scan does not unintentionally advance multiple states.
## 113. AC-12 — Duplicate Manual Submit
Repeated identical submission does not create uncontrolled duplicate transitions.
## 114. AC-13 — History
Successful manual transition creates durable status history.
## 115. AC-14 — Actor
Manual history identifies the Logistics actor.
## 116. AC-15 — Pickup Boundary
Deploying a Courier alone does not automatically mark physical pickup.
## 117. AC-16 — Courier Boundary
Courier-specific acceptance/proof requirements are not bypassed unless the state machine explicitly authorizes Logistics recovery.
## 118. AC-17 — Notifications
Successful relevant status mutation creates the corresponding Buyer/Seller notification event.
## 119. AC-18 — Commit Before Delivery
External notification delivery is not treated as successful before the status mutation commits.
## 120. AC-19 — Notification Failure
Notification delivery failure does not roll back a successfully committed status transition.
## 121. AC-20 — CSRF
Web status mutations require configured Sanctum CSRF protection.
## 122. AC-21 — IDOR
Order ID/reference/QR knowledge does not bypass Logistics authorization.
## 123. AC-22 — No New Third Party
Core status updating works without introducing a new external provider.
# Tests
## 124. Backend Tests
Test:
- guest denied
- Buyer/Seller/Courier denied from Logistics manual-update endpoint
- authenticated Logistics allowed
- same-email other role cannot update
- authorized order lookup
- unauthorized order denied
- valid waybill/reference lookup
- invalid reference
- current status returned
- allowed transitions returned
- valid transition succeeds
- unsupported status rejected
- invalid skip rejected
- unauthorized rollback rejected
- stale concurrent state rejected
- Courier update racing Logistics update
- duplicate manual submission idempotent
- duplicate scan idempotent
- history record created
- exact actor recorded
- transition source recorded
- manual note sanitized
- status and history commit consistently
- Buyer/Seller notification event created
- notification failure does not roll back status
- CSRF enforced
- payment/security secrets absent
## 125. Frontend Tests
Test:
- Update Status page loads
- order/reference lookup
- current status display
- allowed-next-status controls
- no generic arbitrary status field
- manual recovery reason if implemented
- confirmation
- success state
- invalid reference
- unauthorized/not-found handling
- invalid transition error
- concurrent conflict
- duplicate-submit prevention
- Dashboard return/refresh
- keyboard accessibility
- status not represented by color alone
- responsive layout
# Open Decisions
## 126. Open Decisions
The current sources do not define:
1. complete order/parcel status enum
2. whether order and delivery-task status are separate fields
3. exact Logistics-allowed transitions
4. exact scan-driven transitions
5. whether Logistics may manually set `IN_TRANSIT`
6. whether Logistics may recover `ACCEPTED`
7. whether Logistics may ever set `DELIVERED`
8. proof-of-delivery enforcement
9. rollback/correction policy
10. manual reason requirement
11. predefined reason values
12. free-text note availability
13. exact QR payload format
14. exact order/reference format
15. scan endpoint architecture
16. transition idempotency-key format
17. status-history table/schema
18. status-history retention
19. exact notification-recipient matrix by transition
20. notification delivery channel
21. whether transactional notifications are in-app
22. whether email notifications use Brevo
23. whether mobile Push is later added
24. notification retry policy
25. whether notification preference settings can disable operational notices
26. exact Dashboard handoff UX
27. whether automated scan processing lives in this feature or a scanner subsystem
# Final Definition
## 127. Final Definition
AISLEY Logistics Update Status is:
```text
a controlled manual recovery utility
for advancing the physical parcel/order state
when normal scan-based automation fails.
```
Core flow:
```text
identify order / waybill
→ load authoritative current status
→ get allowed Logistics transitions
→ select next status
→ revalidate
→ commit atomically
→ write status history
→ trigger Buyer/Seller notification event
```
Critical rule:
```text
Update Status
≠ arbitrary status editor
```
It must always respect:
```text
authoritative state machine
+
Logistics authorization
+
current state
+
transition rules
```
Third-party rule:
```text
No new third-party provider
is required for core status mutation.
```
If email is later selected as a transactional notification channel:
```text
reuse existing Brevo integration
```
rather than introducing another email provider.
