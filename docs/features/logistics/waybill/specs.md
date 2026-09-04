---
role: Logistics
feature: Waybill
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Logistics Web Application / Internal Hub Parcel Labeling
source_coverage: Logistics.md, app.md
---
# Waybill Specification
## 1. Purpose
Waybill is AISLEY's Logistics document-generation feature for converting authoritative order data into a printable and scannable parcel manifest/label used during sorting, transfer, and dispatch.
`Logistics.md` defines:
```text
Core Value:
Able to print order details.
```
Expanded definition:
```text
A document generation tool
for internal hub operations.

It synthesizes digital order data
into standardized, scannable
physical manifests and routing labels
necessary for sorting center logistics.
```
System context:
```text
Uses a PDF or thermal printer
formatting library

to generate barcodes
(Code 128 or QR)

that map to the primary key
of the Orders database record.
```
`app.md` places Waybill in the Logistics transfer/dispatch flow:
```text
logistics receives order
→ waybill
→ sorted
→ transfer
→ dispatch
```
and states:
```text
automates the order status
by scanning
or manually entering
the waybill QR
or reference number.
```
A separate `flow.md` is required because Waybill has a meaningful generation/use lifecycle and a handoff into scan-based status progression.
## 2. Primary Actor
Primary actor:
```text
LOGISTICS
```
The Logistics user generates and prints Waybills through the Logistics web application.
## 3. Authentication
The Logistics web app uses the existing Laravel Sanctum stateful authentication model.
Each request resolves:
```text
authenticated user_id
+
LOGISTICS role
```
AISLEY account identity remains:
```text
unique(email, role)
```
A same-email account under another role does not gain Waybill access.
# Feature Responsibility
## 4. Waybill Owns
Waybill owns:
- generating a printable parcel/order manifest
- loading authoritative order data
- producing a stable human-readable Waybill/order reference
- rendering Code 128 or QR
- printable/PDF or thermal-label output
- previewing before print
- reprinting
- protecting printed/downloadable data
- providing a scannable identity for sorting/transfer/dispatch
- preserving enough metadata to safely reproduce the same Waybill
## 5. Waybill Does Not Own
Waybill does not own:
- order creation
- Seller approval
- Seller packing
- Courier assignment
- routing
- parcel-state rules
- Update Status
- proof of delivery
- Buyer Address Book
- payment processing
- external carrier label procurement
## 6. Critical Boundary
Waybill:
```text
identifies the parcel/order
```
Scanner / Update Status:
```text
resolves the reference
and performs a valid state transition
```
Generating or printing a Waybill must not mutate order status.
# Logistics Flow Context
## 7. Source Flow
From `app.md`:
```text
logistics receives order
→ waybill
→ sorted
→ transfer
→ dispatch
```
## 8. Scan Use
The source indicates:
```text
transfer
→ scan waybill

dispatch
→ scan waybill
```
## 9. Manual Fallback
If scanning fails:
```text
manually enter
Waybill QR/reference number
```
Therefore the Waybill needs both:
```text
machine-readable identifier
human-readable reference
```
# Source Data
## 10. Authoritative Order Data
Waybill data must come from the backend's authoritative order/shipment record.
The browser must not supply arbitrary printable order facts as the official source.
## 11. Order Mapping
`Logistics.md` says the barcode/QR maps to:
```text
the primary key
of the Orders database record
```
Implementation must preserve a deterministic mapping from the code/reference to the intended order.
## 12. Raw Primary Key Exposure
The source requires mapping to the primary key, not necessarily directly exposing a raw sequential database ID.
Recommended:
```text
opaque Waybill reference
→ securely resolves to order primary key
```
Whether the raw primary key is encoded is Open.
## 13. Human-Readable Reference
The Waybill should visibly include a stable reference usable for manual fallback.
Possible labels:
```text
Order Reference
Waybill Reference
```
Exact format is Open.
# Printed Content
## 14. Source Requirement
The Waybill must print:
```text
order details
```
The exact field set is not defined.
## 15. Recommended Operational Content
Where available and necessary:
```text
Waybill / Order Reference
Seller / Pickup Context
Buyer / Delivery Context
Parcel / Order Summary
Hub / Routing Context
Scannable Code
```
## 16. Seller Information
Print only Seller/shop/pickup details required for Logistics handling.
Do not include unrelated Seller account/security information.
## 17. Buyer Information
Print only Buyer delivery information needed for operational delivery.
## 18. Address Snapshot
If a delivery address is printed, use the order's authoritative delivery snapshot.
Do not silently substitute a later-edited Buyer Address Book value.
## 19. Contact Numbers
Whether Buyer/Seller phone numbers appear is not defined.
Open Decision.
## 20. Product / Parcel Detail
Whether the Waybill prints:
```text
product names
quantities
package count
weight
dimensions
```
is Open.
## 21. Payment Data
Do not print sensitive payment data.
## 22. Forbidden Data
Never print:
```text
password
password hash
session token
access token
API credentials
CVV
full payment-card details
internal security notes
```
# Scannable Code
## 23. Supported Formats
`Logistics.md` explicitly names:
```text
Code 128
or
QR
```
## 24. Format Choice
The source does not require both.
MVP may support:
```text
QR
```
or:
```text
Code 128
```
or both.
Open Decision.
## 25. Payload
The machine-readable payload must resolve to the intended order/Waybill.
Do not encode unnecessary PII.
## 26. Privacy
Recommended:
```text
opaque/stable reference
```
instead of embedding:
```text
full address
phone number
order contents
```
inside QR/barcode payload.
## 27. Readability
Code size/quality must be appropriate for the selected print medium.
Exact dimensions/DPI are Open.
## 28. Scan Failure
If the code cannot be read:
```text
manual reference entry
```
must remain possible.
# Document Output
## 29. PDF / Thermal Requirement
`Logistics.md` references:
```text
PDF
or
thermal printer formatting library
```
This is an implementation capability, not a hosted provider requirement.
## 30. PDF
Waybill may support:
```text
printable PDF
```
## 31. Thermal
Waybill may support:
```text
thermal-label layout
```
## 32. MVP Output Choice
Whether MVP supports:
```text
PDF only
thermal only
both
```
is Open.
## 33. Browser Print
Browser-native print may be used if it satisfies the physical output requirements.
## 34. Printer Driver Boundary
Waybill generates printable output.
It does not manage operating-system printer drivers.
# Generation Lifecycle
## 35. Eligibility
A Waybill may be generated only when the order has reached the Logistics stage defined by the shipment workflow.
The exact eligible order status is Open.
## 36. Generate
Conceptually:
```text
authorized order
→ load authoritative data
→ validate Waybill eligibility
→ create/reuse Waybill identity
→ render code/document
```
## 37. Idempotent Identity
Repeated Generate actions should normally reuse the same logical Waybill for the same parcel/order.
## 38. Reprint
Reprinting should not create a new order identity.
## 39. Regeneration
If order data changes after generation, behavior may be:
```text
regenerate same Waybill
```
or:
```text
create versioned Waybill
```
Open Decision.
## 40. Duplicate Generation
Concurrent generation must not create conflicting current Waybill references for the same logical parcel.
## 41. Versioning
Waybill versioning is not source-required.
Open Decision.
# Sorting Integration
## 42. Sorting Center Role
The Waybill should provide enough parcel identity/routing context for sorting-center operations.
## 43. No Direct Sorting Mutation
Waybill generation does not mark:
```text
SORTED
```
unless a scan/state-transition workflow performs that mutation.
## 44. Hub / Route Fields
Waybill may include hub/route context if the shipment domain provides it.
Exact fields are Open.
# Transfer Integration
## 45. Transfer Scan
From `app.md`:
```text
transfer
→ scan waybill
```
The scan must resolve the intended order/parcel.
## 46. State Transition
The resulting state mutation belongs to the shared scanner/Update Status transition service.
# Dispatch Integration
## 47. Dispatch Scan
From `app.md`:
```text
dispatch
→ scan waybill
```
## 48. Deploy Rider Boundary
Scanning does not independently choose a Courier.
Courier assignment remains owned by:
```text
Deploy Rider
```
## 49. Shared State Rules
Scanner and manual status recovery should use the same authoritative transition service.
# Manual Reference Fallback
## 50. Manual Lookup
If scanning fails:
```text
enter Waybill/reference
→ resolve order
→ use same transition rules
```
## 51. Invalid Reference
Unknown reference:
```text
show not found
→ no mutation
```
## 52. Unauthorized Reference
Valid Waybill outside current Logistics scope:
```text
deny
→ no order data leak
```
# Data Model
## 53. Recommended Waybill Metadata
If a separate Waybill record is useful:
```text
id
order_id
waybill_reference
barcode_type
generated_at
generated_by
last_printed_at
version
```
Exact schema is Open.
## 54. Separate Table
A dedicated Waybills table is not explicitly required.
Waybill may remain a generated document/view if the order record already contains the stable reference.
## 55. Stable Reference
The reference must resolve deterministically to the intended order.
## 56. Generation Actor
Recommended:
```text
generated_by Logistics user_id
```
## 57. Print Count
Optional.
Not source-required.
# API
## 58. Waybill Detail
Conceptual:
```http
GET /api/logistics/orders/{orderId}/waybill
```
## 59. Generate
Conceptual:
```http
POST /api/logistics/orders/{orderId}/waybill
```
Repeated calls should be idempotent where practical.
## 60. Printable Output
Conceptual:
```http
GET /api/logistics/orders/{orderId}/waybill/print
```
or equivalent PDF/printable response.
## 61. Reference Lookup
Conceptual:
```http
GET /api/logistics/waybills/lookup?reference=...
```
for authorized Logistics workflows.
## 62. Scanner Endpoint Boundary
Status-changing scan handling belongs to the scanner/Update Status layer.
Conceptual:
```http
POST /api/logistics/scans
```
# Authorization
## 63. Authentication
Every Waybill endpoint requires:
```text
authenticated LOGISTICS
```
## 64. Order Scope
The order must be authorized for the current Logistics account/organization.
## 65. IDOR
Knowing:
```text
order_id
waybill_reference
QR payload
```
does not bypass authorization.
## 66. CSRF
State-changing Waybill generation endpoints require configured Sanctum CSRF protection.
## 67. Backend Authority
The backend determines:
```text
order
Waybill identity
encoded payload
printable data
Logistics ownership
```
# Security and Privacy
## 68. PII Minimization
Physical labels may be visible to operational staff.
Print only necessary data.
## 69. Machine-Readable Privacy
Do not embed unnecessary PII in QR/barcode payload.
## 70. Public Guessability
A scanned/reference value alone must not provide public access to private order details.
## 71. Protected Files
If PDFs/labels are persisted:
```text
private storage
authorized retrieval
```
should be used.
## 72. File Retention
Retention of generated files is Open.
# Concurrency and Idempotency
## 73. Concurrent Generation
Two requests for the same order should not create conflicting Waybill identities.
## 74. Multi-Package Orders
Whether one order may need multiple parcel labels is not defined.
Open Decision.
## 75. Reprint Safety
Reprinting does not mutate parcel state.
## 76. Duplicate Scan
Duplicate scans are handled by the scanner/state-transition service.
A repeated scan must not unintentionally advance multiple lifecycle stages.
# Error Handling
## 77. Order Not Found
```text
no Waybill
no data leak
```
## 78. Ineligible Order
If the order has not reached Waybill eligibility:
```text
reject generation
```
## 79. Rendering Failure
If barcode/PDF rendering fails:
```text
do not claim generation success
```
## 80. Printer Failure
If local printing fails after generation:
```text
Waybill identity remains valid
→ user may reprint
```
## 81. Stale Order Data
Behavior after an address/routing change is Open.
# Performance
## 82. Generation
Waybill generation should be suitable for operational hub use.
## 83. Bounded Data Load
Generation should load only order/shipment relations needed for the label.
## 84. Batch Printing
Bulk printing is not source-required.
Open Decision.
## 85. Local Rendering
Where practical, barcode/QR rendering should use an application/library implementation rather than an external hosted service.
# UI
## 86. Entry Points
Waybill may be reached from:
```text
Logistics Dashboard
Order Detail
sorting/transfer workflow
```
## 87. Recommended Screen
```text
Waybill
├── Order Summary
├── Waybill Reference
├── Scannable Code
├── Printable Preview
└── Print / Reprint
```
## 88. Preview
Show the intended order before printing.
## 89. Reference Visibility
Display the human-readable reference near the code.
## 90. Print Actions
Recommended:
```text
Print
Reprint
```
## 91. No Status Side Effect
UI must not imply:
```text
Print
=
Sorted
Transferred
Dispatched
```
## 92. Accessibility
The UI should:
- expose a text reference
- not depend on QR/barcode alone
- provide accessible print controls
- expose render errors in text
- support keyboard use
# Logging / History
## 93. Recommended Metadata
Operational metadata may include:
```text
order
Waybill reference
generated by
generated at
last printed at
```
## 94. Reprint History
Optional.
## 95. Admin Audit Boundary
Current System Audit Logs is Admin-focused.
Routine Logistics Waybill printing does not automatically belong in that Admin ledger.
# Third-Party Dependencies
## 96. Core Requirement
No new hosted third-party provider is required.
Waybill needs:
```text
PDF/thermal formatting capability
+
Code 128 or QR generation capability
```
which may be implemented through libraries inside AISLEY.
## 97. Mapbox
Not required for basic Waybill generation.
## 98. Google Maps
Not required for label generation itself.
## 99. Brevo
Not required.
## 100. SMS / Push
Not required.
# MVP Scope
## 101. Required
- authenticated Logistics access
- authorized order lookup
- Waybill generation from authoritative order data
- printable order details
- stable human-readable reference
- Code 128 or QR code
- deterministic mapping to order
- print/preview
- reprint
- scan compatibility
- manual reference fallback
- no status mutation from generation/printing
- IDOR protection
- PII minimization
- CSRF where generation persists data
- loading/error states
## 102. Recommended
- opaque Waybill reference
- deterministic/find-or-create generation
- generated-by metadata
- protected printable output
- printable PDF
- thermal layout if hardware requires it
- shared scanner/Update Status transition service
## 103. Not Required
- QR and Code 128 simultaneously
- external PDF provider
- external barcode provider
- Mapbox
- Google Maps
- Brevo
- SMS
- Push
- government/carrier API
- invented legal shipping fields
- bulk printing
- multiple Waybills per order unless defined
# Acceptance Criteria
## 104. Access
- Guest cannot access Waybill.
- Non-Logistics roles cannot generate/print Logistics Waybills.
- Same-email other-role accounts do not gain access.
- Logistics can access only authorized orders.
## 105. Generation
- Eligible order can generate a Waybill.
- Printed data comes from authoritative order/shipment data.
- Client cannot inject arbitrary official Waybill content.
- Repeated generation follows configured idempotency.
- Ineligible order is rejected.
## 106. Reference / Code
- Waybill contains Code 128 or QR.
- Code resolves to the intended order.
- Human-readable reference exists.
- Payload avoids unnecessary PII.
- Invalid/unresolvable reference does not mutate order.
## 107. Printing
- Logistics can preview and print/reprint.
- Reprinting does not change status.
- Printer failure does not invalidate Waybill identity.
- Render failure is shown as error.
## 108. Scan Integration
- Transfer/dispatch scanner can resolve the Waybill.
- Scan state changes use the authoritative transition service.
- Manual fallback uses the same transition rules.
- Duplicate scan does not unintentionally advance multiple states.
## 109. Security
- Order/Waybill IDs cannot bypass authorization.
- Private Waybill files/details are not publicly enumerable.
- PII is minimized.
- Secrets/payment credentials are never printed.
- Persisting mutations use CSRF.
## 110. Third-Party
- Core Waybill works without a new hosted third-party provider.
- PDF/thermal/barcode libraries may be internal dependencies.
- Mapbox/Brevo/SMS/Push are not required.
# Tests
## 111. Backend Tests
Test:
- guest denied
- Buyer/Seller/Courier denied
- authenticated Logistics allowed
- same-email role isolation
- authorized order generation
- unauthorized order denied
- ineligible order rejected
- authoritative data used
- client field injection rejected/ignored
- Waybill reference resolves
- QR/Code 128 payload resolves
- duplicate generation idempotent
- concurrent generation
- reprint preserves identity
- invalid reference
- unauthorized reference
- PII minimized
- secrets excluded
- protected printable response
- CSRF
- scan lookup integration
- manual reference integration
- duplicate scan delegated safely to transition layer
## 112. Frontend Tests
Test:
- Waybill page loads
- order summary
- reference visible
- QR/barcode rendered
- print preview
- Print
- Reprint
- render failure
- unauthorized/not-found
- ineligible order
- loading state
- responsive layout
- keyboard accessibility
- textual reference available without code image
# Open Decisions
## 113. Open Decisions
The current sources do not define:
1. exact Waybill fields
2. exact eligible order status
3. raw Order primary key vs opaque reference
4. reference format
5. QR vs Code 128 vs both
6. barcode dimensions/DPI
7. PDF vs thermal vs both for MVP
8. page/label size
9. printer hardware assumptions
10. file persistence
11. file retention
12. Waybill table vs generated order view
13. versioning
14. regeneration after order-data change
15. phone-number printing
16. Seller contact fields
17. Buyer contact fields
18. product/package fields
19. package count
20. weight/dimensions
21. route/hub fields
22. multi-package orders
23. multiple Waybills per order
24. batch printing
25. print history/count
26. exact scanner endpoint
27. exact scan transition mapping
28. manual reference workflow
29. any future legal/carrier declaration fields
# Final Definition
## 114. Final Definition
AISLEY Waybill is:
```text
an internal Logistics
printable and scannable
parcel/order manifest and routing label
```
used in:
```text
logistics receives order
→ Waybill
→ sorting
→ transfer scan
→ dispatch scan
```
Core model:
```text
authorized order
→ authoritative order data
→ Waybill reference
→ Code 128 or QR
→ printable label/document
```
Critical boundary:
```text
Waybill
= parcel/order identification

Scanner / Update Status
= validated lifecycle mutation
```
Printing or generating a Waybill does not itself advance parcel state.
Third-party rule:
```text
No new hosted third-party provider
is required for core Waybill generation.
```
