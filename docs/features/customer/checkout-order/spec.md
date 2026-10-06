---
feature: checkout-order
title: Customer Checkout & Order Creation
system: AISLEY
type: Feature Specification
version: 1.2
status: Implemented; storefront provider-selection flow added
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
- **Shipping boundary:** The Customer selects one Seller-enabled Logistics organization per Shop Order. The server calculates and freezes the commercial route; the Seller must use that selected provider when requesting pickup.
- **Non-goals:** online payment, Customer order editing/cancellation, client-side route calculation, courier assignment, returns/refunds, or arbitrary address entry outside the Address Book contract.

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

### Address and Logistics selection boundary

- Accept one `address_id` that belongs to the authenticated Customer and is eligible for shipping (`shipping` or `both`). Revalidate completeness at quote and placement.
- Copy recipient, contact, address lines, PSGC/manual locality names, country, and optional coordinates into one `order_addresses` row per Order inside the placement transaction.
- Address Book edits/deletes never rewrite a placed Order snapshot.
- Manual/PSGC address fields are authoritative. Optional coordinates come from the Customer's confirmed pin; provider IDs and suggestion payloads are not authoritative.
- Return final-fee Logistics options per Shop from `POST /checkout/logistics-options`; accept one `logistics_selections` entry per Shop for quote and placement.
- Show each Shop's eligible provider choices as radio options with only the provider name and final shipping fee. Requote server-side after a provider choice and use the returned shipping fee and COD totals for review and placement.
- Never expose billable weight, parcel dimensions, tariff components, route hops, Logistics rules, commission, or payout shares to the Customer.
- Store the chosen Logistics organization on the Order and pricing snapshot. Seller pickup must match it; later route/rate changes never rewrite Customer COD.

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
- Retrieve provider options for every Shop, keep a separate selection per Shop, and requote after each selection. Require a selection when multiple providers are available; automatically use the sole available provider. Hide route status, weights, parcel dimensions, tariff details, route legs, and internal pricing data.
- A successful result lists every Order reference and links to Customer Order Status. Partial-success UI is forbidden because placement is atomic.
- Use semantic labels, keyboard-operable controls, field-level errors, and non-color-only stock/error cues.
- [x] Buy Now creates a valid Order without adding a Cart line.
- [x] Selected Cart lines group by Shop and produce one Order per Shop.
- [x] Orders contain immutable item, address, financial, and voucher snapshots.
- [x] COD placement starts at `placed`/pending payment and reserves inventory transactionally.
- [x] Quote/place ownership, stale-state, rollback, and duplicate-retry paths are covered by API tests.
- [x] Checkout-selected Logistics, private route pricing snapshots, and Seller pickup enforcement are implemented in the API.
- [x] Storefront retrieves provider options per Shop, requotes on selection, and shows only the selected provider with its final shipping fee.

## HOW

### Current interfaces and implementation

- API routes are `POST /api/v1/customer/checkout/logistics-options`, `POST /api/v1/customer/checkout/quote`, `POST /api/v1/customer/checkout/place` with a UUID `Idempotency-Key`, and `GET /api/v1/customer/checkout/{batch}`.
- Laravel uses `CheckoutController`, `CheckoutService`, `CheckoutQuoteRequest`, `PlaceCheckoutRequest`, `CheckoutBatchResource`, `CheckoutBatch`, `CheckoutQuote`, `Order`, `OrderItem`, `OrderAddress`, `OrderVoucher`, and `VoucherRedemption`.
- The additive checkout migration is `2026_08_30_000125_create_checkout_orders_and_vouchers.php`; enum-like columns remain string-backed with PHP enum casts.
- The storefront uses `/checkout`, the Product Detail Buy Now handoff, selected Cart handoff, saved-address selection, server requoting, and private `/checkout/result/{batchId}` confirmation.
- The frontend never calculates authoritative prices, stock, voucher savings, shipping fees, or totals.

### Data flow and verification

- [Connected lifecycle verification](../../shared/shipment-fulfillment/verification.md) exercises real Cart checkout through Seller approval, first-mile stock fulfillment, local/company-truck delivery, Logistics POD validation and verified-purchase review. Independent PostgreSQL workers verify duplicate placement and competing Customers buying the last unit.
- Quote: normalize intent → resolve Customer-owned inputs → group by Shop → calculate server totals/vouchers → save short-lived Customer-owned quote with state/request hashes.
- Place: acquire the shared routing settings gate before Customer/quote/inventory/voucher rows → revalidate hashes and all rules → create Orders/snapshots/reservations → clear selected Cart lines → commit → queue after-commit notifications. This matches Seller pickup and sort-plan recovery lock ordering when they share inventory or routing resources.
- Test ownership, one-/multi-Shop grouping, immutable snapshots, COD-only validation, restriction/availability changes, voucher targeting, rollback, stable locking, and idempotent retries on SQLite and PostgreSQL.
- Do not add migrations by editing an executed migration. Add a new migration when the approved Logistics selection or shared operational records are ready.

### Deferred work and references

- Customer checkout provider selection is required before placement; Seller pickup continues to enforce the frozen Customer selection.
- Online payment, taxes/platform fees, return/refund policy, delivery failure, partial fulfillment, and Customer order mutation remain open product decisions.
- Related contracts: `docs/features/customer/address-book/spec.md`, `docs/features/customer/order-status/spec.md`, Seller Order Approval/Prepare Orders, Inventory, and `docs/references/user-registration-requirements.md`.

### Route-based shipping quotation and COD extension (2026-09-27)

- `docs/features/shared/shipping-quotation/spec.md` is authoritative for Logistics service base fees and Admin region surcharges, item-based billable weight, Seller-enabled providers, Logistics rate cards, route fallback, quote expiry, and immutable rate inputs.
- Checkout returns an exact shipping fee and COD amount for every Shop Order and for the complete checkout before placement. Platform commissions never increase Customer COD.
- Placement revalidates the address, contents, selected provider, rate revisions, acceptance, route, coverage, vouchers, and commission policies. A material change requires a refreshed quote and Customer confirmation.
- Each placed Order stores its selected provider, platform tariff, frozen route/fallback status, private leg charges, discount funding, commissions, shipping fee, and collectible total. Rerouting and later rate changes cannot alter that total.


### Service base-fee revision — 2026-10-03

- The server now sums first-mile, each linehaul-hop, and last-mile Logistics service bases plus destination surcharge and category weight/size extras. No platform base applies to new quotations; local routes omit linehaul.
- Customer payloads and final-fee projections are unchanged. Refresh pre-revision/stale quotes, verify provider switching and final totals, and keep internal components private. Existing Orders retain their original COD.
