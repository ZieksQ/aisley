---
feature: Manage Complaints and Disputes
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Admin Web Application
source_coverage: Current AISLEY project requirements
---

# Complaints and Disputes Specification

## 1. Purpose

This document defines the **AISLEY Admin Complaints and Disputes** feature, corresponding to the Admin capability documented as **Manage Complaints and Disputes**.

The feature provides a centralized Admin resolution center for reviewing user-submitted reports and complaints, examining supporting text/media/document evidence, communicating with involved platform users, recording administrative actions, and issuing binding platform decisions.

This specification is grounded in the current AISLEY project documents:

- `app.md`
- `Admin.md`
- `Buyer.md`
- `Seller.md`
- `Logistics.md`
- `Courier.md`

The source documents explicitly establish that this feature:

- functions as a centralized resolution center
- functions as a ticketing system
- accepts user-submitted reports/complaints
- supports attached text/media/document evidence
- allows Admins to examine evidence
- allows Admins to make binding decisions
- resolves disputes between interacting parties on the platform
- requires secure evidence storage and retrieval
- requires an audit trail of Admin messages and actions
- can rely on platform messaging for communication
- may involve order, seller, logistics, courier, and delivery context depending on the dispute

Where the source documents do not define exact complaint categories, financial remedies, refund behavior, appeal processes, deadlines, priorities, assignment rules, or resolution enums, this specification identifies them as open decisions instead of silently inventing business rules.

---

# 2. Core Value

`Admin.md` defines:

```text
Manage Complaints and Disputes

Core Value:
Review reports/complaints and supporting evidence for violations.
```

The expanded definition establishes a centralized adjudication workflow:

```text
user submits report / complaint
        ↓
ticket / dispute case created
        ↓
Admin reviews report
        ↓
Admin reviews supporting evidence
        ↓
Admin reviews relevant platform context
        ↓
Admin may communicate with involved parties
        ↓
Admin makes binding decision
        ↓
case is resolved
        ↓
messages and Admin actions remain auditable
```

The feature exists to move a conflict from:

```text
reported problem
```

to:

```text
reviewed, documented, and administratively resolved case
```

---

# 3. Goals

The Complaints and Disputes feature must:

1. provide a centralized Admin queue of submitted complaints/reports
2. allow an authorized Admin to inspect a complaint in detail
3. identify the reporting party and other involved party/parties
4. associate a complaint with relevant platform entities where available
5. support secure text, image, and document evidence
6. allow the Admin to inspect evidence without exposing it publicly
7. preserve evidence relationships to the complaint
8. show relevant order, delivery, product, seller, or messaging context when already available in the system
9. allow Admin-to-user communication during investigation
10. preserve historical messages related to resolution
11. allow an authorized Admin to issue a binding resolution decision
12. record Admin actions and changes in the System Audit Log
13. support clear case lifecycle/status handling
14. prevent conflicting decisions from multiple Admins
15. expose unresolved workload to the Admin Dashboard
16. support search, filtering, sorting, and pagination
17. protect sensitive PII and evidence
18. keep Seller Compliance as a separate enforcement workflow while allowing a complaint to reference or trigger compliance review
19. keep Logistics/Courier operational incident handling separate while allowing relevant records to be used as dispute context
20. avoid implementing unsupported refund/payment remedies without a defined business rule

---

# 4. Non-Goals

This feature does not by itself define:

- refund policy
- refund calculation
- chargeback processing
- wallet credits
- compensation amounts
- replacement order logic
- return merchandise authorization
- return shipping
- automatic payment reversal
- payment gateway dispute handling
- seller payout holds
- Logistics compensation
- Courier penalties
- formal legal arbitration
- external court/legal processes
- exact complaint categories
- exact violation categories
- dispute SLA
- automatic case priority
- automatic case assignment
- appeal process
- case reopening rules
- Seller Compliance violation policy
- user account suspension policy
- Global Ban/Blocklist rules
- Buyer/Seller/Courier rating moderation
- automated fraud detection
- AI-generated decisions
- email notification requirements for complaint decisions
- SMS/push notification requirements for complaint decisions

These require separate feature specifications or product decisions.

---

# 5. Primary Actor

## 5.1 Admin

The Admin is the adjudicator.

Source-backed Admin responsibilities are:

```text
review user-submitted reports
review complaints
examine attached media evidence
examine attached text evidence
examine attached document evidence
communicate with users
make binding decisions
maintain accountable action/message history
```

Only an authenticated Admin with appropriate authorization may access private dispute data or issue a resolution.

---

# 6. Involved Platform Roles

The source says disputes occur:

```text
between interacting parties on the platform
```

AISLEY's user roles are:

```text
Admin
Buyer / Customer
Seller
Logistics
Courier / Rider
```

Therefore, a complaint case must be capable of referencing the platform actors involved in the underlying interaction.

The exact supported reporter/respondent combinations are not explicitly enumerated by the source documents.

The data model should not hardcode only:

```text
Buyer vs Seller
```

because AISLEY interactions also include:

```text
Buyer ↔ Courier
Seller ↔ Logistics
Logistics ↔ Courier
Buyer ↔ Logistics
Admin ↔ User
```

through order, delivery, and messaging workflows.

This does **not** mean every role must have a public complaint-submission interface in MVP. Submission surfaces must follow the actual application requirements.

---

# 7. Complaint vs Dispute

The current source documents use:

```text
reports
complaints
disputes
```

without defining separate formal schemas for each.

For this feature, they may be represented through one shared **Case/Ticket** abstraction.

Conceptually:

```text
Complaint / Report
    = submitted issue requiring Admin attention

Dispute
    = conflict between interacting parties requiring adjudication

Case / Ticket
    = system record through which Admin investigates and resolves it
```

If the repository already distinguishes complaints, reports, and disputes, reuse that structure.

Do not create duplicate parallel models without need.

---

# 8. Case Model

A complaint/dispute case should conceptually identify:

```text
case id
reporter
involved party/parties
subject / summary
description
linked platform entity/entities
evidence
status
created time
updated time
Admin review metadata
messages / communications
Admin actions
resolution decision
resolved time
resolved by
```

This is a logical feature model, not a mandatory database table name.

Possible implementation names include:

```text
complaints
disputes
support_cases
reports
tickets
```

Use repository conventions.

---

# 9. Case Sources

The source establishes:

```text
user-submitted reports
user-submitted complaints
```

Therefore, the system must be able to receive a complaint/report from a platform user where a submission surface exists.

Possible case origins may include:

```text
Buyer submission
Seller submission
Logistics submission
Courier-related support/report context
Admin-created/internal escalation
```

Only sources actually implemented by the project should be exposed.

The current docs do not define the exact complaint-submission UI for every role.

---

# 10. Recommended Case Status Model

The source requires a ticketing/resolution workflow but does not provide exact status names.

A minimal implementation needs deterministic lifecycle states.

Recommended:

```text
OPEN
IN_REVIEW
WAITING_FOR_INFORMATION
RESOLVED
CLOSED
```

These names are **recommended implementation states**, not explicit source terminology.

Possible semantics:

```text
OPEN
    submitted and awaiting Admin review

IN_REVIEW
    Admin is actively investigating

WAITING_FOR_INFORMATION
    Admin requested information/evidence from a party

RESOLVED
    Admin issued a binding decision

CLOSED
    case requires no further operational action
```

If the repository already defines ticket states, reuse them.

---

# 11. State Transition Principles

Recommended baseline:

```text
OPEN
  ↓
IN_REVIEW
  ├──────────────→ WAITING_FOR_INFORMATION
  │                         │
  │                         └────→ IN_REVIEW
  │
  └──────────────→ RESOLVED
                              ↓
                            CLOSED
```

The source does not define:

- whether `RESOLVED` and `CLOSED` should be distinct
- whether cases can reopen
- whether reporter can withdraw a case
- whether Admin can dismiss a case

Therefore, exact transition rules should align with future product decisions.

A simpler repository model may use:

```text
OPEN
RESOLVED
```

without violating the source.

---

# 12. Complaint Submission Data

The current source documents require:

```text
report / complaint
supporting evidence
```

Recommended minimum complaint payload:

```text
reporter identity
subject/title
description
related entity reference when applicable
submitted timestamp
evidence attachments when provided
```

Do not require invented fields such as:

- legal declaration
- monetary demand
- violation category
- severity
- desired compensation
- sworn affidavit

unless separately specified.

---

# 13. Complaint Subject / Description

A complaint should include enough text for an Admin to understand the issue.

Recommended:

```text
subject
description
```

The description is user-generated content and must be:

- validated for length
- safely stored
- safely escaped/rendered
- protected from script injection

Exact length limits are not specified by the source documents.

---

# 14. Linked Platform Context

A complaint may concern an existing AISLEY entity.

Useful links may include:

```text
order
product
seller/shop
delivery task
courier
logistics organization
message thread
review
incident
```

Only link entities that genuinely exist and are relevant.

The system should prefer stable internal identifiers rather than relying on free-form text.

---

# 15. Order-Related Disputes

AISLEY's documented order flow is:

```text
customer order
    ↓
seller approved
    ↓
seller packed
    ↓
logistics flow
    ↓
order delivered
```

The Logistics flow includes:

```text
courier door-to-door pickup
    ↓
transfer / dispatch flow
    ↓
delivery courier assignment
    ↓
delivery
```

An order-related dispute should be able to reference the authoritative Order record and relevant lifecycle state.

The dispute module must not create its own competing order status.

---

# 16. Order Timeline Context

Where order history/state events exist, the Admin case view should expose relevant context such as:

```text
order created
seller processing
seller packed
pickup
sorting / transfer / dispatch
out for delivery
delivered
```

Exact event/status names must come from the application's canonical order state machine.

Do not fabricate missing tracking events.

---

# 17. Buyer Order Cancellation Context

`Buyer.md` defines Order Modification/Cancellation as allowed only within a strict pre-processing window.

If a complaint concerns:

```text
failed cancellation
incorrect modification
order changed after allowed window
```

the Admin should be able to inspect:

```text
order state
relevant timestamps
modification/cancellation history, if tracked
```

The Complaints module must not independently redefine the cancellation window.

---

# 18. Seller Context

Where a dispute concerns a Seller, the Admin may need:

```text
seller identity
shop identity
related product
related order
relevant seller messages
relevant seller actions already recorded by the system
```

The case view should avoid exposing unrelated private Seller data.

Seller-specific operational analytics and inventory management remain in the Seller application.

---

# 19. Product Context

If a complaint concerns a product:

```text
product id
product/listing details
seller/shop
related order
relevant review
```

may be shown.

The exact Product DTO must come from the existing Product domain.

If a product has been altered since the complaint was filed, the source documents do not explicitly require immutable product snapshots.

Preserving report-time context is recommended when the system supports it.

---

# 20. Logistics Context

Logistics manages shipment operations and order status updates.

For delivery-related disputes, relevant context may include:

```text
Logistics organization
waybill
order status
sorting/transfer/dispatch events
assigned Courier
messages tied to active order
```

The Complaints module should consume existing logistics records rather than mutate dispatch state directly.

---

# 21. Courier Context

`Courier.md` contains several dispute-relevant records:

```text
Delivery History
Proof of Delivery (e-POD)
Incident Reporting
Chat/Messaging
delivery task state
```

These can provide important evidence/context for an Admin dispute.

---

# 22. Proof of Delivery (e-POD)

`Courier.md` explicitly states that Proof of Delivery exists to:

```text
prevent delivery disputes
```

and can include:

```text
photos of delivered parcel
e-signatures
QR scans
```

The evidence is linked permanently to the Order record.

Therefore, when a complaint concerns delivery completion, the Admin case view should be able to securely retrieve relevant e-POD evidence through the authoritative delivery/order relationship.

The Complaints module must not duplicate or alter e-POD records.

---

# 23. Courier Delivery History

Courier Delivery History is explicitly described as usable for:

```text
dispute resolution
```

When relevant, Admin may inspect the historical delivery task associated with the dispute.

This view must remain read-only from the complaint context unless a separate operational workflow authorizes changes.

---

# 24. Courier Incident Reports

Courier Incident Reporting records blockers such as:

```text
vehicle breakdown
accident
inaccessible delivery address
```

and links them to an active delivery task.

If a complaint concerns a delayed or failed delivery, an associated Incident record may be relevant evidence/context.

The complaint case should reference the incident rather than replacing the Logistics incident workflow.

---

# 25. Messaging Context

AISLEY contains messaging across multiple role interactions:

```text
Buyer ↔ Seller
Logistics ↔ Courier
Logistics ↔ Buyer
Logistics ↔ Seller
Courier ↔ Buyer / Seller / Logistics
Admin ↔ Users
```

Messages may contain relevant dispute context.

Access to message history must follow authorized Admin support/dispute access rules.

The system should avoid exposing unrelated conversations.

---

# 26. Admin Messaging Integration

`Admin.md` defines Chat/Messaging as:

```text
a direct, secure communication channel
bridging administration and users
```

with:

```text
read receipts
historical archiving
```

The complaint/dispute case should integrate with this capability.

Recommended case actions:

```text
Message Reporter
Message Involved Party
Open Related Thread
Request Additional Information
```

Exact UI depends on the messaging implementation.

---

# 27. Case-Linked Communication

Communication used to resolve a dispute should be attributable to the case.

Recommended relationship:

```text
case
    ↓
linked Admin/user message thread(s)
```

or:

```text
case_id on support/dispute messages
```

The repository's messaging schema should determine the actual approach.

The goal is to allow the Admin and future auditors to understand which communication belongs to the case.

---

# 28. Evidence Types

`Admin.md` explicitly specifies:

```text
images
documents
text evidence
```

Therefore, the evidence model must support:

```text
TEXT
IMAGE
DOCUMENT
```

Additional formats should only be accepted if the platform explicitly supports them.

Video is not explicitly mentioned for dispute evidence in `Admin.md`, although Buyer reviews can upload video.

Do not automatically require video evidence support in this feature.

---

# 29. Text Evidence

Text evidence may include:

```text
user explanation
message excerpt/reference
written statement
additional factual context
```

Prefer storing original text or references to authoritative message records.

Do not allow Admins to silently rewrite user-submitted evidence.

---

# 30. Image Evidence

Image evidence may include:

```text
uploaded complaint image
proof-of-delivery image
product image/context
other supported case image
```

Images must be retrieved through protected access.

Do not expose private evidence through unrestricted public storage URLs.

---

# 31. Document Evidence

Documents may be attached when supported by the case-submission interface.

Requirements:

- validate allowed types
- validate upload size
- store securely
- authorize every retrieval
- prevent executable content from being treated as trusted
- retain metadata required for the case

Exact MIME/type/size limits are not defined by the source documents.

---

# 32. Evidence Storage

`Admin.md` explicitly requires:

```text
secure storage and retrieval for evidence files
```

Therefore:

```text
evidence files
    must not be anonymously/publicly enumerable
```

Recommended storage patterns include:

```text
private object storage
signed/temporary download URLs
authenticated streaming endpoint
```

The exact storage provider is not specified.

---

# 33. Evidence Authorization

An evidence file request must validate:

```text
authenticated user
authorization to access the case
evidence belongs to the case or an authorized linked record
```

A user must not be able to retrieve another complaint's evidence by guessing an ID or URL.

---

# 34. Evidence Metadata

Recommended metadata:

```text
evidence id
case id
uploader / source actor
evidence type
original filename for documents
storage reference
created timestamp
content type
```

Optional:

```text
size
checksum
```

if useful for integrity.

Do not store raw binary evidence in Admin audit payloads.

---

# 35. Evidence Integrity

Because evidence informs binding decisions, the system should preserve the original submitted evidence.

Recommended behavior:

```text
submitted evidence
    → immutable content reference during the case
```

If evidence must be deleted for legal/security reasons, such behavior requires separate policy.

The current source does not define evidence editing/deletion rules.

---

# 36. Evidence Upload Failure

If complaint creation and evidence upload are combined, the system must avoid creating misleading state where:

```text
UI says evidence attached
but file was never persisted
```

The implementation should clearly indicate upload status/failure.

Exact transactional strategy depends on storage architecture.

---

# 37. Evidence Preview

The Admin detail view should safely preview supported evidence where practical:

```text
images → protected preview
documents → metadata + protected open/download action
text → inline
```

Never execute active document content inside the Admin application.

---

# 38. Evidence from Existing Platform Records

Not every piece of evidence needs to be copied into the complaint.

Examples:

```text
e-POD
order timeline
messages
incident records
reviews
```

should preferably be referenced through authoritative records.

This preserves a single source of truth.

---

# 39. Review / Investigation Workflow

Recommended source-compatible workflow:

```text
Admin opens case
        ↓
reviews reporter statement
        ↓
reviews linked order/product/delivery context
        ↓
reviews attached evidence
        ↓
reviews relevant messages/history
        ↓
requests more information if needed
        ↓
receives/reviews additional context
        ↓
records decision
        ↓
case resolved
```

Not every case requires every step.

---

# 40. Binding Decision

`Admin.md` explicitly states that Admins can:

```text
make binding decisions to resolve disputes
```

A resolution record must therefore identify:

```text
decision
resolved_by
resolved_at
```

and should preserve:

```text
resolution explanation / Admin decision note
```

The exact decision taxonomy is not defined by the source.

---

# 41. Resolution Decision vs Financial Remedy

The source supports a binding administrative decision but does **not** define automatic financial actions.

Therefore:

```text
Resolve case
```

must not silently imply:

```text
refund Buyer
charge Seller
withhold payout
credit wallet
reverse payment
```

unless those actions are separately defined and authorized.

The case may record a decision and link to another owning workflow if a future refund/remedy system is introduced.

---

# 42. Resolution Outcome Model

The source does not define exact outcomes.

Recommended architecture:

```text
resolution:
    decision text / structured type if defined
    explanation
    Admin actor
    timestamp
    related enforcement/action references
```

If the product later defines formal outcome types, they can be added.

Avoid inventing semantics such as:

```text
BUYER_WINS
SELLER_WINS
50_50
REFUND_FULL
REFUND_PARTIAL
```

without requirements.

---

# 43. Resolution Explanation

A binding decision should have a durable explanation sufficient for accountability.

Recommended:

```text
Admin resolution summary
```

It may be:

- internal only
- user-visible
- split into internal and user-visible text

The source does not define visibility rules.

If both are implemented, they must be clearly separated.

---

# 44. User Notification of Resolution

The source requires Admin-user communication but does not explicitly require email, SMS, or push for dispute resolution.

Minimum source-compatible behavior:

```text
affected users can be informed through Admin messaging
```

A future Admin Notifications specification may define additional channels.

Do not assume Brevo email is mandatory for dispute decisions.

---

# 45. Request Additional Information

Because Admin must examine supporting evidence, some cases may require additional information.

Recommended action:

```text
Request Information
```

Flow:

```text
Admin sends case-linked message
        ↓
case optionally enters WAITING_FOR_INFORMATION
        ↓
user provides response/evidence through supported mechanism
        ↓
Admin resumes review
```

The exact status is recommended, not source-mandated.

---

# 46. Case Timeline

A dispute case should present a chronological timeline sufficient to reconstruct the resolution process.

Possible entries:

```text
case submitted
evidence added
Admin opened/reviewed case
Admin requested information
message sent/received
case status changed
Seller Compliance referral created
Admin decision recorded
case resolved
```

Use only events the system actually tracks.

---

# 47. Admin Action Audit Trail

`Admin.md` requires:

```text
an audit trail of messages and actions taken by the administrator
during the resolution process
```

This is stronger than merely recording the final decision.

Relevant Admin actions should be traceable.

---

# 48. System Audit Logs Integration

`Admin.md` separately defines System Audit Logs as:

```text
an immutable, time-stamped ledger
recording every administrative operation
who performed it
what data was altered
when it occurred
```

Complaints and Disputes must integrate with this platform-wide audit system.

Examples:

```text
case status changed
Admin requested information
Admin linked/unlinked case context
Admin issued resolution
Admin referred case to Seller Compliance
Admin accessed protected evidence, if access auditing is required
```

Exact audit event names should follow repository conventions.

---

# 49. Message History Accountability

`Admin.md` requires Admin messaging to support:

```text
read receipts
historical archiving
```

Case-linked Admin communication should therefore remain historically retrievable according to messaging retention policy.

Messages should not disappear merely because the complaint is resolved.

---

# 50. Seller Compliance Integration

Seller Compliance and Complaints/Disputes are related but distinct.

Complaints/Disputes owns:

```text
conflict/ticket
user report
evidence
investigation
binding dispute resolution
```

Seller Compliance owns:

```text
seller/product policy enforcement
formal warnings
seller suspension
product removal
```

A complaint may reveal a seller-policy violation.

Recommended integration:

```text
Complaint / Dispute
        ↓
Admin identifies seller compliance issue
        ↓
Create or link Seller Compliance case
        ↓
Seller Compliance performs enforcement
        ↓
Complaint retains reference to compliance action/case
```

Do not duplicate seller suspension/product-removal logic inside the dispute module.

---

# 51. Seller Compliance Referral

Recommended Admin action when appropriate:

```text
Refer to Seller Compliance
```

The referral should preserve:

```text
originating complaint id
seller
product if applicable
relevant evidence references
Admin actor
timestamp
```

Only data the receiving module is authorized to access should be linked.

---

# 52. Complaint Resolution with Compliance Action

A complaint may be resolved after or alongside a compliance action.

Example:

```text
Buyer complaint
    ↓
Admin verifies seller-policy violation
    ↓
Seller Compliance case created
    ↓
product removed / seller warned
    ↓
Complaint records final resolution
```

The complaint's state and compliance case's state remain separate.

---

# 53. Manage User Accounts Integration

A dispute may identify an account issue requiring:

```text
temporary suspension
restoration/access action
deactivation
```

Those actions belong to Manage User Accounts unless a specific domain feature owns them.

The complaint case may link to the account-management action.

Do not implement a separate hidden user-status system inside Complaints.

---

# 54. Global Ban / Blocklist Integration

A serious dispute may potentially expose fraudulent behavior, but Global Ban/Blocklist is its own documented Admin module.

The complaint system must not automatically blacklist:

```text
user
IP
payment method
```

without explicit rules and authorization.

A future integration may allow:

```text
refer to security/blocklist review
```

if specified.

---

# 55. Reviews and Ratings Context

Buyer Reviews & Ratings are limited to verified purchases and may contain:

```text
rating
text
photos/videos
```

A review may provide useful context for a dispute.

However:

```text
negative review
    ≠
formal complaint automatically
```

and:

```text
complaint resolution
    ≠
automatic review deletion
```

unless a separate moderation policy requires it.

---

# 56. Buyer-Seller Chat Context

Buyer-Seller chat supports:

```text
pre-purchase questions
post-purchase support
minor issue resolution
```

A dispute may arise after minor issue resolution fails.

Where relevant and authorized, Admin may inspect the linked conversation.

The system should scope access to the relevant thread rather than expose all user chats indiscriminately.

---

# 57. Logistics Messaging Context

Logistics may communicate with:

```text
Courier
Buyer
Seller
```

on active orders.

If a dispute concerns pickup/delivery delays or address clarification, order-linked Logistics messages may be relevant context.

Again, only relevant threads should be exposed.

---

# 58. Courier Messaging Context

Courier chat exists for:

```text
address clarifications
gate codes
delivery delays
```

and is linked to active delivery activity.

For a delivery dispute, case review may expose those relevant messages.

Phone numbers or direct contact information should remain protected where the messaging system uses masked communication.

---

# 59. Dashboard Integration

The Admin Dashboard specification includes:

```text
Open Complaints / Disputes
```

as a KPI/actionable workload.

Dashboard count must use the same authoritative unresolved case scope as this feature.

Conceptually:

```text
Dashboard
Open Complaints / Disputes: N
        ↓
click
        ↓
/complaints-disputes
        ↓
filtered to unresolved/actionable cases
```

The counts must reconcile.

---

# 60. Recommended Admin Route

Recommended route:

```text
/complaints-disputes
```

Alternative:

```text
/disputes
/support/cases
/reports
```

Exact route naming should follow repository conventions.

Navigation label should align with:

```text
Manage Complaints and Disputes
```

---

# 61. Case Queue Page

Recommended layout:

```text
Complaints & Disputes

[Open] [In Review] [Waiting] [Resolved]

Search ______________________

Filters:
Status
Reporter Role
Related Entity / Context
Date

---------------------------------------------------------------
Case       Reporter        Subject         Status      Submitted
---------------------------------------------------------------
...
```

This is an information structure, not a pixel-perfect design mandate.

---

# 62. Default Queue View

The default view should prioritize unresolved workload.

Conceptually:

```text
OPEN
IN_REVIEW
WAITING_FOR_INFORMATION
```

Resolved/closed cases should remain available for authorized historical review.

---

# 63. Queue Summary Fields

Recommended minimum row fields:

```text
case id/reference
reporter display identity
reporter role
subject/summary
status
submitted timestamp
last updated timestamp
```

Optional where useful:

```text
related order id
related seller/shop
assigned Admin
```

Do not overload the queue with full evidence or sensitive details.

---

# 64. Search

The queue should support server-side search over fields that actually exist.

Recommended possible fields:

```text
case/reference id
reporter name
reporter email
related order/reference id
seller/shop name
product identifier/title
Courier/delivery reference where applicable
```

Exact searchable fields depend on existing schemas.

---

# 65. Filters

Useful source-compatible filters:

```text
status
reporter role
date range
related entity/context
```

Possible context filters:

```text
ORDER
PRODUCT
SELLER
DELIVERY
OTHER
```

only if the product formally defines them.

Do not invent complaint categories/severity filters without requirements.

---

# 66. Sorting

Recommended default:

```text
newest submitted first
```

or the Admin application's standard support-queue convention.

The source does not define SLA or urgency.

Do not create arbitrary "critical" rankings unless a priority model is specified.

---

# 67. Pagination

The case queue must be paginated or cursor-based.

Do not load all complaint records into the browser.

Conceptual request:

```http
GET /api/admin/complaints?status=OPEN&page=1
```

Exact API naming should follow repository conventions.

---

# 68. Case Detail Route

Recommended:

```text
/complaints-disputes/{caseId}
```

The case detail is the primary adjudication workspace.

---

# 69. Case Detail Information Architecture

Recommended sections:

```text
Case Header
Reporter
Involved Parties
Complaint / Statement
Linked Platform Context
Evidence
Related Messages
Investigation Timeline
Admin Notes / Resolution Work
Related Compliance / Account Actions
Decision
Audit / Activity History
```

Only sections relevant to the specific case should render.

---

# 70. Case Header

Recommended:

```text
Case reference
Status
Submitted date/time
Last updated
Reporter role
Linked order/entity reference if applicable
```

If case assignment is implemented:

```text
Assigned Admin
```

may also appear.

Assignment is not source-required.

---

# 71. Reporter Identity

The Admin needs sufficient information to understand who submitted the complaint.

Expose only necessary identity/profile fields.

Recommended:

```text
user id
display name
role
email/contact only if operationally required
```

Avoid unrelated sensitive PII.

---

# 72. Involved Parties

A case may reference one or more other platform users/entities.

Recommended representation:

```text
Party
Role
Relationship to case
Relevant linked entity
```

Examples:

```text
Seller of disputed product
Courier assigned to disputed delivery
Logistics provider handling disputed shipment
Buyer who placed disputed order
```

These relationships should derive from authoritative system records.

---

# 73. Case Assignment

The source does not define Admin case assignment.

If multiple Admins will process complaints, assignment can help coordination.

Recommended optional fields:

```text
assigned_admin_id
assigned_at
```

But MVP may work without assignment if the team uses status-based queue management.

Do not make assignment mandatory unless the product decides it.

---

# 74. Admin Internal Notes

The source requires an audit trail of actions and messages but does not explicitly define private notes.

If internal notes are implemented, they should be clearly labeled:

```text
INTERNAL — NOT VISIBLE TO USERS
```

They should never be mixed with user-facing Admin messages.

---

# 75. User-Visible Admin Messages

Messages sent to a party should use the Admin messaging architecture and clearly identify:

```text
official platform communication
```

The complaint UI should not create a separate unaudited ad-hoc text channel.

---

# 76. Resolution Action

The case detail should provide an authorized action such as:

```text
Resolve Case
```

The action should require deliberate confirmation.

Recommended flow:

```text
Admin selects Resolve
        ↓
enters/selects resolution information supported by product rules
        ↓
reviews decision
        ↓
confirms
        ↓
backend validates state + permission
        ↓
resolution committed
        ↓
audit event recorded
        ↓
case updates
```

---

# 77. Resolution Confirmation

Because the decision is binding, confirmation should show:

```text
case reference
involved parties
resolution summary
consequences/actions being triggered, if any
```

Do not hide consequential side effects behind a generic confirmation.

---

# 78. Resolution Backend Rules

Backend must validate:

```text
requester is authenticated Admin
Admin has permission
case exists
case is in a resolvable state
referenced entities exist if required
resolution payload is valid
```

Then persist the decision atomically as appropriate.

---

# 79. Resolution Immutability / Changes

The source calls decisions binding but does not define whether Admins may later edit them.

Recommended safety principle:

```text
do not silently overwrite a finalized resolution
```

If a decision must be corrected later, preserve history.

A future appeal/reopen workflow should define formal changes.

---

# 80. Case Closure

If the system distinguishes `RESOLVED` from `CLOSED`:

```text
RESOLVED
    decision issued

CLOSED
    no further platform follow-up remains
```

This separation is optional and not source-mandated.

---

# 81. Concurrent Admin Review

Multiple Admins may open the same case.

The backend must prevent stale conflicting final decisions.

Example:

```text
Admin A opens IN_REVIEW case
Admin B opens same case

Admin A resolves case

Admin B attempts another final resolution
    ↓
backend sees finalized/new version
    ↓
reject stale mutation
    ↓
Admin B refreshes current state
```

Use row locking, optimistic versioning, or status checks consistent with the repository.

---

# 82. Idempotency

Repeated submissions caused by:

```text
double click
network retry
timeout
```

must not create duplicate final decisions, messages, or side effects where preventable.

Resolution mutations should use current-state validation and transactional behavior.

---

# 83. Recommended API — List Cases

Conceptual:

```http
GET /api/admin/complaints
```

Possible query parameters:

```text
status
reporter_role
search
related_type
from
to
page
per_page
sort
```

Response:

```text
paginated case summaries
pagination metadata
available filter metadata if needed
```

Exact conventions should follow the repository.

---

# 84. Recommended API — Case Detail

Conceptual:

```http
GET /api/admin/complaints/{caseId}
```

Requirements:

- Admin authentication
- permission enforcement
- case summary
- reporter
- involved party references
- linked platform context
- evidence metadata/access paths
- messages or message references
- current status
- resolution data
- relevant case timeline

Do not return unrelated sensitive data.

---

# 85. Recommended API — Update Review Status

Conceptual:

```http
PATCH /api/admin/complaints/{caseId}
```

or command-style endpoints such as:

```http
POST /api/admin/complaints/{caseId}/start-review
POST /api/admin/complaints/{caseId}/request-information
```

Exact approach should follow project architecture.

---

# 86. Recommended API — Add Evidence

If users/Admins are allowed to submit additional evidence through the case workflow:

```http
POST /api/complaints/{caseId}/evidence
```

or role/domain equivalent.

Requirements:

- authenticated authorized actor
- validate case participation/permission
- validate upload
- secure storage
- associate evidence with case
- record source/uploader
- update case activity history

The exact submission roles are not defined by the current source.

---

# 87. Recommended API — Resolve

Conceptual:

```http
POST /api/admin/complaints/{caseId}/resolve
```

Payload should contain only resolution fields actually defined by the product.

Backend:

```text
authorize
validate case state
validate resolution
commit decision
set resolved_by
set resolved_at
record audit event
dispatch/link user communication if required
return updated case
```

---

# 88. Recommended API — Seller Compliance Referral

Conceptual:

```http
POST /api/admin/complaints/{caseId}/refer-to-compliance
```

This endpoint is optional.

Backend should:

```text
authorize
validate case
resolve/link Seller and Product
create or link compliance case
store cross-reference
audit referral
```

Do not duplicate evidence files when references are sufficient and authorized.

---

# 89. Recommended API — Evidence Access

Conceptual:

```http
GET /api/admin/complaints/{caseId}/evidence/{evidenceId}
```

or a signed URL flow.

Must validate:

```text
Admin authentication
case access
evidence-case relationship
```

before returning access.

---

# 90. Recommended Case Summary DTO

Conceptual only:

```json
{
  "id": "case-id",
  "reference": "CASE-...",
  "subject": "Complaint summary",
  "status": "OPEN",
  "reporter": {
    "id": "user-id",
    "name": "User Name",
    "role": "BUYER"
  },
  "related": {
    "type": "ORDER",
    "id": "order-id"
  },
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

Use actual repository naming.

---

# 91. Recommended Case Detail DTO

Conceptual only:

```json
{
  "id": "case-id",
  "reference": "CASE-...",
  "subject": "Complaint summary",
  "description": "...",
  "status": "IN_REVIEW",
  "reporter": {
    "id": "user-id",
    "name": "User Name",
    "role": "BUYER"
  },
  "parties": [],
  "related_entities": [],
  "evidence": [],
  "message_threads": [],
  "resolution": null,
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

Do not force fields unsupported by the data model.

---

# 92. Evidence DTO

Conceptual:

```json
{
  "id": "evidence-id",
  "type": "IMAGE",
  "filename": "photo.jpg",
  "content_type": "image/jpeg",
  "created_at": "timestamp",
  "source": {
    "actor_type": "BUYER",
    "actor_id": "..."
  },
  "access": {
    "mode": "protected"
  }
}
```

Do not expose raw private storage credentials.

---

# 93. Resolution DTO

Conceptual:

```json
{
  "resolved_at": "timestamp",
  "resolved_by": {
    "id": "admin-id",
    "name": "Admin Name"
  },
  "summary": "Administrative decision"
}
```

Structured remedy fields should only be added once formally defined.

---

# 94. Frontend Queue States

The queue must support:

```text
loading
loaded with unresolved cases
loaded with no cases
filtered no results
search no results
error
unauthenticated
forbidden
```

---

# 95. Frontend Case States

The detail page must support:

```text
loading
open
in review
waiting for information
resolved
closed
not found
stale/conflict
error
forbidden
```

Only states actually implemented should appear.

---

# 96. Loading Behavior

While loading:

- Admin shell remains visible
- use skeletons/loading indicators
- do not render stale evidence from another case
- disable resolution controls
- do not fabricate case values

---

# 97. Empty Queue

Example:

```text
No open complaints or disputes.
```

This is a valid operational state.

---

# 98. Filtered Empty State

Example:

```text
No cases match the selected filters.
```

---

# 99. Evidence Empty State

Example:

```text
No supporting files were attached to this case.
```

Text complaint content may still exist.

---

# 100. Message Empty State

Example:

```text
No Admin messages have been sent for this case.
```

---

# 101. Error Handling

Handle at minimum:

- case list load failure
- case detail load failure
- missing related entity
- missing/deleted evidence reference
- protected evidence access failure
- upload failure
- message send failure
- stale/conflicting resolution
- expired Admin session
- insufficient permission
- resolution mutation failure

The UI must never claim a case is resolved unless the backend confirms it.

---

# 102. Partial Context Failure

A case can involve several linked services.

Example:

```text
case loads
order context loads
message service temporarily fails
```

Where architecture permits, show available case/order evidence while clearly indicating the failed message region.

One non-critical sub-resource should not necessarily make the full case unreadable.

---

# 103. Security Requirements

Complaint/dispute endpoints must:

- require authentication
- enforce Admin authorization for Admin case access
- enforce participant authorization for user-side case interactions
- validate case-resource relationships
- validate evidence ownership/association
- prevent IDOR attacks
- protect private evidence
- sanitize user-generated text
- limit file types/sizes
- protect against executable uploads
- avoid exposing password hashes
- avoid exposing session identifiers/tokens
- minimize PII
- use CSRF protection for state-changing web requests
- preserve auditable Admin actions
- prevent unauthorized resolution mutations
- validate linked Order/Seller/Courier/Logistics records
- prevent client-supplied actor identity spoofing

---

# 104. PII Minimization

`Admin.md` requires secure handling of user metadata.

The complaint UI should expose only case-relevant PII.

Examples of usually unnecessary data:

```text
password/security fields
full payment credentials
unrelated addresses
unrelated private conversations
unrelated identity documents
```

If sensitive data is required for a particular case, access should be specifically authorized and auditable where appropriate.

---

# 105. Evidence Privacy

Evidence may contain highly sensitive user content.

Evidence must not:

- be indexed publicly
- appear in public marketplace pages
- use permanent unauthenticated URLs
- be returned in unrelated API responses
- be exposed to unrelated dispute parties by default

User-to-user evidence visibility rules are not defined by the source and require a product decision.

---

# 106. File Upload Validation

For directly uploaded evidence, validate:

```text
maximum file size
allowed MIME types
extension/content consistency where possible
malware/security scanning if available
number of files if limited
```

Exact limits are open decisions.

---

# 107. Audit Logging

At minimum, source-backed Admin resolution activity should be auditable.

Recommended events:

```text
COMPLAINT_REVIEW_STARTED
COMPLAINT_STATUS_CHANGED
COMPLAINT_INFORMATION_REQUESTED
COMPLAINT_RESOLVED
COMPLAINT_CLOSED
COMPLAINT_REFERRED_TO_SELLER_COMPLIANCE
COMPLAINT_RELATED_ACTION_LINKED
```

Names are illustrative.

The audit system should record:

```text
Admin actor
case
action
changed state/data
timestamp
```

---

# 108. Audit Log vs Case Timeline

These serve related but different purposes.

```text
Case Timeline
    operational history visible in the dispute workspace

System Audit Log
    immutable administrative accountability record
```

A single underlying event may feed both.

Do not rely only on mutable case notes as the security audit trail.

---

# 109. Performance Requirements

The queue should support:

- indexed status/date filters
- indexed case reference lookup
- paginated results
- bounded evidence metadata
- bounded message/timeline loading
- efficient Dashboard unresolved-count query

Heavy evidence binaries should not be embedded directly into the main case-list response.

---

# 110. Evidence Loading Performance

Load:

```text
evidence metadata first
```

and retrieve full files/previews only when needed.

Large documents must not block rendering of basic case information.

---

# 111. Message History Pagination

If case-related messages become large, messaging history should use the messaging system's pagination/cursor design.

Do not return an unbounded lifetime conversation in the initial case payload.

---

# 112. Case Timeline Pagination

Long-running cases may accumulate many events.

If needed, paginate older case activity.

The source does not define limits.

---

# 113. Data Consistency

The complaint case should reference authoritative source records.

Example:

```text
Order amount/status
    comes from Orders domain

Product seller
    comes from Product/Seller domain

Delivery completion
    comes from Logistics/Courier/Order domain

e-POD
    comes from delivery evidence

messages
    come from Messaging domain

seller sanctions
    come from Seller Compliance/User Account domain
```

Do not duplicate mutable business state unnecessarily.

---

# 114. Historical Integrity

Resolving a complaint must not delete historical business records merely to make the issue disappear.

Examples that should remain referentially valid:

```text
order
delivery history
proof of delivery
messages
product reference/history
audit record
resolution
```

Retention/deletion policy is a separate requirement.

---

# 115. Order State Mutation Boundary

Complaints/Disputes must not directly advance Logistics/order statuses as part of normal adjudication.

Operational state changes belong to their owning domains.

If a future binding decision needs an order remedy, it should call a defined domain action rather than editing status fields arbitrarily.

---

# 116. Financial Mutation Boundary

Complaints/Disputes must not directly alter:

```text
transaction totals
commission calculations
shipping fees
seller balances
courier earnings
```

without a separately defined financial remedy/refund process.

This prevents dispute code from becoming an unreviewed payment engine.

---

# 117. Seller Enforcement Boundary

Complaints may prove a seller violation.

Actual enforcement actions such as:

```text
formal warning
seller suspension
product removal
```

belong to Seller Compliance.

The dispute case can link to the enforcement result.

---

# 118. Courier Incident Boundary

Courier incident handling is owned by Courier/Logistics operations.

The dispute case may inspect the Incident record but should not rewrite operational incident state solely to resolve a complaint.

---

# 119. Proof-of-Delivery Boundary

e-POD is authoritative delivery evidence.

The complaint system may:

```text
view/reference it
```

but must not:

```text
edit it
replace it
silently delete it
```

through normal dispute adjudication.

---

# 120. Review/Rating Boundary

A complaint may reference a Buyer review.

The resolution does not automatically alter the review unless a separate review moderation rule exists.

---

# 121. Admin Permission Model

AISLEY intends to support Admins with custom permissions.

Complaints/Disputes must be permission-aware.

Conceptual capabilities:

```text
view complaint queue
view complaint detail
view protected evidence
send case-linked Admin message
change review status
resolve dispute
refer to Seller Compliance
view historical resolved cases
```

Exact permission keys are not defined.

Use the shared Admin authorization model.

---

# 122. High-Impact Permission

Issuing a binding final decision is more consequential than merely viewing a case.

The authorization model should be capable of distinguishing:

```text
view
investigate
resolve
```

if the project implements granular permissions.

Do not hardcode this if the shared permission model uses a different structure.

---

# 123. Responsive Behavior

The feature is primarily an Admin web workflow.

Desktop should optimize for:

```text
queue + rich case detail + evidence review
```

On smaller screens:

- queue rows may become cards
- evidence previews must fit viewport
- action buttons remain reachable
- party/context sections stack
- long IDs/text wrap safely
- no critical action should be hidden by horizontal overflow

---

# 124. Accessibility

The interface should:

- use semantic headings
- expose status as text, not color only
- label evidence controls
- support keyboard navigation
- provide accessible modal/dialog focus
- announce upload/action success/failure
- provide meaningful labels for image/document evidence
- maintain contrast
- ensure resolution confirmation is keyboard accessible

---

# 125. Notifications

The Admin Dashboard can surface new/open complaint workload.

A broader Admin Notifications feature may later notify Admins when:

```text
new complaint submitted
new evidence added
user replied
case requires attention
```

Exact events and transport are not defined by current docs.

This feature should expose domain events cleanly enough for that system to subscribe later.

---

# 126. User Notifications

The source supports Admin messaging but does not define notification-channel requirements.

Case changes may be communicated through the platform messaging system.

Email/push/SMS should not be treated as mandatory until separately specified.

---

# 127. Case Reference

A human-readable case reference is recommended for support conversations.

Example concept:

```text
CASE-XXXX
```

Exact format is not source-defined.

The database must still use its authoritative primary identifier.

---

# 128. Timestamps

Recommended timestamps:

```text
created_at
updated_at
resolved_at
closed_at if used
```

Case timeline should use the application's canonical timezone strategy.

Do not create complaint-specific timezone rules.

---

# 129. Soft Delete / Retention

The source requires auditability and evidence history.

Therefore, hard-deleting resolved cases through normal Admin UI is not recommended.

Exact legal/data-retention policy is not defined.

For MVP, resolved cases should remain retrievable by authorized Admins.

---

# 130. User Case History

Whether users can view all of their past complaint cases is not explicitly defined.

A user-facing ticket/history interface may be useful but is outside the Admin feature requirement unless separately specified.

---

# 131. Duplicate Complaints

The source does not define duplicate detection or merging.

For MVP:

```text
do not automatically merge complaints
```

unless an explicit mechanism exists.

Admins may link related cases later if a product requirement is added.

---

# 132. Case Merge

Case merge is not source-defined and is not required for MVP.

---

# 133. Case Escalation

No escalation hierarchy is defined.

Do not invent:

```text
Level 1
Level 2
Supervisor
Legal escalation
```

unless an Admin organizational model is later specified.

---

# 134. SLA

No dispute-resolution time SLA is defined.

Do not display:

```text
overdue
SLA breach
resolution countdown
```

until product rules define them.

---

# 135. Priority / Severity

No priority/severity framework is defined.

Do not assign arbitrary:

```text
LOW
MEDIUM
HIGH
CRITICAL
```

based on keywords or role.

If priority becomes necessary, define it separately.

---

# 136. Appeal / Reopen

No appeal or reopen workflow is defined.

A binding Admin decision should be treated as final for MVP unless a future specification introduces review/reopen rights.

If correction is necessary administratively, preserve original decision history rather than silently replacing it.

---

# 137. Financial Remedy Future Integration

If AISLEY later adds refund/dispute financial remedies, the architecture should integrate through a dedicated service.

Conceptually:

```text
Complaint Decision
        ↓
authorized remedy command
        ↓
Payments / Transactions domain
        ↓
immutable financial record
        ↓
case stores reference
```

Do not embed payment logic directly in complaint controllers.

---

# 138. Admin Dashboard Count Definition

The Dashboard KPI should count:

```text
complaint/dispute cases that are not final/closed
```

Exact included statuses must match the case model.

Example with recommended states:

```text
OPEN
IN_REVIEW
WAITING_FOR_INFORMATION
```

Exclude:

```text
RESOLVED
CLOSED
```

unless the Dashboard intentionally shows another period metric.

---

# 139. Action Center Integration

Dashboard Action Center may preview recent actionable complaints.

Each preview should link to the full case.

Do not resolve cases inline from the Dashboard in MVP.

The dedicated case view provides the evidence/context required for a binding decision.

---

# 140. Search Privacy

Search endpoints must not become a way to enumerate all users' private complaint data.

Results must be scoped to authorized Admin access and return only summary information needed for the queue.

---

# 141. Evidence Download Auditing

The source does not explicitly require logging evidence downloads/views.

Because evidence can be sensitive, audit of access may be considered later.

Do not mark it as mandatory unless the security policy defines it.

---

# 142. Case Participant Verification

A user-side evidence/message submission must not trust client-supplied `user_id`.

The authenticated identity must determine the actor.

If only participants are allowed to contribute, the backend must validate participation in the case.

---

# 143. Related Entity Verification

If a user submits:

```text
order_id
product_id
delivery_id
```

the backend should validate that the entity is legitimately related to the reporter where required.

A Buyer should not be able to attach arbitrary private orders to a complaint by guessing IDs.

Exact authorization differs by entity.

---

# 144. Evidence File Naming

Do not expose raw filesystem paths.

Original filename may be shown safely for documents, but storage keys should be generated and non-sensitive.

---

# 145. Virus/Malware Protection

Because documents can be uploaded, security scanning is recommended when infrastructure permits.

The source only mandates secure storage/retrieval, not a specific malware scanner.

This remains an implementation security decision.

---

# 146. Image Metadata Privacy

Uploaded images may contain metadata such as EXIF/geolocation.

The source does not define metadata stripping requirements.

This should be addressed by the platform's file-upload privacy policy if needed.

---

# 147. Rate Limiting

User complaint submission should be protected from abuse through the platform's standard rate-limiting/security controls.

Exact rate limits are not defined.

Admin adjudication endpoints should also follow normal authenticated request protections.

---

# 148. Logging

Application logs must not contain:

```text
raw private evidence
passwords
auth tokens
sensitive document contents
```

Log identifiers/errors rather than sensitive payloads.

---

# 149. Observability

Operational telemetry may track:

```text
case endpoint errors
evidence upload/storage failures
message delivery failures
resolution mutation failures
```

Do not include sensitive case contents in generic telemetry.

---

# 150. MVP Scope

## Required for MVP

- authenticated Admin-only complaint/dispute management
- complaint/report case record
- user-submitted complaint text
- support for attached image evidence
- support for attached document evidence
- secure evidence storage/retrieval
- complaint queue
- unresolved default view
- search
- basic filtering
- pagination
- case detail
- reporter identity/context
- involved party/context
- linked Order/Product/Seller/Logistics/Courier context where available
- e-POD reference in delivery disputes where applicable
- incident/delivery-history context where applicable
- Admin messaging integration
- case-linked message/history visibility
- case status lifecycle
- binding Admin resolution
- resolution actor/timestamp
- case timeline/activity
- Admin action audit logging
- concurrency protection
- Dashboard unresolved-count integration
- Seller Compliance referral/link
- loading states
- empty states
- error states
- permission-aware access

## Not Required for MVP

- refunds
- partial refunds
- payment reversals
- wallet credits
- return shipping workflow
- replacement order workflow
- chargeback handling
- payout hold
- automatic seller penalties
- automatic Courier penalties
- SLA
- severity scoring
- priority ranking
- AI triage
- AI decisioning
- automatic case assignment
- case merging
- appeals
- reopen workflow
- public evidence sharing
- email/SMS decision notification
- formal legal arbitration
- cross-platform external dispute integration

---

# 151. Functional Acceptance Criteria

## AC-01 — Admin Access

Given an authenticated authorized Admin, when the Admin opens Manage Complaints and Disputes, the Admin can access the complaint queue.

## AC-02 — Guest Denied

Given no valid Admin session exists, complaint queue/detail/evidence Admin endpoints are not accessible.

## AC-03 — Unauthorized Admin Denied

Given an authenticated Admin lacks the required permission, the backend denies protected complaint data/actions according to the shared Admin authorization model.

## AC-04 — Complaint Creation

Given an authorized platform complaint submission flow exists, when a user submits a valid complaint, a case/ticket is created with the authenticated reporter identity and submitted content.

## AC-05 — Reporter Cannot Be Spoofed

Given a complaint submission request includes a different client-supplied user identifier, the backend uses the authenticated user's identity rather than trusting the spoofed actor ID.

## AC-06 — Evidence Attachment

Given the submission flow supports evidence, a valid image/document can be securely associated with the complaint.

## AC-07 — Protected Evidence

Given a private evidence file exists, an unauthorized user cannot retrieve it using a guessed evidence ID or storage URL.

## AC-08 — Admin Evidence Review

Given an authorized Admin opens a complaint, the Admin can securely view/download evidence supported by the platform.

## AC-09 — Text Evidence

Given a user submits text evidence, the Admin can review the original stored content safely.

## AC-10 — Queue

Given unresolved complaint cases exist, they appear in the Admin complaint queue according to the selected filters.

## AC-11 — Pagination

Given many complaint cases exist, the queue returns bounded paginated/cursor results.

## AC-12 — Search

Given a case matches a supported searchable field, an Admin can locate it through server-side search.

## AC-13 — Case Context

Given a complaint is linked to an Order/Product/Seller/Delivery entity, the case can display authorized context derived from the authoritative domain record.

## AC-14 — Order State Source of Truth

Given a complaint references an order, the complaint system does not maintain a competing order lifecycle state.

## AC-15 — e-POD Context

Given a delivery complaint relates to an order with proof-of-delivery evidence, an authorized Admin can inspect/reference the e-POD through secure access.

## AC-16 — e-POD Integrity

Given e-POD is referenced in a dispute, the complaint workflow does not silently edit or replace the original proof-of-delivery record.

## AC-17 — Courier History Context

Given a disputed delivery has Courier delivery history, the Admin can use the relevant history as read-only dispute context.

## AC-18 — Incident Context

Given a disputed delivery has a Courier Incident record, the Admin can inspect the relevant incident context without replacing the Logistics incident workflow.

## AC-19 — Relevant Messaging

Given a dispute has a related platform message thread and Admin is authorized, relevant conversation history can be referenced or viewed without exposing unrelated chats.

## AC-20 — Admin Communication

Given an Admin needs more information, the Admin can communicate with the relevant user through the Admin messaging architecture.

## AC-21 — Message History

Given Admin/user messages are exchanged for a case, historical messaging remains available according to the messaging archive design.

## AC-22 — Resolution

Given an authorized Admin has reviewed a resolvable case, the Admin can issue a binding resolution decision.

## AC-23 — Resolution Metadata

Given a case is resolved, the system records the resolution, resolving Admin, and resolution timestamp.

## AC-24 — Resolution Audit

Given an Admin resolves a case, the System Audit Log receives the corresponding administrative action.

## AC-25 — Ongoing Action Audit

Given an Admin performs resolution-related actions, those actions are traceable through case activity and/or the immutable Admin audit mechanism as required.

## AC-26 — No Automatic Refund

Given an Admin resolves a complaint, the system does not automatically issue a refund/payment reversal unless a separately defined financial remedy feature authorizes it.

## AC-27 — Seller Compliance Referral

Given a complaint reveals a possible seller/product policy violation, an authorized Admin can link/refer the matter to Seller Compliance where integration is implemented.

## AC-28 — Separate Compliance State

Given a complaint is linked to a Seller Compliance case, resolving one case does not silently overwrite the state of the other module.

## AC-29 — Seller Enforcement Ownership

Given a complaint requires a seller warning/suspension/product removal, the enforcement uses the Seller Compliance/shared account service rather than an independent complaint-only sanction field.

## AC-30 — Dashboard Count

Given unresolved complaints exist, the Admin Dashboard open-complaint count reconciles with the unresolved scope of this feature.

## AC-31 — Dashboard Drill-Down

Given the Dashboard shows open complaints, selecting the complaint KPI/action routes the Admin to the unresolved complaint queue.

## AC-32 — Concurrent Resolution Protection

Given two Admins open the same unresolved case and one resolves it first, the second stale resolution cannot silently overwrite the first.

## AC-33 — No False Success

Given a resolution mutation fails, the frontend does not display the case as successfully resolved.

## AC-34 — Secure Related Entity

Given a complaint references another user's Order/entity without authorization, the backend does not expose that private entity merely because its ID was supplied.

## AC-35 — PII Minimization

Given the Admin opens a complaint, APIs return case-relevant user information without exposing password hashes, session secrets, or unrelated private data.

## AC-36 — Historical Integrity

Given a complaint is resolved, linked historical order/delivery/message/evidence/audit records remain referentially intact.

## AC-37 — No Order Mutation

Given Admin resolves a complaint, the complaint system does not arbitrarily edit Logistics/order statuses outside defined domain actions.

## AC-38 — No Financial Mutation

Given Admin resolves a complaint, the complaint system does not directly alter commission, transaction totals, shipping fees, seller balances, or Courier earnings without a defined financial workflow.

## AC-39 — Evidence List Performance

Given a case has evidence, the primary case response may return evidence metadata without loading all binary evidence content into the response.

## AC-40 — Empty Queue

Given no unresolved complaints exist, the Admin sees a valid empty state rather than an error.

## AC-41 — Missing Evidence Handling

Given a referenced evidence object is unavailable, the case remains readable and clearly indicates the evidence retrieval problem without fabricating content.

## AC-42 — Protected Final Decision

Given an Admin can view cases but lacks resolution authority, manually sending a resolve request is rejected by the backend.

## AC-43 — User Content Safety

Given a complaint contains user-generated HTML/script-like content, the Admin UI renders it safely rather than executing it.

## AC-44 — Resolved History

Given a case has been resolved, an authorized Admin can retrieve its historical decision and relevant activity for accountability.

---

# 152. Suggested Backend Tests

Test:

- guest cannot list Admin complaints
- guest cannot open Admin complaint detail
- non-Admin cannot access Admin complaint endpoints
- permission-restricted Admin cannot resolve case
- complaint submission uses authenticated reporter
- reporter actor ID cannot be spoofed
- complaint text is persisted safely
- valid image evidence can be attached
- valid document evidence can be attached
- unauthorized evidence access is denied
- evidence must belong to requested/authorized case
- Admin can access authorized evidence
- queue is paginated
- queue filters unresolved state
- search works for supported fields
- related Order access validates relationship/authorization
- related Product/Seller context resolves correctly
- e-POD can be referenced securely
- e-POD is not modified by complaint workflow
- Courier Incident can be referenced
- Courier Delivery History can be referenced
- relevant message thread can be linked
- unrelated private message thread cannot be exposed
- Admin can update review status
- Admin can request information through messaging integration
- Admin can resolve eligible case
- resolution records `resolved_by`
- resolution records `resolved_at`
- resolution creates audit entry
- seller-compliance referral creates/link appropriate reference
- complaint resolution does not directly suspend Seller outside compliance/account service
- complaint resolution does not automatically issue refund
- complaint resolution does not arbitrarily mutate Order status
- complaint resolution does not mutate commission values
- stale concurrent resolution is rejected
- duplicate resolution submission does not create duplicate side effects
- resolved case remains historically accessible
- Dashboard unresolved count matches case query
- user-generated content is escaped/sanitized appropriately
- private evidence storage identifiers are not public credentials

---

# 153. Suggested Frontend Tests

Where frontend testing infrastructure exists, test:

- complaint queue renders loading state
- complaint queue renders results
- complaint queue renders empty state
- status filter updates query
- reporter-role filter updates query if implemented
- search updates query
- pagination works
- case detail renders complaint text
- case detail renders reporter/involved parties
- related Order context renders when available
- e-POD evidence is shown through protected access
- evidence failure shows a clear local error
- message history/reference renders when available
- Admin can open/send case-related message through messaging integration
- resolve control respects permissions
- resolve action requires deliberate confirmation
- failed resolution does not show success
- successful resolution updates case state
- stale conflict causes refresh/current-state feedback
- Seller Compliance referral renders/link updates when supported
- private evidence is not embedded as a permanent public URL
- long complaint/evidence filenames do not break layout
- narrow viewport remains usable
- user-generated text does not execute markup/scripts

---

# 154. Open Decisions

The current source documents do not define:

1. exact complaint submission pages for each role
2. which roles may submit formal complaints
3. which role pairs may be formal dispute parties
4. exact complaint categories
5. exact dispute categories
6. exact violation categories
7. case priority
8. case severity
9. case SLA
10. response deadlines
11. Admin assignment rules
12. auto-assignment
13. supervisor/escalation hierarchy
14. whether users may withdraw complaints
15. whether Admin may dismiss complaints without a formal decision
16. whether `RESOLVED` and `CLOSED` are distinct
17. whether cases can be reopened
18. appeal workflow
19. appeal eligibility
20. appeal deadline
21. whether a second Admin must review certain decisions
22. exact resolution decision types
23. whether resolution requires structured reason codes
24. whether the resolution explanation is user-visible
25. whether separate internal/public resolution notes are required
26. refund eligibility
27. full-refund rules
28. partial-refund rules
29. return requirements
30. replacement order rules
31. seller payout holds
32. Logistics compensation rules
33. Courier penalty rules
34. whether dispute resolution can cancel an order
35. financial ledger behavior after a dispute
36. payment-gateway dispute integration
37. chargeback behavior
38. maximum text length
39. maximum number of evidence files
40. evidence maximum file size
41. exact allowed image types
42. exact allowed document types
43. whether video evidence is supported
44. evidence retention duration
45. whether users may delete submitted evidence
46. whether users may add evidence after submission
47. whether Admins may upload evidence
48. whether evidence views/downloads are audited
49. virus-scanning provider
50. EXIF/location metadata stripping
51. whether product/listing snapshots are stored at report time
52. whether message snapshots or only references are used
53. exact case reference format
54. whether duplicate complaints can be merged
55. case merge behavior
56. whether related cases can be linked
57. case ownership/assignment fields
58. exact Admin permission keys
59. exact API route names
60. exact notification events
61. whether complaint decisions trigger email
62. whether complaint decisions trigger push/SMS
63. user-facing case history
64. whether users can see Admin internal timeline events
65. whether involved parties can see each other's evidence
66. whether anonymous reporting exists
67. whether complaint submission is rate-limited differently by role
68. exact audit event taxonomy
69. data retention/deletion policy
70. whether resolved complaint data can ever be hard-deleted

These decisions should be specified before implementation treats them as required business rules.

---

# 155. Source Traceability

## From `Admin.md`

This feature directly derives:

```text
Manage Complaints and Disputes

Core Value:
Review reports/complaints and supporting evidence for violations.

Expanded:
centralized resolution center
adjudicating conflicts
ticketing system
user-submitted reports
attached media evidence
attached text evidence
binding Admin decisions
disputes between interacting parties

System:
secure evidence file storage
secure evidence retrieval
images/documents
audit trail of messages
audit trail of Admin actions
```

It also integrates with:

```text
Dashboard
Monitor Seller Compliance
Manage User Accounts
Chat/Messaging
System Audit Logs
Global Ban/Blocklist Management
```

without duplicating their business logic.

## From `app.md`

The dispute system respects the shared AISLEY platform structure:

```text
Buyer
Seller
Logistics
Courier
Admin
```

and the integrated order lifecycle:

```text
customer order
→ seller approved
→ seller packed
→ Logistics
→ delivered
```

as well as the Logistics transfer/dispatch workflow.

The complaint module uses these records as context rather than defining a competing order system.

## From `Buyer.md`

Dispute-relevant Buyer context includes:

```text
View Orders' Status
Buyer ↔ Seller Chat/Messaging
Product Reviews & Ratings
Order Modification/Cancellation
```

Important constraints:

```text
reviews are tied to verified purchases
order cancellation/modification is gated by order state/time
```

The complaint system must inspect these authoritative records rather than redefine them.

## From `Seller.md`

Dispute-relevant Seller context includes:

```text
Order Notifications / order detail
Confirm Delivery visibility
Buyer ↔ Seller Chat/Messaging
Review Management
Seller product/catalog data
```

The complaint system does not replace Seller operations.

## From `Logistics.md`

Dispute-relevant Logistics context includes:

```text
order lifecycle/status
Logistics ↔ Courier / Buyer / Seller messaging
waybill/order references
dispatch context
```

The complaint system may review relevant logistics records but must not become the dispatch console.

## From `Courier.md`

Courier provides especially important dispute evidence/context:

```text
Delivery History
Chat/Messaging
Proof of Delivery (e-POD)
Incident Reporting
delivery task/order state
```

`Courier.md` explicitly describes:

```text
Delivery History
    usable for dispute resolution

Proof of Delivery
    designed to prevent delivery disputes
```

Therefore, these records are first-class contextual inputs for delivery-related Admin disputes.

---

# 156. Final Feature Definition

AISLEY Manage Complaints and Disputes is:

```text
an Admin-only
centralized ticketing and adjudication system

that receives:

    user reports
    complaints
    dispute statements

and allows Admins to review:

    text evidence
    image evidence
    document evidence
    order context
    product/seller context
    delivery history
    proof of delivery
    Courier incidents
    relevant message history

then:

    communicate with involved users
    request additional information when needed
    make a binding platform decision
    preserve the decision
    preserve messages/actions
    write administrative audit records

while integrating with:

    Admin Dashboard
    Seller Compliance
    Manage User Accounts
    Admin Messaging
    System Audit Logs

and while keeping:

    payment/refund rules
    Seller sanctions
    Logistics operations
    Courier operations
    order state mutation

inside their authoritative domains
unless separately specified.
```

The central design principle is:

```text
A dispute decision must be explainable from the case record.

An authorized Admin should be able to answer:

    who reported the issue?
    who was involved?
    what platform transaction/event is relevant?
    what evidence was submitted?
    what did the parties communicate?
    what did the Admin do?
    what decision was made?
    when was it made?
    who made it?

without relying on undocumented or unaudited side effects.
```
