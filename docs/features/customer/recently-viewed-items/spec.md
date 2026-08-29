---
feature: recently-viewed-items
title: Customer / Buyer Recently Viewed Items
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Buyer
scope: Customer / Buyer Web Application
---

# Customer / Buyer Recently Viewed Items
## WHAT
- **Purpose:** Automatically track products a visitor/Buyer opens and surface a recency-ordered history so products are easy to find again.
- **Canonical role:** `BUYER`.
- **Source-defined behavior:**
  - passive tracking of product-page visits
  - display a localized carousel/trail of recently visited products
  - support unregistered/guest sessions through browser storage
  - sync guest history to persistent Buyer history after authentication
  - support cross-device history for authenticated Buyers
- **Source-defined implementation options:** Redis or browser storage such as `localStorage`/cookies for fast/session-oriented access, with database synchronization after authentication. fileciteturn48file0
- **Recommended storage model:**
```text
GUEST
Product Detail visit
→ localStorage:
   [{ product_id, viewed_at }, ...]

LOGIN
→ submit bounded guest history
→ Laravel validates Products
→ merge/upsert into Buyer history
→ clear/reconcile guest copy

AUTHENTICATED BUYER
Product Detail visit
→ Laravel persists/updates Buyer + Product viewed_at
→ Recently Viewed API
→ cross-device history
```
- **Recommended display surfaces:**
  - Customer Homepage
  - Product Detail
  - optional dedicated Recently Viewed page if later needed
- **Architecture:**
  - Next.js/React owns guest browser storage, carousel/list rendering, login merge initiation, loading/error states, and optional local cache.
  - Laravel owns authenticated Buyer history, Product visibility checks, merge validation, deduplication, ordering, retention limits, and API Resources.
  - Database is authoritative for authenticated cross-device history.
  - Redis may cache hot history but should not be the only durable authenticated store if cross-device persistence is required.
- **Feature boundaries:**
  - Customer Auth supplies the authenticated Buyer identity and login transition.
  - Customer Homepage may render a Recently Viewed section.
  - Search/Browse Shop/Product Detail own Product discovery and Product visibility.
  - Wishlist is explicit Buyer intent; Recently Viewed is passive browsing history.
  - Cart is purchase intent and must not be inferred from Recently Viewed.
- **Non-goals:**
  - recommendation/personalization algorithms
  - ad targeting
  - Wishlist replacement
  - tracking category/search-result impressions
  - tracking products merely hovered or rendered
  - storing full Product objects in browser history
  - recording sensitive account/session credentials
  - making Redis mandatory
## MUST
### What counts as a view
- A Recently Viewed entry is created when a visitor opens a canonical Product Detail page.
- Merely seeing a Product card in:
  - Homepage
  - Search results
  - Browse Shop
  - Wishlist
does not count as a Product view.
- Reopening the same Product updates its recency rather than creating unlimited duplicate entries.
- Exact debounce/minimum-page-duration rules are not source-defined.
- MVP should record one view when the Product Detail load is successfully resolved as buyer-visible.
### Product identity
- Store immutable Product IDs/references.
- Do not use Product title/name as the history key.
- A history item represents Product recency, not a copied Product snapshot.
- Current Product card details are fetched from authoritative Product data when rendering.
- This ensures price, stock, Seller status, and visibility are current rather than frozen from the original view.
### Guest history
- Guest browsing history may use first-party `localStorage` as suggested by the Buyer source. fileciteturn48file0
- Store only minimal data:
```json
[
  {
    "productId": "product-id",
    "viewedAt": "ISO-8601 timestamp"
  }
]
```
- Do not store:
  - passwords
  - auth/session tokens
  - email
  - address
  - payment data
  - Seller private data
  - entire Product DTOs
- `localStorage` is origin-scoped and persists across browser sessions, but users/browser policy may clear or block it. citeturn632836search0turn632836search1
- Guest history is therefore best-effort, not guaranteed durable storage.
- Private/incognito browsing may clear local storage when the private session ends. citeturn632836search1
### Guest storage safety
- Access `localStorage` only in browser/client code and handle unavailable/quota/security failures gracefully.
- Product/Homepage browsing must continue if guest history cannot persist.
- Use `getItem` / `setItem` / `removeItem`; keep the list bounded. citeturn632836search3
- Exact guest-history limit is Open.
### Authenticated Buyer history
- Authenticated history must be scoped by the current `BUYER`.
- Laravel derives Buyer ID from authentication.
- Never trust a client-supplied `buyer_id`.
- Recommended logical uniqueness:
```text
unique(buyer_id, product_id)
```
- Viewing an already-recorded Product updates `viewed_at`.
- History returns newest `viewed_at` first.
- This supports one recency entry per Product instead of duplicate rows for every visit.
- Raw visit analytics/counts are outside this feature.
### Recommended persistence model
- Conceptual table:
```text
recently_viewed_products
- id
- buyer_id
- product_id
- viewed_at
- created_at
- updated_at
```
- Recommended unique index:
```text
(buyer_id, product_id)
```
- Recommended index for retrieval:
```text
(buyer_id, viewed_at)
```
- Exact table/column names follow repository conventions.
- A separate append-only page-view analytics table is not required for this feature.
### Record authenticated view
- Conceptual endpoint:
```http
PUT /api/buyer/recently-viewed/{product}
```
or repository-equivalent.
- Laravel must:
  1. authenticate `BUYER`
  2. resolve buyer-visible Product
  3. upsert Buyer + Product history
  4. set authoritative server `viewed_at`
  5. enforce configured history retention/cap
- Client cannot submit another Buyer identity.
- Repeated views should be idempotent regarding logical row identity.
- Laravel supports upsert/update-or-create patterns for records identified by unique columns. citeturn547766search0
### Server timestamp
- Authenticated `viewed_at` must be server-generated.
- Store timestamps in UTC.
- Do not trust a browser timestamp as the final authenticated history order.
- Guest timestamps may be submitted during login merge only as untrusted ordering hints and must be validated/bounded.
### Login synchronization
- Buyer source explicitly expects guest/session history to sync into the database on authentication for cross-device history. fileciteturn48file0
- Recommended login merge:
```text
guest local history
+ authenticated Buyer history
→ Laravel validates guest entries
→ deduplicate by Product ID
→ merge recency
→ retain newest configured N
→ return canonical Buyer history
→ frontend clears/replaces guest history
```
- Do not blindly insert browser-provided IDs/timestamps.
- Laravel must:
  - cap number of submitted entries
  - validate Product IDs
  - reject malformed timestamps
  - ignore Products that no longer exist
  - exclude Products the Buyer is not allowed to view
  - deduplicate Product IDs
- Exact timestamp-conflict policy is Open.
- Recommended: use the later credible view timestamp, bounded so a client cannot place entries arbitrarily far in the future.
### Merge endpoint
- Conceptual:
```http
POST /api/buyer/recently-viewed/merge
```
- Payload contains only bounded Product IDs and guest timestamps.
- Buyer identity comes from the authenticated session.
- Merge must be safe to retry.
- Repeated merge of the same guest list must not create duplicate logical rows.
- Return the canonical merged history or a success response followed by refetch.
### Cross-device behavior
- Authenticated database history is shared across devices using the same Buyer account.
- Device A viewing Product X must eventually make Product X available in Device B's Recently Viewed list after normal API refresh.
- No real-time WebSocket sync is required by the source.
- Normal refetch/page load is sufficient for MVP.
- Browser localStorage alone cannot provide cross-device behavior.
### Logout behavior
- Logout must not erase server-side Buyer history.
- Do not copy the full authenticated history into guest storage; post-logout local behavior is Open.
### Product visibility
- Recently Viewed display must use the same buyer-visible Product rules as Homepage/Search/Browse Shop.
- If a previously viewed Product becomes:
  - unpublished/inactive
  - compliance-removed
  - unavailable because Seller is suspended
  - hidden by Seller Vacation Mode
  - deleted
then it must not remain normally visible/clickable in the Buyer-facing Recently Viewed list.
- The history record may be retained internally according to retention policy, but display queries must filter unavailable Products.
- Do not leak hidden Product information through stale local/browser data.
### Guest Product revalidation
- Guest localStorage may contain stale Product IDs.
- Before displaying full Product cards:
  - resolve Product IDs through the public Laravel Product/Recently Viewed lookup
  - return only buyer-visible Products
- Do not trust a Product title/price/image cached in localStorage.
- If Product no longer resolves, silently remove/omit it or update guest storage during reconciliation.
### Ordering
- Default order is most recently viewed first.
- Revisiting Product X moves it to the front.
- Ties use a stable server-defined secondary ordering.
- No popularity/recommendation ranking is applied.
- Recently Viewed is recency history, not a recommendation score.
### History limit / retention
- The source does not define:
  - maximum item count
  - time retention period
- Both are Open Questions.
- Use a bounded list for guest and authenticated histories.
- Retention may be:
  - maximum N distinct Products
  - age-based expiry
  - both
- Do not implement unlimited growth by default.
- Cleanup may occur:
  - during write/merge
  - through scheduled maintenance
  - through database pruning
- Exact policy must be configured/documented.
### Redis
- `Buyer.md` lists Redis as a possible fast-access implementation. fileciteturn48file0
- Redis is optional.
- Laravel supports Redis as a cache backend. citeturn632836search4
- Recommended role if used:
```text
database = authenticated history source of truth
Redis = optional cached recent list
```
- Do not rely solely on ordinary cache entries for authenticated cross-device durability because cache entries may expire/evict.
- If Redis is intentionally configured as the persistent history store, persistence/backup/retention requirements must be explicitly defined first.
### Recently Viewed API
- Recommended authenticated endpoint:
```http
GET /api/buyer/recently-viewed
```
- Optional public resolver for guest IDs:
```http
POST /api/storefront/products/resolve
```
or reuse an existing bulk Product-summary endpoint.
- Return lightweight Product summary DTOs rather than raw history rows alone when useful for rendering.
- Collection is bounded; pagination is optional if the configured history size is deliberately small.
- If a dedicated full-history page allows a large list, follow project pagination rules. fileciteturn48file1
### Product summary DTO
- Reuse the same safe Product summary representation used by discovery features where possible.
- Recommended fields:
  - Product ID
  - title/name
  - primary image
  - fixed-precision price
  - currency
  - Seller/shop summary when needed
  - rating summary when authoritative
  - availability summary
  - viewed-at timestamp
- Do not expose:
  - private Seller fields
  - internal inventory details
  - compliance notes
  - Buyer identity to public/guest endpoints
### Homepage integration
- Customer Homepage may render a Recently Viewed carousel/section.
- Homepage must consume this feature's history rather than implement separate tracking.
- If no history exists:
  - omit the section, or
  - render the agreed empty state
- Exact Homepage placement/number of cards remains a UI decision.
- Homepage public/shared cache must not contain authenticated Buyer-specific history.
### Product Detail integration
- Product Detail triggers the view-record action after the Product is successfully resolved as buyer-visible.
- Avoid multiple duplicate writes from:
  - React re-renders
  - Strict Mode development behavior
  - repeated component mounting
- Client may debounce/deduplicate a same-page record attempt, but backend upsert remains authoritative.
- Navigating among product variants of the same Product does not create separate Recently Viewed Product rows unless the domain explicitly models variants as separate browseable Products.
### Wishlist / Cart integration
- Recently Viewed Product cards may expose existing Wishlist/Add-to-Cart actions.
- Their mutations remain owned by Wishlist/Cart.
- Recently Viewed history does not:
  - reserve stock
  - preserve historical price
  - guarantee Product availability
- Wishlist/Cart endpoints must revalidate Product visibility, variant, price, and stock.
### Clear/remove history
- Source does not explicitly require:
  - remove one item
  - clear all history
  - disable tracking
- Do not make these mandatory MVP controls.
- They are reasonable privacy/usability extensions and remain Open Questions.
- If implemented:
  - authenticated deletion is scoped to current Buyer
  - guest deletion modifies only the local history
  - clearing history does not delete Product/Order/Wishlist records
### Privacy
- Recently Viewed is behavioral browsing history; store only Product IDs/recency needed by this feature.
- Do not include search text, referrers, payment/account secrets, location, or unrelated analytics identifiers.
- Never expose one Buyer's history to another Buyer, Seller, Courier, or Logistics.
- Future Admin/analytics access and privacy-policy disclosure require separate decisions.
### Multiple tabs
- Same-origin tabs share `localStorage`; the browser `storage` event can support optional cross-tab sync. citeturn632836search1turn632836search8
- Authenticated server history remains canonical.
### Error behavior
- Tracking failure must never block Product Detail or checkout.
- Guest failure may skip history; authenticated failure may retry through shared API-client policy.
- Do not show false persisted state when a write failed.
### Frontend states
- Section: loading, empty, loaded, stale IDs filtered, error.
- Guest storage: available or unavailable/blocked.
- Login merge: pending, success, failed/retryable.
- Failure must not prevent normal shopping.
### Accessibility
- Use a semantic section heading and shared accessible Product-card conventions.
- Carousel controls must be keyboard accessible and must not steal focus.
- Any viewed-time/status text cannot rely on color alone.
### Acceptance criteria
- [ ] Product Detail records a view; card render/hover does not.
- [ ] Revisiting updates recency without duplicate logical entries.
- [ ] Guest history stores only minimal Product ID/timestamp data and shopping still works if storage is unavailable.
- [ ] Authenticated history is Buyer-scoped, cross-device, and cannot accept spoofed `buyer_id`.
- [ ] Login merge validates/deduplicates IDs and is safe to retry.
- [ ] Hidden/deleted/unavailable Products are revalidated and omitted from display.
- [ ] Current Product price/stock comes from authoritative Product data.
- [ ] Homepage reuses this history; Redis remains optional.
- [ ] History is bounded and tracking failures never block Product Detail/checkout.
- [ ] Buyer histories never leak across users; UI handles empty/storage/merge/API-error states.
## HOW
### Project findings
- `Buyer.md` explicitly defines Recently Viewed Items as automatically tracking Product pages a Buyer clicks so they can easily back-track to previously viewed items. fileciteturn48file0
- It describes a localized carousel/trail and explicitly suggests Redis or local browser storage for unregistered sessions, followed by database synchronization after authentication for cross-device history. fileciteturn48file0
- AISLEY architecture assigns browser-state behavior to React/Next.js while Laravel remains authoritative for authenticated Buyer-owned data and Product visibility. fileciteturn48file1
- The source does not define history count/retention, clear/remove controls, exact database schema, guest merge conflict rules, or whether Redis is actually installed/configured.
### Recommended data model
```text
recently_viewed_products
- id
- buyer_id
- product_id
- viewed_at
- created_at
- updated_at

UNIQUE (buyer_id, product_id)
INDEX  (buyer_id, viewed_at)
```
- `Buyer hasMany RecentlyViewedProduct`.
- `RecentlyViewedProduct belongsTo Product`.
- A direct many-to-many Product relation with a `viewed_at` pivot is also viable if repository conventions favor it.
- Do not add a row per page refresh unless analytics/event history is separately required.
### Laravel actions
Recommended:
```text
RecordRecentlyViewedProduct
MergeGuestRecentlyViewed
GetBuyerRecentlyViewed
```
- `RecordRecentlyViewedProduct` performs an upsert/update of recency.
- `MergeGuestRecentlyViewed` validates a bounded guest list and bulk-upserts where practical.
- Laravel/Eloquent supports atomic upsert behavior using unique identifiers. citeturn547766search0
- After write/merge, prune records beyond the configured retention limit.
### Laravel API
Conceptual:
```http
GET  /api/buyer/recently-viewed
PUT  /api/buyer/recently-viewed/{product}
POST /api/buyer/recently-viewed/merge
```
Optional:
```http
DELETE /api/buyer/recently-viewed/{product}
DELETE /api/buyer/recently-viewed
```
only if remove/clear behavior is approved.
- Use Buyer-scoped queries and safe Product Resources.
- The record endpoint may return `204` because the caller normally already has Product Detail.
### Guest utility
Recommended client utility:
```text
recentlyViewedStorage
- get()
- record(productId)
- remove(productId) optional
- clear() optional
- replace(canonicalIds)
```
- Keep only product IDs + local timestamps.
- Deduplicate and cap synchronously in the utility.
- Guard every Web Storage operation because storage access can fail.
- MDN documents `localStorage` as persistent across browser sessions and synchronous. citeturn632836search0turn632836search1
### Login merge
Recommended:
```text
Customer Auth succeeds
→ read guest recently-viewed list
→ POST bounded merge payload
→ Laravel validates visible Products
→ upsert Buyer history
→ prune
→ return/fetch canonical history
→ clear or reconcile local guest key
```
- Merge failure must not fail authentication.
- Retry may occur later.
- Do not place this merge inside the critical authentication transaction.
### Redis / cache
- Inspect infrastructure before adding Redis.
- If already configured, cache a Buyer's newest Product IDs with a short/documented TTL if read volume warrants it.
- Laravel's cache abstraction supports Redis and other drivers. citeturn632836search4
- Invalidate/update cache after database history writes.
- For a school-project-sized workload, database + browser storage is likely sufficient until profiling proves Redis beneficial.
### Next.js / React
- Product Detail uses a small Client Component/effect to record the view because guest `localStorage` is browser-only.
- For authenticated Buyer:
  - call Laravel record endpoint
  - optionally also keep a local UI cache, but server remains canonical
- Homepage Recently Viewed can:
  - render guest items after client hydration, or
  - render authenticated history from Laravel
- Avoid hydration mismatch by not reading `localStorage` during server rendering.
- Browser Web Storage belongs in Client Components/browser utilities.
### Product resolution
- For guest history, send the bounded Product ID list to a Laravel/public Product summary endpoint.
- Preserve requested recency order after filtering unavailable IDs.
- For authenticated history, query:
```text
current Buyer history
→ newest first
→ join/load buyer-visible Products
→ safe ProductSummaryResource
```
- Avoid N+1 Product/Seller/image queries.
### Tests
- **Laravel:** ownership; record/upsert; recency; merge validation/deduplication; isolation; hidden Product filtering; retention; safe DTO; repeated-merge idempotency.
- **Frontend:** Product view; recency move; guest/blocked storage; stale Product filtering; merge success/failure; authenticated fetch; Homepage rendering; accessibility.
### Research-backed recommendations
- Use `localStorage` only for small non-sensitive guest history; it is origin-scoped, persistent across normal browser sessions, synchronous, and may be cleared/blocked. citeturn632836search0turn632836search1
- Use a database-backed Buyer/Product recency row for authenticated cross-device persistence and upsert it on repeat views. citeturn547766search0
- Treat Redis as optional cache infrastructure rather than automatically adding it merely because the source lists it as an example. citeturn632836search4
- Revalidate Product IDs server-side before rendering merged/stale history.
### Risks
- **Privacy:** browsing history reveals user interests if exposed across accounts.
- **Stale products:** browser/database history may reference removed or unavailable listings.
- **Duplicate growth:** one row per refresh can grow indefinitely without deduplication.
- **Storage assumptions:** localStorage may be unavailable, cleared, or blocked.
- **Cross-user cache leak:** shared caching of personalized history can expose another Buyer.
- **Merge abuse:** trusting arbitrary browser Product IDs/timestamps can corrupt authenticated history.
- **Overengineering:** Redis/real-time synchronization is unnecessary for a small bounded history unless load demands it.
### Open questions
- Maximum count and age retention.
- Remove-one / clear-all / disable-tracking controls.
- Guest storage key/version and login-merge conflict rule.
- Whether authenticated history is mirrored locally.
- Whether Redis is configured/needed.
- Dedicated page vs carousel-only display and card count.
- Hidden-record retention and privacy-policy requirements.
### Sources
- Project feature-spec rules: `SKILL.md`
- AISLEY architecture contract: `README.md`
- Buyer feature model: `Buyer.md`
- MDN `localStorage`: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
- MDN Web Storage API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API
- MDN Using the Web Storage API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
- Laravel Cache: https://laravel.com/docs/12.x/cache
- Laravel Eloquent upsert: https://laravel.com/docs/11.x/eloquent#upserts
