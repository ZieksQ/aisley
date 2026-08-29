---
feature: browse-shop
title: Customer / Buyer Browse Shop
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Buyer
scope: Customer / Buyer Web Application
---

# Customer / Buyer Browse Shop
## WHAT
- **Purpose:** Let Customers/Buyers open one Seller's storefront and browse only that Seller's currently buyer-visible products.
- **Canonical role:** `BUYER`.
- **Primary source behavior:**
  - view a Seller's shop
  - view that Seller's products
  - filter the storefront by categories present in that Seller's catalog
- **Source-defined query boundary:** product retrieval is strictly constrained by `seller_id`.
- **Source-defined frontend requirement:** use dynamic routing for unique Seller shop pages.
- **Source-defined categorization:** the storefront exposes the Seller's localized/custom category structure.
- **Recommended route:**
```text
/shops/{shopSlugOrId}
```
- **Recommended page structure:**
```text
Seller Storefront
├── Shop header
│   ├── shop/business name
│   ├── safe public shop description/avatar/banner if available
│   └── availability/vacation state when product policy permits display
├── Seller category filters
├── Product list
│   └── lightweight buyer product cards
└── Pagination
```
- **Architecture:**
  - Next.js/React owns dynamic routing, shop UI, category-filter state, pagination/navigation, loading/empty/error states.
  - Laravel owns Seller resolution, shop visibility, product visibility, seller-scoped categories, sorting/filter validation, pricing/inventory fields, and pagination.
  - Eloquent/database remains authoritative.
- **Public access recommendation:** Browse Shop should normally be guest-readable because it is a discovery surface, while Buyer-only actions such as Wishlist or Cart follow their own authentication rules.
- **Feature boundaries:**
  - Search owns platform-wide keyword search and product-detail selection.
  - Browse Shop owns seller-scoped discovery only.
  - Seller Account/Shop Management owns public storefront identity/content.
  - Seller catalog/inventory owns product records, categories, price, variants, and stock.
  - Wishlist owns favorite persistence.
  - Cart owns Add-to-Cart mutations.
  - Product Reviews & Ratings owns rating/review data.
  - Product Q&A owns public product questions.
  - Admin Seller Compliance owns product/seller moderation.
- **Non-goals:**
  - cross-seller global search
  - Seller product CRUD
  - Seller category management
  - inventing seller ranking
  - inventing product-category relationships not present in the schema
  - bypassing product visibility rules
  - implementing checkout inside the storefront page
  - exposing Seller private profile/payout/contact data
## MUST
### Seller storefront identity
- Each storefront must resolve one authoritative Seller/shop.
- The route identifier may be:
  - immutable Seller/shop ID, or
  - unique public slug
- Exact identifier strategy is Open.
- If a slug is used:
  - enforce uniqueness
  - normalize according to repository conventions
  - do not use Seller display name alone as authorization/identity
- A missing/non-public Seller shop returns `404`.
### Seller-scoped product invariant
- Every product returned by Browse Shop must satisfy:
```text
product.seller_id = resolved_shop.seller_id
```
or the repository-equivalent relationship.
- Category filters, sorting, pagination, and search-within-shop must never remove this Seller constraint.
- Never accept arbitrary `seller_id` from the browser as proof of shop ownership.
- Resolve the Seller from the route, then apply the Seller scope server-side.
- Tests must specifically verify that products from another Seller cannot appear.
### Buyer-visible product scope
- Browse Shop must use the same canonical buyer-visible product scope as:
  - Search
  - Customer Homepage product sections
  - Cart/Checkout validation where applicable
- Exclude products that are not buyer-visible, including when authoritative rules mark them:
  - inactive/unpublished
  - archived/removed
  - unavailable because of Admin compliance action
  - hidden because the Seller is suspended
  - hidden because Seller Vacation Mode is active
  - otherwise unavailable under catalog rules
- Do not duplicate these conditions ad hoc in every controller.
- Prefer a reusable Eloquent query scope/domain query such as:
```text
Product::buyerVisible()
```
or repository-equivalent.
- Seller scope is then composed with it:
```text
Product::buyerVisible()
  ->where('seller_id', seller.id)
```
### Seller Vacation Mode
- Seller source explicitly states Vacation Mode hides shop listings and disables checkout for those products. fileciteturn33file0
- Browse Shop must honor `is_on_vacation` or the repository-equivalent state.
- When Vacation Mode is active:
  - products must not remain normally purchasable
  - Seller's hidden-listing behavior must match Search/Homepage/Cart
- Exact storefront UX is Open:
  - hide the entire storefront with an unavailable message, or
  - allow the shop profile page but hide/disable product listings
- Do not invent one without the final Seller Vacation Mode spec.
- Checkout must independently revalidate availability even if a stale storefront card is visible.
### Admin compliance / seller suspension
- Admin Seller Compliance can remove products and suspend Sellers, with Seller suspension hiding products. fileciteturn33file6
- Browse Shop must consume those authoritative visibility states.
- A compliance-removed product must not remain visible merely because it belongs to the correct Seller.
- A suspended Seller must not expose active purchasable listings.
- Do not expose internal compliance flags/reasons in public storefront DTOs unless explicitly intended by product policy.
### Seller shop profile data
- Public shop profile fields should be sourced from Seller-owned storefront/account data.
- Safe examples when present in the real schema:
  - shop/business name
  - public logo/avatar
  - public banner
  - public description
  - public rating summary
- Do not expose:
  - payout/bank data
  - personal identification documents
  - private phone/email unless explicitly public
  - internal Seller status notes
  - compliance/admin notes
- Exact public Seller DTO is Open until Seller Account/Shop Management defines it.
### Seller categories
- Buyer source requires filtering by categories the Seller has. fileciteturn33file1
- Storefront category options must be derived from categories associated with that Seller's buyer-visible products.
- A category from Seller A must not filter or reveal Seller B products.
- Category values accepted from the client must be validated against authoritative category IDs/slugs.
- Categories with zero buyer-visible products should normally be omitted.
- Do not trust a client category label as an SQL field or relation name.
### Custom category-tree ambiguity
- Buyer source describes a Seller's "custom categorization tree" but does not define the schema. fileciteturn33file1
- Possible implementations include:
  - shared platform categories attached to Seller products
  - Seller-specific category records
  - Seller-specific grouping layered over platform categories
- The spec must not invent which model is correct.
- Implementation must inspect/use the actual Seller/product category schema.
- If hierarchical categories exist, parent/child behavior follows that schema.
### Category filtering
- Filter behavior:
```text
resolved Seller
+ buyer-visible products
+ selected Seller category
→ filtered Seller product page
```
- Category filter must be allow-listed/validated.
- Unknown category:
  - return `422` for invalid filter input, or
  - return an empty valid result only if that is the project's established collection behavior
- Choose one repository-wide convention.
- Multiple simultaneous categories are not source-required.
- Do not add multi-select unless explicitly desired.
### Sorting
- Sorting is not source-defined.
- Basic deterministic ordering is required so pagination is stable.
- Recommended MVP allow-list:
  - newest
  - price ascending
  - price descending
- Only implement sort modes supported by actual fields.
- "Best Selling", "Popular", or "Recommended" require a defined backend metric and are not automatically included.
- Never pass arbitrary client column names directly to `orderBy`.
### Search within a shop
- Seller-scoped keyword search is not explicitly required by Browse Shop source.
- It may be added later as a convenience.
- If implemented:
  - it must preserve `seller_id` scope
  - it should reuse Search infrastructure where practical
  - it must not become a second unrelated search engine
- Treat as Open/optional.
### Pagination
- Product list must be paginated.
- Do not return the Seller's entire catalog in one response.
- Use a documented maximum page size.
- Preserve validated category/sort parameters across pagination.
- Laravel supports Eloquent/query-builder pagination and applies limits/offsets automatically. citeturn830609view0
- Cursor pagination is optional for very large/rapidly changing catalogs; standard pagination is sufficient unless measured needs justify cursor pagination.
### Product summary DTO
- Product cards must use a lightweight API Resource/DTO.
- Recommended safe fields:
  - product ID
  - product name/title
  - primary image URL
  - fixed-precision price
  - explicit currency
  - discount display data when authoritative
  - category summary when useful
  - rating summary when authoritative
  - stock/availability summary where useful
- Do not serialize raw Eloquent models with unrelated relationships.
- Laravel API Resources or explicit DTOs are preferred over automatic recursive model serialization.
- Laravel's serialization docs warn that loaded relationships are automatically included when models are serialized, reinforcing explicit output control. citeturn967125search1
### Price
- Laravel-returned price is authoritative.
- Use fixed-precision decimal strings or project-approved minor units.
- React must not recalculate authoritative discounts/totals using floating-point arithmetic.
- Storefront price is a current snapshot.
- Product detail/cart/checkout must revalidate the actual current price.
### Inventory
- Browse Shop may show availability/in-stock summary.
- Do not expose private warehouse/inventory internals unless needed.
- Storefront stock display is informational.
- Add-to-Cart and Checkout must revalidate variant stock.
- Stale cached availability does not reserve inventory.
### Product variants
- Product-card browsing does not need to return every variant matrix.
- Selecting a product should navigate to the canonical Product Detail/Search selection flow where quantity/variation choice occurs.
- If quick Add-to-Cart is later supported, required variant selection must be explicit.
- Never silently select a variant when the product requires Buyer choice.
### Wishlist integration
- Authenticated Buyer may favorite a product from storefront cards if Wishlist supports that UI.
- Wishlist persistence remains owned by Wishlist.
- Guest behavior follows Wishlist policy.
- A product hidden after being wishlisted must still respect visibility when rendered/opened.
### Cart integration
- Storefront may expose Add to Cart when product/variant requirements permit.
- Cart owns the mutation.
- Browse Shop must not own quantity/stock reservation.
- Add-to-Cart must revalidate:
  - product visibility
  - Seller availability
  - variant
  - stock
  - price as required
### Product detail navigation
- Product cards should navigate to the canonical product-detail route.
- Do not create Seller-specific duplicate product-detail business logic unless route design requires a nested URL.
- A nested URL may still resolve the same canonical Laravel product-detail API.
- Product detail must independently enforce buyer-visible product state.
### Guest vs authenticated Buyer
- Storefront discovery should normally work for guests.
- Authenticated Buyer state may enrich cards with:
  - Wishlist state
  - Cart state/count
  - Recently Viewed behavior after opening a product
- Buyer-private data must be scoped to authenticated Buyer ID.
- Shared public caching must not contain another Buyer's private state.
### Dynamic routing
- Next.js should use a dynamic Seller/shop route segment.
- Conceptual App Router shape:
```text
app/
└── shops/
    └── [shop]/
        └── page.tsx
```
- Next.js supports dynamic route segments using bracketed folder names such as `[slug]` or `[id]`. citeturn731324search1
- Route identifier is presentation/navigation input; Laravel still resolves authoritative Seller/shop data.
### URL filter state
- Category, sort, and page should preferably be represented in URL search params:
```text
/shops/acme?category=shoes&sort=price_asc&page=2
```
- This supports reload/share/back-navigation.
- Next.js supports managing search/pagination through URL search parameters. citeturn731324search6
- Validate all query params again in Laravel.
### Product-list UX
- Category filters must be visible and understandable.
- Applied category/filter state should remain apparent while browsing.
- Baymard research finds product filtering materially affects users' ability to narrow product lists and recommends clear, relevant filtering. citeturn698694search0turn698694search1
- Because AISLEY source specifically requires Seller categories, prioritize those over speculative global facets.
- Price/rating/attribute filters are not required until separately specified.
### Empty states
- Required distinct empty states:
  - Seller exists but has no buyer-visible products
  - selected category has no buyer-visible products
  - Seller unavailable/vacation behavior
  - Seller/shop not found
- Do not render an empty product grid without explaining why where the reason is safe to disclose.
- Internal suspension/compliance reasons must not leak.
### Caching
- Public shop profile/category/product-list responses may be cached if freshness requirements permit.
- Cache keys must include:
  - Seller/shop ID
  - category
  - sort
  - page/cursor
- Visibility-changing events must expire/invalidate quickly:
  - product archive/unpublish
  - compliance removal
  - Seller suspension
  - Vacation Mode activation
  - stock/price changes where displayed freshness requires it
- Database/Laravel remains authoritative.
- Do not cache Buyer-private Wishlist/Cart state in a shared public response.
### Error states
- Frontend must support:
  - loading
  - loaded
  - empty shop
  - empty category
  - invalid filter
  - shop not found
  - Seller unavailable
  - API/server error
  - offline/retry
- Guest/public shop access should not show `401` when no Buyer-specific action is being performed.
- Buyer-only actions must distinguish unauthenticated from failed product retrieval.
### Accessibility
- Shop heading must clearly identify the Seller/shop.
- Category filters need semantic controls and active-state text.
- Product cards need accessible names, image alt text, price text, and keyboard-accessible links/actions.
- Sort control needs a label.
- Filter state must not rely on color alone.
- Pagination must be keyboard accessible and have meaningful labels.
### Acceptance criteria
- [ ] Buyer/guest can open a valid public Seller shop according to storefront policy.
- [ ] Dynamic route resolves one authoritative Seller/shop.
- [ ] Every returned product belongs to that Seller.
- [ ] Another Seller's product cannot appear through category/sort/page manipulation.
- [ ] Only buyer-visible products are returned.
- [ ] Admin-removed products are excluded.
- [ ] Suspended Seller listings are excluded/disabled according to authoritative policy.
- [ ] Vacation Mode behavior is enforced.
- [ ] Category filters are derived from/validated against that Seller's catalog.
- [ ] Category filtering never removes the Seller scope.
- [ ] Product collection is paginated.
- [ ] Sort fields are allow-listed.
- [ ] Product card DTO exposes only safe public fields.
- [ ] Price uses fixed precision and Laravel authority.
- [ ] Cart/Checkout revalidate product, Seller, stock, and price.
- [ ] Guest response never contains another Buyer's Wishlist/Cart/private state.
- [ ] URL category/sort/page state survives reload/navigation.
- [ ] UI distinguishes shop-not-found, empty-shop, empty-category, unavailable, and API-error states.
## HOW
### Project findings
- `Buyer.md` explicitly defines Browse Shop as viewing one Seller's shop/products and filtering through categories that Seller has. fileciteturn33file1
- It explicitly requires product queries strictly filtered by `seller_id`, unique dynamic shop routes, and the Seller's custom categorization tree. fileciteturn33file1
- Seller Vacation Mode hides shop listings and disables checkout, with `is_on_vacation` acting as a global Buyer-side product/cart filter. fileciteturn33file0
- Admin Seller Compliance can remove listings and suspend Sellers, with suspension hiding Seller products. fileciteturn33file6
- `README.md` requires Laravel-authoritative product/inventory/ownership data, allow-listed filters/sorts, pagination, safe Resources, and no direct Next.js database access. fileciteturn33file10turn33file13
- Current sources do not define shop slug strategy, exact public Seller DTO, category schema, sorting modes, search-within-shop, storefront rating display, or exact Vacation Mode storefront UX.
### Laravel API
Conceptual endpoints:
```http
GET /api/storefront/shops/{shop}
GET /api/storefront/shops/{shop}/products
GET /api/storefront/shops/{shop}/categories
```
- A single composition endpoint is also acceptable if repository conventions prefer:
```http
GET /api/storefront/shops/{shop}?category=...&sort=...&page=...
```
- Resolve Seller/shop first.
- Build one reusable buyer-visible Product scope.
- Add strict Seller relation scope before filters:
```text
resolved seller
→ seller.products()
→ buyerVisible()
→ category filter
→ allow-listed sort
→ paginate
→ ProductSummaryResource
```
### Laravel query scopes
- Recommended concepts:
```text
Seller::publiclyBrowsable()
Product::buyerVisible()
Product::forSeller($sellerId)
Product::inSellerCategory($category)
```
- Exact class/method names follow repository style.
- Eloquent query scopes are appropriate for reusable constraints; Laravel documents local/global scopes for consistently applying query restrictions. citeturn830609view1
- Avoid a global Seller scope that accidentally breaks Seller/Admin management queries unless intentionally designed.
- A dedicated storefront query service may be clearer than an overly broad global scope.
### Laravel resources
Recommended:
```text
ShopPublicResource
ShopCategoryResource
ProductSummaryResource
```
- Explicitly choose fields.
- Eager-load only relationships required by DTOs.
- Avoid N+1 seller/category/image/rating queries.
- Keep private Seller/account fields out of public resources.
### Pagination
- Default to Laravel `paginate()` if the UI needs page numbers/total results.
- Use `simplePaginate()` when only previous/next navigation is needed.
- Consider `cursorPaginate()` only for large, frequently changing catalogs where stable ordered cursor navigation is valuable.
- Laravel documents all three approaches and notes cursor pagination's performance advantages for large indexed ordered data sets. citeturn830609view0
### Next.js / React
Recommended App Router structure:
```text
app/
└── shops/
    └── [shop]/
        ├── page.tsx
        └── loading.tsx
```
Suggested components:
```text
ShopHeader
ShopCategoryFilter
ShopSort
ShopProductGrid
ProductCard
Pagination
ShopEmptyState
```
- Fetch public read data through the shared Laravel API client.
- Server Components are suitable for the read-heavy shop page when the repository uses App Router.
- Client Components are appropriate for interactive category/sort controls where needed.
- Keep category/sort/page in URL query parameters.
- Do not create a Next.js API route that reimplements Laravel storefront rules.
### Filtering UX
- Keep the Seller's categories visible and clearly selected.
- On mobile, a compact filter drawer/select may be used.
- Baymard research emphasizes relevant filters, clear applied-filter state, and product-list information that helps shoppers evaluate products. citeturn698694search1turn698694search6
- AISLEY should not add every possible ecommerce facet merely because external research recommends faceted filtering; Seller-category filtering is the only source-required Browse Shop filter.
### Tests
- **Laravel:** shop not found; Seller scope isolation; category scope isolation; compliance removal; Seller suspension; Vacation Mode; inactive/archived products; pagination; allow-listed sort; invalid category; safe Shop/Product Resources; fixed-precision price; guest public access; authenticated Buyer enrichment isolation.
- **Frontend:** dynamic route; category query params; sort/page persistence; loading; empty shop/category; unavailable Seller; not found; product navigation; guest vs Buyer actions; pagination; accessibility; responsive filters.
### Research-backed recommendations
- Use Laravel pagination rather than loading an entire Seller catalog. citeturn830609view0
- Use reusable Eloquent/query-service visibility constraints so Search, Homepage, Browse Shop, and Cart do not diverge. citeturn830609view1
- Use a dynamic Next.js shop segment such as `[shop]`/`[slug]`. citeturn731324search1
- Persist filters/page in URL search params for predictable navigation. citeturn731324search6
- Keep Seller-category filters obvious and product cards sufficiently informative for comparison. citeturn698694search0turn698694search6
### Risks
- **Cross-seller leakage:** a missing Seller constraint can expose another merchant's products.
- **Visibility mismatch:** Search may hide a suspended Seller while Browse Shop still shows the catalog.
- **Vacation bypass:** stale storefront data may allow purchase attempts while Seller is unavailable.
- **Category leakage:** global category queries can expose irrelevant Seller categories/products.
- **N+1 queries:** cards can trigger excessive image/category/rating lookups.
- **Stale caches:** removed products may remain publicly visible.
- **Overbuilt filters:** adding unsupported facets increases scope and duplicates Search.
- **Private Seller leakage:** raw Seller serialization can expose contact/payout/admin data.
### Open questions
- Shop URL identifier: Seller ID, Shop ID, or public slug.
- Exact public Shop/Seller fields.
- Actual Seller-category schema and whether categories are hierarchical.
- Vacation Mode storefront UX: hide entire catalog vs show unavailable storefront.
- Default sort and allowed sort modes.
- Search-within-shop requirement.
- Whether price/rating/availability filters are needed.
- Whether Seller rating/review summary appears in the shop header.
- Whether guest users can browse all shops.
- Product page URL when entered from a shop.
- Products per page and standard vs cursor pagination.
- Cache/invalidation strategy.
- Whether unavailable/suspended shops are `404` or a public unavailable state.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture contract: `README.md`
- Buyer feature model: `Buyer.md`
- Seller feature model: `Seller.md`
- Admin Seller Compliance source: `Admin.md`
- Laravel Pagination: https://laravel.com/docs/12.x/pagination
- Laravel Eloquent: https://laravel.com/docs/12.x/eloquent
- Laravel Eloquent Serialization: https://laravel.com/docs/12.x/eloquent-serialization
- Next.js dynamic route guidance: https://nextjs.org/learn/dashboard-app/mutating-data
- Next.js search/pagination URL params: https://nextjs.org/learn/dashboard-app/adding-search-and-pagination
- Baymard Product Lists & Filtering: https://baymard.com/research/ecommerce-product-lists
- Baymard Filter UI: https://baymard.com/learn/ecommerce-filter-ui
