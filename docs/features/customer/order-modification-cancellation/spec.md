---
feature: order-modification-cancellation
title: Customer Order Modification and Cancellation
system: AISLEY
type: Feature Specification
version: 1.1
status: Deferred — contract only
role: Customer
scope: Customer storefront and Laravel API
---

# Customer Order Modification and Cancellation

## WHAT

- **Purpose:** Give an authenticated Customer a narrowly bounded way to correct an Order or cancel it before Seller fulfillment begins.
- **Current state:** No Customer mutation endpoint or UI is implemented. `CustomerOrderStatusMapper` deliberately returns `canCancel = false`, `canModify = false`, and no modifiable fields.
- **Canonical role:** `customer` in routes, authorization, schema, and API; **Buyer** is the storefront term only.
- **Approved MVP boundary:** Customer self-service changes are allowed only while the Order is still `placed`, before Seller acceptance changes it to `seller_processing`. Seller approval closes the normal Customer modification/cancellation window, even if first-mile pickup has not happened.
- Seller rejection or another authorized exception before `picked_up_from_seller` may release that Order's inventory reservation, but it is not a Customer mutation endpoint.
- **Non-goals:** editing after Seller approval, arbitrary status patches, Seller rejection, Logistics/Courier actions, waybill regeneration, delivery failure, returns, refunds, disputes, online payment reversal, and partial fulfillment.

```text
Customer opens an owned `placed` Order
→ server reports capabilities (future)
→ Customer submits one explicit cancel or approved change
→ Laravel locks/rechecks Order + reservation + address/variant
→ apply a named transaction or return 409
→ append history → commit → notify after commit
```

## MUST

### Authorization and eligibility

- Require `auth:sanctum` and `customer.active`; resolve the target Order through `orders.customer_id`.
- Never trust submitted Customer/Shop/Seller IDs, current status, capability flags, deadline, totals, payment state, or inventory values.
- Use `401` unauthenticated, `403` invalid role/status, `404` for a non-owned Order, `422` invalid requested data, and `409` stale/ineligible state.
- Laravel computes `canModify`, `canCancel`, `modifiableFields`, and any deadline from current persisted state. The browser countdown, if later added, is informational only.
- In the MVP, `placed` is the only Customer self-service state. `seller_processing`, `ready_for_pickup`, `assigned`, `picked_up`, `in_transit`, `out_for_delivery`, `delivered`, and exception states are denied.
- Do not invent a fixed five/ten/fifteen-minute grace period. A future time window requires an approved server deadline, UTC timestamps, and transaction-time revalidation.

### Allowed changes and snapshots

- Expose only explicit named actions, never a generic Order-column patch.
- The source-backed candidates are changing the delivery address and correcting a selected variant. Quantity changes, one-time addresses, voucher re-evaluation, and other fields remain open until product policy approves them.
- A change must revalidate Product/Variant relationship, visibility, Shop ownership, SKU availability, current price/discount, and any shipping rule using the same authority as Checkout.
- A successful address change updates the Order's `order_addresses` snapshot; it never rewrites the saved Customer Address Book record. Logistics later reads the updated Order snapshot, not a mutable default address.
- Existing item, financial, voucher, and delivery snapshots remain historical records. Repricing must be server-calculated and fixed-precision; a client cannot submit replacement totals.
- If a downstream package, waybill, assignment, or task exists, deny self-service unless its owning workflow explicitly supports safe regeneration. This feature never silently leaves an obsolete destination in a downstream artifact.

### Cancellation, inventory, and payment

- Cancellation is a named transition to `cancelled`, not `{status: "cancelled"}` from the client.
- Lock and reload the Customer-scoped Order, recheck `placed`, validate the requested reason if reasons are approved, and commit the transition with an immutable event/history row.
- Checkout reserves SKU quantity at placement. A committed Customer cancellation before `picked_up_from_seller` releases only that Order's reservation exactly once, transactionally, with an auditable movement.
- After `picked_up_from_seller`, no automatic inventory release is allowed. Delivery failure, returns, refunds, and partial fulfillment remain deferred; do not restore stock or claim a refund by changing status alone.
- COD is currently `payment_status = pending`; no online payment reversal exists. Any future paid cancellation must use an approved payment service and separate payment state from Order state.

### Concurrency, idempotency, and communication

- The main race is Customer cancel/modify versus Seller `placed → seller_processing`. Lock or atomically compare-and-update the Order, then recheck eligibility after the lock; only one valid transition wins.
- Require a stable Customer-scoped idempotency key for mutations. Retries must not cancel twice, release stock twice, duplicate financial actions, or duplicate history/notifications.
- Append safe before/after summaries, actor, timestamp, and request ID; never overwrite prior history or include secrets/full private address in logs.
- Emit Seller/Customer notifications only after commit. Notification failure must not undo a committed cancellation or change; retry/observe delivery separately.

### Customer experience and acceptance

- Order detail may show controls only from server capabilities. The current API must keep both controls disabled until this feature is implemented.
- Confirm cancellation with the Order reference and truthful COD/payment wording. Show only approved fields in a modification form and retain accessible field-level errors.
- On `409`, refetch Order detail, explain that Seller processing started or the state changed, and remove invalid actions.
- [x] Current Order DTOs expose `canCancel = false`, `canModify = false`, and no modifiable fields.
- [ ] Customer can cancel only an owned `placed` Order through a transactional, idempotent API.
- [ ] Customer can change only an approved field with a new authoritative snapshot and server recalculation.
- [ ] Seller-processing races, duplicate requests, reservation release, history, and after-commit notification failure are covered by tests.

## HOW

### Current code and future interfaces

- Current read endpoints are `GET /api/v1/customer/orders/{order}` and `/tracking`; there is no `POST .../cancel` or modification route.
- When approved, prefer named routes such as `POST /api/v1/customer/orders/{order}/cancel` and `PATCH /api/v1/customer/orders/{order}/modification` with dedicated Form Requests and service methods. Do not add them until the product decisions below are closed.
- Reuse `Order`, `OrderAddress`, `OrderItem`, `OrderStatusEvent`, `InventoryMovement`, `CheckoutService`, and `CustomerOrderStatusMapper`; add only additive migrations for any approved history/idempotency records.
- The Seller Order Approval transition remains the authoritative `placed → seller_processing` boundary. Prepare Orders begins after that transition and closes Customer self-service.

### Transaction and test plan

- Mutation transaction: Customer-scoped lock → current-state/deadline check → validate requested field → recalculate affected totals/stock/payment consequence → write snapshot/status/event/idempotency → commit → dispatch notifications.
- Tests must cover ownership/role/status denial, exact `placed` boundary, Seller race, duplicate retries, address snapshot independence, variant stock/price validation, reservation release once, COD payment separation, immutable history, and notification failure.
- Keep delivery failure, returns/refunds, partial fulfillment, and downstream waybill/task regeneration as open decisions in their owning specs.

**References:** `docs/workspace.md`, `docs/schema.md`, Customer Checkout, Customer Order Status, Address Book, Seller Order Approval, Seller Prepare Orders, Inventory, and `docs/domains/Buyer.md`.
