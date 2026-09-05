# Shipment/Order Reconciliation and Seller Prepare Orders

## 1. What needs reconciliation

“Reconcile” means making the documentation, schema, and feature specifications agree with one another. It is not a Git merge.

### Role and Logistics schema

[`docs/schema.md`](docs/schema.md) is older than the current implementation. It still says:

- The system has only four roles.
- `logistics` is not a valid role.
- Logistics profile, organization, and hub tables do not exist.
- Courier approval authority is unresolved.

However, the current code and progress log now include:

- `logistics` as a fifth role.
- `logistics_profiles`.
- `logistics_organizations`.
- `logistics_hubs`.
- `courier_logistics_affiliations`.
- Logistics-only Courier approval.

The schema documentation should be updated so future migrations are based on the actual foundation.

### Canonical order and shipment statuses

Persisted/API values use lowercase `snake_case`; PHP enum cases use PascalCase; UI labels are human-readable. Source-only uppercase labels such as `READY_FOR_PICKUP` or `AT_SORTING_CENTER` are not persisted.

The current high-level `OrderStatus` remains:

```text
pending_payment
→ placed
→ seller_processing
→ ready_for_pickup
→ assigned
→ picked_up
→ in_transit
→ out_for_delivery
→ delivered
```

The detailed physical Shipment/Delivery Task vocabulary is:

```text
awaiting_seller_pickup
seller_pickup_assigned
seller_pickup_accepted
picked_up_from_seller
received_at_hub
sorted_at_hub
in_transfer
dispatched_from_hub
delivery_assigned
delivery_accepted
picked_up_from_hub
in_transit
out_for_delivery
delivered
```

The high-level Order values remain the Customer-facing source of truth until the deferred shipment/task schema is implemented. Detailed physical milestones must not be inferred from a generic `picked_up` label.

The transition authority should also be explicit:

```text
Customer:
creates placed

Seller:
placed → seller_processing → ready_for_pickup

Logistics:
receives, sorts, transfers, dispatches

Courier:
accepts, picks up, delivers, completes
```

### Order-to-Logistics ownership

Customer checkout currently creates an Order belonging to a Shop, but it does not yet identify:

```text
Order → Parcel/Fulfillment → Logistics Organization → Sole Hub
```

A future shipment/parcel or fulfillment record needs to define that relationship and how a Logistics organization is selected for an Order.

### Two pickup stages

The settled MVP flow contains two physical delivery legs:

1. A first-mile Courier picks up from the Seller and transfers the parcel to the Logistics organization's sole hub (`picked_up_from_seller` → `received_at_hub`).
2. After sorting and dispatch, a final-mile Courier picks up from the Logistics hub and delivers to the Buyer (`delivery_assigned` → `picked_up_from_hub` → `delivered`).

The same Courier may perform both legs, but each handoff still requires its own task/assignment, scan, actor, timestamp, and location. The shipment model must not overwrite the first Courier assignment when creating the final-mile assignment.

### Waybill ownership

There is currently a possible overlap:

- Seller Prepare Orders says the Seller generates a shipping label/waybill.
- Logistics Waybill says Logistics generates the waybill.

The project must decide whether:

- one canonical waybill is created by the Seller and reused by Logistics; or
- the Seller creates a shipping label and Logistics creates a separate internal routing waybill.

Both documents must use the same decision and must not generate conflicting identifiers.

### Payment and inventory timing

The Prepare Orders specification still leaves two points open:

- Whether a COD Order with `payment_status = pending` may enter Seller processing.
- When reserved inventory becomes fulfilled inventory: at Seller readiness, Logistics receipt, or Courier pickup.

These decisions affect Checkout, Inventory, Seller Prepare Orders, and later Logistics transitions.

## Affected specifications

The most directly affected files and feature boundaries are:

- [`docs/schema.md`](docs/schema.md)
- [`docs/requirements.md`](docs/requirements.md)
- [`docs/workspace.md`](docs/workspace.md)
- Customer Checkout Order
- Customer Order Status
- Customer Order Modification/Cancellation
- Seller Order Notifications
- Seller Prepare Orders
- Seller Confirm Delivery
- Logistics Dashboard
- Logistics Waybill
- Logistics Update Status
- Logistics Deploy Rider
- Logistics Availability/Capacity
- Logistics Fleet and Zone
- Courier Dashboard
- Courier Accept Delivery Requests
- Courier Pick Up Order
- Courier Delivery Order
- Courier Proof of Delivery
- Courier Complete Delivery

Customer Reviews and Admin complaints/reports are downstream consumers of the final `delivered` state, so they do not need to be implemented first.

## 2. What Seller Prepare Orders means

The Seller Order Management specification is confusingly named, but it currently owns **Product/catalog management**:

- Product drafts.
- Product editing.
- Variants.
- Product media.
- Markdown descriptions.
- Inventory summaries.
- Publishing and archiving.

It does not manage purchased Orders.

Seller Prepare Orders happens after a Customer checks out:

```text
Customer places order
→ Order is created as placed
→ Seller opens the purchased Order
→ Seller starts processing
→ placed → seller_processing
→ Seller verifies and packs the items
→ Seller enters package weight/dimensions/count
→ System generates or reuses the package label
→ Seller confirms readiness
→ seller_processing → ready_for_pickup
→ Logistics Dashboard can see the parcel
```

This feature should include:

- Seller-scoped Order queue and detail.
- Immutable purchased item/SKU/quantity display.
- Start-processing action.
- Package information.
- Label/waybill preview and printing.
- Ready-for-pickup confirmation.
- Idempotent status transitions and status history.

It should not include:

- Courier assignment.
- Parcel pickup scanning.
- Transit updates.
- Delivery.
- Proof of delivery.
- Marking an Order delivered.

The practical next slice is:

1. Agree on the minimum status and waybill contract.
2. Implement Seller Prepare Orders through `ready_for_pickup`.
3. Make the Logistics Dashboard display that handoff.
4. Add Logistics scanning and delivery states afterward.

The first useful demo would be:

```text
Customer places order
→ Seller prepares it
→ Seller marks it ready
→ Logistics sees it in the hub queue
```
