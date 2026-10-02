---
feature: search
title: Customer Product and Shop Search
system: AISLEY
type: Feature Specification
version: 2.1
status: Draft
implementation_status: Public Product search implemented; separate Shop search API and result mode planned
canonical: true
role: Customer
scope: Customer Next.js storefront and public Laravel read APIs
reviewed: 2026-10-02
backend_contract_commit: 8188da9
---

# Customer Product and Shop Search

## WHAT

### Purpose and current implementation

- Let guests and Customers find public Products, open Product Detail, and continue through the owning Cart/Checkout flows.
- Persisted/API role is `customer`; Buyer is a storefront/domain term, not an uppercase `BUYER` role.
- Implemented Product search matches Product name, related Shop name, or related Product Category name, but returns only Product cards.
- Searching a Shop name currently finds its matching Products; it does not return separate Shop result records.
- Public Product search and `/search?q={query}&page={page}` are implemented; a public Shop directory also exists.
- The current service uses bound, escaped, case-insensitive database matching; full-text indexing, Scout, and Elasticsearch are not implemented.
- This revision defines a bounded planned **Shops** result mode alongside the existing **Products** mode.
- Planned Shop-search endpoints, mode controls, and acceptance items below do not claim working API/UI availability.

### Ownership and non-goals

- Search owns marketplace-wide keyword discovery; Browse Shop owns the directory, Shop detail, category filtering, and Shop-scoped Product lists.
- A Shop result opens `/shops/{slug}`; a Product result opens `/products/{id}`.
- Product Detail owns variant/quantity selection; Cart/Checkout own mutations, current stock/price validation, and order creation.
- Exclude in-Shop keyword search, arbitrary facets/sorts, autocomplete, paid boosts, recommendations, AI search, and new search-history persistence.
- Planned in-Shop keyword search is owned by `docs/features/customer/browse-shop/spec.md`; its optional `q` extension is not implemented yet. This marketplace Search feature must not implement that extension or widen its Shop scope.
- The features share only compatible normalization, literal wildcard escaping, visibility, and pagination conventions; global `q` is required, while Browse Shop treats missing/blank `q` as no keyword filter and retains publication ordering.
- No Order, shipment, logistics-flow, inventory, registration, or account-approval changes belong to this feature.

## MUST

### Public access and visibility

- Guests and authenticated Customers receive the same public discovery payload; sign-in is not required to search.
- Authenticated Wishlist/Cart state stays in separate owning APIs and is never inserted into shared public search responses.
- Product queries begin with `Product::storefrontVisible()`; matching clauses must remain grouped inside that visibility boundary.
- Exclude inactive/unpublished/future-published, compliance-restricted, archived, vacation-Shop, inactive-Shop, and inactive-Seller Products.
- Public out-of-stock Products may still appear with `stockStatus = out_of_stock`; visibility is not a purchase authorization.
- Planned Shop queries begin with `Shop::storefrontVisible()`: active Shop, active Seller role/account, and no vacation mode.
- A visible Shop without visible Products may appear, consistent with Browse Shop's valid empty-catalogue state.
- Product restrictions do not by themselves suspend the Shop; restricted Products remain absent from its catalogue.
- Revalidate Shop availability on navigation; unavailable Shop reads retain the existing indistinguishable `404` boundary.
- Return safe Resources only; exclude Seller contacts/documents, addresses, moderation notes, storage paths, payment data, and Customer-private state.

### Implemented Product query and ranking

- `q` is required, trimmed, and validated as a string of 1–100 characters.
- `page` is optional, integer 1–10000; `limit` is optional, integer 8–50, default 20.
- Missing/blank/oversized queries or invalid declared pagination fields return the normal `422` validation response.
- Match lowercase Product name, related Shop name, or related Product Category name by literal substring.
- Escape `!`, `%`, and `_` for LIKE matching and bind values; a query containing `%` must not mean “all Products.”
- Current order: exact Product-name match, Product-name prefix match, other matches; then `sold_count` descending, `review_count` descending, Product UUID ascending.
- Do not claim semantic relevance, description/SKU/brand matching, typo correction, or a configurable popularity sort.
- The current API validates declared fields; it does not explicitly reject every unknown query key. Unsupported keys must not acquire implicit filtering or sorting authority.

### Planned Shop query and ranking

- Shop-search `q`, `page`, and `limit` use the same bounds/default as Product search; reject unknown keys and malformed/repeated scalar inputs.
- Match only the public Shop name by literal, case-insensitive substring, using bound values and identical wildcard escaping.
- Do not search Seller identity, contact details, registration evidence, Shop addresses, or private descriptions.
- Planned order: exact Shop-name match, name prefix, remaining matches; then Shop creation time descending and UUID ascending.
- Return one result per Shop, independent of its Product count; no duplicate Shop cards for matching Products.
- Return the existing safe Shop summary: `id`, `slug`, `name`, `description`, `logoUrl`, `bannerUrl`, and active public `category` summary or null.
- Search text is plain text; render titles/descriptions safely without executing HTML or query-supplied highlight markup.

### Results, prices, and freshness

- Preserve Product response fields and `ProductSummaryResource`; do not silently change numeric `price`/`originalPrice` to decimal strings.
- Product cards currently format numeric prices in PHP currency; authoritative monetary calculations remain in Laravel/Cart/Checkout.
- Product summaries contain card fields, public Shop identity, compact availability, rating/sales snapshots, and badges—not full descriptions or variant matrices.
- Both modes use bounded page pagination with `currentPage`, `lastPage`, `perPage`, and `total`.
- A valid zero-match or beyond-last-page result is a successful empty collection, not an unavailable service.
- Existing Product HTTP cache is `public, max-age=60`, with `Vary: Accept, Authorization, Cookie`; Next public fetches revalidate after 60 seconds.
- Planned Shop search follows the same short public policy; cache identity includes endpoint/mode, query, page, and limit.
- Cached results may lag visibility/price/media changes within the window; Product Detail, Cart, and Checkout independently revalidate.
- No search read records Recently Viewed, changes inventory, creates a Wishlist row, or authorizes a purchase.
- Existing submit analytics emit the query through the browser hook; do not describe this as a persistent backend search-history feature or add tracking/retention providers here.

### URL state and Customer experience

- Keep Products as the default mode for existing URLs; planned modes use `/search?type=products|shops&q={query}&page={page}`.
- Changing query or mode resets the page to 1; pagination, refresh, and back/forward preserve the selected mode and query.
- `type` is a storefront selector for the appropriate API, not a currently accepted backend Product-search filter.
- Invalid mode or repeated/malformed query parameters must show validation feedback rather than crashing or silently widening scope.
- Existing submit-based search remains supported; no live-as-you-type requests or debounce timing are required.
- The current page trims/truncates `q` to 100 characters and normalizes invalid pages to 1; the target should show invalid input rather than silently truncating it.
- With no query, show the search prompt and do not issue a keyword-search request; a direct blank API query remains `422`.
- Distinguish loading, populated, no-query, no-match, validation, throttling, timeout/offline, and service-error states.
- Existing Product helper collapses non-success responses to null; target typed results must distinguish `422`, `429`, and retryable failure.
- Preserve the submitted query/mode during failures; provide a visible retry, respect throttling, and discard obsolete results after navigation.
- Follow `docs/design.md`: light-only, mobile-first storefront, existing header/cards/spacing, visible focus, labeled input, keyboard-operable mode links and pagination.
- Result totals describe only the selected mode; do not report Shop counts as Product counts or combine differently paginated collections.
- Keep current search metadata `noindex, follow` and canonical `/search`; meaningful server-rendered content does not require indexing every query URL.
- Navigation to Product/Shop Detail uses server-authoritative availability; variant selection, Add to Cart, and Buy Now retain their owning contracts.

### Acceptance criteria

Implemented baseline: code and existing tests inspected; no application tests rerun for this revision.

- [x] Public Product search validates trimmed queries and bounds declared page/limit fields.
- [x] Product, Shop-name, and category-name matches return only storefront-visible Product cards with deterministic ordering.
- [x] Literal wildcard handling, blank-query rejection, and safe card projection have focused existing API coverage.
- [x] The storefront implements submit-based Product search, URL pagination, Product Detail links, and distinct no-query/no-match/service-error messages.

Planned enhancement and verification:

- [ ] Shop search returns unique visible Shop summaries using the declared name-only matching, ranking, pagination, and privacy contract.
- [ ] Products/Shops mode switching preserves query, resets page, and survives refresh/back/forward without mixing results.
- [ ] Both modes handle malformed/repeated/oversized input, validation, throttling, timeout/offline, and visible retry without false empty success.
- [ ] Suspended/inactive/vacation Shops and hidden Products remain excluded; empty visible Shops and out-of-stock Products follow the defined rules.
- [ ] Response/cache compatibility and authenticated private-state isolation hold; no search request mutates domain records.
- [ ] Query-count, deterministic pagination, literal wildcard, privacy, SQLite/PostgreSQL, and owning browse regressions pass.
- [ ] Responsive light-only, keyboard/focus/loading states, TypeScript, lint, and storefront build checks pass.

## HOW

### APIs and implementation boundaries

- Implemented: `GET /api/v1/customer/products/search?q={query}&page=1&limit=20`; public read, existing `throttle:120,1`, no body or bearer token required.
- Existing 200 shape: `{query, items: ProductSummary[], pagination: {currentPage, lastPage, perPage, total}}`; errors include `422` and `429`.
- Planned, unavailable: `GET /api/v1/customer/search/shops?q={query}&page=1&limit=20`; same public read/throttle/error conventions and `{query, items: ShopSummary[], pagination}` shape.
- This proposed static path avoids colliding with existing `/shops/{slug}` identities; Browse Shop endpoints and existing Product responses stay unchanged.
- GET retries are read-only and return newly read/cached public projections; no mutation idempotency key is needed.
- Preserve `ProductSearchRequest`, `ProductSearchController`, and `ProductSearchService`; add focused Customer Shop-search Request/controller/service using the existing Shop scope/resource.
- Reuse typed public API helpers, safe Product/Shop cards, and URL-state controls; keep mode composition in the page and parsing/fetching in focused modules.
- Fetch only the selected result mode; bound queries and eager-load only required relationships to prevent N+1 growth.
- Measure database substring-query cost; full-text/trigram optimization or external indexing needs a separately scoped additive migration/provider decision, not a claim of existing infrastructure.
- Inspect local Next.js guidance before runtime changes; deploy the Shop endpoint before exposing a working Shops mode.
- Extend `CustomerHomepageTest` search coverage and add focused Shop-search tests; run Browse Shop regressions and preserve its independently owned optional-query/category/order contract.
- Record actual test/build/browser results in `docs/PROGRESS.md`; documentation alone does not certify runtime completion.

### Sources

- Authority: `docs/requirements.md`, `docs/workspace.md`, `docs/architecture.md`, `docs/domains/Buyer.md`, and `docs/design.md`.
- Owning discovery/handoff contracts: Customer Browse Shop, View Product, View Cart, Checkout Order, Wishlist, and Recently Viewed specs.
- Evidence: `src/api/app/Services/Customer/ProductSearchService.php`, Customer Search Requests/controllers/Resources, Shop browse service, and `src/api/tests/Feature/Customer/CustomerHomepageTest.php`.
- UI evidence: `src/webapp/src/app/search/page.tsx`, `src/webapp/src/components/marketplace/marketplace-search.tsx`, and `src/webapp/src/lib/marketplace/server.ts`.
- Implementation guidance: [Laravel bound queries](https://laravel.com/framework/docs/13.x/queries) and [Next.js URL-based search/pagination](https://nextjs.org/learn/dashboard-app/adding-search-and-pagination).
