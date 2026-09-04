---
role: Courier/Rider
feature: Deliver Order
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Flutter Courier Mobile Application / Active Transit and Navigation
source_coverage: Courier.md, app.md
---
# Deliver Order Specification
## 1. Purpose
Deliver Order is AISLEY's Courier active-transit feature for helping a Rider transport an already picked-up parcel from its origin toward the Buyer's final destination.
`Courier.md` defines:
```text
Core Value:
Deliver order.
```
Expanded definition:
```text
The active transit phase.

It provides the Courier
with task tracking
and necessary navigational context

as they transport the parcel
to the Buyer's final destination.
```
System context:
```text
Typically requires integration
with mapping APIs
(e.g., Google Maps or Mapbox)

for routing,

and may involve
sending live GPS location tracking updates
back to the platform.
```
From the preceding Pick Up Order feature:
```text
successful pickup
→ IN_TRANSIT
```
Deliver Order therefore consumes an `IN_TRANSIT` delivery task and supports its active transit toward the destination.
A separate `flow.md` is required because the feature has a meaningful lifecycle:
```text
IN_TRANSIT
→ load delivery task
→ obtain route/navigation context
→ travel toward destination
→ update task/location context
→ hand off to Proof of Delivery / Complete Delivery
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

Laravel:
createToken()
→ personal access token

Flutter:
stores token in flutter_secure_storage

Requests:
Authorization: Bearer <token>
```
Every Deliver Order API call must resolve:
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
Therefore a same-email Buyer/Seller/Logistics account is a separate logical account.
Delivery-task access must use the exact authenticated Courier account.
# Feature Responsibility
## 5. Deliver Order Owns
Deliver Order owns:
- loading the Courier's active `IN_TRANSIT` task
- presenting destination/delivery context
- presenting current delivery-task context
- presenting route/navigation information
- integrating with the selected Rider routing system
- optionally sending live GPS location updates
- showing transit progress/context where supported
- handling route/reconnect/location errors
- providing access to active-order Chat
- providing access to Incident Reporting
- providing access to SOS where implemented
- handing off to Proof of Delivery and/or Complete Delivery
## 6. Deliver Order Does Not Own
It does not own:
- accepting the delivery request
- physical pickup confirmation
- changing the task from `ACCEPTED` to `IN_TRANSIT`
- Logistics rider assignment
- vehicle Fleet configuration
- Zone/Territory configuration
- Waybill generation
- Buyer address-book editing
- Seller pickup processing
- Proof of Delivery evidence persistence
- final `DELIVERED` mutation
- delivery-history aggregation
- earnings calculation
## 7. Core Boundary
Deliver Order means:
```text
parcel is already in Courier possession
and is being transported
toward the destination
```
It does not mean:
```text
delivery is complete
```
# Lifecycle Context
## 8. Entry State
From `Courier.md` Pick Up Order:
```text
successful pickup
→ IN_TRANSIT
```
Therefore Deliver Order begins from an active task/shipment already in transit.
## 9. Exit Boundary
`Courier.md` separately defines:
```text
Complete Delivery
→ final state change
→ DELIVERED
```
Deliver Order must not perform that final mutation by itself.
## 10. Source-Supported Lifecycle
Conceptually:
```text
ACCEPTED
→ Pick Up Order
→ IN_TRANSIT
→ Deliver Order
→ Complete Delivery
→ DELIVERED
```
## 11. No Invented Transit States
The source does not define additional states such as:
```text
EN_ROUTE
NEAR_DESTINATION
ARRIVED
DELIVERY_ATTEMPTED
```
Do not make these required lifecycle states without explicit policy.
## 12. Task vs Order Status
The current sources do not fully define whether:
```text
IN_TRANSIT
```
belongs to:
```text
delivery_task.status
shipment.status
Order.status
```
Open Decision.
Deliver Order should consume the authoritative current domain model rather than invent a parallel status field.
# Active Delivery Task
## 13. Task Ownership
The active delivery task must belong to the authenticated Courier.
## 14. Task Selection
If the Courier can have only one active task:
```text
Deliver Order
→ current task
```
is straightforward.
Whether multiple simultaneous active tasks are permitted is Open.
## 15. Active Task Summary
Recommended safe information:
```text
task/order reference
current status
pickup origin summary
delivery destination summary
package summary
assigned Courier
```
Only implemented and operationally necessary fields should be shown.
## 16. No Task Reassignment
Deliver Order does not change:
```text
courier_id
```
Reassignment belongs to dispatch/logistics policy.
# Delivery Destination
## 17. Source Requirement
The Courier transports the parcel to:
```text
the Buyer's final destination
```
## 18. Destination Authority
Destination data must come from the authoritative order/shipment delivery snapshot.
The Courier must not freely replace the destination inside Deliver Order.
## 19. Buyer Address Book Boundary
Buyer Address Book manages saved addresses.
Deliver Order consumes the delivery address captured for the current order.
It does not edit the Buyer's saved addresses.
## 20. Address Clarification
If the Courier needs clarification:
```text
Deliver Order
→ Chat / Messaging
```
The clarified information does not silently rewrite the authoritative address record unless another approved workflow performs that update.
## 21. Destination PII
Expose only the Buyer/destination information necessary to complete delivery.
Do not expose unrelated Buyer profile/payment data.
# Routing
## 22. Source Requirement
Deliver Order requires:
```text
necessary navigational context
```
and typically integrates with mapping APIs.
## 23. Existing AISLEY Routing Integration
`app.md` explicitly selects:
```text
Mapbox Matrix and Optimization
```
for:
```text
calculating optimal route system
for logistics and riders
```
Therefore Mapbox is the source-selected routing integration relevant to Deliver Order.
## 24. Courier.md Provider Examples
`Courier.md` mentions:
```text
Google Maps
or
Mapbox
```
as examples.
For current AISLEY architecture:
```text
Mapbox Matrix and Optimization
```
is already selected in `app.md`.
## 25. Route Authority
Mapbox may provide:
```text
distance
travel time
route optimization context
```
AISLEY remains authoritative for:
```text
task ownership
order state
destination data
delivery completion
```
## 26. Turn-by-Turn Navigation
The sources do not explicitly require:
```text
embedded turn-by-turn navigation
voice navigation
navigation SDK
```
Open Decision.
## 27. Route Preview
At minimum, the feature should provide enough route/navigation context for the Courier to reach the final destination.
## 28. External Navigation App
Whether AISLEY may deep-link to an external navigation app is not defined.
Open Decision.
## 29. Re-Routing
Whether the app automatically recalculates route when the Courier deviates is not explicitly defined.
Open Decision.
## 30. Multiple Stops
The source does not define multi-stop/batched delivery routing.
Open Decision.
# Live GPS Tracking
## 31. Source Capability
`Courier.md` says Deliver Order:
```text
may involve
sending live GPS location tracking updates
back to the platform.
```
Therefore live GPS tracking is supported by the source but not stated as universally mandatory.
## 32. Optionality
Core route/navigation can be specified without making continuous location upload mandatory unless the project chooses it.
## 33. GPS Purpose
If implemented, Courier location may support:
- active-delivery tracking
- Logistics operational visibility
- route context
- ETA updates
- incident/support context
Do not invent additional uses.
## 34. Location Data
Conceptual:
```text
latitude
longitude
recorded_at
accuracy
```
Exact fields are Open.
## 35. Foreground Location
If the app is actively open during delivery, foreground location updates may be used.
## 36. Background Location
The source does not define whether tracking continues when:
```text
screen is off
app is backgrounded
```
Open Decision.
## 37. Background Permission
Do not request background location permission unless AISLEY explicitly chooses a background-tracking requirement.
## 38. Tracking Frequency
The source does not define:
```text
every second
every 10 seconds
every minute
distance-based updates
```
Open Decision.
## 39. Data Freshness
If Logistics displays Courier live location, the UI should distinguish current/stale location according to configured policy.
## 40. GPS Loss
Temporary GPS failure must not automatically complete/cancel the delivery.
## 41. Location Privacy
Live location is sensitive operational data.
Access should be limited to authorized Logistics/platform services and any user-facing tracking feature explicitly defined.
## 42. Retention
Long-term Courier GPS history retention is not defined.
Open Decision.
## 43. No Unlimited Tracking
Location collection should be scoped to legitimate operational need.
The source does not justify indefinite tracking outside active delivery.
# Mobile Permissions
## 44. Location Permission
Route/location functionality may require device location permission.
## 45. Permission Handling
If permission is needed:
```text
request at relevant feature use
→ explain requirement
→ handle denial safely
```
## 46. Permission Denied
If location permission is denied:
```text
do not crash
do not claim current location
```
The exact impact on route/navigation is Open.
## 47. Camera Permission
Deliver Order itself does not require camera permission.
Camera may be required later for:
```text
Proof of Delivery
```
## 48. Storage Permission
Not required by Deliver Order source.
# Route Start
## 49. Current Location
A route commonly begins from the Courier's current position.
Whether current GPS is strictly required to open the screen is Open.
## 50. Pickup Origin
After Pick Up Order, the Courier is conceptually at the pickup origin.
This may be used as initial route context if live position is unavailable, but the source does not define fallback behavior.
## 51. Destination Coordinates
Routing requires usable destination coordinates.
If coordinates are unavailable:
```text
do not fabricate them
```
Follow configured address/geocoding fallback.
# Task Tracking
## 52. Source Requirement
Deliver Order provides:
```text
task tracking
```
## 53. Meaning
At minimum, task tracking should allow the Courier to see:
```text
which delivery is active
current transit state
destination
relevant next actions
```
## 54. Progress Visualization
The source does not define a progress percentage or ETA model.
Open Decision.
## 55. ETA
Mapbox may support estimated travel time.
Whether ETA is displayed to the Courier, Logistics, Buyer, or all is Open.
## 56. Buyer Tracking
The source does not explicitly require a Buyer-facing live Courier map.
Open Decision / separate tracking feature.
## 57. Logistics Tracking
Live GPS may be sent back to the platform, which can support Logistics visibility.
Exact Logistics UI integration is Open.
# Chat Integration
## 58. Source Chat Purpose
`Courier.md` Chat allows the Courier to contact:
```text
Buyer
Seller
Logistics
```
for:
```text
address clarifications
gate codes
immediate delivery delays
```
## 59. Deliver Order Handoff
An active delivery should be able to navigate to the order-linked Courier Chat.
## 60. Chat Does Not Mutate Delivery
A chat message such as:
```text
"I have arrived."
```
does not by itself complete the delivery.
# Incident Reporting Integration
## 61. Incident Source
Incident Reporting allows the Courier to report:
```text
vehicle breakdown
accident
inaccessible delivery address
```
## 62. Deliver Order Handoff
During active transit:
```text
Deliver Order
→ Report Incident
```
## 63. Incident Does Not Auto-Complete
Creating an incident does not automatically mark the order delivered.
## 64. SLA Behavior
`Courier.md` says Incident Reporting may pause SLAs.
Deliver Order should consume the resulting operational state if implemented rather than inventing SLA rules.
# SOS Integration
## 65. SOS Source
SOS/Emergency Button is a separate quick-access safety feature.
## 66. Deliver Order Access
Because active transit is a field-operational state, SOS should remain easily reachable if implemented.
Exact placement is a design decision.
# Proof of Delivery Handoff
## 67. e-POD Source
Proof of Delivery supports:
```text
photo
e-signature
QR verification
```
upon successful drop-off.
## 68. Deliver Order Boundary
Deliver Order may hand off when the Courier is ready to perform drop-off verification.
It does not store POD evidence itself.
## 69. POD Requirement
Whether Proof of Delivery is mandatory for every order before completion is not defined.
Open Decision.
# Complete Delivery Handoff
## 70. Finalization
`Complete Delivery` owns:
```text
finalization of the task
```
and changes the core Order to:
```text
DELIVERED
```
## 71. Deliver Order Exit
Deliver Order should route to:
```text
Proof of Delivery
and/or
Complete Delivery
```
according to the selected completion policy.
## 72. No Auto-Delivered
Reaching destination coordinates must not automatically set:
```text
DELIVERED
```
unless future explicit policy defines geofence-based completion.
# Geofencing
## 73. Source Boundary
The source does not require geofencing.
Do not make destination proximity a mandatory delivery-completion condition without explicit requirements.
## 74. Arrival Detection
Automatic arrival detection is Open.
## 75. Manual Continue
MVP may use an explicit action to continue to POD/completion once the Courier reaches the destination.
# Order Status
## 76. IN_TRANSIT During Delivery
Deliver Order operates while the parcel/task is in its active transit state.
## 77. No New State Mutation Required
The source does not require Deliver Order to create another order-state transition before Complete Delivery.
## 78. State Refresh
The screen should always read current authoritative task/order state because Logistics or another workflow may change the task.
## 79. Stale State
If the task is no longer active:
```text
stop presenting it as an active Deliver Order task
→ show authoritative current state
```
# Reassignment / Cancellation
## 80. Reassignment
Behavior if Logistics reassigns an `IN_TRANSIT` task is not defined.
Open Decision.
This is operationally sensitive and should not be invented.
## 81. Cancellation
Order/task cancellation during active transit is not defined.
Open Decision.
## 82. Courier Logout
Whether active tracking stops on logout is implementation/security policy.
Do not silently leave indefinite background tracking after logout.
# Offline Behavior
## 83. Offline Mode Boundary
`Courier.md` separately defines Offline Mode.
## 84. Cached Active Job
Offline Mode may pre-cache:
```text
active delivery information
```
which Deliver Order can display while disconnected.
## 85. Map Availability Offline
Offline map/route support is not source-required.
Open Decision.
## 86. GPS Offline
Device GPS may continue locally without network, but server location updates cannot be delivered until connectivity returns.
## 87. Location Queue
Whether live location points are queued and uploaded later is an Offline Mode decision.
## 88. Completion Offline
Completing delivery offline belongs to Offline Mode + Complete Delivery policy, not Deliver Order itself.
# API
## 89. Active Delivery Detail
Conceptual:
```http
GET /api/courier/delivery-tasks/{taskId}/delivery
```
## 90. Current Active Task
Possible:
```http
GET /api/courier/delivery-tasks/active
```
## 91. Route Context
Routing may be resolved server-side through a Mapbox adapter or returned as route-ready data.
Exact API is Open.
## 92. Location Update
If live GPS is enabled:
```http
POST /api/courier/delivery-tasks/{taskId}/location
```
Example conceptual payload:
```json
{
  "latitude": 0,
  "longitude": 0,
  "recorded_at": "..."
}
```
Exact schema is Open.
## 93. No Client Courier ID
The server derives the Courier from the Bearer token.
## 94. No State Completion Endpoint Here
The `DELIVERED` endpoint belongs to Complete Delivery.
# Backend Authority
## 95. Task Ownership
Backend verifies:
```text
task belongs to authenticated Courier
```
## 96. Task State
Backend verifies the task is in the appropriate active transit state.
## 97. Destination
Backend supplies authoritative destination/order data.
## 98. Location Input
Courier GPS coordinates are device-provided observations and must be validated as untrusted input.
## 99. Completion
Backend must not infer final delivery solely from a location update.
# Authorization and Security
## 100. Bearer Authentication
All Deliver Order endpoints require valid Courier Bearer authentication.
## 101. Exact Role
Backend verifies:
```text
role = COURIER
```
## 102. IDOR
Knowing:
```text
task_id
order_id
buyer_id
```
must not expose another Courier's delivery.
## 103. PII Minimization
Only operational delivery data should be returned.
## 104. Token Protection
Bearer token must never be:
- logged in plaintext
- returned by delivery endpoints
- embedded in map URLs
- placed in QR payloads
## 105. Map Credentials
Mapbox credentials/tokens must be configured safely according to the selected mobile/server integration.
Do not expose server-side secrets.
## 106. GPS Input Validation
Validate:
```text
latitude range
longitude range
timestamp format
accuracy if used
task ownership
```
## 107. Location Spoofing
The source does not define anti-spoofing requirements.
Open Decision.
Do not claim GPS authenticity beyond what the platform can verify.
# Realtime / Platform Updates
## 108. Location Updates
If implemented, location updates should become available to authorized platform consumers.
## 109. Frequency
Use a bounded update strategy.
Do not upload every sensor change without an explicit need.
## 110. Failed Upload
If a location update fails:
```text
delivery remains active
```
The app may retry according to connectivity policy.
## 111. No Delivery Rollback
A failed GPS update must not roll the parcel back from `IN_TRANSIT`.
# Error Handling
## 112. Task Not Found
```text
show unavailable/not found
→ no unrelated data
```
## 113. Unauthorized Task
```text
deny
```
## 114. Invalid State
If task is not `IN_TRANSIT`/active:
```text
show current authoritative state
```
## 115. Location Permission Denied
```text
show permission state
→ apply configured route fallback
```
## 116. GPS Unavailable
```text
show location unavailable
→ do not fabricate current position
```
## 117. Mapbox Failure
```text
show route unavailable/retry
```
Do not fabricate distance/ETA.
## 118. Network Failure
Cached task data may remain visible according to Offline Mode policy.
Do not claim fresh route/platform tracking while disconnected.
## 119. Destination Missing
If no usable destination exists:
```text
do not calculate a fake route
→ expose operational error
→ allow Chat/Incident paths where appropriate
```
# Performance and Battery
## 120. Mobile Constraint
Continuous GPS/navigation can consume battery and mobile data.
## 121. Location Frequency
Update frequency should balance:
```text
operational freshness
battery
network usage
privacy
```
Exact policy is Open.
## 122. Route Requests
Avoid repeated unnecessary Mapbox route calculations.
## 123. Recalculation Trigger
Exact route recalculation conditions are Open.
## 124. Payload
Active delivery payload should remain compact.
Do not load:
```text
full delivery history
full chat history
all POD media
all incidents
```
on initial Deliver Order load.
# UX
## 125. Recommended Screen
```text
Deliver Order
├── Active Task Summary
├── Destination
├── Route / Map Context
├── Delivery Details
└── Active Actions
    ├── Message
    ├── Report Incident
    ├── SOS
    └── Continue to POD / Complete Delivery
```
Only implemented actions should appear.
## 126. Map
Map/navigation should be prominent if route context is implemented.
## 127. Textual Route Context
Do not rely on the map alone.
Also provide:
```text
destination address
distance/ETA if available
```
## 128. Active Status
Clearly show:
```text
IN_TRANSIT
```
or the corresponding user-friendly active-delivery label.
## 129. Destination
Show the delivery destination prominently and safely.
## 130. Continue Action
When operationally ready:
```text
Continue to Proof of Delivery
```
or:
```text
Complete Delivery
```
depending on selected policy.
## 131. No Premature Completion
Do not place a misleading "Delivered" state merely because the route ends.
## 132. Location State
If tracking is implemented, show:
```text
location active
location unavailable
permission required
```
where useful.
## 133. Route Error
Provide retry and alternative operational actions.
## 134. Accessibility
The Flutter screen should:
- expose destination as text
- not rely on map/colors alone
- support screen-reader labels
- use large touch targets
- expose route/location errors textually
- keep safety actions accessible
# Third-Party Dependencies
## 135. Mapbox
Current `app.md` selects:
```text
Mapbox Matrix and Optimization
```
for Rider/Logistics optimal routing.
This is the relevant source-selected external API for Deliver Order.
## 136. Google Maps
`Courier.md` gives Google Maps as an example mapping API.
It is not an additional mandatory provider because `app.md` already selects Mapbox for AISLEY route optimization.
## 137. Realtime Provider
No hosted realtime provider is required for GPS updates.
AISLEY may use normal authenticated API calls or its existing realtime infrastructure.
## 138. Brevo
Not required for Deliver Order.
## 139. SMS / Push
Not required for core active transit.
## 140. External Navigation App
Not required unless later selected.
# Logging / History
## 141. Delivery Task History
Deliver Order itself does not require many state mutations, but operational events may be recorded.
Examples:
```text
delivery route opened
tracking started/stopped
location update errors
```
These are optional.
## 142. GPS History
Do not retain every location indefinitely without explicit policy.
## 143. Admin Audit Boundary
Do not automatically copy routine Courier GPS points into Admin System Audit Logs.
# MVP Scope
## 144. Required
- authenticated Courier access
- exact Courier role authorization
- active `IN_TRANSIT` task
- authoritative destination
- task tracking/context
- route/navigation context
- Mapbox routing integration consistent with `app.md`
- task ownership validation
- mobile location permission handling where current position is used
- loading/error/retry states
- Chat handoff
- Incident Reporting handoff
- Proof of Delivery / Complete Delivery handoff
- PII minimization
- Bearer-token protection
- IDOR protection
## 145. Conditionally Required
If live GPS tracking is selected for MVP:
- Courier location capture
- authenticated location-upload endpoint
- update frequency policy
- stale-location handling
- privacy/access control
- reconnect/retry behavior
## 146. Recommended
- route distance
- ETA where supported
- destination map
- foreground GPS
- clear active-transit state
- safety/SOS shortcut
- location freshness
- battery-conscious location strategy
## 147. Not Required
- new delivery status between `IN_TRANSIT` and `DELIVERED`
- geofenced auto-completion
- background GPS tracking
- Buyer-facing live map
- voice turn-by-turn navigation
- external navigation app
- multi-stop route optimization
- GPS spoof detection
- Proof of Delivery implementation inside Deliver Order
- final `DELIVERED` mutation
- Brevo
- SMS
- Push
- new mapping provider beyond selected architecture
# Acceptance Criteria
## 148. Access
- Guest/invalid token cannot load Deliver Order.
- Non-Courier token cannot access Courier active delivery.
- Same-email other-role account does not inherit Courier access.
- Courier can access only their authorized active task.
## 149. State
- Deliver Order consumes an active task already in transit.
- Loading Deliver Order does not create `IN_TRANSIT`.
- Deliver Order does not set the final Order to `DELIVERED`.
- Invalid/stale task state is shown authoritatively.
## 150. Destination
- Delivery destination comes from the authoritative order/shipment.
- Courier cannot silently replace the destination.
- Buyer PII is minimized.
## 151. Routing
- Courier receives usable navigational context.
- Mapbox may provide route/distance/travel context.
- Mapbox failure does not fabricate route or ETA.
- Mapping provider does not own delivery/task state.
## 152. GPS
If live tracking is enabled:
- app obtains required location permission
- location updates are tied to the authenticated active task
- invalid coordinates are rejected
- failed location update does not end/rollback delivery
- unauthorized users cannot access Courier location
- tracking follows configured active-delivery/privacy policy
## 153. Handoffs
- Courier can access Chat for delivery coordination.
- Courier can report an Incident.
- Courier can reach SOS if implemented.
- Courier can proceed to POD/Complete Delivery.
- Deliver Order does not store POD evidence itself.
## 154. Security
- Task IDs cannot bypass ownership.
- Bearer token is protected.
- server-side Mapbox secrets are not exposed.
- payment/security data is absent.
## 155. Third-Party
- Mapbox is the selected route-optimization integration from `app.md`.
- Google Maps is only a source example, not an additional mandatory provider.
- Brevo/SMS/Push are not required.
# Tests
## 156. Backend Tests
Test:
- missing token denied
- invalid token denied
- Buyer/Seller/Logistics token denied
- Courier token allowed
- same-email role isolation
- authorized active task
- another Courier task denied
- task not in active transit rejected/handled
- authoritative destination
- safe Buyer data
- route-context adapter
- Mapbox failure
- location endpoint authorization if implemented
- valid coordinates
- invalid coordinates
- stale timestamp policy if defined
- location update for wrong task denied
- no automatic DELIVERED mutation
- no token/payment-secret leakage
## 157. Flutter Tests
Test:
- Deliver Order screen
- active task summary
- destination
- route/map
- route distance/ETA if implemented
- location permission granted
- location permission denied
- GPS unavailable
- Mapbox route failure
- network failure
- reconnect
- Chat navigation
- Incident navigation
- SOS access if implemented
- Continue to POD / Complete Delivery
- no premature delivered state
- screen-reader labels
- destination readable without map
- touch target accessibility
# Open Decisions
## 158. Open Decisions
The current sources do not define:
1. exact status field owning `IN_TRANSIT`
2. whether multiple active delivery tasks are allowed
3. exact Deliver Order API routes
4. exact destination fields
5. whether current GPS is mandatory
6. foreground GPS update frequency
7. whether background location tracking is required
8. background permission policy
9. GPS retention duration
10. GPS accuracy threshold
11. stale-location threshold
12. GPS spoof-detection requirements
13. whether Buyer can view live Courier tracking
14. whether Logistics gets live Courier map
15. turn-by-turn navigation requirement
16. voice navigation
17. external navigation deep-linking
18. route recalculation policy
19. route deviation handling
20. ETA visibility
21. multi-stop/batched deliveries
22. offline map behavior
23. offline GPS upload queue
24. destination geofence
25. arrival detection
26. reassignment while `IN_TRANSIT`
27. cancellation while `IN_TRANSIT`
28. POD requirement before Complete Delivery
29. exact Continue action
30. location operational-history rules
# Final Definition
## 159. Final Definition
AISLEY Deliver Order is:
```text
the Courier's active transit phase
after successful parcel pickup
```
where:
```text
task = IN_TRANSIT
→ Courier receives task tracking
→ Courier receives navigation/route context
→ Courier transports parcel
to Buyer's final destination
```
Routing integration:
```text
Mapbox Matrix and Optimization
```
is the source-selected AISLEY route-optimization API for Logistics and Riders.
Optional source-supported behavior:
```text
live Courier GPS updates
→ sent back to AISLEY platform
```
Critical boundary:
```text
Deliver Order
≠ final delivery completion

Complete Delivery
→ DELIVERED
```
and:
```text
Proof of Delivery
→ evidence capture/verification
```
remains a separate feature.
