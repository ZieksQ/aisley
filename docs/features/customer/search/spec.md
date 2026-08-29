---
feature: search
title: Customer / Buyer Search
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Buyer
scope: Customer / Buyer Web Application
---

# Customer / Buyer Search
## WHAT
- **Purpose:** Let Customers/Buyers search the AISLEY product catalog by keyword, quickly scan lightweight product summaries, then open a Product Detail/configuration flow to choose quantity/variations and Buy or Add to Cart.
- **Canonical role:** `BUYER`.
- **Source-defined capabilities:**
  - keyword search across Products
  - lightweight `summaryDTO` results for fast rendering
  - choose a Product from results
  - choose quantity
  - choose available variations such as color/size
  - Buy or Add to Cart
  - validate live stock before Add to Cart
- **Source-defined technical direction:** full-text search indexing over `Products`, with Elasticsearch or PostgreSQL `tsvector` given as examples. fileciteturn50file0
- **Important interpretation:** the source requires **full-text search capability**, but does not require Elasticsearch specifically.
- **Recommended architecture:**
```text
Search input
→ Laravel Search API
→ buyer-visible Product scope
→ full-text keyword search
→ relevance ordering
→ pagination
→ ProductSummaryResource[]
→ Buyer selects Product
→ Product Detail/configuration
→ choose variant + quantity
→ Add to Cart / Buy Now handoff
```
- **Architecture responsibilities:**
  - Next.js/React owns search input, URL query state, result rendering, pagination UI, product-selection UI, and loading/empty/error states.
  - Laravel owns query validation, searchable fields, full-text execution, Product visibility, ranking strategy, filtering/sorting when enabled, Product DTOs, variant/stock validation, and Cart/Checkout handoff.
  - Database/search index remains authoritative for searchable Product data.
- **Recommended routes:**
```text
/search?q=shirt&page=1
/products/{product}
```
- **Public access recommendation:** Search/product discovery should normally be available to guests; Buyer authentication is required only for Buyer-owned mutations such as Wishlist/Cart/Checkout according to their own specs.
- **Feature boundaries:**
  - Customer Homepage may embed/search into this canonical feature.
  - Browse Shop is Seller-scoped discovery; Search is platform-wide.
  - Product Detail/configuration handles product-specific variant/quantity selection.
  - Cart owns Add-to-Cart persistence.
  - Checkout owns order creation/Buy Now.
  - Seller catalog owns Product searchable data, variants, price, and inventory.
  - Seller Vacation Mode and Admin compliance determine Buyer visibility.
- **Non-goals:**
  - Seller-scoped Browse Shop filtering
  - product CRUD
  - inventory mutation
  - cart persistence
  - checkout/payment implementation
  - recommendation/personalization engine
  - semantic/vector/AI search unless separately required
  - forcing Elasticsearch when native/database search meets project needs
  - inventing filters not present in the Product schema
## MUST
### Search access
- Product search may be available to guests and authenticated Buyers.
- Buyer-specific enrichment must require authenticated `BUYER` context.
- Public results must never expose Buyer-private state or Seller-private fields.
- Guest search must not depend on a Buyer account existing.
### Query parameter
- Accept a bounded keyword query, conceptually:
```http
GET /api/storefront/products/search?q=shirt&page=1
```
- Laravel validates and normalizes the query.
- Trim surrounding whitespace.
- Enforce a maximum query length.
- Exact maximum is Open.
- Decide whether empty query:
  - returns a general catalog/discovery listing, or
  - returns no search results
- Do not silently invent this behavior.
- Search text must never be interpolated into raw SQL.
### Full-text search
- Buyer source requires full-text search indexing. fileciteturn50file0
- Searchable fields must be explicitly defined.
- Likely candidates:
  - Product name/title
  - Product description
  - SKU only if Buyer-facing search by SKU is intended
  - category text only if supported by the actual schema
- Exact searchable fields are Open.
- Do not index private/internal fields.
- Use a real full-text/search-index strategy rather than unbounded `%LIKE%` scans on a large catalog.
- Search implementation must remain compatible with the configured database/search engine.
### Search engine selection
- Source examples (`Elasticsearch`, PostgreSQL `tsvector`) are examples, not mandatory providers. fileciteturn50file0
- Current Laravel 12 provides built-in full-text search using database full-text indexes on MariaDB, MySQL, and PostgreSQL through `whereFullText`. citeturn272257search0
- Laravel Scout can also keep searchable Eloquent models synchronized and use:
  - database engine
  - third-party search engines
- Recommended decision sequence:
```text
small/moderate school-project catalog
→ use database-native full-text or Scout database engine

need typo tolerance / advanced faceting / larger search infrastructure
→ evaluate Scout + Meilisearch / Typesense / Algolia / other supported engine
```
- Do not introduce Elasticsearch solely because it appears as an example in `Buyer.md`.
- Final engine depends on the actual database and project deployment constraints.
### Search index synchronization
- Searchable Product changes must eventually appear in Search:
  - create
  - rename/description update
  - category update when indexed
  - archive/unpublish
  - compliance removal
  - Seller suspension/availability changes where indexed/filterable
- If database-native full-text is used, normal database writes keep source fields current.
- If an external index is used:
  - Product index updates must be synchronized from authoritative Laravel mutations
  - failed indexing must be observable/retryable
  - stale index results must still be revalidated before purchase mutations
- External index must never become the source of truth for price/stock.
### Buyer-visible Product scope
- Search results must use the canonical buyer-visible Product rules.
- Exclude Products that are:
  - unpublished/inactive
  - archived/deleted
  - removed for Admin compliance
  - hidden because Seller is suspended
  - hidden because Seller Vacation Mode is active
  - otherwise not buyer-visible
- Seller source states Vacation Mode removes products from active search indices and disables checkout. fileciteturn49file6
- Do not let full-text index hits bypass Laravel visibility rules.
- Search, Homepage, Browse Shop, Product Detail, Cart, and Checkout should reuse consistent Product visibility semantics.
### Relevance
- Default keyword search should return results in a deterministic relevance-oriented order where supported.
- Laravel's current full-text search can use database-native relevance behavior, and Scout's database engine can order by relevance. citeturn272257search0
- Exact ranking weights are not source-defined.
- Do not invent boosts for:
  - Seller popularity
  - paid placement
  - sales count
  - review score
unless product requirements explicitly define them.
- When relevance ties occur, use a stable secondary order.
### Search result DTO
- Source explicitly requires a lightweight summary DTO. fileciteturn50file0
- Recommended `ProductSummaryResource` fields:
  - Product ID
  - product name/title
  - primary image URL
  - fixed-precision current price
  - currency
  - safe discount/display price when authoritative
  - Seller/shop public summary when useful
  - rating summary when authoritative
  - compact availability state
- Do not return:
  - full Product description when unnecessary
  - full variant matrix
  - Seller private information
  - inventory internals
  - compliance notes
  - payout/payment data
- Use explicit Laravel API Resources/DTOs instead of raw model serialization.
### Price
- Price returned by Laravel is authoritative.
- Use fixed-precision decimal strings or project-approved minor units.
- Search UI may format price but must not calculate authoritative discounts/totals with JavaScript floating point.
- Product Detail/Cart/Checkout revalidate current price.
### Inventory in search results
- Search may show a compact availability indicator.
- It must not expose detailed internal stock counts unless Product requirements explicitly require them.
- Search result availability is a snapshot.
- It does not reserve inventory.
- Product selection/Add-to-Cart/Buy Now must validate current variant stock again.
### Variants
- Buyer source explicitly says after selecting a Product the Buyer chooses variations such as color/size. fileciteturn50file0
- Search result summary does not need the full variation matrix.
- Selecting a Product transitions to Product Detail/configuration where Laravel returns authoritative available variations.
- Variant choices must come from the Product's actual variant/SKU relationships.
- Do not hard-code `color` and `size` as the only supported attributes; they are source examples.
- Unavailable/disabled variants must not be selectable.
### Quantity
- Buyer selects quantity after choosing a Product.
- Quantity must be validated server-side:
  - positive integer or domain-approved unit
  - within configured purchase limits when applicable
  - no greater than available stock when stock is discrete
- Client controls improve UX but do not guarantee inventory.
- Add-to-Cart/Buy Now revalidates quantity and stock at mutation time.
### Product Detail handoff
- Selecting a search result should open the canonical Product Detail/configuration route.
- Product Detail must refetch/revalidate authoritative Product data.
- Do not assume the Search summary remains current.
- If Product becomes unavailable between Search and Product Detail:
  - Product Detail returns unavailable/not found according to visibility policy
  - do not allow stale Add-to-Cart/Buy Now.
### Add to Cart handoff
- Search/Product Detail may expose `Add to Cart`.
- Cart owns persistence/mutation.
- Before Cart accepts:
  - Product is buyer-visible
  - Seller is available
  - selected variant is valid
  - quantity is valid
  - current stock is sufficient
  - current price is authoritative
- Search must not directly decrement/reserve stock unless Cart design explicitly does so.
### Buy Now handoff
- Source allows Buyer to "Buy" after configuring Product. fileciteturn50file0
- Treat this as a handoff into the canonical Cart/Checkout domain.
- Do not implement a separate payment/order-creation path inside Search.
- Exact Buy Now behavior is Open:
  - create a temporary one-item checkout context, or
  - add/select the item in Cart and proceed to checkout
- Either path must reuse Checkout validation and inventory/payment rules.
### Category/filter behavior
- Buyer Search source requires keyword search but does not explicitly require category, price, rating, Seller, or attribute filters.
- Do not make advanced faceted filters mandatory in MVP.
- Filters may be added when:
  - source/product requirements request them
  - corresponding Product fields exist
- Every filter must be allow-listed and validated by Laravel.
- Search engine choice should not force filters the product does not need.
### Sorting
- Source does not define sort modes.
- Relevance is the recommended default for a non-empty keyword query.
- Optional future allow-list may include:
  - newest
  - price ascending
  - price descending
- Do not expose arbitrary SQL/index sort field names from query parameters.
- "Popular", "Best Selling", or "Recommended" require defined metrics.
### Pagination
- Search results must be paginated.
- Do not return the entire matching catalog.
- Enforce a maximum page size.
- Preserve search query and approved filters/sort across pagination.
- `README.md` requires collection pagination and allow-listed filters/sorts. fileciteturn50file1
- Cursor pagination may be considered only if scale/query characteristics justify it.
### URL search state
- Search query, page, and approved filters/sort should be represented in URL search parameters:
```text
/search?q=shoes&page=2
```
- This supports refresh, back/forward navigation, and shareable search URLs.
- Next.js documentation recommends URL search params for server-consumable, bookmarkable search/pagination state. citeturn272257search1
- Starting a new query should reset pagination to page 1.
### Debouncing
- Search-as-you-type requests may be debounced to avoid unnecessary API traffic.
- Exact debounce duration is a frontend implementation choice.
- Do not require live-as-you-type search if submit-based search is preferred.
- Next.js's search/pagination guide demonstrates debounced URL updates, but the specific timing is not an AISLEY requirement. citeturn272257search1
### Empty query / no results
- Distinguish:
  - no query
  - valid query with zero matches
  - invalid query
  - API failure
- "No results" must not be shown when the API actually failed.
- No-results UI should preserve/refine the query rather than silently redirecting.
- Exact fallback recommendations/categories are not source-defined.
### Typo tolerance
- Typo tolerance is not source-required.
- Database-native full-text may be sufficient for MVP.
- Laravel documentation notes external search services become useful for features such as typo tolerance or advanced faceting at larger scale. citeturn272257search0
- Do not add external search infrastructure solely for typo tolerance unless it is an actual product requirement.
### Semantic / AI search
- Semantic/vector search is not source-required.
- Do not introduce embeddings, vector databases, AI reranking, or LLM query rewriting for MVP.
- Laravel now supports semantic/vector/reranking search options, but these are outside current AISLEY requirements. citeturn272257search0
### Search logging / analytics
- Source does not require query analytics.
- Do not persist Buyer search history by default.
- If future analytics records search queries:
  - define purpose/retention
  - minimize Buyer identity
  - avoid sensitive query logging
- Recently Viewed remains separate and only records Product Detail visits.
### Caching
- Repeated public search results may be cached only when compatible with freshness requirements.
- Cache keys must include query and all filters/sort/page parameters.
- Price, stock, Seller status, compliance state, and Vacation Mode can make stale search results misleading.
- Database/search source remains authoritative.
- Do not shared-cache authenticated Buyer-private Wishlist/Cart state.
### Performance
- Search should use indexed/search-engine operations rather than scanning all Products in application memory.
- Select only fields needed for Product summaries.
- Eager-load only required card relationships to avoid N+1 queries.
- Bound query length and result page size.
- Measure before introducing external search infrastructure.
- For a school-project/moderate catalog, Laravel database full-text/Scout database engine may be sufficient. citeturn272257search0
### Security
- Treat query/filter values as untrusted.
- Use Laravel query builder/Eloquent/search-engine APIs rather than SQL string interpolation.
- Search must not expose hidden Product/Seller fields through query syntax.
- Do not expose backend index credentials to Next.js browser code.
- External search services, if chosen, must be accessed through trusted server/configuration unless a deliberately secured public-search client architecture is separately designed.
### Frontend states
- Search page:
  - idle/no query
  - searching/loading
  - loaded
  - no results
  - invalid query
  - pagination loading
  - API/server error
  - offline/retry
- Product selection:
  - loading Product Detail
  - Product unavailable
  - variants loading
  - variant unavailable
  - quantity invalid
  - Add-to-Cart/Buy failure
- Do not report Add-to-Cart/Buy success before the owning API confirms it.
### Accessibility
- Search input requires an accessible label/role.
- Search submission and clear controls must be keyboard accessible.
- Result count/status changes should be announced without excessive interruption.
- Product cards require accessible names, image alt text, price text, and actionable links.
- Variant/quantity controls require labels and error associations.
- Pagination must use meaningful accessible navigation labels.
### Acceptance criteria
- [ ] Guest can search buyer-visible Products when public discovery is enabled.
- [ ] Search query is server-validated and safely executed.
- [ ] Search uses a full-text/indexed strategy rather than unbounded application-side scanning.
- [ ] Elasticsearch is not required unless explicitly selected.
- [ ] Search returns lightweight Product summary DTOs.
- [ ] Hidden/inactive/compliance-removed/Vacation Mode Products are excluded.
- [ ] Results are relevant/deterministically ordered.
- [ ] Results are paginated with bounded page size.
- [ ] URL preserves query/page and new queries reset to page 1.
- [ ] Product selection refetches authoritative Product Detail.
- [ ] Variant options come from authoritative Product data.
- [ ] Quantity/stock are revalidated before Add to Cart / Buy.
- [ ] Search does not reserve or mutate inventory.
- [ ] Add to Cart delegates to Cart.
- [ ] Buy Now delegates to Checkout rather than creating separate payment logic.
- [ ] Search summary price uses fixed precision and is revalidated later.
- [ ] No-result and API-error states are distinguishable.
- [ ] Search query cannot expose private Seller/internal Product data.
- [ ] Advanced filters, typo tolerance, and AI search remain optional unless required.
## HOW
### Project findings
- `Buyer.md` defines Search as keyword querying over `Products`, returning a lightweight `summaryDTO`, then transitioning to quantity/variation selection with Buy/Add-to-Cart actions. fileciteturn50file0
- Its system context requires full-text indexing and gives Elasticsearch/PostgreSQL `tsvector` as examples; these are examples rather than explicit mandatory providers. fileciteturn50file0
- Seller Vacation Mode must remove Seller products from active Buyer search and disable checkout. fileciteturn49file6
- AISLEY architecture requires Laravel-authoritative Product/inventory values, safe API Resources, pagination, allow-listed filters/sorts, shared API-client access, and no direct Next.js database access. fileciteturn50file1
- Current sources do not define exact searchable Product fields, search engine/provider, filters, sort modes, typo tolerance, autocomplete, query analytics, or exact Buy Now behavior.
### Recommended search engine
- First inspect the configured database:
  - PostgreSQL → native full-text/`tsvector` via Laravel full-text APIs is a strong MVP option.
  - MySQL/MariaDB → native full-text index via Laravel is also supported.
- Laravel 12's current Search documentation says native full-text search is available for MariaDB, MySQL, and PostgreSQL with no external service required. citeturn272257search0
- Laravel Scout database engine is another suitable option when automatic model indexing/relevance handling is useful.
- Escalate to an external Scout engine only when requirements such as typo tolerance, advanced faceting, or scale justify it.
### Laravel search query
Conceptual:
```http
GET /api/storefront/products/search
    ?q=wireless+mouse
    &page=1
```
- Suggested service:
```text
SearchBuyerVisibleProducts
```
- Conceptual pipeline:
```text
validate query
→ buyerVisible Product scope
→ full-text search
→ relevance ordering
→ approved filters/sort
→ paginate
→ ProductSummaryResource
```
- Keep visibility constraints outside engine-specific ranking code where practical so external-index hits can still be revalidated against authoritative Product state.
### Database full-text option
- Laravel supports defining full-text indexes in migrations and querying them with `whereFullText`. citeturn272257search0
- Example conceptual migration:
```text
FULLTEXT(product_name, description)
```
or PostgreSQL-equivalent full-text index.
- Exact fields/language/index syntax depend on the configured database.
- PostgreSQL native `whereFullText` filtering does not automatically relevance-order in the same way described for MySQL; Scout's database engine can provide relevance ordering. citeturn272257search0
### Laravel Scout option
- Add `Searchable` only if Scout fits the repository.
- Define `toSearchableArray()` with **public searchable fields only**.
- Scout's database engine can mix full-text, prefix, and normal matching strategies and automatically maintain Eloquent searchability. citeturn272257search0
- Do not include:
  - Seller private metadata
  - internal moderation notes
  - private inventory fields
in the searchable document.
### Product detail / configuration
Recommended read flow:
```http
GET /api/storefront/products/{product}
```
- Response provides:
  - Product public detail
  - available variation dimensions/options
  - current variant availability
  - fixed-precision price data
- Search itself should not ship the complete variant matrix in every result card.
### Next.js / React
Recommended routes/components:
```text
/search
├── SearchInput
├── SearchResultCount
├── ProductResultGrid
│   └── ProductCard
└── Pagination

/products/[product]
├── ProductDetails
├── VariantSelector
├── QuantitySelector
├── AddToCartAction
└── BuyNowAction
```
- Search query/page belong in URL search params.
- Next.js documents `useSearchParams`, `usePathname`, and `useRouter` for synchronizing search/pagination with the URL. citeturn272257search1
- Public result rendering may use Server Components where compatible with the repository; interactive input/variant/cart controls use Client Components.
- Use the shared Laravel API client.
### Tests
- **Laravel:** valid/empty/oversized query; relevance; full-text indexed behavior; Product visibility; Vacation Mode/compliance exclusion; pagination; stable sorting; safe summary DTO; invalid filters; Product Detail availability; variant/stock validation handoff.
- **Frontend:** URL query sync; new-query page reset; debounce/submit behavior; loading/no-results/error; pagination; Product Detail transition; variant/quantity UI; stale Product; Add-to-Cart/Buy handoff; accessibility.
### Research-backed recommendations
- Prefer Laravel/database-native full-text for the initial moderate catalog before deploying a separate search service. Laravel states built-in database search is sufficient for many applications. citeturn272257search0
- Use an external search engine only when product requirements justify advanced typo tolerance/faceting/scale. citeturn272257search0
- Keep search and pagination state in the URL for bookmarkable/shareable/server-readable results. citeturn272257search1
- Keep Cart/Checkout stock validation authoritative because Search results are only discovery snapshots.
### Risks
- **Stale search index:** removed/Vacation Mode/compliance Products can remain discoverable if index sync/visibility validation is weak.
- **Search-engine overkill:** Elasticsearch adds deployment/maintenance complexity without a demonstrated need.
- **Slow scans:** naive wildcard queries can degrade as Product count grows.
- **Private-field leakage:** raw indexed documents/resources may expose Seller/internal data.
- **Inventory race:** Search result stock can become stale before Add to Cart.
- **Ranking surprises:** undocumented boosts can make relevance unpredictable.
- **Feature creep:** autocomplete, AI search, typo tolerance, faceting, recommendations, and analytics can greatly expand MVP.
### Open questions
- Configured production database/search engine.
- Exact searchable Product fields.
- Empty-query behavior.
- Query length and results-per-page limits.
- Search relevance/ranking rules.
- Required category/price/rating/attribute filters, if any.
- Allowed sort modes.
- Search autocomplete/suggestions.
- Typo tolerance requirement.
- Whether guest Search is fully public.
- Exact Product Detail route.
- Exact Buy Now behavior.
- Whether search queries are logged for analytics.
- Search cache/index synchronization strategy.
- Whether SKU is Buyer-searchable.
### Sources
- Project feature-spec rules: `SKILL.md`
- AISLEY architecture/system-flow contract: `README.md`
- Buyer feature model: `Buyer.md`
- Seller feature model: `Seller.md`
- Laravel Search 12.x: https://laravel.com/docs/12.x/search
- Next.js Search & Pagination: https://nextjs.org/learn/dashboard-app/adding-search-and-pagination
