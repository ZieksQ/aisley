---
feature: order-management
title: Seller Order Management
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Seller
scope: Seller Web Application
---

# Seller Order Management
## WHAT
- **Purpose:** Give Sellers one catalog-management surface for creating, editing, publishing, archiving, pricing, promoting, and monitoring the products they sell.
- **Canonical role:** `SELLER`.
- **Important naming note:** despite the modeled name **Order Management**, the source defines this feature as a **Product / Catalog / Inventory Information Management** feature, not purchased-order fulfillment. fileciteturn55file0
- Purchased-order handling remains in:
  - Order Notifications
  - Prepare Orders
  - Confirm Delivery
- **Source-defined capabilities:**
  - add Products
  - update Products
  - archive Products
  - set prices
  - set discounts
  - set vouchers
  - monitor stock levels
  - manage Product/catalog information and inventory integration
- **Source-defined schemas:** `Products`, `Inventory`, and `Promotions`. fileciteturn55file0
- **System-flow requirements additionally define:**
  - Product drafts/catalog listing
  - category
  - product media
  - variants/SKUs
  - price
  - stock
  - weight/dimensions
  - visibility/publishing
  - compliance-ready publish checks
  - inventory-ledger adjustment instead of direct stock replacement
  - archive while preserving historical Order references
- **Recommended primary route:**
```text
/seller/products
```
- Recommended supporting routes:
```text
/seller/products/new
/seller/products/{product}
/seller/products/{product}/edit
```
- **Architecture:**
  - Next.js/React owns Seller catalog pages, forms, media upload UX, variant editor, price/promotion UI, stock summaries, validation display, and loading/error/conflict states.
  - Laravel owns Seller/shop authorization, Product validation, SKU uniqueness, fixed-precision pricing, publication/archive rules, promotion rules, media authorization, and orchestration into the Inventory domain.
  - Database/Eloquent is authoritative.
- **Inventory System overlap decision:**
  - `order-management.md` and `inventory-system.md` overlap around stock visibility/adjustment.
  - They are **not duplicates**.
  - Order Management owns the **catalog/product workflow**.
  - Inventory System owns the **authoritative SKU stock ledger**, `on_hand`, `reserved`, `available`, stock movements, order reservation/release/fulfillment effects, and anti-overselling rules.
  - Therefore Inventory System is **not superseded** by this feature.
  - Any stock adjustment initiated from Order Management must call the same Inventory domain action rather than implement a second stock balance.
- **Feature boundaries:**
  - Inventory System owns authoritative stock movements and balances.
  - Low Stock Alerts consumes committed Inventory availability.
  - Bulk Product Import/Export may create/update Products but must reuse this Product/Inventory validation.
  - Vacation Mode controls global Seller listing/checkout availability.
  - Admin Seller Compliance may hide/remove Products or suspend Seller visibility.
  - Buyer Search/Browse Shop/Homepage consume only buyer-visible published Products.
  - Promotions domain owns voucher/discount rules.
- **Non-goals:**
  - incoming Order review
  - waybill generation
  - Seller fulfillment state changes
  - Courier/Logistics dispatch
  - directly overwriting stock without Inventory history
  - deleting historical Order snapshots when Product data changes
  - inventing category, voucher, discount, or variant rules not defined by the actual schema
## MUST
### Authentication and Seller scope
- All Seller catalog mutations require authenticated `SELLER`.
- Every Product query/mutation must be scoped to the authenticated Seller/shop.
- Never trust client-submitted:
  - `seller_id`
  - Product ownership
  - shop ownership
  - inventory balance
  - calculated discount amount
  - publication/compliance eligibility
- A Seller must not read or mutate another Seller's private catalog management records.
- Use project-standard:
  - `401` unauthenticated
  - `403` authenticated but forbidden
  - `404` Seller-scoped resource missing
  - `422` validation failure
  - `409` stale/concurrent mutation where applicable
### Catalog list
- Seller can view a paginated list of their Products.
- Recommended summary fields:
  - Product ID
  - name/title
  - category
  - primary image
  - publish/archive state
  - current price
  - variant/SKU count
  - current sellable stock summary
  - active promotion summary
  - updated timestamp
- Product list must support only allow-listed filters/sorts.
- Recommended filters when supported by schema:
  - published/draft/archived
  - category
  - stock state
- Do not expose arbitrary client column names to `orderBy`.
- Laravel's query builder uses parameter binding for values but explicitly warns that client input must not dictate column names. citeturn734078search2
### Product creation
- Seller may create a Product draft.
- Laravel validates:
  - Seller ownership
  - required Product fields
  - category reference
  - Product attributes
  - price format
  - variants/SKUs
  - nonnegative starting inventory intent
  - media references
  - weight/dimensions where required
- Exact required Product fields are determined by the actual Product schema.
- Do not invent a universal ecommerce Product form when project schema differs.
- Draft creation should not automatically make the Product buyer-visible.
### Product editing
- Seller may update only their own Product.
- Explicitly allow-list mutable fields.
- Do not use unrestricted model mass assignment for arbitrary Product columns.
- Editing current Product data must not rewrite historical Order Item snapshots.
- Current Product changes may affect:
  - Buyer Search
  - Browse Shop
  - Homepage
  - Wishlist cards
  - Cart validation
- Those downstream views must use current authoritative Product state.
### Product text
- Validate text lengths server-side; render safely and sanitize any future rich text.
### Categories
- Category must reference the authoritative schema; do not accept arbitrary IDs.
- Seller-specific vs platform category architecture is Open; category changes propagate to Buyer discovery after commit.
### Variants / SKUs
- Order Management owns Product variant configuration.
- Each SKU/variant should represent a purchasable Product configuration.
- Validate:
  - Product relationship
  - attribute combinations
  - SKU format
  - SKU uniqueness according to selected scope
  - variant price overrides when supported
  - active/inactive variant state
- Exact SKU uniqueness scope is Open:
  - global
  - Seller/shop scoped
- Database uniqueness should enforce the selected rule in addition to Form Request validation.
- Laravel validation supports database uniqueness checks and scoped uniqueness conditions. citeturn835441view0
### Variant removal
- Deactivate/archive instead of breaking Order history; Carts must revalidate unavailable variants.
### Product media
- Product form may upload media because the system flow explicitly captures Product media.
- Uploads must follow shared AISLEY file rules:
  - Laravel-authorized upload
  - allow-listed types
  - size validation
  - malware scanning
  - configured object/file storage
  - generated/safe storage identifiers
  - domain stores asset references rather than application-server paths
- Laravel provides file/image validation and filesystem abstractions for local/S3-compatible storage. citeturn835441view0turn968741search0
- Exact media count, dimensions, file-size limits, and accepted formats are Open.
- Media removal must not break historical Order snapshots if an Order stores the media reference/URL for history.
### Price
- Seller may set Product/variant prices.
- Use fixed-precision decimal values and explicit currency.
- Reject negative prices.
- Exact minimum/maximum price rules are Open.
- React must not be authoritative for money calculations.
- Price update applies to future Buyer discovery/checkout, not historical Order totals.
- Historical Orders retain placed-order price snapshots.
### Price history
- Price history must be reproducible through an append-only price history/event ledger or equivalent; current `products.price` alone is insufficient for reconstruction.
### Discounts
- Seller may configure promotional discounts as required by the source.
- Promotion rules must validate:
  - Seller/Product scope
  - start/end dates
  - amount/percentage
  - thresholds when used
  - stacking/combinability
  - usage limits
- Exact discount types/rules are not defined.
- Do not let Seller provide a client-calculated final Buyer price as authoritative.
- Buyer Cart/Checkout must revalidate the active promotion when placing an Order.
### Vouchers
- Seller may create/manage vouchers where the Promotions schema supports them.
- Voucher creation must be Seller/shop scoped.
- Validate:
  - code format/uniqueness
  - validity window
  - Seller/Product scope
  - discount definition
  - minimum requirements
  - usage limits
  - stacking
- Exact voucher model is Open.
- Do not make voucher behavior duplicate a separate Promotions feature if one exists in the repository.
### Promotion activation
- Only valid promotions may be active; archive/unpublish, suspension, and Vacation Mode must prevent promotions from bypassing Product unavailability.
### Inventory summary
- Order Management may display current stock because source requires Sellers to monitor stock.
- Display data must come from the Inventory System's authoritative balance.
- Recommended per-SKU values when Inventory System is implemented:
```text
on_hand
reserved
available
```
- Product-level stock totals are derived summaries.
- Do not maintain an independent `stock` number in Order Management if Inventory System already owns the balance.
### Manual stock adjustment
- Seller may initiate a stock adjustment from Product/variant management.
- The mutation must delegate to the Inventory domain.
- Required Inventory behavior includes:
  - immutable stock movement
  - Seller/SKU authorization
  - transaction
  - row lock/atomic update
  - nonnegative constraints
  - reason for manual decreases where required
  - idempotency/reference
- Order Management must not directly execute:
```text
inventory.quantity = submitted_quantity
```
without the authoritative Inventory movement rules.
- Laravel provides pessimistic `lockForUpdate()` and recommends locks inside transactions. citeturn734078search2
### Inventory concurrency
- Two simultaneous Seller adjustments/order reservations must not make availability invalid.
- Inventory System remains responsible for:
```text
on_hand >= 0
reserved >= 0
reserved <= on_hand
available = on_hand - reserved
```
- Seller UI should refetch the committed balance after mutation.
- Use `409` for stale/conflicting adjustments where applicable.
### Low Stock Alerts integration
- Low Stock Alerts defines per-SKU thresholds and consumes committed inventory changes. fileciteturn54file1
- Order Management may show threshold/low-stock state.
- It must not maintain a second stock balance or duplicate alert calculation logic.
- Threshold editing may be placed here if Low Stock Alerts delegates that UI, but the alert domain remains authoritative.
### Publish
- Publishing makes a Product eligible for Buyer discovery only if all required rules pass.
- The system flow explicitly requires compliance-ready data before publish.
- Recommended publish checks:
  - required Product fields complete
  - at least one valid purchasable variant when variants are required
  - valid current price
  - required media
  - category
  - dimensions/weight where required
  - Product not blocked by compliance
  - Seller account allowed to list Products
- Exact checklist follows actual platform policy.
- Publish is an explicit domain action, not a client-controlled boolean update.
### Buyer visibility
- Buyer visibility requires published/active state plus no compliance removal, Seller suspension, or Vacation Mode.
- Search/Browse Shop/Homepage reuse one buyer-visible scope; Vacation Mode removes listings from search and disables checkout. fileciteturn54file1
### Archive
- Seller may archive their Product.
- Archive means:
  - remove from new Buyer discovery
  - prevent new checkout
  - preserve Product record/history
  - preserve historical Order references
  - preserve Inventory ledger/history
- Do not hard-delete a Product merely because Seller wants it removed from sale.
- Archive should invalidate/update search indexes or caches after commit.
### Restore / unarchive
- Restore is not source-defined; if added, re-run publish/compliance checks before Buyer visibility.
### Compliance
- Seller cannot override Admin listing removal/suspension; expose only safe availability state, while appeals remain outside this feature.
### Vacation Mode
- Catalog maintenance may continue while away, but Buyer discovery/checkout stays disabled; disabling Vacation Mode must not auto-publish draft/archived/noncompliant Products.
### Bulk Product Import/Export
- Bulk Product Import/Export is a separate Seller feature.
- Imported Product rows must reuse the same:
  - Product validation
  - Seller ownership
  - SKU uniqueness
  - price rules
  - publication rules
  - Inventory domain actions
- Bulk upload must not implement a second weaker catalog/inventory code path.
- Partial-row failure semantics belong to the Bulk feature.
### Historical Order integrity
- Product edits must not mutate historical Order Item facts such as:
  - purchased Product/variant description where snapshotted
  - paid unit price
  - quantity
  - discounts/totals
- Archive/deactivate should preserve historical references.
- Current catalog fields and historical Order snapshots are separate concepts.
### Search/index/cache propagation
- Product publish/edit/archive may require:
  - search index update
  - storefront cache invalidation
  - Wishlist/Product-card refresh behavior
- External/index work should dispatch after commit.
- Laravel queues support after-commit dispatch so jobs do not observe rolled-back Product state. citeturn734078search5
- A failed search-index/cache job must not roll back the committed catalog mutation; it should retry/reconcile.
### Idempotency
- Protect duplicate-sensitive create/publish/archive actions; Inventory adjustment idempotency remains owned by Inventory System.
### Pagination and API Resources
- Product collections must be paginated.
- Laravel provides built-in pagination for Eloquent/query-builder collections. citeturn835441view3
- Use explicit `SellerProductResource` / variant/promotion resources.
- Do not return raw recursively serialized Eloquent graphs.
- Laravel API Resources are intended to transform models/collections into controlled JSON responses. citeturn835441view2
### Frontend states
- Catalog: loading, empty, loaded, filtered-empty, error.
- Form: draft, validating, saving, saved, validation/conflict/media failure.
- Publication: draft, publishable, blocked, published, archived, compliance unavailable.
- Inventory: loading, available, low/out, adjustment pending, conflict/error.
### Accessibility
- Use labeled fields, field-addressable errors, keyboard-operable variant/media controls, textual publish/archive state, and announced async price/stock/save errors.
### Acceptance criteria
- [ ] Seller can create/list/edit only their own Products with server validation and database-backed SKU rules.
- [ ] Product media is validated/stored through authorized object/file storage.
- [ ] Price/promotion changes use fixed-precision and authoritative Promotion rules without rewriting historical Orders.
- [ ] Stock display/adjustment delegates to Inventory System; concurrent mutations cannot create invalid availability.
- [ ] Publish requires readiness/compliance; archive preserves Product, Inventory, and Order history.
- [ ] Vacation Mode/compliance/suspension override Buyer visibility.
- [ ] Bulk import reuses the same Product/Inventory rules.
- [ ] Catalog list is paginated with allow-listed filters/sorts; search/cache propagation runs after commit.
- [ ] Purchased-order fulfillment stays outside this feature and Inventory System remains a distinct stock domain.
## HOW
### Project findings
- `Seller.md` calls the feature **Order Management**, but its actual Core Value is Product CRUD, prices, discounts, vouchers, and stock monitoring; its Expanded Definition explicitly describes Product and Inventory Information Management. fileciteturn55file0
- The existing `order-management.md` system flow confirms it is catalog/inventory management and explicitly states purchased-order fulfillment belongs to Order Notifications and Prepare Orders.
- The separate `inventory-system.md` is materially deeper: it defines `on_hand`, `reserved`, `available`, immutable stock movements, Order reservation/release/fulfillment effects, returns, locking, and reconciliation.
- Therefore these documents are **related but not sufficiently similar for Order Management to supersede Inventory System**.
- `README.md` requires Laravel authority, Seller scoping, transactions/locks for stock, after-commit events, API Resources, pagination, fixed-precision money, and safe file storage. fileciteturn55file1
- Seller source also separately defines Low Stock Alerts, Bulk Product Import/Export, and Vacation Mode, so Order Management must integrate with those rather than absorb their entire behavior. fileciteturn54file1
### Recommended Laravel model boundaries
```text
Seller / Shop
└── Products
    └── Variants / SKUs
        └── Inventory Balance + Movement Ledger   # Inventory System

Products
└── Product Media

Products / Seller
└── Promotions / Vouchers
```
- Exact table names follow repository schema.
- Avoid placing all Product, SKU, stock history, promotion, and media data in a single table.
### Recommended Laravel API
Conceptual Product endpoints:
```http
GET    /api/seller/products
POST   /api/seller/products
GET    /api/seller/products/{product}
PATCH  /api/seller/products/{product}
POST   /api/seller/products/{product}/publish
POST   /api/seller/products/{product}/archive
```
Variant endpoints when needed:
```http
POST   /api/seller/products/{product}/variants
PATCH  /api/seller/products/{product}/variants/{variant}
POST   /api/seller/products/{product}/variants/{variant}/deactivate
```
Stock adjustment delegates to Inventory System:
```http
POST /api/seller/inventory/{sku}/adjustments
```
Promotion endpoints may remain in a Promotions controller/domain.
- Use Form Requests, Seller-scoped Policies, API Resources, and thin controllers.
### Recommended actions/services
```text
CreateSellerProduct
UpdateSellerProduct
PublishSellerProduct
ArchiveSellerProduct
CreateProductVariant
UpdateProductVariant

Inventory domain:
AdjustInventory
GetSkuInventoryBalance

Promotion domain:
CreateSellerPromotion
ValidateSellerPromotion
```
- Order Management orchestrates these domains but does not duplicate their internal rules.
### Product save transaction
Recommended:
```text
authenticate Seller
→ scope Product/shop
→ validate Product/variant/media intents
→ begin transaction when multiple domain rows change
→ create/update Product + variants
→ call Inventory action for accepted starting/manual stock movements
→ persist promotion relations where part of same operation
→ commit
→ dispatch search/cache/storefront events after commit
```
- Do not hold database locks while performing slow media/network work.
- Upload media through an authorized pre-upload or staged asset flow where practical.
### Inventory delegation
Recommended:
```text
Order Management stock field/button
→ AdjustInventory action
→ lock SKU balance
→ append InventoryMovement
→ update/recalculate authoritative balance
→ commit
→ InventoryChanged
→ Low Stock / Search / Cart / Wishlist consumers
```
- This preserves the richer Inventory System semantics and prevents two competing stock models.
### Next.js / React
Recommended structure:
```text
/seller/products
├── ProductTable
├── ProductFilters
└── ProductStatusBadge

/seller/products/new
/seller/products/[product]/edit
├── ProductBasicInfoForm
├── ProductCategoryFields
├── ProductMediaManager
├── VariantEditor
├── PricingSection
├── PromotionSection
├── InventorySummary
└── PublishArchiveActions
```
- Use Client Components for interactive forms/uploads/variant editors.
- Fetch/mutate through the shared Laravel API client.
- React may calculate presentation previews but Laravel returns authoritative validation, price, stock, and state.
### Validation, media, transactions
- Use dedicated Product/Variant/Publish Form Requests with field-addressable `422` errors. citeturn835441view0
- Use configured Laravel filesystem/object storage; AISLEY additionally requires malware scanning and asset references. citeturn968741search0
- Use transactions for multi-row Product/variant changes; Inventory mutations always use the Inventory domain's atomic/locking rules. Laravel supports `lockForUpdate()` inside transactions. citeturn734078search2
### Events
Recommended:
```text
ProductCreated
ProductUpdated
ProductPublished
ProductArchived
ProductPriceChanged
ProductVisibilityChanged
```
Inventory events remain owned by Inventory System.
- Dispatch downstream index/cache/notification jobs after commit. citeturn734078search5
### Tests
- **Laravel:** Seller isolation; Product/variant CRUD; validation/SKU uniqueness; media; fixed-price/promotions; publish/archive/history; Vacation/compliance visibility; Inventory delegation/concurrency; pagination/filter allow-list.
- **Frontend:** catalog/form/variant/media/pricing/inventory states; publish/archive/conflict behavior; accessibility.
### Risks
- **Boundary confusion:** misleading naming can pull purchased-order fulfillment or duplicate Inventory logic into this module.
- **Integrity:** weak scoping/history/promotion rules can leak tenant data or corrupt historical prices.
- **Staleness/security:** failed index propagation or weak media validation can expose stale listings or unsafe files.
- **Scope growth:** catalog, promotions, inventory, alerts, bulk import, and fulfillment can become one oversized feature.
### Open questions
- Keep `Order Management` or rename to `Catalog/Product Management`.
- Draft vs publish fields; category model; SKU uniqueness; variant archive behavior.
- Media limits; price-history storage; promotion/voucher rules.
- Publication/compliance checklist and archive restore behavior.
- Where manual Inventory adjustment UI lives and whether Inventory has a dedicated route.
- Search/index/cache propagation strategy.
### Sources
- Project feature-spec rules: `SKILL.md`
- AISLEY architecture/system-flow contract: `README.md`
- Seller model source: `Seller.md`
- Seller flow: `feature-system-flows/seller/order-management.md`
- Seller flow: `feature-system-flows/seller/inventory-system.md`
- Laravel Validation: https://laravel.com/docs/12.x/validation
- Laravel Query Builder / Pessimistic Locking: https://laravel.com/docs/13.x/queries
