---
feature: Monitor Seller Compliance
system: AISLEY
type: Feature Specification
version: 2.0
status: Draft
scope: Admin Web Application / Seller Moderation and Product Compliance
source_coverage: Admin.md, Seller.md, app.md, current AISLEY Admin feature boundaries
---

# Monitor Seller Compliance Specification

## 1. Purpose

Monitor Seller Compliance is AISLEY's Admin moderation feature for auditing Seller activity and product listings against platform policies.
`Admin.md` defines:

```text
Core Value:
Verify products, issue warning/suspension for violation.

Expanded Definition:
A moderation and compliance engine
focused on the supply side of the platform.

Administrators audit seller activities
and product listings against platform policies.

The system includes tools to:
- issue formal warnings
- temporarily suspend seller privileges
- permanently remove non-compliant product listings

System Context:
Requires an internal reporting/flagging mechanism,
integration with the messaging system for warnings,
and cascading database updates
such as hiding a seller's products
when their account is suspended.
```

This specification defines requirements, boundaries, moderation actions, data expectations, APIs, security rules, acceptance criteria, tests, and Open Decisions.
The review/action sequence belongs in `flow.md`.

## 2. Primary Actor

The primary actor is:

```text
ADMIN
```

Only authenticated and authorized Admins may review Seller compliance issues or apply compliance actions.

## 3. Subject

The subject of this feature is:

```text
SELLER
```

and the Seller's:

```text
product listings
```

The feature does not moderate Buyer, Logistics, Courier, or Admin behavior except where a separate feature owns that responsibility.

## 4. Core Responsibilities

Monitor Seller Compliance owns:

- Seller compliance case/review records
- product verification/review
- internal reports/flags
- Seller activity review
- formal warning actions
- temporary Seller privilege suspension
- permanent removal of non-compliant product listings
- cascading listing visibility changes after Seller compliance suspension
- compliance history
- Admin Chat/Messaging warning integration
- System Audit Log integration
- search/filter/pagination
- safe reason/evidence references
  It does not own:
- user registration approval
- general account suspension
- Global Ban
- complaint/dispute resolution
- Seller Vacation Mode
- order cancellation/refunds
- financial reversal
- Buyer moderation
- Logistics/Courier discipline
- automatic fraud scoring
- marketplace policy authoring

## 5. Seller Identity

AISLEY uses:

```text
unique(email, role)
```

A Seller compliance action must target:

```text
Seller user_id
```

or an equivalent stable Seller/account ID.
Do not target by email alone.

## 6. Same Email Across Roles

Example:

```text
alex@example.com + BUYER
alex@example.com + SELLER
```

A compliance action against the Seller:

```text
must not change the Buyer role-account
```

merely because the email matches.

## 7. Seller-Shop Relationship

`app.md` states:

```text
one seller account one shop
```

Therefore compliance views may include the Seller's shop context.
The Seller account remains the stable identity for account-level compliance actions.

## 8. Product Verification

The source explicitly requires:

```text
verify products
```

The Admin must be able to inspect product/listing information relevant to policy compliance.
Exact product-verification criteria are not defined in the source.

## 9. Policy Source

Compliance is against:

```text
platform policies
```

Manage Platform Settings owns policy content/versioning.
Seller Compliance consumes those policies.
Do not hardcode a second independent set of policy definitions inside compliance logic.

## 10. Internal Reporting / Flagging

`Admin.md` requires:

```text
internal reporting/flagging mechanism
```

The system must support a compliance item being raised for Admin attention.
Possible sources may include:

- user report
- complaint handoff
- internal Admin observation
- system-generated flag if added later
  Exact flag sources are Open Decisions.

## 11. Compliance Case

A stable compliance record is recommended.
Conceptual:

```text
compliance_case_id
seller_user_id
product_id if applicable
source/reference
status
finding
action
created_at
reviewed_at
reviewed_by_admin_id
```

Exact schema is Open.

## 12. Case Status

The source does not define exact compliance-case status names.
Do not treat invented statuses as authoritative.
The implementation only needs to represent the logical stages:

```text
flagged / pending review
reviewed
actioned or resolved
```

Exact enum is Open.

## 13. No Strike System Assumption

The source does not define:

```text
strike counts
three-strike policy
point scoring
automatic suspension threshold
warning escalation thresholds
```

Do not implement these without explicit policy.

## 14. No Automatic Suspension Threshold

A report count must not automatically suspend a Seller unless future policy explicitly defines that rule.

## 15. No Automatic Product Removal Threshold

Likewise, repeated reports must not automatically remove a listing without explicit moderation rules.

# Compliance Actions

## 16. Source-Backed Actions

The authoritative moderation actions are:

```text
FORMAL WARNING
TEMPORARY SELLER SUSPENSION
PERMANENT PRODUCT LISTING REMOVAL
```

A fourth outcome is logically necessary:

```text
NO VIOLATION / RESOLVED WITHOUT SANCTION
```

to close false/invalid flags without punishment.

## 17. Warning

A formal warning:

- records an Admin compliance action
- should include a reason/finding
- should be communicated to the Seller
- does not automatically suspend the Seller
- does not automatically remove listings

## 18. Warning Messaging

`Admin.md` explicitly requires messaging integration for warnings.
Recommended:

```text
compliance case
→ Message Seller
→ Admin Chat thread
→ warning/explanation
→ message/thread reference linked to case
```

The compliance action remains authoritative in the compliance record.

## 19. Warning Read Receipt

Admin Chat owns read-receipt behavior.
Seller Compliance may reference whether the warning message was delivered/read if available.
Do not duplicate messaging receipt state.

## 20. Temporary Seller Suspension

A compliance suspension restricts Seller privileges because of policy violation.
This is distinct from:

```text
Manage User Accounts suspension
```

and:

```text
Global Ban
```

## 21. Compliance Suspension Scope

`Admin.md` gives an example:

```text
hiding a seller's products when their account is suspended
```

Therefore compliance suspension should cascade into Seller listing visibility/access as required.
Exact privilege matrix is Open.

## 22. Listing Visibility on Seller Suspension

At minimum, Seller products should no longer be visible/available as normal active marketplace listings while the compliance suspension is active.
Recommended:

```text
Seller Compliance Suspension
→ Seller products excluded from buyer discovery/search
→ checkout validation blocks new purchases
```

Exact implementation depends on catalog architecture.

## 23. Product Data Preservation

Suspension should:

```text
hide/restrict
```

rather than destructively delete all Seller products.
Seller product records/history should remain available for Admin review and potential restoration.

## 24. Existing Orders

Compliance suspension must not automatically:

- cancel already-placed orders
- issue refunds
- change delivered status
- rewrite shipment records
  Existing-order handling requires explicit order policy.

## 25. Existing Seller Operations

Whether a suspended Seller may:

- fulfill existing paid orders
- message Buyers
- access financial history
- access support
  is not defined.
  Open Decision.

## 26. Permanent Product Removal

The source explicitly allows:

```text
permanently remove non-compliant product listings
```

This action targets a specific listing/product.

## 27. Product Removal Scope

Permanent product removal should:

- prevent the removed listing from normal buyer discovery
- prevent new checkout for that listing
- preserve moderation history
- preserve historical order references

## 28. Product Removal Does Not Delete Seller

Removing one product must not automatically:

- suspend the Seller
- deactivate the Seller
- globally ban the Seller
- remove all other products
  unless an explicit separate action is taken.

## 29. Product Record Retention

Recommended:

```text
moderation removal
≠
hard database deletion
```

Preserve enough record/history for:

- past orders
- complaint evidence
- Audit Logs
- compliance history

## 30. No Violation / Resolve

If Admin determines no violation:

```text
close/resolve the compliance item
without sanction
```

No Seller or product restriction should be applied.

# Vacation Mode Boundary

## 31. Seller Vacation Mode

`Seller.md` defines:

```text
Vacation Mode
```

as a Seller-controlled feature.
It:

- temporarily pauses new orders
- hides shop listings
- disables checkout for the Seller's items
- uses `is_on_vacation`

## 32. Compliance Suspension vs Vacation Mode

Critical boundary:

```text
Vacation Mode
    Seller chooses temporary unavailability

Compliance Suspension
    Admin imposes moderation restriction
```

These states must remain independent.

## 33. Vacation Mode Must Not Clear Compliance

If:

```text
Seller Compliance = SUSPENDED
Vacation Mode = ON
```

turning Vacation Mode off must not restore compliance-restricted listings.

## 34. Compliance Restore Must Not Toggle Vacation

If compliance suspension ends while:

```text
Vacation Mode = ON
```

the Seller's listings should remain hidden according to Vacation Mode.

## 35. Effective Listing Visibility

Conceptually:

```text
listing visible
only when:
    listing itself is active
    seller not compliance-suspended
    seller not on vacation
    product not compliance-removed
    other catalog rules permit visibility
```

Exact query implementation belongs to catalog/search architecture.

# Manage User Accounts Boundary

## 36. Independent Account Suspension

Manage User Accounts may suspend a Seller account for lifecycle reasons.
Seller Compliance may independently suspend Seller privileges for compliance reasons.
One state must not overwrite the other.

## 37. Restore Independence

If:

```text
Manage User Accounts = SUSPENDED
Seller Compliance = SUSPENDED
```

removing the compliance suspension:

```text
Seller Compliance → clear
Manage User Accounts → remains SUSPENDED
```

The Seller remains restricted.

## 38. Account Deactivation

Seller Compliance must not reactivate/deactivate a user account directly.
That belongs to Manage User Accounts.

# Global Ban Boundary

## 39. Global Ban

Global Ban is a separate security restriction.
A compliance violation may justify a separate explicit Global Ban action, but:

```text
compliance suspension
≠
global ban
```

## 40. Unban Independence

Removing a Global Ban does not clear Seller Compliance restrictions.

## 41. Compliance-to-Ban Handoff

Recommended:

```text
Compliance case
→ Admin explicitly selects Global Ban action
→ separate authorization/confirmation
→ Global Ban feature creates block
```

No silent auto-ban.

# Complaints Boundary

## 42. Complaint Handoff

A complaint involving a Seller may generate/reference a compliance case.
Recommended:

```text
Complaint case
→ explicit Seller Compliance handoff
→ compliance review
```

Complaint decision and compliance action remain separate records.

## 43. Evidence Reference

Where a complaint already contains evidence:

```text
reference complaint/evidence IDs
```

rather than duplicating sensitive files unnecessarily.

# Product Verification

## 44. Product Detail Review

Recommended Admin view includes:

- product ID
- product name
- Seller/shop
- current listing status
- product description
- category
- images
- price
- relevant policy/version reference if available
- report/flag history
- prior compliance actions
  Only fields available in actual product schema are required.

## 45. Product Editing Boundary

Seller Compliance should not become a general product editor.
Admin may:

```text
remove/restrict a non-compliant listing
```

Seller owns normal product editing.

## 46. Product Verification Result

Possible moderation outcome:

```text
verified / no violation
warning
product removed
Seller suspended
```

Exact case outcome enum is Open.

# Seller Activity Review

## 47. Seller Activity

`Admin.md` says Admins:

```text
audit seller activities and product listings
```

The exact activity history to display is not defined.
Recommended bounded references may include:

- product changes
- complaints
- previous compliance actions
- order/fulfillment summary
- account status
  Avoid loading all Seller data at once.

## 48. History

Compliance history should preserve:

- flags/reports
- findings
- warnings
- suspensions
- product removals
- Admin actors
- timestamps
- related message references

## 49. Historical Integrity

Do not erase prior compliance actions when a new case is resolved.

# Admin Queue

## 50. Compliance Queue

Recommended columns:

```text
Case / Flag ID
Seller
Product if applicable
Source
Status
Created At
Last Activity
```

## 51. Default View

Recommended:

```text
items requiring Admin review
```

Exact status filter depends on final case-state design.

## 52. Search

Recommended:

```text
Seller name
Seller email
Seller user ID
shop name
product name
product ID
case/flag ID
```

If searching by email, display role.

## 53. Filters

Possible:

```text
case status
action/outcome
date
Seller
product
source
```

Exact filters are Open.

## 54. Pagination

The compliance queue must be paginated/bounded.

## 55. Detail View

Recommended sections:

```text
Case Summary
Seller / Shop
Product
Source / Report
Evidence References
Seller Activity
Previous Compliance Actions
Admin Finding
Moderation Action
Messages
Audit History
```

# API

## 56. Recommended API

Conceptual:

```http
GET  /api/admin/seller-compliance
GET  /api/admin/seller-compliance/{caseId}
POST /api/admin/seller-compliance/{caseId}/warning
POST /api/admin/seller-compliance/{caseId}/suspend-seller
POST /api/admin/seller-compliance/{caseId}/remove-product
POST /api/admin/seller-compliance/{caseId}/resolve
```

Exact endpoints depend on chosen case model.

## 57. List API

Recommended query:

```text
status
seller_id
product_id
source
search
date
page/cursor
```

## 58. Detail API

Returns safe:

- case metadata
- Seller identity
- product context
- report/flag reference
- safe evidence references
- compliance history
- linked message references
- current independent account/security states where authorized

## 59. Warning API

Responsibilities:

- authenticate Admin
- authorize warning action
- verify case is actionable
- validate reason/finding
- record warning
- commit
- emit Audit event
- create/send linked Admin Chat warning if configured

## 60. Suspend Seller API

Responsibilities:

- authenticate/authorize
- resolve exact Seller
- verify current compliance state
- record temporary compliance suspension
- cascade listing visibility/restrictions
- preserve product/order history
- emit Audit event
- communicate action to Seller

## 61. Remove Product API

Responsibilities:

- authenticate/authorize
- resolve exact Seller/product
- verify product belongs to Seller
- record permanent compliance removal
- remove listing from normal marketplace visibility
- block future checkout
- preserve historical references
- emit Audit event
- communicate action where required

## 62. Resolve API

If no violation or after handling:

```text
resolve/close case
```

Exact status value is Open.

# Concurrency

## 63. Concurrent Review

Two Admins may review the same case.
Backend must prevent conflicting final/compliance actions from silently overwriting each other.
Recommended:

```text
optimistic locking
case version
atomic transition checks
```

## 64. Duplicate Action

Repeated requests should not create duplicate warnings/suspensions/removals accidentally.

## 65. Stale Case

If another Admin already actioned the case:

```text
return current/conflict state
```

# Messaging

## 66. Admin Chat Integration

Warnings and compliance explanations should use:

```text
Admin Chat / Messaging
```

## 67. Role-Aware Messaging

Message target:

```text
Seller user_id
```

not email alone.

## 68. Messaging History

Store/reference:

```text
thread_id
message_id
```

where useful.

## 69. Messaging Boundary

Sending a warning message:

```text
does not itself
change compliance state
```

The compliance action must be persisted separately.

# Audit Logs

## 70. Audit Requirement

Compliance actions are consequential Admin operations.
Recommended events:

```text
SELLER_COMPLIANCE_WARNING_ISSUED
SELLER_COMPLIANCE_SUSPENSION_APPLIED
SELLER_COMPLIANCE_SUSPENSION_REMOVED
SELLER_PRODUCT_REMOVED_FOR_COMPLIANCE
SELLER_COMPLIANCE_CASE_RESOLVED
```

Exact taxonomy follows System Audit Logs.

## 71. Audit Data

Recommended:

```text
Admin actor
Seller user ID
product ID if applicable
case ID
action
safe reason/finding reference
before/after state
timestamp
```

## 72. Audit Secret Safety

Do not copy:

- passwords
- tokens
- private payment credentials
- unnecessary complaint evidence
  into Audit Logs.

# Notifications / Dashboard

## 73. Admin Notifications

A new internal flag/report may create an Admin Notification.
Admin Notifications owns alert state.
Seller Compliance owns the case.

## 74. Dashboard

Admin Dashboard may show:

```text
Seller Compliance Items
```

Count must use the compliance feature's authoritative actionable-state definition.

# Security

## 75. Authentication

All Admin compliance endpoints require:

```text
authenticated ADMIN
```

## 76. Permissions

Possible conceptual permissions:

```text
view seller compliance
issue warning
suspend Seller
remove product
resolve case
```

Exact names are Open.

## 77. CSRF

Admin web mutations require Sanctum CSRF protection.

## 78. IDOR

Knowing a Seller/product/case ID does not grant access.
Backend authorization must protect all compliance endpoints.

## 79. PII

Do not expose unnecessary Seller:

- payout credentials
- passwords
- tokens
- restricted personal data

## 80. XSS

Seller/product/report text must render safely.

# Error Handling

## 81. Errors

Handle:

```text
case not found
Seller not found
product not found
product does not belong to Seller
permission denied
invalid/stale action
already suspended
already removed
session expired
database failure
message delivery failure
```

## 82. Messaging Failure

If a compliance action commits but warning-message delivery fails:

```text
compliance action remains committed
```

Recommended:

- retry message/notification
- show operational status
  Do not roll back a valid sanction solely because messaging failed.

## 83. Cascade Failure

Seller suspension and required listing-visibility cascade should be transactionally consistent or recoverable.
Do not report successful suspension while leaving clearly active purchasable listings indefinitely.
Exact transaction/event architecture is Open.

# Performance

## 84. Queue Performance

Use indexed:

```text
status
seller_id
product_id
created_at
```

as appropriate.

## 85. Pagination

Compliance queues and history must be bounded.

## 86. Product Cascade

Hiding all Seller products may touch many listings.
Recommended architecture may use:

```text
Seller-level compliance flag
checked by product/search/checkout queries
```

instead of updating thousands of rows synchronously.
Exact strategy is Open.

## 87. Effective Visibility

A Seller-level restriction should be enforceable consistently across:

- search
- product detail
- cart validation
- checkout
  Do not rely only on removing products from one frontend list.

# UX

## 88. List States

Support:

```text
loading
empty
filtered empty
error
```

## 89. Detail States

Support:

```text
loading
reviewing
action confirmation
submitting
success
conflict
error
```

## 90. Action Confirmation

Warnings, suspension, and permanent listing removal are consequential.
Require deliberate confirmation.

## 91. Suspension Confirmation

Recommended summary:

```text
Seller
Shop
Reason
Effect on listing visibility
```

## 92. Product Removal Confirmation

Recommended:

```text
Product
Seller
Reason
Permanent marketplace removal effect
```

## 93. Status Clarity

Clearly distinguish:

```text
Seller Compliance
Manage User Accounts status
Global Ban
Vacation Mode
Product removal state
```

Do not collapse these into one generic "status".

## 94. Accessibility

UI should:

- identify Seller/product clearly
- expose status textually
- support keyboard navigation
- use accessible confirmations
- announce success/errors
- not rely on color alone

## 95. Responsive Behavior

Queue/detail/action UI should remain usable on narrower Admin screens.

# MVP Scope

## 96. Required

- authenticated Admin compliance queue
- stable Seller identity
- role-aware targeting
- internal report/flag support
- product verification/review
- Seller activity/context review
- formal warning
- Admin Chat warning integration
- temporary Seller compliance suspension
- listing visibility cascade
- permanent product listing removal
- no-violation resolution
- compliance history
- search/filter/pagination
- System Audit Log integration
- Admin Notifications integration for new flags/reports
- Dashboard workload integration
- CSRF
- PII protection
- loading/empty/error states

## 97. Recommended

- stable compliance-case record
- Seller-level restriction flag for scalable listing hiding
- explicit confirmations
- optimistic locking
- complaint evidence references
- message/thread references
- safe reason/finding field
- preserve removed product records historically

## 98. Not Required

- strike/points system
- automatic suspension threshold
- automatic report-count action
- automatic Global Ban
- automatic account suspension
- automatic refunds
- automatic order cancellation
- automatic listing restoration timer
- AI moderation
- external moderation provider
- Seller appeal workflow
- fixed suspension duration
- policy authoring

# Acceptance Criteria

## 99. AC-01 — Admin Access

Guests/non-Admins cannot access Seller Compliance management endpoints.

## 100. AC-02 — Permission

Compliance actions require configured Admin permissions.

## 101. AC-03 — Exact Seller Target

Compliance actions target exact Seller user ID, not email alone.

## 102. AC-04 — Same Email Isolation

A same-email Buyer account is unaffected by Seller compliance actions.

## 103. AC-05 — Product Verification

Admin can review Seller/product information needed for compliance.

## 104. AC-06 — Internal Flag

A compliance issue can be represented in an Admin review queue.

## 105. AC-07 — Warning

Authorized Admin can issue a formal warning tied to a Seller/case.

## 106. AC-08 — Warning Message

A warning can be communicated through Admin Chat/Messaging.

## 107. AC-09 — Message Boundary

Sending the warning message alone does not change compliance state.

## 108. AC-10 — Seller Suspension

Authorized Admin can apply a temporary Seller compliance suspension.

## 109. AC-11 — Listing Cascade

A compliance-suspended Seller's products are excluded from normal active buyer discovery/checkout according to shared listing rules.

## 110. AC-12 — Product Preservation

Seller suspension does not hard-delete all product records.

## 111. AC-13 — Existing Orders

Seller compliance suspension does not automatically cancel or rewrite existing orders.

## 112. AC-14 — Product Removal

Authorized Admin can permanently remove a specific non-compliant listing from normal marketplace availability.

## 113. AC-15 — Product History

Compliance removal preserves historical references required by orders/audits/cases.

## 114. AC-16 — Seller Independence

Removing one product does not automatically suspend/deactivate/ban the Seller.

## 115. AC-17 — Vacation Independence

Seller Vacation Mode remains independent from compliance suspension.

## 116. AC-18 — Vacation Cannot Bypass Compliance

Turning Vacation Mode off cannot restore listings blocked by active compliance suspension.

## 117. AC-19 — Account-State Independence

Clearing compliance suspension does not restore an independently suspended/deactivated user account.

## 118. AC-20 — Global Ban Independence

Clearing compliance suspension does not remove Global Ban.

## 119. AC-21 — Complaint Independence

Complaint status is not automatically changed by compliance action.

## 120. AC-22 — No Auto Ban

A compliance violation does not automatically create Global Ban unless explicitly actioned.

## 121. AC-23 — No Strike Assumption

The system does not enforce an undocumented strike-count threshold.

## 122. AC-24 — Resolve No Violation

Admin can resolve/close a false or non-violating flag without sanction.

## 123. AC-25 — Audit Warning

Formal warning creates a safe Audit event.

## 124. AC-26 — Audit Suspension

Compliance suspension creates a safe Audit event.

## 125. AC-27 — Audit Product Removal

Product removal creates a safe Audit event.

## 126. AC-28 — CSRF

Admin compliance mutations require configured Sanctum CSRF protection.

## 127. AC-29 — Pagination

Compliance queue/history is bounded/paginated.

## 128. AC-30 — Cascade Enforcement

Compliance listing restrictions are enforced beyond a single UI view, including buyer discovery/checkout rules.

# Tests

## 129. Backend Tests

Test:

- guest denied
- non-Admin denied
- Admin without permission denied
- Seller exact ID targeting
- same-email Buyer unaffected
- compliance case/list retrieval
- search/filter/pagination
- product belongs-to-Seller validation
- formal warning persisted
- warning Audit event
- warning message handoff
- message failure does not roll back warning
- Seller compliance suspension persists
- suspended Seller listings blocked from normal marketplace visibility
- checkout blocks newly restricted Seller listing
- product records preserved
- existing orders unchanged
- permanent product removal persists
- removed product not purchasable
- product historical references preserved
- one removed product does not automatically suspend Seller
- Vacation Mode remains separate
- turning Vacation off does not bypass compliance
- Manage User Accounts suspension remains after compliance restore
- Global Ban remains after compliance restore
- no automatic strike threshold
- no-violation resolution
- concurrent/stale case action handled
- CSRF required

## 130. Frontend Tests

Test:

- compliance queue loads
- loading/empty/filter states
- Seller role visible
- case detail loads
- product context loads
- warning confirmation
- suspension confirmation
- product removal confirmation
- action submitting/success/error
- conflict state
- linked Admin Chat opens correct Seller
- independent status badges visible
- Vacation Mode distinguished from compliance
- removed product state visible
- unsafe report/product text does not execute
- responsive layout
- keyboard accessibility
- status not color-only

# Open Decisions

## 131. Open Decisions

Current sources do not define:

1. exact compliance-case status enum
2. exact flag/report sources
3. exact product-verification criteria
4. policy matching/version reference
5. warning reason taxonomy
6. whether warning reason is user-visible
7. fixed warning templates
8. Seller response/appeal workflow
9. exact compliance suspension state storage
10. suspension duration
11. automatic expiry
12. unsuspension approval process
13. exact privileges available while suspended
14. existing-order fulfillment while suspended
15. Buyer messaging while suspended
16. payout/financial access while suspended
17. support access while suspended
18. exact listing hiding implementation
19. search-index invalidation mechanism
20. checkout error wording
21. product-removal enum/status
22. whether removed product can ever be reinstated
23. whether product removal needs second-Admin approval
24. exact internal flag fields
25. evidence attachment support directly in compliance cases
26. case assignment
27. priority/severity
28. SLA/escalation
29. exact Audit event names
30. Audit coverage for product verification views
31. Admin Notification event types
32. Dashboard actionable-count definition
33. exact permission keys
34. exact concurrency mechanism
35. complaint-to-compliance handoff rules
36. compliance-to-Global-Ban policy
37. bulk Seller suspension
38. bulk product removal
39. automatic moderation
40. Seller compliance analytics

# Final Definition

## 132. Final Definition

AISLEY Monitor Seller Compliance is:

```text
an Admin moderation and compliance feature

for:
    Seller activity
    product verification
    internal flags/reports
```

Source-backed actions:

```text
formal warning
temporary Seller privilege suspension
permanent non-compliant product removal
```

Core suspension effect:

```text
Seller compliance suspension
→ Seller products hidden/restricted
from normal buyer discovery/checkout
```

Central independence rule:

```text
Seller Compliance
is separate from:
    Manage User Accounts suspension
    Global Ban
    Vacation Mode
    complaint status
```

Central history rule:

```text
Moderation actions may restrict visibility/access,
but must preserve the records needed
for orders, investigations, and Audit Logs.
```
