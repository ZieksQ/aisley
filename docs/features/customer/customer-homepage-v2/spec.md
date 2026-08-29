---
feature: customer-homepage
title: Customer / Buyer Homepage
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Buyer
scope: Customer / Buyer Web Application
---

# Customer / Buyer Homepage
## WHAT
- **Purpose:** Provide the primary storefront landing page for AISLEY Customers/Buyers and act as the central entry point into product discovery.
- **Canonical role:** `BUYER`.
- **User-facing term:** Customer may be used in UI copy; Buyer remains the canonical role in APIs, authorization, and feature directories.
- **Feature status:** This Homepage is a user-added AISLEY feature. `Buyer.md` does not define a standalone Homepage feature.
- **Source-backed features it may compose:**
  - Search
  - product discovery
  - Browse Shop
  - Wishlist/Favorites entry points
  - Recently Viewed Items
  - published platform announcements where enabled
- **Web-research recommendation:** Make the homepage clearly expose the three major ecommerce product-finding paths:
  - search
  - category navigation
  - curated discovery paths
- **Architecture:**
  - Next.js/React owns page rendering, layout, product/category cards, responsive UI, skeletons, and client interactions.
  - Laravel owns all product/shop/category availability, pricing, inventory, seller visibility, and personalized Buyer data.
  - Laravel API data is authoritative.
- **Recommended page composition:**
```text
Customer Homepage
├── Header / navigation
│   ├── Search
│   ├── Categories
│   ├── Cart entry
│   ├── Wishlist entry
│   └── Account / login
├── Optional published announcement/banner
├── Category discovery
├── Curated product sections
│   ├── broad product assortment
│   ├── popular / best-selling when supported
│   └── new/recommended sections only when rules exist
├── Shop / seller discovery when supported
└── Recently Viewed
    └── authenticated or guest behavior from its own feature
```
- **Recommended route:**
```text
/
```
- **Guest behavior:** Homepage should be publicly viewable for product discovery unless the final storefront policy explicitly requires login.
- **Authenticated behavior:** Approved Buyers may additionally receive Buyer-specific sections such as Wishlist state or Recently Viewed.
- **Feature boundaries:**
  - Search owns keyword query/results behavior.
  - Browse Shop owns seller storefront pages.
  - Wishlist owns persistence of saved products.
  - Recently Viewed owns view-history tracking.
  - Cart owns cart mutations/count.
  - Platform Settings owns announcement content.
  - Homepage only composes summaries/entry points from those features.
- **Non-goals:**
  - implementing Search logic inside Homepage
  - owning product-detail behavior
  - owning category taxonomy
  - owning cart/checkout mutations
  - inventing personalization/recommendation algorithms
  - inventing "best seller" formulas
  - directly querying the database from Next.js
  - showing products that are unavailable under seller/compliance/vacation rules
## MUST
### Public vs authenticated access
- Homepage may support:
  - guest visitors
  - authenticated approved Buyers
- Public product discovery must not require Buyer authentication unless another storefront requirement explicitly changes this.
- Buyer-specific data must require authenticated `BUYER` context.
- A guest must never receive:
  - another Buyer's Wishlist state
  - another Buyer's Recently Viewed history
  - Buyer-owned account/order/cart data
- Authentication state must be resolved through Customer Auth/shared session behavior.
- Homepage must render a usable guest state when public access is enabled.
### Homepage API boundary
- Homepage is a read/composition feature.
- It must consume Laravel APIs.
- Next.js must not connect directly to the database.
- Do not duplicate product/business availability rules in React.
- Laravel determines:
  - whether product is visible
  - current price
  - stock/availability summary
  - seller visibility
  - moderation/compliance state
  - vacation-state effect
- Homepage should not be the source of truth for these values.
### Product visibility
- Every product surfaced on Homepage must satisfy the same buyer-visible product rules used by Search/Browse/Checkout.
- Exclude products that are:
  - unpublished/inactive
  - Admin-removed for compliance
  - owned by sellers whose suspension hides listings
  - owned by sellers in Vacation Mode where seller source requires listings hidden
  - otherwise unavailable according to the product/catalog domain
- Homepage cache must not permanently preserve a product that has become unavailable.
- Clicking a product must still fetch/revalidate authoritative product detail.
- Cart/checkout must independently revalidate stock and availability.
### Search entry
- Homepage must expose a prominent Search entry point.
- Search behavior itself belongs to the Buyer Search feature.
- Homepage search submission should navigate/invoke the canonical Search flow.
- Do not maintain a second homepage-only product-search algorithm.
- Search query input must be safely encoded when navigating.
- Search suggestions/autocomplete are not required unless Search spec later defines them.
### Category discovery
- Homepage should provide category navigation if the catalog has an authoritative category taxonomy.
- Categories displayed must come from Laravel/catalog configuration.
- Do not hard-code a second category tree in React.
- Category links must resolve to the Search/Browse/category result surface selected by the project.
- Empty/disabled categories should not be promoted as active discovery paths.
- Exact homepage category count/layout is a UI decision.
- Web research recommends showing enough product/category breadth that visitors can understand the range of products sold on the site.
### Curated product sections
- Homepage may expose curated sections.
- Recommended MVP possibilities:
  - broad featured products
  - popular/best-selling products
  - new products
- Only implement a section when a reproducible backend selection rule exists.
- Do not label products "Best Sellers", "Trending", "Recommended", or equivalent without a defined server-side rule.
- If no ranking rule exists, use neutral labels such as:
  - Featured Products
  - Explore Products
- Exact section names/order are open.
- Laravel must determine product IDs/ranking for curated sections.
- React only renders the returned ordering.
### Featured products
- If Admin/Seller source does not define a manual "featured" flag:
  - do not invent an Admin feature solely for Homepage
  - use an explicitly agreed deterministic selection rule, or
  - omit the section
- A featured section must not bypass normal product visibility rules.
- Exact curation ownership is Open.
### Best-selling / popular products
- Web UX research supports a best-sellers discovery path, but AISLEY sources do not define a best-seller metric.
- Therefore "Best Sellers" is optional.
- If implemented, define the server-side calculation, for example using eligible completed sales within a period.
- Do not hard-code that example as the final formula.
- Prevent cancelled/refunded/non-qualifying transactions from influencing ranking unless the commerce domain explicitly allows it.
### Shop discovery
- Buyer source explicitly supports viewing a Seller's shop and products.
- Homepage may surface a small shop/seller discovery section if useful.
- Shop availability must respect:
  - seller status
  - seller suspension/compliance
  - Vacation Mode
- Exact shop-ranking logic is not source-defined.
- Do not invent "Top Sellers" without a server-defined rule.
### Recently Viewed
- Buyer source explicitly defines Recently Viewed Items.
- Homepage may include a Recently Viewed section.
- The actual tracking/persistence/sync behavior belongs to `recently-viewed-items`.
- For guests, that feature may use local browser state according to its own source/spec.
- For authenticated Buyers, it may use persisted/synced history.
- Homepage must not implement separate view-history storage.
- If no recent items exist, omit the section or show its agreed empty state.
### Wishlist integration
- Product cards may show Wishlist state/action for authenticated Buyers.
- Wishlist persistence belongs to Wishlist/Favorites.
- Guests should receive the product-policy behavior defined by Wishlist:
  - prompt login, or
  - temporary guest behavior if later specified
- Homepage must not maintain a duplicate wishlist data store.
- Failed Wishlist mutation must visibly revert/resolve optimistic UI.
### Cart integration
- Header/product cards may link to Cart or offer Add to Cart if the Search/Product domain allows the same action.
- Cart mutation remains owned by Cart.
- Stock/variant validation remains Laravel-owned.
- Homepage must not place an order directly.
- If variant selection is required before adding, navigate/open the canonical product-selection flow rather than guessing a default variant.
### Announcement/banner integration
- Manage Platform Settings defines published platform announcements.
- Homepage may surface a currently active announcement/banner.
- Only published/current announcements may be shown.
- Draft/archived/expired content must not appear.
- Homepage must consume the published-announcement API/domain rather than copy announcement content into homepage configuration.
- Whether announcements display as:
  - top bar
  - banner
  - card
  is a UI decision.
### Personalized content
- Do not require recommendation algorithms for MVP.
- Personalized sections are allowed only when a documented server-side recommendation rule/data source exists.
- Never infer sensitive traits for recommendations.
- Buyer-specific personalization must not leak between users through shared cache.
- Personalized API responses must be scoped to authenticated Buyer ID.
- Shared public homepage caching must not include Buyer-private data.
### Product card DTO
- Homepage product cards should use a lightweight summary DTO.
- Buyer Search source explicitly expects product summary DTOs.
- Recommended safe fields:
  - product ID
  - product name/title
  - primary image URL
  - fixed-precision price
  - currency
  - seller/shop summary when needed
  - rating summary when authoritative
  - stock/availability summary where appropriate
- Do not send:
  - full inventory internals
  - seller private data
  - payout information
  - hidden moderation notes
- Use configured media URLs/assets rather than server file paths.
### Price and inventory
- Price returned by Laravel is authoritative.
- Use fixed-precision representation according to project conventions.
- Never calculate authoritative price/discount totals in Homepage JavaScript.
- Homepage inventory indicators are informational snapshots.
- Add-to-cart/checkout must revalidate live inventory.
- A stale card must not guarantee purchase availability.
### Performance
- Homepage is a high-traffic read path.
- Avoid returning unbounded product collections.
- Each section must have a server-defined result limit.
- Do not render the full product catalog on Homepage.
- Use efficient indexed queries and select only card-summary fields.
- Independent sections should be fetched/rendered without unnecessary sequential waterfalls.
- Next.js Server Components can fetch/read composition data and stream slower sections where the actual router supports this architecture.
- Use Client Components only where interaction/browser APIs require them.
### Caching
- Public, non-user-specific homepage sections are cache candidates.
- Examples:
  - categories
  - published announcement
  - broad curated product lists
- Buyer-private sections must not use a cache shared across users.
- Any cached product section must have a freshness/invalidation strategy.
- Next.js supports data cache tags/on-demand revalidation when the repository's Next.js version/configuration uses that model.
- Laravel cache may also be used for expensive stable aggregate/ranking queries.
- Do not implement two conflicting cache layers without a clear ownership/invalidation strategy.
- Product/seller moderation and availability changes must eventually invalidate/expire cached homepage results.
### Pagination / "See all"
- Homepage product sections are previews, not full listing pages.
- Use bounded card counts.
- Provide "See all" navigation to the owning Search/category/shop feature when applicable.
- Do not add infinite scrolling to Homepage unless explicitly required.
- Exact section item count is a UI/performance decision.
### Loading and partial failure
- Homepage must support:
  - initial loading/skeleton state where applicable
  - loaded state
  - empty section state
  - partial section error
  - overall error
  - offline/retry behavior according to shared frontend conventions
- One optional section failing should not necessarily make the entire storefront unavailable.
- Do not show stale/fake product values as if they were freshly authoritative when the API failed.
- Search/navigation shell should remain usable where possible.
### SEO / public rendering
- If Homepage is public, meaningful public storefront content should be server-renderable/indexable according to the selected Next.js router.
- Do not require client-side JavaScript merely to expose all basic public category/product links.
- Do not expose Buyer-private personalized content in generated/shared HTML.
- Exact metadata/structured-data SEO requirements are Open.
### Responsive behavior
- Homepage must work on desktop and mobile layouts.
- Primary Search and category navigation must remain easy to reach.
- Product cards must preserve readable:
  - title
  - price
  - image
  - actionable navigation
- Avoid hiding essential discovery paths only behind hover behavior.
### Accessibility
- Use semantic page landmarks/headings.
- Search control requires an accessible label.
- Category/product/shop cards must have accessible link names.
- Product images require appropriate alt text.
- Carousels, if used, need keyboard-operable controls and must not trap focus.
- Auto-rotating banners/carousels should be avoided or provide pause controls.
- Price/status information must not rely on color alone.
### Acceptance criteria
- [ ] Homepage renders at the configured Customer storefront route.
- [ ] Public guest state works when public browsing is enabled.
- [ ] Authenticated Buyer state does not leak to another user.
- [ ] Homepage uses Laravel APIs rather than direct DB access.
- [ ] Search entry navigates into the canonical Buyer Search feature.
- [ ] Category links use authoritative catalog categories.
- [ ] Homepage never surfaces Admin-removed/unavailable seller listings according to authoritative visibility rules.
- [ ] Seller Vacation Mode product hiding is respected.
- [ ] Product cards use lightweight safe DTOs.
- [ ] Price is fixed-precision and Laravel-authoritative.
- [ ] Cart/stock remains revalidated by owning features.
- [ ] Wishlist/Recently Viewed state uses their owning features.
- [ ] Draft/expired announcements do not appear.
- [ ] Curated labels such as Best Sellers are not used without defined backend rules.
- [ ] Buyer-private personalized data is never placed in shared public cache.
- [ ] Product sections use bounded result counts.
- [ ] Optional section failure does not silently corrupt other sections.
- [ ] Homepage supports loading, empty, partial-error, and offline/error states.
- [ ] Core discovery remains keyboard accessible and usable on mobile.
## HOW
### Project findings
- `Buyer.md` does not define a standalone Homepage feature; this is an explicitly user-added storefront feature.
- Buyer Search is the strongest source-backed homepage integration: it provides product discovery and lightweight summary DTOs. fileciteturn29file7
- Buyer Browse Shop, Wishlist/Favorites, and Recently Viewed are explicit Buyer features that Homepage may compose without owning their persistence/business rules. fileciteturn29file5turn29file10
- Customer Auth already leaves public Homepage/Search/Browse behavior to their owning specs and establishes Customer Homepage as the post-login destination. fileciteturn29file8turn29file1
- `README.md` requires Next.js presentation, Laravel-authoritative business data, shared API access, safe loading/error states, and no direct frontend database access. fileciteturn29file11turn29file19
- Current sources do not define homepage sections, featured-product rules, best-seller calculations, personalization algorithms, hero banners, or category layout.
### Recommended Laravel API
- Prefer one compact composition endpoint if it reduces request fan-out without coupling unrelated mutations:
```http
GET /api/storefront/home
```
- Conceptual response:
```json
{
  "announcement": null,
  "categories": [],
  "sections": [
    {
      "key": "featured",
      "title": "Explore Products",
      "products": []
    }
  ]
}
```
- Buyer-private sections may be:
  - returned conditionally when authenticated, or
  - fetched from separate Buyer-scoped endpoints
- Separate private endpoints are safer when shared public caching is heavily used.
- Keep Homepage endpoint read-only.
- Use API Resources/DTOs rather than raw Eloquent models.
### Query/service design
- Suggested service:
```text
GetStorefrontHomepage
```
- Compose existing read/query services for:
  - visible categories
  - buyer-visible products
  - active announcements
  - optional shops
- Do not duplicate visibility or ranking rules.
- Product summary queries should select only required fields and preload relationships needed by card DTOs.
- Bound every section with explicit limits.
### Next.js / React
- Prefer Server Components for public read-heavy sections when using the App Router.
- Next.js documentation states pages/layouts are Server Components by default and recommends Client Components for event handlers/browser APIs. citeturn225917search1
- Suggested component structure:
```text
CustomerHomepagePage
├── StorefrontHeader
├── SearchBar
├── AnnouncementBanner?
├── CategorySection
├── ProductSection*
├── ShopSection?
└── RecentlyViewedSection?
```
- Keep interactive Wishlist/Cart buttons as isolated Client Components where necessary.
- Stream or suspense independent slower sections if it improves first render.
- Next.js supports server-side data fetching and streaming of slower components. citeturn225917search4
### Caching strategy
- Cache only public/stable composition data.
- Examples:
  - category navigation
  - active announcement
  - neutral curated lists
- Do not share-cache authenticated Buyer-specific Wishlist/Recently Viewed/personalized state.
- With a compatible modern Next.js App Router setup, tagged data can be revalidated on demand; current Next.js docs describe `cacheTag`/`revalidateTag` for selectively refreshing cached data. citeturn225917search0turn225917search3
- Verify repository Next.js version/configuration before adopting Cache Components or any specific caching API.
### UX research findings
- Baymard's ecommerce homepage research says the homepage remains an important navigational anchor and should clearly expose search, category navigation, and curated discovery paths. citeturn308997search1turn308997search5
- Their research also recommends showing a sufficiently broad range of product types so users can understand the catalog's breadth. citeturn308997search4turn308997search8
- A best-sellers discovery path can help users start browsing, but AISLEY must define its own server-side ranking before using that label. citeturn308997search4
- These are external UX recommendations, not requirements from `Buyer.md`.
### Tests
- **Laravel:** public homepage access when enabled; safe product/category DTOs; seller suspension/compliance/vacation filtering; bounded results; announcement state filtering; authenticated Buyer-private scoping; no cross-user leakage; deterministic curated ranking where configured.
- **Frontend:** guest/authenticated rendering; Search navigation; category links; product cards; Wishlist/Cart integration; Recently Viewed integration; loading/empty/partial-error states; responsive behavior; accessibility; cache-personalization isolation.
### Risks
- **Invented commerce rules:** vague "Trending"/"Recommended"/"Best Seller" labels can create unsupported business logic.
- **Visibility bypass:** stale Homepage caches can show removed/suspended-seller products.
- **Privacy leakage:** shared cache can expose Buyer-specific Wishlist/history.
- **Data fan-out:** too many independent homepage API calls can slow first render.
- **Overloaded homepage:** too many sections can weaken product discovery.
- **Feature duplication:** Homepage may accidentally reimplement Search, Wishlist, Cart, or Recently Viewed.
- **Stale price/stock:** cards are snapshots; purchase paths must revalidate.
- **Source gap:** AISLEY currently has no canonical homepage section/ranking specification.
### Open questions
- Exact Homepage route (`/` assumed).
- Whether guests can browse the full Homepage.
- Required section order.
- Which category set appears on Homepage.
- Whether a manual Featured Products system exists.
- Whether Best Sellers/New Arrivals are required and their ranking rules.
- Whether seller/shop discovery appears.
- Whether Recently Viewed appears directly on Homepage.
- Whether published announcements appear as a bar/banner.
- Number of products per section.
- Whether homepage personalization is needed.
- Whether hero/promotional banners exist.
- Whether homepage uses one composition endpoint or multiple read endpoints.
- Next.js router/version and cache strategy.
- SEO metadata/structured-data requirements.
### Sources
- Project rules: `SKILL.md`
- AISLEY architecture contract: `README.md`
- Buyer feature model: `Buyer.md`
- Customer / Buyer Authentication spec
- Baymard Homepage & Category Navigation research: https://baymard.com/research/homepage-and-category-usability
- Baymard Ecommerce UX Best Practices: https://baymard.com/learn/ecommerce-ux-best-practices
- Next.js Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- Next.js Fetching Data: https://nextjs.org/docs/app/getting-started/fetching-data
- Next.js cacheTag/revalidateTag: https://nextjs.org/docs/app/api-reference/functions/cacheTag
