---
feature: prepare-orders
title: Seller Prepare Orders
system: AISLEY
type: Feature Specification
version: 1.2
status: Partially implemented; operational preparation deferred
role: Seller
scope: Seller Web Application
---

# Seller Prepare Orders

## WHAT

- **Purpose:** Let a Seller verify and pack purchased Shop Orders, select an eligible Logistics organization, request pickup, and print each resulting shared waybill.
- **Current implementation:** Order list/detail, COD approval/rejection, reservation preconditions, and grouping up to 50 processing Orders into a pending Logistics pickup request exist. The grouping action moves `seller_processing → ready_for_pickup` and notifies Logistics, but package records, label generation, and operational Shipment records are not yet implemented.
- **Ownership boundary:** Order Approval owns `placed → seller_processing`; Prepare Orders owns packing, provider selection, readiness, and shared-waybill creation; Logistics owns scheduling/hub operations; Courier owns assigned tasks in the external mobile app.
- **Provider rule:** Seller selects one server-validated eligible Logistics organization during pickup request; the current provider-less request is transitional and must be replaced by an additive migration/API change.
- **Waybill rule:** The pickup transaction creates one immutable waybill per Order; Seller and selected Logistics view the same artifact.
- **Non-goals:** changing purchased snapshots or Buyer addresses, assigning Couriers, choosing hubs, scanning custody, sorting/transit/delivery, payment capture, or inventing a second Order/shipment status.

```text
Seller opens Seller-scoped processing Order
→ verifies immutable item/SKU/quantity snapshot
→ packs each parcel and selects Logistics
→ requests pickup, confirms ready_for_pickup, and creates waybills
→ Seller prints and attaches each waybill
→ committed event/request becomes actionable to the selected Logistics org
→ Logistics assigns a Courier and pickup schedule
```

## MUST

### Authorization and preconditions

- Require `auth:sanctum` and active Seller middleware. Every Order and package query is scoped through the Seller's one Shop; never trust submitted Seller, Shop, Buyer, Order status, provider, or package IDs.
- Preparation requires an Order in `seller_processing`, valid COD/payment state, immutable item/address snapshots, active Shop, intact SKU reservation, and no cancellation/rejection. Stale or unauthorized actions return `404`/`409` without repairing state.
- Opening detail or preparation does not advance status. The server, not a client `status` field, decides transitions.
- Missing/damaged items use an approved exception/cancellation flow; Seller cannot silently alter purchased quantity or current Product data.

### Purchased snapshot and package data

- Display the immutable Order Item/Product/variant/SKU names, selected options, quantities, prices, and checkout shipping-address snapshot needed to pack. Never substitute current catalog values for historical facts.
- Package weight, dimensions, and multi-package Orders remain deferred; MVP treats one Order as one parcel without using size for capacity.
- The shared waybill contains an opaque reference/QR and only approved operational snapshots; it never embeds arbitrary Order JSON or secrets.
- The reference, snapshot, and selected Logistics organization are immutable from the committed request; corrections require a future void-and-reissue policy.
- Preview, download, and reprint do not change Order status. Reprints are auditable and never create another fulfillment cycle.

### Readiness and first-mile handoff

- The Seller action is only `seller_processing → ready_for_pickup`. It must re-read and lock the Order, validate payment/package/label/reservation requirements, and commit one status event atomically.
- Retried or concurrent requests use a stable idempotency key and produce one logical readiness transition, one pickup request association, and one after-commit notification/event.
- When the shared operational schema exists, the selected Logistics organization creates at most one active first-mile task after readiness and offers it to an eligible Courier. Seller never assigns the Courier.
- Logistics receipt is not implied by readiness. The detailed sequence is `ready_for_pickup → picked_up_from_seller → received_at_hub`; the high-level `assigned`/`picked_up` mapping remains in `docs/schema.md`.
- Inventory reservation remains reserved until first-mile pickup succeeds. `picked_up_from_seller` is the approved boundary for committing reserved to fulfilled stock; Prepare Orders must not create a second stock effect.

### Failure, privacy, and UX

- Notification/event delivery runs after commit. A delivery failure cannot roll back readiness; it is retried/observed separately.
- DTOs omit private evidence, unnecessary Buyer PII, payment secrets, raw storage paths, and cross-Shop identifiers.
- Provide loading, processing, package-validation, label-generating/ready/superseded, stale/cancelled/payment-invalid, success, conflict, retry, and accessible print/download states.
- [x] Seller can review Shop-scoped Order list/detail and immutable snapshots.
- [x] Seller can approve/reject eligible COD Orders with locked idempotent transitions and reservation release on rejection.
- [x] Seller can group up to 50 `seller_processing` Orders into a pending Logistics pickup request and transition them to `ready_for_pickup`.
- [ ] Persist the Seller-selected Logistics organization and immutable shared waybill snapshots with audited reprints.
- [ ] Create the shared Shipment/Parcel/DeliveryTask records and consume reservation at `picked_up_from_seller`.
- [ ] Expose the shared waybill to Seller and selected Logistics from readiness; no Seller Courier assignment or delivery mutation.

## HOW

- Current Seller routes include `POST /orders/pickup-requests` and a fail-closed `/orders/{order}/waybill`; the latter becomes available after the pickup transaction creates its waybill.
- Current implementation is `OrderController`, `SellerOrderService`, `AcceptSellerOrder`, `RejectSellerOrder`, `RequestSellerPickup`, and the Seller Orders/Approval/Pickup pages. Keep the pickup request transitional until provider selection and the operational schema are available.
- Before implementing package/waybill actions, add approved shared `Shipment`, `Parcel`, `Waybill`, `Scan`, `DeliveryTask`, assignment, and label records. Keep enum-like columns as strings with PHP enum casts and use additive migrations only.
- Recommended records are one immutable shared waybill snapshot per Order plus separate append-only print, route, assignment, and scan events.
- Readiness transaction: lock Seller-scoped Order → validate `seller_processing`, payment, package, label, reservation, and idempotency → write status/event/pickup association → commit → dispatch Logistics/Buyer notifications after commit.
- Tests cover Seller isolation, snapshots, stale/cancelled/payment-invalid rejection, package limits, label privacy/versioning/reprint, readiness races/retries, selected-provider scope, after-commit failure, and the `picked_up_from_seller` Inventory handoff. Run API tests on SQLite/PostgreSQL and Seller lint, TypeScript, and build.
- Do not enable this operational slice until `docs/order-logistics-flow-decisions.md`, `docs/workspace.md`, and `docs/schema.md` agree and the shared operational migration is approved.

### State and ownership matrix

| State/event | Owner | Seller capability |
| --- | --- | --- |
| `placed` | Checkout/Order domain | View only; Order Approval decides accept/reject |
| `seller_processing` | Seller Order Approval/Prepare Orders | Verify items, pack, select Logistics, and request pickup |
| `ready_for_pickup` | Seller handoff | Print/reprint immutable waybill; await schedule |
| `picked_up_from_seller` | First-mile Delivery Task | No Seller transition; Inventory fulfillment boundary |
| `received_at_hub` / `sorted_at_hub` | Logistics | Read-only downstream status when exposed |
| `picked_up_from_hub` / delivery | Final-mile Delivery Task/Courier | Read-only downstream status |

- First-mile and final-mile assignments are independent. A Courier who completes first-mile pickup is not automatically assigned final-mile delivery.
- `assigned` and `picked_up` remain high-level compatibility values only; detailed physical states come from Shipment/Delivery Task records after the shared schema exists.

### Waybill safety

- The label contains only the minimum destination/routing information needed for handoff. Human-readable output must not expose unnecessary Buyer contact or payment data.
- QR/barcode payloads are opaque references. Scanning resolves authorized server records rather than embedding serialized Order JSON.
- Every waybill preserves its generation snapshot, selected Logistics organization, and timestamp; MVP does not supersede or edit the artifact.
- A label-generation or notification failure must not partially commit `ready_for_pickup`; successful readiness is the authoritative handoff even when delivery of the follow-up notice fails.

### Seller preparation contract

- The preparation page may show an Order's checkout address and item snapshot, but it cannot edit either one. Any permitted pre-pickup Customer change must arrive through the Customer Order Modification contract and create a new authoritative snapshot before preparation.
- Package measurements are operational facts, not Product catalog edits. Updating them must not change Product weight, SKU stock, price, or published content.
- The Seller may print/reprint the current shared waybill. Reprinting records an event; it does not generate a new Order, reserve stock again, or notify a different Logistics organization.
- Grouping several Orders in one pickup request does not merge their status histories, package identifiers, inventory references, or Customer snapshots.
- A pickup request status such as `pending_logistics` is not a Shipment status. It is a Seller handoff record until the shared Logistics records exist.

### Required future interfaces

- `GET /api/v1/seller/orders/{order}/preparation` should return immutable snapshots, package state, label versions, capabilities, and safe errors.
- Pickup/waybill creation uses Seller-scoped Form Requests and UUID idempotency keys; submitted Logistics IDs are always revalidated for eligibility.
- Seller and selected Logistics read endpoints expose the same waybill from readiness. DTOs must not expose Courier phone, private evidence, route secrets, or raw storage paths.
- The shared Shipment/DeliveryTask event is the only source for `picked_up_from_seller`, hub receipt, and later custody milestones.
- A Seller-facing “waybill unavailable” response is truthful until the pickup transaction has created the waybill; it must not synthesize one from mutable browser data.
- Any later label/waybill read must use the immutable Order/Parcel link and enforce Seller ownership before returning a document or route detail.
- Package and label APIs must return capabilities derived from the locked current state, so the UI cannot infer readiness from stale status text.

**References:** `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Seller.md`, `docs/domains/Logistics.md`, `docs/domains/Courier.md`, Seller Order Approval, Inventory, and `docs/order-logistics-flow-decisions.md`.
