---
role: Logistics
feature: Vehicle Fleet Management
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Logistics Web Application / Vehicle Registry and Dispatch Capacity
source_coverage: Logistics.md, app.md
---
# Vehicle Fleet Management Specification
## 1. Purpose
Vehicle Fleet Management is AISLEY's Logistics asset-management feature for maintaining the delivery vehicles used by Couriers.
`Logistics.md` defines:
```text
Core Value:
Maintain a digital registry
of assigned delivery vehicles,
including:
- plate numbers
- maintenance schedules
- specific Couriers assigned to them
```
Expanded definition:
```text
An asset tracking database.

It ensures that vehicles utilized
on the platform meet
regulatory and safety standards,

linking specific vehicle capacities
(e.g., motorcycle vs. van)

to Couriers

so they are assigned
appropriately sized orders.
```
System context:
```text
Requires a Vehicles schema
linked to Couriers.

Used as a filter
during Deploy Rider

to match
the volumetric weight of an order
to the assigned vehicle's capacity.
```
A separate `flow.md` is included because vehicle lifecycle, Courier assignment, maintenance status, and Deploy Rider eligibility have meaningful sequence/state behavior.
## 2. Primary Actor
Primary actor:
```text
LOGISTICS
```
The Logistics user manages the vehicle registry from the Logistics web application.
## 3. Related Actor
Operationally related actor:
```text
COURIER
```
Couriers may be linked to vehicles for dispatch eligibility.
## 4. Authentication
The Logistics web application uses the existing Laravel Sanctum stateful web authentication model.
Every Fleet Management request must resolve:
```text
authenticated user_id
+
LOGISTICS role
```
AISLEY identity remains:
```text
unique(email, role)
```
A same-email account under another role does not gain Logistics Fleet access.
# Feature Responsibility
## 5. Fleet Management Owns
Vehicle Fleet Management owns:
- vehicle registry
- vehicle identity
- plate number
- vehicle type/classification where implemented
- capacity information
- maintenance schedule information
- vehicle operational availability/status
- Courier-to-vehicle relationship
- Fleet search/filtering
- Fleet history where required
- exposing vehicle-capacity eligibility to Deploy Rider
- preventing unauthorized cross-Logistics vehicle access
## 6. Fleet Management Does Not Own
It does not own:
- Courier account approval
- Courier online/offline availability
- Deploy Rider selection
- Zone/Territory definitions
- order volumetric-weight calculation
- parcel status updates
- routing
- waybill generation
- vehicle navigation
- external government registration systems
- insurance claims
- fuel tracking
- vehicle purchase/accounting
unless later specified.
# Vehicle Registry
## 7. Vehicle Entity
The source explicitly requires:
```text
Vehicles schema
```
linked to:
```text
Couriers
```
## 8. Vehicle Identifier
Each vehicle must have a stable internal identifier.
Recommended:
```text
vehicle_id
```
## 9. Plate Number
The source explicitly requires:
```text
plate numbers
```
Therefore each vehicle should store a plate/registration identifier as supported by project policy.
## 10. Plate Validation
Exact plate-number format is not defined.
Do not hardcode a jurisdiction-specific format unless the project defines it.
## 11. Plate Uniqueness
Whether plate numbers must be globally unique or unique per Logistics organization is not defined.
Open Decision.
## 12. Vehicle Type
The source provides examples:
```text
motorcycle
van
```
These demonstrate different vehicle capacities.
They are examples, not necessarily the complete allowed vehicle-type enum.
## 13. Vehicle Type Configuration
Do not invent a fixed list such as:
```text
MOTORCYCLE
SEDAN
SUV
VAN
TRUCK
```
unless the project defines it.
Vehicle type/classification remains configurable/Open.
## 14. Vehicle Capacity
The source explicitly requires:
```text
vehicle capacities
```
because Deploy Rider uses capacity to match appropriately sized orders.
## 15. Capacity Meaning
The source mentions matching:
```text
volumetric weight of an order
```
to:
```text
vehicle capacity
```
However, it does not define whether vehicle capacity is represented as:
```text
maximum volumetric weight
maximum physical weight
volume
package count
dimensions
vehicle class
```
Open Decision.
## 16. Capacity Unit
The exact unit is not defined.
Do not invent:
```text
kg
m³
liters
package count
```
as the authoritative unit without project policy.
## 17. Capacity Validation
Capacity values must:
- use the configured unit
- be non-negative
- satisfy field limits
- be backend validated
# Logistics Ownership
## 18. Vehicle Ownership Scope
A vehicle should belong to the Logistics organization/account that registered/manages it.
Conceptually:
```text
logistics_id
→ vehicles
```
Exact schema is Open.
## 19. Cross-Logistics Isolation
A Logistics organization must not:
- view another Logistics organization's Fleet
- update another Fleet
- assign another organization's vehicle
- use another organization's vehicle during Deploy Rider
unless cross-organization Fleet sharing is explicitly added later.
## 20. IDOR Protection
Knowing a:
```text
vehicle_id
```
must not bypass Logistics ownership checks.
# Courier Assignment
## 21. Source Requirement
The source explicitly requires tracking:
```text
specific Couriers assigned to vehicles
```
## 22. Relationship
Vehicle Fleet Management must maintain a relationship between:
```text
Vehicle
↔
Courier
```
## 23. Relationship Cardinality
The source does not define whether:
```text
one Courier → one current vehicle
one Courier → multiple vehicles
one Vehicle → one Courier
one Vehicle → multiple Couriers over time
```
Open Decision.
## 24. Recommended Current Assignment
For dispatch clarity, a current assignment relationship should be explicit.
Conceptually:
```text
vehicle_id
courier_id
assigned_at
unassigned_at
```
or equivalent.
This is a recommendation.
## 25. Assignment History
Preserving historical vehicle-to-Courier assignments is recommended for operational traceability.
Do not overwrite all history with only the latest Courier ID if historical attribution is important.
## 26. Courier Scope
Only Couriers authorized under the current Logistics organization may be assigned its vehicles.
## 27. Courier Approval Boundary
Courier approval belongs to the Logistics Courier-registration workflow.
Fleet Management must not approve/reject Courier accounts.
## 28. Courier Availability Boundary
Courier:
```text
Online / Available
```
state belongs to Flexible Availability & Capacity Monitoring.
Vehicle assignment does not automatically make the Courier online.
## 29. Vehicle Assignment Is Not Dispatch
Assigning a vehicle to a Courier does not assign an order.
Deploy Rider owns order/task dispatch.
# Maintenance
## 30. Source Requirement
The source explicitly requires:
```text
maintenance schedules
```
## 31. Maintenance Schedule
Each vehicle should support maintenance planning information.
Possible conceptual fields:
```text
next_maintenance_at
maintenance_note
maintenance_status
```
Exact schema is Open.
## 32. Maintenance Frequency
The source does not define:
```text
weekly
monthly
every N kilometers
every N months
```
Do not invent a fixed schedule.
## 33. Maintenance Records
Recommended distinction:
```text
maintenance schedule
≠
maintenance history
```
A schedule says when maintenance is planned.
History records what actually occurred.
Maintenance history is recommended, not explicitly required.
## 34. Maintenance State
The source requires maintenance schedules and safety compliance, but does not define vehicle states.
Recommended conceptual states:
```text
ACTIVE
MAINTENANCE
INACTIVE
```
These are recommendations only.
## 35. Dispatch During Maintenance
Recommended:
```text
vehicle in MAINTENANCE
→ not eligible for Deploy Rider capacity matching
```
because the source says Fleet Management helps ensure regulatory/safety standards.
However, the exact hard-block policy is not explicitly defined.
Open Decision.
## 36. Overdue Maintenance
Whether overdue maintenance automatically blocks dispatch is not defined.
Open Decision.
## 37. Maintenance Completion
If maintenance states are implemented:
```text
MAINTENANCE
→ maintenance completed
→ ACTIVE
```
only after authorized Logistics confirmation.
# Safety and Regulatory Standards
## 38. Source Requirement
The source says Fleet Management:
```text
ensures that all vehicles utilized
on the platform meet
regulatory and safety standards
```
## 39. Undefined Standards
The source does not define:
- jurisdiction
- inspection authority
- insurance requirement
- registration document requirement
- emissions requirement
- license type
- vehicle-age restriction
- safety checklist
- document expiry period
Do not invent these requirements.
## 40. Compliance Data
If the project later defines required vehicle documents/checks, Fleet Management may store their status.
Until then:
```text
regulatory/safety fields = Open Decision
```
## 41. No External Government API Requirement
The source does not require integration with:
```text
LTO
government vehicle registry
insurance provider
inspection API
```
or another external regulatory service.
# Deploy Rider Integration
## 42. Core Integration
`Logistics.md` explicitly states Fleet Management is:
```text
used as a filter
during Deploy Rider
```
## 43. Capacity Matching
Conceptually:
```text
order volumetric requirement
≤
assigned vehicle capacity
→ capacity eligible
```
## 44. Vehicle Assignment Requirement
If Deploy Rider depends on the Courier's assigned vehicle:
```text
Courier without eligible assigned vehicle
```
may need to be excluded or flagged.
Exact behavior is Open.
## 45. Missing Order Weight
If order volumetric weight is missing:
```text
capacity matching cannot be safely completed
```
Behavior is Open.
Do not invent a zero weight.
## 46. Missing Vehicle Capacity
If vehicle capacity is missing:
```text
do not assume unlimited capacity
```
Recommended:
```text
mark capacity unknown
```
and apply configured dispatch policy.
## 47. Capacity Eligibility API
Fleet Management should expose a backend-readable vehicle/capacity relationship to Deploy Rider.
Deploy Rider should not maintain a duplicate Fleet-capacity database.
## 48. Shared Authority
Recommended:
```text
Fleet Management
= vehicle/capacity authority

Deploy Rider
= dispatch-decision authority
```
## 49. Vehicle Type Example
Example only:
```text
small package
→ motorcycle may be eligible

larger volumetric order
→ van may be required
```
The actual threshold/rules must come from configured capacity data, not hardcoded assumptions.
# Flexible Availability & Capacity Monitoring Boundary
## 50. Fleet Capacity vs Network Capacity
Vehicle Fleet Management owns:
```text
vehicle capacity
```
Flexible Availability & Capacity Monitoring owns:
```text
online Courier capacity
network demand vs available riders
```
These are different concepts.
## 51. No Duplicate Availability Flag
Fleet Management should not create another Courier:
```text
is_online
```
field.
It may consume Courier availability when needed.
# Zone Boundary
## 52. Zone/Territory Mapping
Zone/Territory Mapping owns:
```text
delivery polygons
Courier territory eligibility
```
Fleet Management does not edit geographic zones.
## 53. Deploy Rider Combined Filters
Deploy Rider may combine:
```text
Courier availability
+
Zone eligibility
+
vehicle capacity
+
proximity
```
Fleet Management supplies only the vehicle/capacity portion.
# Vehicle Lifecycle
## 54. Create Vehicle
Authorized Logistics may register a vehicle with required Fleet fields.
## 55. Read Vehicle
Authorized Logistics may view Fleet details within its scope.
## 56. Update Vehicle
Authorized Logistics may update allowed fields such as:
```text
plate number
vehicle classification
capacity
maintenance information
```
where supported.
## 57. Delete Vehicle
The source describes maintaining a registry but does not define destructive deletion.
Recommended:
```text
deactivate / archive vehicle
```
rather than hard-delete a vehicle referenced by historical deliveries.
## 58. Historical References
Vehicle records may be referenced by:
- Courier assignment history
- dispatch history
- delivery history
- maintenance records
Therefore hard deletion may break historical traceability.
## 59. Deactivation
Recommended:
```text
ACTIVE
→ INACTIVE
```
for a retired/unavailable vehicle.
Exact status names are Open.
## 60. Reactivation
Whether an inactive vehicle can be returned to active service is not defined.
Recommended where the record is valid.
# API
## 61. Vehicle List
Conceptual:
```http
GET /api/logistics/vehicles
```
## 62. Vehicle Detail
Conceptual:
```http
GET /api/logistics/vehicles/{vehicleId}
```
## 63. Create Vehicle
Conceptual:
```http
POST /api/logistics/vehicles
```
## 64. Update Vehicle
Conceptual:
```http
PATCH /api/logistics/vehicles/{vehicleId}
```
## 65. Deactivate Vehicle
Conceptual:
```http
POST /api/logistics/vehicles/{vehicleId}/deactivate
```
or equivalent.
Exact route is Open.
## 66. Assign Courier
Conceptual:
```http
POST /api/logistics/vehicles/{vehicleId}/assign-courier
```
Example:
```json
{
  "courier_id": "courier-id"
}
```
## 67. Unassign Courier
Conceptual:
```http
POST /api/logistics/vehicles/{vehicleId}/unassign-courier
```
Exact route depends on the chosen relationship model.
## 68. Maintenance Update
Conceptual:
```http
PATCH /api/logistics/vehicles/{vehicleId}/maintenance
```
## 69. Dispatch Eligibility
Internal/domain service:
```text
getVehicleEligibility(courier_id, order_requirements)
```
Exact API/service name is implementation-specific.
# Backend Authority
## 70. Client-Supplied Ownership
The browser must not control authoritative:
```text
logistics owner
Courier ownership
vehicle eligibility
maintenance eligibility
dispatch compatibility
```
## 71. Courier Assignment Validation
Before assigning a Courier, backend verifies:
```text
Courier exists
Courier belongs to authorized Logistics
vehicle belongs to authorized Logistics
relationship is allowed
```
## 72. Capacity Validation
Capacity values must be validated on the backend.
## 73. Maintenance Validation
Maintenance dates/status values must use defined backend rules.
# Authentication and Authorization
## 74. Authentication
Every Fleet endpoint requires:
```text
authenticated LOGISTICS
```
## 75. Role Check
Buyer, Seller, Courier, or Admin role sessions must not be accepted as Logistics because the email matches.
## 76. Ownership
Every vehicle mutation must verify:
```text
vehicle belongs to current Logistics scope
```
## 77. Courier Scope
Every Courier assignment must verify:
```text
Courier belongs to current Logistics scope
```
## 78. CSRF
State-changing web Fleet requests require configured Sanctum CSRF protection.
## 79. IDOR
Knowing `vehicle_id` or `courier_id` does not bypass ownership/authorization.
# Data Validation
## 80. Required Fields
The source requires concepts but does not define an exact create-vehicle form.
At minimum the implemented model must support:
```text
vehicle identity
plate number
capacity
maintenance scheduling
Courier linkage
```
Exact required-at-create fields are Open.
## 81. Numeric Capacity
If capacity uses numeric fields:
```text
negative values
→ invalid
```
## 82. Dates
Maintenance dates must be parseable and stored consistently.
## 83. User-Controlled Text
Vehicle descriptions/notes must be safely rendered.
## 84. Mass Assignment
Use explicit editable-field allowlists.
Do not allow clients to mutate:
```text
owner Logistics ID
system history
audit identifiers
computed eligibility
```
# Concurrency
## 85. Concurrent Vehicle Assignment
Two Logistics users may try to assign the same vehicle/Courier simultaneously.
The backend must enforce the selected relationship constraints atomically.
## 86. Dispatch Race
A vehicle may be placed into maintenance while Deploy Rider is selecting a Courier.
Deploy Rider must revalidate Fleet eligibility before committing dispatch.
## 87. Stale Fleet Screen
If a Fleet record changed since load:
```text
backend remains authoritative
```
Exact optimistic-locking policy is Open.
## 88. Idempotency
Repeated assignment/deactivation requests should not create uncontrolled duplicate history records.
# Search and Filters
## 89. Fleet List
Recommended columns:
```text
Vehicle
Plate Number
Type
Capacity
Assigned Courier
Maintenance
Operational Status
```
only where implemented.
## 90. Search
Recommended:
```text
plate number
vehicle identifier
Courier name/reference
```
within the current Logistics scope.
## 91. Filters
Recommended:
```text
vehicle type
assigned/unassigned
maintenance state
operational state
```
Exact filters depend on the schema.
## 92. Pagination
Fleet lists must be paginated/bounded.
# UI
## 93. Recommended Layout
```text
Vehicle Fleet Management
├── Fleet Summary
├── Search / Filters
├── Vehicle Registry
└── Vehicle Detail
    ├── Identity
    ├── Capacity
    ├── Courier Assignment
    └── Maintenance
```
## 94. Create Vehicle
Provide an authorized:
```text
Add Vehicle
```
action.
## 95. Vehicle Detail
Show:
```text
plate
type/class
capacity
assigned Courier
maintenance schedule/state
operational state
```
where those fields exist.
## 96. Courier Assignment UI
The assignment UI should show only eligible Couriers belonging to the Logistics organization.
## 97. Maintenance UI
The UI should clearly distinguish:
```text
scheduled maintenance
current maintenance state
maintenance history
```
if history is implemented.
## 98. Dispatch Eligibility Indicator
Recommended:
```text
Available for Dispatch
Not Available for Dispatch
Capacity Unknown
```
based on defined Fleet rules.
## 99. No Misleading Compliance Claim
Do not display:
```text
Government Certified
Fully Compliant
```
unless the project has actually defined and verified those requirements.
## 100. Empty State
Example:
```text
No vehicles have been registered yet.
```
## 101. Error States
Support:
```text
loading
empty
filtered empty
validation error
conflict
server error
```
## 102. Accessibility
Fleet UI should:
- use semantic labels
- expose statuses in text
- support keyboard interaction
- not rely on color alone
- provide accessible validation errors
- label capacity units clearly once defined
# Logging and History
## 103. Vehicle History
Recommended operational history may record:
```text
vehicle created
vehicle updated
Courier assigned
Courier unassigned
maintenance started
maintenance completed
vehicle deactivated
vehicle reactivated
```
Exact event names are Open.
## 104. Actor
History should identify the Logistics actor who made the change.
## 105. No Secret Data
Fleet history must not contain:
```text
passwords
session tokens
API keys
payment credentials
```
## 106. Admin Audit Logs Boundary
The current System Audit Logs feature is Admin-focused.
Fleet events should not automatically be forced into that Admin-only ledger unless AISLEY later generalizes audit logging across roles.
# Third-Party Dependencies
## 107. Fleet Core
Vehicle Fleet Management does not require a new third-party provider.
Core functionality can use:
```text
AISLEY backend
database
vehicle/Courier relations
```
## 108. Regulatory Verification
No government/regulatory API is required by the source.
## 109. Mapbox
Mapbox is relevant to Deploy Rider routing, not to basic Fleet CRUD.
Fleet Management supplies vehicle/capacity eligibility to Deploy Rider.
## 110. Google Maps
Google Maps/Places is not required for the Fleet registry itself.
## 111. Brevo
Brevo is not required.
## 112. SMS / Push
No SMS or Push provider is required.
# Performance
## 113. Fleet Query
Vehicle list/detail should use bounded indexed queries.
## 114. Courier Assignment Query
Only Couriers within the current Logistics organization should be searched.
## 115. Deploy Rider Query
Deploy Rider should be able to retrieve current vehicle assignment/capacity efficiently.
Recommended indexing around:
```text
logistics_id
courier_id
vehicle status
current assignment
```
## 116. No Large History Load
Maintenance/assignment history should be paginated if extensive.
# MVP Scope
## 117. Required
- authenticated Logistics access
- exact Logistics role authorization
- Logistics-scoped vehicle registry
- create vehicle
- view vehicle
- update allowed vehicle fields
- plate number storage
- vehicle type/classification support
- vehicle capacity
- maintenance schedule information
- Courier-to-vehicle linkage
- Courier assignment/unassignment
- cross-Logistics isolation
- Deploy Rider capacity-filter integration
- backend validation
- CSRF
- IDOR protection
- pagination/search
- loading/empty/error states
## 118. Recommended
- vehicle operational state
- ACTIVE / MAINTENANCE / INACTIVE conceptual lifecycle
- soft deactivation instead of hard delete
- assignment history
- maintenance history
- dispatch-eligibility indicator
- revalidation during Deploy Rider
- actor/change history
## 119. Not Required
- PostGIS
- Mapbox for Fleet CRUD
- Google Maps
- Brevo
- SMS
- Push
- external government registry
- insurance integration
- fuel tracking
- GPS hardware integration
- telematics
- vehicle purchasing/accounting
- fixed vehicle-type enum
- invented maintenance interval
- invented compliance checklist
# Acceptance Criteria
## 120. Access
- Guests cannot access Fleet Management.
- Non-Logistics roles cannot access Logistics Fleet APIs.
- Same-email other-role accounts do not inherit Fleet access.
- Logistics can only access its own Fleet.
## 121. Registry
- Logistics can create a valid vehicle record.
- Vehicle has a stable internal identifier.
- Plate number is stored and validated according to configured rules.
- Vehicle type/capacity can be represented.
- Invalid capacity is rejected.
- Vehicle list is paginated.
## 122. Courier Assignment
- Logistics can assign an authorized Courier according to the configured relationship model.
- Unauthorized/cross-Logistics Courier assignment is rejected.
- Assignment does not make the Courier Online.
- Assignment does not assign an order.
- Concurrent assignment respects relationship constraints.
- Historical relationship data is preserved if assignment history is enabled.
## 123. Maintenance
- Maintenance scheduling information can be stored.
- Maintenance inputs are validated.
- No fixed maintenance interval is hardcoded without policy.
- If MAINTENANCE blocks dispatch, Deploy Rider respects that state.
- Completion/reactivation follows configured vehicle-state rules.
## 124. Deploy Rider Integration
- Deploy Rider can obtain the Courier's current assigned vehicle where required.
- Deploy Rider can compare order volumetric requirements with vehicle capacity where both are defined.
- Missing capacity is not treated as unlimited.
- Fleet eligibility is revalidated before dispatch commit where applicable.
## 125. Security
- Vehicle/Courier IDs cannot bypass Logistics ownership.
- Mutations require CSRF.
- Client cannot change authoritative Logistics ownership.
- XSS-capable text is rendered safely.
- No credentials/secrets appear in Fleet responses.
## 126. Regulatory Boundary
- The UI does not claim specific legal/regulatory compliance that AISLEY has not defined.
- No external regulatory provider is required by the feature.
## 127. Third-Party
- Core Fleet Management works without a new third-party provider.
- Mapbox is not needed for Fleet CRUD.
- Brevo/SMS/Push are not needed.
# Tests
## 128. Backend Tests
Test:
- guest denied
- Buyer/Seller/Courier denied
- authenticated Logistics allowed
- same-email role isolation
- own Fleet list
- cross-Logistics vehicle denied
- create vehicle
- update vehicle
- invalid capacity
- plate validation
- plate uniqueness according to chosen policy
- Courier assignment
- unauthorized Courier denied
- cross-Logistics Courier denied
- unassign Courier
- concurrent assignment
- maintenance schedule update
- maintenance state update if implemented
- deactivation/reactivation if implemented
- hard delete blocked if soft-deactivation policy chosen
- Deploy Rider vehicle lookup
- capacity eligibility
- missing capacity behavior
- CSRF
- IDOR
- safe response fields
## 129. Frontend Tests
Test:
- Fleet page loads
- vehicle list
- pagination
- search by plate
- filters
- create form
- validation errors
- vehicle detail
- capacity display/unit
- Courier assignment UI
- unassignment
- maintenance schedule
- operational state
- dispatch eligibility
- empty state
- conflict state
- responsive layout
- keyboard accessibility
- status not color-only
# Open Decisions
## 130. Open Decisions
The current sources do not define:
1. exact Vehicles schema
2. whether vehicle belongs to user or separate Logistics organization entity
3. plate-number format
4. plate-number uniqueness scope
5. vehicle-type enum
6. vehicle-capacity representation
7. capacity units
8. order volumetric-weight representation
9. Courier↔Vehicle cardinality
10. whether Courier can have multiple active vehicles
11. whether vehicle can be shared among Couriers
12. assignment history schema
13. vehicle operational-status enum
14. whether `ACTIVE / MAINTENANCE / INACTIVE` is adopted
15. maintenance schedule format
16. maintenance frequency
17. maintenance history requirements
18. whether overdue maintenance blocks dispatch
19. whether maintenance state blocks dispatch
20. maintenance completion verification
21. regulatory/safety requirements
22. required vehicle documents
23. document-expiry handling
24. insurance requirements
25. vehicle-inspection requirements
26. whether external regulatory verification is ever added
27. missing order-weight behavior
28. missing vehicle-capacity behavior
29. Deploy Rider capacity matching formula
30. vehicle deactivation/reactivation policy
31. hard-delete policy
32. exact API routes
33. Fleet operational-history storage
34. exact search/filter fields
# Final Definition
## 131. Final Definition
AISLEY Vehicle Fleet Management is:
```text
a Logistics asset registry
for delivery vehicles
```
that tracks:
```text
plate number
vehicle type/classification
vehicle capacity
maintenance schedule
Courier assignment
```
and supports Deploy Rider through:
```text
order volumetric requirement
+
Courier's assigned vehicle
+
vehicle capacity
→ dispatch eligibility filter
```
Critical boundaries:
```text
Fleet Management
= vehicle/capacity authority

Deploy Rider
= Courier/order dispatch authority

Flexible Availability
= Courier online/network capacity authority
```
Source safety rule:
```text
Fleet should support
regulatory and safety compliance,

but exact legal/compliance requirements
must not be invented
until the project defines them.
```
Third-party rule:
```text
No new third-party provider
is required for core Vehicle Fleet Management.
```
