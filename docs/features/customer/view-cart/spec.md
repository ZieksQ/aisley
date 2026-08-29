---
feature: view-cart
title: Customer / Buyer View Cart
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Buyer
scope: Customer / Buyer Web Application
---

# Customer / Buyer View Cart
## WHAT
- **Purpose:** Give an authenticated Buyer a pre-checkout staging area to review selected items, finalize order details, apply vouchers/discounts, choose a payment method, and place an Order.
- **Canonical role:** `BUYER`.
- **Source-defined capabilities:**
  - view/select intended cart items
  - finalize order details
  - apply vouchers and discounts
  - calculate final totals including shipping
  - choose mode of payment
  - place order
- **Source-defined integrations:** `Cart`, `Promotions`, and `PaymentGateways`. fileciteturn51file0
- **Source-defined concurrency requirement:** inventory races must be handled when the Order is officially placed to prevent overselling. fileciteturn51file0
- **Recommended flow:**
```text
Buyer opens Cart
→ Laravel returns current cart projection
→ Buyer adjusts/selects items
→ choose shipping address/details
→ apply voucher/discount
→ choose payment method
→ Laravel produces authoritative checkout summary
→ Buyer confirms Place Order
→ revalidate product/variant/stock/price/promotion/address/payment method
→ transaction + inventory concurrency control
→ create Order / payment workflow
→ success or recoverable conflict/error
```
- **Architecture:**
  - Next.js/React owns cart presentation, item-selection UI, quantity controls, voucher input, address/payment selection UI, confirmation, and error states.
  - Laravel owns Buyer Cart persistence, Product/variant validation, authoritative prices, promotions, shipping/totals, address ownership, payment-method eligibility, Order creation, inventory concurrency, and idempotency.
  - Eloquent/database remains authoritative.
- **Recommended route:**
```text
/cart
```
- **Important boundary:** cart totals are previews until Laravel revalidates them at Place Order.
- **Feature boundaries:**
  - Search/Product Detail owns Product discovery and initial variant/quantity selection.
  - Address Book owns saved Buyer addresses.
  - Promotions/Vouchers owns discount eligibility and usage rules.
  - Payment integration owns provider authorization/capture/refund behavior.
  - Order domain owns generated Orders and lifecycle state.
  - Order Modification/Cancellation starts only after an Order has been created.
- **Non-goals:**
  - Seller product/inventory management
  - payment-provider implementation details
  - refund/cancellation after placement
  - logistics/courier fulfillment
  - inventing shipping-fee formulas
  - inventing voucher rules or payment methods not defined by project sources
  - client-side authoritative totals
## MUST
### Authentication and ownership
- View Cart / checkout mutation requires authenticated `BUYER`.
- Every Cart and Cart Item must be scoped to the authenticated Buyer.
- Never trust client-submitted:
  - `buyer_id`
  - Seller ownership
  - authoritative Product price
  - discount amount
  - shipping fee
  - grand total
  - stock
- Another Buyer must not read/update/place an Order from this Cart.
- Use project-standard:
  - `401` unauthenticated
  - `403` forbidden where appropriate
  - `404` Buyer-scoped Cart/Item missing
  - `422` validation failure
  - `409` stale inventory/price/cart/checkout conflict
### Cart persistence
- Cart stores the Buyer's current purchase intent before Order creation.
- Recommended relationship:
```text
Buyer
└── Cart
    └── CartItems[]
```
- Exact one-cart vs multiple-cart schema is not source-defined.
- Cart Item should reference authoritative:
  - Product
  - selected variant/SKU when applicable
  - requested quantity
- Do not store Product title/image as the only Product reference.
- Current Product details are refreshed from authoritative Product/catalog data.
### Add-to-Cart integration
- Search/Product Detail hands selected Product, variant, and quantity to Cart.
- Cart must validate:
  - Product exists and is buyer-visible
  - Seller is allowed to receive new Orders
  - selected variant belongs to Product
  - quantity is valid
  - current stock is sufficient for the requested quantity at that moment
- Adding to Cart does **not** guarantee inventory remains available until Place Order.
- Search already defines Cart as the owning persistence feature. fileciteturn51file1
### Cart item quantity
- Buyer may adjust quantity before placing the Order.
- Laravel validates the requested quantity server-side.
- Recommended UI uses increment/decrement buttons, optionally plus direct numeric entry.
- Baymard's cart research finds poorly designed quantity controls can lead to incorrect cart quantities and recommends low-friction quantity editing. citeturn552946search2turn552946search3
- Quantity updates must immediately return a recalculated authoritative Cart summary.
- Updating quantity does not reserve stock unless the final inventory design explicitly defines reservations.
### Remove / select items
- Buyer must be able to remove unwanted Cart Items.
- The source says "select order"; recommended interpretation is allowing the Buyer to select which Cart Items proceed to checkout.
- Exact selection semantics are Open.
- If item selection is implemented:
  - only selected items participate in voucher/shipping/checkout totals
  - unselected items remain in Cart
- Do not delete unselected items merely because an Order is placed.
### Multi-Seller cart ambiguity
- AISLEY is multi-Seller, but `Buyer.md` does not define whether one checkout may contain items from multiple Sellers.
- Do not invent the final model.
- If mixed-Seller checkout is supported, Laravel must define how checkout partitions:
  - Orders per Seller
  - shipping fees
  - Seller-scoped vouchers
  - inventory
  - payment allocation
  - platform commission
- A parent checkout/transaction grouping may be needed, but is not mandatory until the model is decided.
- This is a critical Open Question.
### Product visibility at cart time
- Cart display and mutation must honor the same canonical buyer-visible Product rules as Search/Homepage/Browse Shop.
- A Product may become unavailable after it was added.
- Cart must detect:
  - unpublished/archived Product
  - compliance removal
  - Seller suspension
  - Seller Vacation Mode
  - invalid/deleted variant
- Seller source explicitly says Vacation Mode disables checkout for Seller products. fileciteturn51file4
- Unavailable items must be clearly marked and excluded from Place Order until resolved/removed.
### Price freshness
- Cart must not trust the price captured when an item was originally added.
- Laravel returns current authoritative unit price and line subtotal.
- If price changed:
  - Cart UI should display the current price
  - Place Order uses current validated pricing
- Whether the Buyer must explicitly acknowledge a price change is Open.
- Use fixed-precision money and explicit currency. fileciteturn51file11
### Cart summary
- Recommended authoritative summary:
```text
items_subtotal
discount_total
shipping_total
tax_total if applicable
other explicit fees if applicable
grand_total
currency
```
- Tax/fee existence and formulas are not source-defined.
- Do not fabricate a tax or fee.
- Laravel calculates every financial value.
- React only formats returned money values.
- Baymard research recommends showing enough item detail and total-cost information in Cart so users can verify their intended purchase before checkout. citeturn552946search0
### Item detail in Cart
- Cart Item should show enough current information to verify:
  - Product
  - selected variant/options
  - quantity
  - unit price
  - line total
  - availability problems
- Product link should allow returning to Product Detail.
- Do not expose private Seller/inventory metadata.
### Address integration
- Finalizing Order details may use Buyer Address Book for shipping/billing selection.
- Selected saved address must belong to the authenticated Buyer.
- Laravel resolves the Address server-side.
- Place Order snapshots required address fields into the Order rather than depending on a mutable Address Book row.
- If one-time addresses are supported, that behavior belongs to the final Address Book/Checkout policy and remains Open.
### Shipping total
- Buyer source states Cart calculates final totals including shipping. fileciteturn51file0
- Shipping fee must come from the authoritative shipping/logistics rule.
- Current sources do not define the formula.
- Do not calculate shipping from arbitrary frontend constants.
- Address/item changes must cause shipping to be recalculated where applicable.
- If shipping cannot be calculated yet, do not present a false final total.
### Voucher / discount application
- Buyer may apply vouchers/discounts as required by source. fileciteturn51file0
- Client submits only voucher/promotion intent or code.
- Laravel Promotions domain determines:
  - existence
  - active period
  - eligibility
  - Product/Seller/platform scope
  - usage restrictions
  - discount amount
- Exact rules are source-dependent and Open where not defined.
- Never trust client-submitted:
```text
discount = 500
percent = 50
```
- Revalidate promotions again at Place Order.
- If a voucher becomes invalid, return a clear validation/conflict result and current totals.
- Promo-code fields are one of the few checkout inputs where an explicit Apply action is a normal UX pattern. citeturn552946search1
### Multiple discounts
- Source says vouchers and discounts but does not define stacking.
- Do not assume promotions stack.
- Promotion domain must define:
  - combinability
  - priority
  - maximum discount
  - Seller/platform interactions
- Cart only displays the authoritative result.
### Payment method selection
- Buyer chooses a mode of payment before placing the Order.
- Available payment methods must come from Laravel/configured PaymentGateway integration.
- Do not hard-code a provider unless repository requirements select one.
- Payment selection must expose safe method metadata only.
- Never expose secret API keys/provider credentials to browser code.
- Raw sensitive card data should be handled using the selected gateway's secure client/tokenization flow rather than persisted in AISLEY application tables.
- Exact methods (COD, card, e-wallet, etc.) are Open.
### Final review
- Before the irreversible Place Order action, show:
  - selected items/variants/quantities
  - delivery address summary
  - discounts
  - shipping/fees that are known
  - grand total
  - selected payment method
- Baymard recommends making the complete payable total clear before the payment commitment and using an explicit final action such as "Place Order." citeturn552946search5turn552946search9
- UI summary is still not authoritative until final server validation succeeds.
### Place Order
- Place Order is a critical domain action, not generic Cart CRUD.
- Conceptual endpoint:
```http
POST /api/buyer/checkout/place-order
```
- Request contains references/intent such as:
  - selected Cart Item IDs
  - address ID
  - promotion/voucher code/reference
  - payment method identifier
  - idempotency key
- Request must not contain trusted final prices/totals.
### Place Order revalidation
- Immediately before Order creation, Laravel revalidates:
  - Buyer ownership
  - Cart Item existence/selection
  - Product visibility
  - Seller availability
  - variants
  - requested quantities
  - current inventory
  - unit prices
  - promotions
  - address
  - shipping
  - payment-method eligibility
- A stale Cart may therefore fail at Place Order even if it looked valid seconds earlier.
- Return field/item-addressable errors so React can show what changed. fileciteturn51file11
### Inventory race / overselling
- This is explicitly required by `Buyer.md`. fileciteturn51file0
- Place Order must prevent two Buyers from successfully consuming the same final stock.
- Use a database transaction plus row-level locks or equivalent atomic stock mutation.
- Laravel documents database transactions and pessimistic locking such as `lockForUpdate()`. citeturn893491view0turn893491view1
- Recheck stock **after acquiring the concurrency protection**.
- If insufficient stock:
  - roll back Order/inventory mutation
  - return `409` or appropriate item-level conflict
  - return current available state where safe
- Never rely on React disabling the button to prevent overselling.
### Inventory mutation semantics
- Exact inventory behavior is Open:
  - reserve during checkout/payment
  - decrement when Order is placed
  - another explicit strategy
- Whichever strategy is chosen must be consistent with:
  - cancellation
  - payment failure
  - Seller fulfillment
- Do not implement multiple incompatible stock semantics.
- Cart browsing itself should normally not hold long-lived DB row locks.
### Database transaction
- Multi-record Order creation must be transactional.
- Transaction may include:
  - stock reservation/decrement
  - Order(s)
  - Order Items
  - order address snapshot
  - promotion usage record
  - payment/transaction reference as appropriate
  - Cart cleanup for successfully ordered items
- If any required database mutation fails, the Order-placement transaction must roll back.
- Laravel's transaction API automatically rolls back when the transaction closure throws. citeturn893491view0
### Payment and lock duration
- Do not keep inventory rows locked while waiting unnecessarily on a slow external payment network call.
- Exact safe ordering depends on the selected payment provider/model.
- Recommended payment design should explicitly define:
  - authorization/intention creation
  - inventory reservation lifetime if used
  - Order state (`PENDING_PAYMENT` vs `PLACED`)
  - provider callback/webhook
  - failure/expiry stock release
- These are Open until PaymentGateway requirements exist.
- Do not mark an Order paid from browser success alone.
### Initial Order state
- Shared lifecycle begins:
```text
PENDING_PAYMENT → PLACED → SELLER_PROCESSING
```
fileciteturn51file6
- Exact state created by Place Order depends on payment method:
  - immediate/offline method may permit `PLACED`
  - asynchronous payment may require `PENDING_PAYMENT`
- Do not force one state until payment semantics are defined.
- Only validated domain transitions may advance the Order.
### Idempotency
- Place Order must be idempotency-protected. fileciteturn51file11
- Double click/retry must not create duplicate:
  - Orders
  - inventory deductions
  - promotion consumption
  - payment operations
  - Seller notifications
- Disable repeated frontend submit while unresolved, but backend idempotency is authoritative.
### Cart cleanup after success
- Remove only Cart Items successfully converted into the placed Order(s).
- If placement fails, do not silently clear the Cart.
- If partial multi-Seller placement is ever allowed, its atomicity/cleanup semantics must be explicitly designed first.
- Recommended MVP is an all-or-nothing placement for the selected checkout group unless the final multi-Seller model says otherwise.
### Events / notifications
- Successful Order placement should make the Order available to Seller-facing Order Notifications and downstream workflows.
- Dispatch notifications/events only after the source transaction commits. fileciteturn51file6
- Notification failure must not undo a successfully placed Order.
- Exact Buyer/Seller notification channels are not source-defined.
### Cart freshness / abandoned cart
- Seller source defines Abandoned Cart Promotions that scan old Cart records and may trigger discounts/notifications. fileciteturn51file4
- Therefore Cart persistence should expose timestamps sufficient to identify stale cart intent.
- Exact abandonment duration and campaign rules belong to Seller promotion tooling, not View Cart.
### Frontend states
- Cart: loading, empty, loaded, unavailable item, price/stock changed, error.
- Checkout: validating, voucher/address/payment error, placing, inventory conflict, payment pending/failure where applicable, success.
- Preserve recoverable selections and do not show success until Laravel confirms a valid Order result.
### Accessibility
- Quantity, selection, remove, voucher, address/payment, and Place Order controls need accessible labels/keyboard support.
- Announce price/validation/stock changes; destructive actions cannot rely only on icon/color.
- Final total and Place Order must be clearly identifiable.
### Acceptance criteria
- [ ] Buyer can view only their own Cart.
- [ ] Cart displays current Product/variant/quantity/price information.
- [ ] Buyer can update quantity and remove items.
- [ ] Unavailable/Vacation Mode/compliance-hidden items cannot be ordered.
- [ ] Cart totals come from Laravel using fixed-precision money.
- [ ] Buyer can apply a voucher/discount intent and Laravel decides eligibility/amount.
- [ ] Address selection accepts only Buyer-owned eligible addresses.
- [ ] Payment methods come from configured backend/payment integration.
- [ ] Place Order ignores client-submitted totals/prices.
- [ ] Place Order revalidates Product, variant, stock, price, promotion, address, shipping, and payment method.
- [ ] Concurrent final-stock purchases cannot both oversell inventory.
- [ ] Failed transaction does not leave partial Order/inventory/promotion mutations.
- [ ] Place Order retries cannot create duplicate Orders/stock/payment effects.
- [ ] Initial Order state follows actual payment semantics and shared lifecycle.
- [ ] Successful checkout removes only ordered Cart Items.
- [ ] Failed checkout keeps recoverable Cart state.
- [ ] Notifications/events happen after commit.
- [ ] Multi-Seller checkout semantics remain explicit rather than silently invented.
## HOW
### Project findings
- `Buyer.md` defines View Cart as selecting/finalizing an Order, applying vouchers/discounts, selecting payment mode, and placing the Order. fileciteturn51file0
- It explicitly says the feature integrates `Cart`, `Promotions`, and `PaymentGateways`, calculates totals including shipping, and must prevent inventory overselling at official Order placement. fileciteturn51file0
- Search delegates Add to Cart / Buy to the Cart/Checkout domain and requires stock revalidation. fileciteturn51file1
- Address Book exists specifically to provide reusable shipping/billing destinations for checkout. fileciteturn51file14
- Seller Vacation Mode disables checkout, and Seller Abandoned Cart Promotions depend on persisted Cart timestamps. fileciteturn51file4
- Shared architecture requires Laravel-authoritative price/inventory/voucher values, fixed-precision money, transactions, row locks/atomic stock updates, idempotency, and after-commit notifications. fileciteturn51file12turn51file11
- Sources do not define mixed-Seller checkout, shipping formula, tax/fees, voucher stacking, payment methods/provider, stock reservation timing, or exact payment state transitions.
### Recommended data model
```text
carts
- id
- buyer_id
- created_at
- updated_at

cart_items
- id
- cart_id
- product_id
- variant_id nullable
- quantity
- created_at
- updated_at
```
- Do not persist authoritative final totals on Cart unless used as explicit recalculable snapshots.
- Order/Order Items should snapshot financial/product facts required for historical correctness after placement.
### Laravel API
Conceptual:
```http
GET    /api/buyer/cart
POST   /api/buyer/cart/items
PATCH  /api/buyer/cart/items/{item}
DELETE /api/buyer/cart/items/{item}

POST   /api/buyer/cart/apply-voucher
POST   /api/buyer/checkout/quote
POST   /api/buyer/checkout/place-order
```
- `quote` may be a dedicated endpoint or returned whenever checkout inputs change.
- Use Form Requests, Buyer scoping/Policies, API Resources, and thin controllers.
- Suggested actions:
  - `AddCartItem`
  - `UpdateCartItemQuantity`
  - `RemoveCartItem`
  - `BuildCheckoutQuote`
  - `PlaceBuyerOrder`
### Checkout quote
- `BuildCheckoutQuote` should calculate from authoritative data:
```text
selected Cart Items
+ current Product prices
+ Promotions
+ Address/shipping
+ payment-method constraints
→ CheckoutQuoteResource
```
- A quote should have freshness/version metadata if the implementation needs stale-quote detection.
- Quote never guarantees inventory until Place Order succeeds.
### Place Order transaction
Recommended:
```text
validate request
→ begin DB transaction
→ reload selected Cart Items
→ lock relevant Inventory rows
→ revalidate current stock + visibility + price
→ recalculate promotions/totals
→ create Order(s) + Order Items + address snapshots
→ mutate inventory / record promotion use
→ clear ordered Cart Items
→ commit
→ payment/event/notification follow-up according to payment design
```
- Payment sequencing may require a different split; do not make network calls while holding DB locks without a deliberate provider-specific reason.
- Laravel currently documents database transactions and pessimistic locking primitives suitable for this concurrency boundary. citeturn893491view0turn893491view1
### Next.js / React
Recommended:
```text
/cart
├── CartItemList
│   └── CartItemRow
├── VoucherInput
├── AddressSelector
├── PaymentMethodSelector
├── OrderSummary
└── PlaceOrderAction
```
- Use the shared Laravel API client.
- Quantity/voucher/address/payment mutations are interactive Client Component behavior as needed.
- Do not reimplement promotion, shipping, inventory, or final-total logic in Next.js.
### UX research recommendations
- Cart should let the Buyer verify Product, variant, quantity, and full known cost before commitment. citeturn552946search0
- Use low-friction quantity controls so changes are not accidentally missed. citeturn552946search2
- Keep the final payable total visible before payment commitment. citeturn552946search5
- Use an explicit final action such as `Place Order`, not an ambiguous `Continue`. citeturn552946search9
- These are external UX recommendations, not additional AISLEY domain requirements.
### Tests
- **Laravel:** Buyer isolation; add/update/remove; invalid variant/quantity; visibility/Vacation Mode; authoritative price; voucher valid/invalid; address ownership; quote calculation; inventory race; transaction rollback; idempotent placement; successful cleanup; payment-state boundary.
- **Frontend:** empty/loaded Cart; quantity/remove; price/stock changes; voucher; address/payment selection; final summary; duplicate-submit prevention; `409` stock conflict; recoverable errors; success; accessibility.
### Risks
- **Overselling / duplicates:** weak locking or idempotency can create excess stock use, Orders, or charges.
- **Tampering / partial state:** trusting frontend totals or non-transactional writes can corrupt price, promotion, inventory, or Order state.
- **Long locks:** slow external payment calls inside inventory transactions can block other Buyers.
- **Mixed-Seller/stale Cart:** undefined partitioning or changing price/stock/Seller/voucher state can invalidate checkout.
### Open questions
- Mixed-Seller checkout structure and cart-item selection semantics.
- Shipping, tax/fee rules, and Logistics ownership.
- Voucher scope/stacking/usage/consumption timing.
- Payment methods/provider and authorization/capture/webhook sequence.
- Stock reservation/decrement/release timing and initial `PENDING_PAYMENT` vs `PLACED`.
- Guest Cart, Buy Now, price-change acknowledgement, and quote expiry/versioning.
### Sources
- Project feature-spec rules: `SKILL.md`
- AISLEY architecture contract: `README.md`
- Buyer feature model: `Buyer.md`
- Seller feature model: `Seller.md`
- Laravel Database Transactions: https://laravel.com/docs/13.x/database
- Laravel Query Builder / Pessimistic Locking: https://laravel.com/docs/13.x/queries
- Laravel Validation: https://laravel.com/docs/13.x/validation
- Baymard Cart UX Audit: https://baymard.com/learn/ecommerce-ux-audit
- Baymard Cart Quantity UX: https://baymard.com/blog/auto-update-users-quantity-changes
- Baymard Payment UX: https://baymard.com/learn/payment-ux
- Baymard Checkout Flow UX: https://baymard.com/learn/checkout-flow-ux-optimization
