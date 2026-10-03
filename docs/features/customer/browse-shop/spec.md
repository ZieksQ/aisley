---
feature: browse-shop
title: Customer Browse Seller Shops
system: AISLEY
type: Feature Specification
version: 2.3
status: Implemented
implementation_status: Directory, Shop pages, category filtering, optional q extension, and dedicated Shop search control implemented
canonical: true
role: Customer
scope: Customer web application and public Laravel read APIs
reviewed: 2026-10-02
---

# Customer Browse Seller Shops

## WHAT

### Purpose and implementation boundary

- Provide a public Shop directory and a public Seller-scoped storefront at `/shops/{slug}`.
- Guests and Customers can open visible Shops and paginate their visible Products using the existing Product Category filter.
- The directory, header, Product list, Resources, Next.js pages, and focused API tests are implemented.
- The Products API and page accept optional `q` for Product-name keyword search within the resolved Shop.
- A Shop belongs to one Seller; `shops.seller_id` is unique and the globally unique `shops.slug` resolves the public route.
- Browse Shop owns the Shop-scoped search/filter contract. Customer Search owns separate marketplace-wide Product and Shop result records.
- Share only compatible query normalization, literal wildcard escaping, public visibility, and pagination conventions—not query scope or ranking.
- Product Detail owns configuration; Wishlist, Cart, and Checkout own mutations; Seller Account Management owns Shop content/vacation.
- Exclude Shop/Product CRUD, Shop ratings, vouchers, following, quick-add, arbitrary sorting, autocomplete, and search-provider changes.

## MUST

### Availability, ownership, and privacy

- Public reads require no Customer authentication; private Wishlist/Cart enrichment stays in separate owning APIs.
- Resolve the Shop with `Shop::storefrontVisible()`: active Shop, active Seller-role account, and not on vacation.
- A missing or unavailable Shop returns the same `404`; do not disclose suspension reasons or expose vacation messages through another public route.
- Every Product query starts with `Product::storefrontVisible()` and the resolved `products.shop_id`.
- Publication, compliance, Shop vacation/status, and Seller status rules apply before every category or keyword condition.
- Category and keyword conditions only narrow this scope; request manipulation cannot select another Seller/Shop or widen it through an OR clause.
- Out-of-stock visible Products may appear with their current compact stock status; discovery never guarantees purchase availability.
- Return only safe Shop fields: `id`, `slug`, `name`, `description`, `logoUrl`, `bannerUrl`, and active public Shop Category summary or null.
- Products reuse `ProductSummaryResource`; exclude private Seller contacts/evidence, Admin notes, Customer data, inventory internals, and raw storage paths.
- Preserve existing numeric display-price fields; Cart/Checkout remain authoritative for stock, price, variants, quantity, and monetary calculations.

### Implemented directory and storefront

- `GET /api/v1/customer/shops` returns public Shop summaries and active Shop Category options.
- Its optional `shop_category` accepts an active canonical Shop Category slug; invalid/unknown values return `422`.
- Directory order remains Shop creation time descending, then UUID descending; do not add rating/distance/popularity sorts.
- The directory page rejects malformed/repeated URL filters rather than dropping them; typed feedback respects throttling/deadlines and retains a recovery link for unavailable filters. A beyond-last page retains pagination instead of claiming the whole directory is empty.
- `GET /api/v1/customer/shops/{slug}` returns the safe Shop header.
- `GET /api/v1/customer/shops/{slug}/products` accepts only `q`, `category`, `page`, and `limit`; unknown keys are rejected.
- Collection `page` is integer 1–10000; `limit` is integer 8–50, default 20. The storefront uses 20 per page.
- Product Category options are distinct active categories attached to this Shop's visible Products, ordered by taxonomy position then name.
- A selected Product Category must be in these Shop-scoped options; an unrelated, inactive, malformed, or unavailable category returns `422`.
- Shop Category classifies the business; Product Category filters Products. Neither is a Seller-created category tree.
- Product order remains publication time descending, then Product UUID descending, whether filtered or not.
- Empty visible Shops are valid browse responses; unavailable Shops are not valid empty catalogues.

### Implemented Shop-scoped keyword extension

- The existing Products endpoint accepts optional `q`; no new global or authenticated search endpoint is needed.
- Accept one string, trim surrounding whitespace, and cap it at 100 characters; missing/empty/whitespace-only `q` means no keyword filter.
- Reject arrays, malformed/repeated scalar inputs, oversized text, invalid pagination, and unsupported keys with `422`; do not silently truncate.
- The Products allow-list is `q`, `category`, `page`, and `limit`; `search`, `seller_id`, and `shop_id` are not aliases.
- Match only Product name by case-insensitive literal substring; descriptions, SKU, Shop name, and category name are not keyword targets.
- Use bound values and escape `!`, `%`, and `_` for LIKE matching, consistent with Customer Product Search.
- Combine Shop visibility/ownership, selected category, and keyword with AND; never call global Search and filter a fetched page in the browser.
- Preserve the existing newest-publication order; global Search's exact/prefix/sales ranking does not apply here.
- Derive category options from the Shop's visible catalogue before applying `q` or the selected category.
- Category options must not disappear because the current keyword has zero matches; the selected category may legitimately return zero matches.
- If a category becomes unavailable after catalogue changes, return validation feedback and offer explicit clearing/retry—not an automatic marketplace search.
- A successful no-match or beyond-last-page response remains `200` with empty `items`, safe Shop header, category options, and accurate pagination.
- Clearing `q` preserves the selected category; clearing the category preserves `q`; clearing both shows only this Shop's visible catalogue.
- Search reads cannot record Recently Viewed, reserve inventory, create Wishlist/Cart rows, or place Orders.

### URL state and Customer experience

- URL: `/shops/{slug}?q={keyword}&category={category}&page={page}`; omit absent/blank filters.
- Keep existing category-only URLs working; submitting/changing/clearing keyword or category resets page to 1.
- Pagination, refresh, and back/forward preserve the normalized keyword and selected category within the same Shop.
- A dedicated labeled “Search in this Shop” control sits near the Product list, with submit and independent keyword/category clear actions.
- The marketplace header remains global Search; the Shop control never navigates to `/search` or another Shop.
- Submit-based search is sufficient; no live-as-you-type request loop or debounce timing is required.
- Show Shop name as the page heading and filtered Product totals as Product-list context.
- Distinguish empty catalogue, valid no-match, unavailable Shop, invalid filter, throttling, offline/timeout, and retriable service failure.
- Keep query/category drafts during failures; a failed request must not render “No products matched.” Typed public reads distinguish validation, Retry-After throttling, a 15-second deadline, and service failure; retry retains the current URL and filters.
- Follow `docs/design.md`: light-only, mobile-first layout, existing Shop/header/Product-card patterns, and compatible shared primitives.
- Label inputs/filters, expose busy/result state text, support keyboard submit/clear/pagination, and maintain visible focus after navigation.
- Preserve canonical Shop metadata at `/shops/{slug}`; do not infer ratings or emit unavailable-Shop structured data.
- Product cards open `/products/{id}`; Wishlist remains independent and variant-dependent purchase controls stay on Product Detail.

### Responses and freshness

- Directory returns `{items, categories, pagination}`; Shop header returns `{data}`; Products return `{shop, categories, items, pagination}`.
- Preserve those envelopes for the `q` extension; pagination fields remain `currentPage`, `lastPage`, `perPage`, and `total`.
- Existing HTTP responses use `public, max-age=60` and `Vary: Accept, Authorization, Cookie`; Next public fetches revalidate after 60 seconds.
- Cache identity includes endpoint, Shop slug/ID, normalized `q`, category, page, and limit; no private enrichment enters shared caching.
- Visibility/price/media may lag within the current window; do not claim immediate cache invalidation exists.
- Product Detail and purchase services revalidate authoritative state independently; cache snapshots never authorize mutations.
- GET retries are read-only and need no mutation idempotency header; unavailable responses are not successful zero-result snapshots.

### Acceptance criteria

Existing baseline and keyword-extension checks have focused API and mocked-HTTP browser coverage; verification is recorded below.

- [x] Public directory/Shop reads enforce Shop/Seller availability and indistinguishable unavailable-Shop responses.
- [x] Shop Products and Product Categories remain visible and Shop-scoped, including compliance exclusions.
- [x] Existing category validation, deterministic bounded pagination, safe Resources, and query-count regression coverage exist.
- [x] Existing pages provide Product Detail navigation and category/loading/empty/not-found/validation/retry presentation.

Keyword extension:

- [x] Optional `q` validates/normalizes correctly, escapes literal wildcard text, and searches Product names only within the resolved Shop.
- [x] Keyword/category intersection never exposes another Shop's Product/category, including crafted inputs and hidden matching records.
- [x] Category options remain independent of keyword results; valid zero-match responses retain filters and truthful totals.
- [x] Submit/clear/category/pagination/reset/back/forward behavior preserves the declared Shop URL state without global navigation.
- [x] Existing response envelopes, ordering, cache isolation, and no-query/category-only behavior remain compatible.
- [x] No search mutation changes inventory, Wishlist, Cart, Recently Viewed, Orders, or operational shipment state.
- [x] Validation, loading, throttling, offline/error/retry, keyboard/focus, and narrow/intermediate/wide light-only states pass verification.
- [x] Focused SQLite/PostgreSQL API regressions, query-count checks, TypeScript, lint, and storefront build pass.

## HOW

### API and UI implementation

- Current route is public under the existing Customer `throttle:120,1` group; it needs no request body or bearer token.
- Implemented example: `GET /api/v1/customer/shops/{slug}/products?q=shirt&category=clothing&page=1&limit=20`.
- `ShopProductsRequest` normalizes/validates the optional keyword and repeated/unknown scalar keys; `ShopBrowseController` passes the validated query to the scoped service.
- Keep `ShopBrowseService::findPublicShop()` and `productCategories()` authoritative; add a bound name condition to its owned Product query before pagination.
- Do not reuse `ProductSearchService::search()` directly: its Shop/category-name matching, global scope, and ranking differ.
- Reuse a focused literal-query helper only if useful; do not change global Search semantics as a side effect.
- `getPublicShopProducts()` accepts `q`; `discovery-url.ts` validates single `q`/category/page values before fetching. `ShopProductsContent` composes the focused `ShopSearch`, existing category controls, cards, feedback, and pagination.
- Keep public server fetching and typed response handling; distinguish throttling/timeouts when extending the existing invalid/error result states.
- Extract a focused Shop search control; reuse category/pagination components while preserving their existing directory consumers.
- Deploy API and storefront changes together; absence of `q` retains the original API behavior.
- Measure substring-query cost and eager-load only required card relationships; no external search provider or new migration is assumed.

### Verification, dependencies, and sources

- Verified on 2026-10-02: focused Customer Homepage/Browse Shop/Shop Search regressions pass on SQLite and a disposable PostgreSQL database (17 tests/300 assertions on each); TypeScript, changed-source ESLint, PHP Pint, URL-parser tests, and the Next.js Webpack production build pass. The temporary database was removed without migrating/seeding the application database.
- Mocked-public-HTTP Chromium checks cover the scoped keyword/category URL, independent clears, stable options on zero matches, no false empty success on errors, loading/keyboard/focus, 390/768/1280px light-only layouts, offline draft preservation, validation, Retry-After, and timeout retries. These do not certify a live production deployment or large-catalogue latency.
- Extend `CustomerBrowseShopTest` for keyword normalization, wildcard text, scope attacks, category intersection/options, zero matches, bounds, privacy, and stable ordering/query counts.
- Run Customer Product Search/directory regressions; changed helpers/components must not alter global results or directory filtering.
- Verify URL state, both clear actions, retry, keyboard/focus, and responsive light-only states; record actual checks in `docs/PROGRESS.md`.
- Runtime implementation requires coordinated API/page/helper/control changes, but no fulfillment or groupmate-managed logistics dependency.
- Authorities: `docs/requirements.md`, `docs/workspace.md`, `docs/domains/Buyer.md`, `docs/design.md`, and the Customer Search spec for ownership boundaries.
- Evidence: `ShopBrowseController`, `ShopProductsRequest`, `ShopDirectoryRequest`, `ShopBrowseService`, Shop/Product Resources, `CustomerBrowseShopTest`, and `src/webapp/src/app/shops/`.
- [Next.js URL search/pagination guidance](https://nextjs.org/learn/dashboard-app/adding-search-and-pagination) supports bookmarkable, server-consumable filter state.
- Shop ratings, vouchers, following, configurable sorting, advanced keyword fields, and alternate search infrastructure remain deferred.
