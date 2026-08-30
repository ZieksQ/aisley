---
feature: checkout-order
title: Customer Checkout & Order Creation
system: AISLEY
status: Draft
role: Customer
scope: Customer storefront and Laravel API
---

# Checkout & Order Creation

## WHAT

- Authenticated Customers turn an eligible Buy Now selection or selected Cart lines into placed, cash-on-delivery (COD) Orders.
- Checkout groups lines by Shop. One Shop group produces exactly one Order containing all of that Shop's selected products and variants.
- A single submission may create multiple Orders when it contains multiple Shops; it is one checkout batch, not one cross-Shop Order.
- A product detail **Buy Now** flow starts checkout directly without first creating a Cart item. Cart checkout uses only Customer-selected Cart item IDs.
- Checkout selects an Address Book address and snapshots it onto every resulting Order. It does not mutate the saved address.
- Checkout is the boundary for authoritative product price, availability, shipping, voucher, total, and inventory validation.
- MVP payment method is COD only. The feature creates no card, e-wallet, gateway authorization, or payment credential flow.
- Non-goals: seller fulfillment, courier UI, refunds, returns, address editing, payment-gateway support, and cart persistence changes unrelated to selected lines.

## MUST

### Authentication, authorization, and inputs

- Require `auth:sanctum` and `customer.active`; return `401`/`403` consistently for denied requests.
- Never trust browser-submitted Customer, Shop, Seller, product name, SKU, price, stock, shipping fee, discount, total, address snapshot, or Order status.
- Support exactly one input mode per checkout draft:
  - `cart`: non-empty, unique Cart item UUIDs owned by the authenticated Customer.
  - `buy_now`: one product UUID, selected variant UUID or `null`, and quantity; validate it with the same catalog rules as Cart Add.
- Reject mixed modes, duplicate IDs, unavailable lines, zero/invalid quantity, cross-Customer Cart IDs, and empty Shop groups with `422`; use `409` when a formerly valid checkout is stale.

### Shop grouping and order boundary

- Resolve every submitted line from the database, then group by the current Product's Shop ID.
- Multiple products/variants from one Shop remain line items on one Order, with that Shop as the only Seller/Shop owner.
- Products from different Shops create separate Orders, each with its own items, shipping charge, voucher allocation, totals, lifecycle, and fulfillment/waybill future.
- Persist a non-sensitive `checkout_batch_id` shared by the Orders created in one successful multi-Shop action so Customer UI can present the result together; do not treat it as a cross-Shop fulfillment record.
- Preserve an item snapshot per Order line: product/variant identifiers, display names, selected option labels, SKU where available, unit price, quantity, line subtotal, tax/fee fields when introduced, and currency.
- Preserve historical references even if a product/variant/listing later changes, archives, or is moderated.

### Address and delivery

- Accept only one `address_id`, resolved through the authenticated Customer's Address Book relationship.
- The existing address model supplies recipient, contact, address lines, barangay, city/municipality, province, region, postal code, country, and optional coordinates.
- Copy the normalized delivery fields into a separate address snapshot for each Order inside the transaction. Later address edits/deletes must not change placed Orders.
- Revalidate address completeness and any configured serviceability rule before placement. Current project requirements do not define shipping-price/zone mechanics; expose the quoted shipping fee and reject a stale quote instead of guessing.
- COD is the sole permitted `payment_method`; server-created payment state must be compatible with the shared Order lifecycle and must not be accepted from the client.
- The selected address and COD choice apply to every Shop Order in the batch for MVP. Per-Shop addresses or delivery methods are out of scope.

### Pricing, vouchers, and totals

- Recalculate current unit prices, line subtotals, Shop merchandise subtotal, shipping quote, eligible vouchers, discounts, and payable total on every draft/quote and immediately before commit.
- Use fixed-precision database money values and a single currency per checkout. Never calculate authoritative money with JavaScript floating-point values.
- Apply voucher rules from `docs/features/voucher-usage/spec.md`: Shop vouchers can affect only their Shop Order; an App voucher in a multi-Shop checkout must be allocated to one eligible Shop Order only.
- Store immutable per-Order financial snapshots, including pre-discount merchandise subtotal, shipping charge, each applied voucher's ID/code/issuer/benefit, discount amounts, and payable COD total.
- A discount can never exceed its applicable merchandise subtotal; a shipping voucher can never reduce shipping below zero; excess voucher value is forfeited unless its terms explicitly allow carryover.
- Return a clear per-Shop breakdown and an ineligible/stale-voucher reason; do not silently move a voucher to another Shop.

### Inventory, consistency, and idempotency

- Cart is not an inventory reservation. At placement, lock the relevant product-variant inventory rows in a stable order, recheck Shop/product/variant visibility and stock, then reserve/decrement according to the chosen inventory model.
- If any selected line, address, voucher, or quote fails final validation, create no partial Orders and do not consume vouchers or stock.
- Create all Orders, line snapshots, address snapshots, voucher-redemption records, inventory changes, and Cart cleanup in one database transaction.
- Cart mode removes only the successfully purchased Cart lines after commit; unselected/unavailable lines remain. Buy Now creates no Cart mutation.
- Require a Customer-scoped idempotency key for the final placement request. A retry returns the original completed batch without creating Orders, consuming vouchers, decrementing stock, or notifying twice.
- Lock/recheck voucher redemption capacity and per-Customer usage limits within the same transaction. Emit seller/customer notifications only after commit.

### Customer experience and accessibility

- Product Detail Buy Now validates a complete purchasable variant and quantity, then opens checkout with that intent; guests are sent through login and must intentionally retry.
- Cart groups selected lines visually by Shop, shows a per-Shop subtotal/shipping/voucher/total, and allows checkout only for eligible selected lines.
- Checkout must show address, COD, Shop groups, line details, voucher selections, fees, savings, payable totals, loading, validation, conflict, and retry states before placement.
- A successful result lists every created Order reference and links to its Customer Order Status detail. A partial-success screen is forbidden because placement is atomic.
- Use semantic field labels, field-level errors, keyboard-operable selectors, and non-color-only availability/error cues.

### Acceptance criteria

- [ ] A Customer can Buy Now one valid product configuration without adding a Cart item.
- [ ] Several selected products from one Shop create one Order with separate immutable lines.
- [ ] Selected products from two Shops create two independently owned Orders sharing one checkout batch ID.
- [ ] An unselected Cart item remains untouched; a successful selected Cart item is removed only after commit.
- [ ] Another Customer's Cart item/address and forged client prices/totals cannot be used.
- [ ] Editing/deleting the saved address after placement does not alter an Order delivery snapshot.
- [ ] Only COD can be selected in MVP; no payment secrets are stored or returned.
- [ ] Final stock, price, Shop eligibility, address, shipping quote, and voucher rules are revalidated under transaction/lock.
- [ ] Any failed Shop line/voucher validation rolls back the entire batch without stock or voucher consumption.
- [ ] Retrying a final request with the same idempotency key returns the same Orders exactly once.

## HOW

### Project alignment

- Extend Laravel under Customer namespacing and `/api/v1/customer`; use Sanctum and the existing `customer.active` middleware.
- Reuse the existing UUID-backed `carts`/`cart_items`, Products, ProductVariants, Shops, and Address model. There is currently no Order, payment, shipping, or voucher persistence, so add only new migrations; enum-like database columns remain `string` with PHP enum casts.
- Add a Next.js `/checkout` route plus an intentional Buy Now handoff from Product Detail and selected-Cart handoff from `/cart`; keep all authority in Laravel.

### Suggested contracts and data flow

```text
POST /api/v1/customer/checkout/quote
POST /api/v1/customer/checkout/place   Idempotency-Key: UUID
GET  /api/v1/customer/checkout/{batch}

intent → server resolution → group by shop → quote/choose vouchers
→ final revalidation + locks → Orders[] + snapshots → commit → notifications
```

- Quote/place payloads contain only `mode`, Cart item IDs or Buy Now configuration, `address_id`, `payment_method: "cod"`, voucher selections/targets, and placement idempotency key.
- Use a dedicated `CheckoutService`/action with `QuoteCheckout` and `PlaceCheckout` paths sharing the same calculation rules; controllers stay thin and Resources return safe grouped DTOs.
- Suggested new records: `checkout_batches`, `orders`, `order_items`, `order_addresses`, `order_status_events`, and an order-voucher snapshot/redemption relation. Exact table names may follow existing conventions.
- Initial Order status should use the already documented lifecycle rather than inventing a parallel state; final COD placement-state mapping is an open payment/order decision.

### Verification, observability, and open decisions

- Laravel tests: role/ownership denial, direct/cart input validation, one-Shop and multi-Shop grouping, address snapshot, COD-only validation, changed price/stock/availability, transaction rollback, stable inventory locking, voucher targeting, and idempotent retry.
- Storefront tests: Buy Now and Cart handoffs, grouped totals, address/voucher errors, conflict refresh, and accessible place-order/result states.
- Record safe audit/order events and correlation IDs; never log address/contact detail, tokens, or payment secrets.
- Open: shipping-fee/zone quote source, inventory reservation versus decrement timing, COD payment/status mapping, taxes/platform fees, order-reference format, and whether a Customer may select only a subset of a Shop group.

### Research references

- Shopee documents voucher selection at checkout and eligibility terms such as minimum spend, item scope, validity, caps, and payment method: https://help.shopee.ph/portal/4/article/165965
- Shopee also distinguishes a platform voucher and a Shop voucher per Shop at checkout: https://help.shopee.ph/portal/4/article/81465
- Lazada's terms require voucher application/review at checkout and note voucher-combination restrictions: https://pages.lazada.com.ph/wow/gcp/route/lazada/ph/upr_1000345_lazada/channel/ph/upr-router/render?at_iframe=1&data_prefetch=true&hybrid=1&prefetch_replace=1&wh_pid=%2Flazada%2Fchannel%2Fph%2Flegal%2Fterms-conditions
