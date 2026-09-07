# Order and Logistics Flow Decision Worksheet

**Status:** Open — working document for resolving cross-document decisions

## Purpose

The revised domain and workflow documents describe the same intended order journey, but several decisions are still open before first-party shipment and delivery operations are implemented. Use this worksheet to record the project decision for each item.

For every decision:

1. Mark one option as selected by changing its checkbox to `[x]`.
2. Add the decision and rationale in the decision record.
3. Copy the accepted rule into the affected source documents listed below.

This worksheet is not an implementation specification until the decisions are accepted and reflected in those source documents.

## Baseline flow already agreed

```text
Customer places order
  → placed
Seller processes and prepares the order
  → seller_processing → ready_for_pickup
First-mile Courier collects it from the Seller
  → picked_up_from_seller
Logistics receives and processes it at the sole hub
  → received_at_hub → sorted_at_hub → in_transfer
Logistics dispatches it and assigns final-mile Courier
  → dispatched_from_hub → delivery_assigned
Final-mile Courier collects it from the hub and delivers it
  → picked_up_from_hub → in_transit → out_for_delivery → delivered
```

First-mile and final-mile assignments are independent. Completing one leg does not grant or require the other leg for the same Courier.

The current high-level `OrderStatus` remains separate from detailed Shipment and Delivery Task milestones. At present, `assigned` means the parcel has been received/accepted at the Logistics hub, while `picked_up` means final-mile pickup from that hub.

## Decisions required before shipment implementation

### 1. Operational shipment records

The schema currently defers `Shipment`, `Parcel`, `Waybill`, `Scan`, `DeliveryTask`, assignment, and proof-of-delivery records. The requirements describe these as part of the target logistics flow, so decide whether to keep the deferral or begin the shared operational schema.

- [ ] Keep these records deferred while only auth and dashboard scaffolds are implemented.
- [x] Define and implement the complete shared operational schema before implementing Logistics/Courier actions. **(Recommended)**
- [ ] Implement the records incrementally, beginning with the parcel and delivery-task contract.

  **Decision:** First reconcile `docs/workspace.md`, `docs/schema.md`, and the affected domain/spec files into one consistent operational flow. Then define and implement the complete
  shared operational schema before implementing any Logistics/Courier shipment actions.  
  **Rationale/constraints:** Any feature that affects Shipments, Parcels, Waybills, Scans, Delivery Tasks, assignments, proof of delivery, fulfillment, or related statuses must pause until the shared contract is resolved. If a requested change affects this flow, warn the requester and update the affected documentation before coding.

**Affected documents:** `docs/schema.md`, `docs/workspace.md`, Logistics/Courier operational specs, Seller Prepare Orders.

### 2. First-mile task creation and assignment

Seller Prepare Orders ends at `ready_for_pickup`, but the documents do not yet name the actor that creates and offers the first-mile task.

- [x] Logistics creates the first-mile task and offers/assigns it to an eligible Courier after `ready_for_pickup`. **(Recommended)**
- [ ] The system automatically creates the task when the Seller marks the order `ready_for_pickup`; Logistics manages eligibility and offers.
- [ ] The Seller creates or assigns the first-mile task. (This would require changing the current role boundaries.)

  **Decision:** The selected Logistics organization creates the first-mile task and offers it to an eligible Courier after `ready_for_pickup`.  
  **Trigger:** The Seller marks the Order `ready_for_pickup`, the Order has a selected Logistics organization, and no active first-mile task already exists.  
  **Actor allowed to assign:** An authorized Logistics account belonging to the selected Logistics organization.

**Affected documents:** `docs/domains/Logistics.md`, `docs/domains/Courier.md`, `docs/features/seller/prepare-orders/spec.md`, Logistics deploy-rider/task specs, `docs/schema.md`.

### 3. Waybill and package-label ownership

Seller Prepare Orders describes a Seller-generated/versioned shipping label, while the Logistics Waybill material describes Logistics-generated waybill identifiers. Decide whether these are one artifact or two linked artifacts.

- [x] Seller creates the package label; Logistics creates the operational waybill when the parcel is received at the hub. Link both with an immutable order/parcel reference. **(Recommended)**
- [ ] Seller creates the single waybill used by every leg; Logistics only scans and updates it.
- [ ] Logistics creates the single waybill before first-mile pickup from Seller.

  **Decision:** Seller creates the package label; Logistics creates the operational waybill when the parcel is received at the hub. Link both with an immutable Order/Parcel reference.  
  **Who creates each identifier:** The Seller creates the package-label identifier containing the Order/Parcel reference, package details, Shop pickup address, and destination information taken from the immutable Customer checkout snapshot. Logistics creates the operational waybill identifier and records hub, sorting, routing, and Courier assignment information.  
  **When it becomes immutable(Seller):** The Seller may revise the package label until the Order is confirmed as `ready_for_pickup`. Once `ready_for_pickup` is confirmed, the active label version is frozen. After first-mile pickup (`picked_up_from_seller`), the label and handoff history cannot be overwritten.  
  **When it becomes immutable(Logistics):** Logistics creates the operational waybill when the parcel reaches `received_at_hub`; its identifier and Order/Parcel link are immutable from creation. Routing and Courier assignments may change before final-mile pickup (`picked_up_from_hub`), but each change must be recorded as a new event. After `picked_up_from_hub`, the final-mile assignment and custody history cannot be overwritten.

**Affected documents:** Seller Prepare Orders, Logistics Waybill, `docs/schema.md`, `docs/workspace.md`, `docs/domain/Courier.md`, Customer tracking.

### 4. Inventory reservation, fulfillment, and release

Checkout currently reserves inventory at placement, but the event that converts a reservation into fulfilled stock is not finalized.

- [x] Convert `reserved` to fulfilled when first-mile pickup succeeds (`picked_up_from_seller`); release the reservation when cancellation occurs before pickup. **(Recommended)**
- [ ] Convert it when the Seller marks `ready_for_pickup`.
- [ ] Convert it only after final delivery (`delivered`).

  **Decision:** Convert the reserved SKU quantity to fulfilled/committed inventory when first-mile pickup succeeds (`picked_up_from_seller`). Release the reservation when an eligible cancellation or rejection is committed before pickup.  
  **Reservation release rule:** Release only the SKU quantities reserved for an Order when its cancellation or rejection is committed before `picked_up_from_seller`. The release must be transactional and idempotent, so retries or duplicate requests cannot release the same quantity twice. After `picked_up_from_seller`, inventory must not be automatically released. The fulfillment transition must also avoid decrementing `on_hand` twice.  
  **Return/refund rule:** Return and refund behavior is deferred pending approval. No post-pickup cancellation, delivery-failure, return, refund, or automatic inventory restoration is defined yet.  
  **Partial-fulfillment rule:** Partial fulfillment is deferred. Line-level reservation, fulfillment, cancellation, return, and refund behavior must be defined before partial fulfillment is supported.

**Affected documents:** `docs/schema.md`, Customer Checkout/Order Creation, Seller Prepare Orders, Inventory, Low-Stock Alerts, Customer Order Modification/Cancellation.

### 5. Payment status and the initial order state

The shared status list includes `pending_payment`, but the implemented COD flow creates `placed` with `payment_status = pending`.

- [x] Keep `pending_payment` for future payment methods and document that current COD orders begin at `placed`; keep payment state in `payment_status`. **(Recommended)**
- [ ] Make every order pass through `pending_payment` before `placed`, including COD.
- [ ] Remove `pending_payment` from the shared order status contract and use payment fields only.

  **Decision:** Keep `pending_payment` for future payment methods. Current COD orders skip `pending_payment` and begin at `placed`; payment state is tracked separately through
  `payment_status`.  
  **Current COD rule:** A successful COD checkout atomically creates the Order with `OrderStatus = placed` and `payment_status = pending`, records the initial `placed` event, and reserves the requested inventory. Checkout does not wait for an online payment provider. Payment-status transitions after delivery or cash collection will be defined when the payment policy is implemented.

**Affected documents:** `docs/schema.md`, `docs/workspace.md`, Customer Checkout/Order Creation, Customer Order Status, payment-related requirements.

### 6. Meaning of high-level `assigned` and `picked_up`

The current high-level order contract uses `assigned` for hub receipt and `picked_up` for final-mile hub pickup. Detailed physical states use `delivery_assigned` and `picked_up_from_hub`.

- [x] Keep the current high-level values for compatibility and document the mapping clearly; use detailed Shipment/Delivery Task states for physical milestones. **(Recommended)**
- [ ] Rename the high-level values to explicit hub/delivery names in a future versioned migration.
- [ ] Remove physical milestones from `OrderStatus` entirely and expose them only through Shipment/Delivery Task timelines.

  **Decision:** Keep the current high-level `OrderStatus` values for compatibility. Use detailed Shipment and Delivery Task states for physical Logistics and Courier milestones. The normal transition into Logistics ownership is `ready_for_pickup → assigned`, where `assigned` means the parcel was received and accepted at the Logistics hub.

  **Customer-facing label mapping:**
  - `pending_payment` → **To Pay** (future online-payment flow; current COD orders skip this state)
  - `placed`, `seller_processing`, `ready_for_pickup` → **To Prepare**
  - `assigned`, `picked_up`, `in_transit` → **To Ship**
  - `out_for_delivery` → **Out for Delivery**
  - `delivered` → **Completed**
  - `cancelled`, `rejected`, `delivery_failed`, `return_requested`, `returned` → **Cancelled / Issue**

**Affected documents:** `docs/schema.md`, `docs/workspace.md`, Customer Order Status/Monitoring, Logistics Dashboard, all future shipment APIs.

### 7. Logistics subscription gate

The documents require a Logistics subscription but do not consistently define what an inactive subscription blocks.

- [ ] Allow approved Logistics users to sign in and view the dashboard, but require an active subscription for parcel operations, task assignment, and dispatch. **(Recommended)**
- [ ] Block the entire Logistics dashboard until an active subscription exists.
- [ ] Treat subscription as billing information only and do not gate operations in the MVP.

  **Decision:** Defer Logistics subscription billing, subscription records, provider integration, and subscription enforcement from the MVP. Admin approval and an active Logistics account are sufficient for currently implemented Logistics access. Revisit subscription requirements before enabling paid production operations.  
  **Blocked actions:** None due to subscription status. Shipment operations remain subject to their own approval and operational contracts.  
  **User-facing state/message:** Do not show `subscription_required` or fabricate subscription status. Treat subscription as unavailable/deferred until its feature is approved.

**Affected documents:** Logistics Auth, Logistics Dashboard, Logistics requirements/domain, `docs/schema.md`.

## Documentation alignment decisions

### 8. Auth specification current status

The Logistics and Courier auth specs still contain draft text saying their foundations or relationships are not implemented, while `docs/PROGRESS.md`, `docs/schema.md`, and the code now show the auth foundation exists.

- [x] Update both auth specs when their next revision is made so “implemented” and “deferred operational work” are explicit. **(Recommended)**
- [ ] Leave the metadata unchanged until the operational feature set is complete.

  **Decision:** Update both auth specs during their next revision so the implemented authentication foundation and deferred operational work are clearly separated.  
  **Rationale:** The current Logistics and Courier authentication foundations exist, but shipment operations, subscription enforcement, and other operational features remain deferred. Accurate status metadata prevents future implementers from rebuilding completed auth work or assuming deferred operations already exist.

**Affected documents:** `docs/features/logistics/auth/spec.md`, `docs/features/courier/auth/spec.md`, `docs/PROGRESS.md`.

### 9. Address-provider authority

Some older shared wording refers to Maps JavaScript Places. The current Customer Address Book flow should be the reference: bundled PSGC cascading fields, optional Geoapify autocomplete/forward geocoding after **Pin location**, and an interactive Leaflet map rendered with Geoapify tiles. Manual entry remains available when lookup or map services are unavailable. Mapbox is not used.

- [x] Make the Customer Address Book provider split authoritative: PSGC names and manually reviewed fields are authoritative; Geoapify assists with suggestions and coordinates; Leaflet renders the draggable/click/GPS pin using Geoapify tiles. **(Recommended)**
- [ ] Standardize on one provider for both registration and address-book flows.

  **Decision:** Reuse the Customer Address Book location flow for address entry that needs a map pin: Region → Province → City/Municipality → Barangay values come from bundled PSGC data, Geoapify provides optional suggestions/forward geocoding and coordinates, and Leaflet renders the interactive pin with Geoapify tiles. No Mapbox dependency, geocoding, or map rendering is permitted.  
  **Authoritative persisted fields:** The manually reviewed address fields and optional `latitude`/`longitude` captured from the confirmed pin. Provider identifiers and suggestion metadata are not authoritative and are not persisted as address identity.

**Affected documents:** `docs/workspace.md`, `docs/architecture.md`, `docs/domains/Buyer.md`, `docs/features/customer/address-book/spec.md`, `docs/maps-location-api.md` (if restored), Seller Auth, and the registration reference.

### 10. Customer auth terminology and spec ownership

The older Customer auth material uses `BUYER` in places, while the API/schema/domain use `customer`. The registration/auth and session-navigation specs also overlap.

- [x] Use `customer` as the persisted/API role, “Buyer” as the customer-facing term, `customer-auth` for registration/login, and `customer_verify_auth` for session/navigation guards. **(Recommended)**
- [ ] Treat the two auth specs as equal sources and reconcile each time both are changed.

  **Decision:** Use `customer` as the canonical persisted/API role name for database values, enums, routes, middleware, permissions, and DTOs. Use “Buyer” only as the customer-facing storefront and business term. They refer to the same user conceptually, but they must not be interchangeable in code or API contracts.

**Affected documents:** Customer auth specs, `docs/schema.md`, `docs/domains/Buyer.md`, `docs/workspace.md`.

### 11. Seller shop setup timing

Seller Auth currently creates a pending Shop during registration, while the Seller Dashboard still allows a `SHOP_SETUP_REQUIRED` state.

- [x] Keep creating one pending Shop at registration; after approval, the Seller completes or edits storefront settings. Use `SHOP_SETUP_REQUIRED` only when required shop fields are incomplete. **(Recommended)**
- [ ] Do not create the Shop until after Admin approval; create it in a post-approval setup flow.
- [ ] Treat registration and post-approval setup as two separate Shop records. (Not recommended.)

  **Decision:** Create exactly one pending Shop during Seller registration. Admin approval must atomically activate the existing Seller account and Shop after all required registration fields and evidence are present and acceptable. A missing or invalid required document prevents approval. After approval, the Seller may complete or edit permitted storefront settings; no second Shop is created.  
  **Required fields before publishing:** The Seller must be Admin-approved, the Shop must be active, and the Shop must have a valid business/shop name, one active Shop Category, a valid business address, and its server-generated unique slug. `SHOP_SETUP_REQUIRED` is a setup state for incomplete storefront information, not a substitute for Admin approval.

**Affected documents:** Seller Auth, Seller Dashboard, Seller Account Management, `docs/schema.md`, Seller domain.

### 12. Seller Order Management versus Prepare Orders

The current Seller Order Management path is a catalog/Product-management feature, while purchased-order fulfillment belongs to Prepare Orders. The name can make implementers select the wrong feature.

- [x] Keep both paths, but add an explicit pointer that order fulfillment is owned by Prepare Orders. **(Recommended)**
- [ ] Rename the catalog feature to Seller Product/Catalog Management.
- [ ] Move fulfillment requirements into Seller Order Management.

  **Decision:** Keep the existing Seller Order Management feature path for catalog and Product management for compatibility. Add an explicit pointer that purchased-order fulfillment belongs to Seller Prepare Orders. Seller Order Management must not implement the purchased-order queue, packing workflow, waybill handoff, Courier assignment, or fulfillment status transitions.  
  **Rationale:** The current implementation and documentation already use Seller Order Management for catalog/Product workflows. Keeping the path avoids unnecessary renaming, while the explicit boundary prevents future implementers from placing fulfillment behavior in the wrong feature.

**Affected documents:** Seller Order Management, Seller Prepare Orders, Seller domain, `docs/requirements.md`.

## Sign-off checklist

Do not begin shipment/fulfillment implementation until each item has either an approved rule or an explicitly approved deferral:

- [x] Operational-record scope and the decision to define the complete shared schema before operational actions are approved.
- [x] First-mile task creator/assigner is approved.
- [x] Waybill/label ownership and immutability windows are approved.
- [x] MVP inventory reservation/fulfillment/release rules are approved; returns/refunds and partial fulfillment are explicitly deferred.
- [x] Payment and initial-status rules are approved.
- [x] High-level versus detailed status mapping is approved.
- [x] Subscription billing and enforcement are explicitly deferred from the MVP and do not gate current approved Logistics access.

After sign-off, update the affected domain, workspace, schema, reference, and feature-spec documents. Then add a dated entry to `docs/PROGRESS.md` summarizing the decisions; do not treat this worksheet alone as the canonical contract.
