---
feature: Monitor Seller Compliance
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
scope: Admin Web Application
---

# Seller Compliance Specification

## 1. Purpose

This document defines the **AISLEY Admin Seller Compliance** feature, corresponding to the Admin capability documented as **Monitor Seller Compliance**.

The feature provides the platform administration team with a controlled moderation workflow for reviewing seller activity and product listings against AISLEY platform policies, taking appropriate compliance actions, communicating those actions to sellers, and preserving accountability through audit records.

This specification is grounded in the current AISLEY project documents:

- `app.md`
- `Admin.md`
- `Buyer.md`
- `Seller.md`
- `Logistics.md`
- `Courier.md`

The source documents explicitly establish that the Seller Compliance feature must support:

- product verification
- seller activity auditing
- product-listing moderation
- internal reporting / flagging
- formal warnings
- temporary suspension of seller privileges
- permanent removal of non-compliant product listings
- integration with Admin ↔ user messaging for warnings/explanations
- cascading data changes when a seller is suspended, including hiding that seller's products
- Admin audit logging for administrative actions

Where the source documents do not define exact policy categories, violation severity levels, strike counts, automatic moderation rules, product-approval states, evidence requirements, appeal behavior, or suspension durations, this specification marks those items as open decisions rather than inventing them.

---

# 2. Core Value

`Admin.md` defines Seller Compliance as:

```text
Verify products, issue warning/suspension for violation.
```

Expanded platform intent:

```text
seller / product activity
        ↓
reported, flagged, or selected for Admin review
        ↓
Admin checks activity/listing against platform policies
        ↓
Admin determines whether a violation exists
        ↓
no violation
or
compliance action
        ├── formal warning
        ├── temporary seller suspension
        └── permanent removal of non-compliant listing
        ↓
seller is informed where applicable
        ↓
system state is updated
        ↓
Admin action is audited
```

This feature is the supply-side moderation and enforcement layer of AISLEY.

---

# 3. Goals

The Seller Compliance feature must:

1. provide Admins with a centralized compliance review queue
2. allow Admins to review flagged/reported products and seller activity
3. allow Admins to inspect the product and seller context needed for a decision
4. allow Admins to determine whether an item violates platform policy
5. allow formal warnings to be issued to sellers
6. allow authorized Admins to temporarily suspend seller privileges
7. allow authorized Admins to permanently remove non-compliant product listings
8. hide affected seller products when a seller suspension requires it
9. prevent suspended sellers from bypassing enforcement through normal seller operations
10. communicate compliance actions through the platform's Admin messaging capability where appropriate
11. preserve seller and product state changes in Admin audit logs
12. integrate with Dashboard compliance workload counts
13. integrate with complaints/reports when a complaint becomes a seller-compliance matter
14. protect sensitive user/account information
15. support search, filtering, pagination, and deterministic review states
16. protect against conflicting actions by multiple Admins
17. keep compliance enforcement separate from unrelated Seller, Logistics, Buyer, or Courier operational functionality

---

# 4. Non-Goals

This feature does not define:

- Seller account registration approval
- Buyer account registration approval
- Logistics account registration approval
- Courier approval
- general user-account CRUD
- buyer/seller dispute adjudication as a whole
- ordinary Buyer product reviews and ratings
- Seller inventory management
- Seller pricing and promotions
- Seller order fulfillment
- Logistics dispatch
- Courier enforcement
- payment fraud investigation
- global IP/payment blocklists
- the full platform-policy CMS
- exact platform policy text
- automated AI moderation
- automatic image recognition
- counterfeit-detection integrations
- legal/regulatory KYC
- a seller appeal workflow
- permanent seller-account banning unless defined by Manage User Accounts or Global Ban/Blocklist Management
- exact strike/violation scoring rules
- exact suspension durations
- automatic account suspension thresholds

These require separate feature specifications or source-backed policy definitions.

---

# 5. Actors

## 5.1 Admin

The primary actor.

Admin responsibilities include:

```text
review compliance cases
inspect seller activity
inspect product listings
verify products when required
determine whether a violation exists
issue formal warning
temporarily suspend seller privileges
permanently remove non-compliant listing
communicate compliance decision
```

All enforcement actions require authenticated Admin access and appropriate authorization.

## 5.2 Seller

The affected platform role.

`app.md` defines Seller as:

```text
one Seller account : one Shop
```

Seller capabilities include managing:

- products
- inventory
- orders
- shop
- pricing
- discounts
- vouchers
- account/store information
- reviews
- other merchant operations

Compliance enforcement may restrict some or all seller privileges depending on the action.

## 5.3 Buyer / Customer

Buyers can:

- browse products
- purchase products
- rate/review products
- upload review media
- communicate with sellers

Buyer-originated reports or complaints may become an input into compliance review where the reporting/complaint feature routes them appropriately.

The source documents do not define a standalone Buyer "Report Product" feature, so this specification must not assume a specific Buyer reporting UI unless one is separately implemented.

## 5.4 Other Admin Modules

Seller Compliance may receive or send context to:

- Dashboard
- Manage User Accounts
- Manage Complaints and Disputes
- Manage Platform Settings
- Chat / Messaging
- System Audit Logs

These integrations are defined later in this specification.

---

# 6. Domain Boundary

Seller Compliance owns platform-policy enforcement against:

```text
SELLER
PRODUCT / PRODUCT LISTING
SELLER ACTIVITY RELATED TO PLATFORM POLICY
```

It does not own:

```text
Buyer account moderation generally
Logistics operations
Courier operations
order dispatch
seller order fulfillment
general account registration approval
```

A seller may also be subject to actions in Manage User Accounts, but Seller Compliance is responsible for the compliance case and supply-side enforcement context.

---

# 7. Source-Backed Compliance Actions

The source documents explicitly define the following Admin compliance capabilities:

```text
VERIFY PRODUCT
ISSUE FORMAL WARNING
TEMPORARILY SUSPEND SELLER PRIVILEGES
PERMANENTLY REMOVE NON-COMPLIANT PRODUCT LISTING
```

These are the minimum enforcement actions for this feature.

---

# 8. Compliance Case Model

The source documents require an internal reporting / flagging mechanism but do not define a schema.

A **Compliance Case** is the recommended logical abstraction for a reviewable seller/product issue.

A case should conceptually identify:

```text
case id
seller
product/listing, when applicable
source / trigger
current review status
reported/flagged information
relevant evidence/context
assigned/reviewing Admin, if supported
created time
updated time
resolution/action
```

This is a feature-domain abstraction, not a mandated database table name.

The repository may implement the concept through:

```text
seller_compliance_cases
moderation_reports
product_flags
reports
```

or equivalent existing structures.

---

# 9. Compliance Case Sources

`Admin.md` requires an:

```text
internal reporting/flagging mechanism
```

Therefore, a compliance case may originate from a report or internal flag.

Possible source categories should be based only on mechanisms actually implemented by the project.

Examples of source *types*, not mandatory product requirements:

```text
internal flag
user report
Admin-created review
complaint/dispute referral
```

The source documents do not define:

- automated risk-scoring
- third-party moderation feeds
- AI flags
- exact Buyer report UI

These must not be added as required sources without a separate definition.

---

# 10. Compliance Case Status

The source documents do not provide a canonical compliance-case state machine.

For implementation, a review workflow needs deterministic states.

Recommended minimal workflow:

```text
OPEN
IN_REVIEW
RESOLVED
DISMISSED
```

These names are **recommended implementation states**, not explicit source terminology.

Semantics:

```text
OPEN
    case exists and awaits review

IN_REVIEW
    an Admin is actively reviewing the case

RESOLVED
    a violation decision/action has been completed

DISMISSED
    review found no actionable violation
```

If the repository already has a reporting/case status model, reuse it rather than introducing a competing state machine.

---

# 11. Violation Classification

The source docs say Admins audit against platform policies but do not define violation categories.

Therefore, this feature must not hardcode invented categories such as:

- counterfeit
- prohibited item
- misleading listing
- intellectual-property violation
- adult content
- pricing abuse
- dangerous goods

unless those categories are defined by AISLEY's platform policies.

Recommended architecture:

```text
compliance case
    ↓
optional policy / rule reference
```

Policy categories should come from the platform's authoritative policy/rules configuration when that system exists.

---

# 12. Relationship to Platform Policies

`Admin.md` defines Manage Platform Settings as supporting:

- Terms of Service
- Privacy Policy
- internal platform rules

Seller Compliance evaluates activity and listings against platform policies.

Therefore:

```text
Manage Platform Settings
        ↓
authoritative policy/rules
        ↓
Seller Compliance review
```

The compliance feature should not embed independent copies of mutable platform rules in frontend code.

If policy records have stable identifiers or versions, compliance cases should be able to reference the relevant rule/version when practical.

The source does not define exact policy versioning behavior.

---

# 13. Seller Compliance Queue

Recommended Admin route:

```text
/seller-compliance
```

Exact route naming should follow repository conventions.

The page should be accessible through:

```text
Monitor Seller Compliance
```

in Admin navigation.

Primary purpose:

```text
review items requiring compliance attention
```

---

# 14. Default Queue View

The default view should prioritize unresolved work.

Conceptually:

```text
OPEN
IN_REVIEW
```

resolved/dismissed cases should remain reachable as historical records where allowed.

---

# 15. Queue Columns / Summary Data

Recommended row data:

```text
case identifier
seller name / shop name
product/listing summary, if applicable
case source
status
created/reported time
last updated time
```

Optional:

```text
assigned/reviewing Admin
policy reference
```

only if those concepts exist in the implementation.

Do not expose unnecessary sensitive seller-account data in the list.

---

# 16. Search

The compliance queue should support server-side search using fields actually available to the system.

Useful source-compatible fields may include:

```text
seller name
shop name
seller email
product name/title
product identifier
case identifier
```

The exact searchable fields depend on the product/seller schemas.

Search must not load all cases into the browser.

---

# 17. Filters

Recommended filters:

```text
Case Status
Seller
Product / Listing presence
Case Source
Date range
```

Policy/category filter may be added if platform-policy categories are defined.

Action/result filter may include source-backed outcomes:

```text
WARNING
SELLER_SUSPENSION
PRODUCT_REMOVAL
NO_VIOLATION / DISMISSED
```

Do not invent severity/priority filters unless the compliance domain formally defines severity.

---

# 18. Sorting

Recommended baseline sorting:

```text
newest reported/flagged first
```

or the Admin application's established queue convention.

If an SLA or severity model is later defined, sorting may prioritize those fields.

No SLA or urgency model is defined by the current source docs.

---

# 19. Pagination

The compliance queue must be paginated or cursor-based.

Conceptual request:

```http
GET /api/admin/seller-compliance?status=OPEN&page=1
```

Do not retrieve an unbounded case collection.

---

# 20. Compliance Case Detail

Recommended route:

```text
/seller-compliance/{caseId}
```

A case detail view should provide enough context for an informed Admin decision.

Recommended sections:

1. Case Summary
2. Seller Summary
3. Product / Listing Details
4. Report / Flag Context
5. Relevant Evidence
6. Policy Context
7. Seller Activity Context
8. Existing Compliance History, if available and authorized
9. Admin Review / Notes
10. Available Enforcement Actions
11. Case Timeline / Audit History

Only fields backed by existing schemas should render.

---

# 21. Seller Summary

The case should identify the affected Seller.

Recommended safe context:

```text
seller/account id
seller name
shop name
seller status
account status
shop availability/status when available
```

Contact details may be shown only where needed for Admin review and consistent with PII restrictions.

Do not expose:

- password hashes
- session data
- payout credentials unnecessarily
- unrelated sensitive account details

---

# 22. Product / Listing Details

When a case targets a product, the Admin should be able to review the current listing.

Useful context may include fields that already exist in the Product domain:

```text
product id
product name/title
description
price
variants
stock status
listing visibility/status
seller/shop
product media
```

The source docs establish that Sellers manage products, prices, discounts, vouchers, and inventory, but they do not specify the exact Product schema.

Use the repository's existing product DTO/model.

---

# 23. Snapshot Requirement

Compliance review can become unreliable if the seller edits a product after it was reported.

A recommended system design is to preserve enough report-time context to understand what was flagged.

Possible approaches:

```text
immutable report snapshot
versioned product data
evidence attachment
change history
```

However, the source docs do not explicitly require a product snapshot/versioning system.

If the repository lacks one, this remains an implementation/design decision.

The minimum requirement is that the Admin can review the current listing and the original report/flag context available to the system.

---

# 24. Seller Activity Audit

`Admin.md` states:

```text
Administrators audit seller activities and product listings against platform policies.
```

The feature should therefore support visibility into relevant seller actions needed to evaluate a compliance case.

Examples should be limited to existing activity/history data such as:

```text
product creation/update history, if tracked
prior compliance actions, if tracked
relevant listing status changes
relevant account status changes
```

Do not create broad invasive behavioral surveillance unrelated to the case.

The scope should remain proportional to policy enforcement.

---

# 25. Product Verification

`Admin.md` explicitly lists:

```text
Verify products
```

but does not define whether:

- every product requires Admin approval before publication
- verification is only triggered by flags
- verification is manual or automatic
- a verified badge exists
- verification expires

Therefore, this specification defines **product verification as an Admin compliance action**, but does not require universal pre-publication moderation.

Minimum behavior:

```text
Admin reviews product
    ↓
Admin may mark review/verification outcome
```

The exact product verification status model must align with the Product domain.

Recommended conceptual states if the repository needs them:

```text
UNREVIEWED
VERIFIED
NON_COMPLIANT
```

These names are recommended, not source-mandated.

---

# 26. No-Violation / Dismiss Action

A reporting/flagging mechanism needs a way to close items that do not violate policy.

Recommended action:

```text
Dismiss / No Violation
```

Flow:

```text
Admin reviews case
    ↓
finds no actionable violation
    ↓
case → DISMISSED
    ↓
no seller sanction applied
    ↓
decision audited
```

This action is logically necessary for closing false/invalid flags, though the exact label is not specified by the source documents.

---

# 27. Formal Warning

`Admin.md` explicitly requires:

```text
issue formal warnings
```

A warning is a compliance action that records a violation/advisory without suspending the seller or necessarily removing all listings.

Recommended flow:

```text
Admin confirms violation
    ↓
select Warning
    ↓
review warning message/context
    ↓
confirm
    ↓
warning record created
    ↓
seller notified through Admin messaging
    ↓
case resolved or updated
    ↓
audit entry recorded
```

The warning should be associated with:

```text
seller
case
Admin actor
timestamp
```

and, when applicable:

```text
product/listing
policy/rule reference
```

---

# 28. Warning Message

The source requires integration with the messaging system for warnings.

Therefore, issuing a formal warning should create or send an official Admin-to-Seller communication using the platform messaging architecture.

The message may include:

```text
what action was taken
which listing/activity is affected
policy explanation/reference
next steps, if defined
```

The source does not define mandatory warning templates or exact legal wording.

Do not invent policy text inside the compliance feature.

---

# 29. Warning History

Warnings should remain reviewable as part of seller compliance history where the data model supports it.

This helps Admins understand prior enforcement actions.

The source does not define:

- strike counts
- automatic escalation
- warning expiration
- warning levels

Therefore, warning history must not automatically trigger suspension unless a separate policy explicitly defines such behavior.

---

# 30. Temporary Seller Suspension

`Admin.md` explicitly requires:

```text
temporarily suspend seller privileges
```

Suspension is a high-impact action and must require deliberate Admin confirmation.

Recommended flow:

```text
Admin confirms violation
    ↓
select Suspend Seller
    ↓
review affected seller + consequences
    ↓
provide suspension configuration if system defines one
    ↓
confirm
    ↓
seller privileges suspended
    ↓
seller products hidden as required
    ↓
seller informed
    ↓
case updated
    ↓
audit entry recorded
```

---

# 31. Suspension Scope

The source uses the phrase:

```text
temporarily suspend seller privileges
```

and provides a cascading example:

```text
hide seller's products when account is suspended
```

At minimum, suspension must prevent the suspended seller from continuing normal selling activity that would undermine the enforcement.

The exact scope—such as whether the seller can still:

- sign in
- view historical orders
- respond to messages
- access reports
- fulfill already-accepted orders
- edit account information

—is not defined by the current source documents.

These are open product decisions.

The implementation must not silently equate "seller privileges suspended" with complete user-account deletion.

---

# 32. Cascading Product Visibility on Suspension

`Admin.md` explicitly requires cascading database updates such as:

```text
hiding a seller's products when their account is suspended
```

Therefore:

```text
SELLER SUSPENDED
        ↓
seller's active product listings become unavailable
to normal Buyer discovery/purchase as defined
```

The effect must be enforced by backend product/search/cart/checkout rules, not only by hiding UI elements in the Seller dashboard.

---

# 33. Suspension and Buyer Product Discovery

Buyer features include:

- Search
- Browse Shop
- Wishlist/Favorites
- Recently Viewed Items
- Cart

When a Seller is suspended and their products are hidden:

```text
normal marketplace search should not return suspended seller listings
normal shop browsing should not expose purchasable suspended listings
checkout/cart validation must prevent purchasing an unavailable suspended listing
```

The source does not define how wishlist/recently-viewed entries should appear after suspension.

Recommended safe behavior is to preserve user references but mark affected items unavailable rather than silently deleting Buyer data.

This is an implementation decision unless separately specified.

---

# 34. Suspension and Existing Orders

The source does not define what happens to:

```text
existing orders
orders already being prepared
orders already in Logistics
orders already delivered
```

when a Seller is suspended.

Because the platform has a documented order lifecycle:

```text
customer order
    ↓
seller approved
    ↓
seller packed
    ↓
logistics
    ↓
delivered
```

the compliance feature must not automatically cancel or corrupt in-progress order state without an explicit business rule.

Existing-order handling is an open decision and should be specified separately.

---

# 35. Suspension Duration

The source says:

```text
temporarily suspend
```

but does not define:

- fixed duration
- Admin-selected duration
- indefinite-until-restored
- automatic expiration

Therefore, suspension duration behavior must be defined before implementation.

A data model should be compatible with at least:

```text
suspended_at
suspended_by
```

and optionally:

```text
suspension_ends_at
```

if timed suspension becomes a requirement.

---

# 36. Suspension Restoration

`Manage User Accounts` states Admins may restore access after temporary suspension.

Therefore, restoration of a seller account/privileges may be owned by:

```text
Manage User Accounts
```

or coordinated with Seller Compliance.

The source does not explicitly assign restoration to Seller Compliance.

Recommended boundary:

```text
Seller Compliance
    creates compliance suspension + reason/context

Manage User Accounts
    exposes account status/restoration controls

shared backend service
    enforces consistent state transitions
```

Do not implement two independent suspension systems.

---

# 37. Permanent Product Removal

`Admin.md` explicitly requires:

```text
permanently remove non-compliant product listings
```

This is a product-level enforcement action.

Flow:

```text
Admin confirms product violation
    ↓
select Remove Listing
    ↓
confirmation
    ↓
backend marks/removes listing according to domain model
    ↓
product no longer appears in Buyer marketplace
    ↓
seller informed
    ↓
case updated
    ↓
audit entry recorded
```

---

# 38. Remove vs Delete

"Permanent removal" should not necessarily mean destructive database deletion.

For accountability and auditability, recommended implementation is:

```text
soft delete
or
moderation removal state
```

so that:

- Admin can inspect historical action
- order records remain referentially valid
- audit records remain meaningful
- past Buyer order history does not break

The exact persistence pattern should follow repository conventions.

The frontend should not promise reversibility if the product action is considered permanent.

---

# 39. Product Visibility After Removal

A permanently removed non-compliant product must not be available for normal:

```text
Buyer Search
Browse Shop
Add to Cart
Buy / Checkout
```

Backend validations must enforce this.

Existing historical references such as:

- past orders
- past reviews
- audit records

should remain internally consistent.

The source does not require deleting historical order/review records when a listing is removed.

---

# 40. Seller Vacation Mode Interaction

`Seller.md` defines Vacation Mode:

```text
seller temporarily pauses new orders
seller's products are temporarily removed from active search
checkout for those items is disabled
```

Compliance suspension can also hide products.

These are different business reasons and must not overwrite each other incorrectly.

Conceptually:

```text
product purchasable =
    seller account compliant/active
    AND seller not restricted by compliance
    AND seller not in vacation mode
    AND product itself active/compliant
    AND inventory/business constraints satisfied
```

Important consequence:

```text
Seller turns Vacation Mode off
    ≠
compliance suspension removed
```

and:

```text
Admin restores compliance access
    ≠
Seller Vacation Mode automatically disabled
```

Keep these state dimensions separate.

---

# 41. Seller Product Management Interaction

`Seller.md` gives Sellers control over catalog CRUD, pricing, promotions, and stock.

Compliance enforcement must override seller-controlled visibility where required.

A Seller must not be able to restore a permanently removed listing simply by:

```text
editing product
reactivating product
bulk importing it unchanged
changing stock
turning off Vacation Mode
```

The backend must check moderation/compliance state during product mutations and publication.

---

# 42. Bulk Product Import Interaction

`Seller.md` supports CSV/Excel bulk product import/export.

A compliance enforcement system must ensure bulk upload does not become a bypass.

If a removed product is reintroduced as a new row, whether it should be automatically detected is not defined by the source.

At minimum:

- seller cannot update a moderation-removed record into active state without authorization
- bulk operations must respect the same product-state constraints as individual CRUD

Automatic duplicate-content detection is outside this specification.

---

# 43. Buyer Reviews and Ratings

Buyer product reviews are verified-purchase feedback.

Seller review management allows sellers to read and reply to reviews.

Reviews may provide useful context for an Admin compliance review, but:

```text
negative review ≠ automatic policy violation
```

The source does not define automated moderation based on ratings.

If reviews are used as compliance evidence, the case should preserve the relevant review reference/context.

---

# 44. Complaints and Disputes Integration

`Admin.md` separately defines Manage Complaints and Disputes.

That module owns:

```text
user reports/complaints
supporting evidence
conflict adjudication
binding dispute decisions
```

Seller Compliance owns:

```text
seller/listing policy enforcement
```

A complaint may therefore trigger/referral a Seller Compliance case.

Conceptual integration:

```text
Complaint / Dispute
    ↓
Admin identifies seller-policy issue
    ↓
create/link Seller Compliance case
    ↓
compliance action handled here
```

Do not merge the two modules into one workflow.

The dispute case should retain its own resolution/audit trail.

---

# 45. Messaging Integration

`Admin.md` defines Admin Chat/Messaging as a direct, secure communication channel used for:

- platform support
- account anomalies
- detailed explanations regarding compliance actions

Seller Compliance warnings must integrate with this messaging capability.

Recommended behavior:

```text
compliance action
    ↓
create/send official Admin message
    ↓
message linked to seller
    ↓
message history retained
```

If the messaging system supports threads, the compliance case may link to the relevant thread.

Exact message templates/read-receipt behavior belongs to the messaging specification.

---

# 46. Notifications

The source explicitly requires messaging integration for warnings but does not separately define push/email notification behavior for Seller Compliance actions.

Therefore, the minimum source-backed seller communication is:

```text
platform messaging for warnings/explanations
```

Email/push duplication may be added when a broader notification specification defines it.

Do not assume Brevo email is mandatory for Seller Compliance solely because Brevo exists elsewhere in the system.

---

# 47. Dashboard Integration

The Admin Dashboard specification includes:

```text
Seller Compliance Items
```

as an actionable KPI/queue summary.

The Dashboard count must use the same authoritative compliance-case state as this feature.

Conceptually:

```text
Dashboard:
Seller Compliance Items = unresolved compliance workload

click
    ↓
/seller-compliance
    ↓
filtered to actionable cases
```

Dashboard and Seller Compliance counts must reconcile for the same scope.

---

# 48. Manage User Accounts Integration

`Admin.md` defines Manage User Accounts as supporting:

```text
temporary suspensions
restoring access
```

Seller Compliance also defines temporary seller suspension for violations.

These features must share account-status enforcement.

Recommended architecture:

```text
SellerComplianceService
        ↓
AccountStatus / SellerAccess service
        ↓
seller restriction state
```

rather than each module directly writing unrelated status fields.

Any suspension initiated from Seller Compliance should preserve its compliance reason/case relationship.

---

# 49. System Audit Logs Integration

`Admin.md` requires an immutable, timestamped ledger recording:

```text
who performed an action
what data was altered
when it occurred
```

Seller Compliance actions must be audited.

At minimum, audit events should cover:

```text
product verified
case dismissed / no violation
formal warning issued
seller suspended
seller restored, if performed here
product listing removed
compliance case status changed
```

Exact event names should follow repository conventions.

Audit payloads should identify:

```text
Admin actor
seller
product, if applicable
compliance case
previous state
new state
timestamp
```

Do not place sensitive auth credentials or unnecessary PII in audit payloads.

---

# 50. Admin Authorization

AISLEY is intended to support additional Admins with custom permissions.

Seller Compliance must therefore be permission-aware.

Conceptually separable capabilities include:

```text
view compliance queue
view compliance case
verify product
dismiss case
issue warning
suspend seller
remove product listing
```

These are conceptual capabilities.

Exact permission keys are not defined by the source documents.

Use the shared Admin authorization system rather than implementing a feature-specific permission framework.

---

# 51. High-Impact Action Confirmation

The following actions should require explicit confirmation:

```text
Suspend Seller
Permanently Remove Listing
```

A warning should also require a deliberate submission because it becomes an official compliance action.

Confirmation should show:

```text
seller
affected product, if relevant
selected action
consequence
```

Do not rely on icon-only or ambiguous actions.

---

# 52. Admin Notes

The source does not explicitly require private Admin notes for Seller Compliance.

However, a case-management system may benefit from internal review notes.

If implemented, clearly distinguish:

```text
INTERNAL NOTE
```

from:

```text
SELLER-VISIBLE MESSAGE
```

Internal notes must never be accidentally sent through Seller messaging.

Whether Admin notes are mandatory is an open product decision.

---

# 53. Evidence

Seller Compliance requires internal reporting/flagging.

`Manage Complaints and Disputes` explicitly supports evidence files, but Seller Compliance does not explicitly state evidence storage requirements.

If a compliance case originates from a complaint, it may reference complaint evidence according to that module's authorization rules.

If Seller Compliance later supports direct evidence attachments, secure storage/retrieval requirements should mirror the platform's evidence-handling approach.

Do not duplicate files unnecessarily across modules.

---

# 54. Case Resolution

A compliance case should reach a terminal state after the Admin completes review.

Possible outcomes:

```text
NO VIOLATION / DISMISSED
VERIFIED
WARNING ISSUED
SELLER SUSPENDED
PRODUCT REMOVED
```

A single case may theoretically involve multiple actions, such as:

```text
product removed
+
seller warned
```

The source docs do not define whether actions are mutually exclusive.

Recommended model:

```text
case resolution
+
zero or more enforcement actions
```

rather than forcing exactly one outcome.

---

# 55. Concurrency

Multiple Admins may review the same case.

The backend must avoid conflicting updates.

Example:

```text
Admin A opens OPEN case
Admin B opens OPEN case

Admin A removes product and resolves case

Admin B later tries to verify/dismiss same stale case
    ↓
backend detects changed state/version
    ↓
reject or require refresh
```

Use transaction/version/status checks consistent with the repository.

---

# 56. Idempotency

Repeated action submissions caused by:

- double-click
- retry
- network timeout

must not create duplicate warnings, duplicate suspension records, or duplicate audit entries where preventable.

State-changing commands should use:

```text
current-state validation
transactional updates
idempotency protections where appropriate
```

---

# 57. Recommended API — Queue

Conceptual:

```http
GET /api/admin/seller-compliance
```

Possible query parameters:

```text
status
seller
product
source
search
from
to
page
per_page
sort
```

Response:

```text
paginated compliance-case summaries
filter/pagination metadata
```

Exact route/parameter naming should follow repository conventions.

---

# 58. Recommended API — Case Detail

Conceptual:

```http
GET /api/admin/seller-compliance/{caseId}
```

Must:

- require authenticated Admin
- apply Admin permission checks
- return seller/product/report context
- return relevant compliance history
- return available actions based on current state/permission
- exclude sensitive authentication data

---

# 59. Recommended API — Verify Product

Conceptual:

```http
POST /api/admin/seller-compliance/{caseId}/verify-product
```

or a product-scoped moderation endpoint.

Backend:

```text
authorize
validate case/product
validate current state
record verification outcome
update case
audit
return updated state
```

Exact product verification semantics depend on the final Product status model.

---

# 60. Recommended API — Dismiss

Conceptual:

```http
POST /api/admin/seller-compliance/{caseId}/dismiss
```

Backend:

```text
authorize
validate current case state
record no-violation decision
resolve/dismiss case
audit
return updated state
```

---

# 61. Recommended API — Warning

Conceptual:

```http
POST /api/admin/seller-compliance/{caseId}/warning
```

Payload may include:

```json
{
  "message": "..."
}
```

only if the messaging flow allows free-form warning content.

Backend:

```text
authorize
validate seller/case
create formal warning
send/create Admin message
update case
audit
return updated state
```

---

# 62. Recommended API — Suspend Seller

Conceptual:

```http
POST /api/admin/seller-compliance/{caseId}/suspend-seller
```

Payload may include duration/end time only if the suspension model defines it.

Backend:

```text
authorize high-impact action
validate seller/case
validate seller current status
apply seller restriction
hide seller products through authoritative visibility logic
update case/action history
notify/message seller
audit
return updated state
```

---

# 63. Recommended API — Remove Product

Conceptual:

```http
POST /api/admin/seller-compliance/{caseId}/remove-product
```

Backend:

```text
authorize
validate product belongs to affected seller/case
validate product moderation state
apply permanent moderation removal
make product unavailable in marketplace
update case/action history
notify/message seller
audit
return updated state
```

---

# 64. Recommended Compliance Summary DTO

Conceptual only:

```json
{
  "id": "case-id",
  "status": "OPEN",
  "source": "REPORT",
  "seller": {
    "id": "seller-id",
    "shop_name": "Shop Name"
  },
  "product": {
    "id": "product-id",
    "name": "Product Name"
  },
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

Use repository naming conventions.

---

# 65. Recommended Compliance Detail DTO

Conceptual only:

```json
{
  "id": "case-id",
  "status": "IN_REVIEW",
  "source": "REPORT",
  "seller": {
    "id": "seller-id",
    "name": "Seller Name",
    "shop_name": "Shop Name",
    "status": "ACTIVE"
  },
  "product": {
    "id": "product-id",
    "name": "Product Name",
    "visibility": "ACTIVE"
  },
  "report": {
    "summary": "...",
    "created_at": "timestamp"
  },
  "policy_reference": null,
  "actions": [],
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

Do not expose unsupported fields just to match this example.

---

# 66. Frontend Queue States

The queue must handle:

```text
loading
loaded with actionable cases
loaded with zero cases
filtered zero state
search zero state
error
unauthenticated
forbidden
```

---

# 67. Case Detail States

The case page must handle:

```text
loading
open
in review
resolved
dismissed
not found
stale/conflict
error
forbidden
```

High-impact controls must not render as available before current state and permissions are known.

---

# 68. Empty States

Examples:

### No Open Compliance Cases

```text
No seller compliance items require review.
```

### Filtered Empty State

```text
No compliance cases match these filters.
```

### Seller History Empty State

```text
No previous compliance actions found.
```

Do not populate production screens with fake violations.

---

# 69. Loading States

While data loads:

- render Admin application shell
- use skeletons/placeholders
- keep enforcement controls disabled
- do not render fabricated seller/product information
- do not flash sensitive content from a previously loaded case

---

# 70. Error Handling

Handle:

- queue load failure
- case load failure
- action mutation failure
- seller state changed elsewhere
- product state changed elsewhere
- case already resolved
- expired Admin session
- forbidden action
- messaging delivery failure
- audit/logging transport failure according to system architecture

The UI must never claim a seller was suspended or a product removed unless the authoritative backend mutation succeeded.

---

# 71. Messaging Failure

Compliance state and messaging are related but should not create ambiguous enforcement state.

Recommended pattern:

```text
compliance action commits
    ↓
official message event/job created
    ↓
delivery occurs
```

If messaging transport is temporarily unavailable, the enforcement action should remain authoritative and the message should be retried according to the messaging architecture.

The source does not define retry semantics.

---

# 72. Audit Failure

`Admin.md` says Admin operations should trigger audit middleware that writes asynchronously without failing the primary request.

Seller Compliance should follow that model.

The system must still design for reliable eventual audit persistence; "asynchronous" must not mean silently discarding audit events.

Exact queue/outbox implementation is an architecture decision.

---

# 73. Search and Buyer Marketplace Enforcement

Seller/product compliance state must be respected across Buyer-facing discovery.

At minimum:

```text
removed product
    → excluded from normal Search
    → unavailable in Browse Shop

suspended seller
    → seller's products hidden/unavailable
```

If full-text search or external search indexing is used, compliance actions must propagate to that search/index layer.

`Buyer.md` mentions possible full-text indexing.

The repository's actual implementation determines whether database filters, index updates, or both are required.

---

# 74. Cart and Checkout Enforcement

Buyer Cart includes final stock/availability validation.

Compliance state must participate in this validation.

If a product is removed or its seller becomes suspended after a Buyer added it to cart:

```text
checkout must reject/skip that item according to cart rules
```

The item must not remain purchasable merely because it was added before the compliance action.

Exact cart UX for unavailable items belongs to the Buyer Cart specification.

---

# 75. Seller Dashboard Enforcement

A suspended Seller may still have a Seller web session.

Whether the Seller can access read-only areas is not defined.

Regardless of frontend access:

```text
backend mutations that require active seller privileges
must enforce compliance restriction
```

A Seller frontend must not be able to bypass suspension by directly calling product/order APIs.

---

# 76. Seller Account Status vs Compliance Status

Avoid collapsing all concepts into one ambiguous field.

Potential independent concepts include:

```text
account registration status
account active/suspended status
seller compliance restriction
seller vacation mode
product moderation status
product archive/delete status
inventory availability
```

The final schema may combine some of these, but business semantics must remain distinguishable.

Example:

```text
APPROVED seller
+
SUSPENDED for compliance
```

is different from:

```text
PENDING registration
```

and different from:

```text
Seller voluntarily in Vacation Mode
```

---

# 77. Product Archive vs Compliance Removal

Seller product management supports archive/delete-like catalog operations.

A seller-initiated archive must remain distinct from an Admin compliance removal.

Reason:

```text
Seller archive
    voluntary catalog management

Admin removal
    enforcement action
    seller must not reactivate without authorization
```

The UI and backend should preserve this distinction.

---

# 78. Seller Messaging History

Because compliance actions may require detailed explanations, related messages should remain historically accessible for accountability.

`Admin.md` requires messaging read receipts and historical archiving.

The compliance case may show a link to the associated Admin ↔ Seller conversation rather than duplicate the entire messaging system.

---

# 79. Notifications to Admin

The Dashboard may display Seller Compliance workload.

If the broader Admin notification system defines events for new compliance cases, this module should emit or integrate with those events.

Possible source-backed high-level event:

```text
new seller compliance item requires review
```

Exact notification event names, realtime transport, read states, and priority are owned by the Admin Notifications specification.

---

# 80. Security Requirements

Seller Compliance endpoints must:

- require authenticated Admin sessions
- require feature/action-specific Admin authorization
- validate seller/product/case relationships
- validate current states before mutation
- use CSRF protection for state-changing Admin web requests
- prevent mass assignment of seller/product restricted fields
- protect PII
- avoid exposing Seller payout/banking data unless explicitly needed
- avoid exposing password hashes, sessions, or auth secrets
- sanitize/escape user-generated report and message content
- protect evidence access
- maintain auditability
- prevent sellers from overriding Admin moderation states
- enforce compliance state server-side across marketplace and Seller APIs

---

# 81. Performance Requirements

The queue should support:

- indexed case status filters
- seller/product lookup
- pagination
- bounded result sets
- efficient Dashboard aggregate count
- limited history previews

Product/seller suspension may affect many listings.

Avoid performing an unsafe unbounded synchronous loop over every seller product if the repository supports a better authoritative rule such as:

```text
seller.suspended
```

checked by product visibility queries.

If denormalized search indexes/caches require updates, use appropriate background processing while immediately enforcing authoritative backend restrictions.

---

# 82. Data Consistency

A seller suspension should have one authoritative restriction state.

All affected domains should derive from it consistently:

```text
Buyer Search
Browse Shop
Cart
Checkout
Seller product APIs
Dashboard compliance count
Admin Seller Compliance
Manage User Accounts
```

Similarly, a product moderation removal must have one authoritative state respected everywhere the product is exposed.

---

# 83. MVP Scope

## Required for MVP

- authenticated Admin-only Seller Compliance route
- compliance case/report queue
- server-side search
- filters
- pagination
- compliance case detail
- seller context
- product/listing context
- report/flag context
- product verification action
- no-violation/dismiss outcome
- formal warning
- Admin ↔ Seller messaging integration for warnings/explanations
- temporary seller suspension
- seller-product hiding on suspension
- permanent product/listing removal
- backend enforcement preventing seller bypass
- Dashboard compliance count integration
- Admin audit-log integration
- loading/empty/error states
- concurrency protection
- permission-aware actions

## Not Required for MVP

- automatic moderation
- AI classification
- OCR/image matching
- counterfeit databases
- strike scoring
- automatic escalation
- SLA timer
- seller appeal
- timed suspension unless separately decided
- bulk moderation
- batch seller suspension
- legal/KYC review
- third-party moderation integrations
- automated duplicate listing detection
- risk score
- public moderation transparency report

---

# 84. Acceptance Criteria

## AC-01 — Admin-Only Access

Given no authenticated authorized Admin session exists, Seller Compliance data and enforcement endpoints are not accessible.

## AC-02 — Queue

Given unresolved seller/product compliance items exist, an authorized Admin can view them in the Seller Compliance queue.

## AC-03 — Search

Given a matching seller, shop, product, or case identifier exists within supported search fields, the Admin can locate the relevant compliance case through server-side search.

## AC-04 — Filter

Given compliance cases have different statuses/sources, the Admin can narrow the queue using supported filters.

## AC-05 — Pagination

Given many compliance cases exist, the queue returns bounded paginated/cursor-based results rather than the entire dataset.

## AC-06 — Case Detail

Given a compliance case exists, an authorized Admin can review its seller, product/listing, report/flag, status, and relevant history/context without receiving unrelated sensitive authentication data.

## AC-07 — Verify Product

Given a product is under compliance review and no violation is found under the platform's applicable policy, an authorized Admin can record the appropriate verification/review outcome according to the Product moderation model.

## AC-08 — Dismiss No Violation

Given a report/flag does not represent an actionable violation, the Admin can close/dismiss the case without applying a seller sanction.

## AC-09 — Formal Warning

Given an Admin determines a violation warrants a warning, the Admin can issue a formal warning associated with the seller and compliance case.

## AC-10 — Warning Communication

Given a formal warning is issued, an official Admin-to-Seller message/explanation is created through the platform messaging capability.

## AC-11 — Warning Audit

Given a warning is issued, the action is recorded through the Admin audit mechanism.

## AC-12 — Suspend Seller

Given an authorized Admin determines a violation warrants temporary seller suspension, the backend applies a seller restriction through the authoritative seller/account state.

## AC-13 — Suspended Seller Products Hidden

Given a Seller is suspended for compliance, the Seller's active products are hidden/unavailable through normal Buyer marketplace discovery as required by `Admin.md`.

## AC-14 — Suspended Seller Cannot Bypass

Given a Seller is suspended, the Seller cannot restore marketplace availability through normal product editing, product activation, bulk import, or Vacation Mode changes.

## AC-15 — Vacation Mode Separation

Given a Seller is both suspended and in Vacation Mode, removing one state does not incorrectly remove the other.

## AC-16 — Remove Product

Given an Admin determines a listing is non-compliant, an authorized Admin can permanently remove the listing from normal marketplace availability.

## AC-17 — Seller Cannot Restore Removed Listing

Given a product has been removed through Admin compliance enforcement, the Seller cannot reactivate that same moderation-removed record through normal catalog management.

## AC-18 — Removed Product Search

Given a product is moderation-removed, it is not returned as a normally purchasable item in Buyer Search.

## AC-19 — Removed Product Shop Browse

Given a product is moderation-removed, it is not available as a normally purchasable item in Buyer Browse Shop.

## AC-20 — Removed Product Checkout

Given a removed product remains referenced in a Buyer's cart, checkout validates current product compliance/availability and does not process it as an active purchasable listing.

## AC-21 — Suspension Checkout

Given a product belongs to a suspended Seller, Buyer checkout does not treat it as normally purchasable.

## AC-22 — Existing Order Safety

Given a Seller is suspended while existing orders are already in progress, the compliance action does not automatically mutate/cancel order lifecycle state unless an explicit order-handling rule exists.

## AC-23 — Dashboard Count

Given unresolved Seller Compliance cases exist, the Admin Dashboard compliance KPI/action count uses the same authoritative unresolved case scope.

## AC-24 — Complaint Referral

Given a complaint/dispute identifies a seller-policy issue and the system supports referral/linking, a compliance case can reference the originating complaint without merging the two modules' state machines.

## AC-25 — Audit Seller Suspension

Given a Seller is suspended, the audit mechanism records actor, target, state change, case context, and time.

## AC-26 — Audit Product Removal

Given a product is removed, the audit mechanism records actor, target product/seller, state change, case context, and time.

## AC-27 — Concurrent Review

Given multiple Admins load the same case and one completes a conflicting action first, the second stale action does not silently overwrite the authoritative case/product/seller state.

## AC-28 — Mutation Failure

Given a compliance mutation fails, the frontend does not display a false success state.

## AC-29 — Sensitive Data Protection

Given an Admin loads compliance data, the response excludes password hashes, session identifiers, and unrelated sensitive Seller account fields.

## AC-30 — Permission Enforcement

Given an Admin can view compliance cases but lacks authority for a high-impact action, the backend rejects that action even if a request is manually constructed.

## AC-31 — Seller Scope

Given the compliance module handles a case, the enforcement target is a Seller or Seller product/listing and does not become an unrelated Logistics/Courier operational workflow.

## AC-32 — Historical Integrity

Given a product is removed for compliance, historical orders/reviews/audit references are not destroyed merely to hide the listing from active marketplace use.

## AC-33 — Messaging History

Given a compliance warning/explanation is sent through Admin messaging, the message follows the messaging system's historical archiving/accountability behavior.

---

# 85. Suggested Backend Tests

Test:

- guest cannot access compliance endpoints
- non-Admin cannot access compliance endpoints
- unauthorized Admin cannot execute restricted compliance action
- compliance queue returns actionable cases
- compliance queue is paginated
- compliance queue supports status/source filters
- compliance search works for supported fields
- case detail resolves seller/product relationships correctly
- case detail excludes password/session secrets
- Admin can verify/review product according to moderation model
- Admin can dismiss no-violation case
- Admin can issue warning
- warning creates/dispatches official seller message
- warning creates audit entry
- Admin can suspend Seller
- seller suspension updates authoritative restriction state
- suspended seller's products are excluded by marketplace queries
- suspended seller cannot reactivate via product API
- suspended seller cannot bypass via bulk import/update
- Vacation Mode cannot override compliance suspension
- removing compliance suspension does not disable Vacation Mode
- Admin can remove non-compliant product
- removed product excluded from search
- removed product excluded from shop listing
- removed product rejected at cart/checkout validation
- Seller cannot reactivate moderation-removed product
- historical order relations survive product removal
- suspension does not mutate existing orders unless explicit rule exists
- Dashboard compliance count reconciles with unresolved queue
- audit entry created for suspension
- audit entry created for product removal
- stale/concurrent action returns conflict or equivalent
- duplicate submissions do not create duplicate warning/suspension side effects where avoidable
- seller/account PII restrictions are honored

---

# 86. Suggested Frontend Tests

Where frontend test infrastructure exists, test:

- compliance queue loads
- loading state renders
- empty state renders
- filters issue expected request
- search issues expected request
- pagination works
- case detail shows seller/product context
- actions reflect current Admin permissions
- verify/dismiss workflow updates case
- warning requires deliberate submission
- suspension requires confirmation
- product removal requires confirmation
- mutation buttons disable while request is in flight
- failed mutation does not render success
- stale conflict prompts/refetches current state
- Seller messaging link/context appears after warning where supported
- resolved case renders historical action
- no fake violation data appears
- responsive list/detail layout remains usable

---

# 87. Open Decisions

The current source documents do not define:

1. exact Seller Compliance database schema
2. exact report/flag sources
3. whether Buyers can directly report products
4. whether Sellers can report other Sellers/products
5. exact platform-policy violation categories
6. exact severity levels
7. exact priority levels
8. whether every new product requires Admin verification
9. whether verified products receive a visible badge
10. whether product verification expires
11. whether product edits invalidate prior verification
12. required evidence for a compliance decision
13. mandatory Admin notes
14. mandatory seller-visible explanation
15. warning templates
16. warning levels
17. strike/violation point system
18. automatic escalation rules
19. whether suspension blocks Seller login entirely
20. whether a suspended Seller can fulfill existing orders
21. whether a suspended Seller can message Buyers
22. whether a suspended Seller can access financial reports
23. exact suspension duration behavior
24. whether timed suspensions auto-expire
25. who can restore a suspended Seller
26. whether restoration belongs to Seller Compliance or Manage User Accounts
27. whether permanent product removal is reversible by a higher-privileged Admin
28. whether Seller can appeal a warning/suspension/removal
29. appeal time limits
30. case assignment to individual Admins
31. case SLA / aging rules
32. automated flagging/moderation
33. duplicate/re-upload detection
34. whether compliance cases can target the entire shop
35. whether suspension affects active promotions/vouchers
36. behavior of affected wishlist/recently-viewed references
37. behavior of existing cart items beyond blocking checkout
38. behavior of existing orders after seller suspension
39. whether seller payouts are held during suspension
40. exact Admin permission keys
41. exact API route names
42. exact message delivery/retry rules
43. whether compliance actions also trigger email/push notifications
44. retention period for compliance cases/evidence
45. exact product moderation status enum
46. exact seller restriction/status enum
47. whether cases may have multiple simultaneous enforcement actions
48. whether a dismissed case may be reopened
49. whether compliance records are exportable
50. whether case histories are visible to Sellers

These should be specified before they are treated as implementation requirements.

---

# 88. Source Traceability

## From `Admin.md`

Seller Compliance directly derives:

```text
Core Value:
Verify products, issue warning/suspension for violation.

Expanded:
moderation and compliance engine
supply-side focus
audit seller activities
audit product listings
compare against platform policies
formal warnings
temporary seller privilege suspension
permanent removal of non-compliant listings

System:
internal reporting/flagging mechanism
messaging integration for warnings
cascading database updates
hide seller products when account is suspended
```

It also integrates with documented Admin features:

```text
Dashboard
Manage User Accounts
Manage Complaints and Disputes
Manage Platform Settings
Chat/Messaging
System Audit Logs
```

## From `app.md`

Seller Compliance respects:

```text
Seller is an independent marketplace seller/tenant
one Seller account : one Shop
Seller manages products, inventory, orders, and shop
Admin manages platform-wide flow
web applications use Admin/Seller domains
```

The shared `(email, role)` identity model remains relevant to Seller account targeting.

## From `Seller.md`

Seller Compliance must coexist with Seller capabilities including:

```text
product/catalog CRUD
inventory
prices, discounts, vouchers
Seller dashboard
orders
chat/messaging
account management
review management
bulk product import/export
Vacation Mode
```

Important derived enforcement interactions:

```text
Admin moderation must override Seller product activation
bulk import cannot bypass removal
Vacation Mode must remain separate from compliance suspension
```

## From `Buyer.md`

Compliance state affects Buyer-facing product availability across:

```text
Search
Browse Shop
Cart / Checkout
Wishlist / Favorites
Recently Viewed
Product Reviews & Ratings
```

At minimum, non-compliant/hidden products must not remain normally purchasable.

Buyer reviews may provide context but are not automatically violations.

## From `Logistics.md`

Seller Compliance must not become a Logistics dispatch/parcel operations feature.

Seller suspension effects on already-entered Logistics/order flows are not defined and therefore require a separate business rule.

## From `Courier.md`

Courier operations, performance, incidents, delivery work, and Logistics-controlled rider workflows remain outside Seller Compliance.

---

# 89. Final Feature Definition

AISLEY Seller Compliance is:

```text
an Admin-only
supply-side moderation and enforcement system

that reviews:

    Seller activity
    Product listings
    Internal reports / flags

against:

    AISLEY platform policies

and enables:

    Product verification
    No-violation dismissal
    Formal Seller warnings
    Temporary Seller suspension
    Permanent product-listing removal

while integrating with:

    Dashboard
    Platform Policies
    Admin ↔ Seller Messaging
    Complaints / Disputes
    User Account status
    System Audit Logs

and enforcing consequences across:

    Seller product management
    Buyer marketplace discovery
    Cart / checkout availability

without allowing:

    Seller reactivation
    Bulk import
    Vacation Mode
    or direct API calls

to bypass Admin compliance restrictions.
```
