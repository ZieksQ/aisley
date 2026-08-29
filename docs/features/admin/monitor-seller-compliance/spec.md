---
feature: monitor-seller-compliance
title: Admin Monitor Seller Compliance
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Admin
scope: Admin Web Application
---
# Admin Monitor Seller Compliance
## WHAT
- **Purpose:** Let authorized Admins review seller activity and product listings against AISLEY platform policies, record violations, issue formal warnings, suspend seller privileges, and remove non-compliant listings.
- **Primary actor:** Authenticated `ADMIN`.
- **Affected actor:** Existing AISLEY `SELLER` accounts and their product listings.
- **Source-defined capabilities:**
  - audit seller activities and product listings against platform policies
  - verify product/listing compliance
  - record/flag violations
  - issue formal warnings
  - temporarily suspend seller privileges
  - permanently remove non-compliant product listings
  - communicate warnings through the shared messaging system
  - hide seller products when the seller is suspended
- **Architecture:**
  - Next.js/React owns compliance queue, seller/product review views, evidence/context display, warning/suspension/removal confirmations, and UI states.
  - Laravel owns authentication, authorization, compliance rules, state transitions, persistence, cascading visibility effects, notifications/messages, and audit records.
  - Laravel/database state is authoritative.
- **Recommended moderation flow:**
```text
seller/product is reported or selected for review
→ Admin reviews seller + listing + relevant evidence/context
→ no violation
   → close/clear review
or
→ violation confirmed
   → warning
   → product removal
   → seller suspension
   → combination allowed only when explicitly selected and valid
→ persist action/history
→ update listing/seller visibility
→ notify/message seller after commit
```
- **Important separation:**
```text
PRODUCT ACTION
remove/hide one non-compliant listing

SELLER ACTION
temporarily suspend seller privileges
→ all seller listings become unavailable to buyers
```
- Removing one product must not automatically suspend the seller.
- Suspending a seller may make all of the seller's products unavailable while suspension is active.
- **Feature boundaries:**
  - Seller owns normal catalog/inventory CRUD.
  - Admin Seller Compliance owns policy-based moderation overrides.
  - Manage User Accounts owns general account lifecycle management.
  - Complaints/Disputes may provide a source/reference for a compliance review.
  - Chat/Messaging owns delivery/archive of Admin ↔ Seller warning messages.
  - Global Ban remains a separate security blocklist.
  - Platform Settings owns the policies against which compliance may be evaluated.
- **Recommended routes:**
```text
/seller-compliance
/seller-compliance/sellers/{seller}
/seller-compliance/products/{product}
```
- **Non-goals:**
  - automatically deciding policy violations
  - automated image/content moderation
  - changing seller inventory/price on the seller's behalf
  - deleting order/payment history
  - refunding buyers
  - globally banning seller IP/payment methods
  - inventing prohibited-product categories not defined by AISLEY policies
  - permanent seller-account deletion
## MUST
### Access control
- Every Seller Compliance endpoint requires:
  - authenticated session
  - persisted role = `ADMIN`
  - Seller Compliance permission when custom Admin permissions exist
- Laravel authorization is authoritative.
- Frontend visibility is not authorization.
- Direct API requests cannot bypass moderation permissions.
- Use project-standard:
  - `401` unauthenticated
  - `403` forbidden
  - `404` scoped seller/product/review not found
  - `422` validation error
  - `409` stale/invalid transition
### Compliance source of truth
- Platform compliance rules/policies must come from approved AISLEY policy/configuration sources.
- Do not hard-code a second contradictory rule set only in React.
- If Manage Platform Settings stores enforceable seller/product rules, Seller Compliance should reference the applicable policy/version where practical.
- Current sources do not define:
  - prohibited-product taxonomy
  - category-matching rules
  - severity levels
  - strike thresholds
  - automatic suspension thresholds
- These must remain configurable/open rather than invented as mandatory behavior.
### Review queue
- Admin must be able to list seller/product items requiring or eligible for compliance review.
- The source requires an internal reporting/flagging mechanism.
- Review candidates may originate from:
  - internal flag/report
  - complaint/dispute reference
  - manual Admin review
  - future automated detection when separately implemented
- List must be paginated.
- Recommended allow-listed filters:
  - review status
  - seller
  - product
  - violation/reason category when defined
  - created/reported date
- Safe list summary may include:
  - review/flag ID
  - seller ID/display name
  - product ID/title when product-specific
  - source/reference
  - review state
  - created timestamp
- Do not expose unnecessary PII or full private evidence in list payloads.
### Review detail
- Admin must be able to inspect an authorized review.
- Detail may include:
  - seller summary
  - product/listing data relevant to the policy check
  - current product visibility/moderation state
  - current seller compliance/account state
  - applicable policy/reference
  - report/flag source
  - evidence references when present
  - prior warnings/compliance actions
- Related seller/product/evidence IDs must be validated server-side.
- Do not trust relationships supplied by the frontend.
### Compliance review record
- Recommended persisted review/action history should identify:
  - immutable review/action ID
  - seller ID
  - product ID when applicable
  - source/reference when applicable
  - violation/reason
  - policy/version reference when available
  - Admin actor
  - action
  - timestamp
- Previous compliance actions must not be overwritten.
- Use history/event records so repeated warnings/removals/suspensions remain attributable.
### Product moderation
- Admin may permanently remove a product listing for a confirmed policy violation.
- Product moderation must be an explicit server-side action, not arbitrary product field editing.
- Recommended conceptual action:
```text
removeProductForCompliance(product, reason)
```
- Product removal must:
  - authorize Admin
  - validate product/seller relationship
  - validate current moderation state
  - store reason/reference
  - make the listing unavailable to Buyer discovery/purchase
  - preserve historical product references needed by existing orders/reviews/disputes
  - record audit/compliance history
- "Permanently remove listing" should not mean destructive deletion of historical order data.
- Prefer a moderation/visibility state or soft-removal behavior that prevents new sales while retaining required historical references.
- Seller must not be able to make an Admin-removed product public again through normal Seller CRUD.
- Restoring an Admin-removed product is not required unless a separate appeal/reinstatement workflow is defined.
### Seller warning
- Admin may issue a formal warning for a confirmed violation.
- Warning must:
  - reference the seller
  - record violation/reason
  - record Admin actor/timestamp
  - persist compliance history
  - communicate the warning to the seller
- Use the shared Chat/Messaging system for warning communication as required by `Admin.md`.
- Prefer storing a message/conversation reference instead of duplicating complete message text into compliance history.
- Notification/message failure must not erase a committed compliance action.
- Exact warning severity/strike model is an Open Question.
### Seller suspension
- Admin may temporarily suspend seller privileges for a violation.
- Suspension must:
  - authorize Admin
  - validate current seller state
  - record reason
  - record Admin/timestamp
  - be transactional
  - trigger the required product-visibility consequence
- Seller suspension must make the seller's active listings unavailable to Buyer discovery/purchase.
- The visibility rule must be enforced by Laravel queries/business rules, not only by hiding products in React.
- Existing order/history records must remain accessible to authorized workflows.
- Do not delete seller products merely because the seller is suspended.
- Exact seller capabilities during suspension are Open Questions:
  - login
  - view existing orders
  - fulfill already-placed orders
  - chat/support
  - reports
  - edit catalog
- Suspension duration/expiration is an Open Question.
- Restoration/reactivation must coordinate with Manage User Accounts if seller lifecycle state is shared there.
### Product visibility
- Buyer-facing product APIs must exclude listings that are:
  - explicitly removed by Admin compliance
  - owned by a seller whose active suspension makes listings unavailable
- Do not rely on search UI filtering alone.
- Centralize visibility rules in reusable Laravel query scopes/services.
- Existing order line items must retain historical product information even if the listing is later hidden.
- Wishlist/cart/checkout must revalidate product availability so a previously visible item cannot still be purchased after removal/suspension.
### Seller catalog boundary
- Seller normal Product/Inventory CRUD remains seller-owned.
- Admin compliance may override buyer-facing availability.
- Seller must not be able to overwrite:
  - compliance removal state
  - compliance reason
  - Admin moderation metadata
- Normal seller archive/vacation behavior and Admin compliance removal are distinct states.
- Vacation Mode hides listings voluntarily; compliance suspension/removal is an Admin enforcement action.
### Concurrency
- Admin and Seller may update a product around the same time.
- Two Admins may moderate the same review/product/seller.
- Compliance mutations must:
  - run transactionally
  - re-check current state
  - use row locking/atomic update/version checks when appropriate
- If state changed:
  - do not overwrite newer moderation state
  - return `409`
  - refetch current record
- Duplicate moderation requests must not create duplicate side effects/messages.
### Cross-feature sanctions
- Seller Compliance must not bypass other domains.
- If a compliance case requires:
  - general account lifecycle action → Manage User Accounts
  - Global Ban → Global Ban service
  - dispute resolution → Complaints/Disputes
- Use the owning action/service and its authorization/business rules.
- Do not mutate unrelated status tables directly from a generic compliance payload.
### Notifications and messaging
- Warning communication uses the shared Admin Chat/Messaging capability.
- Suspension/product-removal actions should notify the seller when project notification policy requires it.
- Dispatch messages/notifications after the compliance transaction commits.
- A notification failure must not roll back the moderation action.
- Seller-facing communication may contain an approved user-visible reason.
- Internal notes/security evidence must remain private.
### Audit trail
- Every compliance mutation must be auditable.
- Safe audit metadata:
  - Admin ID
  - seller ID
  - product ID when applicable
  - action
  - previous/new moderation state
  - reason/reference
  - timestamp
- Do not duplicate full evidence files/private messages into the audit log.
- Compliance history and System Audit Logs may reference one another by IDs.
### Evidence
- If a review originates from a complaint/report:
  - reuse authorized evidence references
  - do not copy raw files unnecessarily
- Evidence access must follow the shared private-file rules.
- Seller Compliance must not gain access to unrelated complaint evidence.
- Evidence mutation belongs to its source feature.
### Dashboard integration
- Admin Dashboard may show unresolved compliance counts/action items.
- Dashboard does not perform compliance decisions.
- After moderation, Dashboard should eventually reflect authoritative updated state.
- Broadcast/refetch behavior follows Dashboard infrastructure.
### Frontend states
- Queue: loading, empty, loaded, error, forbidden.
- Review detail: loading, loaded, evidence error, stale/conflict, error.
- Warning/removal/suspension:
  - confirmation
  - validation error
  - submitting
  - success
  - conflict
  - failure
- Do not optimistically display a final moderation state.
- On `409`, refetch seller/product/review state.
- High-impact confirmation must clearly identify seller/product/action/reason.
### Accessibility
- Queue, detail, policy references, and action controls require keyboard navigation.
- Moderation status cannot rely on color alone.
- Confirmation dialogs must identify the target and consequence.
- Validation/conflict errors must be accessible.
### Acceptance criteria
- [ ] Guest cannot access Seller Compliance.
- [ ] Non-Admin cannot use Admin compliance APIs.
- [ ] Custom Admin permission is enforced.
- [ ] Compliance queue is paginated/filterable.
- [ ] Admin can inspect an authorized seller/product review.
- [ ] Compliance history preserves actor/action/timestamp.
- [ ] Product removal prevents new buyer discovery/purchase.
- [ ] Product removal preserves historical order/review references.
- [ ] Seller cannot undo an Admin compliance removal through normal product editing.
- [ ] Warning is persisted and communicated through shared messaging.
- [ ] Seller suspension makes applicable listings unavailable.
- [ ] Suspension does not destructively delete products/order history.
- [ ] Wishlist/cart/checkout revalidate availability after moderation.
- [ ] Concurrent moderation cannot silently overwrite newer state.
- [ ] Duplicate action does not duplicate side effects.
- [ ] Cross-feature sanctions use owning domain rules.
- [ ] Notification/message failure does not roll back committed moderation.
- [ ] Compliance action is auditable.
- [ ] Restricted PII/evidence is absent from list DTOs.
- [ ] UI handles empty, forbidden, conflict, validation, success, and failure states.
## HOW
### Project findings
- `Admin.md` defines Seller Compliance as auditing seller activity/product listings against policy, issuing warnings, suspending sellers, and permanently removing non-compliant listings. fileciteturn13file0
- It explicitly requires an internal reporting/flagging mechanism, messaging integration for warnings, and cascading visibility updates such as hiding products when a seller is suspended. fileciteturn13file0
- `Seller.md` establishes seller-owned catalog/inventory management and Vacation Mode, so Admin moderation state must remain distinct from normal seller edits/voluntary hiding. fileciteturn13file4turn13file2
- `README.md` requires Laravel-owned authorization, validated transitions, transactions, query scoping, audit history, pagination, and post-commit side effects. fileciteturn13file9turn13file8
- Exact policy taxonomy, product schema, seller lifecycle enum, report source, suspension duration, and appeal workflow are not defined by available sources.
### Laravel data model
Recommended conceptual schema:
```text
seller_compliance_reviews
- id
- seller_id
- product_id nullable
- source_type/reference nullable
- status
- violation_code nullable
- policy_version_id nullable
- created_at
- updated_at

seller_compliance_actions
- id
- review_id nullable
- seller_id
- product_id nullable
- admin_id
- action
- reason
- created_at
```
- Product needs an Admin-owned moderation/visibility state or equivalent.
- Seller needs a suspension/lifecycle state either here or through the centralized account-status domain.
- Do not duplicate seller/account status if Manage User Accounts already owns the canonical field.
- Add indexes for review status, seller, product, and moderation visibility queries.
### Laravel API
Conceptual endpoints:
```http
GET  /api/admin/seller-compliance
GET  /api/admin/seller-compliance/{review}
POST /api/admin/seller-compliance/{review}/warn
POST /api/admin/seller-compliance/{review}/remove-product
POST /api/admin/seller-compliance/{review}/suspend-seller
```
- Exact URLs follow repository conventions.
- Use Form Requests, Policies/Gates, API Resources.
- Suggested actions:
  - `IssueSellerWarning`
  - `RemoveProductForCompliance`
  - `SuspendSellerForCompliance`
- Keep controllers thin.
- Use explicit action endpoints rather than generic `PATCH status`.
### Visibility implementation
- Centralize buyer-visible product logic in an Eloquent scope/query service, e.g. conceptually:
```text
Product::visibleToBuyers()
```
- The scope should account for product publication/stock rules plus compliance removal and seller suspension.
- Apply the same authoritative availability rule to:
  - search
  - shop browse
  - product detail
  - cart validation
  - checkout validation
- Laravel local/global scopes can encapsulate reusable query constraints, but use a global scope only if every normal product query truly requires the restriction.
- Admin/reporting/history queries may need explicit access to moderated products.
### Transactions and locking
- Wrap moderation state + history/audit mutations in a transaction.
- Re-check current review/product/seller state inside the transaction.
- Laravel provides `lockForUpdate()` for pessimistic locking where concurrent edits are meaningful. citeturn510017search7
- Avoid holding locks during message delivery or external work.
### Notifications / messaging
- After commit, send the Seller warning/decision through the shared messaging/notification infrastructure.
- Laravel queue configuration can defer queued notifications, listeners, mailables, and broadcasts until after the transaction commits. citeturn510017search1
- Compliance history stores the message/conversation reference when useful rather than duplicating all chat text.
### Authorization
- Use Policies for seller/product/review resource actions.
- Laravel's authorization model distinguishes authentication from permission to mutate a specific resource. citeturn510017search12
- Apply separate capabilities where useful:
  - view compliance
  - issue warning
  - remove product
  - suspend seller
### Safe responses
- Use dedicated API Resources.
- Laravel supports hidden/visible serialization controls, but purpose-specific Resources should determine the Admin compliance DTO. citeturn510017search6
- Do not serialize seller secrets, payout credentials, private documents, or unrelated personal data.
### Next.js / React
- Build:
  - compliance queue
  - seller/product review detail
  - prior compliance history
  - warning form
  - product-removal confirmation
  - seller-suspension confirmation
- Use shared API client.
- Keep policy/status decisions server-authoritative.
- After successful action:
  - refetch review
  - refetch affected seller/product summary
  - refresh Dashboard compliance count when integrated
- On `409`, refetch current state before allowing another action.
### Tests
- **Laravel:** guest/non-Admin/permission denial; queue filters/pagination; safe review DTO; warning; product removal; seller suspension; invalid/concurrent transitions; seller cannot republish removed listing; buyer/search/cart/checkout visibility enforcement; historical references; audit/history; after-commit messaging.
- **Frontend:** queue/detail/history; filters; warning/removal/suspension confirmation; validation; duplicate-submit prevention; conflict refresh; forbidden state; refreshed visibility/status; accessibility.
### Research-backed recommendations
- Use Laravel Policies for resource-specific moderation authorization. citeturn510017search12
- Centralize buyer-visible product filtering in reusable Eloquent query scopes/services.
- Use transactions and row/atomic locking for conflicting moderation updates. citeturn510017search7
- Dispatch warning/notification side effects after commit. citeturn510017search1
- Preserve moderated products needed by historical orders instead of destructive deletion.
### Risks
- **Visibility bypass:** hiding only in search may leave cart/direct purchase paths open.
- **Seller override:** normal seller CRUD may accidentally reactivate removed listings.
- **State collision:** compliance suspension may conflict with Manage User Accounts.
- **Historical loss:** hard deletion can break orders/reviews/disputes.
- **Policy ambiguity:** undefined violation categories create inconsistent moderation.
- **Concurrency:** Seller/Admin or two Admins can overwrite state.
- **Messaging coupling:** message failure must not reverse moderation.
- **Overreach:** one violation must not trigger unsupported sanctions automatically.
### Open questions
- Policy/prohibited-category rules and how reviews/flags originate.
- Review-state enum and warning severity/strike/expiry behavior.
- Suspension duration, restoration, allowed seller activity, and canonical status owner.
- Product moderation state plus appeal/restoration behavior.
- Seller-facing reason taxonomy.
- Existing-cart and already-paid-order behavior after moderation.
- Complaint → compliance-review integration.
- Dashboard compliance-count definition.
- Future automated moderation/flagging.
### Sources
- Project feature-spec rules: `SKILL.md`
- AISLEY architecture/system-flow contract: `README.md`
- Admin feature model: `Admin.md`
- Seller feature model: `Seller.md`
- Laravel Authorization: https://laravel.com/docs/12.x/authorization
- Laravel Query Builder / row locking: https://laravel.com/docs/13.x/queries
- Laravel Queues / after-commit: https://laravel.com/docs/12.x/queues
- Laravel Eloquent Serialization: https://laravel.com/docs/12.x/eloquent-serialization
