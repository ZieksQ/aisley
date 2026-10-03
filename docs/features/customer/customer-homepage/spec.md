---
feature: customer-homepage
title: Customer Homepage
system: AISLEY
type: Feature Specification
version: 2.2
status: Implemented baseline; scoped integration and verification gaps remain
implementation_status: Public aggregation, SSR sections, session-scoped credentialed refresh and cleanup, and bounded discovery implemented
canonical: true
role: Customer
scope: Customer Next.js storefront and Laravel read APIs
reviewed: 2026-10-03
---

# Customer Homepage

## WHAT

### Purpose and current scope

- Provide the public storefront landing page at `/` for guests and Customers to discover Products, categories, deals, and Shop entry points.
- Persisted/API role is `customer`; Buyer is a storefront/domain term, never an uppercase API role or separate account type.
- Laravel owns eligibility, selection, ranking, prices, and optional Customer context. Next.js renders public initial content and browser interactions.
- The aggregation APIs and Homepage components already exist; this is their current contract, not a proposal for a new Homepage implementation.
- Existing campaign, category, deal, Product, and recency tables are reused. No new Homepage migration, seed, provider, or recommendation engine is required.

### Ownership and non-goals

- Search and Browse Shop own results and filtering; Product Detail owns variant selection and Cart handoff.
- Wishlist, Cart, Recently Viewed, authentication, messages, and notifications retain their own stores, APIs, permissions, and UI providers.
- Admin Content Customization owns Homepage advertisements; Platform Settings announcements and outbound notification campaigns are separate features.
- Homepage impressions never record Product recency, reserve inventory, save a Wishlist item, place an Order, or grant purchase eligibility.
- Exclude a new Shop-ranking rail, AI recommendations, sales attribution, voucher issuance, ad authoring, and physical shipment changes.

## MUST

### Implemented page composition

The current page renders these sections in order; optional empty rails are omitted rather than filled with invented Products.

| Section | Current source and behavior |
| --- | --- |
| Utility bar and marketplace header | Existing search, navigation, messages, notifications, Cart, account/login controls; account widgets use their owning providers. |
| Hero advertisements | `advertisementLayer` when present, otherwise legacy `campaigns.hero/side`; generic discovery artwork/copy when no campaign exists. |
| Quick actions | Configured Vouchers, Flash Deals, Free Shipping, Top Products, New Arrivals, Shops, and Categories shortcuts; UI displays at most eight. |
| Categories | Up to 20 active root Categories, name ascending; cards open Products keyword search using the Category name, not an exact Category filter. No requirement that each Category already has visible Products. |
| Flash deals | One active in-window deal, earliest ending first, with up to 12 eligible discounted Products; omitted when no eligible deal Products exist. |
| Top products | Up to 12 purchasable Products ranked by sold count, review count, average rating, then publication time, all descending. |
| Recently viewed | Up to 12 current visible Products from Customer-owned history or resolved guest-local history, newest first. |
| Discovery feed | “Discover on Aisley” for guests; “Just for you” for active Customers; initial recommendation page plus bounded cursor loading. |

- There is no separate Homepage Shop-results rail or New Arrivals collection; a shortcut does not certify that its destination feature is implemented.
- Header submission opens the owning `/search` Products mode with an encoded query; Shops mode belongs to Search.
- Product cards open `/products/{id}` and reuse Wishlist controls. They do not perform Homepage-specific variant quick-add.
- The live Cart badge comes from `CartProvider`; Homepage `viewer.cartItemCount` currently remains zero and is not an authoritative Cart count.

### Access, visibility, and safe projections

- Both Homepage APIs are public reads with optional Sanctum identity, outside `customer.active` and `policy.consent` middleware.
- Personalize only for a server-resolved active `customer`; inactive Customers and other roles receive guest-style context, not another role's private data.
- Clients cannot select a Customer through `user_id`, role, Shop, or ownership fields. Owning private actions retain their approval/consent gates.
- Flash deals, Top products, and recommendations use `Product::storefrontPurchasable()`: `storefrontVisible()` plus positive compatibility available-stock quantity.
- Visibility requires active, already-published Product; no active compliance restriction; active non-vacation Shop; and active Seller account with the Seller role.
- Recently Viewed uses `storefrontVisible()`, not the stricter purchase scope; a still-visible out-of-stock Product may remain with its unavailable label.
- Card stock/price snapshots do not authorize checkout. Product Detail, Cart, and Checkout independently apply their current eligibility and monetary rules.
- `ProductSummaryResource` returns `id`, `slug`, `title`, `thumbnailUrl`, numeric `price/originalPrice`, nullable `minPrice/maxPrice`, and `discountPercent`.
- Other card fields are `averageRating`, `reviewCount`, `soldCount`, `stockStatus` (`in_stock|low_stock|out_of_stock`), public `shop: {id, slug, name}`, and `badges`; flash cards add `deal` progress.
- Card prices are numeric display amounts formatted as Philippine pesos (`PHP`), not decimal-string DTOs or client-authoritative totals; `currency` is not a returned field.
- Guest `viewer` has false `isAuthenticated`, null name/email/location, and zero Cart count; guest API `recentlyViewed` is empty.
- Active-Customer `viewer` exposes only that Customer's first name, email, and default shipping/both-address summary: `id`, `label`, `cityMunicipality`, `province`.
- Never serialize other users' contacts, registration evidence, private addresses, inventory internals, payment secrets, or raw storage paths into public cards.
- Product/category/campaign media use delivery URLs and fallbacks; Homepage does not upload images or expose storage keys.

### Selection, personalization, and pagination

- Flash Products require remaining deal stock and a deal price below regular price; order by deal sold quantity descending and show server-derived price/progress.
- Recommendations first query purchasable Products by promotion, sold count, review count, publication time descending, then Product UUID ascending.
- For an active Customer, category affinity uses up to 20 latest owned recency rows; matching categories are prioritized within the fetched page only.
- Page diversification alternates Shops where possible; it does not change membership or the database cursor order. This is not an AI or all-catalog ranking model.
- API recommendation page size defaults to 20, validates 8–50 under current configuration, and is hard-capped at 50.
- `nextCursor` is opaque; validate its encoded sort fields/types and maximum 2048-character length. Do not construct offsets or client-created cursors.
- Discovery appends by Product ID, prevents overlapping load-more calls, stops at null cursor or the client cap, and preserves loaded cards during next-page failure.
- Client defaults are 20 per request and 120 rendered Products; configured page size is 8–50 and configured cap is 8–500, never below page size.
- Cursor reads are not frozen catalogue snapshots; eligibility/ranking may change between reads. Deduplication must not imply exactly-once catalogue traversal.
- Recently Viewed owns bounded guest storage/resolution, login merge, removal, and retention; Homepage refreshes its rail after a successful merge.

### Advertisements and caching

- Published advertisement layouts are `single`, `carousel`, `multi_block`, or `multi_block_carousel`; parent start/end eligibility is rechecked on each aggregation read.
- Legacy campaigns require active, started, not-ended windows; sort by priority and start time descending, returning at most six hero and two side campaigns.
- The server returns deterministic default slots where configured; internal Admin tags, draft metadata, storage keys, and revisions are not public content.
- Destinations are sanitized relative paths or HTTP(S) URLs; current sanitization permits external hosts and is not an enforced host allow-list.
- Public ad-image delivery requires published, active, in-window content and returns `404` otherwise; its current image cache is `public, max-age=86400`.
- Homepage/recommendation HTTP responses are `public, max-age=60` only without an authenticated Sanctum identity.
- Any authenticated identity receives `private, no-store`, even if its role/status prevents personalization; both routes vary by `Accept, Authorization, Cookie`.
- Server Homepage fetches omit credentials and revalidate after 60 seconds; route ISR also uses 60 seconds. Shared HTML contains only public initial data.
- Laravel caches Categories, legacy campaigns, and the published ad configuration for configurable 300 seconds by default; Product/history queries are not stored in those public caches.
- Category/campaign model saves/deletes invalidate their caches; advertisement publication clears the layer cache. Time-window expiry is checked after cache retrieval.
- These are distinct cache layers, not instant global invalidation; already-rendered cards/artwork may remain stale until refresh or cache expiry.
- Browser discovery restoration uses bounded `sessionStorage` under `aisley:homepage-discovery:v3:{encoded owner}` with `guest` or `customer:{Customer UUID}` ownership, feed signature, limits, cursor, and scroll position; storage failure is non-blocking. The unscoped v2 cache and other accounts' caches are removed once identity is resolved or a known session is invalidated.
- Customer-private state must never enter shared cache or analytics. Logout, account switch, and authorization loss must discard obsolete private data and pending results.
- `HomeDataProvider` consumes the shared Auth identity and session revision, masks previous personalized data immediately during render, clears the old snapshot, and reloads only once identity is resolved. Public SSR content remains usable during session checks; no second Homepage-level `/me` request is introduced.
- Both Homepage refresh and discovery pagination use abortable, revision/sequence-checked reads. Stale successes, failures, and completion callbacks cannot update a new session or release its active request; overlapping refreshes apply only the latest response.
- Discovery resets its local feed on session-key changes and restores only after the current session's Homepage response establishes its base signature. Matching Product IDs/cursors alone never authorize another Customer's saved feed; null exhausted cursors remain null.
- Own-session navigation/reload may restore bounded Product cards and scroll, but logout/account switching clears old-account restoration. Never copy authenticated Recently Viewed history into guest storage. Browser reads use `cache: "no-store"`; Laravel still resolves identity/ownership and controls private responses.
- Same-origin cross-tab cleanup follows AuthProvider's existing `signed-out` and `session-changed` BroadcastChannel signals when supported; signals never contain Customer data or credentials.

### Experience and remaining integration gaps

- Follow `docs/design.md`: light-only, mobile-first, familiar discovery/search controls, semantic headings, labeled actions, visible focus, and contained horizontal rails.
- Discovery implements loading skeletons, valid empty/end/cap states, and visible refresh/load-more retry; guest history has separate storage/error/merge states.
- Server fetch has a 15-second deadline but currently collapses failure into empty public data. Browser Homepage reads lack a dedicated deadline and throttle-specific UI.
- Credentialed refresh updates context-driven sections; Categories, quick actions, Top products, and legacy hero props currently retain server-provided snapshots.
- Category cards use the shared Search URL builder with `type=products` and the encoded Category name as `q`; they never add the unsupported global `category` parameter. Keyword matching can also match Product or Shop names, so this is not an exact Category filter.
- Categories and Flash Deals omit “See all” links because dedicated `/categories` and `/flash-deals` listing pages do not exist. Keep the valid `/#categories` and `/#flash-deals` section anchors; do not substitute an unfiltered search labeled as a complete Category/deal listing.
- Dedicated `/vouchers` and `/products?sort=...` listing pages are also absent; their other configured shortcuts remain incomplete result flows and are outside the Category/Flash Deals navigation repair.
- Existing carousels rotate with arrows/indicators/swipe and no pause control; motion, focus, and shared-design accessibility require verification/reconciliation.
- Do not label an uncertain read as authoritative empty or silently retain another account's context; these shortcomings require scoped code work, not this documentation revision.

### Acceptance criteria

Checked items describe inspected implementation/source coverage, not a new runtime certification.

- [x] Public `/` and the two read APIs compose the documented sections without requiring sign-in or direct Next.js database access.
- [x] Server personalization requires an active `customer`; guest/non-Customer context does not contain Customer history or private viewer fields.
- [x] Purchase rails and recency apply their respective storefront scopes, including out-of-stock recency behavior.
- [x] Existing ranking, affinity, cursor validation, bounded pages, and Product-ID deduplication are documented without inventing new algorithms.
- [x] Safe card DTOs retain numeric prices; viewer fields belong to the authenticated Customer; Cart/Wishlist/history use their owning features.
- [x] Guest/public versus authenticated/private cache headers and credential-free initial rendering match the current implementation.
- [x] Category cards use approved Products keyword-search URLs; nonexistent Category/deal “See all” links are omitted while existing section anchors remain available.
- [ ] Other configured shortcut destinations resolve through approved, implemented result pages.
- [x] Account switch, logout, supported cross-tab invalidation, and delayed refresh/load-more responses cannot retain/restore another Customer's personalized Homepage state.
- [ ] Initial failure, stale content, offline/timeout, and repeated throttling are distinct from valid empty results and preserve usable navigation/retry.
- [ ] Expired/unpublished ads and changed Product visibility are tested across Laravel, HTTP, ISR, restored browser state, and rendered sections.
- [ ] Homepage-specific responsive, keyboard/carousel motion, focus, SEO/hydration, build, and live browser checks are recorded separately.

## HOW

### Implemented interfaces and components

| Method/path | Request and successful response |
| --- | --- |
| `GET /api/v1/customer/home` | Optional `limit`; returns `{viewer, advertisementLayer, campaigns, quickActions, categories, flashDeals, topProducts, recentlyViewed, recommendations}`. |
| `GET /api/v1/customer/home/recommendations` | Optional `limit` and `cursor`; returns `{recommendations: {items, nextCursor, pageSize}}`. |

- Both return `200` including valid empty/null sections; declared invalid fields/cursor return `422`, shared `throttle:120,1` returns `429`; outages are not success.
- GET retries are read-only fresh/cached projections, not mutation replays; no request body, owner field, or Idempotency-Key is required.
- `HomepageController`, Homepage Requests, and `HomepageService` own aggregation; Customer Resources serialize cards, campaigns, and Categories.
- `src/webapp/src/app/page.tsx` owns section composition, public metadata/canonical/Open Graph/Twitter, and Organization/WebSite/SearchAction JSON-LD.
- `lib/marketplace/server.ts` supplies public SSR data; `client.ts` uses the established credentialed Sanctum session client; `types.ts/config.ts` define DTOs/bounds.
- `HomeDataProvider` performs session-scoped browser refresh; `homepage-session.ts` owns request-revision guards, `discovery-storage.ts` owns bounded account-keyed restoration, and `use-discovery-feed.ts` owns paging/restoration state. Marketplace components retain rendering; existing global providers own account interactions.
- `GET /api/v1/homepage-advertisement-images/{campaign}/{variant}` serves published artwork; `variant` is `desktop|mobile`. Admin Content Customization owns its lifecycle.
- Existing browser analytics emit view/search/category/shortcut/Product/campaign events; they do not implement backend recency or persistent analytics. Exclude viewer PII/history.

### Verification and handoff

- Evidence: `CustomerHomepageTest`, `CustomerRecentlyViewedTest`, `HomepageAdvertisementTest`, current controllers/services/Resources, and Homepage components.
- Existing Homepage tests cover guest eligibility/deals, active-Customer context/affinity, non-Customer/inactive fallback, cursor bounds, and malformed cursors.
- Historical progress records API/build checks; the navigation repair below verifies only its scoped storefront changes. Source inspection does not close unchecked integration gates.
- Future scoped fixes must run focused SQLite/PostgreSQL regressions, auth/cache isolation, campaign timing, visibility changes, cursor traversal, and query-count checks.
- Verify 390/768/1280px layouts, keyboard/motion/focus, network failures, session races, guest-storage failure, and SSR metadata/hydration alongside type/lint/build checks.
- Canonical context: `docs/requirements.md`, `docs/workspace.md`, `docs/schema.md`, `docs/domains/Buyer.md`, architecture/design, and the owning Customer/Admin specs.

### Navigation repair verification (2026-10-03)

- Category cards reuse `searchHref(name, "products")`; URL regression coverage includes spaces, punctuation, accented names, and rejection of the former unsupported `category` key. All four Discovery URL tests and eleven auth-session tests pass.
- Customer TypeScript, changed-component ESLint, and the Next.js Webpack production build pass; no API, migration, dependency, or new listing route was needed.
- Local Chromium against mock HTTP data verifies the rendered Category URL, keyboard activation into Products results, absence of both dead “See all” links, preserved section anchors/back navigation, 390/768/1280px containment, and light-only styling. The fixture uses explicit credentialed-CORS headers and fresh responses rather than relying on stale test data.
- This was scoped navigation verification, not live production or full Homepage certification; it did not certify session races. See the subsequent session checks below. Other shortcuts, carousel accessibility, read failures, and cache-expiry gates remain as listed above.

### Session-isolation verification (2026-10-03)

- Nine Homepage session/storage tests plus eleven auth-session and four Discovery URL regressions pass. Guards cover old-session responses before effect cleanup, A → B → A, overlapping reads, cancellation/Strict Mode restart, null exhausted cursors, wrong-owner/corrupt/bounded storage, legacy-cache removal, and blocked storage.
- Customer TypeScript, changed-source ESLint, and the Next.js Webpack production build pass. Public server rendering and the existing visual layout remain unchanged.
- Local Chromium with an isolated mock API and a real second tab verifies keyboard logout, account switching, supported BroadcastChannel logout, immediate old-history/feed removal, delayed Homepage/page completion, same-base-signature account separation, reload/restoration, loading/page failure/retry, blocked storage, 390/768/1280px containment, light-only styling, and search focus. This is not live authenticated production certification.
- SQLite `CustomerHomepageTest` passes (5 tests/99 assertions). The combined Homepage/Recently Viewed regression has 9 passing and 2 failing tests (159 assertions): two unchanged Recently Viewed tests create Products using today's publication date before moving their clock back to September 3, causing correct visibility `404`s. Both pass individually when the clock is set before fixture creation (9 and 23 assertions); no backend/test fix was included in this frontend task.
- No API contract, migration, seed, dependency, or application database changed; PostgreSQL was not rerun for this frontend-only change. Remaining Homepage integration gates stay unchecked.
