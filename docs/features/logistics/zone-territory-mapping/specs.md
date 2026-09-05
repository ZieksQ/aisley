---
role: Logistics
feature: Zone / Territory Mapping
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Logistics Web Application / Geospatial Delivery-Zone Configuration
source_coverage: Logistics.md, app.md
---
# Zone / Territory Mapping Specification
## 1. Purpose
Zone / Territory Mapping is AISLEY's Logistics geospatial configuration feature for defining operational delivery territories and using those territories to constrain Courier deployment.
`Logistics.md` defines:
```text
Core Value:
Define and assign
specific geographic delivery zones

to ensure riders are only deployed
to areas they are familiar with.
```
Expanded definition:
```text
A geospatial configuration tool.

It allows logistics managers
to draw operational boundaries
(polygons) on a map,

clustering deliveries
and filtering rider assignments
to specific local territories

to maximize efficiency
and reduce transit times.
```
System context:
```text
Integrates with mapping APIs
like Google Maps or Mapbox.

Drawn zones must be saved
as geospatial data types
in the database

to filter available riders
during dispatch.
```
A separate `flow.md` is required because this feature has a meaningful lifecycle:
```text
create/draw
→ validate
→ save
→ assign/use
→ filter dispatch eligibility
→ update/archive
```
## 2. Primary Actor
Primary actor:
```text
LOGISTICS
```
The Logistics user manages delivery zones from the Logistics web application.
## 3. Related Actor
Operationally affected actor:
```text
COURIER
```
Zones are used to restrict/filter which Couriers may be deployed to a territory.
## 4. Authentication
The Logistics web application uses the existing Laravel Sanctum stateful web-authentication model.
Every Zone/Territory request resolves:
```text
authenticated user_id
+
LOGISTICS role
```
AISLEY identity remains:
```text
unique(email, role)
```
A same-email account under another role does not receive Logistics zone-management access.
# Feature Responsibility
## 5. Zone Mapping Owns
This feature owns:
- creating geographic delivery zones
- drawing/editing polygon boundaries
- validating zone geometry
- storing polygon/geospatial data
- naming/identifying zones
- associating zones with the current Logistics scope
- assigning or linking Couriers to permitted territories where implemented
- exposing zone membership/eligibility to Deploy Rider
- listing/searching/filtering zones
- updating/deactivating zones
- preventing unauthorized cross-Logistics zone access
## 6. Zone Mapping Does Not Own
It does not own:
- Courier registration approval
- Courier online/offline state
- Courier GPS collection
- rider dispatch decision
- route optimization
- vehicle-capacity matching
- order-status mutation
- Waybill
- Buyer address editing
- Seller pickup-address editing
- surge pricing
- incentive calculation
unless separately specified.
## 7. Core Boundary
Zone/Territory Mapping answers:
```text
Which geographic territory
does this location belong to,

and which Couriers
are permitted/assigned
to serve that territory?
```
Deploy Rider answers:
```text
Which eligible Courier
should receive this task?
```
# Zone Entity
## 8. Zone Record
Each zone needs a stable internal identifier.
Recommended:
```text
zone_id
```
## 9. Logistics Ownership
Each zone must belong to the authorized Logistics organization/account or equivalent Logistics scope.
Conceptually:
```text
logistics_id
→ zones
```
Exact schema is Open.
## 10. Zone Name
A human-readable zone name is recommended.
Examples:
```text
North Hub Zone
Zone A
District 3
```
These are examples only.
## 11. Zone Description
Optional operational description:
```text
notes
service description
```
Open Decision.
## 12. Polygon
The source explicitly requires:
```text
operational boundaries
(polygons)
```
Therefore the core geometry is a polygon or compatible geospatial boundary representation.
## 13. Multi-Polygon
Whether disconnected territories require:
```text
MultiPolygon
```
support is not defined.
Open Decision.
## 14. Geometry Storage
The source explicitly requires:
```text
geospatial data types
in the database
```
Therefore the implementation should store zone geometry using a proper geospatial representation rather than only a serialized screenshot or list of display pixels.
## 15. Coordinate System
The exact spatial reference system is not defined.
Open Decision.
## 16. Geometry Authority
The database-stored geometry is authoritative.
A map drawing is only the UI representation of that geometry.
# Map Editing
## 17. Draw Zone
Authorized Logistics users should be able to:
```text
open map
→ place/edit polygon vertices
→ preview boundary
→ save
```
## 18. Edit Zone
Existing zone geometry may be updated through the map editor.
Before saving:
```text
validate geometry
```
## 19. Delete / Deactivate
The source does not define hard deletion.
Recommended:
```text
deactivate/archive zone
```
instead of destructive deletion when historical dispatches may reference the zone.
## 20. Reactivation
Whether archived/inactive zones may be reactivated is Open.
## 21. Map View
Recommended:
```text
show existing zones
show selected zone
show editable boundary
```
## 22. Map Is Not Sole Representation
The UI should also expose:
```text
zone name
status
assigned Courier count
basic metadata
```
so the feature is not map-only.
# Geometry Validation
## 23. Valid Polygon
A saved zone should have valid polygon geometry.
Reject:
```text
empty geometry
insufficient vertices
invalid/self-intersecting geometry
```
according to the chosen geospatial library/database behavior.
## 24. Polygon Size
Minimum/maximum geographic area is not defined.
Open Decision.
## 25. Vertex Limit
Maximum number of polygon points is not defined.
Open Decision.
## 26. Overlapping Zones
The source does not define whether zones may overlap.
Open Decision.
## 27. Overlap Precedence
If overlaps are allowed, the source does not define which zone wins.
Open Decision.
## 28. Gaps
The source does not require complete geographic coverage.
Unzoned areas may exist unless product policy says otherwise.
## 29. Containment
Zone lookup requires determining whether a location lies:
```text
inside
outside
or potentially on the boundary
```
of a polygon.
Boundary behavior is Open.
# Mapping Integrations
## 30. Source Mapping Requirement
`Logistics.md` says the feature integrates with:
```text
mapping APIs
like Google Maps or Mapbox
```
## 31. Existing AISLEY APIs
`app.md` explicitly selects:
```text
Maps JavaScript API
→ places library for completing address

Mapbox Matrix and Optimization
→ optimal route system
for Logistics and Riders
```
## 32. Map Provider Choice
For zone drawing, the project may use:
```text
Google Maps
or
Mapbox
```
as supported by `Logistics.md`.
The exact map-rendering provider is Open.
## 33. Third-Party Requirement
Unlike a purely internal CRUD form, a practical interactive map surface may use an external mapping API.
However:
```text
zone business rules
zone geometry
Courier assignments
dispatch eligibility
```
remain AISLEY-owned.
## 34. Map Provider Boundary
The provider renders/geocodes/maps.
AISLEY decides:
```text
zone identity
zone ownership
zone assignment
zone eligibility
```
## 35. Mapbox Matrix Boundary
Mapbox Matrix/Optimization is primarily for routing/proximity in Deploy Rider.
Zone polygon containment does not need to be implemented by the route-optimization API itself.
## 36. Google Places Boundary
Google Places may help locate/search an address/place on the map.
It does not define the zone polygon.
# Courier Territory Assignment
## 37. Source Requirement
Core Value says:
```text
Define and assign
specific geographic delivery zones

to ensure riders are only deployed
to areas they are familiar with.
```
Therefore the system needs a way to relate:
```text
Courier
↔
Zone/Territory
```
## 38. Assignment Cardinality
The source does not define whether:
```text
one Courier = one zone
one Courier = multiple zones
one zone = many Couriers
```
Open Decision.
## 39. Recommended Model
Recommended:
```text
many Couriers
↔
many Zones
```
if operational flexibility requires it.
This is a recommendation only.
## 40. Courier Scope
Only Couriers authorized under the current Logistics organization may be assigned to its zones.
## 41. Courier Approval Boundary
Zone assignment does not approve a Courier account.
Courier approval remains a separate Logistics responsibility/workflow.
## 42. Courier Availability Boundary
Zone assignment does not set:
```text
is_online
```
Online/Available state belongs to Flexible Availability & Capacity Monitoring.
## 43. Assignment History
Whether Courier-zone assignment history is required is not defined.
Recommended if operational traceability is needed.
## 44. Familiarity Meaning
The source says zones help ensure riders are deployed to areas they are familiar with.
AISLEY does not currently define how:
```text
familiarity
```
is measured or verified.
Do not invent experience scores or trip-count thresholds.
# Order / Delivery Location Mapping
## 45. Dispatch Location
Deploy Rider needs to determine which zone applies to the delivery task.
The source does not explicitly say whether zone membership is based on:
```text
pickup point
drop-off point
both
route path
```
Open Decision.
## 46. Recommended Final-Mile Interpretation
For final-mile delivery, the delivery/drop-off point is a likely territory key.
This is an inference/recommendation, not a source-backed final rule.
## 47. Pickup Territory
Pickup-based territory may also matter for Seller collection workflows.
Open Decision.
## 48. Location Source
Zone lookup should consume authoritative order/shipment coordinates.
Do not use arbitrary client-submitted coordinates as authoritative.
## 49. Missing Coordinates
If the relevant order location lacks usable coordinates:
```text
zone eligibility cannot be determined
```
Do not fabricate a zone.
# Deploy Rider Integration
## 50. Source Requirement
`Logistics.md` explicitly says stored zones are used:
```text
to filter available riders
during dispatch
```
## 51. Core Filter
Conceptually:
```text
task location
→ resolve zone
→ find Couriers assigned/eligible for zone
→ candidate filter
→ Deploy Rider continues
```
## 52. Combined Dispatch Filters
Deploy Rider may combine:
```text
Courier Online/Available
+
Zone eligibility
+
vehicle capacity
+
live GPS/proximity
+
routing
→ dispatch candidates
```
## 53. Authority Boundary
Zone/Territory Mapping owns:
```text
zone geometry
Courier-zone relationship
zone membership result
```
Deploy Rider owns:
```text
final candidate ranking/dispatch
```
## 54. No Independent Dispatch
Zone Mapping must not directly assign the order to a Courier.
## 55. Revalidation
Zone eligibility should be revalidated at dispatch commit where required, especially if:
```text
zone assignment changed
zone geometry changed
```
after candidate discovery.
# Flexible Availability Integration
## 56. Online State
Flexible Availability & Capacity Monitoring owns:
```text
Courier.is_online
```
## 57. Zone State
Zone/Territory Mapping owns:
```text
Courier geographic eligibility
```
These are independent.
Example:
```text
Courier online
+
outside/not assigned to target zone
→ not eligible for that zone
```
## 58. Offline Courier
A Courier assigned to the correct zone but offline is still not dispatchable.
# Fleet Integration
## 59. Vehicle Capacity
Vehicle Fleet Management owns:
```text
vehicle capacity
Courier-vehicle relationship
```
## 60. Independent Filters
Zone eligibility does not imply capacity eligibility.
Deploy Rider must combine both where enabled.
# Routing Integration
## 61. Zone vs Route
Zone membership is a geographic eligibility rule.
Mapbox routing calculates:
```text
distance
travel time
optimal route
```
These are related but different.
## 62. No Route Inside Polygon Requirement
The source does not require the entire route to remain inside the Courier's zone.
Open Decision.
# Zone Lifecycle
## 63. Create
Recommended:
```text
DRAFT/unsaved map shape
→ validate
→ save active zone
```
The source does not define a persistent DRAFT state.
## 64. Active
An active zone may participate in dispatch filtering.
## 65. Update
Changing zone geometry or assignments should affect future dispatch eligibility after the update commits.
## 66. Existing Deliveries
Changing a zone must not silently rewrite historical delivery records or active assignments.
## 67. Deactivate
Recommended:
```text
ACTIVE
→ INACTIVE
```
Inactive zone:
```text
not used for new dispatch filtering
```
## 68. Existing Courier Assignments
When a zone is deactivated, treatment of its Courier assignments is Open.
Recommended:
```text
preserve relationship/history
but disable new dispatch use
```
## 69. Hard Delete
Hard delete is not recommended for historically referenced zones.
# Data Model
## 70. Zone Table
Conceptual:
```text
zones
```
with:
```text
id
logistics_id
name
geometry
status
created_at
updated_at
```
Exact schema is Open.
## 71. Courier-Zone Link
Conceptual:
```text
courier_zones
```
with:
```text
courier_id
zone_id
assigned_at
unassigned_at
```
Exact schema/cardinality is Open.
## 72. Geospatial Index
A geospatial index is recommended for containment queries.
Exact database technology is Open.
## 73. PostGIS
`Logistics.md` explicitly mentions PostGIS as an example in Deploy Rider, not as a mandatory Zone Mapping technology.
If used:
```text
PostGIS
→ suitable geospatial database extension
```
but it is not a hosted third-party provider requirement.
## 74. Geometry Serialization
GeoJSON or provider-specific map drawing payload may be used at API boundaries, while database geometry remains authoritative.
Exact format is Open.
# API
## 75. Zone List
Conceptual:
```http
GET /api/logistics/zones
```
## 76. Zone Detail
Conceptual:
```http
GET /api/logistics/zones/{zoneId}
```
## 77. Create Zone
Conceptual:
```http
POST /api/logistics/zones
```
Possible payload:
```json
{
  "name": "Zone A",
  "geometry": {}
}
```
## 78. Update Zone
Conceptual:
```http
PATCH /api/logistics/zones/{zoneId}
```
## 79. Deactivate Zone
Conceptual:
```http
POST /api/logistics/zones/{zoneId}/deactivate
```
or equivalent.
## 80. Assign Courier
Conceptual:
```http
POST /api/logistics/zones/{zoneId}/couriers
```
## 81. Unassign Courier
Conceptual:
```http
DELETE /api/logistics/zones/{zoneId}/couriers/{courierId}
```
Exact route conventions are Open.
## 82. Zone Lookup
Internal/domain endpoint/service:
```text
resolveZoneForLocation(latitude, longitude)
```
or equivalent.
## 83. Dispatch Eligibility
Deploy Rider should consume a domain service rather than duplicate polygon logic in the frontend.
# Backend Authority
## 84. Ownership
The backend derives the authorized Logistics owner.
Client cannot arbitrarily set another `logistics_id`.
## 85. Geometry Validation
The backend validates submitted geometry before persistence.
## 86. Courier Assignment Validation
The backend verifies:
```text
zone belongs to current Logistics
Courier belongs to current Logistics
relationship is allowed
```
## 87. Location Containment
Dispatch zone membership should be calculated on the backend or another trusted domain service.
Do not trust frontend-only polygon containment for authorization/dispatch decisions.
# Authorization and Security
## 88. Authentication
Every Zone/Territory endpoint requires:
```text
authenticated LOGISTICS
```
## 89. Role Check
Buyer, Seller, Courier, or Admin-role sessions must not be treated as Logistics because of same email.
## 90. Zone Ownership
A Logistics account can view/update only zones within its scope.
## 91. Courier Ownership
A Logistics account can assign only its authorized Couriers.
## 92. IDOR
Knowing:
```text
zone_id
courier_id
```
must not bypass authorization.
## 93. CSRF
State-changing web requests require configured Sanctum CSRF protection.
## 94. XSS
Zone names/descriptions are user-controlled and must be safely rendered.
## 95. Sensitive Locations
Operational zone geometry may reveal Logistics service coverage.
Only authorized users should access internal management data.
# Concurrency
## 96. Concurrent Zone Editing
Two Logistics users may edit the same zone.
The backend should avoid silent destructive overwrite.
Exact optimistic-locking/versioning behavior is Open.
## 97. Dispatch Race
A Courier-zone assignment may change while Deploy Rider is selecting candidates.
Deploy Rider should revalidate eligibility before committing dispatch.
## 98. Geometry Update Race
If geometry changes after candidate ranking:
```text
backend eligibility revalidation
→ authoritative result
```
## 99. Duplicate Assignment
Repeated Courier-zone assignment requests should be idempotent or uniqueness-constrained.
# Error Handling
## 100. Invalid Polygon
```text
reject
→ preserve existing zone
```
## 101. Unauthorized Zone
```text
deny
→ no cross-Logistics geometry leak
```
## 102. Unauthorized Courier
```text
reject assignment
```
## 103. Map Provider Failure
If map tiles/search/rendering provider fails:
```text
do not corrupt saved zone data
```
Existing stored geometry remains authoritative.
## 104. Zone Lookup Failure
If dispatch cannot determine a zone:
```text
do not invent eligibility
```
Follow configured dispatch fallback policy.
## 105. Overlap Ambiguity
If overlapping zones are permitted and more than one matches:
```text
apply configured precedence
or
return ambiguous
```
Exact policy is Open.
# Search and Filters
## 106. Zone List
Recommended columns:
```text
Zone Name
Status
Assigned Couriers
Last Updated
```
## 107. Search
Recommended:
```text
zone name
```
## 108. Filters
Recommended:
```text
Active / Inactive
Courier assignment
```
Exact filters are Open.
## 109. Pagination
Zone lists should be bounded/paginated if large.
# UI
## 110. Recommended Layout
```text
Zone / Territory Mapping
├── Zone List
├── Map Editor
├── Zone Details
└── Courier Assignments
```
## 111. Map Editor
The map should support:
```text
draw polygon
move vertices
remove vertices
preview boundary
save
```
according to selected map library capabilities.
## 112. Existing Zones
Existing zones should be visually distinguishable.
Exact colors/styles are design-system concerns.
## 113. Selected Zone
Clearly identify which zone is currently being edited.
## 114. Save Confirmation
Before replacing a large existing boundary, confirmation may be appropriate.
Exact UX is Open.
## 115. Courier Assignment UI
Show only authorized Logistics Couriers.
## 116. Empty State
Example:
```text
No delivery zones have been configured.
```
## 117. Invalid Geometry Error
Explain invalid polygon state before save.
## 118. Accessibility
The feature should not rely exclusively on freehand map interaction.
Provide an accessible alternative for essential metadata/actions where practical.
At minimum:
- zone names/statuses are textual
- form controls are keyboard accessible
- assignment controls are accessible
- validation errors are textual
- map color is not the only status signal
Exact accessible polygon-editing alternative is Open.
# Third-Party Dependencies
## 119. Mapping API
`Logistics.md` explicitly expects integration with a mapping API:
```text
Google Maps
or
Mapbox
```
Therefore this feature may have an external map-provider dependency.
## 120. Existing AISLEY Providers
`app.md` already includes:
```text
Maps JavaScript API
Mapbox Matrix and Optimization
```
No additional mapping vendor is inherently required beyond the architecture AISLEY selects.
## 121. Provider vs Business Logic
External provider:
```text
map rendering
place/map interaction
possibly geocoding
```
AISLEY:
```text
zone geometry persistence
Courier-zone relationship
dispatch filtering rules
authorization
```
## 122. Brevo
Brevo is not required.
## 123. SMS / Push
No SMS or Push provider is required.
# Performance
## 124. Geometry Query
Containment/filtering should use database/geospatial indexing suitable for operational dispatch volume.
## 125. Map Loading
Do not load excessive detailed polygons unnecessarily.
## 126. Simplification
Geometry simplification may be used for display if authoritative geometry remains intact.
Exact policy is Open.
## 127. Dispatch Query
Deploy Rider should use efficient zone membership/assignment queries.
Avoid scanning every zone/Courier in application memory for each dispatch if database spatial queries are available.
# Logging / History
## 128. Recommended Change History
Operational history may record:
```text
zone created
zone geometry updated
Courier assigned
Courier unassigned
zone deactivated
zone reactivated
```
## 129. Actor
Record the Logistics actor where change history is implemented.
## 130. Admin Audit Boundary
Current System Audit Logs is Admin-focused.
Zone changes should not automatically be forced into that Admin ledger without a broader cross-role audit design.
# MVP Scope
## 131. Required
- authenticated Logistics access
- exact Logistics role authorization
- Logistics-scoped zone records
- polygon drawing
- geometry validation
- geospatial database persistence
- zone name/identity
- zone list/detail
- edit zone
- Courier-zone assignment/link
- cross-Logistics isolation
- zone lookup for task location
- Deploy Rider zone filtering
- backend ownership validation
- backend containment/eligibility authority
- CSRF
- IDOR protection
- loading/empty/error states
- mapping API integration
## 132. Recommended
- zone activation/deactivation
- soft archive instead of hard delete
- Courier assignment history
- geospatial index
- overlap validation/warning
- dispatch-time revalidation
- place search/map centering
- zone change history
- GeoJSON API representation
## 133. Not Required
- automatic zone generation
- AI clustering
- automatic Courier familiarity scoring
- fixed one-zone-per-Courier rule
- automatic full geographic coverage
- invented overlap precedence
- invented polygon size limit
- route constrained entirely inside zone
- Brevo
- SMS
- Push
- external regulatory service
# Acceptance Criteria
## 134. Access
- Guest cannot access Zone Mapping.
- Non-Logistics role cannot manage Logistics zones.
- Same-email other-role account does not inherit access.
- Logistics can access only its own zones.
## 135. Geometry
- Logistics can draw and save a valid polygon.
- Invalid polygon is rejected.
- Saved geometry persists as geospatial data.
- Backend/database geometry is authoritative.
- Client cannot alter another Logistics organization's geometry.
## 136. Courier Assignment
- Authorized Courier can be linked according to configured cardinality.
- Cross-Logistics Courier assignment is rejected.
- Zone assignment does not set Courier online.
- Zone assignment does not approve Courier.
- Duplicate assignment is handled safely.
## 137. Dispatch Integration
- Deploy Rider can determine the relevant zone for a task location according to configured policy.
- Deploy Rider can filter Couriers by zone eligibility.
- Zone eligibility is independent of online state and vehicle capacity.
- Final dispatch remains owned by Deploy Rider.
- Eligibility is revalidated when required.
## 138. Map Provider
- Selected map provider can render/edit zone geometry.
- Map-provider outage does not silently corrupt saved zone geometry.
- Map provider does not own Courier assignment/business rules.
## 139. Security
- Zone/Courier IDs cannot bypass ownership checks.
- Mutations use CSRF.
- User-controlled labels are XSS-safe.
- Internal coverage geometry is not exposed to unauthorized users.
## 140. Third-Party
- Google Maps or Mapbox may supply mapping capability as source-supported integrations.
- No additional email/SMS/Push provider is required.
# Tests
## 141. Backend Tests
Test:
- guest denied
- Buyer/Seller/Courier denied
- authenticated Logistics allowed
- same-email role isolation
- own zone list
- cross-Logistics zone denied
- valid polygon create
- invalid polygon reject
- geometry update
- zone ownership protected
- Courier assignment
- cross-Logistics Courier rejected
- duplicate assignment
- Courier unassignment
- zone containment lookup
- location outside all zones
- overlap behavior according to configured policy
- Deploy Rider zone filter
- dispatch revalidation after assignment change
- deactivate/reactivate if implemented
- CSRF
- IDOR
- XSS-safe zone name
## 142. Frontend Tests
Test:
- Zone Mapping page loads
- zone list
- map renders
- draw polygon
- edit vertices
- invalid geometry error
- save
- edit existing zone
- Courier assignment
- filters/search
- inactive state if implemented
- map-provider error
- empty state
- keyboard-accessible metadata/actions
- textual zone status
- responsive layout
# Open Decisions
## 143. Open Decisions
The current sources do not define:
1. selected map provider for zone editor
2. exact geospatial database technology
3. spatial reference system
4. Polygon vs MultiPolygon support
5. zone naming rules
6. zone-description field
7. minimum/maximum zone size
8. vertex limit
9. overlapping-zone policy
10. overlap precedence
11. boundary-point behavior
12. whether gaps between zones are allowed
13. whether zones must cover the whole service area
14. Courier↔Zone cardinality
15. Courier-zone assignment history
16. whether every Courier must have a zone
17. how Courier familiarity is established
18. whether dispatch zone uses pickup, drop-off, both, or another shipment point
19. multi-zone order behavior
20. whether route must stay inside territory
21. unzoned-order dispatch policy
22. map place-search behavior
23. zone activation/status enum
24. archive/reactivation policy
25. hard-delete policy
26. existing active deliveries after geometry changes
27. exact API geometry format
28. optimistic locking/versioning
29. change-history storage
30. accessibility approach for polygon editing
# Final Definition
## 144. Final Definition
AISLEY Zone / Territory Mapping is:
```text
a Logistics geospatial configuration feature

for drawing and storing
delivery-zone polygons

and assigning/associating Couriers
with the territories
they are permitted to serve.
```
Core operational model:
```text
task geographic location
→ resolve delivery zone
→ filter Couriers by zone eligibility
→ Deploy Rider applies
   availability + Fleet + proximity/routing
→ dispatch candidate
```
Critical boundaries:
```text
Zone Mapping
= geographic eligibility authority

Deploy Rider
= final dispatch authority

Flexible Availability
= Courier online-state authority

Vehicle Fleet
= capacity authority
```
Mapping provider rule:
```text
Google Maps or Mapbox
may provide the map interface,

while AISLEY remains authoritative
for geometry, assignments,
authorization, and dispatch rules.
```
