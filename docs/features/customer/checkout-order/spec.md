---
feature: checkout-order
title: Customer Checkout & Order Creation
system: AISLEY
type: Feature Specification
version: 1.2
status: Implemented foundation; Logistics selection deferred
role: Customer
scope: Customer storefront and Laravel API
---

# Customer Checkout & Order Creation

## WHAT

- **Purpose:** Turn an authenticated Customer's eligible Buy Now selection or selected Cart lines into one or more Shop Orders.
- **Current implementation:** Quote, COD placement, one-Order-per-Shop grouping, immutable snapshots, voucher redemption, inventory reservation, UUID idempotency, and private batch retrieval are implemented.
- A multi-Shop submission creates one `CheckoutBatch` and one independent Order per Shop. The batch groups the result for the Customer; it is not a cross-Shop fulfillment record.
- The checkout address is selected from the Customer Address Book and copied into each Order's immutable delivery snapshot.
- Current COD placement starts at `placed` with `payment_status = pending`; `pending_payment` remains a future payment-method status.
- Customer checkout is not a Seller, Logistics, or Courier action. Seller acceptance, first-mile handoff, hub processing, waybill creation, delivery, returns, and refunds belong to their owning domains.
- **Approved future boundary:** the Customer will select one server-validated eligible Logistics organization per Shop Order. The current schema/API does not persist this choice yet; until the shared fulfillment schema exists, shipping uses the server-owned per-Shop quote.
- **Non-goals:** online payment, Customer order editing/cancellation, shipment/parcel/waybill records, route selection, courier assignment, returns/refunds, or arbitrary address entry outside the Address Book contract.

```text
Buy Now or selected Cart lines
→ authenticated checkout
→ server resolves current catalog, stock, address, vouchers, and shipping quote
→ group by Shop
→ Customer reviews quote
→ locked final validation + idempotency
→ one COD Order per Shop + snapshots + reservation
→ commit → private batch result
```

## MUST

### Authorization and input authority

- Require `auth:sanctum` and `customer.active` for quote, placement, and batch retrieval.
- Resolve Customer, Cart items, Products, Variants, SKUs, Shop, Address, vouchers, prices, availability, shipping, totals, and status from the server. Never trust client-supplied ownership, prices, stock, shipping fees, totals, snapshots, or status.
- Support exactly one mode: `cart` with unique Customer-owned Cart item UUIDs, or `buy_now` with one Product, optional Variant, and positive quantity.
- Reject mixed modes, duplicate/empty selections, cross-Customer IDs, hidden/restricted products, invalid variants, and unavailable stock with field-addressable `422`; use `409` for a stale quote/state conflict.

### Shop Order boundary

- Resolve every line from the current database Product and group by its Shop.
- Lines from one Shop are one Order; lines from different Shops are separate Orders with independent totals, lifecycle, reservations, and future fulfillment context.
- Persist `checkout_batch_id` on each created Order. Do not use the batch ID as a shipment or shared ownership key.
- Store immutable Order Item snapshots: Product/Variant IDs, names, selected option labels, SKU, unit price, quantity, line subtotal, and currency.
- Historical snapshots remain intact when a Product is edited, archived, restricted, or deleted.

### Address, provider, and Logistics selection

- Accept one `address_id` that belongs to the authenticated Customer and is eligible for shipping (`shipping` or `both`). Revalidate completeness at quote and placement.
- Copy recipient, contact, address lines, PSGC/manual locality names, country, and optional coordinates into one `order_addresses` row per Order inside the placement transaction.
- Address Book edits/deletes never rewrite a placed Order snapshot.
- Manual/PSGC address fields are authoritative. Optional coordinates come from the Customer's confirmed pin; provider IDs and suggestion payloads are not authoritative.
- When the approved fulfillment-selection contract is implemented, offer only server-validated eligible Logistics organizations for each Shop, include the selection in quote staleness hashing, and retain it after placement. The client must not submit an arbitrary Logistics ID or silently replace it.
- Until that contract exists, do not add a fake provider field: use the configured `CHECKOUT_SHIPPING_FEE_PER_SHOP` quote and expose that Logistics selection is unavailable.

### COD, pricing, vouchers, and totals

- Accept only `payment_method = cod` in the MVP. The server creates `OrderStatus::Placed` and `PaymentStatus::Pending`; no gateway credential or payment secret is stored.
- Recalculate current prices, availability, Shop shipping quote, voucher eligibility, discounts, and payable totals for every quote and immediately before commit.
- Apply Shop vouchers only to their Shop Order. An App voucher in a multi-Shop checkout requires one explicit eligible Shop target; never silently move it.
- Use fixed-precision server money values. A discount cannot exceed its basis and shipping cannot become negative.
- Store immutable financial snapshots and voucher/redemption records on each Order.

### Inventory, transaction, and retry safety

- Cart quantity is not a reservation. At placement, lock relevant inventory rows in a stable order, recheck availability, then increment the exact `reserved` quantity.
- Create all Orders, items, address snapshots, voucher redemptions, inventory movements, and selected-Cart cleanup in one transaction. Any validation failure creates no partial batch and consumes no stock/voucher.
- A successful Cart placement removes only purchased selected lines; Buy Now does not mutate the Cart.
- Require a Customer-scoped UUID `Idempotency-Key` on placement. A retry with the same request returns the original batch and does not duplicate Orders, reservations, redemptions, cleanup, or notifications.
- Reservation remains reserved until the approved first-mile event `picked_up_from_seller`; that later transition commits the reserved quantity to fulfilled inventory exactly once. An eligible cancellation or Seller rejection before that event releases only that Order's reservation once. Post-pickup return/refund/restoration and partial fulfillment remain deferred.
- Dispatch Seller/Customer notifications after commit. Notification failure never rolls back a committed Order.

### Customer experience and acceptance

- Buy Now and selected-Cart flows require an authenticated Customer; a guest is redirected to login and must intentionally retry.
- Show one selected shipping-capable address, COD, each Shop group, items, current prices, voucher reasons, fees, savings, payable amount, loading, validation, stale, conflict, and retry states.
- A successful result lists every Order reference and links to Customer Order Status. Partial-success UI is forbidden because placement is atomic.
- Use semantic labels, keyboard-operable controls, field-level errors, and non-color-only stock/error cues.
- [x] Buy Now creates a valid Order without adding a Cart line.
- [x] Selected Cart lines group by Shop and produce one Order per Shop.
- [x] Orders contain immutable item, address, financial, and voucher snapshots.
- [x] COD placement starts at `placed`/pending payment and reserves inventory transactionally.
- [x] Quote/place ownership, stale-state, rollback, and duplicate-retry paths are covered by API tests.
- [ ] Customer-selected Logistics persistence and operational Shipment/Parcel records are implemented; this waits for the shared fulfillment schema.

## HOW

### Current interfaces and implementation

- API routes are `POST /api/v1/customer/checkout/quote`, `POST /api/v1/customer/checkout/place` with a UUID `Idempotency-Key`, and `GET /api/v1/customer/checkout/{batch}`.
- Laravel uses `CheckoutController`, `CheckoutService`, `CheckoutQuoteRequest`, `PlaceCheckoutRequest`, `CheckoutBatchResource`, `CheckoutBatch`, `CheckoutQuote`, `Order`, `OrderItem`, `OrderAddress`, `OrderVoucher`, and `VoucherRedemption`.
- The additive checkout migration is `2026_08_30_000125_create_checkout_orders_and_vouchers.php`; enum-like columns remain string-backed with PHP enum casts.
- The storefront uses `/checkout`, the Product Detail Buy Now handoff, selected Cart handoff, saved-address selection, server requoting, and private `/checkout/result/{batchId}` confirmation.
- The frontend never calculates authoritative prices, stock, voucher savings, shipping fees, or totals.

### Data flow and verification

- Quote: normalize intent → resolve Customer-owned inputs → group by Shop → calculate server totals/vouchers → save short-lived Customer-owned quote with state/request hashes.
- Place: lock Customer/quote/inventory/voucher rows → revalidate hashes and all rules → create Orders/snapshots/reservations → clear selected Cart lines → commit → queue after-commit notifications.
- Test ownership, one-/multi-Shop grouping, immutable snapshots, COD-only validation, restriction/availability changes, voucher targeting, rollback, stable locking, and idempotent retries on SQLite and PostgreSQL.
- Do not add migrations by editing an executed migration. Add a new migration when the approved Logistics selection or shared operational records are ready.

### Deferred work and references

- Define the eligible-Logistics source, per-Shop selection UI, and fulfillment persistence together with `docs/order-logistics-flow-decisions.md`, `docs/workspace.md`, and `docs/schema.md` before shipment actions.
- Online payment, taxes/platform fees, return/refund policy, delivery failure, partial fulfillment, and Customer order mutation remain open product decisions.
- Related contracts: `docs/features/customer/address-book/spec.md`, `docs/features/customer/order-status/spec.md`, Seller Order Approval/Prepare Orders, Inventory, and `docs/references/user-registration-requirements.md`.
