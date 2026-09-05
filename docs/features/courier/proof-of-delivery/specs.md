---
role: Courier/Rider
feature: Proof of Delivery (e-POD)
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Flutter Courier Mobile Application / Digital Delivery Evidence
source_coverage: Courier.md, app.md
---
# Proof of Delivery (e-POD) Specification
## 1. Purpose
Proof of Delivery (e-POD) is AISLEY's Courier verification feature for capturing digital evidence that a parcel was successfully handed over or placed at the correct destination.
`Courier.md` defines:
```text
Core Value:
Upload photos of the delivered parcel,
collect e-signatures,
or scan QR codes
upon successful drop-off.
```
Expanded definition:
```text
A strict verification mechanism
designed to prevent delivery disputes.

It mandates that the courier captures
undeniable digital evidence

that the parcel was safely handed over
or placed at the correct destination.
```
System context:
```text
Requires mobile device
camera and storage permissions.

Uploads media
to secure cloud storage
(e.g., AWS S3)

and creates a permanent data link
between the media asset URL
and the Order record.
```
A separate `flow.md` is required because e-POD has a real lifecycle:
```text
successful drop-off
→ capture proof
→ validate
→ securely store
→ link to Order
→ satisfy proof requirement
→ Complete Delivery
```
## 2. Primary Actor
```text
COURIER / RIDER
```
The Courier captures e-POD through the Flutter mobile application.
## 3. Authentication
Courier mobile authentication follows `app.md`:
```text
Flutter
→ personal access token
→ flutter_secure_storage

Requests:
Authorization: Bearer <token>
```
Every e-POD request resolves:
```text
authenticated user_id
+
COURIER role
```
AISLEY identity remains:
```text
unique(email, role)
```
Never authorize evidence access using email alone.
# Responsibility and Boundaries
## 4. e-POD Owns
e-POD owns:
- photo delivery evidence
- e-signature capture
- QR delivery verification
- evidence validation
- secure evidence upload/storage
- evidence metadata
- durable evidence-to-Order linkage
- Courier/order/task authorization
- secure evidence retrieval
- delivery-completion proof status
- dispute-support evidence
## 5. e-POD Does Not Own
It does not own:
- Accept Delivery Requests
- Pick Up Order
- active navigation
- setting Order to `DELIVERED`
- setting task to `COMPLETED`
- earnings calculation
- Chat
- Incident creation
- dispute resolution
- refunds
- tips/feedback
## 6. Critical Boundary
```text
Proof of Delivery
= evidence

Complete Delivery
= final Order-state mutation
```
Capturing proof should not itself mark:
```text
Order = DELIVERED
```
unless a future architecture explicitly combines those operations.
# Lifecycle Context
## 7. Entry Context
Source says e-POD is captured:
```text
upon successful drop-off
```
after:
```text
Accept Delivery Requests
→ ACCEPTED

Pick Up Order
→ IN_TRANSIT

Deliver Order
→ active transit
```
## 8. Recommended Handoff
```text
Deliver Order
→ Proof of Delivery
→ Complete Delivery
```
## 9. Completion Requirement
The source describes e-POD as:
```text
strict verification
```
and says it:
```text
mandates digital evidence
```
This strongly supports e-POD as a completion prerequisite.
However, the source does not define which exact proof method is required for every Order.
Open Decision.
# Supported Proof Methods
## 10. Photo
Source-supported:
```text
photo of delivered parcel
```
Purpose:
```text
show parcel safely handed over
or placed at correct destination
```
## 11. E-Signature
Source-supported:
```text
e-signature
```
The source does not define:
- who must sign
- signer name requirement
- signature legal text
- acceptable substitute recipient
Open Decision.
## 12. QR Verification
Source-supported:
```text
QR scan
upon successful drop-off
```
The source does not define who generates the QR.
Open Decision.
## 13. Proof Combination Policy
The source does not define whether a delivery requires:
```text
photo only
signature only
QR only
any one method
multiple methods
all methods
```
Open Decision.
## 14. Recommended Policy Model
```text
Order / Delivery Task
→ required proof policy
→ allowed/required proof methods
```
Do not hardcode all three methods as mandatory for every delivery.
# Photo Evidence
## 15. Camera
Photo proof requires mobile camera support.
## 16. Camera Permission
The app must request camera permission where required.
Permission denial must not:
```text
crash
or
falsely satisfy proof
```
## 17. Storage Permission
`Courier.md` explicitly requires:
```text
storage permissions
```
Handle storage/media permission according to the actual mobile implementation and operating-system version.
## 18. Photo Rules
The source does not define:
```text
photo count
image format
maximum file size
resolution
compression level
gallery selection
```
Open Decision.
## 19. Privacy
Avoid intentionally capturing unrelated private information beyond the delivery-evidence purpose.
# E-Signature
## 20. Signature Evidence
Signature evidence must be linked to the intended Order/task.
## 21. No Cross-Order Reuse
A signature from one delivery must not be reused as proof for another Order through client manipulation.
## 22. Signature Format
Possible implementations include:
```text
stroke/vector representation
rendered image
```
Exact format is Open.
# QR Verification
## 23. QR Validation
Backend validates:
```text
QR payload
+
Order
+
Courier authorization
+
proof policy
```
## 24. Wrong QR
QR for another Order:
```text
reject
→ no proof satisfaction
```
## 25. Invalid / Expired QR
If an expiry policy is implemented:
```text
invalid or expired token
→ reject
```
## 26. Replay Protection
If QR is one-time verification, replay protection is recommended.
Open Decision.
## 27. Waybill Boundary
The Logistics Waybill also uses QR/barcode identifiers.
Do not assume:
```text
delivery verification QR
=
Waybill QR
```
unless the architecture explicitly defines that mapping.
# Evidence Data Model
## 28. Proof Record
A dedicated evidence record is recommended.
Conceptual:
```text
proof_of_deliveries
```
## 29. Recommended Fields
```text
id
order_id
delivery_task_id
courier_id
proof_type
storage_reference
captured_at
uploaded_at
status
metadata
```
Exact schema is Open.
## 30. Permanent Order Link
Source requires:
```text
permanent data link
between media asset URL
and Order record
```
Therefore:
```text
Order
→ ProofOfDelivery
→ secure media/storage reference
```
must be durable.
## 31. Courier Link
Preserve which Courier captured/submitted the proof.
## 32. Delivery Task Link
If AISLEY uses a separate delivery-task model, linking evidence to:
```text
delivery_task_id
```
is recommended.
# Secure Cloud Storage
## 33. Source Requirement
Evidence media must use:
```text
secure cloud storage
```
with:
```text
AWS S3
```
given as an example.
## 34. Provider Boundary
AWS S3 is not a mandatory vendor selection.
AISLEY may use:
```text
AWS S3
S3-compatible object storage
another secure cloud object store
```
depending on architecture.
## 35. Private by Default
Evidence must not be unrestricted public media.
## 36. Recommended Access Pattern
```text
private object
→ backend authorization
→ temporary signed access
```
or equivalent.
## 37. Storage Reference
Prefer storing:
```text
object key / secure storage reference
```
rather than relying on a forever-public URL.
This still preserves the source-required durable Order-media relationship.
## 38. Cloud Credentials
Never embed privileged storage credentials in Flutter.
## 39. Media Retention
Exact media-retention duration is not defined.
Open Decision.
The logical evidence relationship should remain durable according to policy.
# Upload Lifecycle
## 40. Main Upload Sequence
```text
capture evidence
→ client validation
→ backend authorization
→ secure upload
→ storage confirmation
→ POD record
→ Order linkage
→ proof satisfied
```
## 41. Backend Authorization
Before evidence is accepted:
```text
Courier authenticated
+
task authorized
+
Order matches task
+
delivery proof-eligible
+
proof method permitted
```
## 42. Direct vs Proxied Upload
The source does not define whether Flutter uploads:
```text
through Laravel
```
or:
```text
directly to object storage
with short-lived upload authorization
```
Open Decision.
## 43. Partial Failure
Avoid:
```text
object exists
but no POD DB record
```
or:
```text
DB says proof exists
but object upload failed
```
## 44. Reconciliation
Because database and object storage normally do not share one ACID transaction, use cleanup/reconciliation for partial failures.
# Validation
## 45. File Validation
Media input is untrusted.
Validate configured:
```text
content type
file size
supported format
```
## 46. Filename
Do not use arbitrary user filenames as trusted storage paths.
## 47. Evidence Quality
The source does not define:
```text
blur detection
AI verification
face recognition
OCR
```
Do not make these mandatory.
## 48. Manual Review
Whether Logistics/Admin reviews POD evidence is Open.
# Proof Status
## 49. Status Model
Possible conceptual states:
```text
PENDING
UPLOADING
STORED
VERIFIED
FAILED
```
These are recommendations only.
## 50. Completion Eligibility
Backend determines whether:
```text
proof requirements satisfied
```
The Flutter button state is not authoritative.
# Complete Delivery Integration
## 51. Completion Owner
Complete Delivery owns:
```text
Order → DELIVERED
```
## 52. Recommended Enforcement
If e-POD is required:
```text
Complete Delivery
→ backend checks valid POD
→ then finalization allowed
```
## 53. Missing POD
If required proof is missing:
```text
block completion
→ return to e-POD
```
## 54. Post-Completion Mutation
Recommended:
```text
after DELIVERED
→ ordinary Courier cannot overwrite valid POD
```
Any correction process should preserve history.
# Delivery History / Disputes
## 55. Delivery History
Completed delivery detail may show:
```text
Proof of Delivery available
```
and link to authorized read-only evidence.
## 56. Dispute Purpose
e-POD supplies evidence for:
```text
delivery dispute review
```
## 57. No Dispute Decisioning
e-POD does not determine:
```text
refund
fault
compensation
sanction
```
# Incident / Chat Boundaries
## 58. Failed Delivery
If delivery cannot be completed because of:
```text
vehicle breakdown
accident
inaccessible address
```
use Incident Reporting where appropriate.
## 59. Chat Is Not POD
A Chat message saying:
```text
"parcel delivered"
```
is not automatically e-POD.
# Offline Mode
## 60. Offline Capture
Whether proof media can be captured offline is not explicitly defined by e-POD.
Open Decision.
## 61. Recommended Future Offline Model
If Offline Mode supports e-POD:
```text
capture locally
→ secure pending local evidence
→ reconnect
→ upload
→ validate
→ server POD created
```
## 62. Local vs Server Proof
Until sync succeeds:
```text
local evidence
≠ durable server e-POD
```
# API
## 63. Get POD Requirements
Conceptual:
```http
GET /api/courier/delivery-tasks/{taskId}/proof-of-delivery
```
## 64. Submit Photo
Possible:
```http
POST /api/courier/delivery-tasks/{taskId}/proof-of-delivery/photo
```
## 65. Submit Signature
Possible:
```http
POST /api/courier/delivery-tasks/{taskId}/proof-of-delivery/signature
```
## 66. Verify QR
Possible:
```http
POST /api/courier/delivery-tasks/{taskId}/proof-of-delivery/qr
```
## 67. Unified Endpoint
A unified endpoint is also valid:
```http
POST /api/courier/delivery-tasks/{taskId}/proof-of-delivery
```
Exact API shape is Open.
## 68. Evidence Detail
Conceptual:
```http
GET /api/courier/delivery-tasks/{taskId}/proof-of-delivery/{proofId}
```
with authorization-controlled media access.
# Authorization and Security
## 69. Bearer Authentication
Every e-POD endpoint requires valid Courier authentication.
## 70. Exact Role
Backend verifies:
```text
role = COURIER
```
## 71. Task Ownership
Courier may create proof only for their authorized delivery task.
## 72. Order Relationship
Proof must attach only to the Order belonging to that task.
## 73. IDOR
Knowing:
```text
order_id
task_id
proof_id
storage key
```
must not expose or alter another delivery's evidence.
## 74. Evidence Access
Evidence retrieval must be authorized.
## 75. No Public Enumeration
Storage references must not become public authorization tokens.
## 76. Token Protection
Never expose:
```text
Bearer token
cloud secret
storage credential
```
in media metadata or logs.
# Privacy
## 77. Sensitive Evidence
POD may include:
```text
recipient
home/building
signature
parcel label
access area
```
Treat it as sensitive.
## 78. Buyer Access
Whether Buyer may view POD is Open.
## 79. Seller Access
Whether Seller may view POD is Open.
## 80. Logistics / Admin Access
Operational/support access may be useful for disputes, but exact permissions are Open.
# Concurrency and Idempotency
## 81. Duplicate Upload
Retries/double taps must not create uncontrolled duplicate logical proofs.
## 82. Upload Idempotency
A client-generated request/upload key is recommended.
## 83. Completion Race
If POD upload and Complete Delivery happen nearly together:
```text
Complete Delivery
→ checks durable backend POD state
```
## 84. Storage Confirmation
Do not mark proof valid until the evidence object is confirmed stored.
# Error Handling
## 85. Permission Denied
```text
camera/storage permission denied
→ show clear state
→ no false proof success
```
## 86. Capture Failure
```text
capture fails
→ retry
→ no valid POD
```
## 87. Upload Failure
```text
upload fails
→ show retry/pending
→ no server-complete POD
```
## 88. QR Failure
```text
invalid/wrong QR
→ reject
→ no proof satisfaction
```
## 89. Storage Failure
```text
storage unavailable
→ no valid proof
→ retry/reconcile
```
## 90. Database Failure
If media uploads but DB persistence fails:
```text
cleanup/reconcile object
```
# Mobile UX
## 91. Entry Point
Recommended:
```text
Deliver Order
→ Proof of Delivery
```
at successful drop-off.
## 92. Screen
```text
Proof of Delivery
├── Delivery Reference
├── Required Evidence
├── Photo
├── E-Signature
├── QR Verification
└── Continue
```
Show only allowed methods.
## 93. Requirement Summary
Show:
```text
required
completed
remaining
```
proof where policy is configured.
## 94. Photo UX
Recommended:
```text
Take Delivery Photo
→ Preview
→ Retake / Use Photo
```
## 95. Signature UX
Recommended:
```text
Collect Signature
→ Review
→ Confirm
```
## 96. QR UX
Recommended:
```text
Scan Delivery QR
→ Valid / Invalid result
```
## 97. Upload Progress
Media upload should show progress/status.
## 98. Success
Only display:
```text
Proof of Delivery saved
```
after durable backend/storage confirmation.
## 99. Continue
Once requirements are satisfied:
```text
Continue to Complete Delivery
```
## 100. Accessibility
The Flutter UI should:
- label all proof controls
- expose status textually
- use adequate touch targets
- support screen readers
- not rely on image/color alone
- announce upload/validation errors
# Third-Party Dependencies
## 101. Secure Cloud Storage
A secure cloud/object-storage capability is source-required.
## 102. AWS S3
AWS S3 is a source example, not a required vendor.
## 103. Camera / QR
Flutter may use local camera/QR libraries.
## 104. Signature
Flutter may use a local signature-capture library.
## 105. Mapbox
Not required for e-POD.
## 106. Brevo
Not required.
## 107. SMS / Push
Not required.
# MVP Scope
## 108. Required
- authenticated Courier access
- exact Courier role authorization
- authorized active delivery
- proof requirement display
- photo evidence capability
- e-signature capability
- QR verification capability
- camera permission handling
- storage/media permission handling where required
- secure cloud/object storage
- durable evidence-to-Order linkage
- Courier/task linkage
- evidence validation
- secure evidence access
- upload/error/retry handling
- completion handoff
- IDOR protection
- privacy protection
## 109. Recommended
- dedicated POD table/model
- per-order proof policy
- private object storage
- temporary signed media access
- idempotent upload
- proof status
- preview/retake
- server timestamp
- post-completion read-only evidence
- storage/DB reconciliation
## 110. Not Required
- AWS S3 specifically
- all proof methods for every delivery
- AI image verification
- facial recognition
- OCR
- geofence proof
- public media URLs
- refund/dispute decisioning
- final `DELIVERED` mutation inside e-POD
- Mapbox
- Brevo
- SMS
- Push
# Acceptance Criteria
## 111. Access
- Missing/invalid token cannot create/read e-POD.
- Non-Courier token cannot use Courier e-POD.
- Same-email other-role account does not inherit access.
- Courier can submit proof only for their authorized task.
## 112. Photo
- Photo evidence can be captured where allowed/required.
- Permission denial is handled safely.
- Failed capture/upload does not create valid proof.
- Stored photo is securely linked to the Order.
## 113. Signature
- E-signature can be captured where allowed/required.
- Signature is tied to the correct Order/task.
- Cross-order signature reuse through client manipulation is rejected.
## 114. QR
- QR verification can be performed where allowed/required.
- Backend validates QR against the correct delivery.
- Wrong/invalid QR is rejected.
- QR validation does not expose unrelated Order data.
## 115. Storage
- Evidence is stored in secure cloud/object storage.
- AWS S3 is not hard-required unless selected.
- Evidence is private by default.
- Durable Order linkage exists.
- Cloud secrets are not embedded in Flutter.
- Partial failures are recoverable.
## 116. Completion
- e-POD itself does not set Order `DELIVERED`.
- Once required proof is durably satisfied, Complete Delivery can consume the proof result.
- If proof is mandatory, backend completion verifies it.
## 117. Security
- Order/task/proof/storage IDs cannot bypass authorization.
- Evidence access is authorized.
- Sensitive data exposure is minimized.
- Files are validated.
- Bearer/cloud secrets are protected.
# Tests
## 118. Backend Tests
Test:
- missing token denied
- invalid token denied
- Buyer/Seller/Logistics token denied
- authenticated Courier allowed
- same-email role isolation
- authorized task
- wrong Courier denied
- wrong Order denied
- photo proof
- signature proof
- QR proof
- wrong QR
- invalid QR
- proof policy enforcement
- secure storage reference
- private media access
- file validation
- upload failure
- DB failure after upload
- cleanup/reconciliation
- duplicate/idempotent upload
- correct Order/Courier/task links
- Complete Delivery POD check
- no token/cloud-secret leakage
## 119. Flutter Tests
Test:
- e-POD screen
- requirements display
- camera permission
- storage/media permission
- photo capture
- photo preview
- upload progress
- upload retry
- signature capture
- QR scanner
- valid QR
- invalid QR
- proof-complete state
- Continue to Complete Delivery
- network/storage failure
- screen-reader labels
- adequate touch targets
- textual status/error feedback
# Open Decisions
## 120. Open Decisions
The current sources do not define:
1. whether every delivery requires e-POD
2. proof method required per delivery
3. whether one or multiple methods are required
4. photo count
5. file formats/sizes
6. gallery selection
7. signer eligibility
8. signer name requirement
9. signature format
10. QR issuer/source
11. QR token format
12. QR expiry/replay protection
13. Waybill QR reuse
14. exact POD schema/statuses
15. cloud-storage provider
16. direct vs backend-proxy upload
17. media retention duration
18. evidence deletion/correction policy
19. who may view evidence after delivery
20. malware scanning
21. offline capture/sync
22. exact API routes
23. whether Complete Delivery always mandates valid POD
# Final Definition
## 121. Final Definition
AISLEY Proof of Delivery (e-POD) is:
```text
a strict digital delivery-evidence feature
```
supporting:
```text
photo
e-signature
QR verification
```
with:
```text
successful drop-off
→ evidence capture
→ validation
→ secure cloud/object storage
→ durable Order link
→ completion eligibility
```
Critical boundary:
```text
e-POD
= evidence

Complete Delivery
= Order → DELIVERED
```
Storage rule:
```text
secure cloud storage is required

AWS S3
= source example,
not mandatory vendor
```
Security rule:
```text
evidence must remain
authorized,
Order-linked,
and private by default.
```
