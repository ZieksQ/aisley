---
feature: wishlist
title: Customer / Buyer Wishlist / Favorites
system: AISLEY
type: Feature Specification
version: 1.0
status: Draft
role: Buyer
scope: Customer / Buyer Web Application
---

# Customer / Buyer Wishlist / Favorites
## WHAT
- **Purpose:** Let authenticated Buyers persistently save Products they are interested in for future purchase and optionally receive alerts when saved Products are restocked or reduced in price.
- **Canonical role:** `BUYER`.
- **Source-defined capabilities:**
  - save/bookmark Products for later
  - maintain a persistent curated list
  - monitor saved Products for restocks
  - monitor saved Products for price drops
- **Source-defined data model:** many-to-many relationship between `Buyer` and `Products`, e.g. a `Wishlists` pivot/table. fileciteturn52file0
- **Source-defined async behavior:** background workers should dispatch notifications when linked Product price or inventory state changes. fileciteturn52file0
- **Recommended flow:**
```text
Buyer opens Product/Search/Shop/Homepage
→ Save to Wishlist
→ Laravel validates Buyer + Product
→ create Buyer↔Product relation

Buyer opens /wishlist
→ Laravel loads saved relations
→ re-resolves current buyer-visible Products
→ render current price / availability

Product price or stock changes
→ committed Product/Inventory event
→ queued Wishlist alert evaluation
→ find affected wishlisting Buyers
→ recheck membership + eligibility/preferences
→ send deduplicated notification
```
- **Architecture:**
  - Next.js/React owns wishlist buttons, saved state display, wishlist page, loading/empty/error states, and Cart handoff.
  - Laravel owns authentication, Buyer ownership, Product eligibility, wishlist persistence, current Product projection, alert detection, deduplication, preferences, jobs, and notifications.
  - Product/Inventory records remain authoritative for current price and stock.
- **Recommended routes:**
```text
/wishlist
/products/{product}
```
- **Feature boundaries:**
  - Search/Homepage/Browse Shop/Product Detail may expose Save/Unsave controls.
  - Wishlist owns persistent saved Product relationships.
  - Recently Viewed is passive history; Wishlist is explicit Buyer intent.
  - Cart owns quantity/variant purchase intent and stock validation.
  - Notifications own notification delivery/read state.
  - Seller Inventory/Promotions own Product stock/price changes.
- **Non-goals:**
  - Cart replacement
  - stock reservation
  - preserving historical price as a purchase guarantee
  - automatic purchase
  - recommendation engine
  - arbitrary Buyer-created public lists
  - social/shared wishlists unless separately required
  - forcing guest wishlist support
  - inventing alert channels or thresholds not defined by source
## MUST
### Authentication and ownership
- Persistent Wishlist requires authenticated `BUYER`.
- Laravel derives Buyer ID from authentication.
- Never trust client-submitted:
  - `buyer_id`
  - saved-owner identity
  - price
  - stock
  - notification recipient
- Buyer can read/mutate only their own Wishlist.
- Use:
  - `401` unauthenticated
  - `403` forbidden where appropriate
  - `404` Product/Wishlist relation unavailable
  - `422` invalid input
  - `409` conflicting/stale operation where applicable
### Guest wishlist
- `Buyer.md` defines Wishlist as a Buyer↔Product persistent relationship and does not specify guest storage.
- Therefore guest Wishlist is **not mandatory**.
- External UX research indicates shoppers commonly use Save/Wishlist features and guest saving can reduce account-creation friction. citeturn742965search2turn742965search3
- Guest-local Wishlist may be added later, but must be clearly marked as an external recommendation rather than source-backed AISLEY scope.
- Exact guest behavior is an Open Question.
### Data relationship
- Source requires many-to-many Buyer ↔ Product. fileciteturn52file0
- Recommended conceptual relationship:
```text
Buyer
└── belongsToMany Products through wishlists

Product
└── belongsToMany Buyers through wishlists
```
- Pivot/table must uniquely identify:
```text
(buyer_id, product_id)
```
- A Product cannot appear twice in one Buyer's Wishlist.
- Use server-generated IDs/timestamps according to repository conventions.
### Recommended wishlist table
```text
wishlists
- id optional
- buyer_id
- product_id
- created_at
- updated_at optional
```
- Optional alert metadata may be stored on the relation or in a dedicated alert state table.
- Do not persist full Product title/image/current stock as authoritative Wishlist data.
- Current Product details are loaded from Product/catalog records.
### Save Product
- Conceptual endpoint:
```http
PUT /api/buyer/wishlist/{product}
```
- Laravel must:
  1. authenticate Buyer
  2. resolve Product
  3. validate save eligibility
  4. create Buyer↔Product relation if absent
  5. return stable saved state
- Saving an already-saved Product must be idempotent.
- Laravel's many-to-many relations support attach/sync operations such as `syncWithoutDetaching`. citeturn361565search2
- Prefer a database unique constraint in addition to application checks.
### Remove Product
- Conceptual endpoint:
```http
DELETE /api/buyer/wishlist/{product}
```
- Remove only the authenticated Buyer's relation.
- Removing from Wishlist must not:
  - delete Product
  - remove Product from Cart
  - affect another Buyer's Wishlist
  - alter Recently Viewed
  - cancel pending Orders
- Repeated remove should return a stable result and must not error unpredictably.
### Product eligibility when saving
- Source says Buyers save Products they are interested in.
- Recommended: allow saving only Products that are currently buyer-visible.
- Reuse the same canonical Product visibility rules as Search/Homepage/Browse Shop:
  - published/active
  - not compliance-removed
  - Seller not suspended
  - Seller availability rules applied
- Exact Vacation Mode behavior is Open:
  - because Wishlist's value includes future restock/availability monitoring, retaining already-saved unavailable items is useful
  - but adding a newly hidden Product should not bypass normal Product visibility
- Laravel is authoritative.
### Wishlist display
- `/wishlist` returns a bounded/paginated list of the Buyer's saved Products.
- For each relation, resolve the **current** Product state.
- Recommended Product card fields:
  - Product ID
  - title/name
  - primary image
  - current fixed-precision price
  - currency
  - current availability
  - Seller/shop public summary
  - rating summary when authoritative
  - saved timestamp
- Do not expose:
  - Seller private data
  - internal inventory counts unless explicitly public
  - compliance/admin notes
### Product visibility after saving
- A Product may become unavailable after it is wishlisted.
- Wishlist relationship and display policy are separate.
- Recommended behavior:
  - do not expose hidden Product details through public/storefront endpoints
  - on authenticated Wishlist, either omit the item or return a minimal unavailable placeholder
- Exact placeholder-vs-omit UX is Open.
- Never allow Add to Cart/Buy for a Product that currently fails buyer-visible/checkout validation.
- Historical relation may remain so restock/reactivation behavior can be supported, subject to retention policy.
### Current price
- Wishlist displays current authoritative Product price.
- Saved price is not a purchase guarantee.
- Use fixed-precision money.
- Cart/Checkout revalidate price again.
- If alert logic needs a baseline price, store only the minimum metadata necessary for alert detection/deduplication.
### Current stock
- Wishlist may show a current availability summary.
- Wishlist does not reserve stock.
- Add to Cart must revalidate Product/variant/stock.
- A Wishlist restock alert does not guarantee inventory will remain available.
### Add to Cart handoff
- Wishlist may expose `Add to Cart`.
- Cart owns the mutation.
- If Product requires a variant choice:
  - route Buyer to Product Detail/configuration, or
  - present a valid variant selector if Cart contract supports it
- Do not silently select a required variant.
- Before Cart accepts, revalidate:
  - Product visibility
  - Seller availability
  - variant
  - quantity
  - current stock
  - current price
### Remove after Add to Cart
- Source does not define whether adding to Cart removes the Product from Wishlist.
- Do not remove automatically unless product policy defines it.
- Recommended default: keep Wishlist membership until Buyer explicitly removes it.
- Exact behavior is Open.
### Pagination
- Wishlist list must follow shared pagination rules when collection size can grow.
- Enforce maximum page size.
- Recommended default order:
  - newest saved first
- Other sorting is optional.
- Do not implement arbitrary sort columns from client input.
- Exact Wishlist maximum size is not source-defined.
### Restock alerts
- Source explicitly requires monitoring for inventory restocks. fileciteturn52file0
- Recommended meaningful restock condition:
```text
previously unavailable/out of stock
→ now buyer-purchasable/in stock
```
- Exact threshold/variant semantics are Open.
- Do not notify merely because stock changed from 5 to 6 unless product requirements define any replenishment as an alert.
- Variant-specific restock alerts are not source-defined.
- If Wishlist saves only Product, alert logic must define whether any purchasable variant constitutes restock.
### Price-drop alerts
- Source explicitly requires monitoring price updates/reductions. fileciteturn52file0
- A price-drop alert should be triggered only when the authoritative effective Product price decreases according to the selected pricing rule.
- Exact comparison is Open:
  - base price decrease
  - effective promotional price decrease
  - variant price decrease
- Do not alert on a price increase.
- Do not infer "price drop" from client-side cached values.
### Event source
- Alert evaluation should begin from authoritative committed Product/Inventory mutations.
- Recommended events:
```text
ProductPriceChanged
ProductRestocked
```
or repository-equivalent.
- Events should carry Product ID and safe previous/current state required for evaluation.
- Do not run expensive all-Wishlist scans on every page request.
### Background jobs
- Source explicitly expects background workers. fileciteturn52file0
- Recommended:
```text
Product/Inventory change commits
→ dispatch EvaluateWishlistAlerts(productId, eventId)
→ queue worker loads affected Wishlist relations
→ batch/chunk recipients
→ recheck conditions
→ send notifications
```
- Keep request-time Seller inventory/price updates fast.
- Laravel supports queued jobs and unique-job locking where deduplication is needed. citeturn742965search0
### After-commit dispatch
- Wishlist alert jobs/notifications must not process Product state that later rolls back.
- Dispatch after the Product/Inventory transaction commits.
- Laravel queue `after_commit` / `afterCommit()` supports this behavior. citeturn361565search0turn361565search1
- A failed notification must not roll back the Product price/stock mutation.
### Recheck before notification
- Queued work may run seconds/minutes after the triggering mutation.
- Before sending, recheck:
  - Buyer still has Product wishlisted
  - Product still exists
  - Product is in the required price/restock state
  - Product/Seller is buyer-visible/eligible
  - Buyer notification preferences permit the channel/event
- This prevents stale alerts after:
  - Buyer removes Product
  - Seller disables Product
  - stock immediately sells out
  - price changes again
### Alert deduplication
- Retries/repeated stock/price events must not spam duplicate logical alerts.
- Use stable event IDs/deduplication records or equivalent.
- Conceptual dedupe key:
```text
buyer_id + product_id + alert_type + triggering_event_id
```
- Exact schema is Open.
- Laravel's queue system supports unique jobs via cache locks, but recipient-level logical deduplication may still be required. citeturn742965search0
### Alert frequency
- Source does not define cooldowns or repeat-alert frequency.
- Do not send repeated alerts continuously while Product remains in the same state.
- Recommended:
  - one alert per meaningful transition/event
  - allow another alert after a later new qualifying transition
- Exact cooldown/coalescing policy is Open.
### Notification channels
- Source requires alerts but does not specify channel.
- Use AISLEY notification infrastructure/preferences.
- Possible configured channels may include:
  - in-app/database
  - push
  - email
- Do not require SMS/email/push specifically from Wishlist.
- Laravel Notifications can queue delivery and choose channels per notifiable user. citeturn361565search0
### Notification payload
- Keep payload safe and minimal:
  - Product ID
  - Product name/summary
  - alert type (`RESTOCK`, `PRICE_DROP`)
  - safe current price/availability summary
  - destination URL
- Never include private Seller information or Buyer secrets.
- Notification destination must revalidate Product visibility when opened.
### Notification preferences
- Buyer Account Management owns global notification preferences.
- Wishlist alerts should respect the configured preference model.
- Exact per-Wishlist/per-Product opt-in controls are not source-defined.
- Do not invent separate alert toggles unless required.
### Seller/compliance changes
- Wishlist does not bypass Seller Vacation Mode, suspension, or Admin compliance.
- If Seller/Product is hidden:
  - Product cannot be purchased through Wishlist
  - alerts should not encourage Buyer to visit an unavailable Product
- When Product later becomes buyer-visible again, whether that counts as a "restock" alert is Open unless inventory also qualifies.
### Concurrency
- Simultaneous Save requests must not create duplicate pivot rows.
- Use unique `(buyer_id, product_id)` and idempotent attach/upsert.
- Save vs Remove races resolve according to the final committed relation.
- Alert job checks current membership at execution time.
### Privacy
- Wishlist represents Buyer purchase intent.
- Do not expose a Buyer's Wishlist to:
  - other Buyers
  - Sellers
  - Couriers
  - Logistics
unless a future explicitly authorized feature requires it.
- Sellers should not receive a list of which named Buyers wishlisted their Products from this feature.
- Aggregate anonymous Seller analytics are not source-defined.
- Do not place Buyer-specific Wishlist state in shared public caches.
### Frontend states
- Wishlist page: loading, empty, loaded, unavailable item, pagination, error.
- Wishlist toggle: unsaved, saving, saved, removing, failure.
- Cart handoff: variant required, unavailable, out of stock, success/failure.
- Optimistic toggle is optional; reconcile to Laravel and revert visibly on failure.
- Do not display stale saved state after server rejection.
### Accessibility
- Save/Remove control must have accessible text such as `Add to Wishlist` / `Remove from Wishlist`.
- Heart/icon state cannot rely on color alone.
- State changes should be announced without stealing focus.
- Wishlist Product cards and pagination follow shared accessible Product-list conventions.
### Acceptance criteria
- [ ] Persistent Wishlist requires authenticated Buyer unless guest support is explicitly added.
- [ ] Buyer can save a buyer-visible Product.
- [ ] Buyer cannot create duplicate logical Wishlist entries.
- [ ] Buyer can remove only their own Wishlist relation.
- [ ] Buyer cannot read another Buyer's Wishlist.
- [ ] Wishlist uses many-to-many Buyer↔Product persistence.
- [ ] Wishlist cards load current Product price/availability.
- [ ] Hidden/unavailable Products cannot be purchased through Wishlist.
- [ ] Add to Cart delegates to Cart and revalidates Product/variant/stock/price.
- [ ] Wishlist does not reserve inventory.
- [ ] Restock/price-drop evaluation runs asynchronously from committed Product/Inventory changes.
- [ ] Alert jobs recheck Wishlist membership and current Product eligibility before send.
- [ ] Duplicate/retried events do not produce duplicate logical alerts.
- [ ] Alert channels respect shared Buyer notification preferences.
- [ ] Notification failure does not roll back Product/Inventory changes.
- [ ] One Buyer's Wishlist/intent is never exposed to another role without explicit authorization.
- [ ] UI handles empty, saving/removing failure, unavailable Product, and Cart-handoff states.
## HOW
### Project findings
- `Buyer.md` explicitly defines Wishlist/Favorites as persistent deferred-purchase intent, allowing Buyers to bookmark Products for later and monitor for restocks/price reductions. fileciteturn52file0
- It requires a many-to-many `Buyer`↔`Products` relationship and recommends background workers for Product price/stock notifications. fileciteturn52file0
- Seller Vacation Mode hides Products from Buyer discovery/checkout, so Wishlist cannot bypass Seller availability. fileciteturn52file5
- Shared AISLEY rules require user scoping, pagination, fixed-precision money, idempotent mutations, and after-commit notifications. fileciteturn52file18
- Sources do not define guest Wishlist, Wishlist size/retention, alert channels, alert cooldowns, variant-specific Wishlist behavior, price-drop baseline, or exact restock semantics.
### Laravel relationships
Recommended:
```text
Buyer::products()
  ->belongsToMany(Product::class, 'wishlists')
  ->withTimestamps()
```
and repository-equivalent inverse relation.
- Laravel's `BelongsToMany` API supports syncing/attaching without detaching existing relations. citeturn361565search2
- Add database uniqueness on `(buyer_id, product_id)` regardless of Eloquent helper choice.
### Laravel API
Conceptual:
```http
GET    /api/buyer/wishlist
PUT    /api/buyer/wishlist/{product}
DELETE /api/buyer/wishlist/{product}
```
Optional:
```http
GET /api/storefront/products/{product}/wishlist-state
```
only when authenticated enrichment needs a dedicated endpoint.
- Suggested actions:
  - `AddProductToWishlist`
  - `RemoveProductFromWishlist`
  - `GetBuyerWishlist`
  - `EvaluateWishlistPriceDrop`
  - `EvaluateWishlistRestock`
- Use Buyer-scoped queries, Product visibility service/scope, Form Requests where input exists, and API Resources.
### Alert processing
Recommended:
```text
Seller changes Product price / Inventory changes stock
→ domain mutation commits
→ emit ProductPriceChanged / ProductRestocked
→ queued listener/job
→ query Wishlist relations for product_id
→ process Buyers in chunks
→ recheck Product + membership + preference
→ create/send deduplicated notifications
```
- Queue recipient fan-out rather than blocking Seller mutation request.
- Laravel queued notifications are intended for channels involving external delivery and support `afterCommit()`. citeturn361565search0
### Next.js / React
Recommended:
```text
/wishlist
├── WishlistGrid
│   └── WishlistProductCard
└── Pagination

shared:
WishlistToggle
```
- Reuse `WishlistToggle` on Product Detail, Search, Homepage, and Browse Shop.
- For authenticated product cards, either:
  - include `is_wishlisted` in a Buyer-private enriched DTO, or
  - load Wishlist IDs/state separately
- Never put Buyer-specific `is_wishlisted` into a globally shared cached response.
### UX research recommendations
- External Baymard research identifies Save/Favorite/Wishlist as a meaningful product-finding tool used to retain items for later consideration. citeturn742965search2turn742965search3
- Baymard also recommends guest-compatible Save behavior to reduce forced-registration friction, but this is **not required by AISLEY source** and remains optional. citeturn742965search3
### Tests
- **Laravel:** Buyer isolation; add/remove/idempotency; duplicate race; Product visibility; unavailable Product display; pagination; Cart handoff; price-drop/restock event detection; after-commit dispatch; membership recheck; preference check; alert dedupe.
- **Frontend:** wishlist toggle; loading/empty/error; Product card state; unavailable Product; pagination; Add-to-Cart/variant handoff; optimistic failure rollback; accessibility.
### Risks
- **Privacy leak:** exposing named Wishlist owners reveals purchase intent to Sellers/others.
- **Stale availability:** Wishlist can show obsolete price/stock if Product is not re-resolved.
- **Alert spam:** repeated inventory/price updates can create duplicate notifications.
- **Race:** concurrent Save can create duplicate pivot rows without DB uniqueness.
- **Stale queued alert:** Buyer may remove Product or stock may sell out before notification runs.
- **Scope growth:** guest lists, multiple named lists, sharing, variant alerts, alert controls, and Seller analytics can significantly expand MVP.
### Open questions
- Authenticated-only Wishlist vs optional guest-local Wishlist.
- Maximum Wishlist size / retention policy.
- Hidden Product behavior: omit vs unavailable placeholder.
- Whether adding to Cart removes Wishlist membership.
- Whether Wishlist can target a specific Product variant or Product only.
- Exact restock condition (`0→>0`, any unavailable→available, variant-specific).
- Price-drop definition: base price vs effective promotional/variant price.
- Alert channel(s), preferences, cooldown, and repeat-event behavior.
- Whether Buyers can disable alerts while keeping a Product saved.
- Whether product reactivation after Vacation Mode can trigger an alert.
- Default ordering and optional sorting.
- Whether Sellers receive anonymous aggregate Wishlist analytics.
### Sources
- Project feature-spec rules: `SKILL.md`
- AISLEY architecture contract: `README.md`
- Buyer feature model: `Buyer.md`
- Seller feature model: `Seller.md`
- Laravel `BelongsToMany` API: https://api.laravel.com/docs/12.x/Illuminate/Database/Eloquent/Relations/BelongsToMany.html
- Laravel Notifications: https://laravel.com/docs/12.x/notifications
- Laravel Queues: https://laravel.com/docs/12.x/queues
- Baymard Save Features: https://baymard.com/guidelines/798-implementing-save-features
- Baymard Product Page UX: https://baymard.com/blog/current-state-ecommerce-product-page-ux
