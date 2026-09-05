---
role: Logistics
feature: Deploy Rider
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Logistics Web Application / Courier Dispatch
source_coverage: Logistics.md, Courier.md, app.md
---
# Deploy Rider Specification
## 1. Purpose
Deploy Rider is AISLEY's Logistics dispatch feature for selecting an appropriate Courier/Rider for a delivery task using availability, geographic proximity, and routing information.
`Logistics.md` defines:
```text
Core Value:
Select which rider to take the order
depending on the distance of buyer to rider.
```
Expanded definition:
```text
Evaluate geographical coordinates
of available couriers
against pickup/drop-off locations.

Allow Logistics to:
- manually assign tasks
- oversee automated dispatch
  based on proximity optimization
```
System context:
```text
Requires geospatial querying capabilities
(e.g., PostGIS)
to calculate distance between
live rider GPS
and order origin/destination.
```
A separate `flow.md` is required because dispatch involves candidate discovery, revalidation, assignment, concurrency, and Courier handoff.
## 2. Actors and Access
Primary actor:
```text
LOGISTICS
```
Affected actor:
```text
COURIER
```
The Logistics web application uses the existing stateful Laravel Sanctum web-authentication model from `app.md`.
Every Deploy Rider request must resolve:
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
## 3. Feature Responsibility
Deploy Rider owns:
- selecting the target dispatchable order/task
- finding eligible Couriers
- consuming Courier online/availability state
- consuming latest Courier GPS
- calculating proximity/routing
- ranking candidates
- manual dispatch
- optional automated dispatch
- backend eligibility revalidation
- preventing conflicting assignments
- creating the dispatch/assignment handoff
- exposing the task to the Courier application
Deploy Rider does not own:
- Courier registration approval
- Courier online/offline controls
- vehicle CRUD
- zone editing
- waybill generation
- parcel-status correction
- Courier navigation
- proof of delivery
- completed-delivery handling
## 4. Logistics Flow Context
From `app.md`:
```text
customer order
→ seller approved
→ seller packed
→ logistics flow
→ order delivered
```
Logistics flow:
```text
courier door to door pick up
→ transfer & dispatch flow
→ logistics assigned courier for delivery
→ rider picks up for delivery
```
Transfer/dispatch:
```text
logistics receives order
→ waybill
→ sorted
→ transfer
→ dispatch
```
Deploy Rider therefore participates after a task becomes eligible for Logistics dispatch.
The exact order/task statuses that permit deployment are not defined and remain an Open Decision.
## 5. Dispatch Geography
`Logistics.md` describes:
```text
rider live GPS
+
pickup/drop-off locations
```
The Core Value mentions distance between the Buyer and Rider, while the expanded definition refers to both pickup and drop-off points.
The implementation should therefore treat dispatch geography as:
```text
Courier current location
+
authoritative task pickup point
+
authoritative task drop-off point
```
The exact optimization target is an Open Decision.
Possible pickup origins include:
```text
Seller location
sorting center
Logistics hub
transfer point
```
depending on the shipment stage.
Deploy Rider consumes these locations from the authoritative order/shipment domain. It does not edit Buyer addresses.
## 6. Courier Eligibility
Candidate discovery begins with Couriers authorized under the current Logistics organization.
Minimum eligibility should consider:
```text
Courier belongs to / is authorized under Logistics
Courier operational account is allowed
Courier is Online / Available
Courier has usable current GPS
order/task is still dispatchable
```
`Logistics.md` separately defines Flexible Availability & Capacity Monitoring around:
```text
is_online
```
Deploy Rider should consume that availability state instead of maintaining a competing one.
Being online does not necessarily mean the Courier is eligible.
Where implemented, eligibility may additionally consider:
```text
active task capacity
Zone/Territory eligibility
vehicle/package capacity compatibility
```
Exact capacity limits remain Open.
## 7. Courier Location
The source explicitly requires:
```text
live GPS coordinates
```
Recommended location data:
```text
latitude
longitude
recorded_at
```
Rules:
- coordinates come from a trusted Courier/platform source
- invalid coordinates are rejected
- missing location is not treated as zero distance
- stale location must be identified
- the acceptable GPS age is an Open Decision
- unrestricted location history must not be exposed to Logistics users
If location is missing or too stale, the Courier should either:
```text
be excluded from proximity ranking
```
or:
```text
be shown as Location Unavailable
```
according to the chosen policy.
## 8. Geospatial Technology
`Logistics.md` mentions:
```text
PostGIS
```
as an example:
```text
e.g., PostGIS
```
Therefore:
```text
PostGIS = optional implementation technology
not a required provider
```
AISLEY may use a geospatial database extension or another suitable pre-filtering mechanism.
## 9. Mapbox Integration
`app.md` explicitly selects:
```text
Mapbox Matrix and Optimization
```
for:
```text
calculating optimal route system
for logistics and riders
```
For the current AISLEY architecture, Mapbox is the relevant external API for Deploy Rider route/proximity calculations.
Conceptually:
```text
AISLEY candidate coordinates
+
pickup/drop-off coordinates
→ Mapbox
→ route distance / duration
→ AISLEY candidate ranking
```
Mapbox does not decide:
```text
Courier eligibility
Courier ownership
Zone membership
vehicle capacity
task assignment
Courier acceptance
```
Those remain AISLEY business rules.
## 10. Ranking Rule
The source requires:
```text
proximity optimization
```
but does not define whether ranking means:
```text
straight-line distance
road distance
estimated travel time
```
Do not invent a weighted scoring system.
For example, do not introduce:
```text
70% distance
20% rating
10% acceptance rate
```
unless the project explicitly defines such rules.
The UI must label ranking according to the actual configured metric.
Examples:
```text
Nearest
Shortest Route
Shortest ETA
```
## 11. Candidate Discovery
Recommended architecture:
```text
dispatchable task
→ authorized Couriers
→ Online/Available
→ valid/recent GPS
→ optional Zone filter
→ optional Fleet/capacity filter
→ geospatial pre-filter
→ bounded candidate set
→ Mapbox Matrix/Optimization
→ ranked candidates
```
This avoids sending every Courier to the external routing API.
Candidate results should be bounded.
The exact search radius and candidate count are Open Decisions.
## 12. Candidate Information
Recommended candidate display:
```text
Courier identity
availability
distance / ETA
location freshness
assigned vehicle, if applicable
vehicle capacity result, if applicable
Zone eligibility, if applicable
active task count/capacity, if implemented
```
Do not expose unnecessary Courier PII or full GPS history.
If exclusion reasons are shown, examples may include:
```text
Offline
Location unavailable
Outside assigned zone
Vehicle capacity mismatch
At task capacity
```
Only implemented rules should produce these labels.
## 13. Vehicle Fleet Integration
`Logistics.md` explicitly states that Vehicle Fleet Management is used during Deploy Rider to:
```text
match the volumetric weight of an order
to the assigned vehicle's capacity
```
Vehicle Fleet Management owns:
- vehicle registry
- plate numbers
- maintenance information
- Courier-to-vehicle links
- vehicle capacity
Deploy Rider consumes these values.
Where the required package and vehicle data exist:
```text
package requirement
≤
vehicle capacity
```
should be considered when determining eligibility.
Behavior for missing package size, missing vehicle capacity, or maintenance states is not defined and remains Open.
## 14. Zone / Territory Integration
`Logistics.md` says Zone/Territory Mapping:
```text
filters available riders during dispatch
```
When implemented:
```text
task geography
+
Courier Zone eligibility
→ candidate filter
```
Zone/Territory Mapping owns polygon creation and territory configuration.
Deploy Rider only consumes the result.
## 15. Manual Dispatch
Manual dispatch is source-required.
Flow:
```text
Logistics opens Deploy Rider
→ reviews ranked candidates
→ selects eligible Courier
→ reviews dispatch summary
→ confirms
→ backend revalidates task and Courier
→ dispatch handoff is persisted
```
A Logistics dispatcher may select a lower-ranked Courier if that Courier is still eligible.
Whether Logistics may override hard eligibility failures is not defined.
Recommended:
```text
authorization/safety constraints
must not be manually overridden
```
## 16. Automated Dispatch
`Logistics.md` also supports:
```text
automated algorithmic dispatching
based on proximity optimization
```
Automated dispatch may:
```text
build eligible candidate set
→ apply configured proximity/routing metric
→ choose best valid candidate
→ revalidate
→ create dispatch handoff
```
Exact scoring, fallback, and whether an Admin/Logistics confirmation is required are Open Decisions.
Automated dispatch must not invent business criteria that have not been defined.
## 17. Courier Acceptance Boundary
`Courier.md` separately defines:
```text
Accept Delivery Requests
```
The Courier can:
```text
Review Pickup and Delivery Details
Accept Delivery Request
```
and the source says acceptance:
```text
changes the delivery task to ACCEPTED
and assigns the task to the courier_id
```
This creates a source ambiguity because `Logistics.md` also says Logistics can manually assign tasks.
Two possible models exist.
### Model A — Immediate Assignment
```text
Logistics confirms Courier
→ courier_id assigned immediately
→ task appears to Courier
```
### Model B — Offer Then Accept
```text
Logistics chooses Courier
→ dispatch offer/request
→ Courier reviews
→ Courier accepts
→ courier_id/final assignment confirmed
```
Recommended for consistency with `Courier.md`:
```text
Model B
```
But this is a recommendation, not a finalized source rule.
The final assignment model remains an Open Decision.
## 18. Dispatch State
The complete dispatch state machine is not defined.
Source-backed Courier state:
```text
ACCEPTED
```
If Model B is selected, a pre-acceptance state will also be required.
Recommended conceptual state:
```text
OFFERED
```
but the exact enum name is Open.
Do not define an unnecessarily large state machine inside Deploy Rider because later stages belong to:
```text
Courier Accept Delivery Requests
Courier Pick Up Order
Update Status
Deliver Order
Complete Delivery
```
## 19. Decline, Timeout, Re-Dispatch
The current sources do not define:
```text
Courier decline
offer timeout
automatic next-Courier selection
manual re-dispatch
reassignment
dispatch cancellation
```
These remain Open Decisions.
No arbitrary timeout should be invented.
## 20. Concurrency
Deploy Rider must handle two important races.
### Same Task
Two Logistics dispatchers may try to assign the same task simultaneously.
Required behavior:
```text
only one valid active assignment/offer
may win according to the chosen model
```
### Same Courier
A Courier may:
```text
go offline
reach task capacity
receive another task
```
between candidate retrieval and confirmation.
Therefore the backend must revalidate Courier eligibility when dispatch is committed.
Recommended atomic operation:
```text
check task still dispatchable
+
check Courier still eligible
+
create/update dispatch handoff
→ commit atomically
```
If stale:
```text
reject
→ refresh candidates
```
Do not silently substitute another Courier during manual dispatch.
## 21. Idempotency
Repeated submission caused by:
```text
double click
network retry
client retry
```
must not create uncontrolled duplicate dispatch records.
Use an idempotent dispatch operation or equivalent uniqueness/concurrency constraints.
## 22. Logistics Dashboard Integration
The Logistics Dashboard owns the operational queue.
Handoff:
```text
Dashboard
→ select actionable order
→ Deploy Rider
```
After dispatch:
```text
Deploy Rider
→ persist assignment/offer
→ Dashboard refreshes
→ show current assigned/pending Courier state
```
Dashboard must not implement a separate assignment algorithm.
## 23. Courier App Handoff
`Courier.md` Dashboard expects:
```text
real-time alerts for new job allocations
available pickup requests
```
Therefore a successful dispatch must make the task visible to the Courier application.
The exact delivery mechanism is not defined.
Possible internal mechanisms:
```text
polling
WebSocket
in-app task queue
```
Actual mobile Push is not required by this feature.
## 24. Update Status Boundary
Deploy Rider changes dispatch/assignment state only.
It must not claim:
```text
Courier assigned
=
parcel physically picked up
```
Physical parcel progression belongs to Courier Pick Up Order and Logistics Update Status.
## 25. Waybill Boundary
Deploy Rider may consume:
```text
order reference
waybill reference
package details
```
but does not generate or print the waybill.
Waybill remains a separate Logistics feature.
## 26. Notification Boundary
Deploy Rider does not require:
```text
Brevo
SMS provider
mobile Push provider
```
The Courier task queue/in-app dispatch handoff is sufficient for the core feature.
If actual mobile Push is added later, that is a separate delivery-channel decision.
## 27. Third-Party Summary
For Deploy Rider:
```text
Mapbox Matrix and Optimization
= selected external routing API
```
Not required as new third-party services:
```text
Brevo
Twilio
Firebase
AWS SNS
```
Implementation example only:
```text
PostGIS
```
Google Maps/Places from `app.md` may support address completion elsewhere, but Deploy Rider should preferably consume already resolved pickup/drop-off coordinates.
## 28. API
Conceptual candidate endpoint:
```http
GET /api/logistics/orders/{orderId}/rider-candidates
```
Recommended response information:
```text
order/task reference
pickup/drop-off summary
candidate Courier ID
availability
route distance
route duration
location freshness
vehicle eligibility if implemented
Zone eligibility if implemented
```
Conceptual manual dispatch endpoint:
```http
POST /api/logistics/orders/{orderId}/dispatch
```
Example request:
```json
{
  "courier_id": "courier-id"
}
```
If automated dispatch is implemented:
```http
POST /api/logistics/orders/{orderId}/auto-dispatch
```
Conceptual current dispatch endpoint:
```http
GET /api/logistics/orders/{orderId}/dispatch
```
Exact route names follow repository conventions.
## 29. Backend Authority
The frontend must not provide authoritative values for:
```text
distance
ETA
Courier availability
Courier ownership
Zone eligibility
vehicle capacity
current task capacity
assignment state
```
The backend resolves/revalidates them.
## 30. Authorization and Security
Every Deploy Rider endpoint must enforce:
```text
authenticated LOGISTICS
```
The backend must verify:
```text
Logistics may access order/task
Logistics may deploy selected Courier
order/task is dispatchable
Courier is eligible
```
Knowing:
```text
order_id
courier_id
```
must not bypass these checks.
State-changing web requests require configured Sanctum CSRF protection.
Sensitive data rules:
- expose only necessary Courier live-location information
- do not expose unrestricted GPS history
- minimize Buyer/Seller address data
- keep server-side Mapbox credentials secret
- never expose payment information
## 31. Failure Handling
### No Available Courier
```text
show No Available Riders
```
Do not fabricate or force a candidate.
### Missing/Stale GPS
```text
exclude or clearly mark according to policy
```
Never treat missing GPS as zero distance.
### Mapbox Failure
```text
do not invent route distance/ETA
do not create an accidental assignment
apply configured fallback
```
Fallback is Open.
### Courier Becomes Ineligible
```text
confirmation
→ backend revalidation fails
→ dispatch rejected
→ refresh candidates
```
### Concurrent Assignment
```text
another dispatcher wins
→ return conflict
→ show authoritative current state
```
### Fleet/Zone Failure
If implemented as hard eligibility:
```text
mismatch
→ dispatch blocked
```
## 32. Performance
Candidate discovery should be bounded.
Recommended architecture:
```text
database/geospatial eligibility pre-filter
→ small candidate set
→ Mapbox matrix request
→ ranked result
```
Avoid:
```text
load every Courier
→ call routing API individually
```
Consider indexes for:
```text
Logistics ownership
Courier availability
current location/geospatial fields
active assignment
```
Mapbox requests should respect provider matrix/request limits.
Short-lived route caching may be used if it does not create unsafe stale assignments.
## 33. UI
Recommended structure:
```text
Deploy Rider
├── Order / Task Summary
├── Pickup / Drop-Off
├── Candidate List
└── Dispatch Confirmation
```
Candidate cards may show:
```text
Courier
availability
distance / ETA
location freshness
vehicle
Zone
capacity
```
only when implemented.
Required states:
```text
loading
no available riders
routing unavailable
stale candidate
assignment conflict
dispatch success
pending Courier acceptance, if applicable
```
The interface must not rely on a map alone.
Provide textual:
```text
pickup
drop-off
distance/ETA
candidate identity
eligibility state
```
for accessibility.
## 34. Operational History
Dispatch actions should preserve enough history to answer:
```text
who dispatched
which order/task
which Courier
manual or automated
when
result
```
The current Admin System Audit Logs feature is Admin-focused, so Logistics dispatch history should not automatically be forced into that table without a broader audit design.
Do not store full Courier GPS history in the dispatch audit record.
## 35. MVP Scope
### Required
- authenticated Logistics access
- exact Logistics role authorization
- target task validation
- order/task scope authorization
- Courier scope authorization
- Online/Available filtering
- current Courier GPS consumption
- pickup/drop-off geography
- proximity/routing calculation
- Mapbox Matrix/Optimization integration
- bounded ranked candidates
- manual Courier selection
- explicit dispatch confirmation
- backend revalidation
- atomic/concurrency-safe dispatch
- idempotency
- Courier task handoff
- secure location handling
- loading/empty/error/conflict states
### Recommended
- geospatial candidate pre-filter
- Fleet capacity filtering
- Zone filtering
- active-task capacity filtering
- location freshness indicator
- route duration
- automated dispatch
- dispatch operational history
### Not Required
- PostGIS specifically
- Firebase
- Twilio
- Brevo
- SMS
- mobile Push
- vehicle CRUD
- Zone editor
- waybill generation
- parcel pickup/status update
- Courier navigation
- arbitrary weighted dispatch scoring
- surge pricing/incentives
## 36. Acceptance Criteria
- Unauthenticated/non-Logistics users cannot access Deploy Rider.
- A Logistics account cannot dispatch an unauthorized order/task.
- A Logistics account cannot deploy a Courier outside its allowed scope.
- Offline/unavailable Couriers are excluded from normal candidates.
- Missing/stale GPS is handled explicitly.
- Candidate proximity uses authoritative task geography.
- Mapbox route metrics may be used without giving Mapbox control of assignment.
- Manual Logistics dispatch is supported.
- Candidate eligibility is revalidated at commit time.
- Concurrent dispatch cannot create conflicting active assignments.
- Duplicate requests do not create uncontrolled duplicate dispatches.
- Fleet capacity is respected when that integration is enabled.
- Zone eligibility is respected when that integration is enabled.
- Deploying a Courier does not mark the parcel physically picked up.
- If Courier acceptance is required, Deploy Rider does not falsely mark the task `ACCEPTED` beforehand.
- IDOR protections apply to order and Courier IDs.
- Web mutations use CSRF protection.
- Courier location and Buyer/Seller data are minimized.
- Mapbox failure does not silently create a bad assignment.
- No Push/SMS/email provider is required for the core dispatch workflow.
## 37. Tests
### Backend
Test:
- guest denied
- Buyer/Seller/Courier denied from Logistics dispatch API
- authenticated Logistics allowed
- same-email other role cannot dispatch
- unauthorized order denied
- unauthorized Courier denied
- offline Courier excluded
- missing GPS
- stale GPS according to configured policy
- invalid coordinates
- authoritative pickup/drop-off
- Mapbox adapter integration
- bounded candidate routing request
- configured ranking
- manual selection
- eligibility revalidation
- Courier goes offline before commit
- concurrent task assignment
- duplicate/idempotent dispatch request
- Fleet mismatch when enabled
- Zone mismatch when enabled
- task-capacity limit when enabled
- Mapbox timeout/failure
- secrets absent from responses/logs
- dispatch does not mark physical pickup
- Courier task handoff created
- CSRF enforced
### Frontend
Test:
- Deploy Rider screen
- task summary
- pickup/drop-off
- loading candidates
- no-rider state
- ranked candidate cards
- distance/ETA
- location freshness if implemented
- Fleet/Zone information if implemented
- manual Courier selection
- confirmation
- stale candidate
- assignment conflict
- routing failure
- successful dispatch
- pending acceptance state if applicable
- keyboard accessibility
- usable without map-only information
- responsive layout
## 38. Open Decisions
The sources do not define:
1. exact dispatchable order/task states
2. pickup vs final-mile deployment scope
3. exact order-to-Logistics ownership schema
4. exact Courier-to-Logistics ownership schema
5. GPS update frequency
6. acceptable GPS age
7. candidate search radius
8. candidate result limit
9. distance vs travel-time ranking
10. exact Mapbox configuration
11. Mapbox failure fallback
12. geospatial database technology
13. whether PostGIS is used
14. active-task capacity rule
15. multi-order/batched Courier assignments
16. vehicle-capacity hard/soft policy
17. missing capacity behavior
18. Fleet maintenance-state effect
19. Zone eligibility hard/soft policy
20. manual override policy
21. whether automated dispatch is MVP
22. automated selection formula
23. whether automatic dispatch requires human confirmation
24. immediate Logistics assignment vs Courier acceptance
25. Courier decline behavior
26. dispatch-offer timeout
27. automatic re-dispatch
28. reassignment/cancellation
29. exact dispatch state enum
30. Courier alert delivery mechanism
31. dispatch-history storage
32. route-cache policy
## 39. Final Definition
AISLEY Deploy Rider is:
```text
a Logistics dispatch feature
that identifies eligible available Couriers,
compares live rider location
with task pickup/drop-off geography,
and allows Logistics
to select or algorithmically recommend
a Courier for the delivery task.
```
Core model:
```text
dispatchable task
+
authorized Courier
+
Online/Available
+
usable GPS
+
proximity/routing
+
optional Fleet capacity
+
optional Zone eligibility
→ dispatch candidate
```
External dependency:
```text
Mapbox Matrix and Optimization
→ route/distance optimization
```
Not mandatory:
```text
PostGIS specifically
Brevo
Twilio
Firebase
SMS
mobile Push
```
Important source boundary:
```text
Deploy Rider
→ Logistics dispatch decision/handoff

Courier Accept Delivery Request
→ Courier-side acceptance

Pick Up Order / Update Status
→ physical parcel progression
```
The exact point where the Courier assignment becomes final remains an Open Decision because the Logistics and Courier source documents describe that handoff differently.
