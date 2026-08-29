---
feature: prepare-orders
title: Seller Prepare Orders
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Prepare Orders
## WHAT
- **Purpose:** Let a Seller verify purchased items, prepare the physical parcel, generate/print its shipping label, and mark the Order ready for Logistics pickup.
- **Canonical role:** `SELLER`.
- `Seller.md` defines Prepare Orders as the fulfillment module for printing waybill/shipping details and physically preparing goods. fileciteturn87file0
- **Current AISLEY lifecycle boundary:**
```text
PLACED
→ SELLER_PROCESSING
→ READY_FOR_PICKUP
→ Logistics / downstream delivery flow
```
- The shared lifecycle explicitly defines `SELLER_PROCESSING → READY_FOR_PICKUP`, and Logistics Dashboard consumes Seller-confirmed Orders such as `READY_FOR_PICKUP`. fileciteturn88file2turn88file3
- **Source-defined flow:**
```text
Seller opens valid Order
→ verify immutable purchased items/SKUs/quantities
→ begin processing if still valid
→ pack correct items
→ enter/verify package weight/dimensions/count
→ generate versioned waybill/shipping label
→ preview/print/download
→ attach label
→ Confirm Ready for Pickup
→ Laravel validates again
→ Order becomes READY_FOR_PICKUP exactly once
→ commit
→ Logistics/Buyer status update after commit
```
- **Primary Seller route:**
```text
/seller/orders/{order}/prepare
```
- **Architecture:**
  - Next.js/React owns the preparation checklist, package form, label preview/download/print controls, and readiness confirmation UI.
  - Laravel owns Seller/Order authorization, Order-state validation, immutable purchased snapshots, package validation, label versioning, package identifier generation, transition logic, idempotency, and events.
  - Eloquent/database remains authoritative.
- **Feature boundaries:**
  - Order Notifications brings the Seller into the valid Order.
  - Prepare Orders owns `SELLER_PROCESSING` preparation and `READY_FOR_PICKUP`.
  - Inventory owns stock/reservation/fulfillment quantity effects.
  - Logistics owns the parcel after the ready-for-pickup handoff.
  - Courier pickup/delivery flows own later delivery states.
  - Confirm Delivery is only the later Seller notification after `DELIVERED`.
- **Current project interpretation of older 3PL wording:**
  - Seller source mentions generic 3PL shipping labels/carrier APIs. fileciteturn87file0
  - AISLEY currently has its own Logistics/Courier workflow.
  - Therefore an external carrier API is optional, not required for Prepare Orders.
  - The label must work with AISLEY's internal package/logistics identifiers.
- **Non-goals:**
  - assigning a Courier
  - choosing a sorting center
  - simulating Logistics transit
  - marking `PICKED_UP`, `IN_TRANSIT`, or `DELIVERED`
  - changing Buyer shipping address
  - altering purchased Product/price snapshots
  - bypassing Inventory or payment validation
## MUST
### Authentication and Seller ownership
- Preparation requires authenticated `SELLER`.
- Every Order query/mutation is Seller-scoped.
- Never trust client-submitted:
  - `seller_id`
  - Seller ownership
  - Order status
  - Buyer identity
  - purchased Product/SKU/quantity
  - label/package identity
- Another Seller cannot view/prepare the Order.
- Standard errors:
  - `401` unauthenticated
  - `403` forbidden
  - `404` Seller-scoped Order missing
  - `422` invalid package input
  - `409` stale/invalid Order state
### Preconditions
- Order must:
  - belong to Seller
  - satisfy configured payment/confirmation requirement
  - be in a Seller-preparable lifecycle state
  - not be cancelled/rejected
  - not already be picked up
- Dedicated Seller flow expects a paid/confirmed Order in Seller processing.
- Exact payment condition remains defined by Checkout/payment architecture.
### Start processing
- If a valid actionable Order is still `PLACED`, Seller may explicitly begin processing:
```text
PLACED → SELLER_PROCESSING
```
- Opening Order detail alone never triggers this.
- Transition must:
  - re-authorize Seller
  - re-read current Order
  - validate payment/state
  - reject stale/cancelled state
  - commit transactionally
- Return `409` if Order changed before action.
### Seller-processing state
- Physical preparation happens while Order is `SELLER_PROCESSING`.
- Seller cannot skip directly from `PLACED` to later Logistics/Courier states.
- Client cannot submit arbitrary `status`.
- Shared AISLEY rules require validated transition logic. fileciteturn88file3
### Purchased-item snapshots
- Show immutable purchased facts:
  - Order Item
  - Product/variant/SKU snapshot
  - quantity
  - selected options required for packing
- Do not replace Order snapshot data with current Product title/variant/price where historical correctness matters.
- Product edits after purchase must not change what Seller is expected to pack.
### Quantity verification
- Seller must be able to verify required quantities before readiness.
- UI may use a packing checklist.
- Seller does not change purchased quantity through Prepare Orders.
- Missing/damaged items use an exception/support/cancellation flow rather than silently reducing the Order.
### Inventory boundary
- Prepare Orders must not directly mutate an Inventory number ad hoc.
- Any fulfillment stock effect uses the Inventory System's authoritative action.
- Exact point where Inventory changes from reserved to fulfilled must match the Inventory spec.
- Current Inventory design defines fulfillment as decreasing both `reserved` and `on_hand`; exact triggering Order state remains an Open Question.
- Do not create a second stock-decrement path inside label generation.
### Package information
- Source flow requires Seller to enter/verify package:
  - weight
  - dimensions
  - package count
- Laravel validates all package fields.
- Recommended:
```text
weight > 0
length > 0
width > 0
height > 0
package_count >= 1
```
- Exact units, maximums, and whether dimensions are mandatory for every Order are Open.
- Store units explicitly; do not rely on implicit frontend units.
### Multi-package Orders
- Source allows package count but does not define multi-parcel semantics.
- Do not invent separate tracking/delivery tasks for each package without a final model.
- Recommended MVP:
  - one fulfillment/package record for the Seller Order
  - package count stored as metadata
  - one primary scannable fulfillment identifier
- True per-package tracking is Open.
### Package identity
- Laravel generates immutable package/fulfillment identifier(s).
- Seller/browser must not choose arbitrary IDs.
- Identifier must map back to authorized Order/package records server-side.
- Avoid directly exposing sequential database IDs as the only scannable public token when a non-guessable/reference-safe identifier is practical.
### Scannable identifier
- Source requires a scannable package identifier.
- Exact symbology is Open:
  - QR
  - Code 128
  - another repository-approved barcode
- Label scan should resolve an opaque package/waybill reference, not embed sensitive Buyer data.
- Logistics source independently expects standardized scannable routing labels. fileciteturn88file9
### Waybill / shipping label
- Generate a standardized, printable label for the prepared parcel.
- Recommended fields:
  - package/waybill reference
  - safe Seller/shop identification
  - safe destination/routing summary
  - package count
  - weight/dimensions where operationally needed
  - scannable identifier
  - generated/version timestamp
- Exact visual layout/thermal paper size is Open.
- Label must not expose unnecessary Buyer PII.
### Buyer destination
- Use the Order's immutable shipping-address snapshot.
- Do not read the Buyer's current default Address Book as label truth.
- Seller cannot edit destination through Prepare Orders.
- Any allowed pre-processing address modification must come from the authorized Buyer Order Modification workflow.
### Label privacy
- Do not encode in QR/barcode:
  - Buyer phone
  - Buyer email
  - full payment information
  - authentication data
  - arbitrary serialized Order JSON
- Human-readable destination fields should be limited to what Logistics/fulfillment actually requires.
- Exact masked contact/address format is Open.
### Label generation
- Source requires PDF/printable output.
- Exact PDF/rendering package is Open.
- Label generation must use server-authoritative Order/package data.
- React must not generate the authoritative package identifier or shipping facts.
- A browser preview may render the server-produced label/document.
### Label file storage
- Generated label may be:
  - streamed on demand, or
  - stored as a private generated asset
- If stored, keep it private and Seller-authorized.
- Laravel's filesystem supports private storage and temporary URLs for local/S3-backed files. citeturn797859search0
- Never expose a permanent unrestricted public label URL.
### Label versioning
- Dedicated source requires a **versioned** waybill/shipping label.
- Recommended:
```text
label_version = 1, 2, 3...
```
- If package/routing data that appears on the label changes:
  - invalidate/supersede prior active version
  - generate a new version
- Historical versions remain auditable according to retention policy.
- Do not silently mutate the contents represented by an existing printed version.
### Label snapshot
- A generated label version should preserve the relevant generation snapshot:
  - package reference
  - destination/routing representation
  - dimensions/weight/count
  - generated timestamp
- This explains what was physically printed at that time.
### Preview / download / print
- Seller can preview then print/download the current valid label.
- Printing/downloading does not change Order state.
- Seller may reprint while authorized and while label remains valid.
- Reprint does not create another Order or fulfillment cycle.
### Reprint audit
- Dedicated flow explicitly requires reprinting to be audited.
- Recommended record/event:
```text
label_id/version
seller_id
printed/downloaded_at
action = PRINT | DOWNLOAD | REPRINT
```
- Do not store unnecessary device/browser fingerprints.
- Exact audit granularity is Open.
### Packing slip
- `Seller.md` mentions packing slips in the expanded definition. fileciteturn87file0
- Packing slip may be:
  - a section of the generated document, or
  - a separate printable artifact
- Exact format is Open.
- Packing slip should show Seller-owned Order Item snapshots needed to pack correctly.
### Confirm Ready for Pickup
- This is the critical Seller completion action.
- Conceptual transition:
```text
SELLER_PROCESSING
→ READY_FOR_PICKUP
```
- Laravel must revalidate:
  - Seller ownership
  - current Order state
  - payment validity
  - required package fields
  - current valid label/version
  - no cancellation/rejection
  - no already-picked-up state
  - any required Inventory/fulfillment precondition
- React cannot force readiness by sending `status=READY_FOR_PICKUP`.
### Transaction / locking
- Readiness transition is transactional.
- Use row lock or equivalent atomic transition if concurrent cancellation/readiness is possible.
- Laravel 13 documents `lockForUpdate()` and recommends using pessimistic locks inside transactions. citeturn893980search1
- Re-read Order after locking before transition.
- Competing stale action returns `409`.
### Idempotency
- Ready-for-pickup confirmation must be idempotent.
- Double click/retry cannot create duplicate:
  - `READY_FOR_PICKUP` transitions
  - Logistics tasks/events
  - Buyer status updates
  - Inventory fulfillment effects
- Recommended stable source action/idempotency key.
- Existing `READY_FOR_PICKUP` state should reconcile to committed result.
### READY_FOR_PICKUP event
- After successful transition emit a domain event such as:
```text
OrderReadyForPickup
```
- Event includes safe Seller Order/package reference(s).
- Logistics derives the Order from authoritative records, not browser-supplied Logistics IDs.
- Event is emitted only for committed state.
### Logistics handoff
- Logistics Dashboard source explicitly consumes Seller-confirmed Orders such as `READY_FOR_PICKUP`. fileciteturn88file2
- This event makes the parcel visible/actionable to Logistics.
- Prepare Orders does not:
  - choose destination sorting center
  - start simulated transfer
  - assign Courier
  - confirm Logistics physical receipt
- Those belong to Logistics.
### After-commit behavior
- Logistics/Buyer/broadcast/notification follow-up happens after readiness commits.
- Shared AISLEY rules require events/notifications after commit. fileciteturn88file3
- Laravel queue `after_commit` / `afterCommit()` prevents workers from consuming rolled-back state. citeturn893980search0
### Buyer status
- Buyer Order Status should reflect Seller processing and readiness from the same canonical Order state.
- Do not create a separate Buyer-only `TO_SHIP` persisted state.
- Presentation labels may map:
```text
SELLER_PROCESSING / READY_FOR_PICKUP
→ "To Ship" / equivalent
```
- Exact label is Buyer UI policy.
### Stale / invalid Orders
- Reject preparation/readiness for:
  - cancelled Order
  - rejected Order
  - payment-invalid Order
  - already picked-up Order
  - stale Order version
  - unauthorized Seller
- Do not "repair" these by overwriting status.
### Missing/damaged inventory
- Source explicitly says missing/damaged inventory must not be falsely marked ready.
- Seller should use the project-approved exception/support/cancellation path.
- Exact shortage/damage workflow is Open.
- Prepare Orders may expose a link/action entry point, but does not invent the resolution lifecycle.
### External carrier integration
- Generic Seller source mentions carrier APIs for labels. fileciteturn87file0
- Current AISLEY internal Logistics means this is optional.
- If a carrier is later added:
  - keep internal `READY_FOR_PICKUP` canonical
  - translate carrier label/reference into the same package model
  - do not create carrier-specific Order statuses
- External API failure must not partially commit invalid readiness.
### Frontend states
- Preparation: loading, eligible, processing, stale/cancelled/payment-invalid, error.
- Package: editing, validating, saving, saved, validation error.
- Label: not-generated, generating, ready, superseded, failed.
- Ready action: idle, submitting, success, conflict.
### Accessibility
- Label checklist/package/label/readiness controls, support keyboard use, avoid color-only states, and make validation/conflicts field/action-specific.
### Acceptance criteria
- [ ] Seller can prepare only Seller-owned valid Orders.
- [ ] Purchased Product/SKU/quantity data comes from immutable Order snapshots.
- [ ] Opening preparation does not silently advance Order state.
- [ ] Valid begin-processing action moves `PLACED → SELLER_PROCESSING`.
- [ ] Seller can record required package weight/dimensions/count.
- [ ] System generates a versioned printable label with a scannable, non-sensitive package identifier.
- [ ] Print/reprint does not change Order status and reprints are auditable.
- [ ] Data changes requiring a new label create a new label version.
- [ ] Missing/damaged or cancelled/payment-invalid Orders cannot be marked ready.
- [ ] Ready confirmation transitions only `SELLER_PROCESSING → READY_FOR_PICKUP`.
- [ ] Concurrent/retried ready actions create one logical transition/event.
- [ ] Logistics sees the committed ready parcel through the downstream event/read model.
- [ ] Buyer status uses the same committed Order state.
- [ ] Seller cannot assign Courier or perform Logistics transport actions here.
## HOW
### Project findings
- `Seller.md` requires printable waybill/shipping details and physical fulfillment preparation. fileciteturn87file0
- Dedicated Prepare Orders flow adds immutable Order Item display, package measurements/count, versioned scannable label, audited reprints, and the `READY_FOR_PICKUP` transition.
- Shared lifecycle defines `PLACED → SELLER_PROCESSING → READY_FOR_PICKUP`. fileciteturn88file3
- Logistics Dashboard explicitly lists Seller-confirmed `READY_FOR_PICKUP` parcels. fileciteturn88file2
- Therefore AISLEY's internal Logistics flow supersedes the assumption that Prepare Orders requires an external 3PL.
- Sources do not define label layout/library, barcode type, package units/limits, multi-package tracking, shortage resolution, or exact Inventory-consumption state.
### Recommended Laravel API
```http
GET  /api/seller/orders/{order}/preparation
POST /api/seller/orders/{order}/start-processing
PUT  /api/seller/orders/{order}/package
POST /api/seller/orders/{order}/labels
GET  /api/seller/orders/{order}/labels/{label}
POST /api/seller/orders/{order}/labels/{label}/reprint
POST /api/seller/orders/{order}/ready-for-pickup
```
- Exact grouping can be simplified to repository conventions.
- Use Seller Policies/scoped queries, Form Requests, API Resources, transactions, and idempotency.
### Recommended model
```text
order_packages
- id
- seller_order_id
- package_reference
- weight + unit
- length/width/height + unit
- package_count
- current_label_version
- timestamps

shipping_labels
- id
- order_package_id
- version
- asset_id/reference nullable
- label_snapshot
- generated_at
- superseded_at nullable
```
- Existing shipment/package models should be reused instead of duplicating them.
### Recommended actions
```text
StartSellerOrderProcessing
UpdateSellerOrderPackage
GenerateShippingLabel
RecordShippingLabelReprint
MarkOrderReadyForPickup
```
- `MarkOrderReadyForPickup` owns the lifecycle transition.
- Label-generation code must not mutate Order status implicitly.
### Readiness transaction
```text
Seller confirms ready
→ load Seller-scoped Order
→ transaction
→ lock Order
→ revalidate SELLER_PROCESSING/payment/package/label
→ validate Inventory/exception prerequisites
→ transition READY_FOR_PICKUP
→ persist status event
→ commit
→ OrderReadyForPickup after commit
→ Logistics + Buyer projections refresh
```
- Laravel provides transaction-safe pessimistic row locking through `lockForUpdate()`. citeturn893980search1
### Label generation recommendation
- Generate from a dedicated server-side label DTO/view/template.
- Keep scannable payload opaque/minimal:
```text
package_reference
```
rather than Buyer/order JSON.
- PDF/thermal-rendering dependency is an implementation choice.
- If file is stored, use configured private filesystem and short-lived authorized URLs. Laravel's filesystem supports private local storage and `temporaryUrl()`. citeturn797859search0
### Events
Recommended:
```text
SellerOrderProcessingStarted
ShippingLabelGenerated
OrderReadyForPickup
```
- Optional `ShippingLabelReprinted` for audit/telemetry.
- Logistics reacts to committed `OrderReadyForPickup`.
- Queue/broadcast/notifications execute after commit. citeturn893980search0
### Next.js / React
```text
/seller/orders/[order]/prepare
├── PurchasedItemsChecklist
├── PackageDetailsForm
├── ShippingLabelPreview
├── PrintDownloadActions
└── ConfirmReadyForPickup
```
- Use the shared Laravel API client.
- Client validation is UX-only; Laravel decides eligibility/transitions.
### Tests
- **Laravel:** Seller isolation; state/payment preconditions; start-processing; immutable snapshots; package validation; label generation/versioning; reprint audit; cancelled/payment-invalid/stale rejection; ready idempotency/concurrency; Logistics event after commit.
- **Cross-role:** `READY_FOR_PICKUP` becomes visible to Logistics and Buyer status from the same committed Order state.
- **Frontend:** checklist/package/label states; print/reprint; invalid package; stale `409`; readiness success; accessibility.
### Risks
- **False/duplicate readiness:** weak state validation or idempotency can send invalid/duplicate work to Logistics.
- **Label/privacy:** missing versioning or public/scannable PII can mismatch parcels or leak Buyer data.
- **Domain/Inventory duplication:** carrier-specific states or duplicate stock consumption can diverge from canonical Order/Inventory truth.
### Open questions
- Label/PDF library, page size, barcode type.
- Package units/limits and multi-parcel tracking.
- Label-safe Buyer fields and packing-slip format.
- Exact Inventory fulfillment trigger and missing/damaged-item flow.
- Label retention and future external-carrier support.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture: `README.md`
- Seller source: `Seller.md`
- Logistics source: `Logistics.md`
- Seller flow: `feature-system-flows/seller/prepare-orders.md`
- Laravel Queues / after commit: https://laravel.com/docs/12.x/queues
- Laravel Query Builder / locking: https://laravel.com/docs/13.x/queries
- Laravel Filesystem / temporary URLs: https://laravel.com/docs/filesystem
