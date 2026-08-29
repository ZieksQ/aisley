---
feature: view-cart
title: Customer View Cart
system: AISLEY
type: Feature Specification
version: 1.1
status: Draft
role: Customer
scope: Customer storefront and Laravel API
---

# Customer View Cart

## WHAT

- Authenticated Customers can add a selected Product configuration, review Cart items, change quantity or variation, and prepare selected items for checkout.
- A Cart Item represents one purchasable configuration: Product + selected variant/SKU where applicable; it is not a saved client-side Color/Size string.
- The feature enables the currently placeholder-only **Add to cart** control on `/products/{id}`.
- Laravel owns Cart persistence, eligibility, variant validation, current prices, and stock checks. Next.js renders the projection and submits intent.
- Cart is a staging area, not an inventory reservation or checkout/payment implementation.
- Non-goals: guest Cart, Buy Now, vouchers, shipping, payments, Order creation, and seller inventory management.

## MUST

### Authentication and isolation

- Every Cart read or mutation requires Sanctum authentication and the active Customer role (`auth:sanctum`, `customer.active`).
- Scope every Cart and Cart Item to the authenticated Customer; never accept `customer_id`, `cart_id`, Seller id, price, stock, or SKU from the browser.
- Return `401` for an unauthenticated request, `403` for the wrong role, `404` for a Customer-scoped missing item, `422` for invalid input, and `409` for a stale price/stock/availability conflict.

### Variant selection and identity

- Use the existing normalized catalog model:
  - `product_option_groups` → ordered `product_option_values`.
  - `product_variants` carries SKU, optional price overrides, stock, status, and primary media.
  - `product_variant_option_values` defines each valid variant combination.
- A variant-backed Cart Item stores `product_id`, `variant_id`, and `quantity`; a Product without variants stores `variant_id = NULL`.
- Require `variant_id` for a Product that requires variant selection. It must be active, in stock, belong to the submitted Product, and represent a complete valid option combination.
- Reject a non-null `variant_id` for a Product without variants, a variant from another Product, inactive/deleted variants, malformed pivots, and requested quantities outside current stock.
- Distinct variants of one Product remain distinct Cart lines, with independent price, stock, and quantity.
- Adding the same Product + variant merges/increments the existing line only after server-side stock validation.
- Enforce one line per configuration using new migrations only:
  - unique (`cart_id`, `product_id`, `variant_id`) where `variant_id IS NOT NULL`.
  - unique (`cart_id`, `product_id`) where `variant_id IS NULL`.

### Product-page Add to Cart

- Keep the existing product-page option selector as the only source of candidate configuration; it already derives valid combinations from the product-detail DTO.
- Replace the current `aisley:product-purchase-intent` placeholder for `add_to_cart` with `POST /api/v1/customer/cart/items`.
- Send only:
```json
{ "product_id": "UUID", "variant_id": "UUID or null", "quantity": 1 }
```
- The server reloads authoritative Product, Shop, Seller, and variant state, then validates buyer visibility, vacation/approval status, variant ownership/status, price, and available stock.
- Do not reserve or decrement inventory at Add to Cart; final inventory concurrency belongs to checkout.
- For an active Customer, replace the local Cart count/projection with the API response and announce the selected configuration was added.
- For a guest, direct to `/login?next=/products/{id}`. Retain only Product id, variant id, and quantity in page/session state; restore the selection after login but require an intentional retry.
- Disable the action during the request. Show distinct authentication, incomplete-selection, validation, conflict, and unexpected-error messages; never announce success until Laravel responds.

### Cart presentation and variation changes

- Each Cart row displays Product name/link, selected option labels, quantity, current unit price, line subtotal, availability, and current/variant media.
- Display choices in option-group position order, for example `Color: Teal · Size: M`; a SKU is optional secondary text, never the only choice label.
- Resolve display choices from the current variant pivot and option tables on each Cart projection. Do not persist JSON option labels as the authoritative selection.
- Provide a keyboard-accessible **Change variation** control for a variant-backed item.
- Preselect the current variant, disable impossible or out-of-stock combinations, require a complete combination, and show the target price/stock/media before confirmation.
- `PATCH /api/v1/customer/cart/items/{item}` accepts `quantity` and/or `variant_id`. It atomically validates the target, updates the item or merges it into the matching configuration, and returns a refreshed Cart.
- If the new variant is no longer eligible, leave the original Cart Item unchanged and return an item-level error.
- Refresh current price and availability on every Cart response. Mark unavailable items and exclude them from later checkout selection; do not silently remove Customer intent.

### Acceptance criteria

- [ ] A Customer can add an in-stock selected configuration from Product Detail and sees the Cart count/projection update once.
- [ ] Incomplete, mismatched, inactive, unavailable, or out-of-stock variants cannot be added or substituted.
- [ ] The same SKU merges safely; different variants of one Product remain separate rows.
- [ ] Cart rows show ordered human-readable choices and appropriate variant media.
- [ ] A Customer can change to a valid variation; an invalid change leaves the original item untouched.
- [ ] No client-supplied price, stock, Seller, or Cart ownership value affects the result.
- [ ] Repeated clicks do not create duplicate Cart items, and stock/price conflicts are recoverable in the UI.

## HOW

### Project evidence

- `docs/schema.md` already documents the option-group/value, variant, pivot, and media relationships required for SKU-level Cart items. Cart tables remain deferred.
- `src/api` exposes public product detail but has no Cart routes, models, or migrations.
- `src/webapp/src/components/product/product-purchase-panel.tsx` selects valid configurations and bounded quantity, but Add to Cart currently dispatches a browser event and says the service is unavailable.
- Current Customer APIs use `/api/v1/customer`, Sanctum cookies, and `customer.active`; use that convention instead of the older generic Buyer route names.

### Data and API

- Add `carts`: UUID id, `customer_id`, timestamps; one active Cart per Customer for MVP.
- Add `cart_items`: UUID id, `cart_id`, `product_id`, nullable `variant_id`, positive `quantity`, timestamps, the two partial unique indexes above, and normal foreign keys.
- Create Form Requests, Customer-scoped queries/policies, a Cart service/action layer, and API Resources. Keep controllers thin.
- Endpoints:
```text
GET    /api/v1/customer/cart
POST   /api/v1/customer/cart/items
PATCH  /api/v1/customer/cart/items/{item}
DELETE /api/v1/customer/cart/items/{item}
```
- `POST` upserts a configuration; `PATCH` changes quantity and/or variant atomically; every mutation returns the complete current Cart summary and count.
- Cart resources expose current Product/variant fields plus display-only `selected_options: [{group, value}]`; they do not expose private Seller data or raw inventory beyond the selected configuration's safe availability.

### Storefront

- Add a typed Cart API client using the existing CSRF initializer and request wrapper.
- Replace only the Add to Cart branch in `ProductPurchasePanel`; leave Buy Now as unavailable until its separate flow is specified.
- Integrate Cart count refresh with the shared marketplace/home context, handle `401` login return, and use an aria-live status for success and recoverable errors.
- Build `/cart` as an authenticated client-interactive route after the API resource exists; use the same DTO for row display and variation editing.

### Marketplace research

- Shopee requires selecting a preferred variation before Add to Cart, lets buyers select Cart items for checkout, and supports confirmed in-Cart variation changes with an immediate refresh. [Add to Cart flow](https://help.shopee.ph/portal/4/article/81046-%5BNew-to-Shopee%5D-How-do-I-buy-a-product-on-Shopee), [change variation](https://help.shopee.ph/portal/4/article/82273-%5BNew-to-Shopee%5D-How-do-I-change-the-product-variation-for-an-item-in-my-cart)
- Shopee also documents variation-dependent prices; AISLEY must therefore price and refresh each SKU line independently. [Variation prices](https://help.shopee.ph/portal/4/article/81509-Why-are-the-items-with-a-different-variation%2C-not-the-same-price%3F-%28ENG%29)
- Lazada's official catalog API models variations as SKU-linked sales attributes and supports variation imagery. This supports AISLEY's resolved-SKU design, not a verbatim shopper-UI copy. [Lazada Open Platform](https://open.lazada.com/apps/doc/doc?docId=120259&nodeId=29614)

### Verification and rollout

- Laravel tests: Customer isolation; upsert/merge; separate variants; invalid/mismatched/inactive variants; stock bounds; visibility/vacation checks; atomic variation change; duplicate-submit safety; resource privacy.
- Storefront tests: required selection; selected variant payload; loading/success/error states; login return; count refresh; option-label ordering; disabled combinations; accessible variation editor.
- Release Cart migrations and API before enabling the product-page mutation. Monitor add failures by sanitized reason and product/variant id; never log credentials, prices entered by clients, or private catalog data.

### Open questions

- Define guest Cart merge semantics, Buy Now, Cart selection for checkout, multi-seller checkout partitioning, promotions, and reservations in their respective specs.
- Define whether promotions can prevent merging the same SKU after per-variant limits are introduced.
