---
role: Courier/Rider
feature: Incident Reporting
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Flutter Courier Mobile Application / Delivery Exception Handling
source_coverage: Courier.md, app.md
---
# Incident Reporting Specification
## 1. Purpose
Incident Reporting is AISLEY's Courier exception-handling feature for reporting operational blockers that prevent or materially interfere with successful delivery.
`Courier.md` defines:
```text
Core Value:
Flag vehicle breakdowns,
accidents,
or inaccessible delivery addresses
to Logistics.
```
Expanded definition:
```text
An exception-handling system
for logistics failures.

It allows couriers
to log blockers
that prevent successful delivery,

effectively pausing
Service Level Agreements (SLAs)

and immediately notifying
the central dispatch team.
```
System context:
```text
Creates an Incident record
tied to the active delivery task,

which can trigger
automated re-routing logic
or alert support teams.
```
Incident Reporting therefore owns the Courier-side creation of a delivery exception record and the handoff of that exception to Logistics/dispatch/support.
A separate `flow.md` is required because the feature has a meaningful stateful sequence:
```text
active delivery
→ blocker occurs
→ Courier reports incident
→ Incident record created
→ dispatch/support notified
→ delivery handling changes according to incident policy
→ incident later resolved outside the basic Rider report step
```
## 2. Primary Actor
Primary actor:
```text
COURIER / RIDER
```
The Courier reports incidents through the Flutter mobile application.
## 3. Primary Operational Recipient
Source-backed recipient:
```text
LOGISTICS
```
Specifically:
```text
central dispatch team
```
and potentially:
```text
support teams
```
## 4. Authentication
Courier mobile authentication follows `app.md`:
```text
Flutter
→ personal access token
→ flutter_secure_storage

Requests:
Authorization: Bearer <token>
```
Every Incident Reporting request must resolve:
```text
authenticated user_id
+
COURIER role
```
## 5. Identity Rule
AISLEY uses:
```text
unique(email, role)
```
Incident ownership must be based on the exact authenticated Courier account.
A same-email Buyer/Seller/Logistics account is a separate logical role account.
# Responsibility and Boundaries
## 6. Incident Reporting Owns
Incident Reporting owns:
- reporting blockers during active delivery work
- source-backed incident categories
- creating an `Incident` record
- linking the Incident to the active delivery task
- linking the reporting Courier
- capturing incident time
- capturing incident description/details
- notifying Logistics/central dispatch
- exposing incident status to the Courier where useful
- providing data that may influence SLA handling
- providing data that may trigger rerouting/support workflows
- preventing unauthorized incident creation
- preserving incident history
## 7. Incident Reporting Does Not Own
It does not own:
- initial delivery assignment
- parcel pickup confirmation
- route optimization itself
- direct vehicle repair
- police/emergency-services dispatch
- final incident resolution by Logistics
- automatic order cancellation
- refund decisions
- payout calculation
- Proof of Delivery
- final `DELIVERED` mutation
- SOS emergency workflow
- general Chat/Messaging
## 8. Core Boundary
Incident Reporting answers:
```text
What operational blocker
is preventing this delivery
from proceeding normally?
```
It does not independently answer:
```text
How should Logistics finally resolve it?
```
# Source-Backed Incident Types
## 9. Vehicle Breakdown
Source-backed:
```text
vehicle breakdown
```
Examples are not further defined.
The source does not define:
```text
flat tire
engine failure
battery failure
fuel issue
```
as separate required types.
Open Decision.
## 10. Accident
Source-backed:
```text
accident
```
The source does not define severity levels.
Open Decision.
## 11. Inaccessible Delivery Address
Source-backed:
```text
inaccessible delivery address
```
This may cover a delivery location the Courier cannot physically access.
Exact subtypes are Open.
## 12. Additional Incident Types
The source does not enumerate additional categories.
Do not invent a large mandatory incident taxonomy.
Possible future categories remain an Open Decision.
# Active Delivery Task Link
## 13. Source Requirement
Each Incident is:
```text
tied to the active delivery task
```
## 14. Required Relationship
Conceptually:
```text
Incident
→ delivery_task_id
```
or equivalent active-shipment relation.
## 15. Courier Relationship
The Incident must preserve:
```text
courier_id
```
for the reporting Courier.
## 16. Order Relationship
If the delivery task references an Order, the Incident may be resolved to:
```text
order_id
```
through the task.
A direct `order_id` field is optional depending on schema.
## 17. No Arbitrary Task
The Courier must not create an Incident for an unrelated delivery task.
# Active-Task Eligibility
## 18. Active Delivery Requirement
The source explicitly ties Incident Reporting to:
```text
the active delivery task
```
## 19. Relevant Lifecycle
Likely incident-eligible states include active phases such as:
```text
ACCEPTED
IN_TRANSIT
```
depending on final delivery-task state machine.
The exact eligible states are Open.
## 20. Completed Delivery
A task already:
```text
COMPLETED
```
or associated Order already:
```text
DELIVERED
```
should generally not accept a new normal delivery Incident through this workflow.
Post-delivery dispute/reporting is a separate concern.
# Incident Record
## 21. Source Entity
The source explicitly names:
```text
Incident
```
## 22. Recommended Fields
Conceptually:
```text
id
delivery_task_id
courier_id
type
description
reported_at
status
created_at
updated_at
```
Exact schema is Open.
## 23. Description
Courier should be able to provide enough detail for Logistics to understand the blocker.
## 24. Description Requirement
Whether free-text description is mandatory for every category is Open.
Recommended:
```text
require concise incident description
```
for operational usefulness.
## 25. Timestamp
Use an authoritative server timestamp for:
```text
reported_at
```
## 26. Client Timestamp
Device timestamp may be useful as metadata but should not be authoritative.
# Incident Status
## 27. Source Boundary
`Courier.md` does not define an Incident status enum.
## 28. Recommended Minimal States
Possible:
```text
OPEN
ACKNOWLEDGED
RESOLVED
```
These are recommendations only.
## 29. Resolution Ownership
The Courier reports the Incident.
Logistics/support should generally own:
```text
acknowledgement
resolution
reroute decision
```
Exact ownership is Open.
## 30. Courier Self-Resolution
Whether the Courier may mark an Incident resolved is not defined.
Open Decision.
# SLA Handling
## 31. Source Requirement
The Expanded Definition says Incident Reporting:
```text
effectively pauses
Service Level Agreements (SLAs)
```
## 32. Interpretation
An active Incident may affect SLA measurement so the Courier is not treated as operating normally while a documented blocker exists.
## 33. Exact SLA Rule
The source does not define:
```text
which SLA timer
when pause begins
when pause ends
whether all incidents pause
whether approval is required
```
Open Decision.
## 34. No Invented Timer Math
Do not invent:
```text
SLA + 30 minutes
automatic grace period
specific penalty removal
```
without requirements.
## 35. Recommended SLA Event
Recommended architecture:
```text
Incident created
→ SLA subsystem receives exception event
→ applies configured pause/exception policy
```
Incident Reporting should not independently implement all SLA calculations.
# Immediate Dispatch Notification
## 36. Source Requirement
Incident creation should:
```text
immediately notify
the central dispatch team
```
## 37. Notification Target
Primary target:
```text
Logistics / central dispatch
```
## 38. Notification Event
Recommended:
```text
Incident created
→ durable dispatch notification event
```
## 39. Notification Content
Recommended safe operational payload:
```text
incident_id
delivery_task_id
courier identity/reference
incident type
reported_at
short description
```
## 40. Notification Channel
The source does not define:
```text
WebSocket
Push
email
SMS
webhook
```
for Incident Reporting.
Open Decision.
## 41. Internal Realtime
AISLEY may use its existing backend/realtime mechanisms to surface Incidents to the Logistics dashboard.
No new hosted provider is required.
## 42. Notification Failure
If Incident creation commits but immediate realtime notification fails:
```text
Incident must remain stored
→ Logistics can retrieve it
→ notification retry may occur
```
Do not discard the Incident.
# Automated Rerouting
## 43. Source Capability
`Courier.md` says an Incident:
```text
can trigger
automated re-routing logic
```
## 44. Optionality
Automated rerouting is source-supported but not universally required.
## 45. Rerouting Trigger
Exact incident types that trigger rerouting are not defined.
Open Decision.
## 46. Rerouting Owner
Route optimization belongs to Logistics/routing systems.
Incident Reporting provides the exception signal.
## 47. Mapbox
`app.md` selects:
```text
Mapbox Matrix and Optimization
```
for Logistics/Rider optimal routing.
If automated rerouting is implemented, the routing subsystem may use the existing Mapbox integration.
## 48. No Direct Mapbox Requirement
Incident creation itself does not need to call Mapbox.
## 49. Reassignment
Whether an Incident causes:
```text
new Courier assignment
```
is not defined.
Open Decision.
# Support-Team Alerts
## 50. Source Capability
An Incident can:
```text
alert support teams
```
## 51. Support Recipient
Exact support roles/queues are not defined.
Open Decision.
## 52. Logistics First
The strongest source requirement remains:
```text
immediately notify central dispatch
```
## 53. Escalation
Additional support escalation may depend on:
```text
incident type
severity
duration
```
but these rules are not defined.
# Severity
## 54. Source Boundary
No severity enum is defined.
## 55. Recommended Future Model
Possible:
```text
LOW
MEDIUM
HIGH
CRITICAL
```
but do not require this for MVP unless selected.
## 56. Accident Severity
Accident reporting may need high-priority treatment, but exact severity mapping is Open.
# Location Context
## 57. Source Boundary
Incident Reporting does not explicitly require GPS coordinates.
## 58. Existing Rider Context
Deliver Order may have current or last known location.
Incident Reporting may optionally attach:
```text
current / last known GPS
```
if available.
## 59. GPS Requirement
Do not make GPS mandatory unless project policy requires it.
## 60. Location Failure
If GPS is unavailable:
```text
Incident report may still be created
```
unless future policy says otherwise.
# Attachments / Evidence
## 61. Source Boundary
`Courier.md` Incident Reporting does not explicitly require:
```text
photos
videos
documents
```
## 62. MVP
Text/category reporting is sufficient from the source.
## 63. Future Evidence
Incident media may be useful later, but this is an Open Decision.
## 64. e-POD Boundary
Delivery evidence belongs to Proof of Delivery.
Incident evidence, if added, is distinct.
# Chat Integration
## 65. Operational Communication
After reporting an Incident:
```text
Courier ↔ Logistics Chat
```
may be used for follow-up coordination.
## 66. Chat Is Not Incident
A message such as:
```text
"My vehicle broke down"
```
does not automatically create an Incident record.
## 67. Incident Shortcut
Chat may provide:
```text
Report Incident
```
handoff where useful.
# SOS Boundary
## 68. Accident vs Emergency
Incident Reporting can record:
```text
accident
```
but SOS/Emergency Button is a separate high-priority safety feature.
## 69. Emergency Escalation
For immediate personal safety threats:
```text
SOS
```
should remain available.
## 70. No SOS Replacement
Do not require the Courier to complete a detailed Incident form before sending SOS.
## 71. Linked Records
Whether SOS later creates/links an Incident automatically is Open.
# Delivery-State Boundary
## 72. Incident Does Not Complete Delivery
Never:
```text
Incident created
→ DELIVERED
```
## 73. Incident Does Not Automatically Cancel
The source does not say:
```text
Incident
→ CANCELLED
```
Do not invent automatic cancellation.
## 74. Incident Does Not Roll Back Pickup
Do not automatically change:
```text
IN_TRANSIT → ACCEPTED
```
because an Incident was created.
## 75. Operational State
The active delivery remains subject to Logistics resolution/rerouting policy.
# Complete Delivery Boundary
## 76. Open Incident
Whether an unresolved Incident blocks:
```text
Complete Delivery
```
is not defined.
Open Decision.
## 77. Successful Delivery After Incident
A Courier may potentially resolve the blocker and continue delivery.
The source does not prohibit this.
## 78. History
Completed delivery history may retain a reference that an Incident occurred.
Exact display is Open.
# API
## 79. Create Incident
Conceptual:
```http
POST /api/courier/delivery-tasks/{taskId}/incidents
```
Possible body:
```json
{
  "type": "VEHICLE_BREAKDOWN",
  "description": "..."
}
```
Exact enum/body is Open.
## 80. List Active Task Incidents
Conceptual:
```http
GET /api/courier/delivery-tasks/{taskId}/incidents
```
## 81. Incident Detail
Conceptual:
```http
GET /api/courier/incidents/{incidentId}
```
## 82. Courier Update
Whether Courier may edit:
```text
description
status
```
after submission is not defined.
Open Decision.
## 83. Logistics Resolution APIs
Belong to Logistics-side feature(s), not this Courier spec.
# Backend Authority
## 84. Courier Identity
Backend derives Courier from Bearer token.
## 85. Delivery Task
Backend validates the active task belongs to that Courier.
## 86. Incident Type
Backend validates the selected type against the configured incident taxonomy.
## 87. Status
Client cannot self-assign privileged states such as:
```text
RESOLVED
APPROVED
DISMISSED
```
unless policy explicitly permits it.
## 88. SLA Effect
Backend/domain services determine SLA pause/exception behavior.
# Authorization and Security
## 89. Bearer Authentication
All Courier Incident endpoints require valid authentication.
## 90. Exact Role
Backend verifies:
```text
role = COURIER
```
## 91. Own Task
Courier may report an Incident only for an authorized active task.
## 92. IDOR
Knowing:
```text
task_id
incident_id
order_id
```
must not expose or modify another Courier's Incident.
## 93. Logistics Access
Authorized Logistics personnel should be able to receive/view Incidents for their organization.
Exact permission model belongs to Logistics.
## 94. Sensitive Details
Incident descriptions may contain:
```text
location
accident details
access issues
```
Protect them as operational data.
# Data Integrity
## 95. Stable Link
Incident must remain tied to the correct:
```text
delivery task
Courier
```
## 96. Server Timestamp
Store authoritative:
```text
reported_at
```
## 97. Duplicate Reports
Repeated taps/network retries should not create uncontrolled duplicate Incidents.
## 98. Idempotency
A client request ID/idempotency key is recommended.
## 99. Same Event Repeated
Whether Courier may deliberately report multiple Incidents for one task is allowed by the source but exact rules are Open.
# Error Handling
## 100. Unauthorized Task
```text
deny
→ no Incident
```
## 101. Inactive Task
If task is no longer incident-eligible:
```text
reject
→ show authoritative state
```
## 102. Invalid Type
```text
reject
→ no Incident
```
## 103. Missing Required Description
If description is configured as required:
```text
validation error
```
## 104. Network Failure
Do not claim Incident submitted until server confirms it.
## 105. Notification Failure
```text
Incident stored
→ dispatch notification fails
→ retain Incident
→ retry/allow Logistics retrieval
```
## 106. Duplicate Submission
Return existing logical Incident or safely deduplicate where idempotency is implemented.
# Offline Mode
## 107. Source Context
`Courier.md` separately defines Offline Mode with local task state and synchronization queues.
## 108. Offline Incident Submission
Incident Reporting does not explicitly define offline support.
Open Decision.
## 109. Recommended MVP
Before Offline Mode integration:
```text
Incident submission requires connectivity
```
## 110. Future Offline Model
If later integrated:
```text
Courier creates local Incident
→ pending sync
→ reconnect
→ backend validates active task
→ Incident created or conflict returned
```
## 111. Urgency Caveat
Because Incidents are meant to:
```text
immediately notify central dispatch
```
an offline queued Incident cannot satisfy the "immediate" server-notification requirement until connectivity returns.
The UI must communicate this clearly.
# UX
## 112. Entry Points
Incident Reporting should be accessible from active delivery screens such as:
```text
Pick Up Order
Deliver Order
```
where relevant.
## 113. Recommended Form
```text
Report Incident
├── Incident Type
├── Description
├── Optional contextual data
└── Submit
```
## 114. Source-Backed Type Choices
At minimum:
```text
Vehicle Breakdown
Accident
Inaccessible Delivery Address
```
## 115. Confirmation
After successful server creation:
```text
Incident reported.
Logistics has been notified.
```
Only show that Logistics was notified when the system has at least durably queued/created the dispatch notification event.
## 116. Pending Dispatch Alert
If Incident is stored but realtime alert delivery is delayed:
```text
Incident reported.
Dispatch notification pending/retrying.
```
if the UI exposes that distinction.
## 117. Duplicate Tap
Disable repeated submit while request is in progress.
## 118. Incident Status
If exposed, show:
```text
Open
Acknowledged
Resolved
```
or configured statuses textually.
Exact statuses are Open.
## 119. Accessibility
The Flutter UI should:
- provide clear labels
- use large touch targets
- expose incident status textually
- not rely on color alone
- announce submission success/failure
- keep SOS separately accessible
# Notifications / Dispatch UI
## 120. Dispatch Alert
Incident creation should surface prominently in Logistics operations.
## 121. Recommended Alert Content
```text
Courier
Delivery reference
Incident type
Reported time
Short description
```
## 122. Active Task Link
Dispatch should be able to open the related active task.
## 123. Alert Priority
Exact priority/severity mapping is Open.
## 124. Realtime Transport
Could use:
```text
WebSocket
SSE
polling
internal queue/event
```
No hosted provider is source-required.
# Rerouting Integration
## 125. Trigger Event
Recommended:
```text
Incident created
→ routing/dispatch subsystem receives Incident event
```
## 126. Automated Reroute
Only if configured:
```text
eligible Incident
→ automated rerouting logic
```
## 127. Manual Dispatch
Otherwise:
```text
Incident
→ Logistics dispatch reviews
→ manually reroutes/reassigns/supports
```
## 128. Mapbox Boundary
Mapbox may calculate alternative route solutions.
AISLEY decides:
```text
whether reroute is needed
which Courier/task changes
whether reassignment occurs
```
# Audit / History
## 129. Incident History
Preserve enough information to answer:
```text
what happened
which delivery
which Courier
when reported
what status followed
```
## 130. Status Changes
If status changes exist, preserve transition history where practical.
## 131. Resolution Notes
Whether Logistics adds resolution notes is Open.
## 132. Admin Audit Boundary
Do not automatically duplicate every Incident into Admin System Audit Logs unless audit architecture becomes cross-role.
# Performance
## 133. Create Path
Incident creation should be a short transactional path.
## 134. External Work
Do not block Incident creation waiting for:
```text
Mapbox reroute
email
complex support automation
```
## 135. Notification Event
Persist/durably queue the dispatch notification quickly after Incident creation.
## 136. Active Incident Query
Index by:
```text
delivery_task_id
courier_id
status
reported_at
```
as appropriate.
# Third-Party Dependencies
## 137. Core Incident Reporting
No new third-party provider is required.
Core uses:
```text
AISLEY backend
Incident record
delivery-task relationship
internal dispatch notification/realtime
```
## 138. Mapbox
Mapbox may be reused if an Incident triggers automated rerouting.
It is not required for Incident creation itself.
## 139. Brevo
Email is not source-required for Incident Reporting.
## 140. SMS / Push
No specific SMS/Push provider is required.
## 141. Emergency Services
Incident Reporting does not require direct local-authority integration.
That concern is closer to SOS, whose own source still prioritizes internal alerting.
# MVP Scope
## 142. Required
- authenticated Courier access
- exact Courier role authorization
- active delivery-task validation
- Incident record
- task/Courier linkage
- source-backed incident types:
  - vehicle breakdown
  - accident
  - inaccessible delivery address
- incident description/details
- server timestamp
- immediate Logistics/central-dispatch notification event
- read-back/status view where useful
- idempotent/duplicate-safe submission
- no automatic delivery completion/cancellation
- security/IDOR protection
- loading/success/error states
## 143. Recommended
- minimal Incident status model
- operational history
- SLA exception event
- internal realtime dispatch alert
- optional current/last-known location
- Chat handoff
- SOS shortcut
- rerouting integration hook
- Mapbox reuse only when rerouting is enabled
- Logistics acknowledgement/resolution workflow as a separate counterpart feature
## 144. Not Required
- large incident taxonomy
- mandatory severity levels
- photo/video evidence
- automatic order cancellation
- automatic Courier reassignment
- automatic reroute for every Incident
- exact SLA timer formula
- direct police/emergency-services integration
- email
- SMS
- hosted Push provider
- new third-party provider
# Acceptance Criteria
## 145. Access
- Missing/invalid token cannot create an Incident.
- Non-Courier token cannot use Courier Incident endpoints.
- Same-email other-role account does not inherit Courier access.
- Courier may report only against an authorized active task.
## 146. Incident Creation
- Vehicle Breakdown can be reported.
- Accident can be reported.
- Inaccessible Delivery Address can be reported.
- Incident is tied to the active delivery task.
- Incident records the reporting Courier.
- Incident records an authoritative reported time.
- Invalid/unrelated task is rejected.
## 147. Dispatch Notification
- Successful Incident creation creates/durably queues a dispatch notification.
- Logistics can identify the affected delivery.
- Notification failure does not delete the Incident.
- Retry/retrieval allows dispatch to eventually observe the Incident.
## 148. SLA
- Incident provides an event/state that can support SLA pause/exception handling.
- No unsupported fixed pause duration is hardcoded.
- Exact SLA resume rules remain configurable/Open.
## 149. Rerouting
- Incident can be consumed by routing/dispatch logic.
- Automated rerouting is optional/configurable.
- Incident creation does not require Mapbox.
- Mapbox does not own the Incident or delivery state.
## 150. Delivery State
- Incident creation does not set Order `DELIVERED`.
- Incident creation does not automatically cancel the Order.
- Incident creation does not roll back `IN_TRANSIT`.
- Completion behavior with an open Incident follows explicit future policy.
## 151. Security
- Task/Incident IDs cannot bypass authorization.
- Sensitive descriptions are restricted to authorized actors.
- Bearer token is protected.
- Client cannot self-resolve/approve an Incident unless policy permits.
## 152. Third-Party
- Core Incident Reporting works without a new third-party provider.
- Mapbox is only relevant to optional rerouting.
- Brevo/SMS/Push providers are not required.
# Tests
## 153. Backend Tests
Test:
- missing token denied
- invalid token denied
- Buyer/Seller/Logistics token denied
- authenticated Courier allowed
- same-email role isolation
- own active task
- another Courier task denied
- inactive/completed task rejected according to policy
- vehicle-breakdown Incident
- accident Incident
- inaccessible-address Incident
- invalid type rejected
- required description validation if configured
- Courier/task linkage
- reported_at
- duplicate/idempotent submission
- dispatch notification event created
- dispatch notification failure does not remove Incident
- SLA event/hook
- reroute hook if enabled
- no automatic DELIVERED
- no automatic cancellation
- no automatic state rollback
- no bearer-token leakage
## 154. Flutter Tests
Test:
- Report Incident entry point
- incident-type selector
- Vehicle Breakdown
- Accident
- Inaccessible Delivery Address
- description input
- submit
- duplicate-submit disabled
- success state
- failure/retry
- offline/no-network behavior
- Incident status if exposed
- Chat handoff
- SOS remains separately accessible
- screen-reader labels
- touch-target sizing
- status not color-only
# Open Decisions
## 155. Open Decisions
The current sources do not define:
1. complete incident taxonomy
2. incident type enum names
3. whether free-text description is mandatory
4. severity levels
5. which task states may report Incidents
6. whether multiple open Incidents are allowed per task
7. Incident status enum
8. who may acknowledge
9. who may resolve
10. whether Courier may resolve
11. exact SLA paused timer
12. which Incident types pause SLA
13. SLA resume conditions
14. whether Logistics approval is needed before SLA pause
15. exact dispatch notification channel
16. notification priority
17. support-team recipients
18. current/last-known GPS inclusion
19. photo/video attachment support
20. automated rerouting rules
21. which types trigger reroute
22. reassignment behavior
23. cancellation behavior
24. whether open Incident blocks Complete Delivery
25. resolution notes
26. offline Incident queueing
27. relationship with SOS
28. incident retention
29. exact API routes
# Final Definition
## 156. Final Definition
AISLEY Incident Reporting is:
```text
the Courier-side
delivery exception reporting workflow
```
for source-backed blockers:
```text
vehicle breakdown
accident
inaccessible delivery address
```
Core source-backed flow:
```text
active delivery task
→ Courier reports blocker
→ Incident record created
→ tied to active delivery task
→ central dispatch notified immediately
→ SLA exception/pause handling
→ optional rerouting or support alert
```
Critical boundary:
```text
Incident Reporting
= record + notify + exception signal

Logistics / support
= resolution and rerouting decisions
```
and:
```text
Incident
≠ automatic cancellation
≠ automatic DELIVERED
≠ automatic reassignment
```
Third-party rule:
```text
No new third-party provider
is required for core Incident Reporting.
```
