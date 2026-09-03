---
feature: browse-shop
title: Customer Browse Seller Shops
system: AISLEY
type: Feature Specification
version: 2.0
status: Ready for implementation
role: Customer
scope: Customer web application and public Laravel read APIs
---

# Customer Browse Seller Shops

## WHAT

- Provide a public Shop directory and a public, Seller-scoped storefront at `/shops/{slug}`.
- Let guests and signed-in Customers discover active Shops, open a Shop, and browse that Shop's currently storefront-visible Products.
- Let a Customer narrow the Shop's Products by the existing canonical Product Category taxonomy.
- The route identity is `shops.slug`; it is globally unique in the implemented schema and is already emitted by Product Detail as `storefrontUrl`.
- A Shop has one Seller (`shops.seller_id` is unique); this feature never accepts a browser-supplied Seller ID as a scope.
- Reuse the existing `Product::storefrontVisible()` scope and `ProductSummaryResource`; public Shop browsing must have the same Product availability boundary as homepage, search, Product Detail, Cart, and Checkout.

- The Shop directory owns Shop discovery only. Product Detail owns Product detail and variant selection; Search owns marketplace-wide keyword search; Wishlist and Cart own their mutations; Seller Account Management owns Shop content and vacation mode.
- Shop Category classifies a Shop's business. Product Category is the canonical hierarchical taxonomy for Products; neither is a Seller-created category tree.
- This feature does not create Shop/Product CRUD, Seller ranking, reviews, messaging, vouchers, checkout, quick-add behavior, or a search-within-Shop field.

## MUST

### Public availability and privacy

- Both directory and Shop reads are guest-readable. A missing or non-public Shop returns the same `404` response so suspended/inactive Shop and Seller state is not disclosed.
- A public Shop is active, belongs to an active Seller with the Seller role, and is not on vacation. This must align with `Product::storefrontVisible()`.
- A vacation Shop is not browseable. Do not expose its vacation message through a separately reachable public Shop endpoint while its catalog is hidden.
- The public Shop DTO may contain only `id`, `slug`, `name`, `description`, `logoUrl`, `bannerUrl`, and safe Shop Category summary. Do not expose contact details, Seller profile details, payout data, documents, account status, Admin notes, compliance data, or storage paths.
- Product results are always built with `storefrontVisible()` and `where('products.shop_id', $shop->id)` (or the equivalent Shop relationship). Compliance-restricted, unpublished, archived, future-published, vacation, inactive-Shop, and inactive-Seller Products never appear.
- Product cards reuse the existing safe `ProductSummaryResource`; prices remain Laravel-authoritative snapshots. Product Detail, Cart, and Checkout independently revalidate current visibility, price, variant, and stock.
- Public responses must not contain Customer-specific Wishlist, Cart, address, order, or session data. `Vary` and caching must not permit a shared response to leak private state.

### Directory

- `GET /api/v1/customer/shops` returns paginated public Shop summaries, newest stable order by default, with `page` and bounded `limit` validation consistent with Product Search (`limit` 8–50, default 20).
- The only initial directory filter is optional `shop_category` by canonical Shop Category slug. It accepts one value, validates that the category is active, and returns `422` for malformed/unknown values.
- Do not introduce popularity, rating, distance, promoted placement, or arbitrary client-driven sorting until their authoritative data and rules exist.
- A directory page has loading, populated, empty, invalid-filter, API-error/retry, and accessible pagination states. It must link to the canonical Shop URL.

### Shop storefront

- `GET /api/v1/customer/shops/{slug}` resolves the public Shop header. `GET /api/v1/customer/shops/{slug}/products` returns its paginated Products and available category filters.
- The Products endpoint accepts optional `category` Product Category slug, `page`, and `limit`; it rejects unrecognised query keys and invalid values with the repository's normal validation response.
- Category options are distinct active Product Categories attached to this Shop's storefront-visible Products, ordered by taxonomy `position`, then name. Categories with no visible Shop Product are omitted.
- A supplied category must be one of those Shop category options. It must never widen the query to another Shop, even if its global slug is valid.
- The initial product order is deterministic: newest publication first with Product UUID as the tie breaker. Do not expose product sort controls until allowed sort semantics are approved.
- Products remain paginated. Preserve valid query parameters in pagination links and in the browser URL: `/shops/{slug}?category={category}&page={page}`.
- A Shop with no visible Products is a valid Shop response with an explicit empty-catalogue state. A valid selected category with no Products should normally be impossible because options are derived from visible Products; handle it safely if state becomes stale.
- Product cards link to the existing canonical `/products/{id}` page. They may reuse the existing Wishlist control; variant-dependent Add to Cart remains on Product Detail.

### HTTP response and freshness rules

- Successful collection responses return an `items` array and the standard pagination object. The Shop-products response also returns the resolved safe Shop header and the derived category options so they share one authoritative scope.
- Use `404` only for the route identity/public-availability boundary and `422` only for invalid validated parameters; do not turn an empty catalogue into an error.
- Do not add an authenticated-only endpoint or a Next.js proxy that repeats Laravel's public visibility logic.
- Set an explicit short public cache policy consistent with Product Search. Any authenticated private enrichment must be `no-store` and separate.
- Changes to Shop status/vacation, Seller active status, Product publication/archive, Product compliance restriction, visible price/media, or Product category must make affected Shop browse responses stale promptly.
- A stale page can never authorize a Cart or Checkout mutation; those services retain their existing transactional validation.

### Customer experience and accessibility

- Implement `/shops` and `/shops/[slug]` in the existing Next.js App Router, using the shared Laravel API client and existing marketplace header/product-card patterns.
- Read directory/filter/page query state on the server page and use a small client control only to change URL parameters. Reset `page` to `1` when changing a category.
- Render Shop name as the page `h1`; give category controls a visible label, semantic buttons or links, an announced selected state, and keyboard support.
- Use meaningful Shop/logo/banner alt text, maintain focus after filter or pagination navigation, and distinguish not-found, empty directory, empty catalogue, validation, loading, and retriable service-error states.
- Generate canonical metadata for `/shops/{slug}` from the safe Shop DTO. Do not emit structured data for unavailable Shops or infer ratings/reviews.

### Acceptance criteria

- [x] Guests and authenticated Customers can paginate the public Shop directory and open an active Shop by its slug.
- [x] A non-existent, inactive, suspended, or vacation Shop has no public browse response.
- [x] Every Shop Product belongs to the resolved Shop; query manipulation cannot reveal another Shop's Product or category.
- [x] The directory and Shop list exclude every Product excluded by `storefrontVisible()`, including active compliance restrictions.
- [x] Only active, visible Product Categories appear as Shop filters, and a selected filter remains Seller/Shop-scoped.
- [x] Product pagination is bounded, deterministic, and retains valid URL state.
- [x] Public DTOs contain no private Seller, Admin, or Customer information and do not expose raw media paths.
- [x] The Customer UI has responsive, keyboard-accessible loading, empty, not-found, validation, and retry states.

## HOW

### API and data flow

- Add a Customer public `ShopBrowseController`, request classes, and explicit `ShopSummaryResource`/`ShopDetailResource`; retain `ProductSummaryResource` rather than duplicating Product-card mapping.
- Create a focused `ShopBrowseService` or query object. It resolves public Shops by slug and composes `Product::query()->storefrontVisible()->where('shop_id', $shop->id)` before category filtering and pagination.
- Eager-load only `shopCategory` for Shop resources and `shop`, `category`, and `galleryMedia` relationships already needed by Product cards. Verify query counts to prevent N+1 loading.
- Derive category options from the same final visible Shop Product query, using distinct Category IDs. Do not trust a category label or SQL column from the client.
- Return Product Search-compatible pagination fields: `currentPage`, `lastPage`, `perPage`, and `total`. Use `paginate()` because directory and Shop UI require page navigation.
- Apply short public caching only after correctness tests pass. Cache identity includes endpoint, Shop slug/ID, validated category, page, and limit; invalidate or use a brief TTL when Shop state, Product publication, price, media, category, or compliance restriction changes.

### Customer application

- Add typed `ShopSummary`, `ShopDetail`, `ShopBrowseResponse`, and shared server-client API helpers under `src/webapp/src/lib/marketplace/`.
- Build `src/webapp/src/app/shops/page.tsx` for the directory and `src/webapp/src/app/shops/[slug]/page.tsx` plus route-level `loading.tsx` and `not-found.tsx` for a Shop.
- Reuse `MarketplaceHeader`, `ProductCard`, pagination conventions, responsive image handling, and the existing Product Detail route. Add focused Shop header, category-filter, Shop-card, and empty-state components only where reuse is not suitable.
- Fetch public data without Customer credentials by default. Private Wishlist state, if later enriched, must be fetched separately after Customer authentication and must never change the cached public Shop payload.

### Validation and tests

- Laravel feature tests: public guest access; active Shop lookup; indistinguishable unavailable `404`; Seller/Shop scope isolation; Product visibility/compliance/vacation exclusions; category derivation and validation; pagination bounds/order; safe resources; and no N+1 regression for a representative list.
- Customer tests: directory and Shop routing; query-string category/page behavior; Product Detail navigation; loading, empty, `404`, validation, and retry rendering; responsive controls; keyboard navigation and labelled filter state.
- Run focused API tests and Customer lint, strict TypeScript, and production build. Append an accurate dated `docs/PROGRESS.md` entry after the implementation; this specification revision is logged separately as documentation work.

### Open implementation choices

- Confirm whether Shop cards should display only logo/name/category or also the safe description and banner; the schema supports each but the directory density is a product decision.
- Confirm the initial page size shown by the UI within the API's existing 8–50 bound. The recommended default is 20 for parity with Product Search.
- Decide the cache TTL/invalidation mechanism with the existing homepage cache implementation before adding cache keys. Correct visibility takes priority over cache duration.
- Add Shop ratings, in-Shop keyword search, sorting, vouchers, and Shop-following only through their own approved specifications and authoritative data contracts.

### Sources

- Existing implementation: `src/api/app/Models/Shop.php`, `src/api/app/Models/Product.php`, `src/api/app/Services/Customer/ProductSearchService.php`, and `src/api/app/Http/Resources/Customer/ProductSummaryResource.php`.
- [Laravel pagination](https://laravel.com/docs/12.x/pagination) supports bounded page-based API collections.
- [Next.js dynamic route and search-parameter guidance](https://nextjs.org/docs/app/getting-started/layouts-and-pages) supports the existing App Router route and URL-state design.
