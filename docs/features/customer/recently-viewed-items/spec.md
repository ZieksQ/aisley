---
feature: recently-viewed-items
title: Customer Recently Viewed Items
system: AISLEY
type: Feature Specification
version: 2.0
status: Ready for implementation
role: Customer
scope: Customer web application and Laravel API
---

# Customer Recently Viewed Items

## WHAT

- Passively record a Product only after a Customer or guest successfully opens its canonical Product Detail page, then show it in most-recent-first order.
- Support a small best-effort guest history in first-party browser storage and durable, cross-device history for an authenticated active Customer.
- Complete the existing foundation instead of introducing a new history model: `recently_viewed_products` already has UUID `id`, `user_id`, `product_id`, `last_viewed_at`, unique (`user_id`, `product_id`), and the index used for recency reads.
- The homepage already consumes authenticated history through `HomepageService` and displays up to the configured `homepage.recently_viewed_limit` (currently 12); it must remain a presentation consumer, not its own tracker.

- Recently Viewed is passive behavioural history, not Wishlist intent, Cart state, an inventory reservation, a recommendation score, analytics/pageview logging, or Seller/Admin-visible data.
- Product Detail owns the moment of a valid visit. Search, Homepage, Browse Shop, and Product Card impressions must not create a view.
- Product visibility stays owned by the canonical `Product::storefrontVisible()` scope. Current Product data comes from `ProductSummaryResource`, not a historical Product snapshot.
- The MVP includes the homepage rail and protected `/account/recently-viewed` history page. It does not add recommendations, marketing messages, Seller analytics, Redis, or real-time cross-device updates.

## MUST

### Identity, recording, and retention

- An authenticated record is always scoped to the active Customer resolved from Sanctum; the browser never submits `user_id`.
- `PUT /api/v1/customer/recently-viewed/{product}` resolves the Product through `storefrontVisible()`, inserts or updates its one Customer/Product row, and sets `last_viewed_at` from Laravel's UTC clock.
- Reopening the same Product updates recency without creating a second logical row. Use the existing unique key with a transaction-safe upsert/update-or-create pattern.
- A Product Detail client-only recorder runs once after the server-rendered Product is successfully resolved. It must guard against React remounts, retries, and development Strict Mode duplicate effects; backend idempotency remains mandatory.
- Product variants do not create separate history records because the browseable identity is Product, not SKU/variant.
- Keep no more than 50 distinct authenticated records per Customer, pruning the oldest records after successful record or merge. Make this limit configuration-backed.
- The existing homepage remains capped independently at 12 (or its configured value); the Account page uses cursor pagination over the retained history.

### Guest history

- A guest visit records only `{ productId, viewedAt }` in a versioned first-party `localStorage` key. Keep at most 12 distinct Product IDs and move a revisited Product to the front.
- Do not store Product DTOs, images, prices, names, search terms, identifiers for an account, tokens, addresses, payment data, or any Seller-private data in browser history.
- Read/write storage only from client code. Feature-detect access and catch security/quota/parse errors; Product Detail and normal shopping must work when storage is absent, blocked, corrupt, or cleared.
- Guest entries are display hints, not authority. Before they become cards, submit only their bounded IDs to a public Product-summary resolver and retain returned Products in requested recency order.
- `localStorage` is same-origin and persists across ordinary sessions but can be cleared or unavailable; private browsing may clear it when the private session ends. Treat guest history as best effort. [MDN Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API)

### Authentication merge and logout

- After a successful Customer session restoration or login, submit the bounded guest list once to `POST /api/v1/customer/recently-viewed/merge`; authentication success must not wait for, or fail because of, the merge.
- Laravel validates UUID shape, maximum item count, duplicate IDs, and an optional bounded client timestamp; it resolves only storefront-visible Products and ignores invalid, missing, hidden, or malformed entries.
- Merge deduplicates by Product ID, retains the later credible timestamp when it is not in the future, upserts Customer-scoped rows, prunes retention, and is safe to retry.
- On merge success, replace or clear the guest key with the canonical result. On failure, retain the local list for a later retry without claiming that it synced.
- Logout never deletes server history and must not copy a Customer's complete server history into guest storage.

### Reading, removal, and privacy

- `GET /api/v1/customer/recently-viewed?cursor=&limit=` returns authenticated history newest first, joined to Products filtered by `storefrontVisible()`, with safe Product card data, `lastViewedAt`, and opaque cursor pagination.
- The public resolver accepts at most 12 UUIDs and returns only `storefrontVisible()` Product cards; it must not expose another Customer's history or accept arbitrary filters.
- Hidden, unpublished, compliance-restricted, vacation, inactive-Shop, inactive-Seller, or deleted Products are omitted from both authenticated and guest display. Retained database rows may stay until normal pruning; do not leak their old title, price, image, or reason.
- `DELETE /api/v1/customer/recently-viewed/{product}` removes only the current Customer's record and is idempotent. `DELETE /api/v1/customer/recently-viewed` clears only that Customer's history.
- The Account page provides remove-one and clear-all controls with confirmation for clear-all. Guest equivalents alter only local storage and do not affect a later authenticated history.
- Responses are private and `no-store`. Do not put Customer history in the shared homepage cache, logs, analytics events, notifications, or Seller/Admin APIs.

### Customer experience and accessibility

- Homepage renders the existing Recently Viewed rail only when it has valid Products. Guests hydrate their resolved local items in a client boundary; signed-in Customers use the authenticated history contract without leaking it into SSR shared cache.
- Add `/account/recently-viewed` behind existing Customer protected routing, with cursor load-more, refresh on focus/reconnect, Product Detail links, Wishlist reuse, and no variant quick-add.
- Use current Product prices, stock labels, image fallbacks, and availability from `ProductSummaryResource`; Cart/Wishlist retain their own validation and mutations.
- Provide loading, empty, storage-unavailable, resolver/API-error with retry, merge-pending/failed, and stale-item-removed states without interrupting Product Detail.
- Use a semantic section/page heading; ensure Product links, remove controls, clear confirmation, rail controls, focus changes, and status feedback are keyboard accessible and announced without relying on colour.

### Acceptance criteria

- [ ] Opening a visible Product Detail records one recency entry; cards, searches, rails, hovers, and variants do not.
- [ ] Repeated visits update `last_viewed_at`, keep one Customer/Product record, and put that Product first.
- [ ] An unauthenticated visitor stores only a bounded minimal local history and continues shopping when browser storage fails.
- [ ] Login/session merge validates, deduplicates, bounds, and retries safely without delaying authentication.
- [ ] Authenticated history is Customer-scoped, persistent across normal-device refreshes, and never exposes `user_id` control to the client.
- [ ] Guest and Customer displays omit every Product excluded by `storefrontVisible()` and use current safe Product card data.
- [ ] Homepage and Account page use the owning history API/data model; personalized data is never shared-cached.
- [ ] Remove-one and clear-all affect only the current Customer or current guest browser as applicable.

## HOW

### Laravel API and persistence

- Keep the existing `RecentlyViewedProduct` model, migration, relationships, unique constraint, and `last_viewed_at` naming. Do not modify the executed migration; add an additive migration only if a configuration/retention field later proves necessary.
- Add Customer-active routes, a `RecentlyViewedController`, form requests, and a focused `RecentlyViewedService` for record, merge, list, remove, and clear operations.
- Route set:

  ```http
  GET    /api/v1/customer/recently-viewed
  PUT    /api/v1/customer/recently-viewed/{product}
  POST   /api/v1/customer/recently-viewed/merge
  DELETE /api/v1/customer/recently-viewed/{product}
  DELETE /api/v1/customer/recently-viewed
  POST   /api/v1/customer/products/resolve
  ```

- The resolver is public, rate-limited, validates a bounded `productIds` array, loads `shop`/`galleryMedia` eagerly, and returns `ProductSummaryResource` in request order after visibility filtering.
- The authenticated list loads `product.shop` and `product.galleryMedia` in bounded cursor order and maps each record to `{ product, lastViewedAt }`; avoid N+1 queries and raw model serialization.
- Reuse the service/query composition in `HomepageService` where practical, so homepage and Account history cannot disagree about scope or ordering.
- Do not add Redis. The database is already the durable source for Customer history and browser storage is sufficient for this bounded school-project feature.

### Customer application

- Add a small browser-only `recently-viewed-storage` utility with parse/version validation, deduplication, cap, record, clear, and safe failure handling.
- Add a Product Detail client recorder beside `ProductConfigurator`; it records locally for guests or calls the authenticated endpoint, then triggers a best-effort guest merge after the existing auth provider confirms a Customer.
- Add authenticated API helpers/types under `src/webapp/src/lib/marketplace/`, including a private no-store request path distinct from public discovery helpers.
- Update `RecentlyViewedSection` to omit itself when empty, hydrate guest cards only after mount, and continue using `ProductRail` for consistent accessible cards.
- Add the protected Account page and a focused client history list for cursor pagination, remove, clear, retry, and reconciled optimistic UI.

### Validation, testing, and rollout

- Laravel tests: Customer role/status enforcement; Product visibility; upsert/recency; concurrent/retried writes; retention pruning; merge validation/order/idempotency; cursor scope; delete/clear isolation; safe DTOs; resolver bound/order; and no N+1 representative list.
- Customer tests: Product Detail recording once; guest storage unavailable/corrupt; stale resolver omissions; merge success/failure; Account protection/list/remove/clear; homepage guest/auth states; focus/retry; and keyboard/announced feedback.
- Run focused API tests plus Customer lint, strict TypeScript, and production build. Add a dated `docs/PROGRESS.md` implementation entry when the feature is built; this revision is documentation-only.

### Open implementation choices

- Decide whether the Account history should expose a human-readable `Viewed at` timestamp or only recency ordering; both use the same safe server timestamp.
- Decide the exact configuration keys for retained Customer records and guest entries; this contract sets the initial limits at 50 and 12 respectively.
- Decide whether a privacy/settings control to disable future tracking is required. It needs a separate persisted preference and must not be implied by clear-all.

### Sources

- Existing foundation: `src/api/app/Models/RecentlyViewedProduct.php`, `src/api/app/Services/Customer/HomepageService.php`, `src/api/config/homepage.php`, and `docs/schema.md` section 9.8.
- [MDN Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) documents origin-scoped browser storage, persistence, and private-session behaviour.
- [MDN storage availability guidance](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API) supports handling blocked and quota-limited storage safely.
- [Laravel Eloquent](https://laravel.com/docs/12.x/eloquent) documents model persistence patterns used by the Customer-scoped upsert service.
